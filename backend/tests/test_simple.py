"""
Simple test to verify the test setup is working.
"""


def test_basic_calculation():
    """Test that basic math works."""
    assert 2 + 2 == 4


def test_app_imports():
    """Test that we can import the app modules."""
    from app.models import User, Filament, Product
    from app.main import app
    
    assert User is not None
    assert Filament is not None
    assert Product is not None
    assert app is not None


def test_database_connection(client):
    """Test that we can connect to the test database."""
    response = client.get("/")
    assert response.status_code == 200