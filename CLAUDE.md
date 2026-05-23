# Repo guide for Claude

A React + Vite to-do app paired with a Playwright suite that runs both locally
and against LambdaTest cloud browsers. The app is deployed to GitHub Pages at
`https://anmolg-lt.github.io/New-Sample-To-Do/` and the tests by default point
at that URL.

## Layout

Two independent npm projects in one repo:

- **Root** — the React app. `src/App.jsx` is the entire UI (no router, no
  components dir). State lives in `sessionStorage` under `sample-todo-items`.
  Build target is GitHub Pages, so `vite.config.js` sets
  `base: '/New-Sample-To-Do/'` — don't drop that or every asset 404s in prod.
- **`TESTS/`** — its own `package.json`, `node_modules`, and Playwright config.
  Kept separate so test dependencies (which are large) don't end up in the app
  bundle.

## Commands you'll actually use

App (run from repo root):
```bash
npm run dev | npm run build | npm run preview
```

Tests (run from `TESTS/`):
```bash
npm run test            # local chromium
npm run test:lt         # LambdaTest — needs LT_USERNAME + LT_ACCESS_KEY in env
node probe-full.mjs     # standalone LT health check (bypasses test runner)
```

`BASE_URL` overrides the app URL the tests hit. There is no `.env` loader —
credentials must already be exported in the shell.

## Test architecture

`TESTS/lambdatest-setup.js` is the only fixture. It exports a `test` that
overrides Playwright's built-in `page` fixture:

- For any non-LambdaTest project: launches a local Chromium and creates a
  context with the merged `use:` config (`baseURL`, viewport, userAgent).
- For LambdaTest projects (project name matches `/lambdatest/i`): calls
  `chromium.connect()` to the LambdaTest CDP endpoint, then explicitly creates
  a context with the same `use:` options. **This explicit context-with-baseURL
  step is load-bearing** — Playwright's built-in `page` fixture normally wires
  `use:` into the context for you, but a manually `connect()`ed browser
  bypasses all of that. Without it, `page.goto('./')` has no baseURL to
  resolve against and silently times out.

LambdaTest project names follow the convention
`<browser>:<version>:<platform>@lambdatest`. The setup file parses that into
LambdaTest capabilities. Test status is reported back to the dashboard via
the `lambdatest_action: setTestStatus` directive in the fixture teardown.

The playwrightClientVersion sent to LambdaTest is read from
`@playwright/test/package.json` via `createRequire`. **Do not** swap that back
to `execSync('npx playwright --version')` — Playwright imports the setup file
once per worker, and concurrent npx invocations can deadlock on the npm cache
lock and hang the entire runner with no error.

## Known landmines: Playwright version

`@playwright/test` is pinned to `~1.55.0` — that range is load-bearing for two
opposing reasons, **don't widen it**:

- **Floor (≥ 1.51):** earlier versions use an ESM loader hook that hangs
  forever on Node 25 during test discovery. Symptoms: `npx playwright test
  --list` hangs, `--project=chromium` hangs, the standalone probe still works
  (it doesn't go through the test-runner loader).
- **Ceiling (≤ 1.55):** LambdaTest's CDP endpoint (`wss://cdp.lambdatest.com/
  playwright`) currently stalls the WebSocket handshake for Playwright clients
  ≥ 1.60 — no error, the `chromium.connect()` call just never returns.
  Symptoms: a LambdaTest session shows up on the dashboard with status
  "Running" but stays empty forever; the runner times out in `beforeEach`.

If you need to bump Playwright, **first** confirm against LambdaTest's
published support matrix at
`https://www.lambdatest.com/support/docs/playwright-supported-versions/` and
verify with `node probe-full.mjs` before changing the pin.

## Deploy

Pushes to `main` trigger `.github/workflows/deploy.yml` which runs `npm ci &&
npm run build` on Node 20 and ships `dist/` to GitHub Pages. Tests are **not**
run in CI today.
