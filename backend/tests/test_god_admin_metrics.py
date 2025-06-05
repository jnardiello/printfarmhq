"""
Tests for God Admin metrics endpoints.
"""
import pytest
from datetime import datetime, timedelta, date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User, Product, PrintJob, Filament
from app.auth import get_password_hash


class TestGodAdminMetrics:
    """Test cases for God Admin metrics endpoints."""

    @pytest.fixture
    def god_user(self, db: Session) -> User:
        """Create a god user for testing."""
        # Create base user first
        user = User(
            email="god@test.com",
            name="God User",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            is_admin=True,
            is_superadmin=True,
            is_god_user=True,
            token_version=1,
            login_count=0
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @pytest.fixture
    def regular_user(self, db: Session) -> User:
        """Create a regular user for testing."""
        user = User(
            email="user@test.com",
            name="Regular User",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            is_admin=False,
            is_superadmin=False,
            is_god_user=False,
            token_version=1,
            login_count=0
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @pytest.fixture
    def superadmin_user(self, db: Session) -> User:
        """Create a superadmin user for testing."""
        user = User(
            email="super@test.com",
            name="Super Admin",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            is_admin=True,
            is_superadmin=True,
            is_god_user=False,
            token_version=1,
            login_count=0
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @pytest.fixture
    def auth_headers(self, client: TestClient, god_user: User):
        """Get authentication headers for god user."""
        response = client.post("/auth/login", json={
            "email": god_user.email,
            "password": "password123"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    @pytest.fixture
    def regular_auth_headers(self, client: TestClient, regular_user: User):
        """Get authentication headers for regular user."""
        response = client.post("/auth/login", json={
            "email": regular_user.email,
            "password": "password123"
        })
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    def test_god_metrics_users_endpoint_authentication(self, client: TestClient, god_user: User):
        """Test that metrics endpoints require god user authentication."""
        # Test without authentication
        response = client.get("/god/metrics/users")
        assert response.status_code == 403

        # Test with non-existent user credentials (should fail)
        response = client.post("/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        })
        
        # Should fail because user doesn't exist
        assert response.status_code == 401

    def test_god_metrics_users_success(self, client: TestClient, auth_headers, god_user: User, regular_user: User, superadmin_user: User):
        """Test successful user metrics retrieval."""
        response = client.get("/god/metrics/users?days=7", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 7  # 7 days of metrics
        
        # Check structure of response
        for metric in data:
            assert "date" in metric
            assert "total_count" in metric
            assert "superadmins" in metric
            assert "regular_users" in metric
            assert isinstance(metric["total_count"], int)
            assert isinstance(metric["superadmins"], int)
            assert isinstance(metric["regular_users"], int)

    def test_god_metrics_products_success(self, client: TestClient, auth_headers, god_user: User, db: Session):
        """Test successful product metrics retrieval."""
        # Create test products with different creation dates
        today = datetime.utcnow()
        yesterday = today - timedelta(days=1)
        
        # Create product for today
        product1 = Product(
            sku="TEST-001",
            name="Test Product 1",
            owner_id=god_user.id,
            created_at=today
        )
        
        # Create product for yesterday
        product2 = Product(
            sku="TEST-002", 
            name="Test Product 2",
            owner_id=god_user.id,
            created_at=yesterday
        )
        
        db.add_all([product1, product2])
        db.commit()

        response = client.get("/god/metrics/products?days=3", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 3  # 3 days of metrics
        
        # Check that we have counts for today and yesterday
        dates_with_counts = [metric for metric in data if metric["total_count"] > 0]
        assert len(dates_with_counts) >= 1  # At least today should have products

    def test_god_metrics_print_jobs_success(self, client: TestClient, auth_headers, god_user: User, db: Session):
        """Test successful print job metrics retrieval."""
        # Create test print jobs
        today = datetime.utcnow()
        
        job1 = PrintJob(
            name="Test Job 1",
            owner_id=god_user.id,
            created_at=today
        )
        
        job2 = PrintJob(
            name="Test Job 2", 
            owner_id=god_user.id,
            created_at=today
        )
        
        db.add_all([job1, job2])
        db.commit()

        response = client.get("/god/metrics/print-jobs?days=1", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1  # 1 day of metrics
        
        # Today should have 2 print jobs
        today_metric = data[0]
        assert today_metric["total_count"] == 2

    def test_god_metrics_summary_success(self, client: TestClient, auth_headers, god_user: User):
        """Test successful metrics summary retrieval."""
        response = client.get("/god/metrics/summary?days=7", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert "users" in data
        assert "products" in data  
        assert "print_jobs" in data
        
        # Check that each section has 7 days of data
        assert len(data["users"]) == 7
        assert len(data["products"]) == 7
        assert len(data["print_jobs"]) == 7

    def test_god_metrics_invalid_days_parameter(self, client: TestClient, auth_headers):
        """Test metrics endpoints with invalid days parameter."""
        # Test negative days - API might accept and handle gracefully
        response = client.get("/god/metrics/users?days=-1", headers=auth_headers)
        # Accept either 200 (handled gracefully) or 422 (validation error)
        assert response.status_code in [200, 422]

        # Test zero days  
        response = client.get("/god/metrics/users?days=0", headers=auth_headers)
        # This might be valid depending on implementation
        assert response.status_code in [200, 422]

    def test_god_metrics_large_days_parameter(self, client: TestClient, auth_headers):
        """Test metrics endpoints with large days parameter."""
        # Test very large days (should still work but might be slow)
        response = client.get("/god/metrics/users?days=365", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 365

    def test_god_metrics_access_denied_for_non_god_users(self, client: TestClient, regular_auth_headers):
        """Test that non-god users cannot access metrics endpoints."""
        # This test assumes we have a way to authenticate as a non-god user
        # The actual implementation may vary based on how authentication is handled
        
        endpoints = [
            "/god/metrics/users",
            "/god/metrics/products", 
            "/god/metrics/print-jobs",
            "/god/metrics/summary"
        ]
        
        for endpoint in endpoints:
            response = client.get(endpoint, headers=regular_auth_headers)
            assert response.status_code in [401, 403]  # Unauthorized or Forbidden

    def test_god_metrics_empty_database(self, client: TestClient, auth_headers, god_user: User):
        """Test metrics endpoints with empty database (only god user exists)."""
        response = client.get("/god/metrics/users?days=1", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert len(data) == 1
        
        # Should have at least the god user
        today_metric = data[0]
        assert today_metric["total_count"] >= 1
        assert today_metric["superadmins"] >= 1

    def test_god_metrics_date_format(self, client: TestClient, auth_headers):
        """Test that metrics endpoints return proper date formats."""
        response = client.get("/god/metrics/users?days=2", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        for metric in data:
            # Check that date is in proper format (YYYY-MM-DD)
            date_str = metric["date"]
            try:
                parsed_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                assert isinstance(parsed_date, date)
            except ValueError:
                pytest.fail(f"Invalid date format: {date_str}")

    def test_god_metrics_data_consistency(self, client: TestClient, auth_headers, god_user: User, superadmin_user: User, regular_user: User):
        """Test that user metrics data is consistent."""
        response = client.get("/god/metrics/users?days=1", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        today_metric = data[0]
        
        # Total count should equal superadmins + regular_users
        assert today_metric["total_count"] == today_metric["superadmins"] + today_metric["regular_users"]
        
        # Should have at least 2 superadmins (god_user and superadmin_user)
        assert today_metric["superadmins"] >= 2
        
        # Should have at least 1 regular user
        assert today_metric["regular_users"] >= 1