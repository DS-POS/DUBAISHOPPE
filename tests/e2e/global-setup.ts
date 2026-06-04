import { chromium, type FullConfig } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const TEST_EMAIL = process.env.TEST_EMAIL ?? 'posds93@gmail.com'
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? ''

const EMPTY_AUTH_STATE = JSON.stringify({ cookies: [], origins: [] })

async function globalSetup(_config: FullConfig) {
  const authDir = path.join(__dirname, '.auth')
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })
  const authFile = path.join(authDir, 'user.json')

  if (!TEST_PASSWORD) {
    console.log('[globalSetup] TEST_PASSWORD not set — writing empty auth state')
    fs.writeFileSync(authFile, EMPTY_AUTH_STATE)
    return
  }

  const browser = await chromium.launch()
  const page = await browser.newPage()

  try {
    await page.goto('http://localhost:3000/login', { timeout: 30000 })
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.click('button[type="submit"]')

    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 })
    await page.context().storageState({ path: authFile })
    console.log('[globalSetup] Auth state saved — authenticated tests will reuse session')
  } catch (err) {
    console.warn('[globalSetup] Login failed (rate limited?):', (err as Error).message)
    console.warn('[globalSetup] Writing empty auth state — authenticated tests will skip/fail')
    fs.writeFileSync(authFile, EMPTY_AUTH_STATE)
  } finally {
    await browser.close()
  }
}

export default globalSetup
