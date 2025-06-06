# Database Migrations Quick Reference

## 🚀 Common Commands

```bash
# Start development (auto-runs migrations)
make dev

# Apply all pending migrations
make migrate

# Create new migration from model changes
make migrate-create DESC="Add user preferences"

# Check migration status
make migrate-list

# Rollback last migration
make migrate-revert

# Rollback 3 migrations
make migrate-revert COUNT=3
```

## 📝 Typical Workflow

```bash
# 1. Make model changes
vim backend/app/models.py

# 2. Generate migration
make migrate-create DESC="Add phone to users"

# 3. Review generated file
cat backend/alembic/versions/*_add_phone_to_users.py

# 4. Apply migration
make migrate

# 5. Test it works
# ... test your changes ...

# 6. Commit everything
git add backend/app/models.py backend/alembic/versions/*.py
git commit -m "feat: add phone number to users"
```

## 🎯 Model Change Examples

### Add a Column
```python
# In models.py
class User(Base):
    # ... existing ...
    phone = Column(String, nullable=True)  # NEW!
```

### Add a Table
```python
class Team(Base):
    __tablename__ = "teams"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
```

### Add an Index
```python
class Product(Base):
    # ... existing ...
    __table_args__ = (
        Index('ix_product_sku_owner', 'sku', 'owner_id'),
    )
```

### Add a Relationship
```python
class User(Base):
    # ... existing ...
    notifications = relationship("Notification", back_populates="user")

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="notifications")
```

## ⚠️ Important Notes

1. **Always review** generated migrations before applying
2. **Test rollback** works: `make migrate-revert`
3. **Never edit** migrations that are already applied
4. **Backup production** before major changes: `make dump-db`

## 🔧 Troubleshooting

```bash
# See current database version
make migrate-dry-run

# Check what migrations exist
ls backend/alembic/versions/

# Manually connect to database
docker exec -it printfarmhq-database sqlite3 /data/hq.db

# Check migration history in database
.tables
SELECT * FROM alembic_version;
```

## 🚨 Emergency Commands

```bash
# Rollback to specific version
make migrate-list  # Find the version ID
make migrate-revert-to VERSION=69413fe9f868

# Skip migrations on startup
RUN_MIGRATIONS=false make dev

# Force rebuild everything
docker-compose down -v  # WARNING: Deletes data!
make dev
```

## 📚 More Info

- Full workflow: [Database Migrations Workflow Guide](./database-migrations-workflow.md)
- Technical details: [Alembic Migration Guide](./alembic-migration-guide.md)
- Database architecture: [Database README](../database/README.md)