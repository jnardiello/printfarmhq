.PHONY: install up down clean logs dump-db restore-db test test-backend test-frontend test-ci test-clean push-images dev help check-env

# Configuration
COMPOSE := docker compose
COMPOSE_TEST := $(COMPOSE) -f docker-compose.test.yml
TEST_ARTIFACTS := backend/test-results frontend/test-results test-results backend/htmlcov backend/.coverage frontend/playwright-report

# Load backend/.env only for non-docker commands
ifeq (,$(findstring docker,$(MAKECMDGOALS)))
-include backend/.env
export
endif

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "PrintFarmHQ - Available commands:"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "\033[36m%-15s\033[0m %s\n", "Command", "Description"} /^[a-zA-Z_-]+:.*?##/ { printf "\033[36m%-15s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

install: ## Set up PrintFarmHQ for first time
	@echo "🏭 PrintFarmHQ Setup"
	@echo "==================="
	@echo ""
	@if [ -f "backend/.env" ] && [ -s "backend/.env" ]; then \
		echo "⚠️  backend/.env already exists. Skipping setup."; \
		echo "   To reconfigure, delete backend/.env and run make install again."; \
		exit 0; \
	fi
	@cp backend/.env.example backend/.env 2>/dev/null || true
	@cp frontend/.env.example frontend/.env.local 2>/dev/null || true
	@echo "🔐 Setting up admin credentials..."
	@read -p "Admin email [admin@example.com]: " admin_email; \
	admin_email=$${admin_email:-admin@example.com}; \
	read -p "Admin password [changeme123]: " admin_password; \
	admin_password=$${admin_password:-changeme123}; \
	read -p "Admin name [Administrator]: " admin_name; \
	admin_name=$${admin_name:-Administrator}; \
	jwt_secret=$$(openssl rand -hex 32); \
	sed -i.bak "s/SUPERADMIN_EMAIL=.*/SUPERADMIN_EMAIL=$$admin_email/" backend/.env && \
	sed -i.bak "s/SUPERADMIN_PASSWORD=.*/SUPERADMIN_PASSWORD=$$admin_password/" backend/.env && \
	sed -i.bak "s/SUPERADMIN_NAME=.*/SUPERADMIN_NAME=$$admin_name/" backend/.env && \
	sed -i.bak "s/JWT_SECRET_KEY=.*/JWT_SECRET_KEY=$$jwt_secret/" backend/.env && \
	rm -f backend/.env.bak
	@echo "✅ Setup complete! Run 'make dev' to start."

# Development commands
up: check-env ## Start services (always rebuild)
	@echo "🚀 Starting PrintFarmHQ (rebuilding for latest changes)..."
	@$(COMPOSE) up --build

dev: check-env ## Start in development mode with hot reload
	@echo "🔥 Starting development environment with hot reload..."
	@$(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml up --build

down: ## Stop all services
	@$(COMPOSE) down

clean: down ## Remove containers and volumes
	@$(COMPOSE) rm -f -v

logs: ## View logs
	@$(COMPOSE) logs -f

# Testing - Optimized with parallel execution
test: clean-test-artifacts ## Run all tests
	@echo "🐳 Running all tests in Docker..."
	@$(COMPOSE_TEST) build
	@$(COMPOSE_TEST) up -d backend-api frontend-app
	@echo "Waiting for services..."
	@sleep 10
	@echo "Running tests in parallel..."
	@$(MAKE) -j4 test-backend-only test-frontend-chrome test-frontend-mobile-chrome test-frontend-safari-12 test-frontend-safari-pro-max
	@$(COMPOSE_TEST) down -v
	@echo "✅ All tests completed!"

test-backend: clean-test-artifacts ## Run backend tests only
	@echo "🐳 Running backend tests..."
	@$(COMPOSE_TEST) up --build backend-test --abort-on-container-exit
	@$(COMPOSE_TEST) down -v

test-frontend: clean-test-artifacts ## Run frontend tests only
	@echo "🐳 Running frontend E2E tests..."
	@$(COMPOSE_TEST) up --build backend-api frontend-app frontend-test --abort-on-container-exit
	@$(COMPOSE_TEST) down -v

test-ci: clean-test-artifacts ## Run tests in CI mode
	@$(COMPOSE_TEST) up --build --abort-on-container-exit
	@$(COMPOSE_TEST) down -v

# Individual test targets for parallel execution
test-backend-only:
	@echo "📦 Backend Tests..."
	@$(COMPOSE_TEST) run --rm backend-test

test-frontend-chrome:
	@echo "🌐 Frontend Tests (Chrome)..."
	@$(COMPOSE_TEST) run --rm frontend-test npx playwright test --project=chromium --reporter=list

test-frontend-mobile-chrome:
	@echo "📱 Frontend Tests (Mobile Chrome)..."
	@$(COMPOSE_TEST) run --rm frontend-test npx playwright test --project="Mobile Chrome" --reporter=list

test-frontend-safari-12:
	@echo "📱 Frontend Tests (Safari iPhone 12)..."
	@$(COMPOSE_TEST) run --rm frontend-test npx playwright test --project="Mobile Safari iPhone 12" --reporter=list

test-frontend-safari-pro-max:
	@echo "📱 Frontend Tests (Safari Pro Max)..."
	@$(COMPOSE_TEST) run --rm frontend-test npx playwright test --project="Mobile Safari iPhone 12 Pro Max" --reporter=list

clean-test-artifacts: ## Clean test artifacts
	@rm -rf $(TEST_ARTIFACTS) 2>/dev/null || true

test-clean: clean-test-artifacts ## Alias for clean-test-artifacts
	@$(COMPOSE_TEST) down -v

# Database operations
BACKUP_DIR ?= ./backups
DB_PATH := ./backend/hq.db
TIMESTAMP := $(shell date +%Y%m%d_%H%M%S)

dump-db: ## Backup database
	@mkdir -p $(BACKUP_DIR)
	@sqlite3 $(DB_PATH) ".dump" > $(BACKUP_DIR)/hq_$(TIMESTAMP).sql
	@echo "✅ Database backed up to $(BACKUP_DIR)/hq_$(TIMESTAMP).sql"

restore-db: ## Restore database from backup
	@if [ -z "$(DUMP_FILE)" ]; then \
		echo "Usage: make restore-db DUMP_FILE=path/to/dump.sql"; \
		exit 1; \
	fi
	@$(MAKE) down
	@cp $(DB_PATH) $(DB_PATH).backup_$(TIMESTAMP)
	@sqlite3 $(DB_PATH) ".read $(DUMP_FILE)"
	@echo "✅ Database restored from $(DUMP_FILE)"

# Docker Registry (for maintainers)
REGISTRY ?= ghcr.io
NAMESPACE ?= $(shell whoami | tr '[:upper:]' '[:lower:]')
VERSION ?= latest

push-images: ## Build and push multi-arch images to registry
	@echo "📤 Building and pushing multi-architecture images..."
	@./scripts/docker-auth.sh && \
	PUSH=true ./scripts/docker-build-multiarch.sh && \
	echo "✅ Images pushed successfully!"

# Utility functions
check-env:
	@if [ ! -f "backend/.env" ]; then \
		echo "❌ backend/.env not found. Run 'make install' first."; \
		exit 1; \
	fi