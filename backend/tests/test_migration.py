"""
Tests for basic database migration functionality.
"""

import pytest
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models import Product, FilamentUsage, Filament, Base
from app.database import SQLALCHEMY_DATABASE_URL


class TestDatabaseMigration:
    """Test basic database migration functionality."""
    
    @pytest.fixture
    def migration_db(self):
        """Create a separate test database for migration testing."""
        # Use an in-memory SQLite database for testing
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)
        
        SessionLocal = sessionmaker(bind=engine)
        session = SessionLocal()
        
        yield session, engine
        
        session.close()
    
    def test_create_tables(self, migration_db):
        """Test that all database tables can be created successfully."""
        session, engine = migration_db
        
        # Verify that essential tables exist
        with engine.connect() as conn:
            # Check if products table exists
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='products'"))
            assert result.fetchone() is not None
            
            # Check if filaments table exists
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='filaments'"))
            assert result.fetchone() is not None
            
            # Check if filament_usages table exists
            result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='filament_usages'"))
            assert result.fetchone() is not None
    
    def test_basic_data_operations(self, migration_db):
        """Test basic data operations work correctly."""
        session, engine = migration_db
        
        # Create test filament
        filament = Filament(
            color="Red",
            brand="TestBrand",
            material="PLA",
            price_per_kg=25.0,
            total_qty_kg=1.0
        )
        session.add(filament)
        session.flush()
        
        # Create test product
        product = Product(
            name="Test Product",
            sku="TEST-001",
            print_time_hrs=2.0
        )
        session.add(product)
        session.flush()
        
        # Create filament usage
        usage = FilamentUsage(
            product_id=product.id,
            filament_id=filament.id,
            grams_used=50.0
        )
        session.add(usage)
        session.commit()
        
        # Verify data was created correctly
        session.refresh(product)
        session.refresh(filament)
        
        assert len(product.filament_usages) == 1
        assert product.filament_usages[0].grams_used == 50.0
        assert product.filament_usages[0].filament.color == "Red"
    
    def test_product_cop_calculation(self, migration_db):
        """Test that product COP calculation works correctly."""
        session, engine = migration_db
        
        # Create test filaments
        filament1 = Filament(
            color="Red", 
            brand="ESUN", 
            material="PLA", 
            price_per_kg=25.0,
            total_qty_kg=1.0
        )
        filament2 = Filament(
            color="Blue", 
            brand="ESUN", 
            material="PLA", 
            price_per_kg=30.0,
            total_qty_kg=1.0
        )
        session.add_all([filament1, filament2])
        session.flush()
        
        # Create product
        product = Product(
            name="Test Product",
            sku="TEST-001",
            print_time_hrs=2.0,
            additional_parts_cost=0.5
        )
        session.add(product)
        session.flush()
        
        # Create filament usages
        usage1 = FilamentUsage(
            product_id=product.id,
            filament_id=filament1.id,
            grams_used=50.0  # €1.25
        )
        usage2 = FilamentUsage(
            product_id=product.id,
            filament_id=filament2.id,
            grams_used=30.0  # €0.90
        )
        session.add_all([usage1, usage2])
        session.commit()
        
        # Test COP calculation
        session.refresh(product)
        expected_cop = 1.25 + 0.90 + 0.5  # filament costs + additional parts cost
        assert product.cop == expected_cop
        
    def test_foreign_key_constraints(self, migration_db):
        """Test that foreign key constraints work correctly."""
        session, engine = migration_db
        
        # Create test filament
        filament = Filament(
            color="Red",
            brand="TestBrand",
            material="PLA",
            price_per_kg=25.0,
            total_qty_kg=1.0
        )
        session.add(filament)
        session.flush()
        
        # Create test product
        product = Product(
            name="Test Product",
            sku="TEST-001",
            print_time_hrs=2.0
        )
        session.add(product)
        session.flush()
        
        # Create filament usage
        usage = FilamentUsage(
            product_id=product.id,
            filament_id=filament.id,
            grams_used=50.0
        )
        session.add(usage)
        session.commit()
        
        # Delete product should cascade to filament usage
        session.delete(product)
        session.commit()
        
        # Verify usage was deleted
        remaining_usages = session.query(FilamentUsage).filter(
            FilamentUsage.product_id == product.id
        ).count()
        assert remaining_usages == 0
        
        # But filament should still exist
        remaining_filament = session.query(Filament).filter(
            Filament.id == filament.id
        ).first()
        assert remaining_filament is not None