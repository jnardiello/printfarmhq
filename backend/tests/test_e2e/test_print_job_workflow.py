"""
E2E tests for the complete print queue workflow.
Tests the business process: create products → add to print queue → track COGS calculations.
"""
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app import models


class TestPrintJobWorkflow:
    """Test complete print queue business workflows end-to-end."""

    def test_complete_product_creation_and_print_job_workflow(self, client: TestClient, db: Session, auth_headers: dict):
        """Test full workflow: filaments → products → print queue → COGS calculation."""
        
        # Step 1: Create required filaments for multi-filament product
        pla_red_data = {
            "material": "PLA",
            "color": "Red", 
            "brand": "ESUN"
        }
        pla_response = client.post("/filaments", json=pla_red_data, headers=auth_headers)
        assert pla_response.status_code == 201
        pla_filament_id = pla_response.json()["id"]
        
        # Create purchase for PLA to set price and stock
        pla_purchase_data = {
            "filament_id": pla_filament_id,
            "quantity_kg": 2.0,
            "price_per_kg": 25.50
        }
        pla_purchase_response = client.post("/filament_purchases", json=pla_purchase_data, headers=auth_headers)
        assert pla_purchase_response.status_code == 201
        
        petg_blue_data = {
            "material": "PETG",
            "color": "Blue",
            "brand": "Polymaker"
        }
        petg_response = client.post("/filaments", json=petg_blue_data, headers=auth_headers)
        assert petg_response.status_code == 201
        petg_filament_id = petg_response.json()["id"]
        
        # Create purchase for PETG to set price and stock
        petg_purchase_data = {
            "filament_id": petg_filament_id,
            "quantity_kg": 1.5,
            "price_per_kg": 32.00
        }
        petg_purchase_response = client.post("/filament_purchases", json=petg_purchase_data, headers=auth_headers)
        assert petg_purchase_response.status_code == 201
        
        # Step 2: Create printer profile
        printer_data = {
            "name": "Prusa i3 MK3S+",
            "price_eur": 750.00,
            "expected_life_hours": 3 * 8760  # 3 years * 8760 hours/year
        }
        printer_response = client.post("/printer_profiles", json=printer_data, headers=auth_headers)
        assert printer_response.status_code == 201
        printer_id = printer_response.json()["id"]
        
        # Step 3: Create multi-filament product using form data
        filament_usages = [
            {"filament_id": pla_filament_id, "grams_used": 45.5},
            {"filament_id": petg_filament_id, "grams_used": 23.2}
        ]
        
        product_form_data = {
            "name": "Multi-Color Phone Case",
            "print_time_hrs": 2.5,
            "filament_usages": json.dumps(filament_usages)
        }
        
        product_response = client.post("/products", data=product_form_data, headers=auth_headers)
        assert product_response.status_code == 200
        product_data = product_response.json()
        product_id = product_data["id"]
        
        # Verify product created with correct filament usages
        assert product_data["name"] == "Multi-Color Phone Case"
        assert product_data["print_time_hrs"] == 2.5
        assert len(product_data["filament_usages"]) == 2
        
        # Step 4: Add product to print queue
        job_data = {
            "name": "Batch Order #001",
            "products": [
                {"product_id": product_id, "items_qty": 10}
            ],
            "printers": [
                {"printer_profile_id": printer_id, "printers_qty": 1}
            ],
            "packaging_cost_eur": 5.00,
            "status": "pending"
        }
        job_response = client.post("/print_jobs", json=job_data, headers=auth_headers)
        assert job_response.status_code == 201
        job_id = job_response.json()["id"]
        
        # Step 5: Verify COGS calculation
        job_detail_response = client.get(f"/print_jobs/{job_id}", headers=auth_headers)
        assert job_detail_response.status_code == 200
        job_detail = job_detail_response.json()
        
        # Verify COGS components are calculated
        assert job_detail["calculated_cogs_eur"] > 0
        
        # Expected calculations:
        # Filament cost per unit: (45.5g * €25.50/kg + 23.2g * €32.00/kg) / 1000 = €1.903
        # Total filament cost: €1.903 * 10 units = €19.03
        # Printer cost: (€750 / (3 * 8760) hrs) * 25 hrs = €0.714
        # Packaging cost: €5.00
        # Expected total COGS ≈ €24.74
        
        expected_filament_cost = ((45.5 * 25.50 + 23.2 * 32.00) / 1000) * 10
        expected_printer_cost = (750 / (3 * 8760)) * 25.0
        expected_packaging = 5.00
        expected_total = expected_filament_cost + expected_printer_cost + expected_packaging
        
        assert abs(job_detail["calculated_cogs_eur"] - expected_total) < 0.1

        # Step 6: Verify inventory was deducted
        # Check PLA filament stock was reduced
        pla_updated_response = client.get(f"/filaments/{pla_filament_id}", headers=auth_headers)
        pla_updated = pla_updated_response.json()
        expected_pla_remaining = 2.0 - (45.5 * 10 / 1000)  # 2.0 - 0.455 = 1.545
        assert abs(pla_updated["total_qty_kg"] - expected_pla_remaining) < 0.001

        # Check PETG filament stock was reduced
        petg_updated_response = client.get(f"/filaments/{petg_filament_id}", headers=auth_headers)
        petg_updated = petg_updated_response.json()
        expected_petg_remaining = 1.5 - (23.2 * 10 / 1000)  # 1.5 - 0.232 = 1.268
        assert abs(petg_updated["total_qty_kg"] - expected_petg_remaining) < 0.001

    def test_product_creation_with_file_upload(self, client: TestClient, db: Session, auth_headers: dict):
        """Test product creation with STL model file upload."""
        
        # Create filament first
        filament_data = {
            "material": "ABS",
            "color": "Black",
            "brand": "Hatchbox"
        }
        filament_response = client.post("/filaments", json=filament_data, headers=auth_headers)
        assert filament_response.status_code == 201
        filament_id = filament_response.json()["id"]
        
        # Create purchase to set price and stock
        purchase_data = {
            "filament_id": filament_id,
            "quantity_kg": 1.0,
            "price_per_kg": 28.00
        }
        purchase_response = client.post("/filament_purchases", json=purchase_data, headers=auth_headers)
        assert purchase_response.status_code == 201
        
        # Create product with mock STL file
        filament_usages = [{"filament_id": filament_id, "grams_used": 15.8}]
        
        # Simulate STL file upload
        mock_stl_content = b"solid mock_stl\nfacet normal 0 0 1\n  outer loop\n    vertex 0 0 0\n    vertex 1 0 0\n    vertex 0 1 0\n  endloop\nendfacet\nendsolid"
        
        files = {"file": ("test_model.stl", mock_stl_content, "application/octet-stream")}
        data = {
            "name": "Custom Bracket",
            "print_time_hrs": 1.2,
            "filament_usages": json.dumps(filament_usages)
        }
        
        response = client.post("/products", data=data, files=files, headers=auth_headers)
        assert response.status_code == 200
        
        product_data = response.json()
        assert product_data["name"] == "Custom Bracket"
        assert product_data["file_path"] is not None
        assert product_data["file_path"].endswith(".stl")

    def test_print_job_status_progression(self, client: TestClient, db: Session, auth_headers: dict):
        """Test print queue entry status changes through the workflow."""
        
        # Create minimal setup for print queue entry
        filament_data = {"material": "PLA", "color": "White", "brand": "eSUN"}
        filament_response = client.post("/filaments", json=filament_data, headers=auth_headers)
        assert filament_response.status_code == 201
        filament_id = filament_response.json()["id"]
        
        # Create purchase
        purchase_data = {
            "filament_id": filament_id,
            "quantity_kg": 1.0,
            "price_per_kg": 24.00
        }
        purchase_response = client.post("/filament_purchases", json=purchase_data, headers=auth_headers)
        assert purchase_response.status_code == 201
        
        product_data = {
            "name": "Status Test Product",
            "print_time_hrs": 1.0,
            "filament_usages": json.dumps([{"filament_id": filament_id, "grams_used": 10.0}])
        }
        product_response = client.post("/products", data=product_data, headers=auth_headers)
        assert product_response.status_code == 200
        product_id = product_response.json()["id"]
        
        printer_data = {"name": "Test Printer", "price_eur": 500.00, "expected_life_hours": 2 * 8760}
        printer_response = client.post("/printer_profiles", json=printer_data, headers=auth_headers)
        assert printer_response.status_code == 201
        printer_id = printer_response.json()["id"]
        
        # Add to print queue
        job_data = {
            "name": "Status Test Job",
            "products": [{"product_id": product_id, "items_qty": 1}],
            "printers": [{"printer_profile_id": printer_id, "printers_qty": 1, "hours_each": 1.0}],
            "packaging_cost_eur": 0.0,
            "status": "pending"
        }
        response = client.post("/print_jobs", json=job_data, headers=auth_headers)
        assert response.status_code == 201
        job_id = response.json()["id"]
        
        # Verify initial status
        job_response = client.get(f"/print_jobs/{job_id}", headers=auth_headers)
        assert job_response.status_code == 200
        assert job_response.json()["status"] == "pending"
        
        # Update status to in_progress
        status_data = {"status": "in_progress"}
        update_response = client.patch(f"/print_jobs/{job_id}", json=status_data, headers=auth_headers)
        assert update_response.status_code == 200
        assert update_response.json()["status"] == "in_progress"
        
        # Update status to completed
        status_data = {"status": "completed"}
        update_response = client.patch(f"/print_jobs/{job_id}", json=status_data, headers=auth_headers)
        assert update_response.status_code == 200
        assert update_response.json()["status"] == "completed"

    def test_complex_multi_product_print_job(self, client: TestClient, db: Session, auth_headers: dict):
        """Test print queue entry with multiple different products."""
        
        # Create multiple filaments
        filament1_data = {"material": "PLA", "color": "White", "brand": "eSUN"}
        filament2_data = {"material": "PETG", "color": "Clear", "brand": "Polymaker"}
        
        f1_response = client.post("/filaments", json=filament1_data, headers=auth_headers)
        f2_response = client.post("/filaments", json=filament2_data, headers=auth_headers)
        assert f1_response.status_code == 201
        assert f2_response.status_code == 201
        
        filament1_id = f1_response.json()["id"]
        filament2_id = f2_response.json()["id"]
        
        # Create purchases
        purchase1_data = {
            "filament_id": filament1_id,
            "quantity_kg": 1.0,
            "price_per_kg": 24.00
        }
        purchase2_data = {
            "filament_id": filament2_id,
            "quantity_kg": 0.8,
            "price_per_kg": 35.00
        }
        
        p1_purchase = client.post("/filament_purchases", json=purchase1_data, headers=auth_headers)
        p2_purchase = client.post("/filament_purchases", json=purchase2_data, headers=auth_headers)
        assert p1_purchase.status_code == 201
        assert p2_purchase.status_code == 201
        
        # Create multiple products
        product1_data = {
            "name": "Widget A",
            "print_time_hrs": 1.0,
            "filament_usages": json.dumps([{"filament_id": filament1_id, "grams_used": 20.0}])
        }
        product2_data = {
            "name": "Widget B", 
            "print_time_hrs": 1.5,
            "filament_usages": json.dumps([{"filament_id": filament2_id, "grams_used": 35.0}])
        }
        
        p1_response = client.post("/products", data=product1_data, headers=auth_headers)
        p2_response = client.post("/products", data=product2_data, headers=auth_headers)
        assert p1_response.status_code == 200
        assert p2_response.status_code == 200
        
        product1_id = p1_response.json()["id"]
        product2_id = p2_response.json()["id"]
        
        # Create printer profile
        printer_data = {"name": "Multi Printer", "price_eur": 500.00, "expected_life_hours": 2 * 8760}
        printer_response = client.post("/printer_profiles", json=printer_data, headers=auth_headers)
        assert printer_response.status_code == 201
        printer_id = printer_response.json()["id"]
        
        # Add multiple products to print queue
        job_data = {
            "name": "Multi-Product Job",
            "products": [
                {"product_id": product1_id, "items_qty": 5},
                {"product_id": product2_id, "items_qty": 3}
            ],
            "printers": [
                {"printer_profile_id": printer_id, "printers_qty": 1, "hours_each": 9.5}  # (1.0 * 5) + (1.5 * 3)
            ],
            "packaging_cost_eur": 2.50,
            "status": "pending"
        }
        job_response = client.post("/print_jobs", json=job_data, headers=auth_headers)
        assert job_response.status_code == 201
        job_id = job_response.json()["id"]
        
        # Verify final job details
        final_response = client.get(f"/print_jobs/{job_id}", headers=auth_headers)
        assert final_response.status_code == 200
        
        job_detail = final_response.json()
        assert len(job_detail["products"]) == 2
        assert len(job_detail["printers"]) == 1
        assert job_detail["calculated_cogs_eur"] > 0
        
        # Verify each product line exists with correct quantities
        product_items = {item["product_id"]: item["items_qty"] for item in job_detail["products"]}
        assert product_items[product1_id] == 5
        assert product_items[product2_id] == 3

    def test_print_job_cogs_with_packaging_cost(self, client: TestClient, db: Session, auth_headers: dict):
        """Test COGS calculation including packaging costs."""
        
        # Create minimal setup
        filament_data = {"material": "PLA", "color": "Green", "brand": "eSUN"}
        filament_response = client.post("/filaments", json=filament_data, headers=auth_headers)
        assert filament_response.status_code == 201
        filament_id = filament_response.json()["id"]
        
        # Create purchase
        purchase_data = {
            "filament_id": filament_id,
            "quantity_kg": 1.0,
            "price_per_kg": 26.00
        }
        purchase_response = client.post("/filament_purchases", json=purchase_data, headers=auth_headers)
        assert purchase_response.status_code == 201
        
        product_data = {
            "name": "Simple Part",
            "print_time_hrs": 0.5,
            "filament_usages": json.dumps([{"filament_id": filament_id, "grams_used": 12.0}])
        }
        product_response = client.post("/products", data=product_data, headers=auth_headers)
        assert product_response.status_code == 200
        product_id = product_response.json()["id"]
        
        printer_data = {"name": "Budget Printer", "price_eur": 300.00, "expected_life_hours": 2 * 8760}
        printer_response = client.post("/printer_profiles", json=printer_data, headers=auth_headers)
        assert printer_response.status_code == 201
        printer_id = printer_response.json()["id"]
        
        # Create job with packaging cost
        job_data = {
            "name": "Packaged Order",
            "products": [{"product_id": product_id, "items_qty": 1}],
            "printers": [{"printer_profile_id": printer_id, "printers_qty": 1, "hours_each": 0.5}],
            "packaging_cost_eur": 2.50,
            "status": "pending"
        }
        job_response = client.post("/print_jobs", json=job_data, headers=auth_headers)
        assert job_response.status_code == 201
        job_id = job_response.json()["id"]
        
        # Verify packaging cost is included in COGS
        job_detail_response = client.get(f"/print_jobs/{job_id}", headers=auth_headers)
        job_detail = job_detail_response.json()
        
        assert job_detail["packaging_cost_eur"] == 2.50
        # Total COGS should include filament + printer + packaging
        expected_filament_cost = (12.0 * 26.00) / 1000  # €0.312
        expected_printer_cost = (300 / (2 * 8760)) * 0.5   # €0.0171
        expected_total = expected_filament_cost + expected_printer_cost + 2.50
        
        assert abs(job_detail["calculated_cogs_eur"] - expected_total) < 0.01

    def test_insufficient_inventory_prevents_print_job(self, client: TestClient, db: Session, auth_headers: dict):
        """Test that print queue entries are rejected when there's insufficient filament inventory."""
        
        # Create filament with limited stock
        filament_data = {"material": "TPU", "color": "Flex Black", "brand": "NinjaFlex"}  # Only 100g
        filament_response = client.post("/filaments", json=filament_data, headers=auth_headers)
        assert filament_response.status_code == 201
        filament_id = filament_response.json()["id"]
        
        # Create purchase with limited stock
        purchase_data = {
            "filament_id": filament_id,
            "quantity_kg": 0.1,
            "price_per_kg": 45.00
        }
        purchase_response = client.post("/filament_purchases", json=purchase_data, headers=auth_headers)
        assert purchase_response.status_code == 201
        
        # Create product that requires 150g (more than available)
        product_data = {
            "name": "High Usage Product",
            "print_time_hrs": 2.0,
            "filament_usages": json.dumps([{"filament_id": filament_id, "grams_used": 150.0}])
        }
        product_response = client.post("/products", data=product_data, headers=auth_headers)
        assert product_response.status_code == 200
        product_id = product_response.json()["id"]
        
        printer_data = {"name": "Test Printer", "price_eur": 500.00, "expected_life_hours": 2 * 8760}
        printer_response = client.post("/printer_profiles", json=printer_data, headers=auth_headers)
        assert printer_response.status_code == 201
        printer_id = printer_response.json()["id"]
        
        # Attempt to add to print queue - should fail
        job_data = {
            "name": "Impossible Job",
            "products": [{"product_id": product_id, "items_qty": 1}],
            "printers": [{"printer_profile_id": printer_id, "printers_qty": 1, "hours_each": 2.0}],
            "packaging_cost_eur": 0.0,
            "status": "pending"
        }
        
        response = client.post("/print_jobs", json=job_data, headers=auth_headers)
        assert response.status_code == 400
        error_detail = response.json()["detail"]
        assert "Insufficient filament inventory" in error_detail["message"]
        
        # Verify inventory wasn't changed
        filament_check_response = client.get(f"/filaments/{filament_id}", headers=auth_headers)
        assert filament_check_response.json()["total_qty_kg"] == 0.1

    def test_print_job_deletion_restores_inventory(self, client: TestClient, db: Session, auth_headers: dict):
        """Test that deleting print queue entries restores consumed filament inventory."""
        
        # Create filament with known stock
        initial_stock = 1.0  # 1 kg
        filament_data = {"material": "ABS", "color": "Yellow", "brand": "Sunlu"}
        filament_response = client.post("/filaments", json=filament_data, headers=auth_headers)
        assert filament_response.status_code == 201
        filament_id = filament_response.json()["id"]
        
        # Create purchase
        purchase_data = {
            "filament_id": filament_id,
            "quantity_kg": initial_stock,
            "price_per_kg": 30.00
        }
        purchase_response = client.post("/filament_purchases", json=purchase_data, headers=auth_headers)
        assert purchase_response.status_code == 201
        
        # Create product that uses 200g of filament
        grams_used = 200.0
        product_data = {
            "name": "Deletable Part",
            "print_time_hrs": 3.0,
            "filament_usages": json.dumps([{"filament_id": filament_id, "grams_used": grams_used}])
        }
        product_response = client.post("/products", data=product_data, headers=auth_headers)
        assert product_response.status_code == 200
        product_id = product_response.json()["id"]
        
        printer_data = {"name": "Delete Test Printer", "price_eur": 400.00, "expected_life_hours": 2 * 8760}
        printer_response = client.post("/printer_profiles", json=printer_data, headers=auth_headers)
        assert printer_response.status_code == 201
        printer_id = printer_response.json()["id"]
        
        # Add to print queue
        job_data = {
            "name": "To Be Deleted",
            "products": [{"product_id": product_id, "items_qty": 2}],  # 2 items = 400g total
            "printers": [{"printer_profile_id": printer_id, "printers_qty": 1, "hours_each": 6.0}],
            "packaging_cost_eur": 1.00,
            "status": "pending"
        }
        job_response = client.post("/print_jobs", json=job_data, headers=auth_headers)
        assert job_response.status_code == 201
        job_id = job_response.json()["id"]
        
        # Verify filament stock was reduced
        filament_check_response = client.get(f"/filaments/{filament_id}", headers=auth_headers)
        reduced_stock = filament_check_response.json()["total_qty_kg"]
        expected_after_consumption = initial_stock - (grams_used * 2 / 1000)  # 1.0 - 0.4 = 0.6
        assert abs(reduced_stock - expected_after_consumption) < 0.001
        
        # Delete the print queue entry
        delete_response = client.delete(f"/print_jobs/{job_id}", headers=auth_headers)
        assert delete_response.status_code == 204
        
        # Verify stock was restored
        filament_restored_response = client.get(f"/filaments/{filament_id}", headers=auth_headers)
        restored_stock = filament_restored_response.json()["total_qty_kg"]
        assert abs(restored_stock - initial_stock) < 0.001  # Should be back to 1.0 kg
        
        # Verify job was actually deleted
        job_check_response = client.get(f"/print_jobs/{job_id}", headers=auth_headers)
        assert job_check_response.status_code == 404