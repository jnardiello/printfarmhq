import { test, expect } from '../fixtures/base-test';
import { testData } from '../fixtures/test-data';
import { uniqueId } from '../helpers/unique-id';

test.describe('Filaments Management - Debug', () => {
  test.beforeEach(async ({ page, authHelper, dashboardPage }) => {
    console.log('Starting test setup...');
    
    // Ensure clean state before each test
    await page.evaluate(() => {
      try {
        localStorage.clear();
        console.log('Cleared localStorage');
      } catch (e) {
        console.log('Failed to clear localStorage:', e);
      }
    });
    
    console.log('Navigating to auth page...');
    await page.goto('/auth');
    
    // Login as admin
    console.log('Logging in as admin...');
    await authHelper.loginAsAdmin();
    console.log('Login completed');
    
    // Clean database after login
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    console.log('Auth token exists:', !!token);
    
    if (token) {
      // Delete all purchases first (foreign key constraint)
      try {
        const purchasesResponse = await page.request.get('/api/filament_purchases', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (purchasesResponse.ok()) {
          const purchases = await purchasesResponse.json();
          console.log(`Found ${purchases.length} purchases to clean up`);
          for (const purchase of purchases) {
            await page.request.delete(`/api/filament_purchases/${purchase.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
          }
        }
      } catch (e) {
        console.log('Failed to clean purchases:', e);
      }
      
      // Delete all filaments
      try {
        const filamentsResponse = await page.request.get('/api/filaments', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (filamentsResponse.ok()) {
          const filaments = await filamentsResponse.json();
          console.log(`Found ${filaments.length} filaments to clean up`);
          for (const filament of filaments) {
            await page.request.delete(`/api/filaments/${filament.id}`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
          }
        }
      } catch (e) {
        console.log('Failed to clean filaments:', e);
      }
    }
    
    // Navigate to dashboard
    console.log('Navigating to dashboard...');
    try {
      await page.goto('/');
      await page.waitForURL(url => url.pathname === '/' && (!url.search || url.search === '?tab=home'), { timeout: 15000 });
      console.log('Successfully navigated to dashboard');
    } catch {
      console.log('Failed initial navigation, trying direct home tab...');
      await page.goto('/?tab=home');
      await page.waitForURL('/?tab=home', { timeout: 15000 });
      console.log('Successfully navigated to home tab');
    }
    
    await page.waitForLoadState('networkidle');
    console.log('Page loaded, waiting for user menu...');
    await page.waitForSelector('[data-testid="user-menu"]', { timeout: 10000 });
    console.log('User menu found');
    
    // Navigate to filaments tab using responsive navigation
    console.log('Navigating to filaments tab...');
    await dashboardPage.navigateToTab('filaments');
    console.log('Navigation to filaments tab completed');
    
    // Wait a bit for the page to fully render
    await page.waitForTimeout(2000);
  });

  test('should load filaments page with required sections - DEBUG', async ({ page }) => {
    console.log('Starting filaments page test...');
    
    // Take initial screenshot
    await page.screenshot({ path: 'screenshots/filaments-debug-initial.png', fullPage: true });
    
    // Log current URL
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);
    
    // Log all visible text on the page
    const allText = await page.evaluate(() => {
      const texts = [];
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: function(node) {
            if (node.nodeValue && node.nodeValue.trim()) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_REJECT;
          }
        }
      );
      
      let node;
      while (node = walker.nextNode()) {
        texts.push(node.nodeValue.trim());
      }
      return texts;
    });
    console.log('All visible text on page:', allText);
    
    // Log all headings
    const headings = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
        tag: h.tagName,
        text: h.textContent,
        visible: window.getComputedStyle(h).display !== 'none'
      }));
    });
    console.log('All headings:', headings);
    
    // Log all buttons
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent,
        visible: window.getComputedStyle(b).display !== 'none',
        disabled: b.disabled
      }));
    });
    console.log('All buttons:', buttons);
    
    // Log all elements with specific text
    const filamentPurchasesElements = await page.evaluate(() => {
      const elements = [];
      const xpath = "//text()[contains(., 'Filament Purchases')]";
      const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      for (let i = 0; i < result.snapshotLength; i++) {
        const node = result.snapshotItem(i);
        elements.push({
          text: node.textContent,
          parentTag: node.parentElement?.tagName,
          parentClass: node.parentElement?.className
        });
      }
      return elements;
    });
    console.log('Elements containing "Filament Purchases":', filamentPurchasesElements);
    
    // Try different selectors for "Filament Purchases"
    const selectors = [
      'text=Filament Purchases',
      'text="Filament Purchases"',
      ':text("Filament Purchases")',
      'h2:has-text("Filament Purchases")',
      'h3:has-text("Filament Purchases")',
      '[class*="card"] >> text=Filament Purchases',
      '.card-hover >> text=Filament Purchases'
    ];
    
    for (const selector of selectors) {
      try {
        const count = await page.locator(selector).count();
        console.log(`Selector "${selector}" found ${count} elements`);
        if (count > 0) {
          const element = page.locator(selector).first();
          const box = await element.boundingBox();
          console.log(`  Bounding box:`, box);
          const isVisible = await element.isVisible();
          console.log(`  Is visible:`, isVisible);
        }
      } catch (e) {
        console.log(`Selector "${selector}" failed:`, e.message);
      }
    }
    
    // Take screenshot before assertions
    await page.screenshot({ path: 'screenshots/filaments-debug-before-assertions.png', fullPage: true });
    
    // Try to verify sections with more flexible selectors
    try {
      await expect(page.locator('text=Filament Purchases')).toBeVisible();
      console.log('✓ Found "Filament Purchases" text');
    } catch (e) {
      console.log('✗ Failed to find "Filament Purchases":', e.message);
      await page.screenshot({ path: 'screenshots/filaments-debug-purchases-not-found.png', fullPage: true });
    }
    
    try {
      await expect(page.locator('text=Filament Inventory').first()).toBeVisible();
      console.log('✓ Found "Filament Inventory" text');
    } catch (e) {
      console.log('✗ Failed to find "Filament Inventory":', e.message);
      await page.screenshot({ path: 'screenshots/filaments-debug-inventory-not-found.png', fullPage: true });
    }
    
    // Try to open purchases section
    try {
      console.log('Attempting to click on "Filament Purchases"...');
      await page.click('text=Filament Purchases');
      console.log('✓ Clicked on "Filament Purchases"');
      
      // Wait for the collapsible to open
      await page.waitForTimeout(500);
      
      // Take screenshot after clicking
      await page.screenshot({ path: 'screenshots/filaments-debug-after-click.png', fullPage: true });
    } catch (e) {
      console.log('✗ Failed to click "Filament Purchases":', e.message);
    }
    
    // Log final page state
    const finalHtml = await page.evaluate(() => document.body.innerHTML);
    console.log('Final page HTML length:', finalHtml.length);
    console.log('Final page HTML preview:', finalHtml.substring(0, 500) + '...');
  });
});