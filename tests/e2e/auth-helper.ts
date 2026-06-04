import { type Page } from '@playwright/test'

export const TEST_EMAIL = process.env.TEST_EMAIL ?? 'posds93@gmail.com'
export const TEST_PASSWORD = process.env.TEST_PASSWORD ?? ''

/**
 * Login for one-off scenarios. In normal runs, globalSetup handles auth and
 * storageState is injected automatically — no per-test login needed.
 */
export async function login(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', TEST_EMAIL)
  await page.fill('input[type="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  // Wait for redirect away from /login (handles any post-login redirect URL)
  await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 })
}
