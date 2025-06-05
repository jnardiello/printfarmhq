# Database Container Migration Guide

This guide helps you migrate from the previous setup (database inside backend container) to the new architecture (separate database container).

## Why Separate the Database?

1. **Data Persistence**: Database survives container restarts and updates
2. **Backup Simplicity**: Easy to backup just the database volume
3. **Security**: Database not exposed to the internet, only accessible within Docker network
4. **Scalability**: Can scale database independently of application
5. **Best Practices**: Follows container principle of "one process per container"

## Migration Steps

### 1. Backup Existing Database

If you have existing data in the old setup:

```bash
# Create backup from old setup
docker exec printfarmhq-backend sqlite3 ./hq.db ".backup /tmp/backup.db"
docker cp printfarmhq-backend:/tmp/backup.db ./hq-backup.db
```

### 2. Stop Current Containers

```bash
docker-compose down
```

### 3. Pull Latest Changes

```bash
git pull origin main
```

### 4. Start New Architecture

```bash
# For production
docker-compose up -d

# For development
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

### 5. Restore Data (if needed)

```bash
# Copy backup to database container
docker cp ./hq-backup.db printfarmhq-database:/data/restore.db

# Stop backend to prevent conflicts
docker-compose stop backend

# Restore database
docker exec printfarmhq-database cp /data/restore.db /data/hq.db

# Restart backend
docker-compose start backend
```

### 6. Verify Migration

```bash
# Check database connection
docker exec printfarmhq-backend python3 -c "from app.database import engine; print('Database connected:', engine.url)"

# Check data integrity
docker exec printfarmhq-database sqlite3 /data/hq.db "SELECT COUNT(*) FROM users;"
```

## Rollback (if needed)

If you need to rollback to the old setup:

1. Checkout previous version: `git checkout <previous-commit>`
2. Restore old docker-compose: `docker-compose down && docker-compose up -d`
3. Restore database backup to backend container

## Troubleshooting

### "Database file not found"
- Ensure database container is healthy: `docker-compose ps`
- Check volume is mounted: `docker exec printfarmhq-backend ls -la /data`

### "Permission denied"
- Database runs as user `dbuser` (UID 1000)
- Ensure volume permissions are correct

### "Cannot connect to database"
- Check DATABASE_URL is set: `docker exec printfarmhq-backend env | grep DATABASE_URL`
- Verify database container is running: `docker ps | grep database`

## Architecture Changes

### Old Architecture
```
┌─────────────────────┐
│  Backend Container  │
│  - FastAPI App      │
│  - SQLite DB        │
│  - hq.db (local)    │
└─────────────────────┘
```

### New Architecture
```
┌─────────────────────┐     ┌─────────────────────┐
│  Backend Container  │────▶│ Database Container  │
│  - FastAPI App      │     │  - SQLite Server    │
│  - Migrations       │     │  - Management Tools │
└─────────────────────┘     │  - /data/hq.db      │
                            └─────────────────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │   Docker Volume     │
                            │ printfarmhq-db-data │
                            └─────────────────────┘
```