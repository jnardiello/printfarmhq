# Task 04: Frontend Database Reset

## Context Description
Frontend E2E tests currently suffer from state contamination because:
- Tests share the same database without cleanup
- Data from previous tests affects subsequent tests
- Manual cleanup in beforeEach hooks is incomplete
- No consistent pattern for ensuring clean state

## Desired Solution
Implement a comprehensive database reset mechanism that:
1. Clears all data before each test
2. Handles foreign key constraints properly
3. Works with authenticated requests
4. Is fast and reliable
5. Can be selectively applied

## Implementation Steps

### Step 1: Create Database Reset Utility
```typescript
// frontend/e2e/helpers/database-reset.ts
import { Page, APIRequestContext } from '@playwright/test'

interface EntityInfo {
  endpoint: string
  dependencies?: string[]
  identifier?: string  // Field name for ID (default: 'id')
}

// Define entities in deletion order (respecting foreign keys)
const ENTITIES: EntityInfo[] = [
  { endpoint: '/api/print-jobs' },
  { endpoint: '/api/filament-purchases' },
  { endpoint: '/api/products' },
  { endpoint: '/api/filaments' },
  { endpoint: '/api/printer-profiles' },
  { endpoint: '/api/subscriptions' },
  // Users are not deleted - they're needed for auth
]

export class DatabaseReset {
  constructor(
    private page: Page,
    private request: APIRequestContext
  ) {}

  /**
   * Get authentication token from localStorage
   */
  private async getAuthToken(): Promise<string | null> {
    return await this.page.evaluate(() => {
      return localStorage.getItem('auth_token') || localStorage.getItem('token')
    })
  }

  /**
   * Delete all items from a specific endpoint
   */
  private async deleteAllFromEndpoint(
    endpoint: string, 
    token: string,
    identifier = 'id'
  ): Promise<number> {
    try {
      // Get all items
      const response = await this.request.get(endpoint, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })

      if (!response.ok()) {
        console.warn(`Failed to fetch ${endpoint}: ${response.status()}`)
        return 0
      }

      const items = await response.json()
      
      if (!Array.isArray(items)) {
        console.warn(`${endpoint} did not return an array`)
        return 0
      }

      // Delete each item
      let deletedCount = 0
      for (const item of items) {
        const itemId = item[identifier]
        if (!itemId) continue

        const deleteResponse = await this.request.delete(
          `${endpoint}/${itemId}`,
          {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          }
        )

        if (deleteResponse.ok()) {
          deletedCount++
        } else {
          console.warn(
            `Failed to delete ${endpoint}/${itemId}: ${deleteResponse.status()}`
          )
        }
      }

      return deletedCount
    } catch (error) {
      console.error(`Error resetting ${endpoint}:`, error)
      return 0
    }
  }

  /**
   * Reset entire database to clean state
   */
  async resetDatabase(): Promise<void> {
    const token = await this.getAuthToken()
    
    if (!token) {
      throw new Error('No authentication token found. Please login first.')
    }

    console.log('Starting database reset...')
    
    // Delete entities in order
    for (const entity of ENTITIES) {
      const count = await this.deleteAllFromEndpoint(
        entity.endpoint,
        token,
        entity.identifier
      )
      
      if (count > 0) {
        console.log(`Deleted ${count} items from ${entity.endpoint}`)
      }
    }
    
    console.log('Database reset complete')
  }

  /**
   * Reset specific entity type only
   */
  async resetEntity(endpoint: string): Promise<void> {
    const token = await this.getAuthToken()
    
    if (!token) {
      throw new Error('No authentication token found')
    }

    const count = await this.deleteAllFromEndpoint(endpoint, token)
    console.log(`Reset ${endpoint}: deleted ${count} items`)
  }

  /**
   * Verify database is empty (for testing the reset itself)
   */
  async verifyCleanState(): Promise<boolean> {
    const token = await this.getAuthToken()
    
    if (!token) {
      throw new Error('No authentication token found')
    }

    for (const entity of ENTITIES) {
      const response = await this.request.get(entity.endpoint, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })

      if (response.ok()) {
        const items = await response.json()
        if (Array.isArray(items) && items.length > 0) {
          console.error(`${entity.endpoint} still has ${items.length} items`)
          return false
        }
      }
    }

    return true
  }
}

// Convenience function for use in tests
export async function resetDatabase(page: Page): Promise<void> {
  const resetUtil = new DatabaseReset(page, page.request)
  await resetUtil.resetDatabase()
}
```

### Step 2: Create Test-Specific Reset Functions
```typescript
// frontend/e2e/helpers/entity-reset.ts
import { Page } from '@playwright/test'
import { DatabaseReset } from './database-reset'

/**
 * Reset only filament-related data
 */
export async function resetFilamentData(page: Page): Promise<void> {
  const reset = new DatabaseReset(page, page.request)
  
  // Order matters due to foreign keys
  await reset.resetEntity('/api/filament-purchases')
  await reset.resetEntity('/api/filaments')
}

/**
 * Reset only product-related data
 */
export async function resetProductData(page: Page): Promise<void> {
  const reset = new DatabaseReset(page, page.request)
  
  // Clear products and their usages
  await reset.resetEntity('/api/products')
}

/**
 * Reset only print job data
 */
export async function resetPrintJobData(page: Page): Promise<void> {
  const reset = new DatabaseReset(page, page.request)
  await reset.resetEntity('/api/print-jobs')
}

/**
 * Smart reset based on test requirements
 */
export async function smartReset(
  page: Page, 
  options: {
    filaments?: boolean
    products?: boolean
    printJobs?: boolean
    all?: boolean
  }
): Promise<void> {
  if (options.all) {
    await resetDatabase(page)
    return
  }

  const reset = new DatabaseReset(page, page.request)
  
  // Reset in dependency order
  if (options.printJobs) {
    await reset.resetEntity('/api/print-jobs')
  }
  
  if (options.products) {
    await reset.resetEntity('/api/products')
  }
  
  if (options.filaments) {
    await reset.resetEntity('/api/filament-purchases')
    await reset.resetEntity('/api/filaments')
  }
}
```

### Step 3: Integration with Test Fixtures
```typescript
// frontend/e2e/fixtures/clean-state.ts
import { test as base } from '@playwright/test'
import { resetDatabase, smartReset } from '../helpers/database-reset'

type CleanStateOptions = {
  resetAll?: boolean
  resetFilaments?: boolean
  resetProducts?: boolean
  resetPrintJobs?: boolean
}

export const test = base.extend<{
  cleanState: CleanStateOptions
  autoCleanup: void
}>({
  // Configure what to reset per test file
  cleanState: [{
    resetAll: true
  }, { option: true }],

  // Automatically clean before each test
  autoCleanup: [async ({ page, cleanState }, use) => {
    // Clean before test
    await smartReset(page, {
      all: cleanState.resetAll,
      filaments: cleanState.resetFilaments,
      products: cleanState.resetProducts,
      printJobs: cleanState.resetPrintJobs
    })

    // Run test
    await use()

    // Optional: Clean after test
    // await smartReset(page, cleanState)
  }, { auto: true }]
})
```

### Step 4: Usage in Tests
```typescript
// frontend/e2e/tests/filaments.spec.ts
import { test } from '../fixtures/clean-state'
import { expect } from '@playwright/test'

// Configure cleanup for this test file
test.use({
  cleanState: {
    resetFilaments: true,
    resetProducts: false  // Don't need to reset products for filament tests
  }
})

test.describe('Filament Management', () => {
  test('should start with empty filament list', async ({ page }) => {
    // Database is automatically cleaned before this test
    await page.goto('/dashboard')
    await page.click('[data-testid="filaments-tab"]')
    
    await expect(page.locator('text=No filaments found')).toBeVisible()
  })

  test('should create filament', async ({ page }) => {
    // Previous test's data is cleaned up
    await page.goto('/dashboard')
    await page.click('[data-testid="filaments-tab"]')
    
    // Create filament...
  })
})

// For specific cleanup needs
test('complex scenario needing full reset', async ({ page }) => {
  // Manual reset if needed
  await resetDatabase(page)
  
  // Test implementation...
})
```

### Step 5: Performance Optimization
```typescript
// frontend/e2e/helpers/batch-delete.ts
export class BatchDatabaseReset extends DatabaseReset {
  /**
   * Delete all items in parallel batches
   */
  private async batchDelete(
    items: any[],
    endpoint: string,
    token: string,
    batchSize = 5
  ): Promise<number> {
    let deletedCount = 0
    
    // Process in batches
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      
      const deletePromises = batch.map(item =>
        this.request.delete(`${endpoint}/${item.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      )
      
      const results = await Promise.all(deletePromises)
      deletedCount += results.filter(r => r.ok()).length
    }
    
    return deletedCount
  }

  async resetDatabase(): Promise<void> {
    const token = await this.getAuthToken()
    if (!token) throw new Error('No auth token')

    // Delete all entities in parallel where possible
    const resetPromises = ENTITIES.map(entity =>
      this.deleteAllFromEndpoint(entity.endpoint, token)
    )
    
    await Promise.all(resetPromises)
  }
}
```

## Guidelines for Implementation

### DO:
1. **Respect foreign key constraints** - delete in correct order
2. **Handle errors gracefully** - don't fail if entity doesn't exist
3. **Log operations** for debugging
4. **Make it configurable** - not all tests need full reset
5. **Verify token exists** before attempting deletes

### DON'T:
1. **Don't delete user accounts** - needed for authentication
2. **Don't hardcode endpoints** - keep them configurable
3. **Don't ignore errors** - log them for debugging
4. **Don't reset unnecessarily** - use smart reset
5. **Don't forget error handling** - network requests can fail

### Error Handling
```typescript
// Implement retry logic for flaky networks
async function retryDelete(
  request: APIRequestContext,
  url: string,
  headers: HeadersInit,
  maxRetries = 3
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await request.delete(url, { headers })
      if (response.ok()) return true
      
      if (response.status() === 404) return true // Already deleted
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
      }
    } catch (error) {
      if (i === maxRetries - 1) throw error
    }
  }
  
  return false
}
```

### Success Metrics
- Tests start with guaranteed clean state
- No test failures due to leftover data
- Reset operations complete in < 2 seconds
- Clear logs show what was cleaned
- Tests can run in any order