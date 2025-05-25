"""
Debug authentication issues in E2E tests.
"""
import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Set environment variables for testing
os.environ["JWT_SECRET_KEY"] = "test_secret_key_for_testing_only"
os.environ["SUPERADMIN_EMAIL"] = "test@admin.com"
os.environ["SUPERADMIN_PASSWORD"] = "testpass"
os.environ["SUPERADMIN_NAME"] = "Test Admin"

# Create test database engine
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Override the database module BEFORE importing the app
import app.database
app.database.engine = engine
app.database.SessionLocal = TestingSessionLocal

# NOW import the app and other dependencies
from app.database import Base
from app.main import app, get_db


def test_auth_flow_simple():
    """Test a simple auth flow without complex fixtures."""
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    try:
        with TestClient(app) as client:
            # 1. Register a user
            registration_data = {
                "email": "test@example.com",
                "password": "testpass123",
                "name": "Test User"
            }
            
            reg_response = client.post("/auth/register", json=registration_data)
            print(f"Registration status: {reg_response.status_code}")
            if reg_response.status_code != 200:
                print(f"Registration error: {reg_response.text}")
                assert False, "Registration failed"
                
            reg_data = reg_response.json()
            assert "access_token" in reg_data
            token = reg_data["access_token"]
            
            # 2. Use the token to access /auth/me
            headers = {"Authorization": f"Bearer {token}"}
            me_response = client.get("/auth/me", headers=headers)
            print(f"Me endpoint status: {me_response.status_code}")
            if me_response.status_code != 200:
                print(f"Me endpoint error: {me_response.text}")
                
            assert me_response.status_code == 200
            me_data = me_response.json()
            assert me_data["email"] == "test@example.com"
            
            # 3. Login with the same credentials
            login_response = client.post("/auth/login", json={
                "email": "test@example.com",
                "password": "testpass123"
            })
            assert login_response.status_code == 200
            
            login_data = login_response.json()
            login_token = login_data["access_token"]
            
            # 4. Use login token for /auth/me
            login_headers = {"Authorization": f"Bearer {login_token}"}
            me2_response = client.get("/auth/me", headers=login_headers)
            assert me2_response.status_code == 200
            
    finally:
        # Clean up
        Base.metadata.drop_all(bind=engine)


def test_basic_protected_endpoint():
    """Test accessing a protected endpoint with auth."""
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    try:
        with TestClient(app) as client:
            # Register and get token
            reg_response = client.post("/auth/register", json={
                "email": "user@test.com",
                "password": "password123",
                "name": "Test User"
            })
            
            assert reg_response.status_code == 200
            token = reg_response.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}
            
            # Try to access filaments endpoint (should work with auth)
            filaments_response = client.get("/filaments", headers=headers)
            print(f"Filaments with auth: {filaments_response.status_code}")
            if filaments_response.status_code != 200:
                print(f"Filaments error: {filaments_response.text}")
            assert filaments_response.status_code == 200
            
            # Try without auth (should fail)
            no_auth_response = client.get("/filaments")
            print(f"Filaments without auth: {no_auth_response.status_code}")
            assert no_auth_response.status_code == 403
            
    finally:
        # Clean up
        Base.metadata.drop_all(bind=engine)