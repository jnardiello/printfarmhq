# Database Migrations

This directory contains database migration scripts that are automatically executed during deployments.

## Migration File Naming Convention

Migration files should follow this naming pattern:
```
YYYYMMDD_HHMMSS_description.sql
```

Example: `20250528_143000_add_user_preferences_table.sql`

## Migration Rules

1. **File naming**: Use timestamp prefix (YYYYMMDD_HHMMSS) to ensure proper execution order
2. **UP/DOWN sections**: Include both forward (UP) and rollback (DOWN) SQL
3. **Idempotent**: Migrations should be safe to run multiple times
4. **Forward-only**: Only add new migration files, never modify existing ones
5. **SQL format**: Use standard SQL compatible with SQLite
6. **Descriptive names**: Use clear, descriptive names for the migration purpose
7. **Reversible**: Always provide DOWN migration for rollback capability

## Migration File Structure

Each migration file must contain both UP and DOWN sections:

```sql
-- 20250528_143000_add_user_preferences_table.sql
-- Migration: Add user preferences table
-- Created: 2025-05-28T14:30:00

-- UP: Apply the migration
CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preference_key TEXT NOT NULL,
    preference_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, preference_key)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(preference_key);

-- DOWN: Revert the migration
DROP INDEX IF EXISTS idx_user_preferences_key;
DROP INDEX IF EXISTS idx_user_preferences_user_id;
DROP TABLE IF EXISTS user_preferences;
```

## Migration Execution

### Forward Migrations
Migrations are automatically executed during:
1. Application startup (if `RUN_MIGRATIONS=true`)
2. Release deployment (`make publish`)
3. Manual execution (`make migrate` or `python app/migrate.py migrate`)

### Rollback Migrations
Migrations can be reverted using:
1. **Revert last N migrations**: `make migrate-revert COUNT=3`
2. **Revert to specific version**: `make migrate-revert-to VERSION=20250528_143000`
3. **Dry run**: `make migrate-dry-run` (check pending migrations)

## Available Commands

### Makefile Commands
```bash
# Forward migrations
make migrate                    # Apply pending migrations
make migrate-list              # List migration status
make migrate-dry-run          # Show pending migrations (dry run)

# Create new migration
make migrate-create DESC="add user preferences table"

# Rollback migrations
make migrate-revert           # Revert last 1 migration
make migrate-revert COUNT=3   # Revert last 3 migrations
make migrate-revert-to VERSION=20250528_143000  # Revert to specific version
```

### Direct CLI Commands
```bash
cd backend

# Forward migrations
python app/migrate.py migrate
python app/migrate.py migrate --dry-run
python app/migrate.py list

# Create migration
python app/migrate.py create --description "add user preferences table"

# Rollback migrations
python app/migrate.py revert --count 1
python app/migrate.py revert --count 3 --dry-run
python app/migrate.py revert-to --version 20250528_143000
```

## Checking Migration Status

The migration system tracks executed migrations in the `schema_migrations` table:
```sql
SELECT version, filename, applied_at FROM schema_migrations ORDER BY version;
```