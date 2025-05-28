# Task 05: Frontend Test Fixtures

## Context Description
Current frontend tests lack consistent patterns for:
- Authentication setup
- Page object initialization
- Test data creation
- Common UI interactions
- Browser context configuration

This leads to duplicate code and inconsistent test patterns.

## Desired Solution
Create Playwright fixtures that provide:
1. Authenticated page contexts
2. Page object models
3. Test data builders
4. Common UI helpers
5. Consistent test structure

## Implementation Steps

### Step 1: Create Base Test Configuration
```typescript
// frontend/e2e/fixtures/base-test.ts
import { test as base, Page } from '@playwright/test'
import { LoginPage } from '../pages/login.page'
import { DashboardPage } from '../pages/dashboard.page'
import { resetDatabase } from '../helpers/database-reset'

// Define fixture types
type TestFixtures = {
  loginPage: LoginPage
  dashboardPage: DashboardPage
  authenticatedPage: Page
  adminPage: Page
}

type WorkerFixtures = {
  testUser: {
    email: string
    password: string
    name: string
  }
  adminUser: {
    email: string
    password: string
    name: string
  }
}

// Extend base test with our fixtures
export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Worker-scoped fixtures (shared across tests in worker)
  testUser: [async ({}, use) => {
    const user = {
      email: `user-${Date.now()}@test.com`,
      password: 'testpass123',
      name: 'Test User'
    }
    await use(user)
  }, { scope: 'worker' }],

  adminUser: [async ({}, use) => {
    const admin = {
      email: 'admin@printfarmhq.com',
      password: 'admin123',
      name: 'Admin User'
    }
    await use(admin)
  }, { scope: 'worker' }],

  // Test-scoped fixtures
  loginPage: async ({ page }, use) => {
    const loginPage = new LoginPage(page)
    await use(loginPage)
  },

  dashboardPage: async ({ page }, use) => {
    const dashboardPage = new DashboardPage(page)
    await use(dashboardPage)
  },

  // Authenticated page for regular user
  authenticatedPage: async ({ page, testUser, loginPage }, use) => {
    // Ensure we start from login
    await page.goto('/auth')
    
    // Perform login
    await loginPage.login(testUser.email, testUser.password)
    
    // Wait for dashboard
    await page.waitForURL('/dashboard')
    
    // Reset database for clean state
    await resetDatabase(page)
    
    // Provide authenticated page
    await use(page)
    
    // Cleanup after test
    await page.evaluate(() => localStorage.clear())
  },

  // Authenticated page for admin
  adminPage: async ({ page, adminUser, loginPage }, use) => {
    await page.goto('/auth')
    await loginPage.login(adminUser.email, adminUser.password)
    await page.waitForURL('/dashboard')
    await resetDatabase(page)
    
    await use(page)
    
    await page.evaluate(() => localStorage.clear())
  }
})

export { expect } from '@playwright/test'
```

### Step 2: Create Page Object Models
```typescript
// frontend/e2e/pages/base.page.ts
import { Page, Locator } from '@playwright/test'

export abstract class BasePage {
  constructor(protected page: Page) {}

  /**
   * Wait for page to be fully loaded
   */
  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle')
  }

  /**
   * Common navigation helper
   */
  async navigateTo(path: string): Promise<void> {
    await this.page.goto(path)
    await this.waitForLoad()
  }

  /**
   * Wait for element and return it
   */
  async waitForElement(selector: string): Promise<Locator> {
    const element = this.page.locator(selector)
    await element.waitFor({ state: 'visible' })
    return element
  }

  /**
   * Click and wait for navigation
   */
  async clickAndNavigate(selector: string): Promise<void> {
    await Promise.all([
      this.page.waitForNavigation(),
      this.page.click(selector)
    ])
  }
}

// frontend/e2e/pages/filaments.page.ts
export class FilamentsPage extends BasePage {
  // Locators
  readonly addButton = this.page.locator('[data-testid="add-filament-btn"]')
  readonly materialSelect = this.page.locator('[data-testid="material-select"]')
  readonly colorInput = this.page.locator('[data-testid="color-input"]')
  readonly brandInput = this.page.locator('[data-testid="brand-input"]')
  readonly priceInput = this.page.locator('[data-testid="price-input"]')
  readonly saveButton = this.page.locator('[data-testid="save-filament-btn"]')
  readonly filamentList = this.page.locator('[data-testid="filament-list"]')
  readonly emptyState = this.page.locator('text=No filaments found')

  async goto(): Promise<void> {
    await this.navigateTo('/dashboard')
    await this.page.click('[data-testid="filaments-tab"]')
    await this.waitForLoad()
  }

  async createFilament(data: {
    material: string
    color: string
    brand: string
    pricePerKg: number
  }): Promise<void> {
    await this.addButton.click()
    
    // Wait for dialog
    await this.materialSelect.waitFor({ state: 'visible' })
    
    // Fill form
    await this.materialSelect.selectOption(data.material)
    await this.colorInput.fill(data.color)
    await this.brandInput.fill(data.brand)
    await this.priceInput.fill(data.pricePerKg.toString())
    
    // Save
    await this.saveButton.click()
    
    // Wait for success
    await this.page.waitForSelector(`text=${data.color}`)
  }

  async getFilamentCount(): Promise<number> {
    if (await this.emptyState.isVisible()) {
      return 0
    }
    
    const items = await this.filamentList.locator('.filament-item').all()
    return items.length
  }

  async deleteFilament(color: string): Promise<void> {
    const row = this.page.locator(`[data-testid="filament-row-${color}"]`)
    const deleteBtn = row.locator('[data-testid="delete-btn"]')
    
    await deleteBtn.click()
    
    // Confirm deletion
    await this.page.click('button:has-text("Confirm")')
    
    // Wait for removal
    await row.waitFor({ state: 'hidden' })
  }
}
```

### Step 3: Create Test Data Builders
```typescript
// frontend/e2e/helpers/test-data-builders.ts
import { Page } from '@playwright/test'

export class TestDataBuilder {
  constructor(private page: Page) {}

  /**
   * Create filament via API
   */
  async createFilament(data: Partial<{
    material: string
    color: string
    brand: string
    price_per_kg: number
  }> = {}): Promise<any> {
    const filamentData = {
      material: 'PLA',
      color: `Color-${Date.now()}`,
      brand: 'Test Brand',
      price_per_kg: 25.99,
      ...data
    }

    const token = await this.getAuthToken()
    const response = await this.page.request.post('/api/filaments', {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: filamentData
    })

    if (!response.ok()) {
      throw new Error(`Failed to create filament: ${response.status()}`)
    }

    return response.json()
  }

  /**
   * Create product with filament usages
   */
  async createProduct(data: Partial<{
    name: string
    sku: string
    filament_usages: Array<{
      filament_id: string
      grams_used: number
    }>
  }> = {}): Promise<any> {
    const productData = {
      name: `Product-${Date.now()}`,
      sku: `SKU-${Date.now()}`,
      filament_usages: [],
      ...data
    }

    const token = await this.getAuthToken()
    const response = await this.page.request.post('/api/products', {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: productData
    })

    if (!response.ok()) {
      throw new Error(`Failed to create product: ${response.status()}`)
    }

    return response.json()
  }

  /**
   * Create complete test scenario
   */
  async createInventoryScenario(): Promise<{
    filaments: any[]
    products: any[]
    purchases: any[]
  }> {
    // Create filaments
    const filaments = await Promise.all([
      this.createFilament({ material: 'PLA', color: 'Red' }),
      this.createFilament({ material: 'ABS', color: 'Blue' }),
      this.createFilament({ material: 'PETG', color: 'Green' })
    ])

    // Add inventory
    const purchases = await Promise.all(
      filaments.map(f => this.createPurchase({
        filament_id: f.id,
        grams: 1000
      }))
    )

    // Create products using filaments
    const products = await Promise.all([
      this.createProduct({
        name: 'Widget A',
        filament_usages: [
          { filament_id: filaments[0].id, grams_used: 50 }
        ]
      }),
      this.createProduct({
        name: 'Widget B',
        filament_usages: [
          { filament_id: filaments[1].id, grams_used: 75 },
          { filament_id: filaments[2].id, grams_used: 25 }
        ]
      })
    ])

    return { filaments, products, purchases }
  }

  private async getAuthToken(): Promise<string> {
    const token = await this.page.evaluate(() => 
      localStorage.getItem('auth_token') || localStorage.getItem('token')
    )
    
    if (!token) {
      throw new Error('No auth token found')
    }
    
    return token
  }
}

// Convenience fixtures
export const testDataFixtures = {
  testData: async ({ page }, use) => {
    const builder = new TestDataBuilder(page)
    await use(builder)
  }
}
```

### Step 4: Create UI Helper Fixtures
```typescript
// frontend/e2e/fixtures/ui-helpers.ts
import { Page } from '@playwright/test'

export class UIHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for and dismiss toast notification
   */
  async waitForToast(text: string): Promise<void> {
    const toast = this.page.locator(`.toast:has-text("${text}")`)
    await toast.waitFor({ state: 'visible' })
    await toast.waitFor({ state: 'hidden', timeout: 5000 })
  }

  /**
   * Wait for loading spinner to disappear
   */
  async waitForLoadingComplete(): Promise<void> {
    const spinner = this.page.locator('[data-testid="loading-spinner"]')
    if (await spinner.isVisible()) {
      await spinner.waitFor({ state: 'hidden' })
    }
  }

  /**
   * Fill form field with validation
   */
  async fillFormField(
    fieldName: string, 
    value: string,
    shouldValidate = true
  ): Promise<void> {
    const field = this.page.locator(`[data-testid="${fieldName}-input"]`)
    await field.clear()
    await field.fill(value)
    
    if (shouldValidate) {
      await field.blur() // Trigger validation
      await this.page.waitForTimeout(100) // Wait for validation
    }
  }

  /**
   * Check for form validation error
   */
  async hasValidationError(fieldName: string): Promise<boolean> {
    const error = this.page.locator(`[data-testid="${fieldName}-error"]`)
    return error.isVisible()
  }

  /**
   * Navigate using sidebar
   */
  async navigateToSection(sectionName: string): Promise<void> {
    await this.page.click(`[data-testid="nav-${sectionName}"]`)
    await this.waitForLoadingComplete()
  }

  /**
   * Confirm dialog action
   */
  async confirmDialog(buttonText = 'Confirm'): Promise<void> {
    await this.page.click(`dialog button:has-text("${buttonText}")`)
  }

  /**
   * Cancel dialog action
   */
  async cancelDialog(): Promise<void> {
    await this.page.click('dialog button:has-text("Cancel")')
  }
}

export const uiHelperFixtures = {
  ui: async ({ page }, use) => {
    const helpers = new UIHelpers(page)
    await use(helpers)
  }
}
```

### Step 5: Combine Fixtures
```typescript
// frontend/e2e/fixtures/index.ts
import { mergeTests } from '@playwright/test'
import { test as baseTest } from './base-test'
import { testDataFixtures } from '../helpers/test-data-builders'
import { uiHelperFixtures } from './ui-helpers'

// Combine all fixtures
export const test = mergeTests(
  baseTest,
  testDataFixtures,
  uiHelperFixtures
)

export { expect } from '@playwright/test'

// Re-export page objects
export * from '../pages'
```

### Step 6: Usage in Tests
```typescript
// frontend/e2e/tests/filament-workflow.spec.ts
import { test, expect, FilamentsPage } from '../fixtures'

test.describe('Filament Complete Workflow', () => {
  let filamentsPage: FilamentsPage

  test.beforeEach(async ({ page }) => {
    filamentsPage = new FilamentsPage(page)
  })

  test('create and manage filaments', async ({ 
    adminPage, 
    testData, 
    ui 
  }) => {
    // Navigate to filaments
    await filamentsPage.goto()
    
    // Should start empty
    await expect(filamentsPage.emptyState).toBeVisible()
    
    // Create via UI
    await filamentsPage.createFilament({
      material: 'PLA',
      color: 'Red',
      brand: 'TestBrand',
      pricePerKg: 25.99
    })
    
    // Wait for success
    await ui.waitForToast('Filament created successfully')
    
    // Verify count
    expect(await filamentsPage.getFilamentCount()).toBe(1)
    
    // Create more via API for testing
    const bulkFilaments = await Promise.all([
      testData.createFilament({ color: 'Blue' }),
      testData.createFilament({ color: 'Green' })
    ])
    
    // Refresh page
    await adminPage.reload()
    
    // Should show all filaments
    expect(await filamentsPage.getFilamentCount()).toBe(3)
    
    // Delete one
    await filamentsPage.deleteFilament('Red')
    await ui.waitForToast('Filament deleted')
    
    // Verify count
    expect(await filamentsPage.getFilamentCount()).toBe(2)
  })

  test('complex inventory scenario', async ({ 
    adminPage, 
    testData, 
    ui 
  }) => {
    // Setup complete scenario
    const scenario = await testData.createInventoryScenario()
    
    // Navigate and verify
    await ui.navigateToSection('inventory')
    
    // Should show all created items
    for (const filament of scenario.filaments) {
      await expect(adminPage.locator(`text=${filament.color}`)).toBeVisible()
    }
  })
})
```

## Guidelines for Implementation

### DO:
1. **Use Page Object Model** for all page interactions
2. **Create reusable fixtures** for common patterns
3. **Keep fixtures focused** on single responsibility
4. **Use TypeScript** for better IDE support
5. **Document fixture purpose** and usage

### DON'T:
1. **Don't hardcode selectors** in tests
2. **Don't duplicate page logic** across tests
3. **Don't create overly complex fixtures**
4. **Don't mix API and UI actions** without clear purpose
5. **Don't forget to clean up** after fixtures

### Best Practices
- Name fixtures clearly
- Use data-testid for reliable selectors
- Create fixtures at appropriate scope
- Compose fixtures for complex scenarios
- Keep page objects thin

### Success Metrics
- Reduced test code duplication by 60%
- Consistent test patterns across team
- Easy to add new tests
- Clear separation of concerns
- Improved test maintainability