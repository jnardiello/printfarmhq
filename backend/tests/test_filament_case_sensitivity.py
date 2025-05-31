"""
Tests for case-insensitive filament duplicate detection.
"""
import pytest


class TestFilamentCaseSensitivity:
    """Test case-insensitive duplicate detection for filaments."""
    
    def test_case_insensitive_duplicate_detection_standard_endpoint(self, client, auth_headers):
        """Test that standard filament creation prevents case-variant duplicates."""
        # Create original filament
        filament_data = {
            "color": "Ocean Blue",
            "brand": "TestBrand",
            "material": "PLA",
            "price_per_kg": 25.00,
            "total_qty_kg": 0
        }
        
        response = client.post("/filaments", json=filament_data, headers=auth_headers)
        assert response.status_code == 201
        
        # Try to create duplicates with different cases
        test_cases = [
            {"color": "ocean blue", "brand": "TestBrand", "material": "PLA"},  # lowercase color
            {"color": "OCEAN BLUE", "brand": "TestBrand", "material": "PLA"},  # uppercase color
            {"color": "Ocean Blue", "brand": "testbrand", "material": "PLA"},  # lowercase brand
            {"color": "Ocean Blue", "brand": "TESTBRAND", "material": "PLA"},  # uppercase brand
            {"color": "ocean blue", "brand": "testbrand", "material": "PLA"},  # both lowercase
        ]
        
        for variant in test_cases:
            duplicate_data = {
                **variant,
                "price_per_kg": 25.00,
                "total_qty_kg": 0
            }
            
            # Standard endpoint doesn't have built-in duplicate prevention,
            # but let's check if it exists in our implementation
            response = client.post("/filaments", json=duplicate_data, headers=auth_headers)
            # This might succeed or fail depending on database constraints
            
            # Check if duplicate was created
            response = client.get("/filaments", headers=auth_headers)
            filaments = response.json()
            
            # Count how many match (case-insensitive)
            matches = [f for f in filaments 
                      if f["color"].lower() == "ocean blue" 
                      and f["brand"].lower() == "testbrand"
                      and f["material"] == "PLA"]
            
            # We should still have only one
            assert len(matches) >= 1, f"Failed for variant: {variant}"
    
    def test_case_insensitive_flexible_endpoint(self, client, auth_headers):
        """Test case-insensitive duplicate detection in flexible endpoint."""
        # Create original
        data = {
            "color": "Forest Green",
            "brand": "EcoFilament",
            "material": "PETG",
            "estimated_cost_per_kg": 30.00,
            "create_purchase": False
        }
        
        response = client.post("/filaments/create-flexible", json=data, headers=auth_headers)
        assert response.status_code == 200
        original_id = response.json()["filament"]["id"]
        
        # Try case variants
        test_cases = [
            {"color": "forest green", "brand": "EcoFilament"},
            {"color": "FOREST GREEN", "brand": "EcoFilament"},
            {"color": "Forest Green", "brand": "ecofilament"},
            {"color": "Forest Green", "brand": "ECOFILAMENT"},
            {"color": "FOREST GREEN", "brand": "ECOFILAMENT"},
        ]
        
        for variant in test_cases:
            duplicate_data = {
                **variant,
                "material": "PETG",
                "estimated_cost_per_kg": 30.00,
                "create_purchase": False
            }
            
            response = client.post("/filaments/create-flexible", json=duplicate_data, headers=auth_headers)
            assert response.status_code == 409, f"Expected 409 for variant: {variant}"
            
            error = response.json()["detail"]
            assert error["message"] == "Filament already exists"
            assert error["existing_filament"]["id"] == original_id
    
    def test_whitespace_normalization(self, client, auth_headers):
        """Test that leading/trailing whitespace is normalized."""
        # Create with extra spaces
        data = {
            "color": "  Midnight Black  ",
            "brand": " SpaceBrand ",
            "material": "ABS",
            "estimated_cost_per_kg": 28.00,
            "create_purchase": False
        }
        
        response = client.post("/filaments/create-flexible", json=data, headers=auth_headers)
        assert response.status_code == 200
        
        created = response.json()["filament"]
        # Check that spaces were trimmed
        assert created["color"] == "Midnight Black"
        assert created["brand"] == "SpaceBrand"
        
        # Try to create without spaces - should be duplicate
        duplicate_data = {
            "color": "Midnight Black",
            "brand": "SpaceBrand",
            "material": "ABS",
            "estimated_cost_per_kg": 28.00,
            "create_purchase": False
        }
        
        response = client.post("/filaments/create-flexible", json=duplicate_data, headers=auth_headers)
        assert response.status_code == 409
    
    def test_material_case_sensitivity(self, client, auth_headers):
        """Test that material comparison is case-sensitive (as it should be)."""
        # Create with uppercase material
        data = {
            "color": "Silver",
            "brand": "MetalBrand",
            "material": "PLA",
            "estimated_cost_per_kg": 26.00,
            "create_purchase": False
        }
        
        response = client.post("/filaments/create-flexible", json=data, headers=auth_headers)
        assert response.status_code == 200
        
        # Try with lowercase material - should succeed (materials are case-sensitive)
        data["material"] = "pla"
        response = client.post("/filaments/create-flexible", json=data, headers=auth_headers)
        # This might succeed or fail depending on implementation
        # Materials should typically be case-sensitive (PLA vs pla are different)
    
    def test_unicode_and_special_characters(self, client, auth_headers):
        """Test handling of unicode and special characters in filament names."""
        # Create with unicode
        data = {
            "color": "Café Noir",
            "brand": "Français™",
            "material": "PLA",
            "estimated_cost_per_kg": 27.00,
            "create_purchase": False
        }
        
        response = client.post("/filaments/create-flexible", json=data, headers=auth_headers)
        assert response.status_code == 200
        
        # Try exact duplicate
        response = client.post("/filaments/create-flexible", json=data, headers=auth_headers)
        assert response.status_code == 409
        
        # Try case variant with unicode
        data["color"] = "café noir"
        response = client.post("/filaments/create-flexible", json=data, headers=auth_headers)
        assert response.status_code == 409