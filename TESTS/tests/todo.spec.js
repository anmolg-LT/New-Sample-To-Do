import { test, expect } from '../lambdatest-setup.js'

const addItem = async (page, text, isoDate) => {
  await page.getByPlaceholder('What needs to be done?').fill(text)
  await page.waitForTimeout(1000)
  if (isoDate) {
    await page.getByLabel('Due date').fill(isoDate)
    await page.waitForTimeout(1000)
  }
  await page.getByRole('button', { name: 'Add' }).click()
  await page.waitForTimeout(1000)
}

const filterButton = (page, name) =>
  page.locator('.filter-btn', { hasText: name })

const itemByText = (page, text) =>
  page.getByRole('listitem').filter({ hasText: text })

test.beforeEach(async ({ page }) => {
  // Use domcontentloaded — LambdaTest's network capture can keep connections
  // open long enough that the default 'load' event never fires.
  await page.goto('./', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1000)
})

test('shows the empty state and zeroed counters on first load', async ({ page }) => {
  await expect(page.getByText('No items yet — add one above.')).toBeVisible()
  await expect(page.locator('.topbar-stats')).toContainText('0 remaining')
  await expect(page.locator('.topbar-stats')).toContainText('0 total')
})

test('adds a new todo and updates the top-bar counters', async ({ page }) => {
  await addItem(page, 'Buy groceries')

  await expect(itemByText(page, 'Buy groceries')).toBeVisible()
  await expect(page.locator('.topbar-stats')).toContainText('1 remaining')
  await expect(page.locator('.topbar-stats')).toContainText('1 total')
})

test('adds a todo with a due date and renders the date pill', async ({ page }) => {
  const future = new Date()
  future.setDate(future.getDate() + 7)
  const yyyy = future.getFullYear()
  const mm = String(future.getMonth() + 1).padStart(2, '0')
  const dd = String(future.getDate()).padStart(2, '0')
  const iso = `${yyyy}-${mm}-${dd}`

  await addItem(page, 'Submit report', iso)

  const item = itemByText(page, 'Submit report')
  await expect(item).toBeVisible()
  await expect(item.locator('.due-date')).toBeVisible()
  // Day number is locale-agnostic; the month label format may vary.
  await expect(item.locator('.due-date')).toContainText(String(future.getDate()))
})

test('toggling complete strikes through the item and decrements remaining', async ({ page }) => {
  await addItem(page, 'Read book')

  const item = itemByText(page, 'Read book')
  await item.getByRole('checkbox').check()
  await page.waitForTimeout(1000)

  await expect(item).toHaveClass(/done/)
  await expect(page.locator('.topbar-stats')).toContainText('0 remaining')
  await expect(page.locator('.topbar-stats')).toContainText('1 total')
})

test('Active and Completed filters limit the visible list', async ({ page }) => {
  await addItem(page, 'Task A')
  await addItem(page, 'Task B')

  await itemByText(page, 'Task A').getByRole('checkbox').check()
  await page.waitForTimeout(1000)

  await filterButton(page, 'Active').click()
  await page.waitForTimeout(1000)
  await expect(itemByText(page, 'Task B')).toBeVisible()
  await expect(itemByText(page, 'Task A')).toHaveCount(0)

  await filterButton(page, 'Completed').click()
  await page.waitForTimeout(1000)
  await expect(itemByText(page, 'Task A')).toBeVisible()
  await expect(itemByText(page, 'Task B')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Clear completed' })).toBeVisible()
})

test('Clear completed button is hidden outside the Completed filter', async ({ page }) => {
  await addItem(page, 'Task A')
  await itemByText(page, 'Task A').getByRole('checkbox').check()
  await page.waitForTimeout(1000)

  // Still on "All" — button should not be present
  await expect(page.getByRole('button', { name: 'Clear completed' })).toHaveCount(0)

  await filterButton(page, 'Active').click()
  await page.waitForTimeout(1000)
  await expect(page.getByRole('button', { name: 'Clear completed' })).toHaveCount(0)

  await filterButton(page, 'Completed').click()
  await page.waitForTimeout(1000)
  await expect(page.getByRole('button', { name: 'Clear completed' })).toBeVisible()
})

test('deletes an item', async ({ page }) => {
  await addItem(page, 'Temporary')

  const item = itemByText(page, 'Temporary')
  await expect(item).toBeVisible()
  await item.getByRole('button', { name: 'Delete' }).click()
  await page.waitForTimeout(1000)
  await expect(item).toHaveCount(0)
})

test('items persist across a page reload (sessionStorage)', async ({ page }) => {
  await addItem(page, 'Persistent task')

  await page.reload()
  await page.waitForTimeout(1000)
  await expect(itemByText(page, 'Persistent task')).toBeVisible()
})

test('Clear completed removes all done items', async ({ page }) => {
  await addItem(page, 'Done A')
  await addItem(page, 'Done B')

  await itemByText(page, 'Done A').getByRole('checkbox').check()
  await page.waitForTimeout(1000)
  await itemByText(page, 'Done B').getByRole('checkbox').check()
  await page.waitForTimeout(1000)

  await filterButton(page, 'Completed').click()
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: 'Clear completed' }).click()
  await page.waitForTimeout(1000)

  // All items were completed and cleared, so the list is fully empty.
  await expect(page.getByText('No items yet — add one above.')).toBeVisible()
  await expect(page.locator('.topbar-stats')).toContainText('0 total')
})
