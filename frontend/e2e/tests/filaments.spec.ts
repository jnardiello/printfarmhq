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

  test('should export CSV with authentication', async ({ page }) => {
    // First add some test data
    await page.click('text=Filament Purchases');
    
    // Fill in purchase form
    await page.locator('#purchaseColor').selectOption('Black');
    await page.locator('#purchaseBrand').selectOption('Bambu Lab');
    await page.locator('#purchaseMaterial').selectOption('PLA basic');
    await page.fill('#purchaseQuantity', '2.5');
    await page.fill('#purchasePrice', '25.99');
    await page.fill('#purchaseDate', '2024-01-15');
    await page.locator('#purchaseChannel').selectOption('Amazon');
    await page.fill('#purchaseNotes', 'Test purchase for CSV export');
    
    // Submit the form
    await page.click('button[type="submit"]:has-text("Add Purchase")');
    
    // Wait for success message
    await expect(page.locator('text=Purchase added successfully').or(page.locator('text=Success'))).toBeVisible({ timeout: 10000 });
    
    // Wait for the purchase to appear in the table
    await expect(page.locator('table').filter({ hasText: 'Black' })).toBeVisible({ timeout: 10000 });
    
    // Intercept the CSV download request to verify authentication
    const downloadPromise = page.waitForEvent('download');
    await page.on('response', response => {
      if (response.url().includes('/filament_purchases/export')) {
        // Verify the request includes authentication header
        const headers = response.request().headers();
        expect(headers['authorization']).toBeTruthy();
        expect(headers['authorization']).toContain('Bearer ');
      }
    });
    
    // Click the Export CSV button
    await page.click('button:has-text("Export CSV")');
    
    // Wait for download to complete
    const download = await downloadPromise;
    expect(download).toBeTruthy();
    
    // Verify the download filename contains 'filament_purchases'
    expect(download.suggestedFilename()).toContain('filament_purchases');
    expect(download.suggestedFilename()).toContain('.csv');
    
    // Read and verify CSV content
    const path = await download.path();
    if (path) {
      const fs = require('fs');
      const csvContent = fs.readFileSync(path, 'utf8');
      
      // Verify CSV headers
      expect(csvContent).toContain('ID,Color,Brand,Material,Quantity_kg,Price_per_kg,Purchase_date,Channel,Notes');
      
      // Verify our test data is in the CSV
      expect(csvContent).toContain('Black');
      expect(csvContent).toContain('Bambu Lab');
      expect(csvContent).toContain('PLA basic');
      expect(csvContent).toContain('2.5');
      expect(csvContent).toContain('25.99');
      expect(csvContent).toContain('Amazon');
      expect(csvContent).toContain('Test purchase for CSV export');
    }
  });
});