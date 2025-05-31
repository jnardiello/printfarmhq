# Testing Strategy

## Overview

Comprehensive testing strategy for the inline filament creation feature, covering unit tests, integration tests, and end-to-end tests to ensure reliability and quality.

## Test Pyramid

```
         /\
        /E2E\        <- User journey tests (Playwright)
       /------\
      /  Integ  \    <- API & component integration
     /------------\
    /   Unit Tests  \  <- Business logic & utilities
   /------------------\
```

## Unit Tests

### Backend Unit Tests

#### 1. Validation Logic Tests

```python
# backend/tests/test_unit/test_filament_validation.py

import pytest
from app.utils.validation import (
    validate_color, validate_brand, validate_material,
    validate_quantity, validate_price
)

class TestFilamentValidation:
    """Test filament field validation logic"""
    
    def test_validate_color_valid(self):
        """Test valid color inputs"""
        valid_colors = ["Black", "Sky Blue", "RAL-7016", "Glow-in-the-dark"]
        for color in valid_colors:
            assert validate_color(color) == color.title()
    
    def test_validate_color_invalid(self):
        """Test invalid color inputs"""
        with pytest.raises(ValueError, match="Color is required"):
            validate_color("")
        
        with pytest.raises(ValueError, match="Color name must be 50 characters or less"):
            validate_color("A" * 51)
        
        with pytest.raises(ValueError, match="Color name can only contain"):
            validate_color("Black@123")
    
    def test_validate_quantity_valid(self):
        """Test valid quantity inputs"""
        valid_quantities = [0.001, 1.0, 999.999, 5000.0]
        for qty in valid_quantities:
            assert validate_quantity(qty) == qty
    
    def test_validate_quantity_invalid(self):
        """Test invalid quantity inputs"""
        with pytest.raises(ValueError, match="Quantity must be greater than 0"):
            validate_quantity(0)
        
        with pytest.raises(ValueError, match="Quantity cannot exceed"):
            validate_quantity(10000)
    
    @pytest.mark.parametrize("material", ["PLA", "PETG", "ABS", "TPU", "Other"])
    def test_validate_material_valid(self, material):
        """Test all valid material types"""
        assert validate_material(material) == material
    
    def test_validate_material_invalid(self):
        """Test invalid material type"""
        with pytest.raises(ValueError, match="Invalid material type"):
            validate_material("INVALID")
```

#### 2. Business Logic Tests

```python
# backend/tests/test_unit/test_filament_business_logic.py

import pytest
from unittest.mock import Mock, patch
from app.services.filament_service import FilamentService
from app.models import Filament, FilamentPurchase

class TestFilamentBusinessLogic:
    """Test filament creation business logic"""
    
    def test_check_duplicate_filament(self):
        """Test duplicate filament detection"""
        service = FilamentService()
        
        existing_filaments = [
            Mock(color="Black", brand="Prusament", material="PETG"),
            Mock(color="White", brand="eSUN", material="PLA")
        ]
        
        # Should find duplicate (case-insensitive)
        duplicate = service.check_duplicate(
            "black", "PRUSAMENT", "PETG", existing_filaments
        )
        assert duplicate is not None
        
        # Should not find duplicate
        no_duplicate = service.check_duplicate(
            "Red", "Prusament", "PETG", existing_filaments
        )
        assert no_duplicate is None
    
    def test_calculate_initial_price(self):
        """Test initial price calculation for new filament"""
        service = FilamentService()
        
        # Single purchase - price is the purchase price
        price = service.calculate_weighted_price([], 1.0, 25.99)
        assert price == 25.99
    
    @patch('app.services.filament_service.db')
    def test_create_filament_with_purchase_transaction(self, mock_db):
        """Test transaction handling in filament creation"""
        service = FilamentService()
        mock_session = Mock()
        mock_db.get_session.return_value = mock_session
        
        # Simulate successful creation
        result = service.create_with_purchase({
            "color": "Black",
            "brand": "Test",
            "material": "PLA",
            "quantity_kg": 1.0,
            "price_per_kg": 25.0
        })
        
        # Verify transaction calls
        assert mock_session.add.call_count == 2  # Filament + Purchase
        assert mock_session.commit.called
        assert not mock_session.rollback.called
```

### Frontend Unit Tests

#### 1. Component Tests

```typescript
// frontend/lib/__tests__/quick-filament-form.test.tsx

import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QuickFilamentForm } from '@/components/quick-filament-form'
import { DataProvider } from '@/components/data-provider'

const mockCreateFilament = jest.fn()

jest.mock('@/components/data-provider', () => ({
  useData: () => ({
    filaments: [],
    createFilamentWithPurchase: mockCreateFilament
  })
}))

describe('QuickFilamentForm', () => {
  beforeEach(() => {
    mockCreateFilament.mockClear()
  })
  
  it('should render all required fields', () => {
    render(<QuickFilamentForm onSuccess={jest.fn()} onCancel={jest.fn()} />)
    
    expect(screen.getByLabelText(/color/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/brand/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/material/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/quantity/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/price per kg/i)).toBeInTheDocument()
  })
  
  it('should show validation errors for empty required fields', async () => {
    const user = userEvent.setup()
    render(<QuickFilamentForm onSuccess={jest.fn()} onCancel={jest.fn()} />)
    
    const submitButton = screen.getByRole('button', { name: /create filament/i })
    await user.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Color is required')).toBeInTheDocument()
      expect(screen.getByText('Brand is required')).toBeInTheDocument()
    })
  })
  
  it('should call onSuccess with created filament', async () => {
    const user = userEvent.setup()
    const onSuccess = jest.fn()
    const mockFilament = {
      id: 1,
      color: 'Black',
      brand: 'Test',
      material: 'PLA'
    }
    
    mockCreateFilament.mockResolvedValue({
      filament: mockFilament,
      purchase: {}
    })
    
    render(<QuickFilamentForm onSuccess={onSuccess} onCancel={jest.fn()} />)
    
    // Fill form
    await user.type(screen.getByLabelText(/color/i), 'Black')
    await user.type(screen.getByLabelText(/brand/i), 'Test')
    await user.selectOptions(screen.getByLabelText(/material/i), 'PLA')
    await user.type(screen.getByLabelText(/quantity/i), '1')
    await user.type(screen.getByLabelText(/price/i), '25')
    
    // Submit
    await user.click(screen.getByRole('button', { name: /create filament/i }))
    
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(mockFilament)
    })
  })
})
```

#### 2. Utility Function Tests

```typescript
// frontend/lib/__tests__/time-format.test.ts

import { validateFilamentFields } from '@/lib/validation'

describe('Filament Validation', () => {
  describe('validateColor', () => {
    it('should accept valid colors', () => {
      const validColors = ['Black', 'Sky Blue', 'RAL-7016', 'Glow-in-the-dark']
      validColors.forEach(color => {
        expect(validateFilamentFields.color(color)).toBeNull()
      })
    })
    
    it('should reject invalid colors', () => {
      expect(validateFilamentFields.color('')).toBe('Color is required')
      expect(validateFilamentFields.color('A'.repeat(51))).toBe('Color name must be 50 characters or less')
      expect(validateFilamentFields.color('@Black')).toBe('Color name contains invalid characters')
    })
  })
  
  describe('validateQuantity', () => {
    it('should accept valid quantities', () => {
      expect(validateFilamentFields.quantity('0.001')).toBeNull()
      expect(validateFilamentFields.quantity('1.5')).toBeNull()
      expect(validateFilamentFields.quantity('999.999')).toBeNull()
    })
    
    it('should reject invalid quantities', () => {
      expect(validateFilamentFields.quantity('0')).toBe('Quantity must be at least 0.001 kg')
      expect(validateFilamentFields.quantity('10000')).toBe('Quantity cannot exceed 9999.999 kg')
      expect(validateFilamentFields.quantity('abc')).toBe('Quantity must be a number')
    })
  })
})
```

## Integration Tests

### API Integration Tests

```python
# backend/tests/test_integration/test_filament_api.py

import pytest
from fastapi.testclient import TestClient
from app.main import app

class TestFilamentAPI:
    """Test filament API endpoints"""
    
    @pytest.fixture
    def auth_headers(self, client, test_user):
        """Get auth headers for requests"""
        response = client.post("/token", data={
            "username": test_user.email,
            "password": "testpass"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_create_filament_with_purchase_success(self, client, auth_headers):
        """Test successful filament creation with purchase"""
        data = {
            "color": "Black",
            "brand": "Prusament",
            "material": "PETG",
            "quantity_kg": 1.0,
            "price_per_kg": 29.99,
            "purchase_date": "2024-01-15"
        }
        
        response = client.post(
            "/api/filaments/create-with-purchase",
            json=data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        result = response.json()
        
        # Verify filament
        assert result["filament"]["color"] == "Black"
        assert result["filament"]["total_qty_kg"] == 1.0
        
        # Verify purchase
        assert result["purchase"]["quantity_kg"] == 1.0
        assert result["purchase"]["price_per_kg"] == 29.99
    
    def test_create_duplicate_filament(self, client, auth_headers, existing_filament):
        """Test duplicate filament handling"""
        data = {
            "color": existing_filament.color,
            "brand": existing_filament.brand,
            "material": existing_filament.material,
            "quantity_kg": 1.0,
            "price_per_kg": 25.0
        }
        
        response = client.post(
            "/api/filaments/create-with-purchase",
            json=data,
            headers=auth_headers
        )
        
        assert response.status_code == 409
        assert "already exists" in response.json()["detail"]["message"]
    
    def test_create_filament_validation_error(self, client, auth_headers):
        """Test validation error handling"""
        data = {
            "color": "",  # Invalid: empty
            "brand": "Test",
            "material": "INVALID",  # Invalid: not in enum
            "quantity_kg": -1,  # Invalid: negative
            "price_per_kg": 25.0
        }
        
        response = client.post(
            "/api/filaments/create-with-purchase",
            json=data,
            headers=auth_headers
        )
        
        assert response.status_code == 422
        errors = response.json()["detail"]
        assert any(e["loc"][1] == "color" for e in errors)
        assert any(e["loc"][1] == "material" for e in errors)
        assert any(e["loc"][1] == "quantity_kg" for e in errors)
```

### Component Integration Tests

```typescript
// frontend/components/__tests__/filament-select-integration.test.tsx

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FilamentSelect } from '@/components/filament-select'
import { DataProvider } from '@/components/data-provider'
import { mockFilaments } from '@/test-utils/mock-data'

describe('FilamentSelect Integration', () => {
  it('should open modal when "Add New" is selected', async () => {
    const user = userEvent.setup()
    
    render(
      <DataProvider>
        <FilamentSelect
          value=""
          onValueChange={jest.fn()}
          filaments={mockFilaments}
        />
      </DataProvider>
    )
    
    // Open dropdown
    await user.click(screen.getByRole('combobox'))
    
    // Select "Add New Filament..."
    await user.click(screen.getByText(/add new filament/i))
    
    // Modal should open
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByLabelText(/color/i)).toBeInTheDocument()
    })
  })
  
  it('should select newly created filament', async () => {
    const user = userEvent.setup()
    const onValueChange = jest.fn()
    
    // Mock successful creation
    global.fetch = jest.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        filament: { id: 999, color: 'New', brand: 'Test', material: 'PLA' },
        purchase: {}
      })
    })
    
    render(
      <DataProvider>
        <FilamentSelect
          value=""
          onValueChange={onValueChange}
          filaments={mockFilaments}
        />
      </DataProvider>
    )
    
    // Open modal and create filament
    await user.click(screen.getByRole('combobox'))
    await user.click(screen.getByText(/add new filament/i))
    
    // Fill and submit form
    await user.type(screen.getByLabelText(/color/i), 'New')
    await user.type(screen.getByLabelText(/brand/i), 'Test')
    await user.click(screen.getByRole('button', { name: /create filament/i }))
    
    // Should call onValueChange with new filament ID
    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledWith('999')
    })
  })
})
```

## End-to-End Tests

### Complete User Journey Test

```typescript
// frontend/e2e/tests/inline-filament-creation.spec.ts

import { test, expect } from '@playwright/test'
import { setupTest, cleanupTest } from '../fixtures/test-setup'

test.describe('Inline Filament Creation', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page)
    await page.goto('/products')
  })
  
  test.afterEach(async ({ page }) => {
    await cleanupTest(page)
  })
  
  test('complete flow: create product with new filament', async ({ page }) => {
    // Start creating a product
    await page.click('text=Add Product')
    await page.fill('#product-name', 'Test Product with New Filament')
    
    // Open filament dropdown
    await page.click('[data-testid="filament-select-0"]')
    
    // Click "Add New Filament..."
    await page.click('text=Add New Filament...')
    
    // Modal should open
    await expect(page.locator('role=dialog')).toBeVisible()
    
    // Fill filament form
    await page.fill('[aria-label="Color"]', 'Unique Test Color')
    await page.fill('[aria-label="Brand"]', 'E2E Test Brand')
    await page.selectOption('[aria-label="Material"]', 'PETG')
    await page.fill('[aria-label="Quantity"]', '2.5')
    await page.fill('[aria-label="Price per kg"]', '35.99')
    
    // Submit filament form
    await page.click('button:has-text("Create Filament")')
    
    // Modal should close and filament should be selected
    await expect(page.locator('role=dialog')).not.toBeVisible()
    await expect(page.locator('[data-testid="filament-select-0"]')).toContainText('Unique Test Color')
    
    // Complete product creation
    await page.fill('[data-testid="plate-grams-0-0"]', '150')
    await page.click('button:has-text("Save Product")')
    
    // Verify product was created
    await expect(page.locator('text=Product created successfully')).toBeVisible()
    await expect(page.locator('table')).toContainText('Test Product with New Filament')
    
    // Verify filament appears in filament list
    await page.goto('/filaments')
    await expect(page.locator('table')).toContainText('Unique Test Color')
    await expect(page.locator('table')).toContainText('E2E Test Brand')
    await expect(page.locator('table')).toContainText('2.5 kg')
  })
  
  test('handle duplicate filament gracefully', async ({ page }) => {
    // Create a filament first
    await createTestFilament(page, {
      color: 'Duplicate Test',
      brand: 'Test Brand',
      material: 'PLA'
    })
    
    // Try to create the same filament inline
    await page.goto('/products')
    await page.click('text=Add Product')
    await page.click('[data-testid="filament-select-0"]')
    await page.click('text=Add New Filament...')
    
    // Fill same details
    await page.fill('[aria-label="Color"]', 'Duplicate Test')
    await page.fill('[aria-label="Brand"]', 'Test Brand')
    await page.selectOption('[aria-label="Material"]', 'PLA')
    await page.fill('[aria-label="Quantity"]', '1')
    await page.fill('[aria-label="Price per kg"]', '25')
    
    await page.click('button:has-text("Create Filament")')
    
    // Should show duplicate message
    await expect(page.locator('text=Filament Already Exists')).toBeVisible()
    
    // Should offer to use existing
    await page.click('button:has-text("Use Existing Filament")')
    
    // Modal should close and existing filament should be selected
    await expect(page.locator('role=dialog')).not.toBeVisible()
    await expect(page.locator('[data-testid="filament-select-0"]')).toContainText('Duplicate Test')
  })
})
```

### Error Scenario Tests

```typescript
test.describe('Error Handling', () => {
  test('network error with retry', async ({ page }) => {
    // Simulate network error
    await page.route('/api/filaments/create-with-purchase', route => {
      route.abort('failed')
    })
    
    await page.goto('/products')
    await page.click('text=Add Product')
    await page.click('[data-testid="filament-select-0"]')
    await page.click('text=Add New Filament...')
    
    // Fill form
    await fillFilamentForm(page, {
      color: 'Network Test',
      brand: 'Test',
      material: 'PLA',
      quantity: '1',
      price: '25'
    })
    
    await page.click('button:has-text("Create Filament")')
    
    // Should show error
    await expect(page.locator('text=Connection Error')).toBeVisible()
    
    // Remove network block
    await page.unroute('/api/filaments/create-with-purchase')
    
    // Click retry
    await page.click('button:has-text("Retry")')
    
    // Should succeed
    await expect(page.locator('text=Filament created successfully')).toBeVisible()
  })
  
  test('validation errors are shown inline', async ({ page }) => {
    await page.goto('/products')
    await page.click('text=Add Product')
    await page.click('[data-testid="filament-select-0"]')
    await page.click('text=Add New Filament...')
    
    // Submit empty form
    await page.click('button:has-text("Create Filament")')
    
    // Check all validation messages
    await expect(page.locator('text=Color is required')).toBeVisible()
    await expect(page.locator('text=Brand is required')).toBeVisible()
    await expect(page.locator('text=Quantity is required')).toBeVisible()
    await expect(page.locator('text=Price is required')).toBeVisible()
    
    // Fix one field at a time and verify error clears
    await page.fill('[aria-label="Color"]', 'Black')
    await expect(page.locator('text=Color is required')).not.toBeVisible()
  })
})
```

## Performance Tests

```typescript
// frontend/e2e/tests/performance/filament-creation-perf.spec.ts

test.describe('Performance', () => {
  test('modal opens within 200ms', async ({ page }) => {
    await page.goto('/products')
    await page.click('text=Add Product')
    await page.click('[data-testid="filament-select-0"]')
    
    const startTime = Date.now()
    await page.click('text=Add New Filament...')
    await page.waitForSelector('role=dialog')
    const endTime = Date.now()
    
    expect(endTime - startTime).toBeLessThan(200)
  })
  
  test('filament creation completes within 2 seconds', async ({ page }) => {
    await page.goto('/products')
    await openFilamentModal(page)
    await fillFilamentForm(page, testFilamentData)
    
    const startTime = Date.now()
    await page.click('button:has-text("Create Filament")')
    await page.waitForSelector('text=Filament created successfully')
    const endTime = Date.now()
    
    expect(endTime - startTime).toBeLessThan(2000)
  })
})
```

## Test Data Management

```typescript
// frontend/e2e/fixtures/test-data.ts

export const testFilaments = {
  valid: {
    color: 'Test Black',
    brand: 'Test Brand',
    material: 'PLA',
    quantity: '1.0',
    price: '25.99'
  },
  edgeCases: {
    minQuantity: {
      ...baseFilament,
      quantity: '0.001'
    },
    maxQuantity: {
      ...baseFilament,
      quantity: '9999.999'
    },
    specialChars: {
      ...baseFilament,
      color: 'Sky-Blue',
      brand: 'Proto-pasta & Co.'
    }
  },
  invalid: {
    emptyColor: { ...baseFilament, color: '' },
    negativeQuantity: { ...baseFilament, quantity: '-1' },
    invalidMaterial: { ...baseFilament, material: 'INVALID' }
  }
}
```

## CI/CD Integration

```yaml
# .github/workflows/test.yml

name: Test Suite

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest pytest-cov
      
      - name: Run unit tests
        run: |
          cd backend
          pytest tests/test_unit -v --cov=app
      
      - name: Run integration tests
        run: |
          cd backend
          pytest tests/test_integration -v
  
  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
      
      - name: Run unit tests
        run: |
          cd frontend
          npm run test:unit
      
      - name: Run component tests
        run: |
          cd frontend
          npm run test:components
  
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Start services
        run: docker-compose up -d
      
      - name: Run E2E tests
        run: |
          cd frontend
          npx playwright install
          npm run test:e2e
      
      - name: Upload test artifacts
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: |
            frontend/test-results/
            frontend/playwright-report/
```