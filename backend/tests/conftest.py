"""
Shared test configuration and fixtures for PrintFarmHQ backend tests.
"""
import os
import tempfile
from typing import Generator
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Remove environment variables that are now database-based

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
from app.database import Base, SessionLocal
from app.main import app, get_db
from app.models import User, AppConfig  # Import AppConfig to ensure table creation
from app.auth import get_password_hash


@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    db_session = TestingSessionLocal()
    try:
        yield db_session
    finally:
        db_session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    """Create a test client with the test database."""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    # Also override auth.get_db
    from app.auth import get_db as auth_get_db
    app.dependency_overrides[auth_get_db] = override_get_db
    
    with TestClient(app) as test_client:
        yield test_client
    
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db):
    """Create a test user."""
    user = User(
        email="test@example.com",
        name="Test User",
        hashed_password=get_password_hash("testpassword"),
        is_admin=False,
        is_superadmin=False,
        token_version=0
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_user(db):
    """Create an admin user."""
    user = User(
        email="admin@example.com",
        name="Admin User",
        hashed_password=get_password_hash("adminpassword"),
        is_admin=True,
        is_superadmin=False,
        token_version=0
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def superadmin_user(db):
    """Create a superadmin user."""
    user = User(
        email="superadmin@example.com",
        name="Superadmin User",
        hashed_password=get_password_hash("superadminpassword"),
        is_admin=True,
        is_superadmin=True,
        token_version=0
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def auth_headers(client, test_user):
    """Get authorization headers for a regular user."""
    response = client.post(
        "/auth/login",
        json={"email": "test@example.com", "password": "testpassword"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_auth_headers(client, admin_user):
    """Get authorization headers for an admin user."""
    response = client.post(
        "/auth/login",
        json={"email": "admin@example.com", "password": "adminpassword"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def temp_upload_dir():
    """Create a temporary directory for file uploads."""
    with tempfile.TemporaryDirectory() as temp_dir:
        # Override the upload directory in the app
        original_upload_dir = os.environ.get("UPLOAD_DIR", "uploads")
        os.environ["UPLOAD_DIR"] = temp_dir
        yield temp_dir
        os.environ["UPLOAD_DIR"] = original_upload_dir