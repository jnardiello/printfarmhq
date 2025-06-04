import pytest
from datetime import datetime
from app import models, schemas


def create_test_product_with_plate(db):
    """Create a test product with plate for testing"""
    # Create a test filament
    filament = models.Filament(
        color="Test Black",
        brand="Test Brand",
        material="PLA",
        total_qty_kg=10.0,
        price_per_kg=20.0
    )
    db.add(filament)
    db.flush()
    
    # Create a test product
    product = models.Product(
        name="Test Product",
        sku="TEST-001",
        print_time_hrs=2.0,
        filament_weight_g=100.0,
        additional_parts_cost=0.0
    )
    db.add(product)
    db.flush()
    
    # Create a plate
    plate = models.Plate(
        product_id=product.id,
        name="Main Plate",
        quantity=1,
        print_time_hrs=2.0
    )
    db.add(plate)
    db.flush()
    
    # Add plate filament usage
    plate_usage = models.PlateFilamentUsage(
        plate_id=plate.id,
        filament_id=filament.id,
        grams_used=100.0
    )
    db.add(plate_usage)
    
    db.commit()
    db.refresh(product)
    return product


def test_printer_working_hours_initialization(client, db, auth_headers):
    """Test that printers can be created with initial working hours"""
    
    # Create printer with initial working hours
    printer_data = {
        "name": "Test Printer",
        "manufacturer": "Test Manufacturer",
        "model": "Test Model",
        "price_eur": 1000,
        "expected_life_hours": 10000,
        "working_hours": 500
    }
    
    response = client.post("/printer_profiles", json=printer_data, headers=auth_headers)
    assert response.status_code == 201
    
    printer = response.json()
    assert printer["working_hours"] == 500
    assert printer["life_left_hours"] == 9500
    assert printer["life_percentage"] == 95.0


def test_printer_life_calculations(client, db, auth_headers):
    """Test printer life left and percentage calculations"""
    
    # Create printer
    printer_data = {
        "name": "Life Test Printer",
        "price_eur": 1000,
        "expected_life_hours": 1000,
        "working_hours": 0
    }
    
    response = client.post("/printer_profiles", json=printer_data, headers=auth_headers)
    printer_id = response.json()["id"]
    
    # Update working hours
    update_data = {"working_hours": 250}
    response = client.put(f"/printer_profiles/{printer_id}", json=update_data, headers=auth_headers)
    assert response.status_code == 200
    
    printer = response.json()
    assert printer["working_hours"] == 250
    assert printer["life_left_hours"] == 750
    assert printer["life_percentage"] == 75.0
    
    # Update to exceed expected life
    update_data = {"working_hours": 1200}
    response = client.put(f"/printer_profiles/{printer_id}", json=update_data, headers=auth_headers)
    assert response.status_code == 200
    
    printer = response.json()
    assert printer["working_hours"] == 1200
    assert printer["life_left_hours"] == 0  # Can't be negative
    assert printer["life_percentage"] == 0.0


def test_print_job_updates_printer_hours(client, db, auth_headers):
    """Test that creating a print job updates printer working hours"""
    # Create test product first
    test_product = create_test_product_with_plate(db)
    
    # Create printer
    printer_data = {
        "name": "Print Job Test Printer",
        "price_eur": 1000,
        "expected_life_hours": 10000,
        "working_hours": 100
    }
    
    response = client.post("/printer_profiles", json=printer_data, headers=auth_headers)
    printer = response.json()
    printer_id = printer["id"]
    
    # Create print job
    print_job_data = {
        "name": "Test Print Job",
        "products": [{"product_id": test_product.id, "items_qty": 1}],
        "printers": [{
            "printer_profile_id": printer_id,
            "printers_qty": 2,
            "hours_each": 10
        }],
        "packaging_cost_eur": 5,
        "status": "pending"
    }
    
    response = client.post("/print_jobs", json=print_job_data, headers=auth_headers)
    assert response.status_code == 201
    
    # Check printer hours were updated (10 hours × 2 printers = 20 hours added)
    response = client.get(f"/printer_profiles/{printer_id}", headers=auth_headers)
    updated_printer = response.json()
    assert updated_printer["working_hours"] == 120  # 100 + 20


def test_printer_usage_history_creation(client, db, auth_headers):
    """Test that printer usage history is created when print jobs are created"""
    # Create test product first
    test_product = create_test_product_with_plate(db)
    
    # Create printer
    printer_data = {
        "name": "Usage History Test Printer",
        "price_eur": 1000,
        "expected_life_hours": 10000
    }
    
    response = client.post("/printer_profiles", json=printer_data, headers=auth_headers)
    printer_id = response.json()["id"]
    
    # Create print job
    print_job_data = {
        "name": "History Test Print Job",
        "products": [{"product_id": test_product.id, "items_qty": 1}],
        "printers": [{
            "printer_profile_id": printer_id,
            "printers_qty": 1,
            "hours_each": 5
        }],
        "packaging_cost_eur": 0,
        "status": "pending"
    }
    
    response = client.post("/print_jobs", json=print_job_data, headers=auth_headers)
    assert response.status_code == 201
    print_job_id = response.json()["id"]
    
    # Verify usage history was created
    import uuid
    print_job_uuid = uuid.UUID(print_job_id)
    usage_history = db.query(models.PrinterUsageHistory).filter(
        models.PrinterUsageHistory.printer_profile_id == printer_id,
        models.PrinterUsageHistory.print_job_id == print_job_uuid
    ).first()
    
    assert usage_history is not None
    assert usage_history.hours_used == 5
    assert usage_history.printers_qty == 1
    
    # Check date fields
    now = datetime.now()
    assert usage_history.week_year == int(now.strftime("%Y%V"))
    assert usage_history.month_year == int(now.strftime("%Y%m"))
    assert usage_history.quarter_year == int(f"{now.year}{(now.month-1)//3 + 1}")


def test_printer_usage_stats_endpoint(client, db, auth_headers):
    """Test the printer usage statistics endpoint"""
    # Create test product first
    test_product = create_test_product_with_plate(db)
    
    # Create printer
    printer_data = {
        "name": "Stats Test Printer",
        "price_eur": 1000,
        "expected_life_hours": 10000
    }
    
    response = client.post("/printer_profiles", json=printer_data, headers=auth_headers)
    printer_id = response.json()["id"]
    
    # Create multiple print jobs
    for i in range(3):
        print_job_data = {
            "name": f"Stats Test Job {i}",
            "products": [{"product_id": test_product.id, "items_qty": 1}],
            "printers": [{
                "printer_profile_id": printer_id,
                "printers_qty": 1,
                "hours_each": 2
            }],
            "packaging_cost_eur": 0,
            "status": "pending"
        }
        response = client.post("/print_jobs", json=print_job_data, headers=auth_headers)
        assert response.status_code == 201
    
    # Test weekly stats
    response = client.get(f"/printer_profiles/{printer_id}/usage_stats?period=week&count=4", headers=auth_headers)
    assert response.status_code == 200
    
    stats = response.json()
    assert stats["printer_id"] == printer_id
    assert stats["printer_name"] == "Stats Test Printer"
    assert stats["total_working_hours"] == 6  # 3 jobs × 2 hours
    assert stats["life_left_hours"] == 9994
    assert stats["life_percentage"] == 99.94
    
    # Current week should have the usage
    current_week_stats = next((s for s in stats["stats"] if s["hours_used"] > 0), None)
    assert current_week_stats is not None
    assert current_week_stats["hours_used"] == 6
    assert current_week_stats["print_count"] == 3
    
    # Test monthly stats
    response = client.get(f"/printer_profiles/{printer_id}/usage_stats?period=month&count=3", headers=auth_headers)
    assert response.status_code == 200
    
    # Test quarterly stats
    response = client.get(f"/printer_profiles/{printer_id}/usage_stats?period=quarter&count=2", headers=auth_headers)
    assert response.status_code == 200


def test_invalid_period_for_usage_stats(client, db, auth_headers):
    """Test that invalid period parameter returns error"""
    
    # Create printer
    printer_data = {
        "name": "Invalid Period Test",
        "price_eur": 1000,
        "expected_life_hours": 10000
    }
    
    response = client.post("/printer_profiles", json=printer_data, headers=auth_headers)
    printer_id = response.json()["id"]
    
    # Test invalid period
    response = client.get(f"/printer_profiles/{printer_id}/usage_stats?period=invalid", headers=auth_headers)
    assert response.status_code == 400
    assert "Period must be 'week', 'month', or 'quarter'" in response.json()["detail"]


def test_printer_not_found_for_usage_stats(client, auth_headers):
    """Test that non-existent printer returns 404 for usage stats"""
    
    response = client.get("/printer_profiles/99999/usage_stats", headers=auth_headers)
    assert response.status_code == 404
    assert "Printer profile not found" in response.json()["detail"]