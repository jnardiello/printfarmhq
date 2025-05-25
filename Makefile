.PHONY: install build up down clean logs dump-db restore-db test test-backend test-backend-all test-backend-cov test-frontend test-ci

# Load environment variables from backend/.env if it exists
ifneq (,$(wildcard backend/.env))
    include backend/.env
    export
endif

install:
	@echo "🏭 PrintFarmHQ Setup"
	@echo "==================="
	@echo ""
	@echo "Setting up your PrintFarmHQ development environment..."
	@echo ""
	@# Check if .env files already exist and have content
	@if [ -f "backend/.env" ] && [ -s "backend/.env" ]; then \
		echo "⚠️  backend/.env already exists and has content. Skipping..."; \
	else \
		echo "📝 Creating backend/.env from example..."; \
		cp backend/.env.example backend/.env; \
	fi
	@if [ -f "frontend/.env.local" ]; then \
		echo "⚠️  frontend/.env.local already exists. Skipping..."; \
	else \
		echo "📝 Creating frontend/.env.local from example..."; \
		cp frontend/.env.example frontend/.env.local; \
	fi
	@echo ""
	@echo "🔐 Setting up admin credentials..."
	@read -p "Admin email [admin@example.com]: " admin_email; \
	admin_email=$${admin_email:-admin@example.com}; \
	read -p "Admin password [changeme123]: " admin_password; \
	admin_password=$${admin_password:-changeme123}; \
	read -p "Admin name [Administrator]: " admin_name; \
	admin_name=$${admin_name:-Administrator}; \
	echo ""; \
	echo "🔑 Generating secure JWT secret..."; \
	jwt_secret=$$(openssl rand -hex 32); \
	echo ""; \
	echo "📝 Updating backend/.env..."; \
	sed -i.bak "s/SUPERADMIN_EMAIL=.*/SUPERADMIN_EMAIL=$$admin_email/" backend/.env; \
	sed -i.bak "s/SUPERADMIN_PASSWORD=.*/SUPERADMIN_PASSWORD=$$admin_password/" backend/.env; \
	sed -i.bak "s/SUPERADMIN_NAME=.*/SUPERADMIN_NAME=$$admin_name/" backend/.env; \
	sed -i.bak "s/JWT_SECRET_KEY=.*/JWT_SECRET_KEY=$$jwt_secret/" backend/.env; \
	rm -f backend/.env.bak; \
	echo ""; \
	echo "✅ Setup complete!"; \
	echo ""; \
	echo "📋 Your configuration:"; \
	echo "   Email: $$admin_email"; \
	echo "   Password: $$admin_password"; \
	echo "   Name: $$admin_name"; \
	echo ""; \
	echo "🚀 Next steps:"; \
	echo "   1. Run: make up"; \
	echo "   2. Open: http://localhost:3000"; \
	echo "   3. Login with the credentials above"; \
	echo ""

build:
	docker compose -f docker-compose.yml build

up:
	docker compose -f docker-compose.yml up --build

down:
	docker compose -f docker-compose.yml down

clean: down
	docker compose -f docker-compose.yml rm -f

logs:
	docker compose -f docker-compose.yml logs -f


# Database backup and restore commands
BACKUP_DIR ?= ./backups
DB_PATH := ./backend/hq.db
DUMP_FILE ?= $(BACKUP_DIR)/hq_latest.sql
TIMESTAMP := $(shell date +%Y%m%d_%H%M%S)

dump-db:
	@echo "Creating database dump..."
	@mkdir -p $(BACKUP_DIR)
	@sqlite3 $(DB_PATH) ".dump" > $(DUMP_FILE)
	@echo "Database dump created: $(DUMP_FILE)"

restore-db:
	@if [ ! -f "$(DUMP_FILE)" ]; then \
		echo "Error: Dump file $(DUMP_FILE) not found"; \
		echo "Create a dump first with: make dump-db"; \
		echo "Or specify a custom dump file: make restore-db DUMP_FILE=path/to/dump.sql"; \
		exit 1; \
	fi
	@echo "Stopping services to safely restore database..."
	@make down
	@echo "Backing up current database..."
	@cp $(DB_PATH) $(DB_PATH).backup_$(TIMESTAMP)
	@echo "Restoring database from $(DUMP_FILE)..."
	@rm -f $(DB_PATH)
	@sqlite3 $(DB_PATH) ".read $(DUMP_FILE)"
	@echo "Database restored successfully from $(DUMP_FILE)"
	@echo "Previous database backed up as $(DB_PATH).backup_$(TIMESTAMP)"
	@echo "Starting services..."
	@make up

# Testing - Docker only
test:
	@echo "🐳 Running all tests in Docker..."
	@docker compose -f docker-compose.test.yml build
	@echo "Starting services..."
	@docker compose -f docker-compose.test.yml up -d backend-api frontend-app
	@echo "Waiting for services to be ready..."
	@sleep 15
	@echo -e "\n📦 Running Backend Tests..."
	@docker compose -f docker-compose.test.yml run --rm backend-test
	@echo -e "\n🌐 Running Frontend E2E Tests (Desktop Chrome)..."
	@docker compose -f docker-compose.test.yml run --rm frontend-test npx playwright test --config=playwright.docker.config.ts --project=chromium --reporter=list
	@echo -e "\n📱 Running Frontend E2E Tests (Mobile Chrome)..."
	@docker compose -f docker-compose.test.yml run --rm frontend-test npx playwright test --config=playwright.docker.config.ts --project="Mobile Chrome" --reporter=list
	@echo -e "\n📱 Running Frontend E2E Tests (Safari iPhone 12)..."
	@docker compose -f docker-compose.test.yml run --rm frontend-test npx playwright test --config=playwright.docker.config.ts --project="Mobile Safari iPhone 12" --reporter=list
	@echo -e "\n📱 Running Frontend E2E Tests (Safari iPhone 12 Pro Max)..."
	@docker compose -f docker-compose.test.yml run --rm frontend-test npx playwright test --config=playwright.docker.config.ts --project="Mobile Safari iPhone 12 Pro Max" --reporter=list
	@echo -e "\n✅ All tests completed!"
	@docker compose -f docker-compose.test.yml down

test-backend:
	@echo "🐳 Running backend tests in Docker..."
	@docker compose -f docker-compose.test.yml up --build backend-test --abort-on-container-exit
	@docker compose -f docker-compose.test.yml down

test-frontend:
	@echo "🐳 Running frontend E2E tests in Docker..."
	@docker compose -f docker-compose.test.yml up --build backend-api frontend-app frontend-test --abort-on-container-exit
	@docker compose -f docker-compose.test.yml down

test-clean:
	@echo "🧹 Cleaning up test artifacts and containers..."
	@docker compose -f docker-compose.test.yml down -v
	@rm -rf backend/test-results frontend/test-results test-results
	@rm -rf backend/htmlcov backend/.coverage frontend/playwright-report

test-ci:
	@echo "🤖 Running tests in CI mode..."
	@docker compose -f docker-compose.test.yml up --build --abort-on-container-exit
	@docker compose -f docker-compose.test.yml down --volumes
