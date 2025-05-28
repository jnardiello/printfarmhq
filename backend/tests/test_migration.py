"""
Tests for the plate migration script.
"""

import pytest
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.models import Product, FilamentUsage, Filament, Plate, PlateFilamentUsage, Base
from app.database import get_database_url


class TestPlateMigration:
    """Test the migration from legacy filament_usages to plate structure."""
    
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
    
    def create_legacy_product(self, session: Session, engine) -> Product:
        """Create a product with legacy filament_usages structure."""
        # Create test filaments
        filament1 = Filament(
            id=1,
            color="Red", 
            brand="ESUN", 
            material="PLA", 
            price_per_kg=25.0,
            total_qty_kg=1.0
        )
        filament2 = Filament(
            id=2,
            color="Blue", 
            brand="ESUN", 
            material="PLA", 
            price_per_kg=30.0,
            total_qty_kg=1.0
        )
        session.add_all([filament1, filament2])
        session.flush()
        
        # Create product with legacy structure
        product = Product(
            id=1,
            name="Test Product",
            sku="TEST-001",
            print_time_hrs=2.0,
            file_path="test_model.stl"
        )
        session.add(product)
        session.flush()
        
        # Create legacy filament usages
        usage1 = FilamentUsage(
            product_id=product.id,
            filament_id=filament1.id,
            grams_used=50.0
        )
        usage2 = FilamentUsage(
            product_id=product.id,
            filament_id=filament2.id,
            grams_used=30.0
        )
        session.add_all([usage1, usage2])
        session.commit()
        
        return product
    
    def simulate_migration(self, session: Session, engine, product: Product):
        """Simulate the migration process."""
        # Create plates table (already exists in our test setup)
        # Create plate_filament_usages table (already exists in our test setup)
        
        # Migrate the product to plate structure
        default_plate = Plate(
            product_id=product.id,
            name="Main",
            quantity=1,
            file_path=product.file_path
        )
        session.add(default_plate)
        session.flush()
        
        # Migrate filament usages to plate filament usages
        for filament_usage in product.filament_usages:
            plate_filament_usage = PlateFilamentUsage(
                plate_id=default_plate.id,
                filament_id=filament_usage.filament_id,
                grams_used=filament_usage.grams_used
            )
            session.add(plate_filament_usage)
        
        session.commit()
        return default_plate
    
    def test_migration_preserves_costs(self, migration_db):
        """Test that migration preserves product costs."""
        session, engine = migration_db
        
        # Create legacy product
        product = self.create_legacy_product(session, engine)
        
        # Calculate legacy cost
        session.refresh(product)
        legacy_cost = sum(
            (fu.grams_used / 1000.0) * fu.filament.price_per_kg
            for fu in product.filament_usages
        )
        
        # Perform migration
        default_plate = self.simulate_migration(session, engine, product)
        
        # Calculate new cost
        session.refresh(product)
        session.refresh(default_plate)
        
        new_cost = sum(plate.cost for plate in product.plates)
        
        # Verify costs match
        assert abs(legacy_cost - new_cost) < 0.01  # Allow for small rounding differences
        assert legacy_cost == 2.15  # (50/1000 * 25) + (30/1000 * 30) = 1.25 + 0.9 = 2.15
        assert new_cost == 2.15
    
    def test_migration_preserves_filament_data(self, migration_db):
        """Test that migration preserves all filament usage data."""
        session, engine = migration_db
        
        # Create legacy product
        product = self.create_legacy_product(session, engine)
        
        # Get legacy filament usage data
        session.refresh(product)
        legacy_usages = [
            (fu.filament_id, fu.grams_used)
            for fu in product.filament_usages
        ]
        
        # Perform migration
        default_plate = self.simulate_migration(session, engine, product)
        
        # Get new filament usage data
        session.refresh(default_plate)
        new_usages = [
            (fu.filament_id, fu.grams_used)
            for fu in default_plate.filament_usages
        ]
        
        # Verify all filament usage data is preserved
        assert sorted(legacy_usages) == sorted(new_usages)
        assert len(new_usages) == 2
        assert (1, 50.0) in new_usages
        assert (2, 30.0) in new_usages
    
    def test_migration_creates_default_plate(self, migration_db):
        """Test that migration creates a default plate with correct properties."""
        session, engine = migration_db
        
        # Create legacy product
        product = self.create_legacy_product(session, engine)
        
        # Perform migration
        default_plate = self.simulate_migration(session, engine, product)
        
        # Verify default plate properties
        session.refresh(product)
        assert len(product.plates) == 1
        
        plate = product.plates[0]
        assert plate.name == "Main"
        assert plate.quantity == 1
        assert plate.file_path == "test_model.stl"  # File moved from product to plate
        assert len(plate.filament_usages) == 2
    
    def test_migration_handles_multiple_products(self, migration_db):
        """Test that migration handles multiple products correctly."""
        session, engine = migration_db
        
        # Create multiple legacy products
        products = []
        for i in range(3):
            # Create filament
            filament = Filament(
                id=i+10,
                color=f"Color{i}",
                brand="TestBrand",
                material="PLA",
                price_per_kg=20.0 + i * 5,
                total_qty_kg=1.0
            )
            session.add(filament)
            session.flush()
            
            # Create product
            product = Product(
                id=i+10,
                name=f"Product {i}",
                sku=f"TEST-{i:03d}",
                print_time_hrs=1.0 + i
            )
            session.add(product)
            session.flush()
            
            # Create filament usage
            usage = FilamentUsage(
                product_id=product.id,
                filament_id=filament.id,
                grams_used=25.0 * (i + 1)
            )
            session.add(usage)
            products.append(product)
        
        session.commit()
        
        # Migrate all products
        for product in products:
            self.simulate_migration(session, engine, product)
        
        # Verify all products have plates
        session.refresh(products[0])
        session.refresh(products[1]) 
        session.refresh(products[2])
        
        for i, product in enumerate(products):
            assert len(product.plates) == 1
            plate = product.plates[0]
            assert plate.name == "Main"
            assert len(plate.filament_usages) == 1
            assert plate.filament_usages[0].grams_used == 25.0 * (i + 1)
    
    def test_migration_validates_data_integrity(self, migration_db):
        """Test that migration validates data integrity."""
        session, engine = migration_db
        
        # Create legacy product
        product = self.create_legacy_product(session, engine)
        
        # Count original data
        original_filament_usage_count = len(product.filament_usages)
        original_total_grams = sum(fu.grams_used for fu in product.filament_usages)
        
        # Perform migration
        default_plate = self.simulate_migration(session, engine, product)
        
        # Validate data integrity
        session.refresh(product)
        session.refresh(default_plate)
        
        # Check that all filament usages were migrated
        migrated_usage_count = len(default_plate.filament_usages)
        migrated_total_grams = sum(fu.grams_used for fu in default_plate.filament_usages)
        
        assert original_filament_usage_count == migrated_usage_count
        assert original_total_grams == migrated_total_grams
        
        # Check that product still has legacy data (for backward compatibility)
        assert len(product.filament_usages) == original_filament_usage_count
    
    def test_backward_compatibility(self, migration_db):
        """Test that migrated products maintain backward compatibility."""
        session, engine = migration_db
        
        # Create legacy product
        product = self.create_legacy_product(session, engine)
        original_cop = product.cop  # This should use legacy calculation
        
        # Perform migration
        self.simulate_migration(session, engine, product)
        
        # Verify COP calculation works with both methods
        session.refresh(product)
        new_cop = product.cop  # This should use plate-based calculation
        
        # Both should give the same result
        assert abs(original_cop - new_cop) < 0.01