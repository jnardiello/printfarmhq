import { Page, expect } from '@playwright/test';

export interface TestUser {
  email: string;
  password: string;
  name: string;
  isAdmin?: boolean;
}

export const TEST_USERS = {
  superAdmin: {
    email: 'admin@printfarmhq.com',
    password: 'admin123',
    name: 'Admin User',
    isAdmin: true,
  },
} as const;

export class AuthHelper {
  constructor(private page: Page) {}

  async login(email: string, password: string) {
    await this.page.goto('/auth');
    
    // Fill login form
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    
    // Submit form
    await this.page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard with longer timeout for Safari
    await this.page.waitForURL(url => url.pathname === '/' && (!url.search || url.search === '?tab=home'), { timeout: 15000 });
    
    // Verify we're logged in with longer timeout for Safari
    await expect(this.page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 10000 });
  }

  async loginAsAdmin() {
    await this.login(TEST_USERS.superAdmin.email, TEST_USERS.superAdmin.password);
  }

  async logout() {
    // Click user menu
    await this.page.click('[data-testid="user-menu"]');
    
    // Click logout
    await this.page.click('text=Logout');
    
    // Wait for redirect to auth page
    await this.page.waitForURL('/auth');
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.locator('[data-testid="user-menu"]').waitFor({ timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  }

  async ensureLoggedOut() {
    // Clear localStorage to ensure clean state
    await this.page.evaluate(() => localStorage.clear());
    
    // If we're logged in, logout
    if (await this.isLoggedIn()) {
      await this.logout();
    }
  }

  async ensureLoggedIn() {
    if (!(await this.isLoggedIn())) {
      await this.loginAsAdmin();
    }
  }

  /**
   * Get auth token from localStorage for API testing
   */
  async getAuthToken(): Promise<string | null> {
    return await this.page.evaluate(() => localStorage.getItem('token'));
  }

  /**
   * Set auth token directly (useful for test setup)
   */
  async setAuthToken(token: string) {
    await this.page.evaluate((token) => {
      localStorage.setItem('token', token);
    }, token);
  }
}