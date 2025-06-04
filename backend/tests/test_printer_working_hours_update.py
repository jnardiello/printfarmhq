"""Test that printer working hours are updated when print jobs are started.

With the new single-printer-per-job design, each print job can only be assigned
to one printer at a time.
"""

import pytest
from datetime import datetime
from uuid import UUID
from sqlalchemy.orm import Session
from app import models, schemas


def test_printer_working_hours_updated_on_job_start(client, db, auth_headers):
    """Test that printer working hours are correctly updated when a print job is started."""
    
    # Create a printer type
    printer_type_data = {
        "brand": "Test Brand",
        "model": "Test Model",
        "expected_life_hours": 10000
    }
    
    response = client.post("/printer_types", json=printer_type_data, headers=auth_headers)
    assert response.status_code == 201
    printer_type_id = response.json()["id"]
    
    # Create two printers of this type
    printer1_data = {
        "printer_type_id": printer_type_id,
        "name": "Test Printer 1",
        "purchase_price_eur": 1000,
        "working_hours": 100.0  # Initial hours
    }
    
    printer2_data = {
        "printer_type_id": printer_type_id,
        "name": "Test Printer 2",
        "purchase_price_eur": 1000,
        "working_hours": 200.0  # Initial hours
    }
    
    response = client.post("/printers", json=printer1_data, headers=auth_headers)
    assert response.status_code == 201
    printer1_id = response.json()["id"]
    printer1_initial_hours = response.json()["working_hours"]
    
    response = client.post("/printers", json=printer2_data, headers=auth_headers)
    assert response.status_code == 201
    printer2_id = response.json()["id"]
    printer2_initial_hours = response.json()["working_hours"]
    
    # Create a filament
    filament_data = {
        "color": "Test Black",
        "brand": "Test Brand",
        "material": "PLA",
        "price_per_kg": 20.0,
        "total_qty_kg": 10.0
    }
    response = client.post("/filaments", json=filament_data, headers=auth_headers)
    assert response.status_code == 201
    filament_id = response.json()["id"]
    
    # Create a product using form data
    import json
    product_form_data = {
        "name": "Test Product for Hours",
        "print_time": "5h",  # 5 hours print time
        "filament_ids": json.dumps([filament_id]),
        "grams_used_list": json.dumps([100])
    }
    
    response = client.post("/products", data=product_form_data, headers=auth_headers)
    assert response.status_code in [200, 201]
    product_id = response.json()["id"]
    
    # Create a print job that requires 1 printer
    print_job_data = {
        "name": "Test Job for Working Hours",
        "products": [{"product_id": product_id, "items_qty": 2}],  # 2 items = 10 hours total
        "printers": [{
            "printer_type_id": printer_type_id,
            "printers_qty": 1  # Single printer (will be removed in refactoring)
        }],
        "packaging_cost_eur": 0,
        "status": "pending"
    }
    
    response = client.post("/print_jobs", json=print_job_data, headers=auth_headers)
    assert response.status_code == 201
    job_id = response.json()["id"]
    
    # Verify printers still have initial working hours (job not started yet)
    response = client.get(f"/printers/{printer1_id}", headers=auth_headers)
    assert response.json()["working_hours"] == printer1_initial_hours
    
    response = client.get(f"/printers/{printer2_id}", headers=auth_headers)
    assert response.json()["working_hours"] == printer2_initial_hours
    
    # Start the print job with selected printer (choose printer 1)
    start_data = {
        "printer_id": printer1_id  # Single printer ID (not array)
    }
    
    response = client.put(f"/print_jobs/{job_id}/start", json=start_data, headers=auth_headers)
    if response.status_code != 200:
        print(f"Start job error: {response.status_code}")
        print(f"Response: {response.json()}")
    assert response.status_code == 200
    started_job = response.json()
    
    # Verify job is now printing
    assert started_job["status"] == "printing"
    assert started_job["started_at"] is not None
    assert started_job["estimated_completion_at"] is not None
    
    # Verify printer 1 working hours were updated
    # Total hours = 5 hours/item * 2 items = 10 hours
    response = client.get(f"/printers/{printer1_id}", headers=auth_headers)
    printer1_updated = response.json()
    assert printer1_updated["working_hours"] == printer1_initial_hours + 10.0
    assert printer1_updated["status"] == "printing"
    
    # Verify printer 2 was NOT updated (not assigned to this job)
    response = client.get(f"/printers/{printer2_id}", headers=auth_headers)
    printer2_updated = response.json()
    assert printer2_updated["working_hours"] == printer2_initial_hours
    assert printer2_updated["status"] == "idle"
    
    # Verify printer usage history was created
    job_uuid = UUID(job_id)
    usage_history = db.query(models.PrinterUsageHistory).filter(
        models.PrinterUsageHistory.printer_id == printer1_id,
        models.PrinterUsageHistory.print_job_id == job_uuid
    ).first()
    
    assert usage_history is not None
    assert usage_history.hours_used == 10.0  # Total hours for this job
    
    # Stop the job and verify hours are NOT rolled back
    response = client.put(f"/print_jobs/{job_id}/stop", headers=auth_headers)
    assert response.status_code == 200
    stopped_job = response.json()
    assert stopped_job["status"] == "pending"
    
    # Verify printer hours remain updated (not rolled back)
    response = client.get(f"/printers/{printer1_id}", headers=auth_headers)
    assert response.json()["working_hours"] == printer1_initial_hours + 10.0
    assert response.json()["status"] == "idle"  # Status changed back to idle


def test_printer_working_hours_not_updated_on_job_creation(client, db, auth_headers):
    """Test that printer working hours are NOT updated when a job is just created (not started)."""
    
    # Create a printer type
    printer_type_data = {
        "brand": "Test Brand 2",
        "model": "Test Model 2",
        "expected_life_hours": 10000
    }
    
    response = client.post("/printer_types", json=printer_type_data, headers=auth_headers)
    assert response.status_code == 201
    printer_type_id = response.json()["id"]
    
    # Create a printer
    printer_data = {
        "printer_type_id": printer_type_id,
        "name": "Test Printer No Update",
        "purchase_price_eur": 1000,
        "working_hours": 50.0
    }
    
    response = client.post("/printers", json=printer_data, headers=auth_headers)
    assert response.status_code == 201
    printer_id = response.json()["id"]
    initial_hours = response.json()["working_hours"]
    
    # Create a filament
    filament_data = {
        "color": "Test Blue",
        "brand": "Test Brand",
        "material": "PLA",
        "price_per_kg": 20.0,
        "total_qty_kg": 10.0
    }
    response = client.post("/filaments", json=filament_data, headers=auth_headers)
    assert response.status_code == 201
    filament_id = response.json()["id"]
    
    # Create a product using form data
    import json
    product_form_data = {
        "name": "Test Product No Update",
        "print_time": "3h",
        "filament_ids": json.dumps([filament_id]),
        "grams_used_list": json.dumps([50])
    }
    response = client.post("/products", data=product_form_data, headers=auth_headers)
    assert response.status_code in [200, 201]
    product_id = response.json()["id"]
    
    # Create a print job but don't start it
    print_job_data = {
        "name": "Test Job Not Started",
        "products": [{"product_id": product_id, "items_qty": 1}],
        "printers": [{
            "printer_type_id": printer_type_id,
            "printers_qty": 1
        }],
        "packaging_cost_eur": 0,
        "status": "pending"
    }
    
    response = client.post("/print_jobs", json=print_job_data, headers=auth_headers)
    assert response.status_code == 201
    job_id = response.json()["id"]
    
    # Verify printer working hours were NOT updated
    response = client.get(f"/printers/{printer_id}", headers=auth_headers)
    printer_data = response.json()
    assert printer_data["working_hours"] == initial_hours
    assert printer_data["status"] == "idle"
    
    # Verify no usage history was created
    job_uuid = UUID(job_id)
    usage_history = db.query(models.PrinterUsageHistory).filter(
        models.PrinterUsageHistory.printer_id == printer_id,
        models.PrinterUsageHistory.print_job_id == job_uuid
    ).first()
    
    assert usage_history is None


def test_single_printer_assignment_only(client, db, auth_headers):
    """Test that only one printer can be assigned to a job at a time."""
    
    # Create a printer type
    printer_type_data = {
        "brand": "Test Brand 3",
        "model": "Test Model 3",
        "expected_life_hours": 10000
    }
    
    response = client.post("/printer_types", json=printer_type_data, headers=auth_headers)
    assert response.status_code == 201
    printer_type_id = response.json()["id"]
    
    # Create multiple printers
    printer_ids = []
    for i in range(3):
        printer_data = {
            "printer_type_id": printer_type_id,
            "name": f"Test Printer {i+1}",
            "purchase_price_eur": 1000,
            "working_hours": 0.0
        }
        response = client.post("/printers", json=printer_data, headers=auth_headers)
        assert response.status_code == 201
        printer_ids.append(response.json()["id"])
    
    # Create a filament
    filament_data = {
        "color": "Test Green",
        "brand": "Test Brand",
        "material": "PLA",
        "price_per_kg": 20.0,
        "total_qty_kg": 10.0
    }
    response = client.post("/filaments", json=filament_data, headers=auth_headers)
    assert response.status_code == 201
    filament_id = response.json()["id"]
    
    # Create a product
    import json
    product_form_data = {
        "name": "Test Product Single Printer",
        "print_time": "2h",
        "filament_ids": json.dumps([filament_id]),
        "grams_used_list": json.dumps([75])
    }
    response = client.post("/products", data=product_form_data, headers=auth_headers)
    assert response.status_code in [200, 201]
    product_id = response.json()["id"]
    
    # Create a print job
    print_job_data = {
        "name": "Test Single Printer Job",
        "products": [{"product_id": product_id, "items_qty": 1}],
        "printers": [{
            "printer_type_id": printer_type_id,
            "printers_qty": 1  # Always 1 with new design
        }],
        "packaging_cost_eur": 0,
        "status": "pending"
    }
    
    response = client.post("/print_jobs", json=print_job_data, headers=auth_headers)
    assert response.status_code == 201
    job_id = response.json()["id"]
    
    # Try to start with first printer
    start_data = {
        "printer_id": printer_ids[0]  # Single printer
    }
    
    response = client.put(f"/print_jobs/{job_id}/start", json=start_data, headers=auth_headers)
    assert response.status_code == 200
    started_job = response.json()
    
    # Check that only one printer is assigned
    assigned_printer_count = 0
    for printer_id in printer_ids:
        response = client.get(f"/printers/{printer_id}", headers=auth_headers)
        if response.json()["status"] == "printing":
            assigned_printer_count += 1
    
    # Only one printer should be printing
    assert assigned_printer_count == 1
    
    # The first printer should be the one printing
    response = client.get(f"/printers/{printer_ids[0]}", headers=auth_headers)
    assert response.json()["status"] == "printing"
    
    # Other printers should be idle
    response = client.get(f"/printers/{printer_ids[1]}", headers=auth_headers)
    assert response.json()["status"] == "idle"
    response = client.get(f"/printers/{printer_ids[2]}", headers=auth_headers)
    assert response.json()["status"] == "idle"