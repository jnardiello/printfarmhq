.PHONY: build up down clean logs seed-db dump-db restore-db

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

# Seed database with initial test data
API_URL ?= http://localhost:8000
TODAY := $(shell date +%F)
SUPERADMIN_EMAIL ?= superadmin@wmehq.com
SUPERADMIN_PASSWORD ?= superadmin123

seed-db:
	@echo "Seeding database with initial data (requires authentication)..."
	@set -e; \
	echo "Logging in as superadmin to get access token..."; \
	curl -s -X POST "$(API_URL)/auth/login" \
		-H "Content-Type: application/json" \
		-d '{"email": "$(SUPERADMIN_EMAIL)", "password": "$(SUPERADMIN_PASSWORD)"}' \
		-o /tmp/login_response.json || (echo "Failed to login as superadmin" >&2; exit 1); \
	echo "Login response:"; cat /tmp/login_response.json; echo; \
	TOKEN=$$(jq -r '.access_token' /tmp/login_response.json); \
	if [ -z "$$TOKEN" ] || [ "$$TOKEN" = "null" ]; then \
		echo "Error: Failed to get access token from response: $$(cat /tmp/login_response.json)" >&2; \
		rm -f /tmp/*_seed_response.json /tmp/login_response.json; \
		exit 1; \
	fi; \
	echo "Got access token: $$TOKEN"; \
	\
	echo "Creating filament..."; \
	curl -s -X POST "$(API_URL)/filaments" \
		-H "Content-Type: application/json" \
		-H "Authorization: Bearer $$TOKEN" \
		-d '{"color": "Bambu La", "brand": "SeedBrand", "material": "PLA"}' \
		-o /tmp/filament_seed_response.json || (echo "Failed to create filament" >&2; exit 1); \
	echo "Filament creation response:"; cat /tmp/filament_seed_response.json; echo; \
	FILAMENT_ID=$$(jq -r '.id' /tmp/filament_seed_response.json); \
	if [ -z "$$FILAMENT_ID" ] || [ "$$FILAMENT_ID" = "null" ]; then \
		echo "Error: Failed to create filament or extract ID from response: $$(cat /tmp/filament_seed_response.json)" >&2; \
		rm -f /tmp/*_seed_response.json /tmp/login_response.json; \
		exit 1; \
	fi; \
	echo "Created Filament with ID: $$FILAMENT_ID"; \
	\
	echo "Creating filament purchase for filament ID: $$FILAMENT_ID..."; \
	curl -s -X POST "$(API_URL)/filament_purchases" \
		-H "Content-Type: application/json" \
		-H "Authorization: Bearer $$TOKEN" \
		-d "{\"filament_id\": $$FILAMENT_ID, \"quantity_kg\": 1.0, \"price_per_kg\": 20.0, \"purchase_date\": \"$(TODAY)\"}" \
		-o /tmp/purchase_seed_response.json || (echo "Failed to create filament purchase" >&2; exit 1); \
	echo "Filament purchase response:"; cat /tmp/purchase_seed_response.json; echo; \
	\
	echo "Creating printer profile..."; \
	curl -s -X POST "$(API_URL)/printer_profiles" \
		-H "Content-Type: application/json" \
		-H "Authorization: Bearer $$TOKEN" \
		-d '{"name": "TestSeedPrinter", "price_eur": 500, "expected_life_hours": 2000}' \
		-o /tmp/printer_seed_response.json || (echo "Failed to create printer profile" >&2; exit 1); \
	echo "Printer profile response:"; cat /tmp/printer_seed_response.json; echo; \
	\
	echo "Creating product using filament ID: $$FILAMENT_ID..."; \
	curl -s -X POST "$(API_URL)/products" \
		-H "Authorization: Bearer $$TOKEN" \
		-F "name=TestSeedProduct" \
		-F "print_time_hrs=1.5" \
		-F "filament_usages=[{\"filament_id\": $$FILAMENT_ID, \"grams_used\": 50}]" \
		-o /tmp/product_seed_response.json || (echo "Failed to create product" >&2; exit 1); \
	echo "Product creation response:"; cat /tmp/product_seed_response.json; echo; \
	\
	echo "Database seeding complete!"; \
	echo "Superadmin user available: $(SUPERADMIN_EMAIL) / $(SUPERADMIN_PASSWORD)"; \
	rm -f /tmp/*_seed_response.json /tmp/login_response.json

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