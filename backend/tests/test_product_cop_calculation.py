import pytest
from app import models, schemas


@pytest.fixture
def cop_test_data(db):
    """Create test data for COP calculation tests"""
    # Create test filaments with different prices
    filament_pla = models.Filament(
        color="Red",
        brand="TestBrand",
        material="PLA",
        total_qty_kg=100.0,
        price_per_kg=20.0  # €20/kg
    )
    filament_petg = models.Filament(
        color="Blue",
        brand="TestBrand",
        material="PETG",
        total_qty_kg=50.0,
        price_per_kg=30.0  # €30/kg
    )
    filament_tpu = models.Filament(
        color="Green",
        brand="TestBrand",
        material="TPU",
        total_qty_kg=25.0,
        price_per_kg=40.0  # €40/kg
    )
    db.add_all([filament_pla, filament_petg, filament_tpu])
    db.commit()
    
    yield {
        "filaments": {
            "pla": filament_pla,
            "petg": filament_petg,
            "tpu": filament_tpu
        }
    }
    
    # Cleanup in reverse order of dependencies
    db.query(models.PlateFilamentUsage).delete()
    db.query(models.Plate).delete()
    db.query(models.FilamentUsage).delete()  # Legacy
    db.query(models.Product).delete()
    db.query(models.Filament).delete()
    db.commit()


def test_product_cop_with_single_plate(client, db, auth_headers, cop_test_data):
    """Test COP calculation for a product with a single plate"""
    filaments = cop_test_data["filaments"]
    
    # Create product
    product = models.Product(
        name="Single Plate Product",
        sku="COP-001",
        print_time_hrs=1.0,
        filament_weight_g=0.0,
        additional_parts_cost=10.0  # €10 additional parts
    )
    db.add(product)
    db.flush()
    
    # Create plate
    plate = models.Plate(
        product_id=product.id,
        name="Main Part",
        quantity=1,
        print_time_hrs=1.0
    )
    db.add(plate)
    db.flush()
    
    # Add filament usage: 100g of PLA
    plate_usage = models.PlateFilamentUsage(
        plate_id=plate.id,
        filament_id=filaments["pla"].id,
        grams_used=100.0  # 100g × €20/kg = €2.00
    )
    db.add(plate_usage)
    db.commit()
    db.refresh(product)
    
    # Test COP calculation
    # Filament cost: 100g × €20/kg = 0.1kg × €20 = €2.00
    # Additional parts: €10.00
    # Total COP: €12.00
    assert product.cop == 12.0
    
    # Verify via API
    response = client.get(f"/products/{product.id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["cop"] == 12.0


def test_product_cop_with_multiple_plates(client, db, auth_headers, cop_test_data):
    """Test COP calculation for a product with multiple plates"""
    filaments = cop_test_data["filaments"]
    
    # Create product
    product = models.Product(
        name="Multi-Plate Product",
        sku="COP-002",
        print_time_hrs=3.0,
        filament_weight_g=0.0,
        additional_parts_cost=5.0  # €5 additional parts
    )
    db.add(product)
    db.flush()
    
    # Create plates with different quantities
    plate1 = models.Plate(
        product_id=product.id,
        name="Base",
        quantity=1,  # 1 per product
        print_time_hrs=1.5
    )
    plate2 = models.Plate(
        product_id=product.id,
        name="Lid",
        quantity=2,  # 2 per product
        print_time_hrs=0.5
    )
    db.add_all([plate1, plate2])
    db.flush()
    
    # Add filament usage
    # Plate 1: 50g PLA
    usage1 = models.PlateFilamentUsage(
        plate_id=plate1.id,
        filament_id=filaments["pla"].id,
        grams_used=50.0  # 50g × €20/kg = €1.00
    )
    # Plate 2: 30g PETG each
    usage2 = models.PlateFilamentUsage(
        plate_id=plate2.id,
        filament_id=filaments["petg"].id,
        grams_used=30.0  # 30g × €30/kg = €0.90
    )
    db.add_all([usage1, usage2])
    db.commit()
    db.refresh(product)
    
    # Test COP calculation
    # Plate 1 cost: 50g × €20/kg × 1 = €1.00
    # Plate 2 cost: 30g × €30/kg × 2 = €1.80
    # Total filament cost: €2.80
    # Additional parts: €5.00
    # Total COP: €7.80
    assert product.cop == 7.8


def test_product_cop_with_mixed_filaments_per_plate(client, db, auth_headers, cop_test_data):
    """Test COP calculation when a single plate uses multiple filaments"""
    filaments = cop_test_data["filaments"]
    
    # Create product
    product = models.Product(
        name="Multi-Material Product",
        sku="COP-003",
        print_time_hrs=2.0,
        filament_weight_g=0.0,
        additional_parts_cost=0.0  # No additional parts
    )
    db.add(product)
    db.flush()
    
    # Create plate
    plate = models.Plate(
        product_id=product.id,
        name="Multi-Material Part",
        quantity=1,
        print_time_hrs=2.0
    )
    db.add(plate)
    db.flush()
    
    # Add multiple filaments to same plate
    usage1 = models.PlateFilamentUsage(
        plate_id=plate.id,
        filament_id=filaments["pla"].id,
        grams_used=100.0  # 100g × €20/kg = €2.00
    )
    usage2 = models.PlateFilamentUsage(
        plate_id=plate.id,
        filament_id=filaments["tpu"].id,
        grams_used=50.0  # 50g × €40/kg = €2.00
    )
    db.add_all([usage1, usage2])
    db.commit()
    db.refresh(product)
    
    # Test COP calculation
    # PLA: 100g × €20/kg = €2.00
    # TPU: 50g × €40/kg = €2.00
    # Total COP: €4.00
    assert product.cop == 4.0


def test_product_cop_update_propagation(client, db, auth_headers, cop_test_data):
    """Test that COP is recalculated when product is updated"""
    filaments = cop_test_data["filaments"]
    
    # Create initial product
    product = models.Product(
        name="Update Test Product",
        sku="COP-004",
        print_time_hrs=1.0,
        filament_weight_g=0.0,
        additional_parts_cost=5.0
    )
    db.add(product)
    db.flush()
    
    # Create plate with filament
    plate = models.Plate(
        product_id=product.id,
        name="Part",
        quantity=1,
        print_time_hrs=1.0
    )
    db.add(plate)
    db.flush()
    
    usage = models.PlateFilamentUsage(
        plate_id=plate.id,
        filament_id=filaments["pla"].id,
        grams_used=100.0  # €2.00
    )
    db.add(usage)
    db.commit()
    db.refresh(product)
    
    initial_cop = product.cop  # Should be €7.00 (€2 filament + €5 additional)
    assert initial_cop == 7.0
    
    # Update product's additional parts cost via API
    update_data = {"additional_parts_cost": 15.0}
    response = client.patch(f"/products/{product.id}", json=update_data, headers=auth_headers)
    assert response.status_code == 200
    
    # Verify the update was applied
    updated_product = response.json()
    assert updated_product["additional_parts_cost"] == 15.0
    assert updated_product["cop"] == 17.0  # €2 filament + €15 additional
    
    # Get the product fresh from API to verify COP
    get_response = client.get(f"/products/{product.id}", headers=auth_headers)
    assert get_response.status_code == 200
    fetched_product = get_response.json()
    assert fetched_product["cop"] == 17.0  # €2 filament + €15 additional


def test_product_cop_with_zero_cost_components(client, db, auth_headers, cop_test_data):
    """Test COP calculation handles zero costs correctly"""
    filaments = cop_test_data["filaments"]
    
    # Create product with no additional parts cost
    product = models.Product(
        name="Zero Additional Cost Product",
        sku="COP-005",
        print_time_hrs=1.0,
        filament_weight_g=0.0,
        additional_parts_cost=0.0  # No additional parts
    )
    db.add(product)
    db.flush()
    
    # Create plate with no filament usage (e.g., a spacer)
    plate1 = models.Plate(
        product_id=product.id,
        name="Spacer",
        quantity=1,
        print_time_hrs=0.1
    )
    # Create plate with filament
    plate2 = models.Plate(
        product_id=product.id,
        name="Main Part",
        quantity=1,
        print_time_hrs=0.9
    )
    db.add_all([plate1, plate2])
    db.flush()
    
    # Only add filament to second plate
    usage = models.PlateFilamentUsage(
        plate_id=plate2.id,
        filament_id=filaments["pla"].id,
        grams_used=50.0  # €1.00
    )
    db.add(usage)
    db.commit()
    db.refresh(product)
    
    # COP should only be the filament cost
    assert product.cop == 1.0


def test_legacy_product_cop_calculation(client, db, auth_headers, cop_test_data):
    """Test COP calculation for legacy products (using FilamentUsage instead of plates)"""
    filaments = cop_test_data["filaments"]
    
    # Create legacy product without plates
    product = models.Product(
        name="Legacy Product",
        sku="COP-LEGACY",
        print_time_hrs=1.0,
        filament_weight_g=100.0,  # Legacy field
        additional_parts_cost=3.0
    )
    db.add(product)
    db.flush()
    
    # Add legacy filament usage
    legacy_usage = models.FilamentUsage(
        product_id=product.id,
        filament_id=filaments["petg"].id,
        grams_used=75.0  # 75g × €30/kg = €2.25
    )
    db.add(legacy_usage)
    db.commit()
    db.refresh(product)
    
    # Test COP calculation uses legacy system
    # Filament: 75g × €30/kg = €2.25
    # Additional parts: €3.00
    # Total COP: €5.25
    assert product.cop == 5.25


def test_product_cop_precision(client, db, auth_headers, cop_test_data):
    """Test COP calculation precision and rounding"""
    filaments = cop_test_data["filaments"]
    
    # Create product with values that test rounding
    product = models.Product(
        name="Precision Test Product",
        sku="COP-PRECISION",
        print_time_hrs=1.0,
        filament_weight_g=0.0,
        additional_parts_cost=1.234  # Test decimal precision
    )
    db.add(product)
    db.flush()
    
    plate = models.Plate(
        product_id=product.id,
        name="Part",
        quantity=3,  # Multiple quantity
        print_time_hrs=0.333
    )
    db.add(plate)
    db.flush()
    
    # Use amount that creates repeating decimals
    usage = models.PlateFilamentUsage(
        plate_id=plate.id,
        filament_id=filaments["pla"].id,
        grams_used=33.333  # 33.333g × €20/kg × 3 qty = €1.9998
    )
    db.add(usage)
    db.commit()
    db.refresh(product)
    
    # Test COP is rounded to 2 decimal places
    # Filament: 33.333g × €20/kg × 3 = €1.9998 → €2.00
    # Additional: €1.234 → €1.23 (rounded)
    # Total: €3.23
    assert product.cop == 3.23