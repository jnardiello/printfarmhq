"""
Tests for plate-based inventory deduction in print jobs.
Tests the new plate structure's impact on filament inventory tracking.
"""
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app import models


class TestPlateInventoryDeduction:
    """Test inventory deduction for products using the new plate structure."""

    def test_plate_based_inventory_deduction_single_plate(self, client: TestClient, db: Session, auth_headers: dict):
        """Test that creating a print job correctly deducts inventory from plate-based products."""
        
        # Step 1: Create filament with known inventory
        filament_data = {
            "material": "PLA",
            "color": "Green", 
            "brand": "eSUN"
        }
        filament_response = client.post("/filaments", json=filament_data, headers=auth_headers)
        assert filament_response.status_code == 201
        filament_id = filament_response.json()["id"]
        
        # Add inventory
        initial_stock = 2.0  # 2kg
        purchase_data = {
            "filament_id": filament_id,
            "quantity_kg": initial_stock,
            "price_per_kg": 24.00
        }
        purchase_response = client.post("/filament_purchases", json=purchase_data, headers=auth_headers)
        assert purchase_response.status_code == 201
        
        # Step 2: Create product with plate structure
        product_data = {
            "name": "Plate Test Product",
            "print_time_hrs": 1.5,
            "filament_usages": json.dumps([{"filament_id": filament_id, "grams_used": 75.0}])
        }
        product_response = client.post("/products", data=product_data, headers=auth_headers)
        assert product_response.status_code == 200
        product_id = product_response.json()["id"]
        
        # Step 3: Add a plate to this product
        plate_form_data = {
            "name": "Main Body",
            "quantity": "1",
            "print_time": "1h30m",
            "filament_usages": json.dumps([{"filament_id": filament_id, "grams_used": 75.0}])
        }
        plate_response = client.post(f"/products/{product_id}/plates", data=plate_form_data, headers=auth_headers)
        assert plate_response.status_code == 200
        
        # Step 4: Create printer profile
        printer_data = {"name": "Plate Test Printer", "price_eur": 600.00, "expected_life_hours": 3 * 8760}
        printer_response = client.post("/printer_profiles", json=printer_data, headers=auth_headers)
        assert printer_response.status_code == 201
        printer_id = printer_response.json()["id"]
        
        # Step 5: Verify initial inventory
        filament_before_response = client.get(f"/filaments/{filament_id}", headers=auth_headers)
        filament_before = filament_before_response.json()
        assert filament_before["total_qty_kg"] == initial_stock
        
        # Step 6: Create print job with 5 items
        items_qty = 5
        job_data = {
            "name": "Plate Inventory Test Job",
            "products": [{"product_id": product_id, "items_qty": items_qty}],
            "printers": [{"printer_profile_id": printer_id, "printers_qty": 1, "hours_each": 7.5}],
            "packaging_cost_eur": 2.50,
            "status": "pending"
        }
        
        job_response = client.post("/print_jobs", json=job_data, headers=auth_headers)
        assert job_response.status_code == 201
        job_id = job_response.json()["id"]
        
        # Step 7: Verify inventory was deducted correctly
        filament_after_response = client.get(f"/filaments/{filament_id}", headers=auth_headers)
        filament_after = filament_after_response.json()
        
        # Expected deduction: 75g per item * 5 items = 375g = 0.375kg
        expected_deduction = (75.0 * items_qty) / 1000.0  # 0.375kg
        expected_remaining = initial_stock - expected_deduction  # 2.0 - 0.375 = 1.625kg
        
        assert abs(filament_after["total_qty_kg"] - expected_remaining) < 0.001, f"Expected {expected_remaining}kg, got {filament_after['total_qty_kg']}kg"
        
        # Step 8: Verify job was created with correct COGS
        job_detail_response = client.get(f"/print_jobs/{job_id}", headers=auth_headers)
        job_detail = job_detail_response.json()
        assert job_detail["calculated_cogs_eur"] > 0
        
        return job_id, filament_id, expected_remaining

    def test_plate_based_inventory_deduction_multiple_plates(self, client: TestClient, db: Session, auth_headers: dict):
        """Test inventory deduction for products with multiple plates using different filaments."""
        
        # Step 1: Create two different filaments
        filament1_data = {"material": "PLA", "color": "Red", "brand": "Bambu"}
        filament1_response = client.post("/filaments", json=filament1_data, headers=auth_headers)
        assert filament1_response.status_code == 201
        filament1_id = filament1_response.json()["id"]
        
        filament2_data = {"material": "PETG", "color": "Clear", "brand": "Overture"}
        filament2_response = client.post("/filaments", json=filament2_data, headers=auth_headers)
        assert filament2_response.status_code == 201
        filament2_id = filament2_response.json()["id"]
        
        # Add inventory to both
        for filament_id in [filament1_id, filament2_id]:
            purchase_data = {
                "filament_id": filament_id,
                "quantity_kg": 1.5,
                "price_per_kg": 25.00
            }
            purchase_response = client.post("/filament_purchases", json=purchase_data, headers=auth_headers)
            assert purchase_response.status_code == 201
        
        # Step 2: Create product
        product_data = {
            "name": "Multi-Plate Product",
            "print_time_hrs": 2.0,
            "filament_usages": json.dumps([{"filament_id": filament1_id, "grams_used": 50.0}])
        }
        product_response = client.post("/products", data=product_data, headers=auth_headers)
        assert product_response.status_code == 200
        product_id = product_response.json()["id"]
        
        # Step 3: Add multiple plates with different quantities
        # Plate 1: Uses PLA, quantity 2
        plate1_data = {
            "name": "Base Plate",
            "quantity": "2",
            "print_time": "45m",
            "filament_usages": json.dumps([{"filament_id": filament1_id, "grams_used": 40.0}])
        }
        plate1_response = client.post(f"/products/{product_id}/plates", data=plate1_data, headers=auth_headers)
        assert plate1_response.status_code == 200
        
        # Plate 2: Uses PETG, quantity 1
        plate2_data = {
            "name": "Top Cover",
            "quantity": "1", 
            "print_time": "30m",
            "filament_usages": json.dumps([{"filament_id": filament2_id, "grams_used": 25.0}])
        }
        plate2_response = client.post(f"/products/{product_id}/plates", data=plate2_data, headers=auth_headers)
        assert plate2_response.status_code == 200
        
        # Step 4: Create printer and print job
        printer_data = {"name": "Multi Test Printer", "price_eur": 800.00, "expected_life_hours": 4 * 8760}
        printer_response = client.post("/printer_profiles", json=printer_data, headers=auth_headers)
        assert printer_response.status_code == 201
        printer_id = printer_response.json()["id"]
        
        # Create print job with 3 products
        items_qty = 3
        job_data = {
            "name": "Multi-Plate Test Job",
            "products": [{"product_id": product_id, "items_qty": items_qty}],
            "printers": [{"printer_profile_id": printer_id, "printers_qty": 1, "hours_each": 6.0}],
            "packaging_cost_eur": 3.00,
            "status": "pending"
        }
        
        job_response = client.post("/print_jobs", json=job_data, headers=auth_headers)
        assert job_response.status_code == 201
        
        # Step 5: Verify inventory deductions
        # For filament1 (PLA): 40g * 2 plates * 3 products = 240g = 0.240kg
        # For filament2 (PETG): 25g * 1 plate * 3 products = 75g = 0.075kg
        
        filament1_after_response = client.get(f"/filaments/{filament1_id}", headers=auth_headers)
        filament1_after = filament1_after_response.json()
        expected_filament1_remaining = 1.5 - 0.240  # 1.260kg
        assert abs(filament1_after["total_qty_kg"] - expected_filament1_remaining) < 0.001
        
        filament2_after_response = client.get(f"/filaments/{filament2_id}", headers=auth_headers)
        filament2_after = filament2_after_response.json()
        expected_filament2_remaining = 1.5 - 0.075  # 1.425kg
        assert abs(filament2_after["total_qty_kg"] - expected_filament2_remaining) < 0.001

    def test_plate_based_insufficient_inventory(self, client: TestClient, db: Session, auth_headers: dict):
        """Test that insufficient inventory properly prevents print job creation with plates."""
        
        # Step 1: Create filament with limited stock
        filament_data = {"material": "TPU", "color": "Transparent", "brand": "NinjaFlex"}
        filament_response = client.post("/filaments", json=filament_data, headers=auth_headers)
        assert filament_response.status_code == 201
        filament_id = filament_response.json()["id"]
        
        # Add only 80g of inventory
        purchase_data = {
            "filament_id": filament_id,
            "quantity_kg": 0.08,  # 80g
            "price_per_kg": 50.00
        }
        purchase_response = client.post("/filament_purchases", json=purchase_data, headers=auth_headers)
        assert purchase_response.status_code == 201
        
        # Step 2: Create product
        product_data = {
            "name": "High Consumption Product",
            "print_time_hrs": 3.0,
            "filament_usages": json.dumps([{"filament_id": filament_id, "grams_used": 100.0}])
        }
        product_response = client.post("/products", data=product_data, headers=auth_headers)
        assert product_response.status_code == 200
        product_id = product_response.json()["id"]
        
        # Step 3: Add plate that requires 100g (more than available)
        plate_data = {
            "name": "Heavy Plate",
            "quantity": "1",
            "print_time": "2h30m",
            "filament_usages": json.dumps([{"filament_id": filament_id, "grams_used": 100.0}])
        }
        plate_response = client.post(f"/products/{product_id}/plates", data=plate_data, headers=auth_headers)
        assert plate_response.status_code == 200
        
        # Step 4: Create printer
        printer_data = {"name": "Insufficient Test Printer", "price_eur": 500.00, "expected_life_hours": 2 * 8760}
        printer_response = client.post("/printer_profiles", json=printer_data, headers=auth_headers)
        assert printer_response.status_code == 201
        printer_id = printer_response.json()["id"]
        
        # Step 5: Attempt to create print job - should fail
        job_data = {
            "name": "Should Fail Job",
            "products": [{"product_id": product_id, "items_qty": 1}],  # Needs 100g, only 80g available
            "printers": [{"printer_profile_id": printer_id, "printers_qty": 1, "hours_each": 3.0}],
            "packaging_cost_eur": 0.0,
            "status": "pending"
        }
        
        job_response = client.post("/print_jobs", json=job_data, headers=auth_headers)
        assert job_response.status_code == 400
        error_detail = job_response.json()["detail"]
        assert "Insufficient filament inventory" in error_detail["message"]
        assert "Required: 0.100kg, Available: 0.080kg" in str(error_detail)
        
        # Step 6: Verify inventory wasn't changed
        filament_check_response = client.get(f"/filaments/{filament_id}", headers=auth_headers)
        assert filament_check_response.json()["total_qty_kg"] == 0.08

    def test_plate_based_print_job_deletion_restores_inventory(self, client: TestClient, db: Session, auth_headers: dict):
        """Test that deleting plate-based print jobs correctly restores inventory."""
        
        # Use the first test to create a job, then delete it
        job_id, filament_id, inventory_after_job = self.test_plate_based_inventory_deduction_single_plate(
            client, db, auth_headers
        )
        
        # Delete the print job
        delete_response = client.delete(f"/print_jobs/{job_id}", headers=auth_headers)
        assert delete_response.status_code == 204
        
        # Verify inventory was restored
        filament_restored_response = client.get(f"/filaments/{filament_id}", headers=auth_headers)
        filament_restored = filament_restored_response.json()
        
        # Should be back to 2.0kg (original amount)
        assert abs(filament_restored["total_qty_kg"] - 2.0) < 0.001, f"Expected 2.0kg after restoration, got {filament_restored['total_qty_kg']}kg"