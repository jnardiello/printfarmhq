.PHONY: install up down clean logs dump-db restore-db test test-backend test-frontend test-ci push-images dev help

# Configuration
COMPOSE := docker compose
COMPOSE_TEST := $(COMPOSE) -f docker-compose.test.yml
TEST_ARTIFACTS := backend/test-results frontend/test-results test-results backend/htmlcov backend/.coverage frontend/playwright-report

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
	@echo "✅ PrintFarmHQ now uses database-based configuration."
	@echo "   No manual setup required!"
	@echo ""
	@echo "   Run 'make dev' to start the application."
	@echo "   On first run, you'll be prompted to create your admin account."

# Development commands
up: ## Start services in background (always rebuild)
	@echo "🚀 Starting PrintFarmHQ (rebuilding for latest changes)..."
	@NAMESPACE=$$(whoami | tr '[:upper:]' '[:lower:]') $(COMPOSE) up -d
	@echo "✅ PrintFarmHQ is running at http://localhost:3000"
	@echo "   Run 'make logs' to view logs or 'make down' to stop"

dev: ## Start in development mode with hot reload
	@echo "🔥 Starting development environment with hot reload..."
	@NAMESPACE=$$(whoami | tr '[:upper:]' '[:lower:]') $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml up --build

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
NAMESPACE ?= jnardiello
VERSION ?= latest

publish: ## Create new release with version tag and push to registry
	@./scripts/publish.sh

