# PrintFarmHQ Database Container

This directory contains the SQLite database container configuration for PrintFarmHQ.

## Architecture

The database runs in a separate container from the application, providing:
- **Data persistence** through Docker volumes
- **Separation of concerns** between application and data
- **Easy backup and restore** capabilities
- **Database management tools** included in the container

## Container Details

- **Base image**: Alpine Linux (lightweight)
- **Database**: SQLite 3
- **Tools included**: sqlite3 CLI, bash
- **Data location**: `/data/hq.db` inside container

## Usage

### Access Database CLI

```bash
# Connect to the database container
docker exec -it printfarmhq-database sqlite3 /data/hq.db

# Example queries
.tables                    # List all tables
.schema users             # Show schema for users table
SELECT COUNT(*) FROM users;  # Count users
.quit                     # Exit
```

### Backup Database

```bash
# Create backup
docker exec printfarmhq-database sqlite3 /data/hq.db ".backup /data/backup.db"
docker cp printfarmhq-database:/data/backup.db ./backup-$(date +%Y%m%d).db

# Restore from backup
docker cp ./backup.db printfarmhq-database:/data/restore.db
docker exec printfarmhq-database cp /data/restore.db /data/hq.db
```

### View Database Info

```bash
# Database file size
docker exec printfarmhq-database ls -lh /data/hq.db

# Database integrity check
docker exec printfarmhq-database sqlite3 /data/hq.db "PRAGMA integrity_check;"

# Table statistics
docker exec printfarmhq-database sqlite3 /data/hq.db ".dbinfo"
```

## Volume Management

The database uses a named volume `printfarmhq-db-data` for production and `printfarmhq-db-data-dev` for development.

```bash
# List volumes
docker volume ls | grep printfarmhq

# Inspect volume
docker volume inspect printfarmhq-db-data

# Remove volume (WARNING: This deletes all data!)
docker volume rm printfarmhq-db-data
```

## Migration to Other Databases

While SQLite is excellent for single-instance deployments, you can easily migrate to PostgreSQL or MySQL by:

1. Updating `DATABASE_URL` environment variable
2. Installing appropriate Python database driver
3. Running migrations on the new database

The application code is database-agnostic thanks to SQLAlchemy ORM.