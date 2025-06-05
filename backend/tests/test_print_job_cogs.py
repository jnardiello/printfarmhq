import pytest
from datetime import datetime
from app import models, schemas
import uuid


@pytest.fixture
def setup_test_data(db):
    """Create test data for print job tests"""
    # Create test filaments
    filament1 = models.Filament(
        color="Test Red",
        brand="TestBrand",
        material="PLA",
        total_qty_kg=100.0,
        price_per_kg=20.0
    )
    filament2 = models.Filament(
        color="Test Blue", 
        brand="TestBrand",
        material="PETG",
        total_qty_kg=50.0,
        price_per_kg=25.0
    )
    db.add_all([filament1, filament2])
    db.flush()
    
    # Create test products with filament usages
    product1 = models.Product(
        name="Test Product 1",
        sku="TEST-001",
        print_time_hrs=2.5,
        additional_parts_cost=5.0
    )
    product2 = models.Product(
        name="Test Product 2",
        sku="TEST-002", 
        print_time_hrs=1.5,
        additional_parts_cost=3.0
    )
    db.add_all([product1, product2])
    db.flush()
    
    # Add filament usage to products
    usage1 = models.FilamentUsage(
        product_id=product1.id,
        filament_id=filament1.id,
        grams_used=50.0  # 50g × €20/kg = €1.00
    )
    usage2 = models.FilamentUsage(
        product_id=product2.id,
        filament_id=filament2.id,
        grams_used=40.0  # 40g × €25/kg = €1.00
    )
    db.add_all([usage1, usage2])
    
    # Create test printer types
    printer_type1 = models.PrinterType(
        brand="TestMaker",
        model="Model X",
        expected_life_hours=10000.0
    )
    printer_type2 = models.PrinterType(
        brand="TestMaker",
        model="Model Y",
        expected_life_hours=20000.0
    )
    db.add_all([printer_type1, printer_type2])
    db.flush()
    
    # Create test printers with proper name normalization
    printer1 = models.Printer(
        name="Test Printer 1",
        name_normalized="testprinter1",
        printer_type_id=printer_type1.id,
        purchase_price_eur=1000.0,  # €0.10/hour
        working_hours=0.0
    )
    printer2 = models.Printer(
        name="Test Printer 2",
        name_normalized="testprinter2",
        printer_type_id=printer_type2.id,
        purchase_price_eur=2000.0,  # €0.10/hour
        working_hours=100.0
    )
    db.add_all([printer1, printer2])
    
    db.commit()
    
    yield {
        "filaments": [filament1, filament2],
        "products": [product1, product2],
        "printer_types": [printer_type1, printer_type2],
        "printers": [printer1, printer2]
    }
    
    # Cleanup - delete in reverse order of dependencies
    db.query(models.PrintJobPrinter).delete()
    db.query(models.PrintJobProduct).delete()
    db.query(models.PrintJob).delete()
    db.query(models.FilamentUsage).delete()
    db.query(models.Printer).delete()
    db.query(models.PrinterType).delete()
    db.query(models.Product).delete()
    db.query(models.Filament).delete()
    db.commit()


def test_print_job_creation_calculates_hours_correctly(client, db, auth_headers, setup_test_data):
    """Test that creating a print job correctly calculates hours_each from product print times"""
    test_data = setup_test_data
    
    # Create print job with 2 units of product1 (2.5h each) and 3 units of product2 (1.5h each)
    # Total print time should be: 2×2.5 + 3×1.5 = 5.0 + 4.5 = 9.5 hours
    print_job_data = {
        "name": "Test Print Job",
        "products": [
            {"product_id": test_data["products"][0].id, "items_qty": 2},
            {"product_id": test_data["products"][1].id, "items_qty": 3}
        ],
        "printers": [
            {"printer_type_id": test_data["printer_types"][0].id}
        ],
        "packaging_cost_eur": 2.0,
        "status": "pending"
    }
    
    response = client.post("/print_jobs", json=print_job_data, headers=auth_headers)
    assert response.status_code == 201
    
    job_id = response.json()["id"]
    
    # Convert string UUID to UUID object
    job_uuid = uuid.UUID(job_id)
    
    # Verify hours_each was calculated correctly
    db_job = db.query(models.PrintJob).filter(models.PrintJob.id == job_uuid).first()
    assert db_job is not None
    assert len(db_job.printers) == 1
    assert db_job.printers[0].hours_each == 9.5  # Total print hours


def test_print_job_cogs_calculation(client, db, auth_headers, setup_test_data):
    """Test that COGS is calculated correctly including all components"""
    test_data = setup_test_data
    
    # Product1 COP = €1.00 (filament) + €5.00 (additional parts) = €6.00
    # Product2 COP = €1.00 (filament) + €3.00 (additional parts) = €4.00
    
    print_job_data = {
        "name": "COGS Test Job",
        "products": [
            {"product_id": test_data["products"][0].id, "items_qty": 2},  # 2 × €6 = €12
            {"product_id": test_data["products"][1].id, "items_qty": 1}   # 1 × €4 = €4
        ],
        "printers": [
            {"printer_type_id": test_data["printer_types"][0].id}
        ],
        "packaging_cost_eur": 3.0,
        "status": "pending"
    }
    
    response = client.post("/print_jobs", json=print_job_data, headers=auth_headers)
    assert response.status_code == 201
    
    job = response.json()
    
    # Expected calculations:
    # Products cost: €12 + €4 = €16
    # Total print time: 2×2.5 + 1×1.5 = 6.5 hours
    # Printer cost: €0.10/hour × 6.5 hours = €0.65
    # Packaging: €3.00
    # Total COGS: €16 + €0.65 + €3.00 = €19.65
    
    assert job["calculated_cogs_eur"] == 19.65


def test_print_job_update_recalculates_correctly(client, db, auth_headers, setup_test_data):
    """Test that updating a print job recalculates hours and COGS correctly"""
    test_data = setup_test_data
    
    # Create initial print job
    print_job_data = {
        "name": "Update Test Job",
        "products": [
            {"product_id": test_data["products"][0].id, "items_qty": 1}
        ],
        "printers": [
            {"printer_type_id": test_data["printer_types"][0].id}
        ],
        "packaging_cost_eur": 1.0,
        "status": "pending"
    }
    
    response = client.post("/print_jobs", json=print_job_data, headers=auth_headers)
    assert response.status_code == 201
    job_id = response.json()["id"]
    initial_cogs = response.json()["calculated_cogs_eur"]
    
    # Update the job to change product quantities
    update_data = {
        "products": [
            {"product_id": test_data["products"][0].id, "items_qty": 2},  # Changed from 1 to 2
            {"product_id": test_data["products"][1].id, "items_qty": 3}   # Added new product
        ],
        "printers": [
            {"printer_type_id": test_data["printer_types"][0].id}
        ]
    }
    
    response = client.patch(f"/print_jobs/{job_id}", json=update_data, headers=auth_headers)
    assert response.status_code == 200
    
    updated_job = response.json()
    
    # Verify hours_each was recalculated
    # New total print time: 2×2.5 + 3×1.5 = 9.5 hours
    job_uuid = uuid.UUID(job_id)
    db_job = db.query(models.PrintJob).filter(models.PrintJob.id == job_uuid).first()
    assert db_job.printers[0].hours_each == 9.5
    
    # Verify COGS was recalculated and is different from initial
    assert updated_job["calculated_cogs_eur"] != initial_cogs
    # Expected: Products (2×€6 + 3×€4 = €24) + Printer (€0.10×9.5 = €0.95) + Packaging (€1) = €25.95
    assert updated_job["calculated_cogs_eur"] == 25.95


def test_print_job_double_update_consistency(client, db, auth_headers, setup_test_data):
    """Test that updating a print job twice gives consistent COGS (tests the stale data bug fix)"""
    test_data = setup_test_data
    
    # Create print job
    print_job_data = {
        "name": "Double Update Test",
        "products": [
            {"product_id": test_data["products"][0].id, "items_qty": 1}
        ],
        "printers": [
            {"printer_type_id": test_data["printer_types"][0].id}
        ],
        "packaging_cost_eur": 0.0,
        "status": "pending"
    }
    
    response = client.post("/print_jobs", json=print_job_data, headers=auth_headers)
    assert response.status_code == 201
    job_id = response.json()["id"]
    
    # First update
    update_data = {
        "products": [
            {"product_id": test_data["products"][0].id, "items_qty": 5}
        ]
    }
    
    response1 = client.patch(f"/print_jobs/{job_id}", json=update_data, headers=auth_headers)
    assert response1.status_code == 200
    job1 = response1.json()
    cogs1 = job1["calculated_cogs_eur"]
    
    
    # Second update with same data - should give same COGS
    response2 = client.patch(f"/print_jobs/{job_id}", json=update_data, headers=auth_headers)
    assert response2.status_code == 200
    cogs2 = response2.json()["calculated_cogs_eur"]
    
    # COGS should be the same both times
    assert cogs1 == cogs2
    # Expected calculation:
    # - Products: 5 × €6 = €30
    # - Total print time: 5 × 2.5h = 12.5h (this is stored as hours_each)
    # - Printer cost: €0.10/hour × 12.5h = €1.25
    # - Packaging: €0
    # - Total COGS: €30 + €1.25 + €0 = €31.25
    assert cogs1 == 31.25


def test_print_job_serialization_includes_nested_data(client, db, auth_headers, setup_test_data):
    """Test that print job response includes nested product and printer details"""
    test_data = setup_test_data
    
    # Create print job
    print_job_data = {
        "name": "Serialization Test",
        "products": [
            {"product_id": test_data["products"][0].id, "items_qty": 1}
        ],
        "printers": [
            {"printer_type_id": test_data["printer_types"][0].id}
        ],
        "packaging_cost_eur": 0.0,
        "status": "pending"
    }
    
    response = client.post("/print_jobs", json=print_job_data, headers=auth_headers)
    assert response.status_code == 201
    job = response.json()
    
    # Check products have nested data
    assert len(job["products"]) == 1
    product_item = job["products"][0]
    assert "product" in product_item
    assert product_item["product"]["name"] == "Test Product 1"
    assert product_item["product"]["sku"] == "TEST-001"
    assert product_item["product"]["cop"] == 6.0  # €1 filament + €5 additional parts
    
    # Check printers have stored data
    assert len(job["printers"]) == 1
    printer_item = job["printers"][0]
    # printer_name is only set when job is started and printer assigned
    assert printer_item["printer_name"] is None
    # But printer type data should be stored
    assert printer_item["printer_manufacturer"] == "TestMaker"
    assert printer_item["printer_model"] == "Model X"


def test_print_job_with_no_printer_type(client, db, auth_headers, setup_test_data):
    """Test that print job handles missing printer type gracefully"""
    test_data = setup_test_data
    
    # Create print job with non-existent printer type ID
    print_job_data = {
        "name": "Missing Printer Test",
        "products": [
            {"product_id": test_data["products"][0].id, "items_qty": 1}
        ],
        "printers": [
            {"printer_type_id": 99999}  # Non-existent ID
        ],
        "packaging_cost_eur": 0.0,
        "status": "pending"
    }
    
    response = client.post("/print_jobs", json=print_job_data, headers=auth_headers)
    # The API correctly rejects invalid printer type IDs
    assert response.status_code == 400
    assert "Printer type with ID 99999 not found" in response.json()["detail"]