"""Test printer deletion through API endpoint."""

import pytest
from sqlalchemy.orm import Session


def test_delete_printer_api(client, auth_headers, db: Session):
    """Test deleting a printer through the API endpoint."""
    # Create printer type first
    printer_type_data = {
        "brand": "Test Brand",
        "model": "Test Model",
        "expected_life_hours": 10000
    }
    response = client.post("/printer_types", json=printer_type_data, headers=auth_headers)
    assert response.status_code == 201
    printer_type_id = response.json()["id"]
    
    # Create printer
    printer_data = {
        "name": "Test Printer for Deletion",
        "printer_type_id": printer_type_id,
        "purchase_price_eur": 999.99,
        "status": "idle"
    }
    response = client.post("/printers", json=printer_data, headers=auth_headers)
    assert response.status_code == 201
    printer = response.json()
    printer_id = printer["id"]
    
    # Verify printer exists
    response = client.get(f"/printers/{printer_id}", headers=auth_headers)
    assert response.status_code == 200
    
    # Delete printer
    response = client.delete(f"/printers/{printer_id}", headers=auth_headers)
    assert response.status_code == 204
    
    # Verify printer is deleted
    response = client.get(f"/printers/{printer_id}", headers=auth_headers)
    assert response.status_code == 404
    
    # Clean up printer type
    response = client.delete(f"/printer_types/{printer_type_id}", headers=auth_headers)
    assert response.status_code == 204


def test_cannot_delete_printing_printer(client, auth_headers, db: Session):
    """Test that printers currently printing cannot be deleted."""
    # Create printer type
    printer_type_data = {
        "brand": "Test Brand",
        "model": "Test Model 2",
        "expected_life_hours": 10000
    }
    response = client.post("/printer_types", json=printer_type_data, headers=auth_headers)
    assert response.status_code == 201
    printer_type_id = response.json()["id"]
    
    # Create printer
    printer_data = {
        "name": "Busy Printer",
        "printer_type_id": printer_type_id,
        "purchase_price_eur": 799.99,
        "status": "printing"  # Set as printing
    }
    response = client.post("/printers", json=printer_data, headers=auth_headers)
    assert response.status_code == 201
    printer_id = response.json()["id"]
    
    # Try to delete printing printer
    response = client.delete(f"/printers/{printer_id}", headers=auth_headers)
    assert response.status_code == 409
    assert "Currently printing" in response.json()["detail"]
    
    # Update status to idle
    response = client.put(f"/printers/{printer_id}", json={"status": "idle"}, headers=auth_headers)
    assert response.status_code == 200
    
    # Now deletion should work
    response = client.delete(f"/printers/{printer_id}", headers=auth_headers)
    assert response.status_code == 204
    
    # Clean up
    response = client.delete(f"/printer_types/{printer_type_id}", headers=auth_headers)
    assert response.status_code == 204