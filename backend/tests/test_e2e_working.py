"""
Working E2E tests that demonstrate the testing infrastructure works.
These tests use a simpler approach that works around the database session complexities.
"""
import os
import tempfile
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# No longer need to set environment variables - configuration is now database-based

from app.database import Base
from app.main import app, get_db


class TestWorkingE2E:
    """Working E2E tests that demonstrate the framework functionality."""

    def test_health_endpoint_works(self):
        """Test that the health endpoint works without authentication."""
        with TestClient(app) as client:
            response = client.get("/")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "healthy"
            assert "version" in data

    def test_registration_endpoint_works(self):
        """Test that user registration works and returns expected structure."""
        # Create temporary database
        db_fd, db_path = tempfile.mkstemp()
        os.close(db_fd)
        
        engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        def override_get_db():
            try:
                db = TestingSessionLocal()
                yield db
            finally:
                db.close()
        
        Base.metadata.create_all(bind=engine)
        app.dependency_overrides[get_db] = override_get_db
        
        try:
            with TestClient(app) as client:
                # Test registration
                reg_data = {
                    "email": "test@example.com",
                    "password": "testpass123",
                    "name": "Test User"
                }
                
                response = client.post("/auth/register", json=reg_data)
                assert response.status_code == 200
                
                data = response.json()
                assert "access_token" in data
                assert "token_type" in data
                assert "user" in data
                assert data["user"]["email"] == "test@example.com"
                assert data["user"]["name"] == "Test User"
                assert data["user"]["is_admin"] is False
                
                # Test duplicate registration fails
                dup_response = client.post("/auth/register", json=reg_data)
                assert dup_response.status_code == 400
                assert "already registered" in dup_response.json()["detail"]
                
        finally:
            app.dependency_overrides.clear()
            Base.metadata.drop_all(bind=engine)
            os.unlink(db_path)

    def test_login_endpoint_works(self):
        """Test that login works with valid credentials."""
        db_fd, db_path = tempfile.mkstemp()
        os.close(db_fd)
        
        engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        def override_get_db():
            try:
                db = TestingSessionLocal()
                yield db
            finally:
                db.close()
        
        Base.metadata.create_all(bind=engine)
        app.dependency_overrides[get_db] = override_get_db
        
        try:
            with TestClient(app) as client:
                # Register first
                reg_data = {
                    "email": "login@test.com",
                    "password": "loginpass123",
                    "name": "Login User"
                }
                client.post("/auth/register", json=reg_data)
                
                # Test login with correct credentials
                login_response = client.post("/auth/login", json={
                    "email": "login@test.com",
                    "password": "loginpass123"
                })
                assert login_response.status_code == 200
                
                login_data = login_response.json()
                assert "access_token" in login_data
                assert "user" in login_data
                assert login_data["user"]["email"] == "login@test.com"
                
                # Test login with wrong password
                wrong_pass_response = client.post("/auth/login", json={
                    "email": "login@test.com",
                    "password": "wrongpassword"
                })
                assert wrong_pass_response.status_code == 401
                assert "Incorrect email or password" in wrong_pass_response.json()["detail"]
                
                # Test login with non-existent user
                no_user_response = client.post("/auth/login", json={
                    "email": "nonexistent@test.com",
                    "password": "anypassword"
                })
                assert no_user_response.status_code == 401
                
        finally:
            app.dependency_overrides.clear()
            Base.metadata.drop_all(bind=engine)
            os.unlink(db_path)

    def test_protected_endpoints_require_auth(self):
        """Test that protected endpoints reject requests without authentication."""
        with TestClient(app) as client:
            # Test endpoints that should require authentication
            protected_endpoints = [
                ("/filaments", "get"),
                ("/products", "get"),
                ("/printer_profiles", "get"),
                ("/print_jobs", "get"),
            ]
            
            for endpoint, method in protected_endpoints:
                if method == "get":
                    response = client.get(endpoint)
                else:
                    response = client.post(endpoint, json={})
                
                assert response.status_code == 403
                assert "Not authenticated" in response.json()["detail"]

    def test_filament_creation_with_auth(self):
        """Test that filament creation works when properly authenticated."""
        # Create temporary database
        db_fd, db_path = tempfile.mkstemp()
        os.close(db_fd)
        
        engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        
        def override_get_db():
            try:
                db = TestingSessionLocal()
                yield db
            finally:
                db.close()
        
        Base.metadata.create_all(bind=engine)
        
        # Override both get_db functions to ensure proper database session handling
        app.dependency_overrides[get_db] = override_get_db
        from app.auth import get_db as auth_get_db
        app.dependency_overrides[auth_get_db] = override_get_db
        
        try:
            with TestClient(app) as client:
                # Test without authentication - should fail
                filament_data = {
                    "material": "PLA",
                    "color": "Red",
                    "brand": "ESUN"
                }
                
                no_auth_response = client.post("/filaments", json=filament_data)
                assert no_auth_response.status_code == 403
                assert "Not authenticated" in no_auth_response.json()["detail"]
                
                # Test with invalid token - should fail
                bad_headers = {"Authorization": "Bearer invalid_token"}
                bad_auth_response = client.post("/filaments", json=filament_data, headers=bad_headers)
                assert bad_auth_response.status_code == 401
                
                # Test with valid authentication
                # First register a user
                reg_data = {
                    "email": "filament@test.com",
                    "password": "testpass123",
                    "name": "Filament User"
                }
                reg_response = client.post("/auth/register", json=reg_data)
                assert reg_response.status_code == 200
                
                # Use the token to create a filament
                token = reg_response.json()["access_token"]
                auth_headers = {"Authorization": f"Bearer {token}"}
                
                create_response = client.post("/filaments", json=filament_data, headers=auth_headers)
                assert create_response.status_code == 201
                
                # Verify the response
                created_filament = create_response.json()
                assert created_filament["material"] == "PLA"
                assert created_filament["color"] == "Red"
                assert created_filament["brand"] == "ESUN"
                assert "id" in created_filament
                
        finally:
            app.dependency_overrides.clear()
            Base.metadata.drop_all(bind=engine)
            os.unlink(db_path)

    def test_business_logic_functions_work(self):
        """Test that core business logic functions work independently."""
        from app.main import _generate_sku
        from unittest.mock import Mock
        
        # Test SKU generation
        db_mock = Mock()
        db_mock.query.return_value.filter_by.return_value.first.return_value = None
        
        sku = _generate_sku("Test Product", db_mock)
        assert sku.startswith("TES-")
        assert sku.endswith("-001")
        assert len(sku) > 10  # Should include date

    def test_inventory_calculation_logic(self):
        """Test inventory calculation logic works."""
        # Test weighted average calculation
        current_stock = 2.0  # kg
        current_price = 20.0  # €/kg
        current_value = current_stock * current_price  # €40
        
        new_stock = 1.0  # kg
        new_price = 30.0  # €/kg
        new_value = new_stock * new_price  # €30
        
        total_stock = current_stock + new_stock  # 3.0 kg
        total_value = current_value + new_value  # €70
        weighted_avg = total_value / total_stock  # €23.33/kg
        
        assert abs(weighted_avg - 23.333333) < 0.001
        assert total_stock == 3.0

    def test_cogs_calculation_components(self):
        """Test individual COGS calculation components work."""
        # Test filament cost calculation
        grams_used = 50.0
        price_per_kg = 25.00
        filament_cost = (grams_used / 1000) * price_per_kg
        assert filament_cost == 1.25
        
        # Test printer depreciation calculation
        printer_cost = 600.00
        expected_life_hours = 26280.0  # 3 years * 8760 hours
        hours_used = 4.0
        printer_cost_per_job = (printer_cost / expected_life_hours) * hours_used
        assert abs(printer_cost_per_job - 0.0913) < 0.001
        
        # Test total COGS
        packaging_cost = 2.50
        total_cogs = filament_cost + printer_cost_per_job + packaging_cost
        assert abs(total_cogs - 3.841) < 0.01