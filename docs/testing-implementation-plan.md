# PrintFarmHQ Testing Implementation Plan

## Overview

This document outlines a comprehensive testing strategy for PrintFarmHQ, focusing on end-to-end (E2E) tests that validate critical business workflows, supplemented by targeted unit tests for complex calculations.

## Testing Philosophy

- **Test what matters**: Focus on business-critical workflows and user journeys
- **E2E first**: Prioritize integration tests that validate entire workflows
- **Confidence over coverage**: Better to have fewer, high-quality tests than many brittle ones
- **Fast feedback**: Tests should run quickly to encourage frequent execution

## Backend Testing Strategy

### Testing Framework: pytest

**Why pytest?**
- Industry standard for Python testing
- Excellent fixture system for test data management
- Great FastAPI integration with `httpx` for API testing
- Easy to write and maintain
- Parallel test execution support

### Required Dependencies

```txt
# Add to backend/requirements.txt
pytest==8.3.2
pytest-asyncio==0.24.0
httpx==0.27.0
pytest-cov==5.0.0
factory-boy==3.3.0
freezegun==1.5.1
```

### Test Structure

```
backend/
├── tests/
│   ├── __init__.py
│   ├── conftest.py           # Shared fixtures and test configuration
│   ├── factories.py          # Test data factories
│   ├── test_e2e/            # End-to-end tests
│   │   ├── test_auth_flow.py
│   │   ├── test_inventory_management.py
│   │   ├── test_print_queue_workflow.py
│   │   └── test_business_calculations.py
│   └── test_unit/           # Unit tests for complex logic
│       ├── test_cogs_calculation.py
│       └── test_inventory_math.py
```

### Critical E2E Test Scenarios

#### 1. Authentication Flow (test_auth_flow.py)
```python
# Test user registration → login → token usage → logout
# Test admin user management
# Test token invalidation on password change
# Test superadmin protection
```

#### 2. Inventory Management Workflow (test_inventory_management.py)
```python
# Test complete filament lifecycle:
# - Create filament type
# - Record multiple purchases
# - Verify weighted average price calculation
# - Create print queue entry that consumes inventory
# - Verify stock depletion
# - Test low stock alerts
# - Delete purchase and verify recalculation
```

#### 3. Print Queue Workflow (test_print_queue_workflow.py)
```python
# Test end-to-end print queue entry creation:
# - Set up filaments with sufficient stock
# - Create products with filament requirements
# - Create printer profiles
# - Create print queue entry and verify:
#   - Inventory validation
#   - COGS calculation
#   - Stock depletion
# - Update print queue entry and verify differential inventory
# - Delete print queue entry and verify stock restoration
```

#### 4. Business Calculations (test_business_calculations.py)
```python
# Test complex business scenarios:
# - Multi-filament product costing
# - Multi-printer job depreciation
# - Concurrent inventory updates
# - Edge cases (zero quantities, missing data)
```

### Unit Test Scenarios

#### 1. COGS Calculation (test_cogs_calculation.py)
```python
# Test precise calculation of:
# - Filament costs with weighted averages
# - Printer depreciation rates
# - Packaging costs
# - Total COGS aggregation
```

#### 2. Inventory Math (test_inventory_math.py)
```python
# Test inventory calculations:
# - Weighted average price updates
# - Stock level tracking
# - Multi-purchase scenarios
```

## Frontend Testing Strategy

### Testing Framework: Playwright

**Why Playwright?**
- Modern E2E testing for web applications
- Supports all browsers
- Built-in waiting and retry logic
- Excellent debugging tools
- TypeScript support
- Visual regression testing capabilities

### Required Setup

```json
// Add to frontend/package.json devDependencies
"@playwright/test": "^1.47.0"
```

### Test Structure

```
frontend/
├── e2e/
│   ├── fixtures/
│   │   ├── auth.ts          # Authentication helpers
│   │   └── test-data.ts     # Test data generators
│   ├── tests/
│   │   ├── auth.spec.ts     # Authentication flows
│   │   ├── inventory.spec.ts # Inventory management
│   │   ├── products.spec.ts  # Product management
│   │   └── print-queue.spec.ts # Print queue workflows
│   └── playwright.config.ts
```

### Critical E2E Test Scenarios

#### 1. Authentication Flow (auth.spec.ts)
```typescript
// Test user registration with form validation
// Test login/logout flow
// Test protected route access
// Test session persistence
```

#### 2. Inventory Management (inventory.spec.ts)
```typescript
// Test filament creation with all fields
// Test purchase recording with immediate UI update
// Test inventory table sorting and filtering
// Test low stock indicators
// Test bulk operations
```

#### 3. Product Management (products.spec.ts)
```typescript
// Test product creation with file upload
// Test multi-filament product setup
// Test product editing
// Test validation messages
```

#### 4. Print Queue Workflow (print-queue.spec.ts)
```typescript
// Test complete print queue entry creation flow
// Test inventory validation warnings
// Test COGS display
// Test job status updates
```

## Implementation Timeline

### Phase 1: Backend Foundation (Week 1)
1. Set up pytest infrastructure
2. Create test database fixtures
3. Implement authentication E2E tests
4. Add test running to CI/CD

### Phase 2: Backend Business Logic (Week 2)
1. Implement inventory management tests
2. Implement print queue workflow tests
3. Add unit tests for calculations
4. Achieve 80% coverage of critical paths

### Phase 3: Frontend Foundation (Week 3)
1. Set up Playwright infrastructure
2. Implement authentication flow tests
3. Create reusable test fixtures
4. Add visual regression tests

### Phase 4: Frontend Workflows (Week 4)
1. Implement inventory management tests
2. Implement product management tests
3. Implement print queue workflow tests
4. Add cross-browser testing

## Makefile Integration

```makefile
# Backend testing
test-backend:
	cd backend && pytest -v

test-backend-cov:
	cd backend && pytest --cov=app --cov-report=html

test-backend-watch:
	cd backend && pytest-watch

# Frontend testing
test-frontend:
	cd frontend && npm run test:e2e

test-frontend-ui:
	cd frontend && npm run test:e2e:ui

# Run all tests
test: test-backend test-frontend

# Run tests in CI mode
test-ci:
	cd backend && pytest --cov=app --cov-report=xml
	cd frontend && npm run test:e2e:ci
```

## Best Practices

### Backend Testing
1. Use fixtures for test data - don't hardcode values
2. Clean up after each test (use pytest's built-in cleanup)
3. Test both success and error paths
4. Use meaningful test names that describe the scenario
5. Mock external dependencies (file uploads, etc.)

### Frontend Testing
1. Use data-testid attributes for reliable element selection
2. Test user workflows, not implementation details
3. Use Playwright's built-in waiting instead of arbitrary delays
4. Take screenshots on failure for debugging
5. Run tests against production builds when possible

### General Principles
1. Each test should be independent
2. Tests should be deterministic (no random data)
3. Use descriptive assertions with clear error messages
4. Group related tests logically
5. Keep tests focused - one concept per test

## Success Metrics

- All critical business workflows have E2E test coverage
- Tests run in under 5 minutes
- Zero flaky tests
- Clear test failure messages that pinpoint issues
- Developers run tests before committing
- 100% pass rate required for deployment

## Future Enhancements

1. Performance testing for large datasets
2. API contract testing
3. Load testing for concurrent users
4. Security testing (authentication, authorization)
5. Accessibility testing
6. Mobile responsive testing