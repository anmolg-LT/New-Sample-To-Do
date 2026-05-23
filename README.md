# Sample To-Do

A small React + Vite to-do app used as a fixture for cross-browser Playwright
testing — locally and on LambdaTest cloud browsers. Deployed to GitHub Pages
at https://anmolg-lt.github.io/New-Sample-To-Do/.

## Stack

- **App:** React 18, Vite 5 (`src/App.jsx` is the entire UI). State persists to
  `sessionStorage` so it survives a reload but not a new tab.
- **Tests:** Playwright in `TESTS/` — its own npm workspace so test deps don't
  bleed into the app bundle.
- **Deploy:** GitHub Actions builds and pushes `dist/` to GitHub Pages on every
  push to `main` (`.github/workflows/deploy.yml`).

## Running the app

```bash
npm install
npm run dev        # vite dev server
npm run build      # static build to dist/
npm run preview    # serve the built bundle
```

`vite.config.js` sets `base: '/New-Sample-To-Do/'` so the GitHub Pages URLs
resolve correctly. When previewing locally you'll hit
`http://localhost:4173/New-Sample-To-Do/`.

## Running tests

All test commands run from `TESTS/`:

```bash
cd TESTS
npm install

# local Chromium
npm run test
npm run test:headed     # headed, single worker
npm run test:ui         # Playwright UI mode
npm run test:debug      # inspector

# LambdaTest cloud
LT_USERNAME=...  LT_ACCESS_KEY=...  npm run test:lt

npm run report          # open the last HTML report
```

By default tests point at the deployed GitHub Pages URL. Override with
`BASE_URL=http://localhost:5173/New-Sample-To-Do/` to run against your dev
server.

### LambdaTest setup

Credentials are read from `LT_USERNAME` and `LT_ACCESS_KEY` (no `.env`
auto-loading — export them in your shell or use a tool like `direnv`). The
fixture lives in `TESTS/lambdatest-setup.js` and overrides Playwright's `page`
fixture: for the LambdaTest project it connects to
`wss://cdp.lambdatest.com/playwright` with the right capabilities and creates a
context with `baseURL` so `page.goto('./')` resolves correctly. For all other
projects the local browser is used.

The project name parses as `<browser>:<version>:<platform>@lambdatest`, e.g.
`chrome:latest:Windows 11@lambdatest`. Add more projects to
`TESTS/playwright.config.js` to fan out across browsers.

### Cloud sanity probe

If `npm run test:lt` ever misbehaves and you want to confirm whether LambdaTest
itself is healthy, run the standalone probe — it bypasses the Playwright test
runner and exercises the full app flow on a real cloud VM:

```bash
cd TESTS
LT_USERNAME=...  LT_ACCESS_KEY=...  node probe-full.mjs
```

A clean run finishes in ~25 s. Pass/fail status is also reported to the
LambdaTest dashboard.

## Requirements

- Node 20+ (Node 25 also works as of `@playwright/test` ≥ 1.51 — older
  Playwright versions hang silently on Node 25's ESM loader).
