"""
Tests for filament deletion validation.
Ensures filaments cannot be deleted when they have inventory or are used in products.
"""
import pytest
from datetime import date


class TestFilamentDeleteValidation:
    """Test validation rules for deleting filament types."""
    
    def test_cannot_delete_filament_with_inventory(self, client, auth_headers):
        """Test that filaments with inventory cannot be deleted."""
        # Create filament
        filament_data = {
            "color": "Black",
            "brand": "TestBrand",
            "material": "PLA",
            "price_per_kg": 25.00,
            "total_qty_kg": 0
        }
        
        response = client.post("/filaments", json=filament_data, headers=auth_headers)
        assert response.status_code == 201
        filament_id = response.json()["id"]
        
        # Add inventory via purchase
        purchase_data = {
            "filament_id": filament_id,
            "quantity_kg": 2.0,
            "price_per_kg": 24.00,
            "purchase_date": str(date.today())
        }
        
        response = client.post("/filament_purchases", json=purchase_data, headers=auth_headers)
        assert response.status_code == 201
        
        # Try to delete filament - should fail
        response = client.delete(f"/filaments/{filament_id}", headers=auth_headers)
        assert response.status_code == 400
        assert "Cannot delete filament type with existing inventory" in response.json()["detail"]
        
        # Verify filament still exists
        response = client.get(f"/filaments/{filament_id}", headers=auth_headers)
        assert response.status_code == 200
    
    def test_cannot_delete_filament_used_in_products(self, client, auth_headers):
        """Test that filaments used in products cannot be deleted."""
        # Create filament
        filament_data = {
            "color": "White",
            "brand": "ProductBrand",
            "material": "PETG",
            "price_per_kg": 30.00,
            "total_qty_kg": 0
        }
        
        response = client.post("/filaments", json=filament_data, headers=auth_headers)
        assert response.status_code == 201
        filament_id = response.json()["id"]
        
        # Create product using this filament
        product_data = {
            "name": "Test Product",
            "print_time": "2h30m",
            "filament_usages": f'[{{"filament_id": {filament_id}, "grams_used": 50}}]'
        }
        
        response = client.post("/products", data=product_data, headers=auth_headers)
        assert response.status_code == 200
        
        # Try to delete filament - should fail
        response = client.delete(f"/filaments/{filament_id}", headers=auth_headers)
        assert response.status_code == 400
        assert "Cannot delete filament type that is used in products" in response.json()["detail"]
    
    def test_cannot_delete_filament_used_in_plates(self, client, auth_headers):
        """Test that filaments used in plates cannot be deleted."""
        # Create filament
        filament_data = {
            "color": "Gray",
            "brand": "PlateBrand",
            "material": "ABS",
            "price_per_kg": 28.00,
            "total_qty_kg": 0
        }
        
        response = client.post("/filaments", json=filament_data, headers=auth_headers)
        assert response.status_code == 201
        filament_id = response.json()["id"]
        
        # Create a product first
        product_data = {
            "name": "Product with Plate",
            "print_time": "1h",
            "filament_usages": '[]'  # No direct filament usage
        }
        
        response = client.post("/products", data=product_data, headers=auth_headers)
        assert response.status_code == 200
        product_id = response.json()["id"]
        
        # Create plate using the filament
        plate_data = {
            "name": "Test Plate",
            "quantity": "1",
            "print_time": "1h",
            "filament_usages": f'[{{"filament_id": {filament_id}, "grams_used": 30}}]'
        }
        
        response = client.post(f"/products/{product_id}/plates", data=plate_data, headers=auth_headers)
        assert response.status_code == 200
        
        # Try to delete filament - should fail
        response = client.delete(f"/filaments/{filament_id}", headers=auth_headers)
        assert response.status_code == 400
        assert "Cannot delete filament type that is used in products" in response.json()["detail"]
    
    def test_can_delete_filament_after_removing_dependencies(self, client, auth_headers):
        """Test that filament can be deleted after removing all dependencies."""
        # Create filament
        filament_data = {
            "color": "Orange",
            "brand": "CleanupBrand",
            "material": "TPU",
            "price_per_kg": 35.00,
            "total_qty_kg": 0
        }
        
        response = client.post("/filaments", json=filament_data, headers=auth_headers)
        assert response.status_code == 201
        filament_id = response.json()["id"]
        
        # Add purchase
        purchase_data = {
            "filament_id": filament_id,
            "quantity_kg": 1.0,
            "price_per_kg": 34.00
        }
        
        response = client.post("/filament_purchases", json=purchase_data, headers=auth_headers)
        assert response.status_code == 201
        purchase_id = response.json()["id"]
        
        # Delete purchase first
        response = client.delete(f"/filament_purchases/{purchase_id}", headers=auth_headers)
        assert response.status_code == 204
        
        # Now delete filament - should succeed
        response = client.delete(f"/filaments/{filament_id}", headers=auth_headers)
        assert response.status_code == 204
        
        # Verify it's gone
        response = client.get(f"/filaments/{filament_id}", headers=auth_headers)
        assert response.status_code == 404
    
    def test_delete_validation_with_zero_inventory(self, client, auth_headers):
        """Test that filament with explicitly set 0 inventory can be deleted."""
        # Create filament with 0 inventory
        filament_data = {
            "color": "Cyan",
            "brand": "ZeroBrand",
            "material": "PLA",
            "price_per_kg": 22.00,
            "total_qty_kg": 0.0
        }
        
        response = client.post("/filaments", json=filament_data, headers=auth_headers)
        assert response.status_code == 201
        filament_id = response.json()["id"]
        
        # Should be able to delete it
        response = client.delete(f"/filaments/{filament_id}", headers=auth_headers)
        assert response.status_code == 204