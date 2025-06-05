"""
Tests for product COP (Cost of Product) calculation functionality.
"""

import pytest
from sqlalchemy.orm import Session
from app.models import Product, FilamentUsage, Filament


class TestProductCOPCalculation:
    """Test product COP calculation functionality."""
    
    def test_product_cop_with_single_filament(self, db: Session):
        """Test product COP calculation with single filament usage."""
        # Create test filament
        filament = Filament(color="Red", brand="ESUN", material="PLA", price_per_kg=25.0)
        db.add(filament)
        db.flush()
        
        # Create test product
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0, additional_parts_cost=1.5)
        db.add(product)
        db.flush()
        
        # Create filament usage
        usage = FilamentUsage(product_id=product.id, filament_id=filament.id, grams_used=50.0)  # €1.25
        db.add(usage)
        db.commit()
        
        # Refresh to get relationships
        db.refresh(product)
        
        # Test COP calculation: €1.25 (filament) + €1.5 (additional parts) = €2.75
        assert product.cop == 2.75

    def test_product_cop_with_multiple_filaments(self, db: Session):
        """Test product COP calculation with multiple filament usages."""
        # Create test filaments
        filament1 = Filament(color="Red", brand="ESUN", material="PLA", price_per_kg=25.0)
        filament2 = Filament(color="Blue", brand="ESUN", material="PLA", price_per_kg=30.0)
        db.add_all([filament1, filament2])
        db.flush()
        
        # Create test product
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0, additional_parts_cost=2.0)
        db.add(product)
        db.flush()
        
        # Create filament usages
        usage1 = FilamentUsage(product_id=product.id, filament_id=filament1.id, grams_used=50.0)  # €1.25
        usage2 = FilamentUsage(product_id=product.id, filament_id=filament2.id, grams_used=30.0)  # €0.90
        db.add_all([usage1, usage2])
        db.commit()
        
        # Refresh to get relationships
        db.refresh(product)
        
        # Test COP calculation: €1.25 + €0.90 + €2.00 = €4.15
        assert product.cop == 4.15
    
    def test_product_cop_update_propagation(self, db: Session):
        """Test that COP updates when filament prices change."""
        # Create test filament
        filament = Filament(color="Red", brand="ESUN", material="PLA", price_per_kg=25.0)
        db.add(filament)
        db.flush()
        
        # Create test product
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0, additional_parts_cost=0.0)
        db.add(product)
        db.flush()
        
        # Create filament usage
        usage = FilamentUsage(product_id=product.id, filament_id=filament.id, grams_used=100.0)  # 100g
        db.add(usage)
        db.commit()
        
        # Initial COP: 100g * €25/kg = €2.50
        db.refresh(product)
        assert product.cop == 2.50
        
        # Update filament price
        filament.price_per_kg = 30.0
        db.commit()
        
        # COP should update: 100g * €30/kg = €3.00
        db.refresh(product)
        assert product.cop == 3.00
    
    def test_product_cop_with_zero_cost_components(self, db: Session):
        """Test product COP with zero-cost components."""
        # Create test filament with zero cost
        filament = Filament(color="Red", brand="ESUN", material="PLA", price_per_kg=0.0)
        db.add(filament)
        db.flush()
        
        # Create test product with no additional parts cost
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0, additional_parts_cost=0.0)
        db.add(product)
        db.flush()
        
        # Create filament usage
        usage = FilamentUsage(product_id=product.id, filament_id=filament.id, grams_used=50.0)
        db.add(usage)
        db.commit()
        
        # Refresh to get relationships
        db.refresh(product)
        
        # Test COP calculation: €0.00 + €0.00 = €0.00
        assert product.cop == 0.0
    
    def test_product_cop_precision(self, db: Session):
        """Test that COP calculation maintains proper precision."""
        # Create test filament
        filament = Filament(color="Red", brand="ESUN", material="PLA", price_per_kg=23.333)  # Precise price
        db.add(filament)
        db.flush()
        
        # Create test product
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0, additional_parts_cost=1.666)
        db.add(product)
        db.flush()
        
        # Create filament usage
        usage = FilamentUsage(product_id=product.id, filament_id=filament.id, grams_used=33.0)  # 33g
        db.add(usage)
        db.commit()
        
        # Refresh to get relationships
        db.refresh(product)
        
        # Test COP calculation: (33g/1000 * €23.333) + €1.666 = €0.77 + €1.666 = €2.44 (rounded to 2 decimal places)
        expected_cop = round((33.0 / 1000.0) * 23.333 + 1.666, 2)
        assert product.cop == expected_cop
    
    def test_product_cop_no_filament_usage(self, db: Session):
        """Test product COP when there are no filament usages."""
        # Create test product with only additional parts cost
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0, additional_parts_cost=5.0)
        db.add(product)
        db.commit()
        
        # Refresh to get relationships
        db.refresh(product)
        
        # Test COP calculation: €0.00 (no filaments) + €5.00 = €5.00
        assert product.cop == 5.0
    
    def test_product_cop_with_missing_filament(self, db: Session):
        """Test product COP calculation when referenced filament is missing."""
        # Create test product
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0, additional_parts_cost=1.0)
        db.add(product)
        db.flush()
        
        # Create filament usage with non-existent filament (will have None relationship)
        usage = FilamentUsage(product_id=product.id, filament_id=999, grams_used=50.0)
        db.add(usage)
        db.commit()
        
        # Refresh to get relationships
        db.refresh(product)
        
        # Test COP calculation: should ignore missing filament, only additional parts cost
        assert product.cop == 1.0