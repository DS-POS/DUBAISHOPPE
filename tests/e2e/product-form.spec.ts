import { test, expect, type Page } from '@playwright/test'

// Put credentials in .env.test or set TEST_EMAIL / TEST_PASSWORD env vars
const TEST_EMAIL = process.env.TEST_EMAIL ?? 'posds93@gmail.com'
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? ''

async function login(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"]', TEST_EMAIL)
  await page.fill('input[type="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard', { timeout: 10000 }).catch(() =>
    page.waitForURL('**/', { timeout: 5000 })
  )
}

test.describe('Product Form', () => {
  test.beforeEach(async ({ page }) => {
    if (!TEST_PASSWORD) {
      test.skip()
      return
    }
    await login(page)
    await page.goto('/products/new')
    await expect(page.getByRole('heading', { name: 'Add Product' })).toBeVisible({ timeout: 10000 })
  })

  test('shows validation errors when submitting empty form', async ({ page }) => {
    await page.click('button[type="submit"]')
    await expect(page.getByText('Product name is required')).toBeVisible()
    await expect(page.getByText('SKU is required')).toBeVisible()
  })

  test('clears validation error after filling required field', async ({ page }) => {
    // Submit empty to trigger errors
    await page.click('button[type="submit"]')
    await expect(page.getByText('Product name is required')).toBeVisible()

    // Fill the name field
    await page.fill('#name', 'Canon EOS R50')
    await page.locator('#name').blur()

    // Error should clear
    await expect(page.getByText('Product name is required')).not.toBeVisible()
  })

  test('price fields accept numbers without showing Invalid input', async ({ page }) => {
    await page.fill('#cost_price', '200000')
    await page.locator('#cost_price').blur()
    await page.fill('#selling_price', '250000')
    await page.locator('#selling_price').blur()

    // No "Invalid input" errors on price fields
    const costPriceError = page.locator('#cost_price').locator('..').locator('p.text-destructive')
    await expect(costPriceError).not.toBeVisible()
  })

  test('category dropdown shows category name not UUID', async ({ page }) => {
    // Add a new category
    await page.click('button:has-text("+ New Category")')
    await page.fill('input[placeholder="Category name"]', 'Test Camera Cat')
    await page.click('button:has-text("Add")')

    // The select should show the name, not a UUID
    const categorySelect = page.locator('select').first()
    const selectedText = await categorySelect.inputValue()
    // selectedText is the UUID value — check the displayed option text
    const selectedOption = categorySelect.locator('option[selected]')
    const displayedOptions = await page.evaluate(() => {
      const sel = document.querySelector('select') as HTMLSelectElement
      return sel ? sel.options[sel.selectedIndex]?.text : ''
    })
    expect(displayedOptions).toBe('Test Camera Cat')
  })

  test('brand dropdown shows camera brands', async ({ page }) => {
    await page.fill('#brand', 'can')
    await expect(page.getByRole('button', { name: 'Canon' })).toBeVisible()
    await page.getByRole('button', { name: 'Canon' }).click()
    await expect(page.locator('#brand')).toHaveValue('Canon')
  })

  test('full product creation flow', async ({ page }) => {
    // Fill all required fields
    await page.fill('#name', 'Canon EOS R50 Test')
    await page.fill('#sku', 'TEST-001')
    await page.fill('#cost_price', '50000')
    await page.fill('#selling_price', '65000')

    // Submit
    await page.click('button[type="submit"]')

    // Should redirect to products list after success
    await expect(page).toHaveURL(/\/products$/, { timeout: 10000 })
    await expect(page.getByText('Canon EOS R50 Test')).toBeVisible()
  })
})
