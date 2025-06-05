import pytest
from datetime import datetime
import uuid
from sqlalchemy.orm import Session

from app import models, schemas
from .factories import UserFactory, ProductFactory


def test_printer_type_crud_workflow(client, auth_headers, db: Session):
    """Test the complete CRUD workflow for printer types."""
    # 1. Create a printer type
    printer_type_data = {
        "brand": "Prusa",
        "model": "MK4",
        "expected_life_hours": 20000.0
    }
    
    response = client.post("/printer_types", json=printer_type_data, headers=auth_headers)
    assert response.status_code == 201
    created_type = response.json()
    assert created_type["brand"] == "Prusa"
    assert created_type["model"] == "MK4"
    assert created_type["expected_life_hours"] == 20000.0
    printer_type_id = created_type["id"]
    
    # 2. List printer types
    response = client.get("/printer_types", headers=auth_headers)
    assert response.status_code == 200
    types = response.json()
    assert len(types) >= 1
    assert any(t["id"] == printer_type_id for t in types)
    
    # 3. Update printer type
    update_data = {
        "brand": "Prusa Research",
        "model": "MK4S",
        "expected_life_hours": 25000.0
    }
    response = client.put(f"/printer_types/{printer_type_id}", json=update_data, headers=auth_headers)
    assert response.status_code == 200
    updated_type = response.json()
    assert updated_type["brand"] == "Prusa Research"
    assert updated_type["model"] == "MK4S"
    assert updated_type["expected_life_hours"] == 25000.0
    
    # 4. Delete printer type
    response = client.delete(f"/printer_types/{printer_type_id}", headers=auth_headers)
    assert response.status_code == 204
    
    # Verify deletion
    response = client.get("/printer_types", headers=auth_headers)
    types = response.json()
    assert not any(t["id"] == printer_type_id for t in types)


def test_printer_instance_workflow(client, auth_headers, db: Session):
    """Test creating printer instances from printer types."""
    # 1. Create a printer type
    printer_type_data = {
        "brand": "Bambu Lab",
        "model": "X1 Carbon",
        "expected_life_hours": 15000.0
    }
    
    response = client.post("/printer_types", json=printer_type_data, headers=auth_headers)
    assert response.status_code == 201
    printer_type = response.json()
    printer_type_id = printer_type["id"]
    
    # 2. Create printer instances
    printer1_data = {
        "name": "X1 Carbon - Office",
        "printer_type_id": printer_type_id,
        "purchase_price_eur": 1200.0,
        "purchase_date": "2024-01-15",
        "working_hours": 0.0
    }
    
    response = client.post("/printers", json=printer1_data, headers=auth_headers)
    assert response.status_code == 201
    printer1 = response.json()
    assert printer1["name"] == "X1 Carbon - Office"
    assert printer1["printer_type_id"] == printer_type_id
    assert printer1["status"] == "idle"
    
    printer2_data = {
        "name": "X1 Carbon - Workshop",
        "printer_type_id": printer_type_id,
        "purchase_price_eur": 1250.0,
        "purchase_date": "2024-03-20",
        "working_hours": 150.0
    }
    
    response = client.post("/printers", json=printer2_data, headers=auth_headers)
    assert response.status_code == 201
    printer2 = response.json()
    
    # 3. List printers
    response = client.get("/printers", headers=auth_headers)
    assert response.status_code == 200
    printers = response.json()
    assert len(printers) >= 2
    
    # 4. Check printer type includes printer count
    response = client.get("/printer_types", headers=auth_headers)
    types = response.json()
    printer_type_with_count = next(t for t in types if t["id"] == printer_type_id)
    assert printer_type_with_count["printer_count"] == 2


def test_print_job_with_printer_types(client, auth_headers, db: Session):
    """Test print job workflow with printer types."""
    # Setup: Create printer type and instances
    printer_type_data = {
        "brand": "Prusa",
        "model": "MINI+",
        "expected_life_hours": 10000.0
    }
    
    response = client.post("/printer_types", json=printer_type_data, headers=auth_headers)
    printer_type = response.json()
    printer_type_id = printer_type["id"]
    
    # Create two printer instances
    for i in range(2):
        printer_data = {
            "name": f"MINI+ #{i+1}",
            "printer_type_id": printer_type_id,
            "purchase_price_eur": 400.0,
            "working_hours": 0.0
        }
        response = client.post("/printers", json=printer_data, headers=auth_headers)
        assert response.status_code == 201
    
    # Create a product
    product = models.Product(
        sku="TEST-001",
        name="Test Product",
        print_time_hrs=2.0,
        filament_weight_g=50.0
    )
    db.add(product)
    db.commit()
    
    # 1. Create print job with printer type (not specific printer)
    job_data = {
        "name": "Test Print Job",
        "products": [{"product_id": product.id, "items_qty": 2}],
        "printers": [{"printer_type_id": printer_type_id}],
        "packaging_cost_eur": 2.5,
        "status": "pending"
    }
    
    response = client.post("/print_jobs", json=job_data, headers=auth_headers)
    assert response.status_code == 201
    job = response.json()
    job_id = job["id"]
    
    # Verify job was created with printer type
    assert job["printers"][0]["printer_type_id"] == printer_type_id
    assert job["printers"][0]["assigned_printer_id"] is None  # No printer assigned yet
    
    # 2. Start the print job - should auto-assign a printer
    response = client.put(f"/print_jobs/{job_id}/start", headers=auth_headers)
    assert response.status_code == 200
    started_job = response.json()
    
    # Verify printer was assigned
    assert started_job["status"] == "printing"
    assert started_job["printers"][0]["assigned_printer_id"] is not None
    assert started_job["printers"][0]["printer_name"] is not None
    
    # Check that assigned printer is now busy
    response = client.get("/printers", headers=auth_headers)
    printers = response.json()
    assigned_printer = next(p for p in printers if p["id"] == started_job["printers"][0]["assigned_printer_id"])
    assert assigned_printer["status"] == "printing"
    
    # 3. Complete the job - should release the printer
    response = client.patch(
        f"/print_jobs/{job_id}/status",
        json={"status": "completed"},
        headers=auth_headers
    )
    assert response.status_code == 200
    
    # Verify printer is idle again
    response = client.get("/printers", headers=auth_headers)
    printers = response.json()
    assigned_printer = next(p for p in printers if p["id"] == started_job["printers"][0]["assigned_printer_id"])
    assert assigned_printer["status"] == "idle"


def test_printer_availability_check(client, auth_headers, db: Session):
    """Test that printer assignment respects availability."""
    # Create printer type with only one instance
    printer_type_data = {
        "brand": "Creality",
        "model": "Ender 3 V3",
        "expected_life_hours": 8000.0
    }
    
    response = client.post("/printer_types", json=printer_type_data, headers=auth_headers)
    printer_type = response.json()
    printer_type_id = printer_type["id"]
    
    # Create only one printer instance
    printer_data = {
        "name": "Ender 3 V3 - Main",
        "printer_type_id": printer_type_id,
        "purchase_price_eur": 250.0,
        "working_hours": 0.0
    }
    response = client.post("/printers", json=printer_data, headers=auth_headers)
    printer = response.json()
    
    # Create a product
    product = models.Product(
        sku="TEST-001",
        name="Test Product",
        print_time_hrs=2.0,
        filament_weight_g=50.0
    )
    db.add(product)
    db.commit()
    
    # Create first print job
    job1_data = {
        "name": "First Job",
        "products": [{"product_id": product.id, "items_qty": 1}],
        "printers": [{"printer_type_id": printer_type_id}],
        "packaging_cost_eur": 1.0,
        "status": "pending"
    }
    
    response = client.post("/print_jobs", json=job1_data, headers=auth_headers)
    job1 = response.json()
    
    # Start first job
    response = client.put(f"/print_jobs/{job1['id']}/start", headers=auth_headers)
    assert response.status_code == 200
    
    # Create second print job requesting same printer type
    job2_data = {
        "name": "Second Job",
        "products": [{"product_id": product.id, "items_qty": 1}],
        "printers": [{"printer_type_id": printer_type_id}],
        "packaging_cost_eur": 1.0,
        "status": "pending"
    }
    
    response = client.post("/print_jobs", json=job2_data, headers=auth_headers)
    job2 = response.json()
    
    # Try to start second job - should fail due to no available printers
    response = client.put(f"/print_jobs/{job2['id']}/start", headers=auth_headers)
    assert response.status_code == 409  # Conflict
    assert "No available" in response.json()["detail"]


def test_cannot_delete_printer_type_with_instances(client, auth_headers, db: Session):
    """Test that printer types with instances cannot be deleted."""
    # Create printer type
    printer_type_data = {
        "brand": "Anycubic",
        "model": "Kobra 2",
        "expected_life_hours": 10000.0
    }
    
    response = client.post("/printer_types", json=printer_type_data, headers=auth_headers)
    printer_type = response.json()
    printer_type_id = printer_type["id"]
    
    # Create printer instance
    printer_data = {
        "name": "Kobra 2 - Test",
        "printer_type_id": printer_type_id,
        "purchase_price_eur": 300.0,
        "working_hours": 0.0
    }
    response = client.post("/printers", json=printer_data, headers=auth_headers)
    assert response.status_code == 201
    printer = response.json()
    printer_id = printer["id"]
    
    # Try to delete printer type - should fail
    response = client.delete(f"/printer_types/{printer_type_id}", headers=auth_headers)
    assert response.status_code == 409  # Conflict
    assert "Cannot delete printer type" in response.json()["detail"]
    
    # Delete printer instance first
    response = client.delete(f"/printers/{printer_id}", headers=auth_headers)
    assert response.status_code == 204
    
    # Now printer type deletion should succeed
    response = client.delete(f"/printer_types/{printer_type_id}", headers=auth_headers)
    assert response.status_code == 204