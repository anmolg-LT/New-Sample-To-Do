import { test as base, chromium, expect } from '@playwright/test'
import path from 'node:path'
import { createRequire } from 'node:module'

// Read version from package.json rather than spawning `npx playwright --version`.
// The old approach blocked the event loop at module-load time, and Playwright's
// runner imports this file once per worker — concurrent npx invocations can
// deadlock on the npm cache lock and hang the whole runner silently.
const playwrightClientVersion = createRequire(import.meta.url)(
  '@playwright/test/package.json',
).version

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

// Override `page` WITHOUT depending on the upstream `page` fixture, so the
// local browser isn't launched for cloud runs.
export const test = base.extend({
  page: [
    async ({ baseURL, viewport, userAgent, browserName }, use, testInfo) => {
      if (!/lambdatest/i.test(testInfo.project.name)) {
        // Local run: defer to the default fixture by launching ourselves.
        const localBrowser = await chromium.launch()
        const localContext = await localBrowser.newContext({
          baseURL,
          viewport,
          userAgent,
        })
        const localPage = await localContext.newPage()
        await use(localPage)
        await localContext.close()
        await localBrowser.close()
        return
      }

      if (!process.env.LT_USERNAME || !process.env.LT_ACCESS_KEY) {
        throw new Error(
          'LT_USERNAME and LT_ACCESS_KEY must be set to run against LambdaTest.',
        )
      }

      // Provisioning a cloud VM + CDP handshake can take 20–40s.
      // Give the whole test plenty of headroom on top of that.
      testInfo.setTimeout(180_000)

      const fileName = path.basename(testInfo.file)
      const capabilities = buildCapabilities(
        testInfo.project.name,
        `${testInfo.title} - ${fileName}`,
      )

      const browser = await chromium.connect({
        wsEndpoint: `wss://cdp.lambdatest.com/playwright?capabilities=${encodeURIComponent(
          JSON.stringify(capabilities),
        )}`,
        timeout: 90_000,
      })

      // Critical: pass baseURL (and other context options) through, otherwise
      // page.goto('./') has nothing to resolve against.
      const ltContext = await browser.newContext({
        baseURL,
        viewport,
        userAgent,
      })
      const ltPage = await ltContext.newPage()

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
          // best-effort
        }
        await ltPage.close().catch(() => {})
        await ltContext.close().catch(() => {})
        await browser.close().catch(() => {})
      }
    },
    { scope: 'test' },
  ],
})

export { expect }
