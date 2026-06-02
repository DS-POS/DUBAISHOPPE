import { test, expect } from '@playwright/test'

test.describe('Billing — unauthenticated redirect', () => {
  test('billing page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/billing')
    await expect(page).toHaveURL(/login|auth|sign-in/, { timeout: 5000 })
  })

  test('invoices page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/invoices')
    await expect(page).toHaveURL(/login|auth|sign-in/, { timeout: 5000 })
  })

  test('customers page redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/customers')
    await expect(page).toHaveURL(/login|auth|sign-in/, { timeout: 5000 })
  })
})
