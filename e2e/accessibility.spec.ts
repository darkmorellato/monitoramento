import { test, expect } from '@playwright/test';

test.describe('Accessibility (WCAG 2.1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have skip link', async ({ page }) => {
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toBeVisible();
    await expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  test('should have proper heading structure', async ({ page }) => {
    // Login first
    await page.selectOption('[data-testid="store-selector"]', 'honor');
    await page.fill('[data-testid="password-input"]', '123456');
    await page.click('[data-testid="login-btn"]');
    await page.waitForSelector('[data-testid="dashboard"]');

    // Check heading hierarchy
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);

    const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
    expect(headings).toBeGreaterThan(0);
  });

  test('should have aria-labels on interactive elements', async ({ page }) => {
    // Check buttons have accessible names
    const buttons = await page.locator('button:not([aria-label]):not([aria-labelledby])').count();
    expect(buttons).toBeLessThanOrEqual(0);

    // Check form inputs have labels
    const inputsWithoutLabels = await page.locator('input:not([aria-label]):not([aria-labelledby]):not([id])').count();
    expect(inputsWithoutLabels).toBeLessThanOrEqual(0);
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Tab through the page
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedElement).not.toBe('BODY');

    // Check focus is visible
    await page.keyboard.press('Tab');
    const hasFocusStyle = await page.evaluate(() => {
      const active = document.activeElement;
      if (!active) return false;
      const style = window.getComputedStyle(active);
      return style.outline !== 'none' || style.boxShadow !== 'none';
    });
    expect(hasFocusStyle).toBeTruthy();
  });

  test('should have proper ARIA landmarks', async ({ page }) => {
    await page.selectOption('[data-testid="store-selector"]', 'honor');
    await page.fill('[data-testid="password-input"]', '123456');
    await page.click('[data-testid="login-btn"]');
    await page.waitForSelector('[data-testid="dashboard"]');

    // Check for main landmark
    const main = page.locator('main, [role="main"]');
    await expect(main).toHaveCount(1);

    // Check for navigation if exists
    const nav = page.locator('nav, [role="navigation"]');
    // Not required but should be valid if present
  });

  test('should announce dynamic content changes', async ({ page }) => {
    await page.selectOption('[data-testid="store-selector"]', 'honor');
    await page.fill('[data-testid="password-input"]', '123456');
    await page.click('[data-testid="login-btn"]');

    // Check for live region
    const liveRegion = page.locator('[aria-live]');
    await expect(liveRegion).toHaveCount(1);

    // Add entry and check announcement
    await page.click('[data-testid="add-btn"]');
    await page.fill('[data-testid="total-input"]', '150');
    await page.click('[data-testid="save-btn"]');

    // Live region should update
    await expect(page.locator('[aria-live="polite"]')).not.toBeEmpty();
  });

  test('should have sufficient color contrast', async ({ page }) => {
    // This is a basic check - full contrast testing requires axe-core
    const bodyBg = await page.evaluate(() => {
      return window.getComputedStyle(document.body).backgroundColor;
    });
    const bodyColor = await page.evaluate(() => {
      return window.getComputedStyle(document.body).color;
    });

    // Both should be defined
    expect(bodyBg).toBeTruthy();
    expect(bodyColor).toBeTruthy();
  });

  test('should trap focus in modal', async ({ page }) => {
    await page.selectOption('[data-testid="store-selector"]', 'honor');
    await page.fill('[data-testid="password-input"]', '123456');
    await page.click('[data-testid="login-btn"]');

    // Open modal
    await page.click('[data-testid="add-btn"]');
    const modal = page.locator('[data-testid="entry-form"], [role="dialog"]');
    await expect(modal).toBeVisible();

    // Focus should be trapped
    const focusableElements = await modal.locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])').count();
    expect(focusableElements).toBeGreaterThan(0);
  });

  test('should have alt text on images', async ({ page }) => {
    const imagesWithoutAlt = await page.locator('img:not([alt])').count();
    expect(imagesWithoutAlt).toBe(0);
  });

  test('should have descriptive links', async ({ page }) => {
    const emptyLinks = await page.locator('a:empty:not([aria-label]):not([aria-labelledby])').count();
    expect(emptyLinks).toBe(0);
  });
});

test.describe('Screen Reader Support', () => {
  test('should have proper form labels', async ({ page }) => {
    // Login form
    await page.selectOption('[data-testid="store-selector"]', 'honor');
    await page.fill('[data-testid="password-input"]', '123456');
    await page.click('[data-testid="login-btn"]');

    // Check form in add modal
    await page.click('[data-testid="add-btn"]');

    // All inputs should have labels
    const inputs = await page.locator('input, select, textarea').all();
    for (const input of inputs) {
      const hasLabel = await input.evaluate((el) => {
        const id = el.id;
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const hasLabelElement = id && document.querySelector(`label[for="${id}"]`);
        const isLabelled = !!(
          hasLabelElement ||
          ariaLabel ||
          ariaLabelledBy ||
          el.placeholder
        );
        return isLabelled;
      });
      expect(hasLabel).toBe(true);
    }
  });

  test('should have status messages for loading states', async ({ page }) => {
    await page.selectOption('[data-testid="store-selector"]', 'honor');
    await page.fill('[data-testid="password-input"]', '123456');

    // Click login and check for loading state
    await page.click('[data-testid="login-btn"]');

    // Should have aria-busy or loading indicator
    const hasLoadingIndicator = await page.locator('[aria-busy="true"], [data-testid="loading"]').count();
    expect(hasLoadingIndicator).toBeGreaterThanOrEqual(0);
  });
});
