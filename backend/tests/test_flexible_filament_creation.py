"""
Tests for the flexible filament creation endpoint.
"""
import pytest
from datetime import date
from app.models import Filament, FilamentPurchase


class TestFlexibleFilamentCreation:
    """Test the /filaments/create-flexible endpoint."""
    
    def test_create_filament_without_inventory(self, client, auth_headers):
        """Test creating a filament type without inventory tracking."""
        data = {
            "color": "Cosmic Blue",
            "brand": "Generic",
            "material": "PLA",
            "estimated_cost_per_kg": 22.50,
            "create_purchase": False
        }
        
        response = client.post("/filaments/create-flexible", json=data, headers=auth_headers)
        assert response.status_code == 200
        
        result = response.json()
        assert result["filament"]["color"] == "Cosmic Blue"
        assert result["filament"]["brand"] == "Generic"
        assert result["filament"]["material"] == "PLA"
        assert result["filament"]["price_per_kg"] == 22.50
        assert result["filament"]["total_qty_kg"] == 0.0
        assert result["purchase"] is None
        assert "No inventory tracked for this filament" in result["warnings"]
        assert result["message"] == "Filament created successfully"
    
    def test_create_filament_with_inventory(self, client, auth_headers, db):
        """Test creating a filament with initial inventory."""
        data = {
            "color": "Fire Red",
            "brand": "Prusament",
            "material": "PETG",
            "estimated_cost_per_kg": 29.99,
            "create_purchase": True,
            "purchase_data": {
                "quantity_kg": 2.5,
                "price_per_kg": 28.50,
                "purchase_date": str(date.today()),
                "purchase_channel": "Official Store",
                "notes": "High quality filament for important prints"
            }
        }
        
        response = client.post("/filaments/create-flexible", json=data, headers=auth_headers)
        assert response.status_code == 200
        
        result = response.json()
        # Filament assertions
        assert result["filament"]["color"] == "Fire Red"
        assert result["filament"]["brand"] == "Prusament"
        assert result["filament"]["material"] == "PETG"
        assert result["filament"]["price_per_kg"] == 28.50  # Should use purchase price
        assert result["filament"]["total_qty_kg"] == 2.5
        
        # Purchase assertions
        assert result["purchase"] is not None
        assert result["purchase"]["quantity_kg"] == 2.5
        assert result["purchase"]["price_per_kg"] == 28.50
        assert result["purchase"]["channel"] == "Official Store"
        assert result["purchase"]["notes"] == "High quality filament for important prints"
        
        # Message assertions
        assert "with initial inventory" in result["message"]
        assert len(result["warnings"]) == 0
        
        # Verify in database
        filament = db.query(Filament).filter(
            Filament.color == "Fire Red",
            Filament.brand == "Prusament",
            Filament.material == "PETG"
        ).first()
        assert filament is not None
        assert filament.total_qty_kg == 2.5
        
        purchase = db.query(FilamentPurchase).filter(
            FilamentPurchase.filament_id == filament.id
        ).first()
        assert purchase is not None
        assert purchase.quantity_kg == 2.5
    
    def test_create_duplicate_filament(self, client, auth_headers, db):
        """Test handling of duplicate filament creation."""
        # Create initial filament
        data = {
            "color": "Ocean Blue",
            "brand": "TestBrand",
            "material": "ABS",
            "estimated_cost_per_kg": 25.00,
            "create_purchase": False
        }
        
        response1 = client.post("/filaments/create-flexible", json=data, headers=auth_headers)
        assert response1.status_code == 200
        filament_id = response1.json()["filament"]["id"]
        
        # Try to create duplicate
        response2 = client.post("/filaments/create-flexible", json=data, headers=auth_headers)
        assert response2.status_code == 409
        
        error_detail = response2.json()["detail"]
        assert error_detail["message"] == "Filament already exists"
        assert error_detail["existing_filament"]["id"] == filament_id
        assert error_detail["existing_filament"]["color"] == "Ocean Blue"
    
    def test_create_filament_with_minimal_data(self, client, auth_headers):
        """Test creating filament with only required fields."""
        data = {
            "color": "Natural",
            "brand": "NoName",
            "material": "PLA",
            "estimated_cost_per_kg": 15.00,
            "create_purchase": False
        }
        
        response = client.post("/filaments/create-flexible", json=data, headers=auth_headers)
        assert response.status_code == 200
        
        result = response.json()
        assert result["filament"]["color"] == "Natural"
        assert result["filament"]["total_qty_kg"] == 0.0
    
    def test_create_filament_validation_errors(self, client, auth_headers):
        """Test validation of filament creation data."""
        # Missing required fields
        data = {
            "color": "Test Color"
            # Missing brand, material, estimated_cost_per_kg
        }
        
        response = client.post("/filaments/create-flexible", json=data, headers=auth_headers)
        assert response.status_code == 422
        
        # Invalid cost
        data = {
            "color": "Test Color",
            "brand": "Test Brand",
            "material": "PLA",
            "estimated_cost_per_kg": -10.00,  # Negative cost
            "create_purchase": False
        }
        
        response = client.post("/filaments/create-flexible", json=data, headers=auth_headers)
        assert response.status_code == 422
    
    def test_create_filament_with_purchase_missing_data(self, client, auth_headers):
        """Test creating filament with purchase but missing purchase data."""
        data = {
            "color": "Missing Purchase",
            "brand": "TestBrand",
            "material": "PLA",
            "estimated_cost_per_kg": 20.00,
            "create_purchase": True
            # Missing purchase_data
        }
        
        response = client.post("/filaments/create-flexible", json=data, headers=auth_headers)
        assert response.status_code == 200
        
        # Should create filament without purchase
        result = response.json()
        assert result["filament"]["total_qty_kg"] == 0.0
        assert result["purchase"] is None
        assert "No inventory tracked for this filament" in result["warnings"]
    
    def test_create_filament_requires_auth(self, client):
        """Test that creating filament requires authentication."""
        data = {
            "color": "Unauthorized",
            "brand": "TestBrand",
            "material": "PLA",
            "estimated_cost_per_kg": 20.00,
            "create_purchase": False
        }
        
        response = client.post("/filaments/create-flexible", json=data)
        assert response.status_code == 403
    
    def test_create_filament_with_partial_purchase_data(self, client, auth_headers):
        """Test creating filament with only required purchase fields."""
        data = {
            "color": "Partial Purchase",
            "brand": "TestBrand",
            "material": "TPU",
            "estimated_cost_per_kg": 35.00,
            "create_purchase": True,
            "purchase_data": {
                "quantity_kg": 1.0,
                "price_per_kg": 33.00
                # Optional fields omitted
            }
        }
        
        response = client.post("/filaments/create-flexible", json=data, headers=auth_headers)
        assert response.status_code == 200
        
        result = response.json()
        assert result["filament"]["total_qty_kg"] == 1.0
        assert result["filament"]["price_per_kg"] == 33.00
        assert result["purchase"] is not None
        assert result["purchase"]["purchase_date"] is not None  # Should default to today
        assert result["purchase"]["channel"] is None
        assert result["purchase"]["notes"] is None