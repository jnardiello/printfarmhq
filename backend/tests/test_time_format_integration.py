"""Integration test for time format functionality."""

import json
import pytest
from app.models import Product, Filament


class TestTimeFormatIntegration:
    """Test time format integration with API endpoints."""
    
    @pytest.fixture
    def test_filament(self, db):
        """Create a test filament."""
        filament = Filament(
            color="Black",
            brand="Test Brand", 
            material="PLA",
            price_per_kg=25.0,
            total_qty_kg=1.0
        )
        db.add(filament)
        db.commit()
        db.refresh(filament)
        return filament
    
    def test_create_product_with_new_time_format(self, client, auth_headers, test_filament):
        """Test creating product with new time format."""
        product_data = {
            "name": "Test Product",
            "print_time": "1h30m",
            "filament_usages": json.dumps([{"filament_id": test_filament.id, "grams_used": 25.5}])
        }
        
        response = client.post("/products", data=product_data, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        # Should store as decimal hours
        assert data["print_time_hrs"] == 1.5
        # Should return formatted version
        assert data["print_time_formatted"] == "1h30m"
    
    def test_create_product_with_legacy_format(self, client, auth_headers, test_filament):
        """Test creating product with legacy decimal format."""
        product_data = {
            "name": "Legacy Product",
            "print_time_hrs": 2.25,
            "filament_usages": json.dumps([{"filament_id": test_filament.id, "grams_used": 30.0}])
        }
        
        response = client.post("/products", data=product_data, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["print_time_hrs"] == 2.25
        assert data["print_time_formatted"] == "2h15m"
    
    def test_create_product_invalid_format(self, client, auth_headers, test_filament):
        """Test that invalid time formats are rejected."""
        product_data = {
            "name": "Invalid Product",
            "print_time": "invalid_format",
            "filament_usages": json.dumps([{"filament_id": test_filament.id, "grams_used": 25.0}])
        }
        
        response = client.post("/products", data=product_data, headers=auth_headers)
        
        assert response.status_code == 422
        error_data = response.json()
        assert "Invalid time format" in str(error_data["detail"])
    
    def test_create_plate_with_new_time_format(self, client, auth_headers, test_filament, db):
        """Test creating plate with new time format."""
        # First create a product
        product = Product(
            sku="PLATE-TEST",
            name="Product for Plates",
            print_time_hrs=2.0,
            filament_weight_g=50.0
        )
        db.add(product)
        db.commit()
        db.refresh(product)
        
        plate_data = {
            "name": "Base Plate",
            "quantity": 1,
            "print_time": "45m",
            "filament_usages": json.dumps([{"filament_id": test_filament.id, "grams_used": 15.0}])
        }
        
        response = client.post(f"/products/{product.id}/plates", data=plate_data, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["print_time_hrs"] == 0.75
        assert data["print_time_formatted"] == "45m"