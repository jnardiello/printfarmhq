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
2. **Idempotent**: Migrations should be safe to run multiple times
3. **Forward-only**: Only add new migration files, never modify existing ones
4. **SQL format**: Use standard SQL compatible with SQLite
5. **Descriptive names**: Use clear, descriptive names for the migration purpose

## Example Migration

```sql
-- 20250528_143000_add_user_preferences_table.sql

-- Create user preferences table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    preference_key TEXT NOT NULL,
    preference_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, preference_key)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_key ON user_preferences(preference_key);
```

## Migration Execution

Migrations are automatically executed during:
1. Application startup (if `RUN_MIGRATIONS=true`)
2. Release deployment (`make publish`)
3. Manual execution (`python -m app.migrate`)

## Checking Migration Status

The migration system tracks executed migrations in the `schema_migrations` table:
```sql
SELECT * FROM schema_migrations ORDER BY version;
```