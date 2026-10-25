import { test, expect } from '@playwright/test'

async function setup(page, { role = 'admin', stale = false } = {}) {
  let balance = 25
  const writes = []
  let entries = [{ id: 1, amount: 25, type: 'game_place', reason: 'Original game', created_at: '2026-10-25T09:00:00Z', created_by_name: 'Teacher' }]
  await page.addInitScript(() => { localStorage.setItem('access', 'test-access'); localStorage.setItem('refresh', 'test-refresh'); localStorage.setItem('cl_lang', 'en') })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    let json = []
    if (path.endsWith('/auth/me/')) json = { id: 10, role, username: role, academy: 1 }
    else if (path === '/api/auth/users/21/') json = { id: 21, role: 'student', username: 'ali', first_name: 'Ali', academy: 1 }
    else if (path.endsWith('/stats/')) json = { score_trend: [], coin_trend: [], schedule: [] }
    else if (path === '/api/coins/students/21/') {
      if (route.request().method() === 'POST') {
        const data = route.request().postDataJSON(); writes.push(data)
        if (stale) { stale = false; balance = 30; await route.fulfill({ status: 409, json: { balance } }); return }
        const delta = data.action === 'reset' ? -balance : data.amount * (data.action === 'add' ? 1 : -1)
        balance += delta
        entries = [{ id: entries.length + 1, amount: delta, type: 'adjustment', reason: data.reason, created_at: '2026-10-25T10:00:00Z', created_by_name: 'Admin' }, ...entries]
      }
      json = { balance, count: entries.length, results: entries }
    } else if (path.includes('/notify/')) json = { can_notify: false, parents: [], student: { telegram_connected: false } }
    else if (path.includes('/notifications/')) json = { results: [], unread: 0 }
    await route.fulfill({ json })
  })
  await page.goto('/profile/21')
  await expect(page.getByText('Ali', { exact: true }).first()).toBeVisible()
  return writes
}
const panel = page => page.getByRole('region', { name: 'Coins', exact: true })
async function review(page, action, amount, reason) {
  const ui = panel(page)
  await ui.getByRole('combobox', { name: 'Action', exact: true }).selectOption(action)
  if (amount) await ui.getByLabel('Amount', { exact: true }).fill(String(amount))
  await ui.getByLabel('Reason', { exact: true }).fill(reason)
  await ui.getByRole('button', { name: 'Review', exact: true }).click()
}
test('admin adds, subtracts and resets with immutable history', async ({ page }) => {
  const writes = await setup(page)
  const ui = panel(page)
  await expect(ui.getByText('Current balance:')).toContainText('25')
  await review(page, 'add', 5, 'Bonus')
  expect(writes).toHaveLength(0)
  await ui.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(ui.getByText('Current balance:')).toContainText('30')
  await review(page, 'subtract', 10, 'Correction')
  await ui.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(ui.getByText('Current balance:')).toContainText('20')
  await review(page, 'reset', null, 'Reset balance')
  await ui.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(writes).toHaveLength(2)
  await ui.getByRole('button', { name: 'Review', exact: true }).click()
  await ui.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(ui.getByText('Current balance:')).toHaveText('Current balance: 0')
  await expect(ui.getByText('Original game', { exact: true })).toBeVisible()
  await expect(ui.getByText('Reset balance', { exact: true })).toBeVisible()
  expect(writes.map(x => x.expected_balance)).toEqual([25, 30, 20])
})
test('stale confirmation refreshes balance and requires review again', async ({ page }) => {
  const writes = await setup(page, { stale: true })
  await review(page, 'reset', null, 'Reset stale')
  await panel(page).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(panel(page).getByText('Current balance:')).toContainText('30')
  await expect(panel(page).getByRole('button', { name: 'Confirm', exact: true })).toHaveCount(0)
  expect(writes).toHaveLength(1)
  await panel(page).getByRole('button', { name: 'Review', exact: true }).click()
  await panel(page).getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(panel(page).getByText('Current balance:')).toHaveText('Current balance: 0')
  expect(writes[1].expected_balance).toBe(30)
})
test('teacher cannot see wallet management', async ({ page }) => {
  await setup(page, { role: 'teacher' })
  await expect(panel(page)).toHaveCount(0)
})
test('wallet management fits a small mobile screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await setup(page)
  await expect(panel(page)).toBeVisible()
  await review(page, 'reset', null, 'Mobile reset')
  expect(await panel(page).evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await panel(page).screenshot({ path: 'test-results/student-coins-mobile.png' })
})
