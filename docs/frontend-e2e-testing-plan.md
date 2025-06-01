# Frontend E2E Testing Plan for PrintFarmHQ

## Overview
This document outlines a comprehensive plan for implementing end-to-end (E2E) testing for the PrintFarmHQ frontend application, ensuring we maintain UI integrity while adding robust test coverage.

## Goals
1. **Prevent UI Regressions**: Ensure no existing functionality breaks during development
2. **Business Workflow Coverage**: Test complete user journeys from login to print queue completion
3. **Visual Regression Testing**: Detect unintended UI changes
4. **Performance Monitoring**: Ensure the app remains performant
5. **Accessibility Validation**: Maintain WCAG compliance

## Testing Framework Selection

### Recommended: Playwright
- **Pros**: 
  - Cross-browser testing (Chrome, Firefox, Safari, Edge)
  - Built-in visual regression testing
  - Excellent debugging tools (trace viewer, screenshots, videos)
  - Auto-waiting for elements (reduces flaky tests)
  - Component testing support for Next.js
  - API mocking capabilities
  - Mobile device emulation

### Alternative: Cypress
- **Pros**: Great developer experience, real-time reloading
- **Cons**: Limited cross-browser support, no native mobile testing

## Test Categories

### 1. Authentication & Authorization Tests
```typescript
// Tests to implement:
- User registration flow
- Login/logout functionality
- Protected route access
- Role-based UI elements (admin vs regular user)
- Token refresh handling
- Session persistence
```

### 2. Inventory Management Tests
```typescript
// Tests to implement:
- Filament creation and editing
- Purchase recording and price calculation
- Stock level updates
- Low stock alerts display
- Filament deletion with confirmation
- Search and filtering functionality
```

### 3. Product Management Tests
```typescript
// Tests to implement:
- Product creation with multi-filament selection
- File upload for STL/3MF models
- SKU generation verification
- Product editing workflow
- Product listing and pagination
- Cost of production display
```

### 4. Print Queue Workflow Tests
```typescript
// Tests to implement:
- Complete print queue entry creation flow
- Multi-product selection
- Printer assignment
- COGS calculation display
- Status updates (pending → in_progress → completed)
- Inventory deduction verification
- Print queue entry deletion and inventory restoration
```

### 5. UI Component Tests
```typescript
// Tests to implement:
- Theme switching (light/dark mode)
- Responsive design breakpoints
- Modal dialogs behavior
- Form validation messages
- Toast notifications
- Loading states
- Error boundaries
```

### 6. Visual Regression Tests
```typescript
// Key pages to snapshot:
- Dashboard overview
- Each tab (Filaments, Products, Printers, Print Queue)
- Forms (create/edit dialogs)
- Empty states
- Error states
- Mobile views
```

## Implementation Strategy

### Phase 1: Setup & Infrastructure (Week 1)
1. **Install Playwright**
   ```bash
   npm install -D @playwright/test @playwright/experimental-ct-react
   npm install -D @playwright/test-utils
   ```

2. **Configure Playwright**
   ```typescript
   // playwright.config.ts
   import { defineConfig, devices } from '@playwright/test';

   export default defineConfig({
     testDir: './e2e',
     fullyParallel: true,
     forbidOnly: !!process.env.CI,
     retries: process.env.CI ? 2 : 0,
     workers: process.env.CI ? 1 : undefined,
     reporter: [
       ['html', { open: 'never' }],
       ['junit', { outputFile: 'test-results/junit.xml' }],
     ],
     use: {
       baseURL: 'http://localhost:3000',
       trace: 'on-first-retry',
       screenshot: 'only-on-failure',
       video: 'retain-on-failure',
     },
     projects: [
       {
         name: 'chromium',
         use: { ...devices['Desktop Chrome'] },
       },
       {
         name: 'firefox',
         use: { ...devices['Desktop Firefox'] },
       },
       {
         name: 'webkit',
         use: { ...devices['Desktop Safari'] },
       },
       {
         name: 'Mobile Chrome',
         use: { ...devices['Pixel 5'] },
       },
     ],
   });
   ```

3. **Create Test Helpers**
   ```typescript
   // e2e/helpers/auth.helper.ts
   export async function loginAsUser(page: Page, email: string, password: string) {
     await page.goto('/auth');
     await page.fill('[name="email"]', email);
     await page.fill('[name="password"]', password);
     await page.click('button[type="submit"]');
     await page.waitForURL('/');
   }
   ```

### Phase 2: Critical Path Tests (Week 2)
1. **Authentication Flow**
   ```typescript
   // e2e/auth.spec.ts
   test.describe('Authentication', () => {
     test('should allow user registration and login', async ({ page }) => {
       // Registration
       await page.goto('/auth');
       await page.click('text=Need an account?');
       // ... complete test
     });
   });
   ```

2. **Basic CRUD Operations**
   - Filament management
   - Product creation
   - Print queue workflow

### Phase 3: Advanced Tests (Week 3)
1. **Complex Workflows**
   - Multi-filament product creation
   - Print queue entry with multiple products
   - Inventory tracking through workflow

2. **Error Handling**
   - Network failures
   - Validation errors
   - Auth token expiration

### Phase 4: Visual & Performance (Week 4)
1. **Visual Regression Setup**
   ```typescript
   test('dashboard visual regression', async ({ page }) => {
     await page.goto('/');
     await expect(page).toHaveScreenshot('dashboard.png', {
       fullPage: true,
       animations: 'disabled',
     });
   });
   ```

2. **Performance Metrics**
   ```typescript
   test('dashboard performance', async ({ page }) => {
     const metrics = await page.evaluate(() => performance.getEntriesByType('navigation'));
     expect(metrics[0].loadEventEnd).toBeLessThan(3000);
   });
   ```

## Test Data Management

### 1. Test Database Seeding
```typescript
// e2e/fixtures/test-data.ts
export const testFilaments = [
  { material: 'PLA', color: 'Red', brand: 'ESUN' },
  { material: 'PETG', color: 'Blue', brand: 'Polymaker' },
];
```

### 2. API Mocking for Isolation
```typescript
// e2e/mocks/api.mock.ts
await page.route('**/api/filaments', route => {
  route.fulfill({
    status: 200,
    body: JSON.stringify(mockFilaments),
  });
});
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Monitoring & Reporting

### 1. Test Results Dashboard
- HTML reports for local development
- JUnit XML for CI integration
- Slack notifications for failures

### 2. Coverage Metrics
- Page coverage (all routes tested)
- User flow coverage
- Component interaction coverage
- Browser/device coverage

## Best Practices

### 1. Page Object Model
```typescript
// e2e/pages/dashboard.page.ts
export class DashboardPage {
  constructor(private page: Page) {}
  
  async navigateToFilaments() {
    await this.page.click('[data-testid="filaments-tab"]');
  }
  
  async createFilament(data: FilamentData) {
    await this.page.click('[data-testid="create-filament"]');
    // ... implementation
  }
}
```

### 2. Test Data Attributes
```tsx
// Add data-testid attributes to components
<Button data-testid="create-filament" onClick={handleCreate}>
  Create Filament
</Button>
```

### 3. Flaky Test Prevention
- Use explicit waits over arbitrary delays
- Mock external dependencies
- Ensure proper test isolation
- Use stable selectors

## Timeline & Milestones

| Week | Milestone | Deliverables |
|------|-----------|--------------|
| 1 | Infrastructure Setup | Playwright config, helper functions, CI pipeline |
| 2 | Critical Path Tests | Auth, basic CRUD for all entities |
| 3 | Advanced Workflows | Complex business flows, error handling |
| 4 | Visual & Performance | Screenshots, performance metrics |
| 5 | Documentation & Training | Test writing guide, team training |

## Success Metrics

1. **Test Coverage**: >80% of user workflows covered
2. **Execution Time**: Full suite runs in <10 minutes
3. **Reliability**: <1% flaky test rate
4. **Maintenance**: <2 hours/week test maintenance

## Risk Mitigation

### Preventing UI Breakage
1. **Run tests before every PR merge**
2. **Visual regression tests for all major components**
3. **Component-level tests for isolated validation**
4. **Feature flags for gradual rollout**

### Handling Test Failures
1. **Immediate notification system**
2. **Detailed failure reports with screenshots**
3. **Rollback procedures documented**
4. **Test quarantine for investigation**

## Next Steps

1. **Get team buy-in** on testing strategy
2. **Set up Playwright** in the project
3. **Create first test** for authentication flow
4. **Establish CI pipeline** with test execution
5. **Document test writing guidelines** for team

This plan ensures comprehensive E2E test coverage while maintaining the integrity of the PrintFarmHQ UI throughout development.