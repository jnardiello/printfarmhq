#!/bin/bash
set -e

DB_PATH="/data/hq.db"

# Initialize database if it doesn't exist
if [ ! -f "$DB_PATH" ]; then
    echo "🗄️  Initializing new SQLite database at $DB_PATH"
    
    # Create empty database
    sqlite3 "$DB_PATH" "VACUUM;"
    
    # Set proper permissions
    chmod 644 "$DB_PATH"
    
    echo "✅ Database initialized successfully"
else
    echo "📁 Using existing database at $DB_PATH"
fi

# Verify database is accessible
if sqlite3 "$DB_PATH" "SELECT 1;" > /dev/null 2>&1; then
    echo "✅ Database is healthy and accessible"
else
    echo "❌ Database health check failed"
    exit 1
fi

echo "🚀 SQLite database container ready"
echo "📊 Database location: $DB_PATH"
echo "💡 To access SQLite CLI: docker exec -it printfarmhq-database sqlite3 /data/hq.db"

# Keep container running
tail -f /dev/null