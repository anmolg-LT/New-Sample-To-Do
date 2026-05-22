// Temporary debug probe — not committed. Delete after debugging.
import { chromium } from '@playwright/test'
import { execSync } from 'node:child_process'

const playwrightClientVersion = execSync('npx playwright --version')
  .toString()
  .trim()
  .split(' ')[1]

console.log('playwrightClientVersion:', playwrightClientVersion)

const capabilities = {
  browserName: 'Chrome',
  browserVersion: 'latest',
  'LT:Options': {
    platform: 'Windows 10',
    build: 'Probe',
    name: 'Connection probe',
    user: process.env.LT_USERNAME,
    accessKey: process.env.LT_ACCESS_KEY,
    network: true,
    video: true,
    console: true,
    tunnel: false,
    playwrightClientVersion,
  },
}

const endpoint = `wss://cdp.lambdatest.com/playwright?capabilities=${encodeURIComponent(
  JSON.stringify(capabilities),
)}`

console.log('LT_USERNAME:', process.env.LT_USERNAME)
console.log('has LT_ACCESS_KEY:', !!process.env.LT_ACCESS_KEY)
console.log('endpoint length:', endpoint.length)
console.log('endpoint (first 120 chars):', endpoint.slice(0, 120))
console.log()
console.log('Attempting chromium.connect with 20s timeout…')

const start = Date.now()
try {
  const browser = await chromium.connect({ wsEndpoint: endpoint, timeout: 20_000 })
  console.log(`✓ connected after ${Date.now() - start}ms`)
  const page = await browser.newPage()
  console.log(`✓ newPage after ${Date.now() - start}ms`)
  await page.goto('https://example.com', { timeout: 15_000 })
  console.log(`✓ navigated, title="${await page.title()}"`)
  await browser.close()
  console.log('✓ closed cleanly')
} catch (e) {
  console.error(`✗ FAILED after ${Date.now() - start}ms`)
  console.error('  name:', e.name)
  console.error('  message:', e.message)
  if (e.cause) console.error('  cause:', e.cause)
  process.exit(1)
}
