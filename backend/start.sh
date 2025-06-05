#!/bin/bash
set -e

# Display database connection info
echo "📊 Database configuration:"
echo "   DATABASE_URL: ${DATABASE_URL:-sqlite:///./hq.db}"

# Check for local database file (shouldn't exist in container)
if [[ -f "./hq.db" ]]; then
    echo "⚠️  WARNING: Local database file found at ./hq.db"
    echo "   This should not exist in the container. Database should be in /data/hq.db"
    echo "   Please check your volume mounts and DATABASE_URL configuration."
fi

# Wait for database to be ready (if using shared volume)
if [[ "${DATABASE_URL}" == "sqlite:///data/hq.db" ]] || [[ "${DATABASE_URL}" == "sqlite:////data/hq.db" ]]; then
    echo "⏳ Waiting for database container to initialize..."
    # Give the database container time to initialize
    sleep 2
    
    # Check if database file exists
    DB_PATH="/data/hq.db"
    if [[ -f "$DB_PATH" ]]; then
        echo "✅ Database file found at $DB_PATH"
    else
        echo "⚠️  Database file not found at $DB_PATH, will be created by migrations"
    fi
fi

# Check if migrations should be run
if [[ "${RUN_MIGRATIONS:-true}" == "true" ]]; then
    echo "🔄 Running database migrations..."
    
    # Check if migrate script exists
    if [[ -f "app/migrate.py" ]]; then
        # Run migrations
        python3 app/migrate.py migrate
        if [[ $? -eq 0 ]]; then
            echo "✅ Database migrations completed successfully"
        else
            echo "❌ Database migration failed"
            exit 1
        fi
    else
        echo "⚠️  Migration script not found, skipping migrations"
    fi
else
    echo "⏭️  Skipping migrations (RUN_MIGRATIONS=false)"
fi

# Set up test data if in testing mode
if [[ "${TESTING:-false}" == "true" ]]; then
    echo "🧪 Setting up test data..."
    if [[ -f "tests/fixtures/setup_test_data.py" ]]; then
        python3 tests/fixtures/setup_test_data.py
    fi
fi

echo "🌟 Starting application server..."

# Start the application
exec python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload