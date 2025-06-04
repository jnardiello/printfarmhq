"""Test printer types and instances functionality."""

import pytest
from datetime import date
from sqlalchemy.orm import Session

from app import models, schemas


def test_create_printer_type(client, auth_headers, db: Session):
    """Test creating a new printer type."""
    printer_type_data = {
        "brand": "Prusa",
        "model": "MK3S+",
        "expected_life_hours": 15000
    }
    
    response = client.post(
        "/printer_types",
        json=printer_type_data,
        headers=auth_headers
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["brand"] == "Prusa"
    assert data["model"] == "MK3S+"
    assert data["expected_life_hours"] == 15000
    assert "id" in data
    assert "created_at" in data


def test_create_duplicate_printer_type(client, auth_headers, db: Session):
    """Test that duplicate printer types are rejected."""
    printer_type_data = {
        "brand": "Prusa",
        "model": "MK3S+",
        "expected_life_hours": 15000
    }
    
    # Create first printer type
    response1 = client.post("/printer_types", json=printer_type_data, headers=auth_headers)
    assert response1.status_code == 201
    
    # Try to create duplicate
    response2 = client.post("/printer_types", json=printer_type_data, headers=auth_headers)
    assert response2.status_code == 409
    assert "already exists" in response2.json()["detail"]


def test_list_printer_types(client, auth_headers, db: Session):
    """Test listing printer types."""
    # Create a few printer types
    types = [
        {"brand": "Prusa", "model": "MK3S+", "expected_life_hours": 15000},
        {"brand": "Creality", "model": "Ender 3 V2", "expected_life_hours": 8000},
        {"brand": "Bambu Lab", "model": "X1C", "expected_life_hours": 20000}
    ]
    
    for pt in types:
        response = client.post("/printer_types", json=pt, headers=auth_headers)
        assert response.status_code == 201
    
    # List printer types
    response = client.get("/printer_types", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 3
    
    # Check that printer_count is included
    for pt in data:
        assert "printer_count" in pt
        assert pt["printer_count"] == 0  # No printers created yet


def test_create_printer_instance(client, auth_headers, db: Session):
    """Test creating a printer instance from a printer type."""
    # First create a printer type
    printer_type_data = {
        "brand": "Prusa",
        "model": "MK3S+",
        "expected_life_hours": 15000
    }
    type_response = client.post("/printer_types", json=printer_type_data, headers=auth_headers)
    assert type_response.status_code == 201
    printer_type_id = type_response.json()["id"]
    
    # Create a printer instance
    printer_data = {
        "printer_type_id": printer_type_id,
        "name": "Prusa 1",
        "purchase_price_eur": 899.99,
        "purchase_date": str(date.today()),
        "status": "idle"
    }
    
    response = client.post("/printers", json=printer_data, headers=auth_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Prusa 1"
    assert data["purchase_price_eur"] == 899.99
    assert data["status"] == "idle"
    assert data["working_hours"] == 0
    assert "printer_type" in data
    assert data["printer_type"]["brand"] == "Prusa"
    assert data["printer_type"]["model"] == "MK3S+"


def test_list_printers_by_type(client, auth_headers, db: Session):
    """Test filtering printers by printer type."""
    # Create two printer types
    type1_response = client.post("/printer_types", json={
        "brand": "Prusa", "model": "MK3S+", "expected_life_hours": 15000
    }, headers=auth_headers)
    type1_id = type1_response.json()["id"]
    
    type2_response = client.post("/printer_types", json={
        "brand": "Creality", "model": "Ender 3", "expected_life_hours": 8000
    }, headers=auth_headers)
    type2_id = type2_response.json()["id"]
    
    # Create printers of each type
    for i in range(2):
        client.post("/printers", json={
            "printer_type_id": type1_id,
            "name": f"Prusa {i+1}",
            "purchase_price_eur": 899.99,
            "status": "idle"
        }, headers=auth_headers)
        
    client.post("/printers", json={
        "printer_type_id": type2_id,
        "name": "Ender 1",
        "purchase_price_eur": 299.99,
        "status": "idle"
    }, headers=auth_headers)
    
    # List all printers
    response = client.get("/printers", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) >= 3
    
    # List only Prusa printers
    response = client.get(f"/printers?printer_type_id={type1_id}", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    for printer in data:
        assert printer["printer_type"]["brand"] == "Prusa"


def test_update_printer_status(client, auth_headers, db: Session):
    """Test updating printer status."""
    # Create printer type and instance
    type_response = client.post("/printer_types", json={
        "brand": "Prusa", "model": "MK3S+", "expected_life_hours": 15000
    }, headers=auth_headers)
    printer_type_id = type_response.json()["id"]
    
    printer_response = client.post("/printers", json={
        "printer_type_id": printer_type_id,
        "name": "Prusa 1",
        "purchase_price_eur": 899.99,
        "status": "idle"
    }, headers=auth_headers)
    printer_id = printer_response.json()["id"]
    
    # Update status to printing
    update_response = client.put(
        f"/printers/{printer_id}",
        json={"status": "printing"},
        headers=auth_headers
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "printing"
    
    # Try to delete printer while printing
    delete_response = client.delete(f"/printers/{printer_id}", headers=auth_headers)
    assert delete_response.status_code == 409
    assert "Currently printing" in delete_response.json()["detail"]


def test_delete_printer_type_with_printers(client, auth_headers, db: Session):
    """Test that printer types with instances cannot be deleted."""
    # Create printer type
    type_response = client.post("/printer_types", json={
        "brand": "Prusa", "model": "MK3S+", "expected_life_hours": 15000
    }, headers=auth_headers)
    printer_type_id = type_response.json()["id"]
    
    # Create printer instance
    client.post("/printers", json={
        "printer_type_id": printer_type_id,
        "name": "Prusa 1",
        "purchase_price_eur": 899.99,
        "status": "idle"
    }, headers=auth_headers)
    
    # Try to delete printer type
    delete_response = client.delete(f"/printer_types/{printer_type_id}", headers=auth_headers)
    assert delete_response.status_code == 409
    assert "printer(s) are using this type" in delete_response.json()["detail"]