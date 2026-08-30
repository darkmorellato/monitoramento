import { test, expect } from '@playwright/test';

test.describe('Data Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Login
    await page.selectOption('[data-testid="store-selector"]', 'honor');
    await page.fill('[data-testid="password-input"]', '123456');
    await page.click('[data-testid="login-btn"]');
    await page.waitForSelector('[data-testid="dashboard"]');
  });

  test('should edit an existing entry', async ({ page }) => {
    // Add entry first
    await page.click('[data-testid="add-btn"]');
    await page.fill('[data-testid="date-input"]', '2024-01-15');
    await page.fill('[data-testid="total-input"]', '100.00');
    await page.fill('[data-testid="notes-input"]', 'Original note');
    await page.click('[data-testid="save-btn"]');

    // Find and edit the entry
    await page.click('[data-testid="edit-btn"]:first-child');
    await page.fill('[data-testid="notes-input"]', 'Updated note');
    await page.fill('[data-testid="total-input"]', '150.00');
    await page.click('[data-testid="save-btn"]');

    // Verify update
    await expect(page.locator('text=Updated note')).toBeVisible();
    await expect(page.locator('text=150,00')).toBeVisible();
  });

  test('should delete an entry', async ({ page }) => {
    // Add entry
    await page.click('[data-testid="add-btn"]');
    await page.fill('[data-testid="date-input"]', '2024-01-15');
    await page.fill('[data-testid="total-input"]', '100.00');
    await page.click('[data-testid="save-btn"]');

    // Delete it
    await page.click('[data-testid="delete-btn"]:first-child');

    // Confirm deletion if prompted
    const confirmDialog = page.locator('[data-testid="confirm-dialog"]');
    if (await confirmDialog.isVisible().catch(() => false)) {
      await page.click('[data-testid="confirm-yes"]');
    }

    // Verify deletion
    await expect(page.locator('text=100,00')).not.toBeVisible();
  });

  test('should filter entries by date range', async ({ page }) => {
    // Add entries with different dates
    const entries = [
      { date: '2024-01-01', total: '100' },
      { date: '2024-01-15', total: '200' },
      { date: '2024-01-30', total: '300' },
    ];

    for (const entry of entries) {
      await page.click('[data-testid="add-btn"]');
      await page.fill('[data-testid="date-input"]', entry.date);
      await page.fill('[data-testid="total-input"]', entry.total);
      await page.click('[data-testid="save-btn"]');
    }

    // Apply date filter
    await page.fill('[data-testid="filter-start-date"]', '2024-01-10');
    await page.fill('[data-testid="filter-end-date"]', '2024-01-20');
    await page.click('[data-testid="apply-filter"]');

    // Should only show entries in range
    await expect(page.locator('text=200,00')).toBeVisible();
    await expect(page.locator('text=100,00')).not.toBeVisible();
    await expect(page.locator('text=300,00')).not.toBeVisible();
  });

  test('should sort entries by different columns', async ({ page }) => {
    // Add entries
    await page.click('[data-testid="add-btn"]');
    await page.fill('[data-testid="date-input"]', '2024-01-15');
    await page.fill('[data-testid="total-input"]', '200');
    await page.click('[data-testid="save-btn"]');

    await page.click('[data-testid="add-btn"]');
    await page.fill('[data-testid="date-input"]', '2024-01-10');
    await page.fill('[data-testid="total-input"]', '100');
    await page.click('[data-testid="save-btn"]');

    // Sort by date
    await page.click('[data-testid="sort-date"]');
    const firstRowDate = await page.locator('tr:first-child td:first-child').textContent();
    expect(firstRowDate).toContain('10/01/2024');

    // Sort descending
    await page.click('[data-testid="sort-date"]');
    const firstRowDateDesc = await page.locator('tr:first-child td:first-child').textContent();
    expect(firstRowDateDesc).toContain('15/01/2024');
  });

  test('should paginate long lists', async ({ page }) => {
    // Add many entries (if pagination exists)
    for (let i = 0; i < 15; i++) {
      await page.click('[data-testid="add-btn"]');
      await page.fill('[data-testid="date-input"]', `2024-01-${String(i + 1).padStart(2, '0')}`);
      await page.fill('[data-testid="total-input"]', String(100 + i));
      await page.click('[data-testid="save-btn"]');
    }

    // Check for pagination
    const pagination = page.locator('[data-testid="pagination"]');
    if (await pagination.isVisible().catch(() => false)) {
      // Navigate to next page
      await page.click('[data-testid="page-next"]');
      await expect(page.locator('[data-testid="page-active"]')).toContainText('2');
    }
  });

  test('should export to PDF', async ({ page }) => {
    // Add test data
    await page.click('[data-testid="add-btn"]');
    await page.fill('[data-testid="date-input"]', '2024-01-15');
    await page.fill('[data-testid="total-input"]', '100.00');
    await page.click('[data-testid="save-btn"]');

    // Export PDF
    await page.click('[data-testid="export-btn"]');
    await page.click('[data-testid="export-pdf"]');

    // Wait for download
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toMatch(/\.(pdf|PDF)$/);
  });

  test('should import data from CSV', async ({ page }) => {
    // Create test CSV file
    const csvContent = `Data,Total,Notas
2024-01-15,150.50,Test import 1
2024-01-16,200.00,Test import 2`;

    // Trigger import
    await page.click('[data-testid="import-btn"]');

    // Upload file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('[data-testid="import-file-input"]');
    const fileChooser = await fileChooserPromise;

    // Create a file to upload
    const filePath = '/tmp/test-import.csv';
    await page.evaluate((content) => {
      const blob = new Blob([content], { type: 'text/csv' });
      const file = new File([blob], 'test-import.csv', { type: 'text/csv' });
      return file;
    }, csvContent);

    // Verify imported data
    await expect(page.locator('text=Test import 1')).toBeVisible();
    await expect(page.locator('text=Test import 2')).toBeVisible();
  });

  test('should handle large data volumes', async ({ page }) => {
    // Add multiple entries
    for (let i = 0; i < 50; i++) {
      await page.click('[data-testid="add-btn"]');
      await page.fill('[data-testid="date-input"]', `2024-01-${String((i % 30) + 1).padStart(2, '0')}`);
      await page.fill('[data-testid="total-input"]', String(100 + i));
      await page.click('[data-testid="save-btn"]');
    }

    // Table should still be responsive
    await expect(page.locator('[data-testid="entries-table"]')).toBeVisible();
    const rowCount = await page.locator('[data-testid="entries-table"] tbody tr').count();
    expect(rowCount).toBeGreaterThanOrEqual(50);
  });

  test('should calculate statistics correctly', async ({ page }) => {
    // Add entries with known values
    const values = [100, 200, 300, 400, 500];
    for (const val of values) {
      await page.click('[data-testid="add-btn"]');
      await page.fill('[data-testid="date-input"]', '2024-01-15');
      await page.fill('[data-testid="total-input"]', String(val));
      await page.click('[data-testid="save-btn"]');
    }

    // Check statistics
    // Total: 1500, Media: 300, Max: 500, Min: 100
    await expect(page.locator('[data-testid="kpi-total"]')).toContainText('R$ 1.500,00');
    await expect(page.locator('[data-testid="kpi-media"]')).toContainText('R$ 300,00');
    await expect(page.locator('[data-testid="kpi-max"]')).toContainText('R$ 500,00');
    await expect(page.locator('[data-testid="kpi-min"]')).toContainText('R$ 100,00');
  });
});
