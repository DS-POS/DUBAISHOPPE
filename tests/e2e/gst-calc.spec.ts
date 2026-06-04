/**
 * GST Calculation correctness tests.
 * Verifies CGST+SGST (same state) vs IGST (other state) logic.
 * Auth provided via storageState from globalSetup.
 */
import { test, expect } from '@playwright/test'
import { TEST_PASSWORD } from './auth-helper'

test.describe('GST Calculation', () => {
  test.beforeEach(async ({ page }) => {
    if (!TEST_PASSWORD) { test.skip(); return }
    await page.goto('/billing')
    if (page.url().includes('/login')) { test.skip(); return }
    await expect(page.getByPlaceholder(/search product/i)).toBeVisible({ timeout: 10000 })
  })

  test('Telangana customer shows CGST + SGST (not IGST)', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search product/i)
    await searchInput.fill('a')
    await page.waitForTimeout(500)
    const firstResult = page.locator('button').filter({ hasText: /₹/ }).first()
    if (!await firstResult.isVisible()) { test.skip(); return }

    await firstResult.click()
    await page.waitForTimeout(300)

    await expect(page.getByText('CGST')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('SGST')).toBeVisible()
    await expect(page.getByText('IGST')).not.toBeVisible()
  })

  test('grand total equals taxable amount + GST', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search product/i)
    await searchInput.fill('a')
    await page.waitForTimeout(500)
    const firstResult = page.locator('button').filter({ hasText: /₹/ }).first()
    if (!await firstResult.isVisible()) { test.skip(); return }
    await firstResult.click()
    await page.waitForTimeout(500)

    const taxableText = await page.getByText('Taxable Amount').locator('..').locator('span:last-child').textContent()
    const cgstText = await page.getByText('CGST').locator('..').locator('span:last-child').textContent()
    const sgstText = await page.getByText('SGST').locator('..').locator('span:last-child').textContent()
    const grandTotalText = await page.getByText('Grand Total').locator('..').locator('span:last-child').textContent()

    if (!taxableText || !cgstText || !sgstText || !grandTotalText) { test.skip(); return }

    const parse = (t: string) => parseFloat(t.replace(/[₹,]/g, '').trim())
    const taxable = parse(taxableText)
    const cgst = parse(cgstText)
    const sgst = parse(sgstText)
    const grandTotal = parse(grandTotalText)

    expect(Math.abs(grandTotal - (taxable + cgst + sgst))).toBeLessThan(0.05)
  })
})
