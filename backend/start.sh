#!/bin/bash
set -e

echo "🚀 Starting PrintFarmHQ Backend..."

# Check if migrations should be run
if [[ "${RUN_MIGRATIONS:-true}" == "true" ]]; then
    echo "🔄 Running database migrations..."
    
    # Check if migrate script exists
    if [[ -f "app/migrate.py" ]]; then
        # Run migrations
        python app/migrate.py migrate
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

echo "🌟 Starting application server..."

# Start the application
exec python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload