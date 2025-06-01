"""
Tests for product functionality without using plates.
Ensures that products work correctly with direct filament relationships.
"""
import json
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app import models


class TestProductWithoutPlates:
    """Test products using direct filament relationships (no plates)."""

    def test_create_product_with_direct_filament_usage(self, client: TestClient, db: Session, auth_headers: dict):
        """Test creating a product with direct filament usage (no plates)."""
        
        # Create a filament first
        filament_data = {
            "material": "PLA",
            "color": "Red",
            "brand": "TestBrand"
        }
        filament_response = client.post("/filaments", json=filament_data, headers=auth_headers)
        assert filament_response.status_code == 201
        filament_id = filament_response.json()["id"]
        
        # Add inventory to the filament
        purchase_data = {
            "filament_id": filament_id,
            "quantity_kg": 5.0,
            "price_per_kg": 20.0
        }
        purchase_response = client.post("/filament_purchases", json=purchase_data, headers=auth_headers)
        assert purchase_response.status_code == 201
        
        # Create product with direct filament usage
        product_data = {
            "name": "Test Product Without Plates",
            "print_time": "2h30m",  # Using flexible time format
            "filament_usages": json.dumps([
                {"filament_id": filament_id, "grams_used": 150.5}
            ])
        }
        
        response = client.post("/products", data=product_data, headers=auth_headers)
        assert response.status_code == 200
        
        product = response.json()
        assert product["name"] == "Test Product Without Plates"
        assert product["print_time_hrs"] == 2.5
        assert product["print_time_formatted"] == "2h30m"
        assert len(product["filament_usages"]) == 1
        assert product["filament_usages"][0]["grams_used"] == 150.5
        
        # Verify COP calculation works
        assert product["cop"] == pytest.approx((150.5 / 1000) * 20.0, rel=0.01)

    def test_create_product_with_multiple_filaments(self, client: TestClient, db: Session, auth_headers: dict):
        """Test creating a product with multiple filament usages."""
        
        # Create two filaments
        filament1_data = {"material": "PLA", "color": "Red", "brand": "Brand1"}
        filament1_response = client.post("/filaments", json=filament1_data, headers=auth_headers)
        assert filament1_response.status_code == 201
        filament1_id = filament1_response.json()["id"]
        
        filament2_data = {"material": "PETG", "color": "Blue", "brand": "Brand2"}
        filament2_response = client.post("/filaments", json=filament2_data, headers=auth_headers)
        assert filament2_response.status_code == 201
        filament2_id = filament2_response.json()["id"]
        
        # Add inventory
        for fid, price in [(filament1_id, 20.0), (filament2_id, 25.0)]:
            purchase_data = {
                "filament_id": fid,
                "quantity_kg": 5.0,
                "price_per_kg": price
            }
            client.post("/filament_purchases", json=purchase_data, headers=auth_headers)
        
        # Create product with multiple filaments
        product_data = {
            "name": "Multi-Filament Product",
            "print_time": "4h",
            "filament_usages": json.dumps([
                {"filament_id": filament1_id, "grams_used": 100},
                {"filament_id": filament2_id, "grams_used": 200}
            ])
        }
        
        response = client.post("/products", data=product_data, headers=auth_headers)
        assert response.status_code == 200
        
        product = response.json()
        assert product["name"] == "Multi-Filament Product"
        assert product["print_time_hrs"] == 4.0
        assert product["print_time_formatted"] == "4h"
        assert len(product["filament_usages"]) == 2
        
        # Verify COP calculation with multiple filaments
        expected_cop = (100 / 1000) * 20.0 + (200 / 1000) * 25.0
        assert product["cop"] == pytest.approx(expected_cop, rel=0.01)

    def test_update_product_basic_fields(self, client: TestClient, db: Session, auth_headers: dict):
        """Test updating product basic fields (name, print_time, license)."""
        
        # Create a filament and product first
        filament_data = {"material": "PLA", "color": "Green", "brand": "TestBrand"}
        filament_response = client.post("/filaments", json=filament_data, headers=auth_headers)
        filament_id = filament_response.json()["id"]
        
        # Add inventory
        purchase_data = {
            "filament_id": filament_id,
            "quantity_kg": 5.0,
            "price_per_kg": 22.0
        }
        client.post("/filament_purchases", json=purchase_data, headers=auth_headers)
        
        # Create product
        product_data = {
            "name": "Original Product",
            "print_time": "1h",
            "filament_usages": json.dumps([
                {"filament_id": filament_id, "grams_used": 50}
            ])
        }
        
        create_response = client.post("/products", data=product_data, headers=auth_headers)
        assert create_response.status_code == 200
        product_id = create_response.json()["id"]
        
        # Update product
        update_data = {
            "name": "Updated Product Name",
            "print_time_hrs": "1.5"  # 1h30m in decimal
        }
        
        update_response = client.patch(f"/products/{product_id}", data=update_data, headers=auth_headers)
        assert update_response.status_code == 200
        
        updated_product = update_response.json()
        assert updated_product["name"] == "Updated Product Name"
        assert updated_product["print_time_hrs"] == 1.5
        assert updated_product["print_time_formatted"] == "1h30m"
        
        # Verify filament usages are unchanged
        assert len(updated_product["filament_usages"]) == 1
        assert updated_product["filament_usages"][0]["grams_used"] == 50

    def test_print_queue_with_products_using_filament_usages(self, client: TestClient, db: Session, auth_headers: dict):
        """Test that print queue works correctly with products using direct filament usages."""
        
        # Create filament
        filament_data = {"material": "ABS", "color": "Black", "brand": "TestBrand"}
        filament_response = client.post("/filaments", json=filament_data, headers=auth_headers)
        filament_id = filament_response.json()["id"]
        
        # Add inventory
        purchase_data = {
            "filament_id": filament_id,
            "quantity_kg": 10.0,
            "price_per_kg": 30.0
        }
        client.post("/filament_purchases", json=purchase_data, headers=auth_headers)
        
        # Create product
        product_data = {
            "name": "Product for Print Queue",
            "print_time": "3h",
            "filament_usages": json.dumps([
                {"filament_id": filament_id, "grams_used": 250}
            ])
        }
        
        product_response = client.post("/products", data=product_data, headers=auth_headers)
        assert product_response.status_code == 200
        product_id = product_response.json()["id"]
        
        # Create printer
        printer_data = {
            "name": "Test Printer",
            "price_eur": 500.0,
            "expected_life_hours": 10000.0
        }
        printer_response = client.post("/printer_profiles", json=printer_data, headers=auth_headers)
        assert printer_response.status_code == 201
        printer_id = printer_response.json()["id"]
        
        # Create print job
        print_job_data = {
            "products": [{"product_id": product_id, "items_qty": 2}],
            "printers": [{"printer_profile_id": printer_id, "printers_qty": 1, "hours_each": 6.0}],
            "packaging_cost_eur": 1.5
        }
        
        print_job_response = client.post("/print_jobs", json=print_job_data, headers=auth_headers)
        assert print_job_response.status_code == 201
        
        print_job = print_job_response.json()
        
        # Verify COGS calculation
        filament_cost = (250 * 2 / 1000) * 30.0  # 250g * 2 items * price
        printer_cost = (500.0 / 10000.0) * 6.0  # Depreciation
        packaging_cost = 1.5
        expected_cogs = filament_cost + printer_cost + packaging_cost
        
        assert print_job["calculated_cogs_eur"] == pytest.approx(expected_cogs, rel=0.01)
        
        # Verify inventory was deducted
        filament_check = client.get(f"/filaments/{filament_id}", headers=auth_headers)
        updated_filament = filament_check.json()
        assert updated_filament["total_qty_kg"] == pytest.approx(9.5, rel=0.01)  # 10 - 0.5

    def test_product_cop_calculation_without_plates(self, client: TestClient, db: Session, auth_headers: dict):
        """Test that COP calculation works correctly without plates."""
        
        # Create multiple filaments with different prices
        filaments = []
        for i, (material, color, price) in enumerate([
            ("PLA", "White", 18.0),
            ("PETG", "Black", 25.0),
            ("TPU", "Red", 35.0)
        ]):
            filament_data = {"material": material, "color": color, "brand": f"Brand{i}"}
            response = client.post("/filaments", json=filament_data, headers=auth_headers)
            assert response.status_code == 201
            filament_id = response.json()["id"]
            
            # Add inventory
            purchase_data = {
                "filament_id": filament_id,
                "quantity_kg": 5.0,
                "price_per_kg": price
            }
            client.post("/filament_purchases", json=purchase_data, headers=auth_headers)
            
            filaments.append((filament_id, price))
        
        # Create product with multiple filaments
        product_data = {
            "name": "Complex Product",
            "print_time": "5h30m",
            "filament_usages": json.dumps([
                {"filament_id": filaments[0][0], "grams_used": 120},
                {"filament_id": filaments[1][0], "grams_used": 80},
                {"filament_id": filaments[2][0], "grams_used": 50}
            ])
        }
        
        response = client.post("/products", data=product_data, headers=auth_headers)
        assert response.status_code == 200
        
        product = response.json()
        
        # Calculate expected COP
        expected_cop = (
            (120 / 1000) * filaments[0][1] +
            (80 / 1000) * filaments[1][1] +
            (50 / 1000) * filaments[2][1]
        )
        
        assert product["cop"] == pytest.approx(expected_cop, rel=0.01)
        
        # Test the dedicated COP endpoint
        cop_response = client.get(f"/products/{product['id']}/cop", headers=auth_headers)
        assert cop_response.status_code == 200
        assert cop_response.json() == pytest.approx(expected_cop, rel=0.01)

    def test_time_format_variations(self, client: TestClient, db: Session, auth_headers: dict):
        """Test various time format inputs."""
        
        # Create a filament
        filament_data = {"material": "PLA", "color": "Yellow", "brand": "TestBrand"}
        filament_response = client.post("/filaments", json=filament_data, headers=auth_headers)
        filament_id = filament_response.json()["id"]
        
        # Add inventory
        purchase_data = {
            "filament_id": filament_id,
            "quantity_kg": 5.0,
            "price_per_kg": 20.0
        }
        client.post("/filament_purchases", json=purchase_data, headers=auth_headers)
        
        # Test various time formats
        test_cases = [
            ("30m", 0.5, "30m"),
            ("1h", 1.0, "1h"),
            ("1h30m", 1.5, "1h30m"),
            ("2.5", 2.5, "2h30m"),
            ("0.75", 0.75, "45m"),
        ]
        
        for i, (time_input, expected_hours, expected_format) in enumerate(test_cases):
            product_data = {
                "name": f"Product Time Test {i}",
                "print_time": time_input,
                "filament_usages": json.dumps([
                    {"filament_id": filament_id, "grams_used": 50}
                ])
            }
            
            response = client.post("/products", data=product_data, headers=auth_headers)
            assert response.status_code == 200
            
            product = response.json()
            assert product["print_time_hrs"] == expected_hours
            assert product["print_time_formatted"] == expected_format

    def test_product_deletion(self, client: TestClient, db: Session, auth_headers: dict):
        """Test that product deletion works correctly."""
        
        # Create a filament and product
        filament_data = {"material": "PLA", "color": "Orange", "brand": "TestBrand"}
        filament_response = client.post("/filaments", json=filament_data, headers=auth_headers)
        filament_id = filament_response.json()["id"]
        
        # Add inventory
        purchase_data = {
            "filament_id": filament_id,
            "quantity_kg": 5.0,
            "price_per_kg": 20.0
        }
        client.post("/filament_purchases", json=purchase_data, headers=auth_headers)
        
        # Create product
        product_data = {
            "name": "Product to Delete",
            "print_time": "1h",
            "filament_usages": json.dumps([
                {"filament_id": filament_id, "grams_used": 100}
            ])
        }
        
        create_response = client.post("/products", data=product_data, headers=auth_headers)
        assert create_response.status_code == 200
        product_id = create_response.json()["id"]
        
        # Delete the product
        delete_response = client.delete(f"/products/{product_id}", headers=auth_headers)
        assert delete_response.status_code == 204
        
        # Verify product is deleted by checking the list
        products_response = client.get("/products", headers=auth_headers)
        assert products_response.status_code == 200
        products = products_response.json()
        product_ids = [p["id"] for p in products]
        assert product_id not in product_ids
        
        # Verify filament still exists
        filament_check = client.get(f"/filaments/{filament_id}", headers=auth_headers)
        assert filament_check.status_code == 200