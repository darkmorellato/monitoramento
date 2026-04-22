import { test, expect } from '@playwright/test';

test.describe('PWA - Monitoramento de Preços', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login screen initially', async ({ page }) => {
    await expect(page.locator('text=Selecione a Loja')).toBeVisible();
    await expect(page.locator('[data-testid="store-selector"]')).toBeVisible();
  });

  test('should authenticate and show dashboard', async ({ page }) => {
    // Select a store
    await page.selectOption('[data-testid="store-selector"]', 'honor');
    
    // Enter password
    await page.fill('[data-testid="password-input"]', '123456');
    await page.click('[data-testid="login-btn"]');
    
    // Should show dashboard
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
    await expect(page.locator('text=Total Gasto')).toBeVisible();
  });

  test('should add a new price entry', async ({ page }) => {
    // Login first
    await page.selectOption('[data-testid="store-selector"]', 'honor');
    await page.fill('[data-testid="password-input"]', '123456');
    await page.click('[data-testid="login-btn"]');
    
    // Open add form
    await page.click('[data-testid="add-btn"]');
    await expect(page.locator('[data-testid="entry-form"]')).toBeVisible();
    
    // Fill form
    await page.fill('[data-testid="date-input"]', '2024-01-15');
    await page.fill('[data-testid="time-input"]', '14:30');
    await page.fill('[data-testid="total-input"]', '150.50');
    await page.fill('[data-testid="notes-input"]', 'Test entry');
    
    // Submit
    await page.click('[data-testid="save-btn"]');
    
    // Should appear in table
    await expect(page.locator('text=150,50')).toBeVisible();
    await expect(page.locator('text=Test entry')).toBeVisible();
  });

  test('should calculate KPIs correctly', async ({ page }) => {
    await page.selectOption('[data-testid="store-selector"]', 'honor');
    await page.fill('[data-testid="password-input"]', '123456');
    await page.click('[data-testid="login-btn"]');
    
    // Add multiple entries
    const entries = [
      { date: '2024-01-15', total: '100.00' },
      { date: '2024-01-16', total: '150.00' },
      { date: '2024-01-17', total: '200.00' },
    ];
    
    for (const entry of entries) {
      await page.click('[data-testid="add-btn"]');
      await page.fill('[data-testid="date-input"]', entry.date);
      await page.fill('[data-testid="total-input"]', entry.total);
      await page.click('[data-testid="save-btn"]');
    }
    
    // Check KPI values
    await expect(page.locator('[data-testid="kpi-total"]')).toContainText('R$ 450,00');
    await expect(page.locator('[data-testid="kpi-media"]')).toContainText('R$ 150,00');
  });

  test('should export data to CSV', async ({ page }) => {
    await page.selectOption('[data-testid="store-selector"]', 'honor');
    await page.fill('[data-testid="password-input"]', '123456');
    await page.click('[data-testid="login-btn"]');
    
    // Add test data
    await page.click('[data-testid="add-btn"]');
    await page.fill('[data-testid="date-input"]', '2024-01-15');
    await page.fill('[data-testid="total-input"]', '100.00');
    await page.click('[data-testid="save-btn"]');
    
    // Export
    await page.click('[data-testid="export-btn"]');
    await page.click('[data-testid="export-csv"]');
    
    // Wait for download
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  test('should work offline', async ({ page, context }) => {
    await page.selectOption('[data-testid="store-selector"]', 'honor');
    await page.fill('[data-testid="password-input"]', '123456');
    await page.click('[data-testid="login-btn"]');
    
    // Add data while online
    await page.click('[data-testid="add-btn"]');
    await page.fill('[data-testid="date-input"]', '2024-01-15');
    await page.fill('[data-testid="total-input"]', '100.00');
    await page.click('[data-testid="save-btn"]');
    
    // Go offline
    await context.setOffline(true);
    
    // Data should still be visible
    await expect(page.locator('text=100,00')).toBeVisible();
    
    // Can add offline entry
    await page.click('[data-testid="add-btn"]');
    await page.fill('[data-testid="date-input"]', '2024-01-16');
    await page.fill('[data-testid="total-input"]', '200.00');
    await page.click('[data-testid="save-btn"]');
    
    // Entry should appear (cached)
    await expect(page.locator('text=200,00')).toBeVisible();
    
    // Restore online
    await context.setOffline(false);
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.selectOption('[data-testid="store-selector"]', 'honor');
    await page.fill('[data-testid="password-input"]', '123456');
    await page.click('[data-testid="login-btn"]');
    
    // Should adapt layout
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="kpi-grid"]')).toHaveClass(/flex-col|grid-cols-1/);
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Try to login with wrong password
    await page.selectOption('[data-testid="store-selector"]', 'honor');
    await page.fill('[data-testid="password-input"]', 'wrongpass');
    await page.click('[data-testid="login-btn"]');
    
    // Should show error
    await expect(page.locator('[data-testid="toast-error"]')).toBeVisible();
    await expect(page.locator('text=Senha incorreta')).toBeVisible();
  });
});
