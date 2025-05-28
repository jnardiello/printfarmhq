# Task 06: Frontend Browser Isolation

## Context Description
Frontend tests can fail due to browser state contamination:
- localStorage/sessionStorage persisting between tests
- Cookies carrying over
- Browser cache affecting behavior
- Service workers maintaining state
- WebSocket connections staying open

## Desired Solution
Implement complete browser isolation ensuring:
1. Fresh browser context for each test
2. No shared state between tests
3. Proper cleanup of all browser resources
4. Consistent initial state
5. Performance optimization

## Implementation Steps

### Step 1: Create Browser Context Manager
```typescript
// frontend/e2e/fixtures/browser-context.ts
import { test as base, BrowserContext, Page } from '@playwright/test'

interface ContextOptions {
  storageState?: {
    cookies?: Array<{
      name: string
      value: string
      domain: string
      path: string
    }>
    localStorage?: Array<{
      name: string
      value: string
    }>
  }
  permissions?: string[]
  viewport?: { width: number; height: number }
  userAgent?: string
}

export class BrowserContextManager {
  private contexts: BrowserContext[] = []

  /**
   * Create isolated browser context
   */
  async createContext(
    browser: Browser,
    options: ContextOptions = {}
  ): Promise<BrowserContext> {
    const context = await browser.newContext({
      // Default options for consistency
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
      ...options,
      
      // Always start fresh
      storageState: options.storageState || undefined,
      
      // Consistent locale and timezone
      locale: 'en-US',
      timezoneId: 'America/New_York',
      
      // Disable animations for faster tests
      reducedMotion: 'reduce',
      forcedColors: 'none',
    })

    // Track for cleanup
    this.contexts.push(context)

    // Set up request interception if needed
    await this.setupRequestInterception(context)

    // Clear any service workers
    await context.addInitScript(() => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => registration.unregister())
        })
      }
    })

    return context
  }

  /**
   * Setup request interception for debugging
   */
  private async setupRequestInterception(context: BrowserContext): Promise<void> {
    // Log failed requests
    context.on('request', request => {
      if (process.env.DEBUG_TESTS) {
        console.log(`→ ${request.method()} ${request.url()}`)
      }
    })

    context.on('requestfailed', request => {
      console.error(`✗ Failed: ${request.method()} ${request.url()}`)
    })

    // Monitor console errors
    context.on('page', page => {
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.error(`Console error: ${msg.text()}`)
        }
      })

      page.on('pageerror', error => {
        console.error(`Page error: ${error.message}`)
      })
    })
  }

  /**
   * Clean up all contexts
   */
  async cleanup(): Promise<void> {
    await Promise.all(
      this.contexts.map(context => context.close())
    )
    this.contexts = []
  }
}
```

### Step 2: Create Storage Management
```typescript
// frontend/e2e/fixtures/storage-manager.ts
export class StorageManager {
  constructor(private page: Page) {}

  /**
   * Clear all browser storage
   */
  async clearAll(): Promise<void> {
    await this.page.evaluate(() => {
      // Clear localStorage
      localStorage.clear()
      
      // Clear sessionStorage
      sessionStorage.clear()
      
      // Clear IndexedDB
      if ('indexedDB' in window) {
        indexedDB.databases().then(databases => {
          databases.forEach(db => {
            if (db.name) indexedDB.deleteDatabase(db.name)
          })
        })
      }
      
      // Clear cookies (what we can from JS)
      document.cookie.split(';').forEach(cookie => {
        const eqPos = cookie.indexOf('=')
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
      })
    })

    // Clear cookies via Playwright API
    await this.page.context().clearCookies()
  }

  /**
   * Save current storage state
   */
  async saveState(): Promise<any> {
    const state = await this.page.evaluate(() => {
      const localStorage = {}
      const sessionStorage = {}
      
      // Save localStorage
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i)
        if (key) {
          localStorage[key] = window.localStorage.getItem(key)
        }
      }
      
      // Save sessionStorage
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i)
        if (key) {
          sessionStorage[key] = window.sessionStorage.getItem(key)
        }
      }
      
      return { localStorage, sessionStorage }
    })

    const cookies = await this.page.context().cookies()
    
    return { ...state, cookies }
  }

  /**
   * Restore storage state
   */
  async restoreState(state: any): Promise<void> {
    // Restore cookies first
    if (state.cookies) {
      await this.page.context().addCookies(state.cookies)
    }

    // Then restore storage
    await this.page.evaluate((state) => {
      // Restore localStorage
      if (state.localStorage) {
        Object.entries(state.localStorage).forEach(([key, value]) => {
          localStorage.setItem(key, value as string)
        })
      }
      
      // Restore sessionStorage
      if (state.sessionStorage) {
        Object.entries(state.sessionStorage).forEach(([key, value]) => {
          sessionStorage.setItem(key, value as string)
        })
      }
    }, state)
  }

  /**
   * Set authentication token
   */
  async setAuthToken(token: string): Promise<void> {
    await this.page.evaluate((token) => {
      localStorage.setItem('auth_token', token)
    }, token)
  }
}
```

### Step 3: Create Isolated Test Fixtures
```typescript
// frontend/e2e/fixtures/isolated-test.ts
import { test as base } from '@playwright/test'
import { BrowserContextManager } from './browser-context'
import { StorageManager } from './storage-manager'
import { DatabaseReset } from '../helpers/database-reset'

type IsolatedFixtures = {
  isolatedPage: Page
  storageManager: StorageManager
  contextManager: BrowserContextManager
}

export const test = base.extend<IsolatedFixtures>({
  // Override the default context fixture
  context: async ({ browser }, use) => {
    const manager = new BrowserContextManager()
    const context = await manager.createContext(browser)
    
    await use(context)
    
    // Cleanup
    await manager.cleanup()
  },

  // Create truly isolated page
  isolatedPage: async ({ context }, use) => {
    const page = await context.newPage()
    
    // Ensure clean state
    const storage = new StorageManager(page)
    await storage.clearAll()
    
    // Set up any default state
    await page.goto('/')
    
    await use(page)
    
    // Final cleanup
    await storage.clearAll()
    await page.close()
  },

  storageManager: async ({ page }, use) => {
    const manager = new StorageManager(page)
    await use(manager)
  },

  contextManager: async ({}, use) => {
    const manager = new BrowserContextManager()
    await use(manager)
    await manager.cleanup()
  }
})
```

### Step 4: Create Authentication Fixtures with Isolation
```typescript
// frontend/e2e/fixtures/isolated-auth.ts
import { test as base } from './isolated-test'
import { LoginHelper } from '../helpers/login-helper'

type AuthFixtures = {
  authenticatedContext: BrowserContext
  freshAuthPage: Page
}

export const test = base.extend<AuthFixtures>({
  // Create a fresh authenticated context
  authenticatedContext: async ({ browser, contextManager }, use) => {
    // Create new context
    const context = await contextManager.createContext(browser)
    const page = await context.newPage()
    
    // Perform login
    const loginHelper = new LoginHelper(page)
    await loginHelper.loginAsAdmin()
    
    // Save auth state
    const storageState = await context.storageState()
    
    // Close this context
    await context.close()
    
    // Create new context with auth state
    const authContext = await contextManager.createContext(browser, {
      storageState
    })
    
    await use(authContext)
    
    await authContext.close()
  },

  // Fresh page with auth but clean database
  freshAuthPage: async ({ authenticatedContext }, use) => {
    const page = await authenticatedContext.newPage()
    
    // Clean database
    const dbReset = new DatabaseReset(page, page.request)
    await dbReset.resetDatabase()
    
    await use(page)
    
    await page.close()
  }
})
```

### Step 5: Network and Resource Isolation
```typescript
// frontend/e2e/fixtures/network-isolation.ts
export class NetworkIsolation {
  private page: Page
  private activeConnections = new Set<string>()

  constructor(page: Page) {
    this.page = page
    this.setupMonitoring()
  }

  private setupMonitoring(): void {
    // Monitor WebSocket connections
    this.page.on('websocket', ws => {
      this.activeConnections.add(ws.url())
      
      ws.on('close', () => {
        this.activeConnections.delete(ws.url())
      })
    })

    // Monitor fetch requests
    this.page.on('request', request => {
      if (request.resourceType() === 'fetch') {
        this.activeConnections.add(request.url())
      }
    })

    this.page.on('requestfinished', request => {
      this.activeConnections.delete(request.url())
    })

    this.page.on('requestfailed', request => {
      this.activeConnections.delete(request.url())
    })
  }

  /**
   * Wait for all network activity to complete
   */
  async waitForNetworkIdle(timeout = 5000): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout })
    
    // Additional wait for any WebSocket activity
    const startTime = Date.now()
    while (this.activeConnections.size > 0 && Date.now() - startTime < timeout) {
      await this.page.waitForTimeout(100)
    }
  }

  /**
   * Abort all active connections
   */
  async abortAllConnections(): Promise<void> {
    await this.page.route('**/*', route => route.abort())
    await this.page.waitForTimeout(100)
    await this.page.unroute('**/*')
  }

  /**
   * Mock API responses for isolation
   */
  async mockAPIEndpoints(mocks: Record<string, any>): Promise<void> {
    await this.page.route('**/api/**', route => {
      const url = route.request().url()
      
      for (const [pattern, response] of Object.entries(mocks)) {
        if (url.includes(pattern)) {
          return route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(response)
          })
        }
      }
      
      // Continue with actual request if no mock
      return route.continue()
    })
  }
}
```

### Step 6: Usage Examples
```typescript
// frontend/e2e/tests/isolated-filament.spec.ts
import { test, expect } from '../fixtures/isolated-auth'

test.describe('Isolated Filament Tests', () => {
  test('completely isolated test', async ({ freshAuthPage }) => {
    // Start with clean database and browser state
    await freshAuthPage.goto('/dashboard')
    
    // This test is completely isolated
    // - Fresh browser context
    // - Clean localStorage/cookies
    // - Empty database
    // - No shared state
  })

  test('parallel test 1', async ({ freshAuthPage }) => {
    // These tests can run in parallel safely
    await freshAuthPage.goto('/dashboard')
    // Test implementation...
  })

  test('parallel test 2', async ({ freshAuthPage }) => {
    // Completely independent of test 1
    await freshAuthPage.goto('/dashboard')
    // Test implementation...
  })
})

// Advanced isolation example
test('test with network isolation', async ({ page, contextManager }) => {
  const context = await contextManager.createContext(browser, {
    // Block all external resources
    offline: true
  })
  
  const isolatedPage = await context.newPage()
  
  // Mock all API calls
  const networkIsolation = new NetworkIsolation(isolatedPage)
  await networkIsolation.mockAPIEndpoints({
    '/api/filaments': [],
    '/api/products': []
  })
  
  // Test runs with mocked responses
  await isolatedPage.goto('/dashboard')
})
```

## Guidelines for Implementation

### DO:
1. **Create fresh contexts** for each test
2. **Clear all storage** before and after tests
3. **Monitor network activity** for proper cleanup
4. **Use consistent viewport** sizes
5. **Handle errors gracefully**

### DON'T:
1. **Don't share contexts** between tests
2. **Don't rely on browser cache**
3. **Don't forget WebSocket cleanup**
4. **Don't ignore console errors**
5. **Don't skip storage cleanup**

### Performance Tips
```typescript
// Reuse authentication state for multiple tests
test.describe('Suite with shared auth', () => {
  let authState: any

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    
    // Login once
    await loginAsAdmin(page)
    
    // Save state
    authState = await context.storageState()
    await context.close()
  })

  test('test 1', async ({ browser }) => {
    const context = await browser.newContext({ storageState: authState })
    // Use authenticated context
  })

  test('test 2', async ({ browser }) => {
    const context = await browser.newContext({ storageState: authState })
    // Reuse auth state
  })
})
```

### Success Metrics
- Zero test failures due to state contamination
- Tests can run in any order
- Parallel execution is safe
- Clear isolation boundaries
- Predictable test behavior