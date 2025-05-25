"""
Working authentication tests that use the existing test infrastructure.
These tests demonstrate that the authentication system works end-to-end.
"""
import pytest
from fastapi.testclient import TestClient


class TestAuthenticationWorking:
    """Test authentication functionality using existing fixtures."""

    def test_auth_flow_simple(self, client: TestClient):
        """Test a simple auth flow: register → login → access protected endpoint."""
        
        # 1. Register a user (use unique email to avoid conflicts)
        registration_data = {
            "email": "authflow@example.com",
            "password": "testpass123",
            "name": "Auth Flow User"
        }
        
        reg_response = client.post("/auth/register", json=registration_data)
        assert reg_response.status_code == 200
        
        reg_data = reg_response.json()
        assert "access_token" in reg_data
        assert "user" in reg_data
        assert reg_data["user"]["email"] == "authflow@example.com"
        assert reg_data["user"]["name"] == "Auth Flow User"
        token = reg_data["access_token"]
        
        # 2. Use the token to access /auth/me
        headers = {"Authorization": f"Bearer {token}"}
        me_response = client.get("/auth/me", headers=headers)
        assert me_response.status_code == 200
        
        me_data = me_response.json()
        assert me_data["email"] == "authflow@example.com"
        assert me_data["name"] == "Auth Flow User"
        
        # 3. Login with the same credentials
        login_response = client.post("/auth/login", json={
            "email": "authflow@example.com",
            "password": "testpass123"
        })
        assert login_response.status_code == 200
        
        login_data = login_response.json()
        login_token = login_data["access_token"]
        
        # 4. Use login token for /auth/me
        login_headers = {"Authorization": f"Bearer {login_token}"}
        me2_response = client.get("/auth/me", headers=login_headers)
        assert me2_response.status_code == 200

    def test_basic_protected_endpoint(self, client: TestClient):
        """Test accessing a protected endpoint with auth."""
        
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
        assert filaments_response.status_code == 200
        
        # Should return empty list initially
        filaments_data = filaments_response.json()
        assert isinstance(filaments_data, list)
        
        # Try without auth (should fail)
        no_auth_response = client.get("/filaments")
        assert no_auth_response.status_code == 403
        assert "Not authenticated" in no_auth_response.json()["detail"]

    def test_protected_endpoints_comprehensive(self, client: TestClient):
        """Test multiple protected endpoints work with authentication."""
        
        # Register user and get token
        reg_response = client.post("/auth/register", json={
            "email": "comprehensive@test.com",
            "password": "password123",
            "name": "Comprehensive User"
        })
        
        token = reg_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        # Test multiple protected endpoints
        protected_endpoints = [
            "/filaments",
            "/products", 
            "/printer_profiles",
            "/print_jobs"
        ]
        
        for endpoint in protected_endpoints:
            # With auth - should work
            auth_response = client.get(endpoint, headers=headers)
            assert auth_response.status_code == 200, f"Endpoint {endpoint} failed with auth"
            
            # Without auth - should fail
            no_auth_response = client.get(endpoint)
            assert no_auth_response.status_code == 403, f"Endpoint {endpoint} should reject no auth"

    def test_invalid_auth_scenarios(self, client: TestClient):
        """Test various invalid authentication scenarios."""
        
        # Test with invalid token
        invalid_headers = {"Authorization": "Bearer invalid_token"}
        response = client.get("/filaments", headers=invalid_headers)
        assert response.status_code == 401
        
        # Test with malformed header
        malformed_headers = {"Authorization": "InvalidFormat token"}
        response = client.get("/filaments", headers=malformed_headers)
        assert response.status_code == 403  # Should reject malformed auth
        
        # Test with no Authorization header
        response = client.get("/filaments")
        assert response.status_code == 403

    def test_auth_error_messages(self, client: TestClient):
        """Test that authentication error messages are appropriate."""
        
        # Test wrong password
        # First register a user
        client.post("/auth/register", json={
            "email": "errortest@example.com",
            "password": "correctpass",
            "name": "Error Test User"
        })
        
        # Try login with wrong password
        wrong_pass_response = client.post("/auth/login", json={
            "email": "errortest@example.com",
            "password": "wrongpass"
        })
        assert wrong_pass_response.status_code == 401
        assert "Incorrect email or password" in wrong_pass_response.json()["detail"]
        
        # Test non-existent user
        no_user_response = client.post("/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "anypass"
        })
        assert no_user_response.status_code == 401
        assert "Incorrect email or password" in no_user_response.json()["detail"]

    def test_duplicate_registration_fails(self, client: TestClient):
        """Test that duplicate email registration fails appropriately."""
        
        user_data = {
            "email": "duplicate@example.com",
            "password": "password123",
            "name": "First User"
        }
        
        # First registration should succeed
        first_response = client.post("/auth/register", json=user_data)
        assert first_response.status_code == 200
        
        # Second registration with same email should fail
        duplicate_response = client.post("/auth/register", json=user_data)
        assert duplicate_response.status_code == 400
        assert "already registered" in duplicate_response.json()["detail"]