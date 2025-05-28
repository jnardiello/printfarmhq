# Task 11: Test Writing Guidelines

## Context Description
With the new test isolation infrastructure in place, we need clear guidelines for:
- Writing isolated tests
- Using fixtures effectively
- Handling test data
- Following best practices
- Maintaining test quality

## Purpose
Establish consistent patterns and best practices for writing tests that:
1. Run in complete isolation
2. Are maintainable and readable
3. Execute quickly and reliably
4. Provide clear failure messages
5. Follow team conventions

## Test Structure Guidelines

### Backend Test Structure
```python
# backend/tests/test_<module>_<type>.py

# Imports grouped and ordered
import pytest
from datetime import datetime, timedelta
from decimal import Decimal

from app.models import Filament, Product
from tests.builders import FilamentBuilder, ProductBuilder
from tests.helpers import APITestClient, APIAssertions

# Use clear test class names
class TestFilamentAPI:
    """Test filament API endpoints"""
    
    # Use descriptive test names that explain the scenario
    def test_create_filament_with_valid_data_returns_201(
        self,
        api_client: APITestClient,
        db_session
    ):
        """Test that creating a filament with valid data returns 201 and the created filament"""
        # Arrange - Set up test data
        filament_data = {
            "material": "PLA",
            "color": "Red",
            "brand": "TestBrand",
            "price_per_kg": 25.99
        }
        
        # Act - Perform the action
        status, response_data = api_client.post('/api/filaments', json=filament_data)
        
        # Assert - Verify the result
        assert status == 201
        APIAssertions.assert_valid_uuid(response_data['id'])
        assert response_data['material'] == filament_data['material']
        assert response_data['color'] == filament_data['color']
        assert response_data['available_grams'] == 0  # New filament has no inventory
        
        # Verify database state
        db_filament = db_session.query(Filament).filter_by(id=response_data['id']).first()
        assert db_filament is not None
        assert db_filament.color == filament_data['color']
    
    def test_create_filament_without_auth_returns_401(
        self,
        api_client: APITestClient
    ):
        """Test that creating a filament without authentication returns 401"""
        # Arrange
        unauth_client = api_client.without_auth()
        filament_data = {"material": "PLA", "color": "Blue", "price_per_kg": 20.00}
        
        # Act & Assert
        status, response_data = unauth_client.post(
            '/api/filaments',
            json=filament_data,
            expected_status=401
        )
        APIAssertions.assert_error_response(response_data, "Not authenticated")
    
    @pytest.mark.parametrize("invalid_data,expected_error", [
        ({}, "Field required"),  # Missing all fields
        ({"material": "PLA"}, "Field required"),  # Missing color and price
        ({"material": "INVALID", "color": "Red", "price_per_kg": 25}, "Invalid material"),
        ({"material": "PLA", "color": "Red", "price_per_kg": -10}, "Price must be positive"),
    ])
    def test_create_filament_with_invalid_data_returns_422(
        self,
        api_client: APITestClient,
        invalid_data,
        expected_error
    ):
        """Test that creating a filament with invalid data returns 422 with validation errors"""
        # Act
        status, response_data = api_client.post(
            '/api/filaments',
            json=invalid_data,
            expected_status=422
        )
        
        # Assert
        assert "detail" in response_data
        assert any(expected_error in str(error) for error in response_data["detail"])
```

### Frontend Test Structure
```typescript
// frontend/e2e/tests/filaments.spec.ts

import { test, expect } from '../fixtures'
import { FilamentsPage } from '../pages/filaments.page'
import { APITestClient } from '../helpers/api-test-client'

// Describe the feature being tested
test.describe('Filament Management', () => {
  let filamentsPage: FilamentsPage
  let api: APITestClient

  // Setup that runs before each test
  test.beforeEach(async ({ page, authenticatedPage }) => {
    filamentsPage = new FilamentsPage(authenticatedPage)
    api = new APITestClient(page.request, page)
    
    // Navigate to the filaments page
    await filamentsPage.goto()
  })

  // Use descriptive test names
  test('should display empty state when no filaments exist', async () => {
    // Assert - Verify empty state is shown
    await expect(filamentsPage.emptyState).toBeVisible()
    await expect(filamentsPage.emptyState).toContainText('No filaments found')
  })

  test('should create filament via UI and display in list', async () => {
    // Arrange - Define test data
    const filamentData = {
      material: 'PLA',
      color: 'Bright Red',
      brand: 'TestBrand',
      pricePerKg: 25.99
    }

    // Act - Create filament through UI
    await filamentsPage.createFilament(filamentData)

    // Assert - Verify filament appears in list
    await expect(filamentsPage.filamentList).toContainText(filamentData.color)
    await expect(filamentsPage.getFilamentCount()).resolves.toBe(1)
    
    // Verify via API that filament was created
    const { data: filaments } = await api.get('/api/filaments')
    expect(filaments).toHaveLength(1)
    expect(filaments[0].color).toBe(filamentData.color)
  })

  test('should handle concurrent filament operations', async ({ page }) => {
    // Arrange - Create multiple filaments via API
    const filamentPromises = Array(5).fill(null).map((_, i) => 
      api.createFilament({
        material: 'PLA',
        color: `Color ${i}`,
        price_per_kg: 20 + i
      })
    )
    
    await Promise.all(filamentPromises)

    // Act - Refresh page
    await page.reload()

    // Assert - All filaments should be visible
    await expect(filamentsPage.getFilamentCount()).resolves.toBe(5)
  })

  // Parameterized tests
  const invalidInputs = [
    { field: 'price', value: '-10', error: 'Price must be positive' },
    { field: 'price', value: 'abc', error: 'Invalid number' },
    { field: 'color', value: '', error: 'Color is required' }
  ]

  invalidInputs.forEach(({ field, value, error }) => {
    test(`should show validation error for invalid ${field}`, async () => {
      // Act - Try to create with invalid data
      await filamentsPage.addButton.click()
      await filamentsPage[`${field}Input`].fill(value)
      await filamentsPage.saveButton.click()

      // Assert - Validation error shown
      await expect(page.locator(`text=${error}`)).toBeVisible()
    })
  })
})
```

## Best Practices

### 1. Test Naming Conventions
```python
# Backend: test_<action>_<condition>_<expected_result>
def test_create_product_without_filaments_returns_400():
    pass

def test_update_filament_color_updates_database():
    pass

# Frontend: should <action> when <condition>
test('should display error when network request fails', async () => {})
test('should update inventory count after purchase', async () => {})
```

### 2. Arrange-Act-Assert Pattern
```python
def test_calculate_cogs_includes_all_components(print_job_factory, db_session):
    # Arrange - Set up all test data
    job = print_job_factory\
        .with_products(count=3)\
        .with_packaging_cost(5.00)\
        .build(db_session)
    
    # Act - Perform the action being tested
    cogs = calculate_print_job_cogs(job, db_session)
    
    # Assert - Verify the results
    assert cogs > 0
    assert cogs == job.total_material_cost + job.total_printer_cost + job.packaging_cost_eur
```

### 3. Use Builders for Test Data
```python
# DON'T - Hardcoded test data
def test_bad_example(db_session):
    filament = Filament(
        id=str(uuid.uuid4()),
        material="PLA",
        color="Red",
        brand="Generic",
        price_per_kg=25.99,
        available_grams=0
    )
    db_session.add(filament)
    db_session.flush()

# DO - Use builders
def test_good_example(filament_factory, db_session):
    filament = filament_factory\
        .with_material("PLA")\
        .with_color("Red")\
        .with_inventory(1000)\
        .build(db_session)
```

### 4. Test One Thing at a Time
```python
# DON'T - Testing multiple behaviors
def test_filament_crud_operations():
    # Creates, updates, and deletes in one test
    pass

# DO - Separate tests for each operation
def test_create_filament_saves_to_database():
    pass

def test_update_filament_changes_color():
    pass

def test_delete_filament_removes_from_database():
    pass
```

### 5. Use Descriptive Assertions
```python
# DON'T - Generic assertions
assert response.status_code == 200
assert len(data) > 0

# DO - Descriptive assertions with context
assert response.status_code == 200, f"Expected successful response, got {response.status_code}: {response.text}"
assert len(data) == 3, f"Expected 3 filaments, got {len(data)}"
```

### 6. Handle Async Operations Properly
```typescript
// DON'T - Not waiting for operations
test('bad async example', async ({ page }) => {
  page.click('button')  // Missing await!
  expect(page.locator('.result')).toBeVisible()  // Will fail
})

// DO - Proper async handling
test('good async example', async ({ page }) => {
  await page.click('button')
  await expect(page.locator('.result')).toBeVisible()
})
```

### 7. Clean Test Data References
```python
# DON'T - Hardcoded IDs and values
def test_hardcoded_values():
    response = client.get("/api/filaments/123e4567-e89b-12d3-a456-426614174000")
    assert response.json()["color"] == "Red"

# DO - Use created data
def test_dynamic_values(filament_factory, api_client):
    filament = filament_factory.build()
    response = api_client.get(f"/api/filaments/{filament.id}")
    assert response.json()["color"] == filament.color
```

## Common Patterns

### Testing Error Scenarios
```python
class TestErrorHandling:
    def test_404_for_nonexistent_resource(self, api_client):
        fake_id = str(uuid.uuid4())
        status, data = api_client.get(
            f'/api/filaments/{fake_id}',
            expected_status=404
        )
        assert "not found" in data["detail"].lower()
    
    def test_conflict_on_duplicate_sku(self, api_client, product_factory):
        # Create first product
        product = product_factory.build()
        
        # Try to create another with same SKU
        status, data = api_client.post(
            '/api/products',
            json={"sku": product.sku, "name": "Duplicate"},
            expected_status=409
        )
        assert "already exists" in data["detail"]
```

### Testing Permissions
```python
@pytest.mark.parametrize("user_type,expected_status", [
    ("anonymous", 401),
    ("regular", 403),
    ("admin", 200),
])
def test_admin_endpoint_permissions(
    request,
    user_type,
    expected_status,
    api_client_factory
):
    # Get appropriate client
    if user_type == "anonymous":
        client = api_client_factory.anonymous()
    elif user_type == "regular":
        client = api_client_factory.regular_user()
    else:
        client = api_client_factory.admin()
    
    # Test access
    status, _ = client.get('/api/admin/users', expected_status=expected_status)
```

### Testing Complex Workflows
```python
def test_complete_order_workflow(scenario_builder, api_client):
    # Build complete scenario
    scenario = scenario_builder\
        .with_inventory_setup(filament_count=5)\
        .with_product_catalog(product_count=3)\
        .build()
    
    # Create order
    order_data = {
        "products": [
            {"product_id": p.id, "quantity": 2}
            for p in scenario["products"][:2]
        ]
    }
    
    status, order = api_client.post('/api/orders', json=order_data)
    assert status == 201
    
    # Process order
    status, _ = api_client.post(f'/api/orders/{order["id"]}/process')
    assert status == 200
    
    # Verify inventory was updated
    for product in scenario["products"][:2]:
        status, updated_product = api_client.get(f'/api/products/{product.id}')
        # Assert inventory changes
```

## Testing Checklist

### Before Writing a Test
- [ ] Is this testing a single behavior?
- [ ] Do I have appropriate fixtures available?
- [ ] Should this be a unit or integration test?
- [ ] Are there existing similar tests I can reference?

### While Writing a Test
- [ ] Am I using the Arrange-Act-Assert pattern?
- [ ] Are my test names descriptive?
- [ ] Am I using appropriate fixtures?
- [ ] Are assertions clear with good error messages?
- [ ] Is the test isolated from others?

### After Writing a Test
- [ ] Does the test pass consistently?
- [ ] Does it fail when the code is broken?
- [ ] Is it fast enough (< 1 second for unit tests)?
- [ ] Will other developers understand it?
- [ ] Have I avoided hardcoded values?

## Common Mistakes to Avoid

1. **Shared State Between Tests**
```python
# DON'T
class TestWithSharedState:
    shared_filament = None
    
    def test_create(self):
        self.shared_filament = create_filament()  # BAD!
    
    def test_update(self):
        update_filament(self.shared_filament)  # Will fail!
```

2. **Not Cleaning Up After Tests**
```python
# DON'T
def test_creates_temp_file():
    with open('/tmp/test.txt', 'w') as f:
        f.write('test')
    # File remains after test!

# DO
def test_creates_temp_file():
    import tempfile
    with tempfile.NamedTemporaryFile() as f:
        f.write(b'test')
    # File automatically cleaned up
```

3. **Testing Implementation Instead of Behavior**
```python
# DON'T - Testing internals
def test_uses_specific_algorithm():
    assert calculator._internal_method() == "quicksort"

# DO - Testing behavior
def test_sorts_numbers_correctly():
    assert calculator.sort([3, 1, 2]) == [1, 2, 3]
```

4. **Overly Complex Tests**
```python
# DON'T - Too many things in one test
def test_everything():
    # 200 lines of test code...

# DO - Focused tests
def test_calculates_simple_cogs():
    # 10-20 lines focused on one scenario
```

## Success Metrics
- All tests follow consistent patterns
- New developers can write tests easily
- Tests are self-documenting
- Low test maintenance burden
- High confidence in test suite