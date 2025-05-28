# Task 03: Backend Fixture Refactoring

## Context Description
Current fixtures in conftest.py are not optimized for test isolation:
- Session-scoped fixtures persist data between tests
- Authentication fixtures don't use transactional sessions
- Client fixture doesn't properly integrate with database transactions
- No clear separation between integration and unit test fixtures

## Desired Solution
Refactor all fixtures to:
1. Use function scope for proper isolation
2. Integrate with transaction management
3. Provide both authenticated and unauthenticated clients
4. Support different user roles easily
5. Enable fast test execution

## Implementation Steps

### Step 1: Refactor Client Fixture
```python
# backend/tests/conftest.py
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with database session override"""
    # Client will use the overridden get_db from db_session fixture
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture(scope="function")
def unauthenticated_client(client):
    """Alias for clarity in tests"""
    return client
```

### Step 2: Create Authentication Fixtures
```python
# backend/tests/conftest.py
from app.auth import create_access_token
from datetime import timedelta

@pytest.fixture
def auth_token(user_factory):
    """Create a valid auth token for a regular user"""
    user = user_factory()
    token = create_access_token(
        data={"sub": user.email, "token_version": user.token_version}
    )
    return token

@pytest.fixture
def auth_headers(auth_token):
    """Headers with regular user authentication"""
    return {"Authorization": f"Bearer {auth_token}"}

@pytest.fixture
def admin_token(user_factory):
    """Create a valid auth token for an admin user"""
    admin = user_factory(admin=True)
    token = create_access_token(
        data={"sub": admin.email, "token_version": admin.token_version}
    )
    return token

@pytest.fixture
def admin_headers(admin_token):
    """Headers with admin authentication"""
    return {"Authorization": f"Bearer {admin_token}"}

@pytest.fixture
def superadmin_token(user_factory):
    """Create a valid auth token for a superadmin user"""
    superadmin = user_factory(superadmin=True)
    token = create_access_token(
        data={"sub": superadmin.email, "token_version": superadmin.token_version}
    )
    return token

@pytest.fixture
def superadmin_headers(superadmin_token):
    """Headers with superadmin authentication"""
    return {"Authorization": f"Bearer {superadmin_token}"}
```

### Step 3: Create User Fixtures
```python
# backend/tests/conftest.py
@pytest.fixture
def regular_user(user_factory):
    """Create a regular user"""
    return user_factory()

@pytest.fixture
def admin_user(user_factory):
    """Create an admin user"""
    return user_factory(admin=True)

@pytest.fixture
def superadmin_user(user_factory):
    """Create a superadmin user"""
    return user_factory(superadmin=True)

@pytest.fixture
def inactive_user(user_factory):
    """Create an inactive user"""
    return user_factory(inactive=True)

# Combined fixtures for common patterns
@pytest.fixture
def auth_user_with_headers(user_factory):
    """Create a user with their auth headers"""
    user = user_factory()
    token = create_access_token(
        data={"sub": user.email, "token_version": user.token_version}
    )
    headers = {"Authorization": f"Bearer {token}"}
    return user, headers

@pytest.fixture
def admin_with_headers(user_factory):
    """Create an admin with their auth headers"""
    admin = user_factory(admin=True)
    token = create_access_token(
        data={"sub": admin.email, "token_version": admin.token_version}
    )
    headers = {"Authorization": f"Bearer {token}"}
    return admin, headers
```

### Step 4: Create Authenticated Client Fixtures
```python
# backend/tests/conftest.py
class AuthenticatedClient:
    """Wrapper for test client with automatic auth headers"""
    
    def __init__(self, client, headers):
        self.client = client
        self.headers = headers
    
    def request(self, method: str, url: str, **kwargs):
        """Make request with auth headers"""
        kwargs.setdefault('headers', {}).update(self.headers)
        return self.client.request(method, url, **kwargs)
    
    def get(self, url: str, **kwargs):
        return self.request("GET", url, **kwargs)
    
    def post(self, url: str, **kwargs):
        return self.request("POST", url, **kwargs)
    
    def put(self, url: str, **kwargs):
        return self.request("PUT", url, **kwargs)
    
    def delete(self, url: str, **kwargs):
        return self.request("DELETE", url, **kwargs)
    
    def patch(self, url: str, **kwargs):
        return self.request("PATCH", url, **kwargs)

@pytest.fixture
def auth_client(client, auth_headers):
    """Client authenticated as regular user"""
    return AuthenticatedClient(client, auth_headers)

@pytest.fixture
def admin_client(client, admin_headers):
    """Client authenticated as admin"""
    return AuthenticatedClient(client, admin_headers)

@pytest.fixture
def superadmin_client(client, superadmin_headers):
    """Client authenticated as superadmin"""
    return AuthenticatedClient(client, superadmin_headers)
```

### Step 5: Create Data Setup Fixtures
```python
# backend/tests/conftest.py
@pytest.fixture
def setup_filament_inventory(filament_factory, purchase_factory):
    """Create filaments with inventory"""
    def _setup(count=3):
        filaments = []
        for i in range(count):
            filament = filament_factory()
            # Add some inventory
            purchase_factory(filament=filament, grams=1000 * (i + 1))
            filaments.append(filament)
        return filaments
    return _setup

@pytest.fixture
def setup_complete_product(product_factory, filament_factory):
    """Create a product with all relationships"""
    def _setup(name="Test Product", filament_count=2):
        filaments = filament_factory.create_batch(filament_count)
        product = product_factory(
            name=name,
            filament_usages=[
                {"filament": f, "grams_used": 50}
                for f in filaments
            ]
        )
        return product
    return _setup

@pytest.fixture
def setup_print_job_with_data(print_job_factory, product_factory, printer_factory):
    """Create a complete print job setup"""
    def _setup():
        products = product_factory.create_batch(2)
        printers = printer_factory.create_batch(2)
        
        job = print_job_factory(
            products=products,
            printers=printers
        )
        return job
    return _setup
```

### Step 6: Remove Old Fixtures
```python
# Remove these patterns:
# - @pytest.fixture(scope="session")
# - @pytest.fixture(scope="module")
# - Global state fixtures
# - Fixtures that use real database commits
# - setup_test_data.py dependencies

# Old fixture to remove:
@pytest.fixture(scope="session")
def test_db():
    # This creates persistent state
    engine = create_engine(...)
    # ...
    
# Replace with function-scoped fixtures
```

### Step 7: Update Test Usage
```python
# backend/tests/test_filament_api.py

# OLD WAY
def test_create_filament(client, superadmin_headers, test_db):
    response = client.post(
        "/api/filaments",
        json={"material": "PLA", "color": "Red"},
        headers=superadmin_headers
    )
    
# NEW WAY
def test_create_filament(superadmin_client):
    response = superadmin_client.post(
        "/api/filaments",
        json={"material": "PLA", "color": "Red"}
    )
    assert response.status_code == 201

# Using factories
def test_update_filament(admin_client, filament_factory):
    filament = filament_factory(color="Blue")
    
    response = admin_client.put(
        f"/api/filaments/{filament.id}",
        json={"color": "Red"}
    )
    assert response.status_code == 200
    assert response.json()["color"] == "Red"

# Complex test with multiple fixtures
def test_complete_workflow(
    admin_client,
    setup_filament_inventory,
    setup_complete_product,
    print_job_factory
):
    # Setup inventory
    filaments = setup_filament_inventory(count=5)
    
    # Create product
    product = setup_complete_product(filament_count=3)
    
    # Create print job
    job = print_job_factory(products=[product])
    
    # Test API
    response = admin_client.get(f"/api/print-jobs/{job.id}/cogs")
    assert response.status_code == 200
```

## Guidelines for Implementation

### DO:
1. **Use function scope** for all database-related fixtures
2. **Create focused fixtures** with single responsibilities
3. **Use factory fixtures** for data creation
4. **Provide convenient wrappers** like AuthenticatedClient
5. **Document fixture purpose** and usage

### DON'T:
1. **Don't use session/module scope** for stateful fixtures
2. **Don't create fixtures with side effects**
3. **Don't hardcode test data** in fixtures
4. **Don't make fixtures too complex**
5. **Don't forget to clean up** resources

### Migration Strategy
1. Create new fixtures alongside old ones
2. Update tests one module at a time
3. Run tests to ensure compatibility
4. Remove old fixtures once migrated
5. Update documentation

### Performance Considerations
```python
# Use pytest-xdist for parallel execution
# pytest -n auto

# Mark slow tests
@pytest.mark.slow
def test_complex_scenario():
    pass

# Create lighter fixtures for unit tests
@pytest.fixture
def mock_db_session():
    """Mock session for unit tests"""
    return Mock(spec=Session)
```

### Common Patterns
```python
# Parametrized auth tests
@pytest.mark.parametrize("client_fixture,expected_status", [
    ("unauthenticated_client", 401),
    ("auth_client", 403),
    ("admin_client", 200),
])
def test_admin_endpoint(request, client_fixture, expected_status):
    client = request.getfixturevalue(client_fixture)
    response = client.get("/api/admin/users")
    assert response.status_code == expected_status

# Fixture composition
@pytest.fixture
def complete_test_setup(
    admin_user,
    setup_filament_inventory,
    setup_complete_product
):
    """Combine multiple fixtures for complex tests"""
    return {
        "user": admin_user,
        "filaments": setup_filament_inventory(5),
        "products": [setup_complete_product() for _ in range(3)]
    }
```

### Success Metrics
- All fixtures use function scope
- No shared state between tests
- Test execution time reduced
- Easier to understand test setup
- No fixture-related test failures