// Full-flow LambdaTest probe — bypasses the Playwright test runner.
// Mirrors what tests/todo.spec.js does, but runs as a plain Node script so
// runner-side problems (worker spawn, fixture loading, execSync deadlocks)
// can't mask cloud-side failures.
//
// Run with:
//   LT_USERNAME=... LT_ACCESS_KEY=... node probe-full.mjs

import { chromium } from '@playwright/test'
import { execSync } from 'node:child_process'

const APP_URL = process.env.BASE_URL || 'https://anmolg-lt.github.io/New-Sample-To-Do/'
const PLATFORM = process.env.LT_PLATFORM || 'Windows 11'
const BROWSER_VERSION = process.env.LT_BROWSER_VERSION || 'latest'

const playwrightClientVersion = execSync('npx playwright --version')
  .toString().trim().split(' ')[1]

const capabilities = {
  browserName: 'Chrome',
  browserVersion: BROWSER_VERSION,
  'LT:Options': {
    platform: PLATFORM,
    build: 'Sample To-Do — Probe (full flow)',
    name: 'Full-flow probe',
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

const sectionResults = []
let browser, context, page

const log = (msg) => console.log(`  ${msg}`)
const fail = (msg, err) => {
  console.error(`  ✗ ${msg}`)
  if (err) console.error(`    ${err.message}`)
  throw err || new Error(msg)
}
const ok = (msg) => console.log(`  ✓ ${msg}`)

const section = async (name, fn) => {
  const t0 = Date.now()
  process.stdout.write(`\n— ${name} —\n`)
  try {
    await fn()
    const ms = Date.now() - t0
    sectionResults.push({ name, status: 'PASS', ms })
    console.log(`  ⏱  ${ms}ms`)
  } catch (e) {
    const ms = Date.now() - t0
    sectionResults.push({ name, status: 'FAIL', ms, error: e.message })
    console.log(`  ⏱  ${ms}ms (failed)`)
    throw e
  }
}

// ---- setup ----------------------------------------------------------------
console.log('LambdaTest full-flow probe')
console.log('  username:', process.env.LT_USERNAME)
console.log('  access key set:', !!process.env.LT_ACCESS_KEY)
console.log('  platform:', PLATFORM, '| browser: Chrome', BROWSER_VERSION)
console.log('  playwrightClientVersion:', playwrightClientVersion)
console.log('  app URL:', APP_URL)

if (!process.env.LT_USERNAME || !process.env.LT_ACCESS_KEY) {
  console.error('\n✗ LT_USERNAME and LT_ACCESS_KEY must both be set.')
  process.exit(2)
}

try {
  await section('Connect to LambdaTest', async () => {
    browser = await chromium.connect({ wsEndpoint: endpoint, timeout: 60_000 })
    ok('connected')
  })

  await section('Create context with baseURL', async () => {
    context = await browser.newContext({ baseURL: APP_URL })
    page = await context.newPage()
    ok('context + page created')
  })

  await section('Navigate to app', async () => {
    await page.goto('./', { timeout: 30_000, waitUntil: 'domcontentloaded' })
    ok(`title: "${await page.title()}"`)
    ok(`url:   ${page.url()}`)
  })

  await section('Empty state visible', async () => {
    const empty = page.getByText('No items yet — add one above.')
    await empty.waitFor({ timeout: 10_000 })
    ok('empty-state text found')
    const stats = page.locator('.topbar-stats')
    const statsText = await stats.innerText()
    ok(`topbar-stats text: "${statsText.replace(/\s+/g, ' ').trim()}"`)
    if (!/0 remaining/.test(statsText)) fail('expected "0 remaining" in stats')
    if (!/0 total/.test(statsText)) fail('expected "0 total" in stats')
  })

  await section('Add a todo', async () => {
    const input = page.getByPlaceholder('What needs to be done?')
    await input.waitFor({ timeout: 10_000 })
    await input.fill('Buy groceries')
    await page.getByRole('button', { name: 'Add' }).click()
    const item = page.getByRole('listitem').filter({ hasText: 'Buy groceries' })
    await item.waitFor({ timeout: 10_000 })
    ok('item visible in list')
    const statsText = await page.locator('.topbar-stats').innerText()
    ok(`topbar-stats: "${statsText.replace(/\s+/g, ' ').trim()}"`)
    if (!/1 remaining/.test(statsText)) fail('expected "1 remaining"')
    if (!/1 total/.test(statsText)) fail('expected "1 total"')
  })

  await section('Toggle complete', async () => {
    const item = page.getByRole('listitem').filter({ hasText: 'Buy groceries' })
    await item.getByRole('checkbox').check()
    await page.waitForTimeout(500)
    const cls = await item.getAttribute('class')
    ok(`item class after check: "${cls}"`)
    if (!/done/.test(cls || '')) fail('expected item class to include "done"')
    const statsText = await page.locator('.topbar-stats').innerText()
    if (!/0 remaining/.test(statsText)) fail('expected "0 remaining" after complete')
  })

  await section('Delete the item', async () => {
    const item = page.getByRole('listitem').filter({ hasText: 'Buy groceries' })
    await item.getByRole('button', { name: 'Delete' }).click()
    await page.waitForTimeout(500)
    const count = await item.count()
    ok(`item count after delete: ${count}`)
    if (count !== 0) fail('expected item to be removed')
  })

  // Report success to LambdaTest dashboard
  try {
    const directive = { action: 'setTestStatus', arguments: { status: 'passed', remark: 'all sections passed' } }
    await page.evaluate(() => {}, `lambdatest_action: ${JSON.stringify(directive)}`)
  } catch {}
} catch (e) {
  console.error('\n✗ Probe aborted:', e.message)
  if (page) {
    try {
      const directive = {
        action: 'setTestStatus',
        arguments: { status: 'failed', remark: e.stack || e.message },
      }
      await page.evaluate(() => {}, `lambdatest_action: ${JSON.stringify(directive)}`)
    } catch {}
  }
} finally {
  if (page)    await page.close().catch(() => {})
  if (context) await context.close().catch(() => {})
  if (browser) await browser.close().catch(() => {})

  console.log('\n=== Probe summary ===')
  for (const r of sectionResults) {
    const tag = r.status === 'PASS' ? '✓' : '✗'
    console.log(`  ${tag}  ${r.name.padEnd(34)} ${String(r.ms).padStart(6)}ms${r.error ? '  — ' + r.error : ''}`)
  }
  const failed = sectionResults.filter((r) => r.status === 'FAIL').length
  console.log(failed ? `\n${failed} section(s) failed` : '\nAll sections passed')
  process.exit(failed ? 1 : 0)
}
