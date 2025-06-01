import { test, expect } from '../fixtures/base-test';
import { testData } from '../fixtures/test-data';
import { uniqueId } from '../helpers/unique-id';

test.describe('Filaments Management', () => {
  test.beforeEach(async ({ page, authHelper }) => {
    // Simple setup - just login and navigate
    await page.goto('/auth');
    await authHelper.loginAsAdmin();
    
    // Navigate directly to filaments tab
    await page.goto('/?tab=filaments');
    await page.waitForLoadState('networkidle');
  });

  test('should load filaments page with required sections', async ({ page }) => {
    // Verify we're on the filaments page
    await expect(page).toHaveURL(/.*[?&]tab=filaments/);
    
    // Wait for the main content to load
    await page.waitForSelector('.card-hover', { timeout: 10000 });
    
    // Verify the two main sections are present
    await expect(page.locator('text=Filament Purchases')).toBeVisible();
    await expect(page.locator('text=Filament Inventory')).toBeVisible();
    
    // Click on the purchases section to expand it
    await page.locator('text=Filament Purchases').click();
    await page.waitForTimeout(500); // Wait for animation
    
    // Verify the form is now visible
    const form = page.locator('form').first();
    await expect(form).toBeVisible();
    
    // Check for the new form structure with FilamentSelect
    await expect(form.locator('text=Filament Type')).toBeVisible();
    await expect(form.locator('button[role="combobox"]')).toBeVisible(); // The FilamentSelect component
    await expect(form.locator('#purchaseQuantity')).toBeVisible();
    await expect(form.locator('#purchasePrice')).toBeVisible();
    await expect(form.locator('button:has-text("Add Purchase")')).toBeVisible();
    
    // Verify inventory table structure
    const inventorySection = page.locator('div:has(h3:text("Filament Inventory"))');
    await expect(inventorySection.locator('table')).toBeVisible();
  });

  test('should display empty state when no purchases exist', async ({ page, authHelper }) => {
    // Database is already clean from beforeEach hook
    
    // Open purchases section to see empty state
    await page.click('text=Filament Purchases');
    
    // Wait for the collapsible to open
    await page.waitForTimeout(500);
    
    // Verify empty state message within the purchases section
    const purchasesCard = page.locator('.card-hover').filter({ hasText: 'Filament Purchases' });
    
    
    await expect(purchasesCard.locator('text=No purchases yet.')).toBeVisible();
    await expect(purchasesCard.locator('text=Add your first purchase using the form above.')).toBeVisible();
  });

  test('should display empty inventory when no filaments exist', async ({ page, authHelper }) => {
    // Database is already clean from beforeEach hook
    
    // Check the inventory table empty state in the inventory section
    const inventoryCard = page.locator('.card-hover').filter({ hasText: 'Filament Inventory' });
    
    
    await expect(inventoryCard.locator('text=No filaments in inventory')).toBeVisible();
    await expect(inventoryCard.locator('text=Add filament purchases above to track inventory.')).toBeVisible();
  });

  test('should export CSV with authentication', async ({ page, authHelper }) => {
    // Get the auth token from localStorage 
    // Try both keys as there might be a mismatch between test helper and app
    const authToken = await page.evaluate(() => localStorage.getItem('auth_token'));
    const testToken = await page.evaluate(() => localStorage.getItem('token'));
    const token = authToken || testToken;
    
    if (!token) {
      throw new Error('No auth token found in localStorage');
    }
    
    // Create a filament first
    const filamentResponse = await page.request.post('/api/filaments', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        color: 'Black',
        brand: 'Bambu Lab',
        material: 'PLA basic',
        price_per_kg: 25.99,
        total_qty_kg: 0
      }
    });
    
    if (!filamentResponse.ok()) {
      const error = await filamentResponse.text();
      throw new Error(`Failed to create filament: ${filamentResponse.status()} - ${error}`);
    }
    
    const filament = await filamentResponse.json();
    
    // Create a purchase
    const purchaseResponse = await page.request.post('/api/filament_purchases', {
      headers: {
        'Authorization': `Bearer ${token}`
      },
      data: {
        filament_id: filament.id,
        quantity_kg: 2.5,
        price_per_kg: 25.99,
        purchase_date: '2024-01-15',
        channel: 'Amazon',
        notes: 'Test purchase for CSV export'
      }
    });
    
    if (!purchaseResponse.ok()) {
      const error = await purchaseResponse.text();
      throw new Error(`Failed to create purchase: ${purchaseResponse.status()} - ${error}`);
    }
    
    const purchase = await purchaseResponse.json();
    
    // Reload page to see the data
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Open purchases section
    await page.click('text=Filament Purchases');
    await page.waitForTimeout(1000);
    
    // Wait for Export CSV button to be visible and click it
    const exportButton = page.locator('button:has-text("Export CSV")');
    await expect(exportButton).toBeVisible({ timeout: 10000 });
    await exportButton.click();
    
    // Wait for download to start
    const download = await page.waitForEvent('download', { timeout: 10000 });
    
    // Verify the download
    expect(download).toBeTruthy();
    expect(download.suggestedFilename()).toContain('filament_purchases');
    expect(download.suggestedFilename()).toContain('.csv');
  });
});