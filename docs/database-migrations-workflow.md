# Database Migrations Workflow Guide

This guide provides a complete workflow for database migrations in PrintFarmHQ using Alembic.

## Table of Contents
- [Quick Start](#quick-start)
- [Day-to-Day Workflow](#day-to-day-workflow)
- [Common Scenarios](#common-scenarios)
- [Team Collaboration](#team-collaboration)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Quick Start

### First Time Setup
```bash
# Clone the repository
git clone <repository-url>
cd printfarmhq

# Start development environment (migrations run automatically)
make dev

# Check migration status
make migrate-list
```

### Making Your First Database Change
```bash
# 1. Edit your model in backend/app/models.py
# 2. Create a migration
make migrate-create DESC="Add new feature"

# 3. Review the generated migration file
# 4. Apply the migration
make migrate

# 5. Commit your changes
git add backend/app/models.py backend/alembic/versions/*.py
git commit -m "feat: add new feature to database"
```

## Day-to-Day Workflow

### Starting Your Day
```bash
# Pull latest changes
git pull origin main

# Start development environment (auto-runs migrations)
make dev

# Or manually check and run migrations
make migrate-list  # See what's pending
make migrate       # Apply pending migrations
```

### Making Database Changes

#### Step 1: Plan Your Change
Before modifying models, consider:
- Will this break existing data?
- Do I need to migrate existing data?
- Can this be rolled back safely?

#### Step 2: Modify Your Models
```python
# backend/app/models.py
class User(Base):
    __tablename__ = "users"
    # ... existing fields ...
    
    # Adding a new field
    preferences = Column(JSON, nullable=True, default={})
    
    # Adding a new relationship
    notifications = relationship("Notification", back_populates="user")
```

#### Step 3: Generate Migration
```bash
# Always use descriptive messages
make migrate-create DESC="Add user preferences and notifications"
```

#### Step 4: Review Generated Migration
```bash
# Check the latest file in backend/alembic/versions/
ls -la backend/alembic/versions/

# Review the generated SQL
cat backend/alembic/versions/20250606_*_add_user_preferences_and_notifications.py
```

**⚠️ Always review for:**
- Correct column types
- Proper nullable settings
- Data migration needs
- Index creation
- Foreign key constraints

#### Step 5: Test Migration
```bash
# Apply migration
make migrate

# Test your application
# ... run your tests ...

# Test rollback
make migrate-revert

# Re-apply if everything works
make migrate
```

#### Step 6: Commit Changes
```bash
# Stage both model and migration files
git add backend/app/models.py
git add backend/alembic/versions/*_add_user_preferences_and_notifications.py

# Commit with clear message
git commit -m "feat(db): add user preferences and notifications support"
```

## Common Scenarios

### Adding a New Table
```python
# backend/app/models.py
class TeamMember(Base):
    __tablename__ = "team_members"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    role = Column(String, nullable=False)
    joined_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User")
    team = relationship("Team")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('user_id', 'team_id', name='_user_team_uc'),
    )
```

```bash
make migrate-create DESC="Add team members table with user-team relationships"
make migrate
```

### Adding a Column with Default Value
```python
# Adding a column to existing table
class Product(Base):
    __tablename__ = "products"
    # ... existing fields ...
    
    # New field with default
    is_featured = Column(Boolean, default=False, nullable=False)
```

```bash
make migrate-create DESC="Add is_featured flag to products"
# Review migration - it should handle existing rows
make migrate
```

### Adding an Index for Performance
```python
class PrintJob(Base):
    __tablename__ = "print_jobs"
    # ... existing fields ...
    
    # Add index for common queries
    __table_args__ = (
        Index('ix_print_jobs_status_created', 'status', 'created_at'),
    )
```

```bash
make migrate-create DESC="Add composite index for print job queries"
make migrate
```

### Renaming a Column (Manual Migration)
```bash
# Auto-detection doesn't work well for renames
docker-compose exec backend python -m alembic revision -m "Rename user.username to user.display_name"
```

Then edit the generated file:
```python
def upgrade():
    op.alter_column('users', 'username', new_column_name='display_name')

def downgrade():
    op.alter_column('users', 'display_name', new_column_name='username')
```

### Data Migration
When you need to transform existing data:

```python
# In your migration file
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column

def upgrade():
    # Add new column
    op.add_column('users', sa.Column('full_name', sa.String))
    
    # Create temporary table representation
    users = table('users',
        column('id', sa.Integer),
        column('first_name', sa.String),
        column('last_name', sa.String),
        column('full_name', sa.String)
    )
    
    # Migrate data
    connection = op.get_bind()
    results = connection.execute(sa.select(users.c.id, users.c.first_name, users.c.last_name))
    
    for user_id, first, last in results:
        connection.execute(
            users.update().where(users.c.id == user_id).values(
                full_name=f"{first} {last}".strip()
            )
        )
    
    # Drop old columns
    op.drop_column('users', 'first_name')
    op.drop_column('users', 'last_name')
```

## Team Collaboration

### Handling Migration Conflicts

When multiple developers create migrations:

1. **Communicate**: Use Slack/Discord to announce when creating migrations
2. **Pull Often**: `git pull` before creating new migrations
3. **Resolve Conflicts**:
   ```bash
   # If you have conflicts
   git pull origin main
   
   # Delete your local migration
   rm backend/alembic/versions/your_migration.py
   
   # Recreate on top of latest
   make migrate-create DESC="Your change"
   ```

### Migration Naming Convention
- Use clear, descriptive messages
- Include ticket number if using issue tracking: `DESC="[PRINT-123] Add user preferences"`
- Be specific: "Add email_verified column to users" not "Update users table"

## Troubleshooting

### "Target database is not up to date"
```bash
# Check current status
make migrate-list

# Apply pending migrations
make migrate

# If still issues, check database state
docker-compose exec backend python -m alembic current
```

### "Can't locate revision identifier"
```bash
# Check available revisions
make migrate-list

# If revision is missing, you may need to pull latest code
git pull origin main
```

### "Duplicate column name"
This happens when:
- Migration was partially applied
- Database was manually modified

Fix:
```bash
# Check actual database state
docker exec -it printfarmhq-database sqlite3 /data/hq.db ".schema table_name"

# Manually fix or create corrective migration
```

### Emergency Rollback
```bash
# Rollback last migration
make migrate-revert

# Rollback multiple
make migrate-revert COUNT=3

# Rollback to specific version
make migrate-list  # Find target revision
make migrate-revert-to VERSION=abc123def456
```

## Best Practices

### 1. Always Review Auto-Generated Migrations
- Check data types are correct
- Verify nullable constraints
- Ensure foreign keys are properly set
- Look for potential data loss

### 2. Test Migrations Thoroughly
```bash
# Full test cycle
make migrate         # Apply
# Test application
make migrate-revert  # Rollback
# Verify rollback worked
make migrate        # Re-apply
```

### 3. Write Meaningful Migration Messages
❌ Bad: "Update database"
✅ Good: "Add email_verified timestamp to users table"

### 4. Keep Migrations Small and Focused
- One logical change per migration
- Easier to review and rollback
- Less chance of conflicts

### 5. Document Complex Migrations
```python
"""Add user preferences with data migration

This migration:
1. Adds a JSON preferences column to users
2. Migrates existing email_notifications boolean to preferences
3. Drops the old email_notifications column
"""
```

### 6. Coordinate Schema Changes
- Announce in team chat before major changes
- Create design docs for complex changes
- Review migrations in pull requests

### 7. Production Deployment Checklist
- [ ] Test migration on staging environment
- [ ] Backup production database
- [ ] Have rollback plan ready
- [ ] Monitor application after deployment
- [ ] Document any manual steps needed

## Advanced Topics

### Custom Migration Operations
```python
# For complex operations not supported by Alembic
def upgrade():
    connection = op.get_bind()
    connection.execute("""
        CREATE TRIGGER update_user_updated_at 
        BEFORE UPDATE ON users
        FOR EACH ROW
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
        END;
    """)
```

### Conditional Migrations
```python
def upgrade():
    connection = op.get_bind()
    inspector = sa.inspect(connection)
    
    # Only add column if it doesn't exist
    columns = [col['name'] for col in inspector.get_columns('users')]
    if 'new_column' not in columns:
        op.add_column('users', sa.Column('new_column', sa.String))
```

### Multi-Database Support
While PrintFarmHQ uses SQLite by default, migrations work with PostgreSQL/MySQL:
```bash
# Set different database URL
export DATABASE_URL="postgresql://user:pass@localhost/printfarmhq"
make migrate
```

## Quick Reference Card

| Task | Command |
|------|---------|
| Apply migrations | `make migrate` |
| Create migration | `make migrate-create DESC="Description"` |
| List migrations | `make migrate-list` |
| Rollback last | `make migrate-revert` |
| Rollback N migrations | `make migrate-revert COUNT=N` |
| Go to specific version | `make migrate-revert-to VERSION=rev_id` |
| Check current version | `make migrate-dry-run` |
| Manual migration | `docker-compose exec backend python -m alembic revision -m "Description"` |

## Getting Help

1. Check this guide and the [Alembic Migration Guide](./alembic-migration-guide.md)
2. Review existing migrations in `backend/alembic/versions/` for examples
3. Consult [Alembic documentation](https://alembic.sqlalchemy.org/)
4. Ask the team - database changes affect everyone!