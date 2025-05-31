"""
Tests for filament type management permissions.
Ensures that all authenticated users (not just admins) can manage filament types.
"""
import pytest
from app.models import Filament


class TestFilamentPermissions:
    """Test that filament type management is available to all authenticated users."""
    
    def test_regular_user_can_create_filament(self, client, regular_user_headers):
        """Test that non-admin users can create filament types."""
        filament_data = {
            "color": "Purple",
            "brand": "UserBrand",
            "material": "PLA",
            "price_per_kg": 25.00,
            "total_qty_kg": 0
        }
        
        response = client.post("/filaments", json=filament_data, headers=regular_user_headers)
        assert response.status_code == 201
        
        result = response.json()
        assert result["color"] == "Purple"
        assert result["brand"] == "UserBrand"
    
    def test_regular_user_can_list_filaments(self, client, regular_user_headers):
        """Test that non-admin users can list filament types."""
        response = client.get("/filaments", headers=regular_user_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
    
    def test_regular_user_can_update_filament(self, client, regular_user_headers, db):
        """Test that non-admin users can update filament types."""
        # Create a filament first
        filament_data = {
            "color": "Green",
            "brand": "TestBrand",
            "material": "PETG",
            "price_per_kg": 30.00,
            "total_qty_kg": 0
        }
        
        response = client.post("/filaments", json=filament_data, headers=regular_user_headers)
        assert response.status_code == 201
        filament_id = response.json()["id"]
        
        # Update it
        update_data = {
            "price_per_kg": 35.00,
            "min_filaments_kg": 2.0
        }
        
        response = client.patch(f"/filaments/{filament_id}", json=update_data, headers=regular_user_headers)
        assert response.status_code == 200
        
        result = response.json()
        assert result["price_per_kg"] == 35.00
        assert result["min_filaments_kg"] == 2.0
    
    def test_regular_user_can_delete_filament(self, client, regular_user_headers):
        """Test that non-admin users can delete filament types (with no inventory)."""
        # Create a filament
        filament_data = {
            "color": "Yellow",
            "brand": "DeleteBrand",
            "material": "ABS",
            "price_per_kg": 28.00,
            "total_qty_kg": 0
        }
        
        response = client.post("/filaments", json=filament_data, headers=regular_user_headers)
        assert response.status_code == 201
        filament_id = response.json()["id"]
        
        # Delete it
        response = client.delete(f"/filaments/{filament_id}", headers=regular_user_headers)
        assert response.status_code == 204
        
        # Verify it's gone
        response = client.get(f"/filaments/{filament_id}", headers=regular_user_headers)
        assert response.status_code == 404
    
    def test_unauthenticated_cannot_manage_filaments(self, client):
        """Test that unauthenticated users cannot manage filament types."""
        filament_data = {
            "color": "Unauthorized",
            "brand": "NoBrand",
            "material": "PLA",
            "price_per_kg": 20.00,
            "total_qty_kg": 0
        }
        
        # Test all endpoints without auth
        response = client.post("/filaments", json=filament_data)
        assert response.status_code == 403
        
        response = client.get("/filaments")
        assert response.status_code == 403
        
        response = client.patch("/filaments/1", json={"price_per_kg": 25.00})
        assert response.status_code == 403
        
        response = client.delete("/filaments/1")
        assert response.status_code == 403
    
    def test_admin_and_regular_user_have_same_filament_access(self, client, auth_headers, regular_user_headers):
        """Test that admin and regular users have identical access to filament management."""
        filament_data = {
            "color": "Blue",
            "brand": "SharedBrand",
            "material": "TPU",
            "price_per_kg": 40.00,
            "total_qty_kg": 0
        }
        
        # Admin creates filament
        response = client.post("/filaments", json=filament_data, headers=auth_headers)
        assert response.status_code == 201
        admin_filament_id = response.json()["id"]
        
        # Regular user can view it
        response = client.get(f"/filaments/{admin_filament_id}", headers=regular_user_headers)
        assert response.status_code == 200
        
        # Regular user can update it
        response = client.patch(
            f"/filaments/{admin_filament_id}", 
            json={"price_per_kg": 42.00}, 
            headers=regular_user_headers
        )
        assert response.status_code == 200
        
        # Regular user creates another filament
        filament_data["color"] = "Red"
        response = client.post("/filaments", json=filament_data, headers=regular_user_headers)
        assert response.status_code == 201
        user_filament_id = response.json()["id"]
        
        # Admin can view and update user's filament
        response = client.get(f"/filaments/{user_filament_id}", headers=auth_headers)
        assert response.status_code == 200
        
        response = client.patch(
            f"/filaments/{user_filament_id}", 
            json={"price_per_kg": 43.00}, 
            headers=auth_headers
        )
        assert response.status_code == 200