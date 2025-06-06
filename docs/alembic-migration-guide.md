# Alembic Database Migration Guide

This guide explains how to use Alembic for database migrations in PrintFarmHQ.

## Overview

PrintFarmHQ uses [Alembic](https://alembic.sqlalchemy.org/) for database migrations. Alembic is the database migration tool for SQLAlchemy that provides:

- Automatic migration generation from model changes
- Version control for database schema
- Upgrade and downgrade capabilities
- Multi-developer collaboration support

## Migration Commands

All migration commands are available through the Makefile:

### Run Migrations

```bash
# Apply all pending migrations
make migrate
```

### List Migrations

```bash
# Show all migrations and their status
make migrate-list
```

### Create New Migration

```bash
# Auto-generate migration from model changes
make migrate-create DESC="Add new feature"

# Example:
make migrate-create DESC="Add user preferences table"
```

### Revert Migrations

```bash
# Revert the last migration
make migrate-revert

# Revert multiple migrations
make migrate-revert COUNT=2

# Revert to specific revision
make migrate-revert-to VERSION=69413fe9f868
```

### Check Current Status

```bash
# Show current database revision
make migrate-dry-run
```

## Working with Migrations

### 1. Making Model Changes

When you modify models in `backend/app/models.py`:

1. Make your changes to the model classes
2. Create a new migration:
   ```bash
   make migrate-create DESC="Description of changes"
   ```
3. Review the generated migration file in `backend/alembic/versions/`
4. Apply the migration:
   ```bash
   make migrate
   ```

### 2. Migration File Structure

Migration files are stored in `backend/alembic/versions/` with timestamps:
```
20250606_1515_69413fe9f868_initial_schema.py
```

Format: `YYYYMMDD_HHMM_<revision>_<slug>.py`

### 3. Best Practices

1. **Always review auto-generated migrations** - Alembic may not detect all changes perfectly
2. **Test migrations locally** before applying to production
3. **Never edit applied migrations** - Create a new migration instead
4. **Keep migrations small and focused** - One logical change per migration
5. **Write descriptive migration messages** - They help track schema evolution

### 4. Common Scenarios

#### Adding a New Column
```python
# In models.py
class User(Base):
    # ... existing fields ...
    preferences = Column(JSON, nullable=True)  # New field

# Create migration
make migrate-create DESC="Add user preferences column"
```

#### Creating a New Table
```python
# In models.py
class UserPreference(Base):
    __tablename__ = "user_preferences"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    # ... other fields ...

# Create migration
make migrate-create DESC="Create user preferences table"
```

#### Adding an Index
```python
# In models.py
class Product(Base):
    # ... existing fields ...
    __table_args__ = (
        Index('ix_product_sku_owner', 'sku', 'owner_id'),
    )

# Create migration
make migrate-create DESC="Add composite index on product sku and owner"
```

## Troubleshooting

### "No changes detected"
- Ensure all models are imported in `backend/alembic/env.py`
- Check that you've actually saved your model changes
- Try running with explicit model comparison

### "Target database is not up to date"
- Run `make migrate` to apply pending migrations
- Check current status with `make migrate-list`

### "Can't locate revision"
- Use `make migrate-list` to see available revisions
- Ensure you're using the correct revision ID

### Manual Database Access
```bash
# Access database directly
docker exec -it printfarmhq-database sqlite3 /data/hq.db

# Check Alembic version table
.tables
SELECT * FROM alembic_version;
```

## Development Workflow

1. **Start development environment**:
   ```bash
   make dev
   ```

2. **Make model changes** in `backend/app/models.py`

3. **Create migration**:
   ```bash
   make migrate-create DESC="Your description"
   ```

4. **Review generated migration** in `backend/alembic/versions/`

5. **Apply migration**:
   ```bash
   make migrate
   ```

6. **Test your changes**

7. **Commit migration file** with your code changes

## Production Deployment

Migrations run automatically on container startup via `backend/start.sh`. The startup script:

1. Waits for database to be ready
2. Runs `alembic upgrade head`
3. Starts the application

To skip migrations on startup, set environment variable:
```bash
RUN_MIGRATIONS=false
```

## Migration Safety

### Before Major Migrations

1. **Backup the database**:
   ```bash
   make dump-db
   ```

2. **Test in development** first

3. **Have a rollback plan** ready

### Rollback Procedure

If a migration causes issues:

1. **Immediate rollback**:
   ```bash
   make migrate-revert
   ```

2. **Restore from backup** if needed:
   ```bash
   make restore-db DUMP_FILE=path/to/backup.sql
   ```

## References

- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- PrintFarmHQ Models: `backend/app/models.py`
- Alembic Configuration: `backend/alembic/env.py`