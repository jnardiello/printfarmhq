"""
End-to-end tests for the database migration system.
Tests the full migration workflow including startup integration.
"""
import os
import sqlite3
import tempfile
import shutil
import subprocess
from pathlib import Path
import pytest

from app.migrate import MigrationRunner
from app.database import Base, engine


class TestMigrationSystemE2E:
    """Test the migration system end-to-end."""
    
    @pytest.fixture
    def temp_backend_dir(self):
        """Create a temporary backend directory structure."""
        temp_dir = tempfile.mkdtemp()
        
        # Create necessary directories
        (Path(temp_dir) / 'app').mkdir()
        (Path(temp_dir) / 'migrations').mkdir()
        
        # Copy migrate.py
        migrate_src = Path(__file__).parent.parent.parent / 'app' / 'migrate.py'
        migrate_dst = Path(temp_dir) / 'app' / 'migrate.py'
        shutil.copy(migrate_src, migrate_dst)
        
        # Copy database.py for imports
        db_src = Path(__file__).parent.parent.parent / 'app' / 'database.py'
        db_dst = Path(temp_dir) / 'app' / 'database.py'
        shutil.copy(db_src, db_dst)
        
        # Create __init__.py files
        (Path(temp_dir) / 'app' / '__init__.py').touch()
        
        yield Path(temp_dir)
        
        # Cleanup
        shutil.rmtree(temp_dir)
    
    def test_startup_script_integration(self, temp_backend_dir, monkeypatch):
        """Test that migrations run correctly via the startup script."""
        # Change to temp directory
        monkeypatch.chdir(temp_backend_dir)
        
        # Create a test database
        db_path = temp_backend_dir / 'test.db'
        
        # Create migrations
        migration1 = temp_backend_dir / 'migrations' / '20250528_100000_initial_schema.sql'
        migration1.write_text("""
-- UP
CREATE TABLE test_table (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

-- DOWN
DROP TABLE test_table;
""")
        
        migration2 = temp_backend_dir / 'migrations' / '20250528_110000_add_column.sql'
        migration2.write_text("""
-- UP
ALTER TABLE test_table ADD COLUMN email TEXT;

-- DOWN
-- SQLite doesn't support DROP COLUMN easily, so we'd recreate the table
-- This is a simplified version for testing
""")
        
        # Create a minimal startup script
        startup_script = temp_backend_dir / 'start_test.sh'
        startup_script.write_text(f"""#!/bin/bash
set -e

export SQLALCHEMY_DATABASE_URL="sqlite:///{db_path}"

echo "🚀 Starting test..."

# Check if migrations should be run
if [[ "${{RUN_MIGRATIONS:-true}}" == "true" ]]; then
    echo "🔄 Running database migrations..."
    
    if [[ -f "app/migrate.py" ]]; then
        python3 app/migrate.py migrate
        if [[ $? -eq 0 ]]; then
            echo "✅ Database migrations completed successfully"
        else
            echo "❌ Database migration failed"
            exit 1
        fi
    fi
else
    echo "⏭️  Skipping migrations (RUN_MIGRATIONS=false)"
fi

echo "✅ Startup complete"
""")
        startup_script.chmod(0o755)
        
        # Run the startup script
        result = subprocess.run(
            ['bash', str(startup_script)],
            capture_output=True,
            text=True,
            env={**os.environ, 'PYTHONPATH': str(temp_backend_dir)},
            cwd=str(temp_backend_dir)  # Set working directory
        )
        
        assert result.returncode == 0
        assert "Running database migrations" in result.stdout
        assert "Database migrations completed successfully" in result.stdout
        
        # Find the actual database file (migrations create hq.db by default)
        db_files = list(temp_backend_dir.rglob('*.db'))
        assert db_files, "No database file found after running migrations"
        actual_db_path = db_files[0]
        
        # Verify migrations were applied
        # Need to ensure database is written to disk
        import time
        time.sleep(0.1)  # Give time for database writes
        
        with sqlite3.connect(str(actual_db_path)) as conn:
            # Check schema_migrations table
            cursor = conn.execute(
                "SELECT version FROM schema_migrations ORDER BY version"
            )
            versions = [row[0] for row in cursor.fetchall()]
            assert '20250528_100000' in versions
            assert '20250528_110000' in versions
            
            # Check test_table was created with both columns
            cursor = conn.execute("PRAGMA table_info(test_table)")
            columns = {row[1] for row in cursor.fetchall()}
            assert 'id' in columns
            assert 'name' in columns
            assert 'email' in columns
    
    def test_startup_with_no_pending_migrations(self, temp_backend_dir, monkeypatch):
        """Test startup when all migrations are already applied."""
        monkeypatch.chdir(temp_backend_dir)
        
        db_path = temp_backend_dir / 'test.db'
        
        # Create a migration first
        migration = temp_backend_dir / 'migrations' / '20250528_100000_initial.sql'
        migration.write_text("-- UP\nCREATE TABLE test (id INTEGER);\n-- DOWN\nDROP TABLE test;")
        
        # First run to apply the migration
        startup_script = temp_backend_dir / 'start_test.sh'
        startup_script.write_text(f"""#!/bin/bash
set -e

export SQLALCHEMY_DATABASE_URL="sqlite:///{db_path}"

if [[ -f "app/migrate.py" ]]; then
    python3 app/migrate.py migrate
fi
""")
        startup_script.chmod(0o755)
        
        # Run once to apply migrations
        subprocess.run(
            ['bash', str(startup_script)],
            capture_output=True,
            text=True,
            env={**os.environ, 'PYTHONPATH': str(temp_backend_dir)}
        )
        
        # Run startup again - should find no pending migrations
        result = subprocess.run(
            ['bash', str(startup_script)],
            capture_output=True,
            text=True,
            env={**os.environ, 'PYTHONPATH': str(temp_backend_dir)}
        )
        
        assert result.returncode == 0
        assert "No pending migrations found" in result.stdout
    
    def test_startup_with_migration_failure(self, temp_backend_dir, monkeypatch):
        """Test that startup fails properly when migrations fail."""
        monkeypatch.chdir(temp_backend_dir)
        
        db_path = temp_backend_dir / 'test.db'
        
        # Create a migration with invalid SQL
        migration = temp_backend_dir / 'migrations' / '20250528_100000_invalid.sql'
        migration.write_text("""
-- UP
CREATE TABLE test (id INTEGER);
INVALID SQL HERE;
""")
        
        # Create startup script
        startup_script = temp_backend_dir / 'start_test.sh'
        startup_script.write_text(f"""#!/bin/bash
set -e

export SQLALCHEMY_DATABASE_URL="sqlite:///{db_path}"

python3 app/migrate.py migrate
if [[ $? -eq 0 ]]; then
    echo "✅ Migrations succeeded"
else
    echo "❌ Migration failed"
    exit 1
fi
""")
        startup_script.chmod(0o755)
        
        # Run startup - should fail
        result = subprocess.run(
            ['bash', str(startup_script)],
            capture_output=True,
            text=True,
            env={**os.environ, 'PYTHONPATH': str(temp_backend_dir)}
        )
        
        assert result.returncode == 1
        assert "Migration failed" in result.stdout or "Migration failed" in result.stderr
    
    def test_skip_migrations_env_var(self, temp_backend_dir, monkeypatch):
        """Test that RUN_MIGRATIONS=false skips migrations."""
        monkeypatch.chdir(temp_backend_dir)
        
        # Create a migration
        migration = temp_backend_dir / 'migrations' / '20250528_100000_test.sql'
        migration.write_text("CREATE TABLE test (id INTEGER);")
        
        # Create startup script that respects RUN_MIGRATIONS
        startup_script = temp_backend_dir / 'start_test.sh'
        startup_script.write_text("""#!/bin/bash
if [[ "${RUN_MIGRATIONS:-true}" == "true" ]]; then
    echo "Would run migrations"
else
    echo "⏭️  Skipping migrations (RUN_MIGRATIONS=false)"
fi
""")
        startup_script.chmod(0o755)
        
        # Run with RUN_MIGRATIONS=false
        result = subprocess.run(
            ['bash', str(startup_script)],
            capture_output=True,
            text=True,
            env={**os.environ, 'RUN_MIGRATIONS': 'false'}
        )
        
        assert result.returncode == 0
        assert "Skipping migrations" in result.stdout
    
    def test_migration_idempotency(self, temp_backend_dir, monkeypatch):
        """Test that running migrations multiple times is safe."""
        monkeypatch.chdir(temp_backend_dir)
        
        db_path = temp_backend_dir / 'test.db'
        
        # Create a migration
        migration = temp_backend_dir / 'migrations' / '20250528_100000_create_table.sql'
        migration.write_text("""
-- UP
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

-- DOWN
DROP TABLE users;
""")
        
        runner = MigrationRunner(db_path=str(db_path))
        runner.migrations_dir = temp_backend_dir / 'migrations'
        
        # Run migrations twice
        result1 = runner.run_migrations()
        assert result1 == 0
        
        result2 = runner.run_migrations()
        assert result2 == 0  # Should succeed with no pending migrations
        
        # Verify table exists and migration is recorded only once
        with sqlite3.connect(db_path) as conn:
            cursor = conn.execute(
                "SELECT COUNT(*) FROM schema_migrations WHERE version = '20250528_100000'"
            )
            count = cursor.fetchone()[0]
            assert count == 1  # Should only be recorded once