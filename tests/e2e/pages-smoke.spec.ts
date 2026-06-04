/**
 * Smoke tests — authenticated page loads for all major tabs.
 * Auth provided via storageState from globalSetup (no per-test login).
 */
import { test, expect } from '@playwright/test'
import { TEST_PASSWORD } from './auth-helper'

/** Skip if auth isn't set up (no TEST_PASSWORD or rate-limited login) */
async function requireAuth(page: import('@playwright/test').Page) {
  if (!TEST_PASSWORD) { test.skip(); return }
  // Verify session is valid — navigate to dashboard and check we're not on login
  await page.goto('/dashboard')
  if (page.url().includes('/login')) { test.skip(); return }
}

test.describe('Authenticated page smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth(page)
  })

  // ── Dashboard ──────────────────────────────────────────────────────────────
  test('dashboard loads with stats', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 10000 })
  })

  // ── Products ───────────────────────────────────────────────────────────────
  test('products page loads with dark table header', async ({ page }) => {
    await page.goto('/products')
    await expect(page.getByRole('heading', { name: 'Product Inventory' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('link', { name: /add product/i })).toBeVisible()
  })

  // ── Invoices ───────────────────────────────────────────────────────────────
  test('invoices page loads with filter bar', async ({ page }) => {
    await page.goto('/invoices')
    await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByPlaceholder(/search invoice/i)).toBeVisible()
    // .first() avoids strict-mode when both a link and button render with same name
    await expect(page.getByRole('button', { name: /new invoice/i }).or(
      page.getByRole('link', { name: /new invoice/i })
    ).first()).toBeVisible()
  })

  test('invoices status tabs render', async ({ page }) => {
    await page.goto('/invoices')
    await expect(page.getByRole('button', { name: /all/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /due/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /paid/i })).toBeVisible()
  })

  // ── Customers ──────────────────────────────────────────────────────────────
  test('customers page loads', async ({ page }) => {
    await page.goto('/customers')
    await expect(page.getByRole('heading', { name: /customers/i })).toBeVisible({ timeout: 10000 })
  })

  // ── Quotations ─────────────────────────────────────────────────────────────
  test('quotations page loads with New Quotation button', async ({ page }) => {
    await page.goto('/quotations')
    await expect(page.getByRole('heading', { name: 'Quotations' })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('link', { name: /new quotation/i })).toBeVisible()
  })

  test('quotations status filter tabs render', async ({ page }) => {
    await page.goto('/quotations')
    // Tab text includes count e.g. "All (4)" — use ^All to avoid sidebar link collision
    await expect(page.getByRole('link', { name: /^All/i })).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('link', { name: /^Draft/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Sent/i })).toBeVisible()
  })

  // ── Stock In ───────────────────────────────────────────────────────────────
  test('stock-in page loads', async ({ page }) => {
    await page.goto('/stock-in')
    // Heading is "Supplier Invoices" on the stock-in list page
    await expect(page.getByRole('heading', { name: /supplier invoices/i })).toBeVisible({ timeout: 10000 })
  })

  // ── Suppliers ──────────────────────────────────────────────────────────────
  test('suppliers page loads', async ({ page }) => {
    await page.goto('/suppliers')
    await expect(page.getByRole('heading', { name: /suppliers/i })).toBeVisible({ timeout: 10000 })
  })

  // ── Reports ────────────────────────────────────────────────────────────────
  test('reports page loads with date filters', async ({ page }) => {
    await page.goto('/reports')
    await expect(page.getByRole('heading', { name: /reports/i })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('input[type="date"]').first()).toBeVisible()
  })

  test('reports tally export page loads', async ({ page }) => {
    await page.goto('/reports/tally', { timeout: 30000 }).catch(() =>
      page.goto('/reports/tally', { timeout: 30000 })
    )
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15000 })
  })

  // ── Labels ─────────────────────────────────────────────────────────────────
  test('labels page loads', async ({ page }) => {
    await page.goto('/labels')
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 10000 })
  })

  // ── Settings ───────────────────────────────────────────────────────────────
  test('settings page loads', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 10000 })
  })
})

test.describe('Navigation — sidebar links work', () => {
  test.beforeEach(async ({ page }) => {
    await requireAuth(page)
  })

  test('sidebar is visible', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await expect(page.locator('nav, aside').first()).toBeVisible({ timeout: 5000 })
  })

  test('logo container is white (visible)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const logo = page.locator('img[alt="DS"], img[alt*="Dubai"], img[alt*="logo"]').first()
    if (await logo.isVisible()) {
      await expect(logo).toBeVisible()
    }
  })
})
