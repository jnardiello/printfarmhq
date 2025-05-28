"""
Tests for plate-based product structure functionality.
"""

import pytest
import json
import tempfile
import os
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.models import Product, Plate, PlateFilamentUsage, Filament, User
from app.database import SessionLocal
from .conftest import test_db, authenticated_client


class TestPlateModel:
    """Test the Plate model functionality."""
    
    def test_plate_cost_calculation(self, test_db: Session):
        """Test that plate cost is calculated correctly."""
        # Create test filaments
        filament1 = Filament(color="Red", brand="ESUN", material="PLA", price_per_kg=25.0)
        filament2 = Filament(color="Blue", brand="ESUN", material="PLA", price_per_kg=30.0)
        test_db.add_all([filament1, filament2])
        test_db.flush()
        
        # Create test product
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0)
        test_db.add(product)
        test_db.flush()
        
        # Create test plate
        plate = Plate(product_id=product.id, name="Base", quantity=2, print_time_hrs=1.5)
        test_db.add(plate)
        test_db.flush()
        
        # Create filament usages for the plate
        usage1 = PlateFilamentUsage(plate_id=plate.id, filament_id=filament1.id, grams_used=50.0)  # €1.25
        usage2 = PlateFilamentUsage(plate_id=plate.id, filament_id=filament2.id, grams_used=30.0)  # €0.90
        test_db.add_all([usage1, usage2])
        test_db.commit()
        
        # Refresh to get relationships
        test_db.refresh(plate)
        
        # Test plate cost calculation
        # (50g/1000 * €25) + (30g/1000 * €30) = €1.25 + €0.90 = €2.15 per plate
        # 2 plates * €2.15 = €4.30
        assert plate.cost == 4.30


class TestPlateAPI:
    """Test plate-related API endpoints."""
    
    def test_create_plate(self, authenticated_client: TestClient, test_db: Session):
        """Test creating a new plate."""
        # Create test filament
        filament = Filament(color="Red", brand="ESUN", material="PLA", price_per_kg=25.0)
        test_db.add(filament)
        test_db.flush()
        
        # Create test product
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0)
        test_db.add(product)
        test_db.commit()
        
        # Create plate data
        plate_data = {
            "name": "Base",
            "quantity": "1",
            "print_time_hrs": "1.5",
            "filament_usages": json.dumps([
                {"filament_id": filament.id, "grams_used": 50.0}
            ])
        }
        
        response = authenticated_client.post(f"/products/{product.id}/plates", data=plate_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "Base"
        assert data["quantity"] == 1
        assert len(data["filament_usages"]) == 1
        assert data["filament_usages"][0]["grams_used"] == 50.0
    
    def test_create_plate_with_file(self, authenticated_client: TestClient, test_db: Session):
        """Test creating a plate with a model file."""
        # Create test filament and product
        filament = Filament(color="Red", brand="ESUN", material="PLA", price_per_kg=25.0)
        test_db.add(filament)
        test_db.flush()
        
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0)
        test_db.add(product)
        test_db.commit()
        
        # Create temporary STL file
        with tempfile.NamedTemporaryFile(suffix=".stl", delete=False) as tmp_file:
            tmp_file.write(b"fake stl content")
            tmp_file_path = tmp_file.name
        
        try:
            with open(tmp_file_path, "rb") as file:
                plate_data = {
                    "name": "Base",
                    "quantity": "1",
                    "filament_usages": json.dumps([
                        {"filament_id": filament.id, "grams_used": 50.0}
                    ])
                }
                files = {"file": ("test.stl", file, "application/octet-stream")}
                
                response = authenticated_client.post(
                    f"/products/{product.id}/plates", 
                    data=plate_data,
                    files=files
                )
                assert response.status_code == 200
                
                data = response.json()
                assert data["file_path"] is not None
                assert data["file_path"].endswith(".stl")
        finally:
            os.unlink(tmp_file_path)
    
    def test_list_plates(self, authenticated_client: TestClient, test_db: Session):
        """Test listing plates for a product."""
        # Create test data
        filament = Filament(color="Red", brand="ESUN", material="PLA", price_per_kg=25.0)
        test_db.add(filament)
        test_db.flush()
        
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0)
        test_db.add(product)
        test_db.flush()
        
        plate1 = Plate(product_id=product.id, name="Base", quantity=1, print_time_hrs=1.0)
        plate2 = Plate(product_id=product.id, name="Top", quantity=2, print_time_hrs=0.8)
        test_db.add_all([plate1, plate2])
        test_db.flush()
        
        usage1 = PlateFilamentUsage(plate_id=plate1.id, filament_id=filament.id, grams_used=50.0)
        usage2 = PlateFilamentUsage(plate_id=plate2.id, filament_id=filament.id, grams_used=30.0)
        test_db.add_all([usage1, usage2])
        test_db.commit()
        
        response = authenticated_client.get(f"/products/{product.id}/plates")
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 2
        assert data[0]["name"] in ["Base", "Top"]
        assert data[1]["name"] in ["Base", "Top"]
    
    def test_get_plate(self, authenticated_client: TestClient, test_db: Session):
        """Test getting a specific plate."""
        # Create test data
        filament = Filament(color="Red", brand="ESUN", material="PLA", price_per_kg=25.0)
        test_db.add(filament)
        test_db.flush()
        
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0)
        test_db.add(product)
        test_db.flush()
        
        plate = Plate(product_id=product.id, name="Base", quantity=1, print_time_hrs=1.2)
        test_db.add(plate)
        test_db.flush()
        
        usage = PlateFilamentUsage(plate_id=plate.id, filament_id=filament.id, grams_used=50.0)
        test_db.add(usage)
        test_db.commit()
        
        response = authenticated_client.get(f"/plates/{plate.id}")
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "Base"
        assert data["quantity"] == 1
        assert len(data["filament_usages"]) == 1
    
    def test_update_plate(self, authenticated_client: TestClient, test_db: Session):
        """Test updating a plate."""
        # Create test data
        filament1 = Filament(color="Red", brand="ESUN", material="PLA", price_per_kg=25.0)
        filament2 = Filament(color="Blue", brand="ESUN", material="PLA", price_per_kg=30.0)
        test_db.add_all([filament1, filament2])
        test_db.flush()
        
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0)
        test_db.add(product)
        test_db.flush()
        
        plate = Plate(product_id=product.id, name="Base", quantity=1)
        test_db.add(plate)
        test_db.flush()
        
        usage = PlateFilamentUsage(plate_id=plate.id, filament_id=filament1.id, grams_used=50.0)
        test_db.add(usage)
        test_db.commit()
        
        # Update plate
        update_data = {
            "name": "Updated Base",
            "quantity": "2",
            "filament_usages": json.dumps([
                {"filament_id": filament2.id, "grams_used": 75.0}
            ])
        }
        
        response = authenticated_client.patch(f"/plates/{plate.id}", data=update_data)
        assert response.status_code == 200
        
        data = response.json()
        assert data["name"] == "Updated Base"
        assert data["quantity"] == 2
        assert len(data["filament_usages"]) == 1
        assert data["filament_usages"][0]["filament_id"] == filament2.id
    
    def test_delete_plate(self, authenticated_client: TestClient, test_db: Session):
        """Test deleting a plate."""
        # Create test data with multiple plates
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0)
        test_db.add(product)
        test_db.flush()
        
        plate1 = Plate(product_id=product.id, name="Base", quantity=1)
        plate2 = Plate(product_id=product.id, name="Top", quantity=1)
        test_db.add_all([plate1, plate2])
        test_db.commit()
        
        response = authenticated_client.delete(f"/plates/{plate1.id}")
        assert response.status_code == 200
        
        # Verify plate was deleted
        response = authenticated_client.get(f"/plates/{plate1.id}")
        assert response.status_code == 404
    
    def test_delete_last_plate_fails(self, authenticated_client: TestClient, test_db: Session):
        """Test that deleting the last plate fails."""
        # Create test data with only one plate
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0)
        test_db.add(product)
        test_db.flush()
        
        plate = Plate(product_id=product.id, name="Base", quantity=1)
        test_db.add(plate)
        test_db.commit()
        
        response = authenticated_client.delete(f"/plates/{plate.id}")
        assert response.status_code == 400
        assert "Cannot delete the last plate" in response.json()["detail"]


class TestProductCOPCalculation:
    """Test that product COP calculation works with plates."""
    
    def test_product_cop_with_plates(self, test_db: Session):
        """Test product COP calculation with plate-based structure."""
        # Create test filaments
        filament1 = Filament(color="Red", brand="ESUN", material="PLA", price_per_kg=25.0)
        filament2 = Filament(color="Blue", brand="ESUN", material="PLA", price_per_kg=30.0)
        test_db.add_all([filament1, filament2])
        test_db.flush()
        
        # Create test product
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0)
        test_db.add(product)
        test_db.flush()
        
        # Create plates
        plate1 = Plate(product_id=product.id, name="Base", quantity=1)
        plate2 = Plate(product_id=product.id, name="Top", quantity=2)
        test_db.add_all([plate1, plate2])
        test_db.flush()
        
        # Create filament usages
        usage1 = PlateFilamentUsage(plate_id=plate1.id, filament_id=filament1.id, grams_used=50.0)  # €1.25 * 1 = €1.25
        usage2 = PlateFilamentUsage(plate_id=plate2.id, filament_id=filament2.id, grams_used=30.0)  # €0.90 * 2 = €1.80
        test_db.add_all([usage1, usage2])
        test_db.commit()
        
        # Refresh to get relationships
        test_db.refresh(product)
        
        # Test product COP calculation
        # Plate 1: €1.25, Plate 2: €1.80, Total: €3.05
        assert product.cop == 3.05
    
    def test_product_cop_fallback_to_legacy(self, test_db: Session):
        """Test product COP falls back to legacy calculation when no plates exist."""
        # Create test filament
        filament = Filament(color="Red", brand="ESUN", material="PLA", price_per_kg=25.0)
        test_db.add(filament)
        test_db.flush()
        
        # Create test product with legacy filament usage
        from app.models import FilamentUsage
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0)
        test_db.add(product)
        test_db.flush()
        
        # Create legacy filament usage
        usage = FilamentUsage(product_id=product.id, filament_id=filament.id, grams_used=50.0)
        test_db.add(usage)
        test_db.commit()
        
        # Refresh to get relationships
        test_db.refresh(product)
        
        # Test legacy COP calculation
        # 50g/1000 * €25 = €1.25
        assert product.cop == 1.25


class TestValidation:
    """Test validation and error handling."""
    
    def test_create_plate_invalid_filament(self, authenticated_client: TestClient, test_db: Session):
        """Test creating plate with invalid filament ID."""
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0)
        test_db.add(product)
        test_db.commit()
        
        plate_data = {
            "name": "Base",
            "quantity": "1",
            "filament_usages": json.dumps([
                {"filament_id": 99999, "grams_used": 50.0}  # Non-existent filament
            ])
        }
        
        response = authenticated_client.post(f"/products/{product.id}/plates", data=plate_data)
        assert response.status_code == 400
        assert "not found" in response.json()["detail"]
    
    def test_create_plate_invalid_product(self, authenticated_client: TestClient, test_db: Session):
        """Test creating plate for non-existent product."""
        filament = Filament(color="Red", brand="ESUN", material="PLA", price_per_kg=25.0)
        test_db.add(filament)
        test_db.commit()
        
        plate_data = {
            "name": "Base",
            "quantity": "1",
            "filament_usages": json.dumps([
                {"filament_id": filament.id, "grams_used": 50.0}
            ])
        }
        
        response = authenticated_client.post("/products/99999/plates", data=plate_data)
        assert response.status_code == 404
        assert "Product not found" in response.json()["detail"]
    
    def test_create_plate_invalid_file_type(self, authenticated_client: TestClient, test_db: Session):
        """Test creating plate with invalid file type."""
        filament = Filament(color="Red", brand="ESUN", material="PLA", price_per_kg=25.0)
        test_db.add(filament)
        test_db.flush()
        
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0)
        test_db.add(product)
        test_db.commit()
        
        # Create temporary invalid file
        with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as tmp_file:
            tmp_file.write(b"not a 3d model")
            tmp_file_path = tmp_file.name
        
        try:
            with open(tmp_file_path, "rb") as file:
                plate_data = {
                    "name": "Base",
                    "quantity": "1",
                    "filament_usages": json.dumps([
                        {"filament_id": filament.id, "grams_used": 50.0}
                    ])
                }
                files = {"file": ("test.txt", file, "text/plain")}
                
                response = authenticated_client.post(
                    f"/products/{product.id}/plates", 
                    data=plate_data,
                    files=files
                )
                assert response.status_code == 400
                assert "Invalid model file type" in response.json()["detail"]
        finally:
            os.unlink(tmp_file_path)
    
    def test_product_total_print_time_calculation(self, test_db: Session):
        """Test product total print time calculation with plate-based structure."""
        # Create test product
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.0)
        test_db.add(product)
        test_db.flush()
        
        # Create plates with different print times
        plate1 = Plate(product_id=product.id, name="Base", quantity=1, print_time_hrs=1.5)
        plate2 = Plate(product_id=product.id, name="Top", quantity=2, print_time_hrs=0.8)
        test_db.add_all([plate1, plate2])
        test_db.commit()
        test_db.refresh(product)
        
        # Test total print time calculation
        # Plate1: 1.5h * 1 = 1.5h
        # Plate2: 0.8h * 2 = 1.6h
        # Total: 1.5h + 1.6h = 3.1h
        assert product.total_print_time_hrs == 3.1
        
    def test_product_total_print_time_fallback_to_legacy(self, test_db: Session):
        """Test product total print time falls back to legacy when no plates exist."""
        # Create test product with no plates
        product = Product(name="Test Product", sku="TEST-001", print_time_hrs=2.5)
        test_db.add(product)
        test_db.commit()
        test_db.refresh(product)
        
        # Test fallback to legacy print_time_hrs
        assert product.total_print_time_hrs == 2.5