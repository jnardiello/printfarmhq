import { Page, Locator, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;
  readonly homeTab: Locator;
  readonly filamentsTab: Locator;
  readonly productsTab: Locator;
  readonly printersTab: Locator;
  readonly printJobsTab: Locator;
  readonly subscriptionsTab: Locator;
  readonly usersTab: Locator;
  readonly themeToggle: Locator;
  readonly userMenu: Locator;
  readonly navigationMenu: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Navigation tabs - using the actual button structure from dashboard
    this.homeTab = page.locator('button:has-text("Overview")');
    this.filamentsTab = page.locator('button:has-text("Inventory")'); // Filaments is under Inventory dropdown
    this.productsTab = page.locator('button:has-text("Inventory")'); // Products is under Inventory dropdown  
    this.printersTab = page.locator('button:has-text("Inventory")'); // Printers is under Inventory dropdown
    this.printJobsTab = page.locator('button:has-text("Print Queue")');
    this.subscriptionsTab = page.locator('button:has-text("Inventory")'); // Subscriptions is under Inventory dropdown
    this.usersTab = page.locator('button:has-text("Administration")'); // Users is under Administration dropdown
    
    // UI elements
    this.themeToggle = page.locator('[data-testid="theme-toggle"]');
    this.userMenu = page.locator('[data-testid="user-menu"]');
    this.navigationMenu = page.locator('nav');
  }

  async goto() {
    // Handle Safari redirect from / to /?tab=home gracefully
    try {
      await this.page.goto('/');
      await this.page.waitForURL(url => url.pathname === '/' && (!url.search || url.search === '?tab=home'), { timeout: 15000 });
    } catch {
      // Fallback - try direct navigation to home tab for Safari
      await this.page.goto('/?tab=home');
      await this.page.waitForURL('/?tab=home', { timeout: 15000 });
    }
    // Wait for page to load
    await this.page.waitForLoadState('networkidle');
  }

  async navigateToTab(tabName: string) {
    const tabLower = tabName.toLowerCase();
    
    // Wait for page to be ready before navigating
    await this.page.waitForLoadState('networkidle');
    
    // Check if we're on mobile
    const viewport = this.page.viewportSize();
    const isMobile = viewport && viewport.width < 768;
    
    if (isMobile) {
      // Ensure any existing menu is closed first
      const existingMenu = this.page.locator('[role="menu"]');
      if (await existingMenu.isVisible().catch(() => false)) {
        await this.page.keyboard.press('Escape');
        await this.page.waitForTimeout(200);
      }
      
      // Mobile navigation - simple approach first, Safari workarounds if needed
      const mobileDropdown = this.page.locator('button').filter({ hasText: /Overview|Print Queue|Filaments|Products/ }).first();
      await mobileDropdown.waitFor({ state: 'visible', timeout: 5000 });
      await mobileDropdown.click();
      
      // Wait for dropdown menu to be visible 
      try {
        await this.page.waitForSelector('[role="menu"]', { state: 'visible', timeout: 3000 });
      } catch {
        // Safari fallback - try the more complex approach
        await this.openMobileMenu();
      }
      
      await this.page.waitForTimeout(100);
      
      switch (tabLower) {
        case 'home':
          // More reliable approach for Safari - find by exact text match
          const overviewMenuItem = this.page.locator('[role="menuitem"]').filter({ hasText: 'Overview' });
          await overviewMenuItem.click();
          await this.page.waitForURL('**/?tab=home', { timeout: 10000 });
          break;
        case 'prints':
          // More reliable approach for Safari - find by exact text match
          const printJobsMenuItem = this.page.locator('[role="menuitem"]').filter({ hasText: 'Print Queue' });
          await printJobsMenuItem.click();
          await this.page.waitForURL('**/?tab=prints', { timeout: 10000 });
          break;
        case 'filaments':
          // More reliable approach for Safari - find by exact text match
          const filamentsMenuItem = this.page.locator('[role="menuitem"]').filter({ hasText: 'Filaments' });
          await filamentsMenuItem.click();
          await this.page.waitForURL('**/?tab=filaments', { timeout: 10000 });
          break;
        case 'products':
          // More reliable approach for Safari - find by exact text match
          const productsMenuItem = this.page.locator('[role="menuitem"]').filter({ hasText: 'Products' });
          await productsMenuItem.click();
          await this.page.waitForURL('**/?tab=products', { timeout: 10000 });
          break;
        default:
          throw new Error(`Unknown mobile tab: ${tabName}`);
      }
    } else {
      // Desktop navigation
      switch (tabLower) {
        case 'home':
          await this.page.waitForSelector('button:has-text("Overview")', { state: 'visible' });
          await this.page.click('button:has-text("Overview")');
          await this.page.waitForURL('**/?tab=home');
          break;
          
        case 'prints':
          await this.page.waitForSelector('button:has-text("Print Queue")', { state: 'visible' });
          await this.page.click('button:has-text("Print Queue")');
          await this.page.waitForURL('**/?tab=prints');
          break;
          
        case 'filaments':
          await this.page.waitForSelector('button[aria-haspopup="menu"]:has-text("Inventory")', { state: 'visible' });
          await this.page.click('button[aria-haspopup="menu"]:has-text("Inventory")');
          // Check if menu is already open or wait for it to open
          try {
            await this.page.waitForSelector('[role="menuitem"]:has-text("Filaments")', { state: 'visible', timeout: 2000 });
          } catch {
            // If not visible, try clicking Inventory again
            await this.page.click('button[aria-haspopup="menu"]:has-text("Inventory")');
            await this.page.waitForSelector('[role="menuitem"]:has-text("Filaments")', { state: 'visible', timeout: 5000 });
          }
          await this.page.click('[role="menuitem"]:has-text("Filaments")');
          await this.page.waitForURL('**/?tab=filaments');
          break;
          
        case 'products':
          // More robust approach: always close menu first if open, then open fresh
          const menuVisible = await this.page.locator('[role="menu"]').isVisible().catch(() => false);
          if (menuVisible) {
            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(300);
          }
          
          // Now open the dropdown fresh
          await this.page.waitForSelector('button[aria-haspopup="menu"]:has-text("Inventory")', { state: 'visible' });
          await this.page.click('button[aria-haspopup="menu"]:has-text("Inventory")');
          
          // Wait for menu and click Products
          await this.page.waitForSelector('[role="menu"]', { state: 'visible', timeout: 5000 });
          await this.page.waitForTimeout(300); // Allow menu animation to complete
          
          // Click with retry logic
          const productsItem = this.page.locator('[role="menuitem"]:has-text("Products")').first();
          await productsItem.waitFor({ state: 'visible', timeout: 5000 });
          await productsItem.click({ timeout: 5000 });
          
          await this.page.waitForURL('**/?tab=products', { timeout: 10000 });
          break;
          
        case 'printers':
          await this.page.waitForSelector('button[aria-haspopup="menu"]:has-text("Inventory")', { state: 'visible' });
          await this.page.click('button[aria-haspopup="menu"]:has-text("Inventory")');
          // Wait for menu to be fully open and stable
          await this.page.waitForSelector('[role="menu"]', { state: 'visible' });
          await this.page.waitForTimeout(300); // Small delay for menu animation
          
          // Use more specific selector and force click if needed
          const printersMenuItem = this.page.locator('[role="menuitem"]:has-text("Printers")').first();
          await printersMenuItem.waitFor({ state: 'visible', timeout: 5000 });
          await printersMenuItem.click({ force: true });
          
          // Wait for navigation
          await this.page.waitForURL('**/?tab=printers', { timeout: 10000 });
          break;
          
        case 'subscriptions':
          await this.page.waitForSelector('button[aria-haspopup="menu"]:has-text("Inventory")', { state: 'visible' });
          await this.page.click('button[aria-haspopup="menu"]:has-text("Inventory")');
          // Wait for menu to be fully open and stable
          await this.page.waitForSelector('[role="menu"]', { state: 'visible' });
          await this.page.waitForTimeout(300); // Small delay for menu animation
          
          // Use more specific selector and force click if needed
          const licensesMenuItem = this.page.locator('[role="menuitem"]:has-text("Commercial Licenses")').first();
          await licensesMenuItem.waitFor({ state: 'visible', timeout: 5000 });
          await licensesMenuItem.click({ force: true });
          
          // Wait for navigation
          await this.page.waitForURL('**/?tab=subscriptions', { timeout: 10000 });
          break;
          
        case 'users':
          await this.page.click('button:has-text("Administration")');
          await this.page.waitForSelector('[role="menuitem"]:has-text("Users")', { state: 'visible' });
          await this.page.click('[role="menuitem"]:has-text("Users")');
          await this.page.waitForURL('**/?tab=users');
          break;
          
        default:
          throw new Error(`Unknown desktop tab: ${tabName}`);
      }
    }
  }

  async getActiveTab(): Promise<string | null> {
    const url = new URL(this.page.url());
    return url.searchParams.get('tab') || 'home';
  }

  async isTabActive(tabName: string): Promise<boolean> {
    const activeTab = await this.getActiveTab();
    return activeTab === tabName.toLowerCase();
  }

  async toggleTheme() {
    await this.themeToggle.click();
  }

  async getCurrentTheme(): Promise<'light' | 'dark'> {
    return await this.page.evaluate(() => {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    });
  }

  async openUserMenu() {
    await this.userMenu.click();
  }

  async isUserMenuOpen(): Promise<boolean> {
    // Check if dropdown menu is visible
    const dropdown = this.page.locator('[role="menu"]');
    return await dropdown.isVisible();
  }

  async getUserName(): Promise<string> {
    // Get the displayed user name from the user menu button
    return await this.userMenu.textContent() || '';
  }

  async waitForDataLoad() {
    // Wait for any loading spinners to disappear
    await this.page.waitForSelector('[data-testid="loading-spinner"]', { state: 'hidden' });
    
    // Wait for network to be idle
    await this.page.waitForLoadState('networkidle');
  }

  async isTabVisible(tabName: string): Promise<boolean> {
    const tabLower = tabName.toLowerCase();
    
    switch (tabLower) {
      case 'home':
        return await this.page.locator('button:has-text("Overview")').isVisible();
      case 'prints':
        return await this.page.locator('button:has-text("Print Queue")').isVisible();
      case 'filaments':
      case 'products':
      case 'printers':
      case 'subscriptions':
        return await this.page.locator('button:has-text("Inventory")').isVisible();
      case 'users':
        return await this.page.locator('button:has-text("Administration")').isVisible();
      default:
        return false;
    }
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ 
      path: `e2e/screenshots/${name}.png`,
      fullPage: true 
    });
  }

  async checkResponsiveLayout(viewport: { width: number; height: number }) {
    await this.page.setViewportSize(viewport);
    
    // Wait for layout to adapt
    await this.page.waitForTimeout(500);
    
    // Check if mobile navigation (dropdown) is visible on small screens
    if (viewport.width < 768) {
      // On mobile, navigation is a single dropdown button
      await expect(this.page.locator('button').filter({ hasText: 'Overview' }).or(this.page.locator('button').filter({ hasText: 'Menu' }))).toBeVisible();
    } else {
      // On desktop, individual navigation buttons should be visible
      await expect(this.page.locator('button:has-text("Overview")')).toBeVisible();
      await expect(this.page.locator('button:has-text("Inventory")')).toBeVisible();
    }
  }

  async getCurrentMobileTabText(): Promise<string> {
    // Try to find the mobile dropdown button - it shows the current tab name
    const dropdownButtons = await this.page.locator('button').all();
    for (const button of dropdownButtons) {
      const text = await button.textContent();
      if (text && (text.includes('Overview') || text.includes('Print Queue') || text.includes('Filaments') || text.includes('Products'))) {
        return text.trim();
      }
    }
    // Default fallback
    return 'Overview';
  }

  async openMobileMenu() {
    // Mobile navigation - use single dropdown menu
    // Find the mobile dropdown button - try multiple approaches for Safari compatibility
    let mobileDropdown = this.page.locator('button').filter({ hasText: /Overview|Print Queue|Filaments|Products|Menu/ }).first();
    
    // If not found, try looking for any button with text content in the navigation area
    if (!(await mobileDropdown.isVisible().catch(() => false))) {
      mobileDropdown = this.page.locator('nav button, header button').filter({ hasText: /.+/ }).first();
    }
    
    // Ensure button is visible before clicking
    await mobileDropdown.waitFor({ state: 'visible', timeout: 5000 });
    
    // Try double-click for Safari compatibility
    await mobileDropdown.click({ force: true });
    await this.page.waitForTimeout(100);
    
    // Check if menu opened, if not try again
    const menuVisible = await this.page.locator('[role="menu"]').isVisible().catch(() => false);
    if (!menuVisible) {
      await mobileDropdown.click({ force: true });
      await this.page.waitForTimeout(200);
    }
    
    // Wait for dropdown menu to be visible with longer timeout for Safari
    await this.page.waitForSelector('[role="menu"]', { state: 'visible', timeout: 10000 });
    
    // Add a small delay for Safari rendering
    await this.page.waitForTimeout(200);
  }
}