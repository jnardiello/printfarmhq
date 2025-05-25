import { test, expect } from '../fixtures/base-test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we start fresh
    await page.goto('/auth');
    await page.evaluate(() => localStorage.clear());
  });

  test('should allow superadmin login', async ({ page }) => {
    // Navigate to auth page
    await page.goto('/auth');

    // Verify we're on the auth page
    await expect(page).toHaveURL('/auth');
    await expect(page.getByText('Welcome Back')).toBeVisible();
    await expect(page.getByText('Sign in to your PrintFarmHQ account')).toBeVisible();

    // Fill login form with superadmin credentials
    await page.fill('input[type="email"]', 'admin@printfarmhq.com');
    await page.fill('input[type="password"]', 'admin123');

    // Submit login
    await page.click('button:has-text("Sign In")');

    // Should redirect to dashboard
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');

    // Should see user menu
    const userMenu = page.locator('[data-testid="user-menu"]');
    await expect(userMenu).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/auth');

    // Try to login with invalid credentials
    await page.fill('input[type="email"]', 'invalid@email.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('[role="alert"]').filter({ hasText: 'email or password' })).toBeVisible();

    // Should still be on auth page
    await expect(page).toHaveURL('/auth');
  });

  test('should not have registration option', async ({ page }) => {
    await page.goto('/auth');

    // Should not find any registration-related elements
    await expect(page.locator('text=Need an account?')).not.toBeVisible();
    await expect(page.locator('text=Register')).not.toBeVisible();
    await expect(page.locator('text=Sign up')).not.toBeVisible();
    await expect(page.locator('text=Create account')).not.toBeVisible();
  });

  test('should protect dashboard routes when not authenticated', async ({ page }) => {
    // Ensure we're logged out by clearing localStorage
    await page.goto('/auth');
    await page.evaluate(() => localStorage.clear());
    
    // Try to access dashboard without logging in
    await page.goto('/');

    // Should redirect to auth page
    await expect(page).toHaveURL('/auth');

    // Try to access specific tabs
    const protectedRoutes = [
      '/?tab=filaments',
      '/?tab=products',
      '/?tab=printers',
      '/?tab=prints',
      '/?tab=users',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL('/auth');
    }
  });

  test('should maintain session across page refreshes', async ({ page }) => {
    // Login as superadmin
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'admin@printfarmhq.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('/');

    // Verify we're logged in
    const userMenu = page.locator('[data-testid="user-menu"]');
    await expect(userMenu).toBeVisible();

    // Refresh the page
    await page.reload();

    // Should still be logged in (accept both / and /?tab=home for browser compatibility)
    const currentUrl = page.url();
    expect(currentUrl.endsWith('/') || currentUrl.endsWith('/?tab=home')).toBe(true);
    await expect(userMenu).toBeVisible();

    // Navigate to different tab - handle mobile vs desktop navigation
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      // Mobile navigation - single dropdown menu
      const mobileDropdown = page.locator('button').filter({ hasText: 'Overview' }).first();
      await mobileDropdown.click();
      await page.waitForSelector('[role="menu"]', { state: 'visible' });
      await page.click('[role="menuitem"]:has-text("Filaments")');
    } else {
      // Desktop navigation - Inventory dropdown
      await page.click('button:has-text("Inventory")');
      await page.click('text=Filaments');
    }
    await page.waitForURL('/?tab=filaments');

    // Refresh again
    await page.reload();

    // Should maintain the current tab and be logged in
    await expect(page).toHaveURL('/?tab=filaments');
    await expect(userMenu).toBeVisible();
  });

  test('should handle logout correctly', async ({ page }) => {
    // Login first
    await page.goto('/auth');
    await page.fill('input[type="email"]', 'admin@printfarmhq.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Navigate to a protected tab - handle mobile vs desktop navigation
    const viewport = page.viewportSize();
    if (viewport && viewport.width < 768) {
      // Mobile navigation - single dropdown menu
      const mobileDropdown = page.locator('button').filter({ hasText: 'Overview' }).first();
      await mobileDropdown.click();
      await page.waitForSelector('[role="menu"]', { state: 'visible' });
      await page.click('[role="menuitem"]:has-text("Products")');
    } else {
      // Desktop navigation - Inventory dropdown
      await page.click('button:has-text("Inventory")');
      await page.locator('[role="menuitem"]:has-text("Products")').click();
    }
    await page.waitForURL('/?tab=products');

    // Logout via user menu
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Log out');

    // Should be on auth page
    await expect(page).toHaveURL('/auth');

    // Try to access the protected tab directly
    await page.goto('/?tab=products');

    // Should redirect to auth
    await expect(page).toHaveURL('/auth');

    // Verify auth token is removed
    const token = await page.evaluate(() => localStorage.getItem('token'));
    expect(token).toBeNull();
  });

  test('should require both email and password', async ({ page }) => {
    await page.goto('/auth');

    // Try to submit with empty fields
    await page.click('button[type="submit"]');

    // HTML5 validation should prevent submission
    // Check if email field has validation message
    const emailInput = page.locator('input[type="email"]');
    const emailValidity = await emailInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(emailValidity).toBe(false);

    // Fill only email
    await page.fill('input[type="email"]', 'test@example.com');
    await page.click('button[type="submit"]');

    // Password field should show validation
    const passwordInput = page.locator('input[type="password"]');
    const passwordValidity = await passwordInput.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(passwordValidity).toBe(false);
  });
});