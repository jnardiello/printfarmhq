import { test as base } from '@playwright/test';
import { AuthHelper } from '../helpers/auth.helper';
import { DashboardPage } from '../pages/dashboard.page';
import { FilamentsPage } from '../pages/filaments.page';

// Declare the types of fixtures
type MyFixtures = {
  authHelper: AuthHelper;
  dashboardPage: DashboardPage;
  filamentsPage: FilamentsPage;
  authenticatedPage: void;
};

// Extend base test with our fixtures
export const test = base.extend<MyFixtures>({
  // Define fixtures
  authHelper: async ({ page }, use) => {
    const authHelper = new AuthHelper(page);
    await use(authHelper);
  },

  dashboardPage: async ({ page }, use) => {
    const dashboardPage = new DashboardPage(page);
    await use(dashboardPage);
  },

  filamentsPage: async ({ page }, use) => {
    const filamentsPage = new FilamentsPage(page);
    await use(filamentsPage);
  },

  // Authenticated page fixture - ensures user is logged in before test
  authenticatedPage: async ({ page, authHelper }, use) => {
    // Clear any existing session and login as superadmin
    await page.goto('/auth');
    await page.evaluate(() => localStorage.clear());
    await authHelper.loginAsAdmin();
    
    // Ensure we're on the dashboard and fully loaded
    await page.goto('/');
    await page.waitForURL('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for key UI elements to be present
    await page.waitForSelector('[data-testid="user-menu"]', { timeout: 10000 });
    
    await use();
    
    // Clean up - log out after test
    if (await authHelper.isLoggedIn()) {
      await authHelper.logout();
    }
  },
});

export { expect } from '@playwright/test';

// Helper function to create unique test data
export function uniqueId(prefix: string = ''): string {
  return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}