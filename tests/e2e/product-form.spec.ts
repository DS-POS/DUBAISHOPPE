import { test, expect } from '@playwright/test'
import { TEST_PASSWORD } from './auth-helper'

test.describe('Product Form', () => {
  test.beforeEach(async ({ page }) => {
    if (!TEST_PASSWORD) { test.skip(); return }
    await page.goto('/products/new')
    if (page.url().includes('/login')) { test.skip(); return }
    await expect(page.getByRole('heading', { name: 'Add Product' })).toBeVisible({ timeout: 10000 })
  })

  test('shows validation errors when submitting empty form', async ({ page }) => {
    await page.click('button[type="submit"]')
    await expect(page.getByText('Product name is required')).toBeVisible()
    await expect(page.getByText('SKU is required')).toBeVisible()
  })

  test('clears validation error after filling required field', async ({ page }) => {
    await page.click('button[type="submit"]')
    await expect(page.getByText('Product name is required')).toBeVisible()
    await page.fill('#name', 'Canon EOS R50')
    await page.locator('#name').blur()
    await expect(page.getByText('Product name is required')).not.toBeVisible()
  })

  test('price fields accept numbers without showing Invalid input', async ({ page }) => {
    await page.fill('#cost_price', '200000')
    await page.locator('#cost_price').blur()
    await page.fill('#selling_price', '250000')
    await page.locator('#selling_price').blur()
    const costPriceError = page.locator('#cost_price').locator('..').locator('p.text-destructive')
    await expect(costPriceError).not.toBeVisible()
  })

  test('category dropdown shows categories (not UUIDs)', async ({ page }) => {
    const categorySelect = page.locator('select').first()
    if (!await categorySelect.isVisible()) { test.skip(); return }
    const optionTexts = await page.evaluate(() => {
      const sel = document.querySelector('select') as HTMLSelectElement
      return Array.from(sel?.options ?? []).map(o => o.text)
    })
    // No option text should look like a UUID
    const hasUUID = optionTexts.some(t => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(t))
    expect(hasUUID).toBe(false)
  })

  test('brand dropdown shows camera brands', async ({ page }) => {
    await page.fill('#brand', 'can')
    await expect(page.getByRole('button', { name: 'Canon' })).toBeVisible()
    await page.getByRole('button', { name: 'Canon' }).click()
    await expect(page.locator('#brand')).toHaveValue('Canon')
  })

  test('full product creation flow', async ({ page }) => {
    const sku = `TEST-${Date.now()}`
    await page.fill('#name', 'Canon EOS R50 E2E Test')
    await page.fill('#sku', sku)
    await page.fill('#cost_price', '50000')
    await page.fill('#selling_price', '65000')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/products$/, { timeout: 15000 })
    await expect(page.getByText('Canon EOS R50 E2E Test')).toBeVisible({ timeout: 5000 })
  })
})
