import { Page, Locator, expect } from '@playwright/test';

export interface FilamentData {
  brand: string;
  material: string;
  color: string;
  diameter?: number;
  costPerGram?: number;
  supplier?: string;
  notes?: string;
  lowStockThreshold?: number;
}

export interface PurchaseData {
  quantity: number;
  pricePerUnit: number;
  supplier: string;
  orderNumber?: string;
}

export class FilamentsPage {
  readonly page: Page;
  readonly createButton: Locator;
  readonly searchInput: Locator;
  readonly filamentsTable: Locator;
  readonly purchaseForm: Locator;
  readonly inventorySection: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Main elements
    this.createButton = page.locator('[data-testid="create-filament-button"]');
    this.searchInput = page.locator('[data-testid="filament-search"]');
    this.filamentsTable = page.locator('[data-testid="filaments-table"]');
    this.purchaseForm = page.locator('[data-testid="purchase-form"]');
    this.inventorySection = page.locator('[data-testid="inventory-section"]');
  }

  async goto() {
    await this.page.goto('/?tab=filaments');
    await this.waitForLoad();
  }

  async waitForLoad() {
    // Wait for the filaments table to be visible
    await this.filamentsTable.waitFor({ state: 'visible' });
    await this.page.waitForLoadState('networkidle');
  }

  async createFilament(data: FilamentData) {
    // Click create button
    await this.createButton.click();
    
    // Wait for dialog
    const dialog = this.page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });
    
    // Fill form
    await this.page.fill('[name="brand"]', data.brand);
    await this.page.fill('[name="material"]', data.material);
    await this.page.fill('[name="color"]', data.color);
    
    if (data.diameter) {
      await this.page.fill('[name="diameter"]', data.diameter.toString());
    }
    
    if (data.costPerGram) {
      await this.page.fill('[name="costPerGram"]', data.costPerGram.toString());
    }
    
    if (data.supplier) {
      await this.page.fill('[name="supplier"]', data.supplier);
    }
    
    if (data.notes) {
      await this.page.fill('[name="notes"]', data.notes);
    }
    
    if (data.lowStockThreshold) {
      await this.page.fill('[name="lowStockThreshold"]', data.lowStockThreshold.toString());
    }
    
    // Submit
    await this.page.click('button[type="submit"]:has-text("Create")');
    
    // Wait for dialog to close
    await dialog.waitFor({ state: 'hidden' });
    
    // Wait for table to update
    await this.page.waitForTimeout(500);
  }

  async recordPurchase(filamentColor: string, data: PurchaseData) {
    const row = await this.getFilamentRow(filamentColor);
    await row.locator('[data-testid="record-purchase"]').click();

    const dialog = this.page.locator('[role="dialog"]').filter({ hasText: 'Record Purchase' });
    await dialog.waitFor({ state: 'visible' });

    await this.page.fill('[name="quantity"]', data.quantity.toString());
    await this.page.fill('[name="pricePerUnit"]', data.pricePerUnit.toString());
    await this.page.fill('[name="supplier"]', data.supplier);
    
    if (data.orderNumber) {
      await this.page.fill('[name="orderNumber"]', data.orderNumber);
    }

    await dialog.locator('button[type="submit"]:has-text("Record")').click();
    await dialog.waitFor({ state: 'hidden' });
  }

  async searchFilaments(query: string) {
    await this.searchInput.fill(query);
    // Wait for search results to update
    await this.page.waitForTimeout(300);
  }

  async getFilamentRows() {
    return await this.filamentsTable.locator('tbody tr').all();
  }

  async getFilamentRow(color: string) {
    return this.page.locator('tr').filter({ hasText: color });
  }

  async getFilamentByName(name: string): Promise<Locator | null> {
    const rows = await this.getFilamentRows();
    for (const row of rows) {
      const text = await row.textContent();
      if (text?.includes(name)) {
        return row;
      }
    }
    return null;
  }

  async selectFilament(filamentName: string) {
    const row = await this.getFilamentByName(filamentName);
    if (!row) {
      throw new Error(`Filament "${filamentName}" not found`);
    }
    await row.click();
  }

  async editFilament(color: string, updates: Partial<FilamentData> & { costPerGram?: number; notes?: string }) {
    const row = await this.getFilamentRow(color);
    await row.locator('[data-testid="edit-filament"]').click();

    const dialog = this.page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible' });

    if (updates.brand) {
      await this.page.fill('[name="brand"]', updates.brand);
    }
    
    if (updates.material) {
      await this.page.fill('[name="material"]', updates.material);
    }
    
    if (updates.color) {
      await this.page.fill('[name="color"]', updates.color);
    }
    
    if (updates.costPerGram !== undefined) {
      await this.page.fill('[name="costPerGram"]', updates.costPerGram.toString());
    }
    
    if (updates.notes !== undefined) {
      await this.page.fill('[name="notes"]', updates.notes);
    }

    await this.page.click('button[type="submit"]:has-text("Save")');
    await dialog.waitFor({ state: 'hidden' });
  }

  async deleteFilament(color: string) {
    const row = await this.getFilamentRow(color);
    await row.locator('[data-testid="delete-filament"]').click();
  }

  async exportPurchaseHistory(filamentColor: string) {
    const row = await this.getFilamentRow(filamentColor);
    await row.locator('[data-testid="export-history"]').click();
  }

  async viewCostAnalysis(filamentColor: string) {
    const row = await this.getFilamentRow(filamentColor);
    await row.locator('[data-testid="view-cost-analysis"]').click();
    
    const dialog = this.page.locator('[role="dialog"]').filter({ hasText: 'Cost Analysis' });
    await dialog.waitFor({ state: 'visible' });
  }

  async getInventoryStats() {
    const stats = {
      totalStock: '',
      avgPrice: '',
      totalValue: '',
    };

    // Get values from the inventory cards
    const stockCard = this.inventorySection.locator('[data-testid="total-stock"]');
    const priceCard = this.inventorySection.locator('[data-testid="avg-price"]');
    const valueCard = this.inventorySection.locator('[data-testid="total-value"]');

    stats.totalStock = await stockCard.textContent() || '';
    stats.avgPrice = await priceCard.textContent() || '';
    stats.totalValue = await valueCard.textContent() || '';

    return stats;
  }

  async checkLowStockAlert(filamentName: string): Promise<boolean> {
    const row = await this.getFilamentByName(filamentName);
    if (!row) return false;
    
    // Check if row has low stock indicator
    const alert = row.locator('[data-testid="low-stock-badge"]');
    return await alert.isVisible();
  }

  async setMinimumStock(filamentName: string, minStock: string) {
    await this.selectFilament(filamentName);
    
    // Find and update minimum stock field
    await this.page.fill('[name="min_filaments_kg"]', minStock);
    await this.page.click('button:has-text("Update Minimum")');
    
    // Wait for update confirmation
    await this.page.waitForSelector('text=Minimum stock updated');
  }

  async getPurchaseHistory() {
    // Click on purchases tab/section
    await this.page.click('[data-testid="purchases-tab"]');
    
    // Get all purchase rows
    const purchaseRows = await this.page.locator('[data-testid="purchase-row"]').all();
    
    const purchases = [];
    for (const row of purchaseRows) {
      purchases.push({
        date: await row.locator('[data-testid="purchase-date"]').textContent(),
        quantity: await row.locator('[data-testid="purchase-quantity"]').textContent(),
        price: await row.locator('[data-testid="purchase-price"]').textContent(),
        total: await row.locator('[data-testid="purchase-total"]').textContent(),
      });
    }
    
    return purchases;
  }

  async exportPurchases() {
    await this.page.click('[data-testid="export-purchases"]');
    
    // Wait for download
    const download = await this.page.waitForEvent('download');
    return download;
  }
}