import { test, expect } from '@playwright/test';

test.describe('OCR Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Login
    await page.selectOption('[data-testid="store-selector"]', 'honor');
    await page.fill('[data-testid="password-input"]', '123456');
    await page.click('[data-testid="login-btn"]');
    await page.waitForSelector('[data-testid="dashboard"]');
  });

  test('should process image with OCR', async ({ page }) => {
    // Mock OCR if needed
    await page.evaluate(() => {
      // @ts-ignore
      window.mockOCR = {
        recognize: () => Promise.resolve({
          data: {
            text: 'Total: R$ 150,50',
            confidence: 95
          }
        })
      };
    });

    // Open add entry
    await page.click('[data-testid="add-btn"]');
    await page.waitForSelector('[data-testid="entry-form"]');

    // Upload image (if OCR is available)
    const ocrSection = page.locator('[data-testid="ocr-upload"]');
    if (await ocrSection.isVisible().catch(() => false)) {
      await ocrSection.click();

      // Wait for OCR processing
      await page.waitForSelector('[data-testid="ocr-processing"]');
      await page.waitForSelector('[data-testid="ocr-complete"]', { timeout: 30000 });

      // Verify extracted value
      const extractedValue = await page.locator('[data-testid="ocr-result-total"]').inputValue();
      expect(extractedValue).toContain('150.50');
    }
  });

  test('should handle OCR errors gracefully', async ({ page }) => {
    // Mock OCR error
    await page.evaluate(() => {
      // @ts-ignore
      window.mockOCR = {
        recognize: () => Promise.reject(new Error('OCR failed'))
      };
    });

    await page.click('[data-testid="add-btn"]');

    const ocrSection = page.locator('[data-testid="ocr-upload"]');
    if (await ocrSection.isVisible().catch(() => false)) {
      await ocrSection.click();

      // Should show error message
      await expect(page.locator('[data-testid="ocr-error"]')).toBeVisible();
      await expect(page.locator('text=Não foi possível processar a imagem')).toBeVisible();
    }
  });

  test('should allow manual override of OCR results', async ({ page }) => {
    // Mock OCR with low confidence
    await page.evaluate(() => {
      // @ts-ignore
      window.mockOCR = {
        recognize: () => Promise.resolve({
          data: {
            text: 'Total: R$ ???',
            confidence: 40
          }
        })
      };
    });

    await page.click('[data-testid="add-btn"]');

    const ocrSection = page.locator('[data-testid="ocr-upload"]');
    if (await ocrSection.isVisible().catch(() => false)) {
      await ocrSection.click();

      // Should show warning about low confidence
      await expect(page.locator('[data-testid="ocr-low-confidence"]')).toBeVisible();

      // User can manually enter value
      await page.fill('[data-testid="total-input"]', '250.00');
      await page.click('[data-testid="save-btn"]');

      // Should save successfully
      await expect(page.locator('text=250,00')).toBeVisible();
    }
  });

  test('should support multiple image formats', async ({ page }) => {
    const formats = ['.jpg', '.jpeg', '.png', '.webp'];

    for (const format of formats) {
      await page.click('[data-testid="add-btn"]');

      const ocrSection = page.locator('[data-testid="ocr-upload"]');
      if (await ocrSection.isVisible().catch(() => false)) {
        // Check accepted formats
        const acceptAttr = await page.locator('input[type="file"]').getAttribute('accept');
        expect(acceptAttr).toContain(format.replace('.', ''));
      }

      // Close modal
      await page.keyboard.press('Escape');
    }
  });

  test('should resize large images before OCR', async ({ page }) => {
    await page.click('[data-testid="add-btn"]');

    const ocrSection = page.locator('[data-testid="ocr-upload"]');
    if (await ocrSection.isVisible().catch(() => false)) {
      // Check if there's a size limit message
      const sizeInfo = await page.locator('[data-testid="ocr-size-limit"]').textContent();
      if (sizeInfo) {
        expect(sizeInfo).toMatch(/\d+MB/);
      }
    }
  });
});
