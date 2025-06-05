import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.main import app
from app.database import SessionLocal, engine
from app.models import Base, User, Filament, Product, FilamentUsage
from app.auth import get_password_hash, create_access_token
from datetime import timedelta
import json


@pytest.fixture(scope="function")
def test_db():
    """Create a test database session with cleanup"""
    # Create tables
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # Clean up before test
    db.query(FilamentUsage).delete()
    db.query(Product).delete()
    db.query(Filament).delete()
    db.query(User).delete()
    db.commit()
    
    yield db
    
    # Clean up after test
    db.query(FilamentUsage).delete()
    db.query(Product).delete()
    db.query(Filament).delete()
    db.query(User).delete()
    db.commit()
    db.close()


@pytest.fixture
def test_user(test_db):
    """Create a test user"""
    user = User(
        email="test_delete@example.com",
        name="Test Delete User",
        hashed_password=get_password_hash("testpassword"),
        is_admin=False,
        is_superadmin=False,
        is_god_user=False,
        token_version=1
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture
def auth_headers(test_user, test_db):
    """Create authentication headers"""
    access_token = create_access_token(
        data={"sub": test_user.email, "token_version": test_user.token_version},
        db=test_db,
        expires_delta=timedelta(minutes=30)
    )
    return {"Authorization": f"Bearer {access_token}"}


@pytest.fixture
def test_filament(test_db):
    """Create a test filament"""
    filament = Filament(
        color="Blue",
        brand="TestBrand",
        material="PLA",
        price_per_kg=20.0,
        total_qty_kg=5.0
    )
    test_db.add(filament)
    test_db.commit()
    test_db.refresh(filament)
    return filament


@pytest.fixture
def test_product(test_db, test_filament, auth_headers):
    """Create a test product via API"""
    client = TestClient(app)
    
    # Create product via API
    product_data = {
        "name": "Product to Delete",
        "print_time": "1.5",
        "filament_ids": json.dumps([test_filament.id]),
        "grams_used_list": json.dumps([100])
    }
    
    response = client.post("/products", data=product_data, headers=auth_headers)
    assert response.status_code == 201
    return response.json()


class TestProductDeletion:
    """Test suite for product deletion functionality"""
    
    def test_delete_product_successfully(self, test_db, test_product, auth_headers):
        """Test that a product can be deleted successfully"""
        client = TestClient(app)
        product_id = test_product["id"]
        
        # Verify product exists before deletion
        response = client.get("/products", headers=auth_headers)
        assert response.status_code == 200
        products = response.json()
        assert len(products) == 1
        assert products[0]["id"] == product_id
        
        # Delete the product - THIS IS THE DESIRED BEHAVIOR
        response = client.delete(f"/products/{product_id}", headers=auth_headers)
        
        # EXPECTED: Should return 204 No Content on successful deletion
        assert response.status_code == 204
        
        # Verify product no longer exists
        response = client.get("/products", headers=auth_headers)
        assert response.status_code == 200
        products = response.json()
        assert len(products) == 0
        
        # Verify product and its associations are deleted from database
        assert test_db.query(Product).filter(Product.id == product_id).first() is None
        assert test_db.query(FilamentUsage).filter(FilamentUsage.product_id == product_id).count() == 0
    
    def test_delete_nonexistent_product(self, auth_headers):
        """Test deleting a product that doesn't exist"""
        client = TestClient(app)
        
        # Try to delete a non-existent product
        response = client.delete("/products/99999", headers=auth_headers)
        
        # EXPECTED: Should return 404 Not Found
        assert response.status_code == 404
        assert response.json()["detail"] == "Product not found"
    
    def test_delete_product_requires_authentication(self, test_product):
        """Test that deleting a product requires authentication"""
        client = TestClient(app)
        product_id = test_product["id"]
        
        # Try to delete without authentication
        response = client.delete(f"/products/{product_id}")
        
        # EXPECTED: Should return 401 Unauthorized or 403 Forbidden
        assert response.status_code in [401, 403]
        assert "Not authenticated" in response.json()["detail"]
    
    def test_delete_product_with_multiple_filament_usages(self, test_db, test_filament, auth_headers):
        """Test deleting a product that has multiple filament usages"""
        client = TestClient(app)
        
        # Create another filament for testing
        second_filament = Filament(
            color="Red",
            brand="TestBrand2",
            material="ABS",
            price_per_kg=25.0,
            total_qty_kg=3.0
        )
        test_db.add(second_filament)
        test_db.commit()
        test_db.refresh(second_filament)
        
        # Create a product with multiple filament usages
        product_data = {
            "name": "Product with Multiple Filaments",
            "print_time": "3.0",
            "filament_ids": json.dumps([test_filament.id, second_filament.id]),
            "grams_used_list": json.dumps([200, 150])
        }
        
        response = client.post("/products", data=product_data, headers=auth_headers)
        assert response.status_code == 201
        product = response.json()
        product_id = product["id"]
        
        # Delete the product
        response = client.delete(f"/products/{product_id}", headers=auth_headers)
        
        # EXPECTED: Should successfully delete product and all its filament usages
        assert response.status_code == 204
        
        # Verify product and filament usages are deleted
        assert test_db.query(Product).filter(Product.id == product_id).first() is None
        assert test_db.query(FilamentUsage).filter(FilamentUsage.product_id == product_id).count() == 0