"""
Unit tests for the database migration system.
"""
import os
import sqlite3
import tempfile
import shutil
from pathlib import Path
from datetime import datetime
import pytest

from app.migrate import MigrationRunner


class TestMigrationRunner:
    """Test the migration runner functionality."""
    
    @pytest.fixture
    def temp_db(self):
        """Create a temporary database for testing."""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as f:
            db_path = f.name
        yield db_path
        # Cleanup
        if os.path.exists(db_path):
            os.unlink(db_path)
    
    @pytest.fixture
    def temp_migrations_dir(self):
        """Create a temporary migrations directory."""
        migrations_dir = tempfile.mkdtemp()
        yield Path(migrations_dir)
        # Cleanup
        shutil.rmtree(migrations_dir)
    
    @pytest.fixture
    def migration_runner(self, temp_db, temp_migrations_dir, monkeypatch):
        """Create a migration runner with temporary paths."""
        runner = MigrationRunner(db_path=temp_db)
        # Override the migrations directory
        monkeypatch.setattr(runner, 'migrations_dir', temp_migrations_dir)
        return runner
    
    def test_ensure_migrations_table_creates_table(self, migration_runner, temp_db):
        """Test that ensure_migrations_table creates the schema_migrations table."""
        migration_runner.ensure_migrations_table()
        
        # Check table exists
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'"
            )
            assert cursor.fetchone() is not None
            
            # Check table schema
            cursor = conn.execute("PRAGMA table_info(schema_migrations)")
            columns = {row[1]: row[2] for row in cursor.fetchall()}
            
            assert 'version' in columns
            assert 'applied_at' in columns
            assert 'filename' in columns
            assert 'up_sql' in columns
            assert 'down_sql' in columns
            assert columns['version'] == 'TEXT'
    
    def test_extract_version_from_filename(self, migration_runner):
        """Test version extraction from migration filenames."""
        # Valid filenames
        assert migration_runner.extract_version_from_filename('20250528_120000_add_users.sql') == '20250528_120000'
        assert migration_runner.extract_version_from_filename('20240101_000000_initial.sql') == '20240101_000000'
        
        # Invalid filenames
        assert migration_runner.extract_version_from_filename('invalid_filename.sql') is None
        assert migration_runner.extract_version_from_filename('20250528_add_users.sql') is None
        assert migration_runner.extract_version_from_filename('20250528120000_add_users.sql') is None
    
    def test_validate_migration_filename(self, migration_runner):
        """Test migration filename validation."""
        # Valid filenames
        assert migration_runner.validate_migration_filename('20250528_120000_add_users.sql') is True
        assert migration_runner.validate_migration_filename('20240101_000000_initial_schema.sql') is True
        assert migration_runner.validate_migration_filename('20250528_120000_add_user_timezone_field.sql') is True
        
        # Invalid filenames
        assert migration_runner.validate_migration_filename('20250528_120000_Add-Users.sql') is False  # Capital letter
        assert migration_runner.validate_migration_filename('20250528_120000_add users.sql') is False  # Space
        assert migration_runner.validate_migration_filename('20250528_120000_add-users.sql') is False  # Hyphen
        assert migration_runner.validate_migration_filename('2025-05-28_120000_add_users.sql') is False  # Wrong date format
    
    def test_parse_migration_content(self, migration_runner):
        """Test parsing of migration content with UP/DOWN sections."""
        # Test with explicit sections
        content = """
-- UP
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

-- DOWN
DROP TABLE users;
"""
        up_sql, down_sql = migration_runner.parse_migration_content(content)
        assert 'CREATE TABLE users' in up_sql
        assert 'DROP TABLE users' in down_sql
        
        # Test with comments and whitespace
        content2 = """
-- Some header comment
-- UP
-- Create users table
CREATE TABLE users (id INTEGER);

-- DOWN
-- Remove users table
DROP TABLE users;
"""
        up_sql2, down_sql2 = migration_runner.parse_migration_content(content2)
        assert 'CREATE TABLE users' in up_sql2
        assert 'DROP TABLE users' in down_sql2
        assert '-- Create users table' in up_sql2
        assert '-- Remove users table' in down_sql2
        
        # Test without explicit UP section (defaults to UP)
        content3 = """
CREATE TABLE posts (id INTEGER);
"""
        up_sql3, down_sql3 = migration_runner.parse_migration_content(content3)
        assert 'CREATE TABLE posts' in up_sql3
        assert down_sql3 == ''
    
    def test_get_pending_migrations_empty(self, migration_runner):
        """Test get_pending_migrations when no migrations exist."""
        migration_runner.ensure_migrations_table()
        pending = migration_runner.get_pending_migrations()
        assert pending == []
    
    def test_get_pending_migrations_with_files(self, migration_runner, temp_migrations_dir):
        """Test get_pending_migrations with migration files."""
        migration_runner.ensure_migrations_table()
        
        # Create some migration files
        migration1 = temp_migrations_dir / '20250528_100000_create_users.sql'
        migration1.write_text('CREATE TABLE users (id INTEGER);')
        
        migration2 = temp_migrations_dir / '20250528_110000_create_posts.sql'
        migration2.write_text('CREATE TABLE posts (id INTEGER);')
        
        # All should be pending
        pending = migration_runner.get_pending_migrations()
        assert len(pending) == 2
        assert pending[0].name == '20250528_100000_create_users.sql'
        assert pending[1].name == '20250528_110000_create_posts.sql'
    
    def test_get_pending_migrations_with_applied(self, migration_runner, temp_migrations_dir, temp_db):
        """Test get_pending_migrations with some already applied."""
        migration_runner.ensure_migrations_table()
        
        # Create migration files
        migration1 = temp_migrations_dir / '20250528_100000_create_users.sql'
        migration1.write_text('CREATE TABLE users (id INTEGER);')
        
        migration2 = temp_migrations_dir / '20250528_110000_create_posts.sql'
        migration2.write_text('CREATE TABLE posts (id INTEGER);')
        
        # Mark first one as applied
        with sqlite3.connect(temp_db) as conn:
            conn.execute(
                "INSERT INTO schema_migrations (version, filename) VALUES (?, ?)",
                ('20250528_100000', '20250528_100000_create_users.sql')
            )
        
        # Only second should be pending
        pending = migration_runner.get_pending_migrations()
        assert len(pending) == 1
        assert pending[0].name == '20250528_110000_create_posts.sql'
    
    def test_execute_migration(self, migration_runner, temp_migrations_dir, temp_db):
        """Test executing a migration."""
        migration_runner.ensure_migrations_table()
        
        # Create a migration file
        migration_file = temp_migrations_dir / '20250528_100000_create_users.sql'
        migration_file.write_text("""
-- UP
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

-- DOWN
DROP TABLE users;
""")
        
        # Execute the migration
        migration_runner.execute_migration(migration_file)
        
        # Check that table was created
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
            )
            assert cursor.fetchone() is not None
            
            # Check migration was recorded
            cursor = conn.execute(
                "SELECT version, filename, up_sql, down_sql FROM schema_migrations WHERE version = ?",
                ('20250528_100000',)
            )
            row = cursor.fetchone()
            assert row is not None
            assert row[1] == '20250528_100000_create_users.sql'
            assert 'CREATE TABLE users' in row[2]
            assert 'DROP TABLE users' in row[3]
    
    def test_revert_migration(self, migration_runner, temp_migrations_dir, temp_db):
        """Test reverting a migration."""
        migration_runner.ensure_migrations_table()
        
        # Create and execute a migration
        migration_file = temp_migrations_dir / '20250528_100000_create_users.sql'
        migration_file.write_text("""
-- UP
CREATE TABLE users (id INTEGER PRIMARY KEY);

-- DOWN
DROP TABLE users;
""")
        
        migration_runner.execute_migration(migration_file)
        
        # Verify table exists
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
            )
            assert cursor.fetchone() is not None
        
        # Revert the migration
        migration_runner.revert_migration('20250528_100000')
        
        # Verify table was dropped
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
            )
            assert cursor.fetchone() is None
            
            # Verify migration was removed from tracking
            cursor = conn.execute(
                "SELECT version FROM schema_migrations WHERE version = ?",
                ('20250528_100000',)
            )
            assert cursor.fetchone() is None
    
    def test_migrate_command_dry_run(self, migration_runner, temp_migrations_dir):
        """Test the migrate command in dry run mode."""
        migration_runner.ensure_migrations_table()
        
        # Create a migration file
        migration_file = temp_migrations_dir / '20250528_100000_test.sql'
        migration_file.write_text('CREATE TABLE test (id INTEGER);')
        
        # Run in dry run mode
        result = migration_runner.run_migrations(dry_run=True)
        assert result == 0
        
        # Verify migration was not actually applied
        applied = migration_runner.get_applied_migrations()
        assert '20250528_100000' not in applied
    
    def test_migrate_command_execution(self, migration_runner, temp_migrations_dir, temp_db):
        """Test the migrate command with actual execution."""
        migration_runner.ensure_migrations_table()
        
        # Create multiple migration files
        migration1 = temp_migrations_dir / '20250528_100000_create_users.sql'
        migration1.write_text('CREATE TABLE users (id INTEGER);')
        
        migration2 = temp_migrations_dir / '20250528_110000_create_posts.sql'
        migration2.write_text('CREATE TABLE posts (id INTEGER);')
        
        # Run migrations
        result = migration_runner.run_migrations(dry_run=False)
        assert result == 0
        
        # Verify both migrations were applied
        applied = migration_runner.get_applied_migrations()
        assert '20250528_100000' in applied
        assert '20250528_110000' in applied
        
        # Verify tables were created
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'posts')"
            )
            tables = [row[0] for row in cursor.fetchall()]
            assert 'users' in tables
            assert 'posts' in tables
    
    def test_revert_migrations_count(self, migration_runner, temp_migrations_dir, temp_db):
        """Test reverting multiple migrations by count."""
        migration_runner.ensure_migrations_table()
        
        # Create and apply multiple migrations
        migrations = [
            ('20250528_100000_create_users.sql', 'CREATE TABLE users (id INTEGER);', 'DROP TABLE users;'),
            ('20250528_110000_create_posts.sql', 'CREATE TABLE posts (id INTEGER);', 'DROP TABLE posts;'),
            ('20250528_120000_create_comments.sql', 'CREATE TABLE comments (id INTEGER);', 'DROP TABLE comments;'),
        ]
        
        for filename, up_sql, down_sql in migrations:
            migration_file = temp_migrations_dir / filename
            migration_file.write_text(f"-- UP\n{up_sql}\n-- DOWN\n{down_sql}")
            migration_runner.execute_migration(migration_file)
        
        # Revert last 2 migrations
        result = migration_runner.revert_migrations(count=2, dry_run=False)
        assert result == 0
        
        # Verify only first migration remains
        applied = migration_runner.get_applied_migrations()
        assert len(applied) == 1
        assert '20250528_100000' in applied
        
        # Verify tables
        with sqlite3.connect(temp_db) as conn:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users', 'posts', 'comments')"
            )
            tables = [row[0] for row in cursor.fetchall()]
            assert 'users' in tables
            assert 'posts' not in tables
            assert 'comments' not in tables
    
    def test_migration_with_transaction_rollback(self, migration_runner, temp_migrations_dir, temp_db):
        """Test that failed migrations are rolled back properly."""
        migration_runner.ensure_migrations_table()
        
        # Create a migration with invalid SQL
        migration_file = temp_migrations_dir / '20250528_100000_invalid.sql'
        migration_file.write_text("""
-- UP
CREATE TABLE users (id INTEGER);
INVALID SQL STATEMENT;
""")
        
        # Try to execute - should fail
        with pytest.raises(Exception):
            migration_runner.execute_migration(migration_file)
        
        # Note: SQLite doesn't support true transactional DDL, so the table may exist
        # but the migration should not be recorded
        with sqlite3.connect(temp_db) as conn:
            # Verify migration was not recorded
            cursor = conn.execute("SELECT version FROM schema_migrations")
            assert cursor.fetchone() is None
    
    def test_create_migration(self, migration_runner, temp_migrations_dir):
        """Test creating a new migration file."""
        result = migration_runner.create_migration("add_user_email")
        assert result.parent == temp_migrations_dir
        
        # Find the created file
        migration_files = list(temp_migrations_dir.glob("*.sql"))
        assert len(migration_files) == 1
        
        # Check filename format
        filename = migration_files[0].name
        assert migration_runner.validate_migration_filename(filename)
        assert 'add_user_email' in filename
        
        # Check content
        content = migration_files[0].read_text()
        assert '-- UP' in content
        assert '-- DOWN' in content
        assert 'add_user_email' in content