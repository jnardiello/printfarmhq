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
    
    // Clean database after login
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    if (token) {
      // Delete all purchases first (foreign key constraint)
      try {
        const purchasesResponse = await page.request.get('/api/filament_purchases', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (purchasesResponse.ok()) {
          const purchases = await purchasesResponse.json();
          for (const purchase of purchases) {
            await page.request.delete(`/api/filament_purchases/${purchase.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
          }
        }
      } catch (e) {
        // Silently continue if cleanup fails
      }
      
      // Delete all filaments
      try {
        const filamentsResponse = await page.request.get('/api/filaments', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (filamentsResponse.ok()) {
          const filaments = await filamentsResponse.json();
          for (const filament of filaments) {
            await page.request.delete(`/api/filaments/${filament.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
          }
        }
      } catch (e) {
        // Silently continue if cleanup fails
      }
    }
    
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
    
    // Wait for the collapsible to open
    await page.waitForTimeout(500);
    
    // Verify purchase form elements exist
    await expect(page.locator('#purchaseColor')).toBeVisible();
    await expect(page.locator('#purchaseBrand')).toBeVisible();  
    await expect(page.locator('#purchaseMaterial')).toBeVisible();
    await expect(page.locator('#purchaseQuantity')).toBeVisible();
    await expect(page.locator('#purchasePrice')).toBeVisible();
    await expect(page.locator('button[type="submit"]:has-text("Add Purchase")')).toBeVisible();
    
    // Verify inventory table exists - be specific about which table
    const inventoryCard = page.locator('.card-hover').filter({ hasText: 'Filament Inventory' });
    await expect(inventoryCard.locator('table').first()).toBeVisible();
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
    
    
    await expect(inventoryCard.locator('text=No filaments added yet.')).toBeVisible();
    await expect(inventoryCard.locator('text=Add your first filament purchase below.')).toBeVisible();
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
        material: 'PLA basic'
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