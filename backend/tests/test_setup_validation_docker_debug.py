"""Debug setup validation for Docker environment"""
import pytest

def test_setup_validation_detailed(client, db):
    """Detailed debug of setup validation."""
    print("\n=== Setup Validation Debug (Docker) ===")
    
    # Test 1: Empty JSON object
    print("\nTest 1: Empty JSON object")
    response = client.post("/auth/setup", json={})
    print(f"Status: {response.status_code}")
    print(f"Expected: 422")
    if response.status_code != 422:
        print(f"FAIL: Response body: {response.json()}")
    assert response.status_code == 422, f"Expected 422, got {response.status_code}"
    
    # Test 2: Empty strings
    print("\nTest 2: Empty strings")
    response = client.post("/auth/setup", json={"email": "", "name": "", "password": ""})
    print(f"Status: {response.status_code}")
    print(f"Expected: 422")
    if response.status_code != 422:
        print(f"Response body: {response.json()}")
        if response.status_code == 200:
            print("ERROR: Empty strings were accepted! This should not happen with EmailStr validation.")
    assert response.status_code == 422, f"Expected 422, got {response.status_code}"
    
    # Test 3: Check schema validation is loaded
    print("\nTest 3: Invalid email")
    response = client.post("/auth/setup", json={"email": "not-an-email", "name": "Test", "password": "password123"})
    print(f"Status: {response.status_code}")
    print(f"Expected: 422")
    if response.status_code != 422:
        print(f"Response body: {response.json()}")
    
    # Test 4: Short password
    print("\nTest 4: Short password")
    response = client.post("/auth/setup", json={"email": "test@example.com", "name": "Test", "password": "short"})
    print(f"Status: {response.status_code}")
    print(f"Expected: 422")
    if response.status_code != 422:
        print(f"Response body: {response.json()}")
    
    print("\n=== End Debug ===")
    
    
def test_check_imports():
    """Check if pydantic imports are working correctly."""
    print("\n=== Import Check ===")
    try:
        from app.schemas import SetupRequest
        print(f"SetupRequest imported successfully")
        print(f"SetupRequest fields: {SetupRequest.model_fields}")
        
        # Try to create with empty strings
        try:
            req = SetupRequest(email="", name="", password="")
            print(f"ERROR: Empty strings accepted! Request: {req}")
        except Exception as e:
            print(f"Good: Empty strings rejected with error: {type(e).__name__}: {e}")
            
        # Try with valid data
        try:
            req = SetupRequest(email="test@example.com", name="Test", password="password123")
            print(f"Valid request created: {req}")
        except Exception as e:
            print(f"ERROR: Valid data rejected: {type(e).__name__}: {e}")
            
    except Exception as e:
        print(f"ERROR importing SetupRequest: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()