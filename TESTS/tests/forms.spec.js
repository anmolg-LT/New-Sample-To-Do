import { test, expect } from '../lambdatest-setup.js'

const gotoForms = async (page) => {
  await page.getByRole('button', { name: 'Forms', exact: true }).click()
  await page.waitForTimeout(1000)
}

// Fills and submits the "New form" form. Returns nothing; leaves the app on
// the detail view of the freshly-created entry.
const createForm = async (page, { name, age, city, email }) => {
  await page.getByRole('button', { name: /New form/ }).click()
  await page.waitForTimeout(1000)
  if (name !== undefined) await page.getByLabel('Name', { exact: true }).fill(name)
  if (age !== undefined) await page.getByLabel('Age', { exact: true }).fill(age)
  if (city !== undefined) await page.getByLabel('City', { exact: true }).fill(city)
  if (email !== undefined) await page.getByLabel('Email', { exact: true }).fill(email)
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: 'Save form' }).click()
  await page.waitForTimeout(1000)
}

const entryByName = (page, name) =>
  page.getByRole('listitem').filter({ hasText: name })

test.beforeEach(async ({ page }) => {
  // Use domcontentloaded — LambdaTest's network capture can keep connections
  // open long enough that the default 'load' event never fires.
  await page.goto('./', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
})

test('top-bar toggle switches to the Forms view and shows the empty state', async ({ page }) => {
  await gotoForms(page)

  await expect(page.getByRole('button', { name: 'Forms', exact: true })).toHaveClass(/active/)
  await expect(page.getByText('No saved forms yet', { exact: false })).toBeVisible()
  // Task counters belong to the Tasks route only.
  await expect(page.locator('.topbar-stats')).toHaveCount(0)
})

test('creates a form and lands on its detail view', async ({ page }) => {
  await gotoForms(page)
  await createForm(page, { name: 'Jane Doe', age: '30', city: 'Berlin', email: 'jane@example.com' })

  await expect(page.getByRole('heading', { name: 'Jane Doe' })).toBeVisible()
  const detail = page.locator('.entry-detail')
  await expect(detail).toContainText('Berlin')
  await expect(detail).toContainText('30')
  await expect(detail).toContainText('jane@example.com')
})

test('a saved form appears in the list and opens its detail when clicked', async ({ page }) => {
  await gotoForms(page)
  await createForm(page, { name: 'Sam Smith', age: '42', city: 'Oslo', email: 'sam@example.com' })

  await page.getByRole('button', { name: /Saved forms/ }).click()
  await page.waitForTimeout(1000)

  const entry = entryByName(page, 'Sam Smith')
  await expect(entry).toBeVisible()
  await expect(entry).toContainText('Oslo')

  await entry.locator('.entry-summary').click()
  await page.waitForTimeout(1000)
  await expect(page.getByRole('heading', { name: 'Sam Smith' })).toBeVisible()
  await expect(page.locator('.entry-detail')).toContainText('sam@example.com')
})

test('editing a form updates its detail view', async ({ page }) => {
  await gotoForms(page)
  await createForm(page, { name: 'Edit Me', age: '20', city: 'Paris', email: 'edit@example.com' })

  await page.getByRole('button', { name: 'Edit', exact: true }).click()
  await page.waitForTimeout(1000)
  await page.getByLabel('City', { exact: true }).fill('Lyon')
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.waitForTimeout(1000)

  await expect(page.getByRole('heading', { name: 'Edit Me' })).toBeVisible()
  await expect(page.locator('.entry-detail')).toContainText('Lyon')
  await expect(page.locator('.entry-detail')).not.toContainText('Paris')
})

test('deleting a form removes it from the list', async ({ page }) => {
  await gotoForms(page)
  await createForm(page, { name: 'Delete Me', age: '50', city: 'Rome', email: 'del@example.com' })

  // Detail view exposes a Delete button that returns to the list.
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await page.waitForTimeout(1000)

  await expect(entryByName(page, 'Delete Me')).toHaveCount(0)
  await expect(page.getByText('No saved forms yet', { exact: false })).toBeVisible()
})

test('submitting without a name shows a validation error', async ({ page }) => {
  await gotoForms(page)
  await page.getByRole('button', { name: /New form/ }).click()
  await page.waitForTimeout(1000)

  await page.getByLabel('City', { exact: true }).fill('Madrid')
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: 'Save form' }).click()
  await page.waitForTimeout(1000)

  await expect(page.getByRole('alert')).toContainText('Name is required')
})

test('forms persist across a page reload (sessionStorage + /Forms route)', async ({ page }) => {
  await gotoForms(page)
  await createForm(page, { name: 'Persistent Person', age: '33', city: 'Tokyo', email: 'p@example.com' })

  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)

  // The 404.html fallback should re-boot the SPA on /Forms, and the entry
  // should still be present from sessionStorage.
  await expect(entryByName(page, 'Persistent Person')).toBeVisible()
})
