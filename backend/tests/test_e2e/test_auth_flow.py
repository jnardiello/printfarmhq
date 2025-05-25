"""
End-to-end tests for authentication workflows.
Tests user registration, login, token usage, and role-based access control.
"""
import pytest
from app.models import User


class TestAuthenticationFlow:
    """Test complete authentication workflows."""

    def test_user_registration_and_login_flow(self, client, db):
        """Test that a user can register and then login successfully."""
        # Register a new user
        registration_data = {
            "email": "newuser@example.com",
            "password": "securepassword123",
            "name": "New User"
        }
        
        response = client.post("/auth/register", json=registration_data)
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["email"] == "newuser@example.com"
        assert data["user"]["name"] == "New User"
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        
        # Verify user was created in database
        user = db.query(User).filter(User.email == "newuser@example.com").first()
        assert user is not None
        assert user.is_admin is False
        assert user.is_superadmin is False
        
        # Login with the new credentials
        login_response = client.post(
            "/auth/login",
            json={"email": "newuser@example.com", "password": "securepassword123"}
        )
        assert login_response.status_code == 200
        login_data = login_response.json()
        assert "access_token" in login_data
        
        # Use the token to access protected endpoint
        headers = {"Authorization": f"Bearer {login_data['access_token']}"}
        me_response = client.get("/auth/me", headers=headers)
        assert me_response.status_code == 200
        me_data = me_response.json()
        assert me_data["email"] == "newuser@example.com"
        assert me_data["name"] == "New User"

    def test_duplicate_email_registration_fails(self, client, test_user):
        """Test that registering with an existing email fails."""
        registration_data = {
            "email": test_user.email,
            "password": "anotherpassword",
            "name": "Another User"
        }
        
        response = client.post("/auth/register", json=registration_data)
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]

    def test_invalid_credentials_login_fails(self, client, test_user):
        """Test that login with wrong credentials fails."""
        # Wrong password
        response = client.post(
            "/auth/login",
            json={"email": test_user.email, "password": "wrongpassword"}
        )
        assert response.status_code == 401
        assert "Incorrect email or password" in response.json()["detail"]
        
        # Non-existent email
        response = client.post(
            "/auth/login",
            json={"email": "nonexistent@example.com", "password": "anypassword"}
        )
        assert response.status_code == 401
        assert "Incorrect email or password" in response.json()["detail"]

    def test_protected_endpoints_require_authentication(self, client):
        """Test that protected endpoints require valid authentication."""
        endpoints = [
            ("/filaments", "get"),
            ("/products", "get"),
            ("/printer_profiles", "get"),
            ("/print_jobs", "get"),
        ]
        
        for endpoint, method in endpoints:
            if method == "get":
                response = client.get(endpoint)
            elif method == "post":
                response = client.post(endpoint, json={})
            
            assert response.status_code == 403
            assert "Not authenticated" in response.json()["detail"]


class TestRoleBasedAccess:
    """Test role-based access control."""

    def test_admin_can_manage_users(self, client, admin_auth_headers, test_user):
        """Test that admin users can view and manage other users."""
        # Admin can get list of users
        response = client.get("/users", headers=admin_auth_headers)
        assert response.status_code == 200
        users = response.json()
        assert len(users) >= 2  # At least admin and test user
        
        # Admin can create a new user
        new_user_data = {
            "email": "created@example.com",
            "name": "Created User",
            "password": "password123"
        }
        response = client.post("/users", json=new_user_data, headers=admin_auth_headers)
        assert response.status_code == 201
        created_user = response.json()
        assert created_user["email"] == "created@example.com"

    def test_regular_user_cannot_access_admin_endpoints(self, client, auth_headers):
        """Test that regular users cannot access admin-only endpoints."""
        # Cannot get user list
        response = client.get("/users", headers=auth_headers)
        assert response.status_code == 403
        
        # Cannot create users
        new_user_data = {
            "email": "test@example.com",
            "name": "Test User",
            "password": "password123"
        }
        response = client.post("/users", json=new_user_data, headers=auth_headers)
        assert response.status_code == 403

    def test_superadmin_protection(self, client, admin_auth_headers, superadmin_user, db):
        """Test that superadmin cannot be deleted by regular admin."""
        # Regular admin cannot delete superadmin
        response = client.delete(
            f"/users/{superadmin_user.id}",
            headers=admin_auth_headers
        )
        assert response.status_code == 403
        
        # Verify superadmin still exists
        assert db.query(User).filter(User.id == superadmin_user.id).first() is not None

    def test_me_endpoint_works_with_valid_token(self, client, auth_headers, test_user):
        """Test that /auth/me returns current user info."""
        response = client.get("/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == test_user.email
        assert data["name"] == test_user.name
        assert data["id"] == test_user.id