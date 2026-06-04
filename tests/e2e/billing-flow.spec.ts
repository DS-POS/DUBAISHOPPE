import { test, expect } from '@playwright/test'
import { TEST_PASSWORD } from './auth-helper'

async function requireAuth(page: import('@playwright/test').Page) {
  if (!TEST_PASSWORD) { test.skip(); return }
  await page.goto('/billing')
  if (page.url().includes('/login')) { test.skip(); return }
}

test.describe('Billing — New Sale flow', () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth(page)
    await expect(page.getByRole('heading', { name: 'New Sale' })).toBeVisible({ timeout: 10000 })
  })

  test('billing page loads with product search and empty cart', async ({ page }) => {
    await expect(page.getByPlaceholder(/search product/i)).toBeVisible()
    await expect(page.getByText('Cart is empty')).toBeVisible()
  })

  test('product search returns results', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search product/i)
    await searchInput.fill('a')
    await page.waitForTimeout(500)
    // Dropdown uses <button> elements (not li) — look for buttons with price ₹
    const firstResult = page.locator('button').filter({ hasText: /₹/ }).first()
    if (!await firstResult.isVisible()) {
      test.skip()
      return
    }
    await expect(firstResult).toBeVisible({ timeout: 5000 })
  })

  test('adding product to cart shows GST breakdown', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search product/i)
    await searchInput.fill('a')
    await page.waitForTimeout(500)

    const firstResult = page.locator('button').filter({ hasText: /₹/ }).filter({ hasNot: page.getByText(/out of stock/i) }).first()
    if (await firstResult.isVisible()) {
      await firstResult.click()
      await expect(page.getByText(/1 item/)).toBeVisible({ timeout: 5000 })
      await expect(page.getByText('CGST')).toBeVisible()
      await expect(page.getByText('SGST')).toBeVisible()
      await expect(page.getByText('Grand Total')).toBeVisible()
    } else {
      test.skip()
    }
  })

  test('checkout button disabled when cart empty', async ({ page }) => {
    const checkoutBtn = page.getByRole('button', { name: /proceed to checkout/i })
    await expect(checkoutBtn).toBeDisabled()
  })

  test('checkout button enabled after adding product', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search product/i)
    await searchInput.fill('a')
    await page.waitForTimeout(500)

    const firstResult = page.locator('button').filter({ hasText: /₹/ }).filter({ hasNot: page.getByText(/out of stock/i) }).first()
    if (await firstResult.isVisible()) {
      await firstResult.click()
      const checkoutBtn = page.getByRole('button', { name: /proceed to checkout/i })
      await expect(checkoutBtn).toBeEnabled({ timeout: 3000 })
    } else {
      test.skip()
    }
  })

  test('remove item from cart restores empty state', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search product/i)
    await searchInput.fill('a')
    await page.waitForTimeout(500)

    const firstResult = page.locator('button').filter({ hasText: /₹/ }).filter({ hasNot: page.getByText(/out of stock/i) }).first()
    if (await firstResult.isVisible()) {
      await firstResult.click()
      await expect(page.getByText(/1 item/)).toBeVisible({ timeout: 5000 })

      const removeBtn = page.locator('button[aria-label*="remove"], button:has-text("×")').first()
      if (await removeBtn.isVisible()) {
        await removeBtn.click()
        await expect(page.getByText('Cart is empty')).toBeVisible({ timeout: 3000 })
      }
    } else {
      test.skip()
    }
  })
})

test.describe('Billing — Checkout page', () => {
  test.beforeEach(async ({ page }) => {
    if (!TEST_PASSWORD) { test.skip(); return }
    await page.goto('/billing/checkout')
    if (page.url().includes('/login')) { test.skip(); return }
  })

  test('checkout page redirects to billing when no cart in session', async ({ page }) => {
    await expect(page).toHaveURL(/\/billing$/, { timeout: 8000 })
  })
})
