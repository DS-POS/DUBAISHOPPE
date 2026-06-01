import { test, expect } from '@playwright/test'

test('login page loads', async ({ page }) => {
  await page.goto('/login')
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 })
  await expect(page.locator('input[type="password"]')).toBeVisible()
})

test('unauthenticated access redirects to login', async ({ page }) => {
  await page.goto('/products/new')
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
})

test('unauthenticated access to stock-in redirects to login', async ({ page }) => {
  await page.goto('/stock-in/new')
  await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
})
