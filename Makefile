.PHONY: install up down clean logs dump-db restore-db test test-backend test-frontend test-ci push-images dev help migrate migrate-list migrate-create migrate-revert migrate-revert-to migrate-dry-run publish

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
	@VERSION=$$(git describe --tags --abbrev=0 2>/dev/null || echo "v1.1.4") && \
	echo " ____       _       _   _____                   _   _ _____ " && \
	echo "|  _ \\ _ __(_)_ __ | |_|  ___|_ _ _ __ _ __ ___ | | | |  _ _ \\" && \
	echo "| |_) | '__| | '_ \\| __| |_ / _\` | '__| '_ \` _ \\| |_| | | | |" && \
	echo "|  __/| |  | | | | | |_|  _| (_| | |  | | | | | |  _  | |_| |" && \
	echo "|_|   |_|  |_|_| |_|\\__|_|  \\__,_|_|  |_| |_| |_|_| |_|_|\\\\_|" && \
	echo "" && \
	echo "                    🚀 PRODUCTION $$VERSION 🚀" && \
	echo ""
	@echo "🚀 Starting PrintFarmHQ (rebuilding for latest changes)..."
	@NAMESPACE=$$(whoami | tr '[:upper:]' '[:lower:]') $(COMPOSE) up -d
	@echo "✅ PrintFarmHQ is running at http://localhost:3000"
	@echo "   Run 'make logs' to view logs or 'make down' to stop"

dev: ## Start in development mode with hot reload
	@VERSION=$$(git describe --tags --abbrev=0 2>/dev/null || echo "v1.1.4") && \
	echo " ____       _       _   _____                   _   _ _____ " && \
	echo "|  _ \\ _ __(_)_ __ | |_|  ___|_ _ _ __ _ __ ___ | | | |  _ _ \\" && \
	echo "| |_) | '__| | '_ \\| __| |_ / _\` | '__| '_ \` _ \\| |_| | | | |" && \
	echo "|  __/| |  | | | | | |_|  _| (_| | |  | | | | | |  _  | |_| |" && \
	echo "|_|   |_|  |_|_| |_|\\__|_|  \\__,_|_|  |_| |_| |_|_| |_|_|\\\\_|" && \
	echo "" && \
	echo "                    🔥 DEVELOPMENT $$VERSION 🔥" && \
	echo ""
	@echo "🔥 Starting development environment with hot reload..."
	@NAMESPACE=$$(whoami | tr '[:upper:]' '[:lower:]') $(COMPOSE) -f docker-compose.yml -f docker-compose.dev.yml up --build

down: ## Stop all services
	@$(COMPOSE) down

clean: down ## Remove containers and volumes
	@$(COMPOSE) rm -f -v

logs: ## View logs
	@$(COMPOSE) logs -f

# Testing - Sequential execution (one test at a time)
test: clean-test-artifacts ## Run all tests
	@echo ""
	@echo "🐳 PrintFarmHQ Test Suite"
	@echo "========================"
	@echo ""
	@echo "📋 Preparing test environment..."
	@$(COMPOSE_TEST) build --quiet > /dev/null 2>&1 || { echo "❌ Build failed"; exit 1; }
	@echo "✅ Test images built"
	@$(COMPOSE_TEST) up -d backend-api frontend-app > /dev/null 2>&1
	@echo "✅ Test services started"
	@echo "⏳ Waiting for services to be ready..."
	@sleep 10
	@echo "📊 Setting up test data..."
	@$(COMPOSE_TEST) exec -T backend-api python tests/fixtures/setup_test_data.py > /dev/null 2>&1 || echo "⚠️  Test data setup completed"
	@echo ""
	@echo "📦 Backend Tests"
	@echo "----------------"
	@$(MAKE) test-backend-only || { echo "❌ Backend tests failed"; exit 1; }
	@echo "✅ Backend tests passed!"
	@echo ""
	@echo "🌐 Frontend Tests - Chrome"
	@echo "--------------------------"
	@$(MAKE) test-frontend-chrome || echo "⚠️  Chrome tests failed"
	@echo ""
	@echo "📱 Frontend Tests - Mobile Chrome"
	@echo "---------------------------------"
	@$(MAKE) test-frontend-mobile-chrome || echo "⚠️  Mobile Chrome tests failed"
	@echo ""
	@echo "📱 Frontend Tests - Safari iPhone 12"
	@echo "------------------------------------"
	@$(MAKE) test-frontend-safari-12 || echo "⚠️  Safari iPhone 12 tests failed"
	@echo ""
	@echo "📱 Frontend Tests - Safari iPhone 12 Pro Max"
	@echo "--------------------------------------------"
	@$(MAKE) test-frontend-safari-pro-max || echo "⚠️  Safari Pro Max tests failed"
	@echo ""
	@echo "🧹 Cleaning up..."
	@$(COMPOSE_TEST) down -v > /dev/null 2>&1
	@echo ""
	@echo "✅ Test run completed!"
	@echo ""

test-backend: clean-test-artifacts ## Run backend tests only
	@echo "🐳 Running backend tests..."
	@echo "Building test image..."
	@$(COMPOSE_TEST) build --quiet backend-test > /dev/null 2>&1 || { echo "❌ Build failed"; exit 1; }
	@$(COMPOSE_TEST) up backend-test --abort-on-container-exit
	@$(COMPOSE_TEST) down -v

test-frontend: clean-test-artifacts ## Run frontend tests only
	@echo "🐳 Running frontend E2E tests..."
	@echo "Building test images..."
	@$(COMPOSE_TEST) build --quiet > /dev/null 2>&1 || { echo "❌ Build failed"; exit 1; }
	@$(COMPOSE_TEST) up -d backend-api frontend-app > /dev/null 2>&1
	@echo "⏳ Waiting for services to be ready..."
	@sleep 10
	@echo "📊 Setting up test data..."
	@$(COMPOSE_TEST) exec -T backend-api python tests/fixtures/setup_test_data.py > /dev/null 2>&1 || echo "⚠️  Test data setup completed"
	@$(COMPOSE_TEST) up frontend-test --abort-on-container-exit
	@$(COMPOSE_TEST) down -v

test-frontend-spec: clean-test-artifacts ## Run specific frontend test file (usage: make test-frontend-spec SPEC=filaments.spec.ts)
	@if [ -z "$(SPEC)" ]; then \
		echo "Usage: make test-frontend-spec SPEC=filename.spec.ts"; \
		exit 1; \
	fi
	@echo "🐳 Running frontend E2E test: $(SPEC)..."
	@echo "Building test images..."
	@$(COMPOSE_TEST) build --quiet > /dev/null 2>&1 || { echo "❌ Build failed"; exit 1; }
	@$(COMPOSE_TEST) up -d backend-api frontend-app > /dev/null 2>&1
	@echo "⏳ Waiting for services to be ready..."
	@sleep 10
	@echo "📊 Setting up test data..."
	@$(COMPOSE_TEST) exec -T backend-api python tests/fixtures/setup_test_data.py > /dev/null 2>&1 || echo "⚠️  Test data setup completed"
	@$(COMPOSE_TEST) run --rm -T frontend-test npx playwright test --config=playwright.docker.config.ts e2e/tests/$(SPEC) --reporter=list
	@$(COMPOSE_TEST) down -v

test-ci: clean-test-artifacts ## Run tests in CI mode
	@$(COMPOSE_TEST) up --build --abort-on-container-exit
	@$(COMPOSE_TEST) down -v

# Individual test targets for parallel execution
test-backend-only:
	@$(COMPOSE_TEST) run --rm -T backend-test

test-frontend-chrome:
	@$(COMPOSE_TEST) run --rm -T frontend-test npx playwright test --config=playwright.docker.config.ts --project=chromium --reporter=list

test-frontend-mobile-chrome:
	@$(COMPOSE_TEST) run --rm -T frontend-test npx playwright test --config=playwright.docker.config.ts --project="Mobile Chrome" --reporter=list

test-frontend-safari-12:
	@$(COMPOSE_TEST) run --rm -T frontend-test npx playwright test --config=playwright.docker.config.ts --project="Mobile Safari iPhone 12" --reporter=list

test-frontend-safari-pro-max:
	@$(COMPOSE_TEST) run --rm -T frontend-test npx playwright test --config=playwright.docker.config.ts --project="Mobile Safari iPhone 12 Pro Max" --reporter=list

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

# Database migrations (Alembic)
migrate: ## Run database migrations
	@echo "🔄 Running database migrations with Alembic..."
	@if [ "$$(docker compose ps -q backend 2>/dev/null)" ]; then \
		docker compose exec backend python -m alembic upgrade head; \
	else \
		echo "⚠️  Backend container not running. Starting it..."; \
		docker compose up -d backend; \
		sleep 5; \
		docker compose exec backend python -m alembic upgrade head; \
	fi

migrate-list: ## List all migrations and their status
	@echo "📋 Migration status:"
	@if [ "$$(docker compose ps -q backend 2>/dev/null)" ]; then \
		docker compose exec backend python -m alembic history --verbose; \
	else \
		echo "⚠️  Backend container not running. Starting it..."; \
		docker compose up -d backend; \
		sleep 5; \
		docker compose exec backend python -m alembic history --verbose; \
	fi

migrate-create: ## Create a new migration (usage: make migrate-create DESC="description")
	@if [ -z "$(DESC)" ]; then \
		echo "Usage: make migrate-create DESC=\"your migration description\""; \
		exit 1; \
	fi
	@echo "📝 Creating new migration with Alembic..."
	@if [ "$$(docker compose ps -q backend 2>/dev/null)" ]; then \
		docker compose exec backend python -m alembic revision --autogenerate -m "$(DESC)"; \
	else \
		echo "⚠️  Backend container not running. Starting it..."; \
		docker compose up -d backend; \
		sleep 5; \
		docker compose exec backend python -m alembic revision --autogenerate -m "$(DESC)"; \
	fi

migrate-revert: ## Revert last migration (usage: make migrate-revert [COUNT=N])
	@echo "🔄 Reverting migration(s)..."
	@if [ "$$(docker compose ps -q backend 2>/dev/null)" ]; then \
		docker compose exec backend python -m alembic downgrade -$(or $(COUNT),1); \
	else \
		echo "⚠️  Backend container not running. Starting it..."; \
		docker compose up -d backend; \
		sleep 5; \
		docker compose exec backend python -m alembic downgrade -$(or $(COUNT),1); \
	fi

migrate-revert-to: ## Revert to specific version (usage: make migrate-revert-to VERSION=revision_id)
	@if [ -z "$(VERSION)" ]; then \
		echo "Usage: make migrate-revert-to VERSION=revision_id"; \
		exit 1; \
	fi
	@echo "🔄 Reverting to version $(VERSION)..."
	@if [ "$$(docker compose ps -q backend 2>/dev/null)" ]; then \
		docker compose exec backend python -m alembic downgrade "$(VERSION)"; \
	else \
		echo "⚠️  Backend container not running. Starting it..."; \
		docker compose up -d backend; \
		sleep 5; \
		docker compose exec backend python -m alembic downgrade "$(VERSION)"; \
	fi

migrate-dry-run: ## Show current database revision
	@echo "🔍 Checking current database revision..."
	@if [ "$$(docker compose ps -q backend 2>/dev/null)" ]; then \
		docker compose exec backend python -m alembic current; \
	else \
		echo "⚠️  Backend container not running. Starting it..."; \
		docker compose up -d backend; \
		sleep 5; \
		docker compose exec backend python -m alembic current; \
	fi

# Docker Registry (for maintainers)
REGISTRY ?= ghcr.io
NAMESPACE ?= jnardiello
VERSION ?= latest

publish: ## Create new release with version tag and push to registry (interactive)
	@./scripts/publish.sh

publish-major: ## Create major release (X.0.0)
	@./scripts/publish.sh major

publish-minor: ## Create minor release (x.Y.0)
	@./scripts/publish.sh minor

publish-patch: ## Create patch release (x.y.Z) [same as publish]
	@./scripts/publish.sh patch

publish-help: ## Show publish script help
	@./scripts/publish.sh --help

publish-dry-run: ## Test publish process without making changes
	@./scripts/publish.sh --dry-run

