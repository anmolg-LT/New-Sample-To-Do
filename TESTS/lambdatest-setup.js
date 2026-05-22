import { test as base, chromium, expect } from '@playwright/test'
import path from 'node:path'
import { execSync } from 'node:child_process'

const playwrightClientVersion = execSync('npx playwright --version')
  .toString()
  .trim()
  .split(' ')[1]

const BROWSER_NAME_MAP = {
  chrome: 'Chrome',
  edge: 'MicrosoftEdge',
  'pw-chromium': 'pw-chromium',
  'pw-firefox': 'pw-firefox',
  'pw-webkit': 'pw-webkit',
}

const buildCapabilities = (projectName, testName) => {
  // Project name convention: "<browser>:<version>:<platform>@lambdatest"
  // e.g. "chrome:latest:Windows 11@lambdatest"
  const [browserSlug, browserVersion, platform] = projectName
    .split('@')[0]
    .split(':')

  return {
    browserName: BROWSER_NAME_MAP[browserSlug] || browserSlug,
    browserVersion: browserVersion || 'latest',
    'LT:Options': {
      platform: platform || 'Windows 11',
      build: process.env.LT_BUILD || 'Sample To-Do — Playwright',
      name: testName,
      user: process.env.LT_USERNAME,
      accessKey: process.env.LT_ACCESS_KEY,
      network: true,
      video: true,
      console: true,
      tunnel: false,
      playwrightClientVersion,
    },
  }
}

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    if (!/lambdatest/i.test(testInfo.project.name)) {
      await use(page)
      return
    }

    if (!process.env.LT_USERNAME || !process.env.LT_ACCESS_KEY) {
      throw new Error(
        'LT_USERNAME and LT_ACCESS_KEY must be set to run against TestMu (LambdaTest).',
      )
    }

    const fileName = path.basename(testInfo.file)
    const capabilities = buildCapabilities(
      testInfo.project.name,
      `${testInfo.title} - ${fileName}`,
    )

    const browser = await chromium.connect({
      wsEndpoint: `wss://cdp.lambdatest.com/playwright?capabilities=${encodeURIComponent(
        JSON.stringify(capabilities),
      )}`,
      timeout: 60_000,
    })

    const ltPage = await browser.newPage(testInfo.project.use)

    try {
      await use(ltPage)
    } finally {
      const status = testInfo.status === testInfo.expectedStatus ? 'passed' : 'failed'
      const remark = testInfo.error?.stack || testInfo.error?.message || ''
      const directive = {
        action: 'setTestStatus',
        arguments: { status, remark },
      }
      try {
        await ltPage.evaluate(() => {}, `lambdatest_action: ${JSON.stringify(directive)}`)
      } catch {
        // status reporting is best-effort; ignore if page is already closed
      }
      await ltPage.close().catch(() => {})
      await browser.close().catch(() => {})
    }
  },
})

export { expect }
