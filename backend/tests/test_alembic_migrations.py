"""
Test Alembic migration system integration
"""
import pytest
import subprocess
import os
from sqlalchemy import create_engine, inspect, text
from app.database import Base
from app.models import User, Product, Filament  # Import some models to verify


class TestAlembicMigrations:
    """Test the Alembic migration system"""
    
    @pytest.fixture(autouse=True)
    def setup_method(self, tmp_path):
        """Set up test environment"""
        # Store original directory and DB URL
        self.original_dir = os.getcwd()
        self.original_db_url = os.environ.get("DATABASE_URL")
        
        # Create a temporary database for testing
        self.test_db = tmp_path / "test_migrations.db"
        self.test_db_url = f"sqlite:///{self.test_db}"
        os.environ["DATABASE_URL"] = self.test_db_url
        
        # Create a fresh engine for this test
        self.engine = create_engine(self.test_db_url)
        
        yield
        
        # Cleanup
        if self.original_db_url:
            os.environ["DATABASE_URL"] = self.original_db_url
        else:
            os.environ.pop("DATABASE_URL", None)
        os.chdir(self.original_dir)
        self.engine.dispose()
    
    def test_alembic_config_exists(self):
        """Test that Alembic configuration exists"""
        assert os.path.exists("alembic.ini"), "alembic.ini configuration file not found"
        assert os.path.exists("alembic/env.py"), "alembic/env.py not found"
        assert os.path.isdir("alembic/versions"), "alembic/versions directory not found"
    
    def test_alembic_current_command(self):
        """Test that alembic current command works"""
        result = subprocess.run(
            ["python3", "-m", "alembic", "current"],
            capture_output=True,
            text=True
        )
        assert result.returncode == 0, f"Alembic current failed: {result.stderr}"
        # Should show no current version on fresh database
        assert "head" not in result.stdout or "69413fe9f868" in result.stdout
    
    def test_alembic_history_command(self):
        """Test that alembic history command works"""
        result = subprocess.run(
            ["python3", "-m", "alembic", "history"],
            capture_output=True,
            text=True
        )
        assert result.returncode == 0, f"Alembic history failed: {result.stderr}"
        assert "Initial schema" in result.stdout
        assert "69413fe9f868" in result.stdout
    
    def test_alembic_upgrade_head(self):
        """Test that migrations can be applied"""
        # Run migrations
        result = subprocess.run(
            ["python3", "-m", "alembic", "upgrade", "head"],
            capture_output=True,
            text=True
        )
        assert result.returncode == 0, f"Alembic upgrade failed: {result.stderr}"
        
        # Verify tables were created
        inspector = inspect(self.engine)
        tables = inspector.get_table_names()
        
        # Check for core tables
        assert "users" in tables
        assert "products" in tables
        assert "filaments" in tables
        assert "print_jobs" in tables
        assert "alembic_version" in tables
        
        # Verify alembic version is set
        with self.engine.connect() as conn:
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            version = result.scalar()
            assert version == "69413fe9f868"
    
    def test_alembic_downgrade(self):
        """Test that migrations can be rolled back"""
        # First upgrade
        subprocess.run(
            ["python3", "-m", "alembic", "upgrade", "head"],
            capture_output=True,
            text=True
        )
        
        # Then downgrade
        result = subprocess.run(
            ["python3", "-m", "alembic", "downgrade", "base"],
            capture_output=True,
            text=True
        )
        assert result.returncode == 0, f"Alembic downgrade failed: {result.stderr}"
        
        # Verify tables were dropped
        inspector = inspect(self.engine)
        tables = inspector.get_table_names()
        
        # Should only have alembic_version table
        assert len(tables) <= 1
        if tables:
            assert tables[0] == "alembic_version"
    
    def test_models_match_migration(self):
        """Test that current models match the migration schema"""
        # Apply migrations
        subprocess.run(
            ["python3", "-m", "alembic", "upgrade", "head"],
            capture_output=True,
            text=True
        )
        
        # Get all model tables
        model_tables = {
            table.name for table in Base.metadata.tables.values()
        }
        
        # Get all database tables (excluding alembic_version)
        inspector = inspect(self.engine)
        db_tables = set(inspector.get_table_names()) - {"alembic_version"}
        
        # They should match
        assert model_tables == db_tables, f"Model tables {model_tables} don't match DB tables {db_tables}"
    
    def test_migration_creates_all_indexes(self):
        """Test that migrations create all expected indexes"""
        # Apply migrations
        subprocess.run(
            ["python3", "-m", "alembic", "upgrade", "head"],
            capture_output=True,
            text=True
        )
        
        inspector = inspect(self.engine)
        
        # Check some critical indexes exist
        user_indexes = [idx['name'] for idx in inspector.get_indexes('users')]
        assert 'ix_users_email' in user_indexes
        assert 'ix_users_id' in user_indexes
        
        product_indexes = [idx['name'] for idx in inspector.get_indexes('products')]
        assert 'ix_products_sku' in product_indexes
        assert 'ix_products_id' in product_indexes
    
    def test_migration_idempotent(self):
        """Test that running migrations multiple times is safe"""
        # Run upgrade multiple times
        for _ in range(3):
            result = subprocess.run(
                ["python3", "-m", "alembic", "upgrade", "head"],
                capture_output=True,
                text=True
            )
            assert result.returncode == 0
        
        # Should still be at the same version
        with self.engine.connect() as conn:
            result = conn.execute(text("SELECT COUNT(*) FROM alembic_version"))
            count = result.scalar()
            assert count == 1  # Only one version entry