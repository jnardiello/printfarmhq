"""
Tests for enhanced God Admin metrics endpoints with activity tracking.
"""
import pytest
import json
from datetime import datetime, timedelta, date
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User, UserActivity, Product, PrintJob, Filament
from app.auth import get_password_hash


class TestEnhancedGodMetrics:
    """Test cases for enhanced God Admin metrics with activity tracking."""

    @pytest.fixture
    def god_user(self, db: Session) -> User:
        """Create a god user for testing."""
        user = User(
            email="god@test.com",
            name="God User",
            hashed_password=get_password_hash("password123"),
            is_active=True,
            is_admin=True,
            is_superadmin=True,
            is_god_user=True
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
            is_god_user=False
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

    def test_login_activity_tracking(self, client: TestClient, god_user: User, db: Session):
        """Test that login activity is properly tracked."""
        # Count initial activities
        initial_count = db.query(UserActivity).count()
        
        # Perform login
        response = client.post("/auth/login", json={
            "email": god_user.email,
            "password": "password123"
        })
        assert response.status_code == 200
        
        # Check that activity was logged
        activities = db.query(UserActivity).filter(
            UserActivity.user_id == god_user.id,
            UserActivity.activity_type == "login"
        ).all()
        
        assert len(activities) > 0
        latest_activity = activities[-1]
        assert latest_activity.activity_type == "login"
        assert latest_activity.user_id == god_user.id
        assert latest_activity.ip_address is not None
        assert latest_activity.activity_metadata is not None
        
        # Check metadata content
        metadata = json.loads(latest_activity.activity_metadata)
        assert metadata["email"] == god_user.email
        
        # Check user tracking fields were updated
        db.refresh(god_user)
        assert god_user.last_login is not None
        assert god_user.last_activity is not None
        assert god_user.login_count > 0

    def test_active_users_endpoint_authentication(self, client: TestClient):
        """Test that active users endpoint requires god user authentication."""
        # Test without authentication
        response = client.get("/god/metrics/active-users")
        assert response.status_code in [401, 403]

    def test_active_users_endpoint_god_only(self, client: TestClient, regular_auth_headers):
        """Test that regular users cannot access active users endpoint."""
        response = client.get("/god/metrics/active-users", headers=regular_auth_headers)
        assert response.status_code in [401, 403]

    def test_active_users_metrics(self, client: TestClient, auth_headers, god_user: User, regular_user: User, db: Session):
        """Test active users metrics calculation."""
        # Create some activity data
        today = datetime.utcnow()
        yesterday = today - timedelta(days=1)
        
        # Add some activities for today
        activities = [
            UserActivity(
                user_id=god_user.id,
                activity_type="login",
                activity_timestamp=today,
                activity_metadata=json.dumps({"test": "data"})
            ),
            UserActivity(
                user_id=regular_user.id,
                activity_type="create_product",
                activity_timestamp=today,
                activity_metadata=json.dumps({"product_id": 1})
            ),
            UserActivity(
                user_id=god_user.id,
                activity_type="login",
                activity_timestamp=yesterday,
                activity_metadata=json.dumps({"test": "data"})
            )
        ]
        
        for activity in activities:
            db.add(activity)
        db.commit()
        
        # Test the endpoint
        response = client.get("/god/metrics/active-users?days=3", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 3  # 3 days of data
        
        # Check structure
        for metric in data:
            assert "date" in metric
            assert "daily_active_users" in metric
            assert "weekly_active_users" in metric
            assert "monthly_active_users" in metric
            assert "new_vs_returning" in metric
            
            # Validate types
            assert isinstance(metric["daily_active_users"], int)
            assert isinstance(metric["weekly_active_users"], int)
            assert isinstance(metric["monthly_active_users"], int)
            assert isinstance(metric["new_vs_returning"], dict)

    def test_engagement_metrics(self, client: TestClient, auth_headers, god_user: User, db: Session):
        """Test engagement metrics calculation."""
        # Create activity data
        today = datetime.utcnow()
        
        activities = [
            UserActivity(
                user_id=god_user.id,
                activity_type="login",
                activity_timestamp=today.replace(hour=10),
                activity_metadata=json.dumps({"email": god_user.email})
            ),
            UserActivity(
                user_id=god_user.id,
                activity_type="create_product",
                activity_timestamp=today.replace(hour=10, minute=30),
                activity_metadata=json.dumps({"product_id": 1})
            ),
            UserActivity(
                user_id=god_user.id,
                activity_type="create_print_job",
                activity_timestamp=today.replace(hour=11),
                activity_metadata=json.dumps({"print_job_id": 1})
            )
        ]
        
        for activity in activities:
            db.add(activity)
        db.commit()
        
        # Test the endpoint
        response = client.get("/god/metrics/engagement?days=1", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 1
        
        today_metrics = data[0]
        assert today_metrics["total_logins"] >= 1
        assert today_metrics["unique_users_logged_in"] >= 1
        assert today_metrics["avg_actions_per_user"] >= 1.0
        assert today_metrics["peak_hour"] is not None
        assert isinstance(today_metrics["feature_usage"], dict)
        assert "login" in today_metrics["feature_usage"]

    def test_engagement_endpoint_authentication(self, client: TestClient, regular_auth_headers):
        """Test that engagement endpoint requires god user authentication."""
        response = client.get("/god/metrics/engagement", headers=regular_auth_headers)
        assert response.status_code in [401, 403]

    def test_metrics_date_format(self, client: TestClient, auth_headers):
        """Test that metrics return proper date formats."""
        response = client.get("/god/metrics/active-users?days=2", headers=auth_headers)
        assert response.status_code == 200
        
        data = response.json()
        for metric in data:
            # Check date format (YYYY-MM-DD)
            date_str = metric["date"]
            try:
                parsed_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                assert isinstance(parsed_date, date)
            except ValueError:
                pytest.fail(f"Invalid date format: {date_str}")

    def test_metrics_edge_cases(self, client: TestClient, auth_headers):
        """Test metrics endpoints with edge cases."""
        # Test with very small days parameter
        response = client.get("/god/metrics/active-users?days=1", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        
        # Test with larger days parameter
        response = client.get("/god/metrics/engagement?days=30", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 30

    def test_activity_metadata_structure(self, client: TestClient, god_user: User, db: Session):
        """Test that activity metadata is properly structured."""
        # Login to create activity
        response = client.post("/auth/login", json={
            "email": god_user.email,
            "password": "password123"
        })
        assert response.status_code == 200
        
        # Check the created activity
        activity = db.query(UserActivity).filter(
            UserActivity.user_id == god_user.id,
            UserActivity.activity_type == "login"
        ).order_by(UserActivity.activity_timestamp.desc()).first()
        
        assert activity is not None
        assert activity.activity_metadata is not None
        
        # Parse and validate metadata
        metadata = json.loads(activity.activity_metadata)
        assert isinstance(metadata, dict)
        assert "email" in metadata
        assert metadata["email"] == god_user.email

    def test_user_last_activity_updates(self, client: TestClient, god_user: User, db: Session):
        """Test that user last_activity field is updated correctly."""
        initial_last_activity = god_user.last_activity
        
        # Perform login
        response = client.post("/auth/login", json={
            "email": god_user.email,
            "password": "password123"
        })
        assert response.status_code == 200
        
        # Check that last_activity was updated
        db.refresh(god_user)
        if initial_last_activity is not None:
            assert god_user.last_activity > initial_last_activity
        else:
            assert god_user.last_activity is not None
        assert god_user.last_login is not None

    def test_comprehensive_metrics_flow(self, client: TestClient, auth_headers, god_user: User, regular_user: User, db: Session):
        """Test the complete metrics flow with realistic data."""
        # Simulate realistic user activity over time
        today = datetime.utcnow()
        
        # Day 1: God user logs in and creates product
        day1_activities = [
            UserActivity(
                user_id=god_user.id,
                activity_type="login",
                activity_timestamp=today - timedelta(days=2, hours=9),
                activity_metadata=json.dumps({"email": god_user.email})
            ),
            UserActivity(
                user_id=god_user.id,
                activity_type="create_product",
                activity_timestamp=today - timedelta(days=2, hours=9, minutes=30),
                activity_metadata=json.dumps({"product_id": 1, "product_name": "Test Product"})
            )
        ]
        
        # Day 2: Regular user logs in and creates print job
        day2_activities = [
            UserActivity(
                user_id=regular_user.id,
                activity_type="login",
                activity_timestamp=today - timedelta(days=1, hours=14),
                activity_metadata=json.dumps({"email": regular_user.email})
            ),
            UserActivity(
                user_id=regular_user.id,
                activity_type="create_print_job",
                activity_timestamp=today - timedelta(days=1, hours=14, minutes=30),
                activity_metadata=json.dumps({"print_job_id": 1, "print_job_name": "Test Job"})
            )
        ]
        
        # Today: Both users active
        today_activities = [
            UserActivity(
                user_id=god_user.id,
                activity_type="login",
                activity_timestamp=today.replace(hour=8),
                activity_metadata=json.dumps({"email": god_user.email})
            ),
            UserActivity(
                user_id=regular_user.id,
                activity_type="login",
                activity_timestamp=today.replace(hour=16),
                activity_metadata=json.dumps({"email": regular_user.email})
            )
        ]
        
        all_activities = day1_activities + day2_activities + today_activities
        for activity in all_activities:
            db.add(activity)
        db.commit()
        
        # Test active users metrics
        response = client.get("/god/metrics/active-users?days=3", headers=auth_headers)
        assert response.status_code == 200
        
        active_users_data = response.json()
        assert len(active_users_data) == 3
        
        # Today should have 2 active users
        today_metrics = active_users_data[-1]
        assert today_metrics["daily_active_users"] == 2
        
        # Test engagement metrics
        response = client.get("/god/metrics/engagement?days=3", headers=auth_headers)
        assert response.status_code == 200
        
        engagement_data = response.json()
        assert len(engagement_data) == 3
        
        # Check that feature usage is tracked correctly
        has_login_activity = any(
            "login" in day["feature_usage"] and day["feature_usage"]["login"] > 0
            for day in engagement_data
        )
        assert has_login_activity, "Should have login activity tracked"