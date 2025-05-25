import { test, expect } from '../fixtures/base-test';
import { testData } from '../fixtures/test-data';
import { uniqueId } from '../helpers/unique-id';

test.describe('Filaments Management', () => {
  test.beforeEach(async ({ page, authHelper, dashboardPage }) => {
    // Ensure clean state before each test
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch (e) {
        // Handle cases where localStorage is not accessible
        console.log('localStorage not accessible:', e);
      }
    });
    await page.goto('/auth');
    
    // Login as admin
    await authHelper.loginAsAdmin();
    
    // Navigate to dashboard and then filaments using responsive navigation
    // Handle Safari redirect from / to /?tab=home gracefully
    try {
      await page.goto('/');
      await page.waitForURL(url => url.pathname === '/' && (!url.search || url.search === '?tab=home'), { timeout: 15000 });
    } catch {
      // Fallback - try direct navigation to home tab for Safari
      await page.goto('/?tab=home');
      await page.waitForURL('/?tab=home', { timeout: 15000 });
    }
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="user-menu"]', { timeout: 10000 });
    
    // Navigate to filaments tab using responsive navigation
    await dashboardPage.navigateToTab('filaments');
  });

  test('should load filaments page with required sections', async ({ page }) => {
    // Verify key sections are present
    await expect(page.locator('text=Filament Purchases')).toBeVisible();
    await expect(page.locator('text=Filament Inventory').first()).toBeVisible();
    
    // Open purchases section to see form
    await page.click('text=Filament Purchases');
    
    // Verify purchase form elements exist
    await expect(page.locator('#purchaseColor')).toBeVisible();
    await expect(page.locator('#purchaseBrand')).toBeVisible();  
    await expect(page.locator('#purchaseMaterial')).toBeVisible();
    await expect(page.locator('#purchaseQuantity')).toBeVisible();
    await expect(page.locator('#purchasePrice')).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Add Purchase")')).toBeVisible();
    
    // Verify inventory table exists
    await expect(page.locator('table').filter({ hasText: 'Color' }).filter({ hasText: 'Brand' })).toBeVisible();
  });

  test('should display empty state when no purchases exist', async ({ page }) => {
    // Open purchases section to see empty state
    await page.click('text=Filament Purchases');
    
    // Verify empty state message
    await expect(page.locator('text=No purchases yet.')).toBeVisible();
    await expect(page.locator('text=Add your first purchase using the form above.')).toBeVisible();
  });

  test('should display empty inventory when no filaments exist', async ({ page }) => {
    // Check the inventory table empty state
    await expect(page.locator('text=No filaments added yet.')).toBeVisible();
    await expect(page.locator('text=Add your first filament purchase below.')).toBeVisible();
  });
});