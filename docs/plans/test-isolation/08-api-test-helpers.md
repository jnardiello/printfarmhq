# Task 08: API Test Helpers

## Context Description
Both frontend and backend tests need to interact with APIs for:
- Creating test data quickly
- Verifying API responses
- Testing error scenarios
- Performing complex operations
- Cleaning up data

Currently, this leads to duplicate code and inconsistent patterns.

## Desired Solution
Create comprehensive API test helpers that:
1. Provide type-safe API interactions
2. Handle authentication automatically
3. Support both success and error testing
4. Enable quick test data setup
5. Offer consistent patterns for both frontend and backend

## Implementation Steps

### Step 1: Backend API Test Helpers
```python
# backend/tests/helpers/api_client.py
from typing import Optional, Dict, Any, List
from fastapi.testclient import TestClient
import json

class APITestClient:
    """Enhanced test client with authentication and helpers"""
    
    def __init__(self, client: TestClient, auth_token: Optional[str] = None):
        self.client = client
        self._auth_token = auth_token
        self._default_headers = {}
        
        if auth_token:
            self._default_headers['Authorization'] = f'Bearer {auth_token}'
    
    def with_auth(self, token: str) -> 'APITestClient':
        """Create new client with different auth token"""
        return APITestClient(self.client, token)
    
    def without_auth(self) -> 'APITestClient':
        """Create client without authentication"""
        return APITestClient(self.client, None)
    
    def _make_request(
        self,
        method: str,
        url: str,
        expected_status: Optional[int] = None,
        **kwargs
    ) -> tuple[int, Any]:
        """Make request with default headers"""
        headers = kwargs.pop('headers', {})
        headers.update(self._default_headers)
        
        response = getattr(self.client, method)(
            url,
            headers=headers,
            **kwargs
        )
        
        if expected_status is not None:
            assert response.status_code == expected_status, \
                f"Expected {expected_status}, got {response.status_code}: {response.text}"
        
        try:
            data = response.json() if response.content else None
        except json.JSONDecodeError:
            data = response.text
        
        return response.status_code, data
    
    # CRUD operations
    def get(self, url: str, expected_status: Optional[int] = 200, **kwargs):
        return self._make_request('get', url, expected_status, **kwargs)
    
    def post(self, url: str, expected_status: Optional[int] = 201, **kwargs):
        return self._make_request('post', url, expected_status, **kwargs)
    
    def put(self, url: str, expected_status: Optional[int] = 200, **kwargs):
        return self._make_request('put', url, expected_status, **kwargs)
    
    def patch(self, url: str, expected_status: Optional[int] = 200, **kwargs):
        return self._make_request('patch', url, expected_status, **kwargs)
    
    def delete(self, url: str, expected_status: Optional[int] = 204, **kwargs):
        return self._make_request('delete', url, expected_status, **kwargs)
    
    # Resource-specific helpers
    def create_filament(self, **data) -> Dict[str, Any]:
        """Create filament and return it"""
        status, filament = self.post('/api/filaments', json=data)
        return filament
    
    def create_product(self, **data) -> Dict[str, Any]:
        """Create product and return it"""
        status, product = self.post('/api/products', json=data)
        return product
    
    def get_all(self, resource: str) -> List[Dict[str, Any]]:
        """Get all items of a resource type"""
        status, items = self.get(f'/api/{resource}')
        return items
    
    def delete_all(self, resource: str) -> int:
        """Delete all items of a resource type"""
        items = self.get_all(resource)
        count = 0
        
        for item in items:
            status, _ = self.delete(
                f'/api/{resource}/{item["id"]}',
                expected_status=None
            )
            if status == 204:
                count += 1
        
        return count
```

### Step 2: Response Assertion Helpers
```python
# backend/tests/helpers/assertions.py
from typing import Any, Dict, List, Optional
import json

class APIAssertions:
    """Assertions for API responses"""
    
    @staticmethod
    def assert_valid_uuid(value: str, field_name: str = "id"):
        """Assert value is valid UUID"""
        import uuid
        try:
            uuid.UUID(value)
        except ValueError:
            raise AssertionError(f"{field_name} is not a valid UUID: {value}")
    
    @staticmethod
    def assert_fields_present(
        data: Dict[str, Any],
        required_fields: List[str]
    ):
        """Assert all required fields are present"""
        missing = [f for f in required_fields if f not in data]
        assert not missing, f"Missing required fields: {missing}"
    
    @staticmethod
    def assert_field_type(
        data: Dict[str, Any],
        field: str,
        expected_type: type
    ):
        """Assert field has expected type"""
        assert field in data, f"Field {field} not found"
        assert isinstance(data[field], expected_type), \
            f"Field {field} expected {expected_type}, got {type(data[field])}"
    
    @staticmethod
    def assert_error_response(
        response_data: Dict[str, Any],
        expected_detail: Optional[str] = None
    ):
        """Assert response is error with optional detail check"""
        assert "detail" in response_data, "Error response missing detail"
        
        if expected_detail:
            assert expected_detail in response_data["detail"], \
                f"Expected '{expected_detail}' in error, got: {response_data['detail']}"
    
    @staticmethod
    def assert_pagination_response(
        response_data: List[Any],
        expected_count: Optional[int] = None,
        max_count: Optional[int] = None
    ):
        """Assert response is properly paginated"""
        assert isinstance(response_data, list), "Expected list response"
        
        if expected_count is not None:
            assert len(response_data) == expected_count, \
                f"Expected {expected_count} items, got {len(response_data)}"
        
        if max_count is not None:
            assert len(response_data) <= max_count, \
                f"Expected max {max_count} items, got {len(response_data)}"

# Usage
def test_filament_creation(api_client):
    status, data = api_client.post('/api/filaments', json={
        "material": "PLA",
        "color": "Red",
        "price_per_kg": 25.99
    })
    
    APIAssertions.assert_valid_uuid(data['id'])
    APIAssertions.assert_fields_present(data, [
        'id', 'material', 'color', 'price_per_kg', 'available_grams'
    ])
    APIAssertions.assert_field_type(data, 'price_per_kg', float)
```

### Step 3: Test Scenario Helpers
```python
# backend/tests/helpers/scenarios.py
class TestScenarios:
    """Common test scenarios"""
    
    def __init__(self, api_client: APITestClient):
        self.api = api_client
    
    def setup_inventory_with_stock(
        self,
        filament_count: int = 5,
        grams_per_filament: int = 1000
    ) -> List[Dict[str, Any]]:
        """Create filaments with inventory"""
        filaments = []
        
        for i in range(filament_count):
            # Create filament
            filament = self.api.create_filament(
                material=["PLA", "ABS", "PETG"][i % 3],
                color=f"Color-{i}",
                price_per_kg=20.0 + i
            )
            
            # Add inventory
            self.api.post(
                '/api/filament-purchases',
                json={
                    "filament_id": filament['id'],
                    "grams": grams_per_filament,
                    "price_eur": grams_per_filament * 0.025
                }
            )
            
            filaments.append(filament)
        
        return filaments
    
    def setup_complete_print_job(self) -> Dict[str, Any]:
        """Create print job with all dependencies"""
        # Create filaments
        filaments = self.setup_inventory_with_stock(3)
        
        # Create product
        product = self.api.create_product(
            name="Test Product",
            sku="TEST-001",
            filament_usages=[
                {
                    "filament_id": filaments[0]['id'],
                    "grams_used": 50
                },
                {
                    "filament_id": filaments[1]['id'],
                    "grams_used": 30
                }
            ]
        )
        
        # Create printer
        printer = self.api.post('/api/printer-profiles', json={
            "name": "Test Printer",
            "price_eur": 500,
            "expected_life_hours": 5000
        })[1]
        
        # Create print job
        job = self.api.post('/api/print-jobs', json={
            "name": "Test Job",
            "products": [
                {
                    "product_id": product['id'],
                    "quantity": 10
                }
            ],
            "printers": [
                {
                    "printer_profile_id": printer['id'],
                    "hours": 5,
                    "quantity": 1
                }
            ],
            "packaging_cost_eur": 2.50
        })[1]
        
        return {
            "job": job,
            "product": product,
            "filaments": filaments,
            "printer": printer
        }
    
    def cleanup_all_data(self):
        """Remove all test data in correct order"""
        resources = [
            'print-jobs',
            'filament-purchases',
            'products',
            'filaments',
            'printer-profiles'
        ]
        
        for resource in resources:
            count = self.api.delete_all(resource)
            print(f"Deleted {count} {resource}")
```

### Step 4: Frontend API Test Helpers
```typescript
// frontend/e2e/helpers/api-test-client.ts
import { APIRequestContext, Page } from '@playwright/test'

interface RequestOptions {
  expectedStatus?: number
  headers?: HeadersInit
  data?: any
  params?: Record<string, string>
}

export class APITestClient {
  constructor(
    private request: APIRequestContext,
    private page: Page,
    private baseURL: string = ''
  ) {}

  private async getAuthHeaders(): Promise<HeadersInit> {
    const token = await this.page.evaluate(() => 
      localStorage.getItem('auth_token') || localStorage.getItem('token')
    )
    
    if (!token) {
      throw new Error('No auth token available')
    }
    
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  }

  private async makeRequest(
    method: string,
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<{ status: number; data: any }> {
    const url = `${this.baseURL}${endpoint}`
    const headers = options.headers || await this.getAuthHeaders()
    
    const requestOptions: any = { headers }
    
    if (options.data) {
      requestOptions.data = options.data
    }
    
    if (options.params) {
      requestOptions.params = options.params
    }
    
    const response = await this.request[method](url, requestOptions)
    const status = response.status()
    
    let data = null
    try {
      data = await response.json()
    } catch {
      data = await response.text()
    }
    
    if (options.expectedStatus !== undefined && status !== options.expectedStatus) {
      throw new Error(
        `Expected status ${options.expectedStatus}, got ${status}: ${JSON.stringify(data)}`
      )
    }
    
    return { status, data }
  }

  // HTTP methods
  async get(endpoint: string, options?: RequestOptions) {
    return this.makeRequest('get', endpoint, options)
  }

  async post(endpoint: string, options?: RequestOptions) {
    return this.makeRequest('post', endpoint, { expectedStatus: 201, ...options })
  }

  async put(endpoint: string, options?: RequestOptions) {
    return this.makeRequest('put', endpoint, { expectedStatus: 200, ...options })
  }

  async delete(endpoint: string, options?: RequestOptions) {
    return this.makeRequest('delete', endpoint, { expectedStatus: 204, ...options })
  }

  // Resource helpers
  async createFilament(data: Partial<{
    material: string
    color: string
    brand: string
    price_per_kg: number
  }>) {
    const { data: filament } = await this.post('/api/filaments', { data })
    return filament
  }

  async createProduct(data: any) {
    const { data: product } = await this.post('/api/products', { data })
    return product
  }

  async deleteAllResources(resourceTypes: string[]) {
    for (const resource of resourceTypes) {
      const { data: items } = await this.get(`/api/${resource}`)
      
      if (Array.isArray(items)) {
        for (const item of items) {
          await this.delete(`/api/${resource}/${item.id}`, { expectedStatus: undefined })
        }
      }
    }
  }
}
```

### Step 5: Response Validation Helpers
```typescript
// frontend/e2e/helpers/api-validators.ts
export class APIValidators {
  static validateUUID(value: string, fieldName = 'id'): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(value)) {
      throw new Error(`${fieldName} is not a valid UUID: ${value}`)
    }
  }

  static validateRequiredFields(
    data: Record<string, any>,
    requiredFields: string[]
  ): void {
    const missing = requiredFields.filter(field => !(field in data))
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`)
    }
  }

  static validateFieldTypes(
    data: Record<string, any>,
    fieldTypes: Record<string, string>
  ): void {
    for (const [field, expectedType] of Object.entries(fieldTypes)) {
      const actualType = typeof data[field]
      if (actualType !== expectedType) {
        throw new Error(
          `Field ${field} expected ${expectedType}, got ${actualType}`
        )
      }
    }
  }

  static validateArrayResponse(
    data: any,
    options: {
      minLength?: number
      maxLength?: number
      exactLength?: number
    } = {}
  ): void {
    if (!Array.isArray(data)) {
      throw new Error('Response is not an array')
    }

    if (options.exactLength !== undefined && data.length !== options.exactLength) {
      throw new Error(`Expected ${options.exactLength} items, got ${data.length}`)
    }

    if (options.minLength !== undefined && data.length < options.minLength) {
      throw new Error(`Expected at least ${options.minLength} items, got ${data.length}`)
    }

    if (options.maxLength !== undefined && data.length > options.maxLength) {
      throw new Error(`Expected at most ${options.maxLength} items, got ${data.length}`)
    }
  }

  static validateErrorResponse(
    data: any,
    expectedMessage?: string
  ): void {
    if (!data.detail && !data.message && !data.error) {
      throw new Error('Response does not appear to be an error response')
    }

    if (expectedMessage) {
      const message = data.detail || data.message || data.error
      if (!message.includes(expectedMessage)) {
        throw new Error(`Expected error containing "${expectedMessage}", got: ${message}`)
      }
    }
  }
}
```

### Step 6: Error Testing Helpers
```python
# backend/tests/helpers/error_testing.py
from contextlib import contextmanager
from typing import Optional

class ErrorTestHelper:
    """Helper for testing error scenarios"""
    
    def __init__(self, api_client: APITestClient):
        self.api = api_client
    
    @contextmanager
    def expect_error(
        self,
        status_code: int,
        detail_contains: Optional[str] = None
    ):
        """Context manager for expected errors"""
        try:
            yield
            raise AssertionError(f"Expected error with status {status_code}, but request succeeded")
        except AssertionError as e:
            if "Expected error" in str(e):
                raise
            # This is from the API client assertion
            if f"Expected {status_code}" not in str(e):
                raise
    
    def test_unauthorized_access(self, endpoints: List[str]):
        """Test endpoints require authentication"""
        unauth_client = self.api.without_auth()
        
        for endpoint in endpoints:
            status, data = unauth_client.get(endpoint, expected_status=401)
            APIAssertions.assert_error_response(data)
    
    def test_not_found_errors(self, resource_endpoints: Dict[str, str]):
        """Test 404 errors for non-existent resources"""
        fake_id = str(uuid.uuid4())
        
        for resource, endpoint_template in resource_endpoints.items():
            endpoint = endpoint_template.format(id=fake_id)
            status, data = self.api.get(endpoint, expected_status=404)
            APIAssertions.assert_error_response(
                data,
                expected_detail=f"{resource} not found"
            )
    
    def test_validation_errors(
        self,
        endpoint: str,
        invalid_payloads: List[Dict[str, Any]]
    ):
        """Test validation errors with invalid data"""
        for payload in invalid_payloads:
            status, data = self.api.post(
                endpoint,
                json=payload,
                expected_status=422
            )
            
            # FastAPI validation error format
            assert "detail" in data
            assert isinstance(data["detail"], list)
            assert len(data["detail"]) > 0
            assert "loc" in data["detail"][0]
            assert "msg" in data["detail"][0]

# Usage
def test_filament_errors(api_client):
    error_helper = ErrorTestHelper(api_client)
    
    # Test validation
    error_helper.test_validation_errors('/api/filaments', [
        {},  # Missing required fields
        {"material": "PLA"},  # Missing color and price
        {"material": "PLA", "color": "Red", "price_per_kg": -10},  # Invalid price
        {"material": "INVALID", "color": "Red", "price_per_kg": 25}  # Invalid material
    ])
    
    # Test not found
    error_helper.test_not_found_errors({
        "Filament": "/api/filaments/{id}",
        "Product": "/api/products/{id}"
    })
```

## Guidelines for Implementation

### DO:
1. **Provide type-safe interfaces** for API interactions
2. **Handle authentication automatically**
3. **Support both success and error testing**
4. **Make helpers composable** and reusable
5. **Include response validation**

### DON'T:
1. **Don't hardcode URLs** - use configuration
2. **Don't ignore error responses**
3. **Don't mix concerns** - separate API calls from assertions
4. **Don't forget cleanup helpers**
5. **Don't duplicate logic** between frontend and backend

### Usage Patterns
```python
# Backend comprehensive test
def test_complete_workflow(api_client):
    scenarios = TestScenarios(api_client)
    
    # Setup
    scenario_data = scenarios.setup_complete_print_job()
    
    # Test COGS calculation
    status, cogs_data = api_client.get(
        f'/api/print-jobs/{scenario_data["job"]["id"]}/calculate-cogs'
    )
    
    assert cogs_data["total_cogs"] > 0
    assert "breakdown" in cogs_data
    
    # Cleanup
    scenarios.cleanup_all_data()
```

```typescript
// Frontend comprehensive test
test('complete API workflow', async ({ page }) => {
  const api = new APITestClient(page.request, page)
  
  // Create test data
  const filament = await api.createFilament({
    material: 'PLA',
    color: 'Blue',
    price_per_kg: 25.99
  })
  
  // Validate response
  APIValidators.validateUUID(filament.id)
  APIValidators.validateRequiredFields(filament, [
    'id', 'material', 'color', 'price_per_kg'
  ])
  
  // Test error case
  const { status, data } = await api.post('/api/filaments', {
    data: { invalid: 'data' },
    expectedStatus: 422
  })
  
  APIValidators.validateErrorResponse(data)
})
```

### Success Metrics
- 90% reduction in API test boilerplate
- Consistent error handling across tests
- Type-safe API interactions
- Clear test intentions
- Faster test development