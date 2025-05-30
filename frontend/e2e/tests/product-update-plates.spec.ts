import { test, expect } from '../fixtures/base-test';
import { uniqueId } from '../helpers/unique-id';

test.describe('Product Update with Plates', () => {
  let testId: string;
  let createdProductIds: number[] = [];
  let createdFilamentIds: number[] = [];

  test.beforeEach(async ({ page, authHelper, dashboardPage }) => {
    testId = uniqueId('test');
    createdProductIds = [];
    createdFilamentIds = [];
    
    // Ensure clean state
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch (e) {
        console.log('localStorage not accessible:', e);
      }
    });
    await page.goto('/auth');
    
    // Login as admin
    await authHelper.loginAsAdmin();
    
    // Clean state: Ensure we have clean test filaments
    await setupTestFilaments(page);
    
    // Navigate to Products tab - try different selector strategies
    try {
      // First try the button with text
      await page.click('button:has-text("Products")', { timeout: 5000 });
    } catch {
      // If that fails, try tab button
      await page.click('[role="tab"]:has-text("Products")', { timeout: 5000 });
    }
    
    // Wait for products list to be visible by looking for the Products List card
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text="Products List"')).toBeVisible({ timeout: 10000 });
  });

  test.afterEach(async ({ page }) => {
    // Get auth token for cleanup
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    if (token) {
      // Clean up: Delete all created products
      for (const productId of createdProductIds) {
        try {
          await page.request.delete(`/api/products/${productId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch (e) {
          // Silently continue if cleanup fails
        }
      }
      
      // Clean up: Delete all created test filaments
      for (const filamentId of createdFilamentIds) {
        try {
          await page.request.delete(`/api/filaments/${filamentId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch (e) {
          // Silently continue if cleanup fails
        }
      }
    }
  });

  // Helper function to set up consistent test filaments
  async function setupTestFilaments(page: any) {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    if (!token) throw new Error('No auth token found');

    // Create consistent test filaments
    const testFilaments = [
      { name: `Test PLA Red ${testId}`, cost_per_kg: 25.0, color: 'Red', material: 'PLA' },
      { name: `Test PETG Blue ${testId}`, cost_per_kg: 35.0, color: 'Blue', material: 'PETG' },
      { name: `Test ABS Black ${testId}`, cost_per_kg: 30.0, color: 'Black', material: 'ABS' }
    ];

    for (const filament of testFilaments) {
      const response = await page.request.post('/api/filaments', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json' 
        },
        data: filament
      });
      const createdFilament = await response.json();
      createdFilamentIds.push(createdFilament.id);
    }
  }

  // Helper function to create a test product
  async function createTestProduct(page: any, productData: any) {
    const token = await page.evaluate(() => localStorage.getItem('auth_token'));
    if (!token) throw new Error('No auth token found');

    // Replace generic filament_ids with our test filament IDs
    if (productData.plates) {
      productData.plates.forEach((plate: any) => {
        if (plate.filament_usages) {
          plate.filament_usages.forEach((usage: any, index: number) => {
            usage.filament_id = createdFilamentIds[index % createdFilamentIds.length];
          });
        }
      });
    }

    const response = await page.request.post('/api/products', {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json' 
      },
      data: productData
    });
    
    const createdProduct = await response.json();
    createdProductIds.push(createdProduct.id);
    return createdProduct;
  }

  test('displays all product plates in update modal', async ({ page }) => {
    // ARRANGE: Create a product with 2 plates using test fixtures
    const productData = {
      name: `Test Product ${testId}`,
      print_time_hrs: 2.5,
      plates: [
        {
          name: 'Plate 1',
          quantity: 1,
          print_time_hrs: 1.5,
          filament_usages: [
            { filament_id: 1, grams_used: 50.0 }
          ]
        },
        {
          name: 'Plate 2', 
          quantity: 2,
          print_time_hrs: 1.0,
          filament_usages: [
            { filament_id: 1, grams_used: 30.0 },
            { filament_id: 2, grams_used: 20.0 }
          ]
        }
      ]
    };

    const createdProduct = await createTestProduct(page, productData);

    // Refresh the page to see the new product
    await page.reload();
    // Wait for products list to be visible
    await expect(page.locator('.card-hover:has-text("Products List")')).toBeVisible();

    // ACT: Open product update modal
    // Find the table row containing the product name
    const productRow = page.locator(`tr:has-text("${productData.name}")`);
    await expect(productRow).toBeVisible({ timeout: 10000 });
    // Click the edit button (Pencil icon) in that row - using more flexible selector
    const editButton = productRow.locator('button').filter({ has: page.locator('svg') }).nth(1); // Second button with SVG (first is info)
    await editButton.click();

    // ASSERT: Verify the update modal opens with PlateManager
    // Look for dialog with Edit Product title
    const editModal = page.locator('div[role="dialog"]:has-text("Edit Product")');
    await expect(editModal).toBeVisible();
    // PlateManager should be visible within the modal under Plates heading
    await expect(editModal.locator('h3:has-text("Plates")')).toBeVisible();

    // ASSERT: Verify both plates are displayed with correct details
    // Look for the plates table within the PlateManager
    // PlateManager renders a card with "Product Plates" title
    await expect(editModal.locator(':text("Product Plates")')).toBeVisible({ timeout: 5000 });
    const platesSection = editModal.locator('div:has(> h3:has-text("Plates"))');
    const platesTable = platesSection.locator('table').first();
    
    // Find plate rows in the table
    const plate1Row = platesTable.locator('tr:has-text("Plate 1")');
    await expect(plate1Row).toBeVisible();
    await expect(plate1Row.locator('td').nth(1)).toContainText('1'); // Quantity column
    await expect(plate1Row.locator('td').nth(2)).toContainText('1.5h'); // Print Time column

    const plate2Row = platesTable.locator('tr:has-text("Plate 2")');
    await expect(plate2Row).toBeVisible();
    await expect(plate2Row.locator('td').nth(1)).toContainText('2'); // Quantity column
    await expect(plate2Row.locator('td').nth(2)).toContainText('1.0h'); // Print Time column
  });

  test('can add new plate with multiple filaments to existing product', async ({ page }) => {
    // ARRANGE: Create a product with 1 existing plate
    const productData = {
      name: `Test Product ${testId}`,
      print_time_hrs: 1.5,
      plates: [
        {
          name: 'Existing Plate',
          quantity: 1,
          print_time_hrs: 1.5,
          filament_usages: [
            { filament_id: 1, grams_used: 25.0 }
          ]
        }
      ]
    };

    const createdProduct = await createTestProduct(page, productData);
    
    // Navigate to update modal
    await page.reload();
    const productRow = page.locator(`tr:has-text("${productData.name}")`);
    const editButton = productRow.locator('button').filter({ has: page.locator('svg') }).nth(1);
    await editButton.click();
    const editModal = page.locator('div[role="dialog"]:has-text("Edit Product")');
    await expect(editModal).toBeVisible();

    // ACT: Add new plate with multiple filaments
    // Click the add plate button within the modal
    await editModal.locator('button:has-text("Add Plate")').click();
    
    // Find the new plate form/dialog
    const plateForm = page.locator('div[role="dialog"]:has-text("Add New Plate")');
    await plateForm.locator('input[placeholder*="name"]').fill('New Plate');
    await plateForm.locator('input[placeholder*="quantity"]').fill('3');
    await plateForm.locator('input[placeholder*="time"]').fill('2.5');

    // Add first filament using our test filament IDs
    await plateForm.locator('select').first().selectOption(createdFilamentIds[0].toString());
    await plateForm.locator('input[placeholder*="grams"]').first().fill('50');

    // Add second filament
    await plateForm.locator('button:has-text("Add Filament")').click();
    await plateForm.locator('select').nth(1).selectOption(createdFilamentIds[1].toString());
    await plateForm.locator('input[placeholder*="grams"]').nth(1).fill('30');

    await plateForm.locator('button:has-text("Save")').click();

    // ASSERT: Verify new plate was added correctly
    const platesSection = editModal.locator('div:has(> h3:has-text("Plates"))');
    const platesTable = platesSection.locator('table').first();
    const newPlateRow = platesTable.locator('tr:has-text("New Plate")');
    await expect(newPlateRow).toBeVisible();
    await expect(newPlateRow.locator('td').nth(1)).toContainText('3'); // Quantity column
    await expect(newPlateRow.locator('td').nth(2)).toContainText('2.5h'); // Print Time column

    // ASSERT: Verify both plates exist
    await expect(platesTable.locator('tr:has-text("Existing Plate")')).toBeVisible();
    await expect(platesTable.locator('tr:has-text("New Plate")')).toBeVisible();
  });

  test('can modify filaments within existing plate', async ({ page }) => {
    // ARRANGE: Create product with plate having 2 filaments
    const productData = {
      name: `Test Product ${testId}`,
      print_time_hrs: 2.0,
      plates: [
        {
          name: 'Test Plate',
          quantity: 2,
          print_time_hrs: 2.0,
          filament_usages: [
            { filament_id: 1, grams_used: 50.0 },
            { filament_id: 2, grams_used: 30.0 }
          ]
        }
      ]
    };

    const createdProduct = await createTestProduct(page, productData);

    // Navigate to update modal
    await page.reload();
    const productRow = page.locator(`tr:has-text("${productData.name}")`);
    await productRow.locator('button:has(svg.lucide-pencil)').click();

    // ACT: Edit the plate's filaments
    const editModal = page.locator('div[role="dialog"]:has-text("Edit Product")');
    const platesSection = editModal.locator('div:has(> h3:has-text("Plates"))');
    const platesTable = platesSection.locator('table').first();
    const plateRow = platesTable.locator('tr:has-text("Test Plate")');
    await plateRow.locator('button:has(svg.lucide-pencil)').click();

    // Wait for edit dialog
    const plateEditDialog = page.locator('div[role="dialog"]:has-text("Edit Plate")');
    
    // Modify first filament quantity from 50g to 75g
    await plateEditDialog.locator('input[placeholder*="grams"]').first().fill('75');

    // Remove second filament
    await plateEditDialog.locator('button:has(svg.lucide-trash-2)').nth(1).click();

    // Add new filament (using our third test filament with 20g)
    await plateEditDialog.locator('button:has-text("Add Filament")').click();
    await plateEditDialog.locator('select').nth(1).selectOption(createdFilamentIds[2].toString());
    await plateEditDialog.locator('input[placeholder*="grams"]').nth(1).fill('20');

    await plateEditDialog.locator('button:has-text("Save")').click();

    // ASSERT: Verify changes persisted by re-opening edit dialog
    await plateRow.locator('button:has(svg.lucide-pencil)').click();
    const plateEditDialog2 = page.locator('div[role="dialog"]:has-text("Edit Plate")');
    
    await expect(plateEditDialog2.locator('input[placeholder*="grams"]').first()).toHaveValue('75');
    await expect(plateEditDialog2.locator('select').nth(1)).toHaveValue(createdFilamentIds[2].toString());
    await expect(plateEditDialog2.locator('input[placeholder*="grams"]').nth(1)).toHaveValue('20');
  });

  test('can delete plate from product', async ({ page }) => {
    // ARRANGE: Create product with 2 plates
    const productData = {
      name: `Test Product ${testId}`,
      print_time_hrs: 3.0,
      plates: [
        {
          name: 'Plate To Keep',
          quantity: 1,
          print_time_hrs: 1.5,
          filament_usages: [{ filament_id: 1, grams_used: 25.0 }]
        },
        {
          name: 'Plate To Delete',
          quantity: 1,
          print_time_hrs: 1.5,
          filament_usages: [{ filament_id: 1, grams_used: 25.0 }]
        }
      ]
    };

    const createdProduct = await createTestProduct(page, productData);

    // Navigate to update modal
    await page.reload();
    const productRow = page.locator(`tr:has-text("${productData.name}")`);
    await productRow.locator('button:has(svg.lucide-pencil)').click();

    const editModal = page.locator('div[role="dialog"]:has-text("Edit Product")');
    const platesSection = editModal.locator('div:has(> h3:has-text("Plates"))');
    const platesTable = platesSection.locator('table').first();

    // ARRANGE: Verify both plates are initially present
    await expect(platesTable.locator('tr:has-text("Plate To Keep")')).toBeVisible();
    await expect(platesTable.locator('tr:has-text("Plate To Delete")')).toBeVisible();

    // ACT: Delete the second plate
    const plateToDeleteRow = platesTable.locator('tr:has-text("Plate To Delete")');
    await plateToDeleteRow.locator('button:has(svg.lucide-trash-2)').click();
    
    // Handle confirmation dialog if it exists
    await page.locator('button:has-text("Confirm")').click().catch(() => {});

    // ASSERT: Verify only one plate remains
    await expect(platesTable.locator('tr:has-text("Plate To Keep")')).toBeVisible();
    await expect(platesTable.locator('tr:has-text("Plate To Delete")')).not.toBeVisible();
  });

  test('product name and license updates work alongside plates', async ({ page }) => {
    // ARRANGE: Create a basic product
    const productData = {
      name: `Original Name ${testId}`,
      print_time_hrs: 1.0,
      plates: [
        {
          name: 'Test Plate',
          quantity: 1,
          print_time_hrs: 1.0,
          filament_usages: [{ filament_id: 1, grams_used: 25.0 }]
        }
      ]
    };

    const createdProduct = await createTestProduct(page, productData);

    // Navigate to update modal
    await page.reload();
    const productRow = page.locator(`tr:has-text("${productData.name}")`);
    await productRow.locator('button:has(svg.lucide-pencil)').click();

    const editModal = page.locator('div[role="dialog"]:has-text("Edit Product")');

    // ACT: Update product name and add a new plate
    const nameInput = editModal.locator('input#editProdName');
    await nameInput.fill(`Updated Name ${testId}`);

    // Add a new plate via PlateManager
    await editModal.locator('button:has-text("Add Plate")').click();
    
    const plateForm = page.locator('div[role="dialog"]:has-text("Add New Plate")');
    await plateForm.locator('input[placeholder*="name"]').fill('Second Plate');
    await plateForm.locator('input[placeholder*="quantity"]').fill('1');
    await plateForm.locator('input[placeholder*="time"]').fill('0.5');
    await plateForm.locator('select').first().selectOption(createdFilamentIds[0].toString());
    await plateForm.locator('input[placeholder*="grams"]').first().fill('15');
    await plateForm.locator('button:has-text("Save")').click();

    // Save product-level changes
    await editModal.locator('button:has-text("Update Product")').click();

    // Wait for modal to close
    await expect(editModal).not.toBeVisible();
    
    // ASSERT: Verify changes were saved
    await page.reload();
    
    // Verify product name was updated
    await expect(page.locator(`tr:has-text("Updated Name ${testId}")`)).toBeVisible();
    
    // Verify both plates exist by reopening modal
    const updatedRow = page.locator(`tr:has-text("Updated Name ${testId}")`);
    await updatedRow.locator('button:has(svg.lucide-pencil)').click();
    
    const editModal2 = page.locator('div[role="dialog"]:has-text("Edit Product")');
    const platesSection2 = editModal2.locator('div:has(> h3:has-text("Plates"))');
    const platesTable = platesSection2.locator('table').first();
    
    await expect(platesTable.locator('tr:has-text("Test Plate")')).toBeVisible();
    await expect(platesTable.locator('tr:has-text("Second Plate")')).toBeVisible();
  });
});