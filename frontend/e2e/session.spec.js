import { test, expect } from '@playwright/test'

const user = { id: 1, username: 'test_student', first_name: 'Ali', role: 'student', academy: 1, telegram_id: null }
const apiRoute = url => url.pathname.startsWith('/api/')

async function seedSession(page) {
  await page.addInitScript(() => {
    localStorage.setItem('access', 'saved-access')
    localStorage.setItem('refresh', 'saved-refresh')
  })
}

async function stubApi(page, meStatus = 200) {
  await page.route(apiRoute, async route => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/auth/me/')) {
      await route.fulfill({ status: meStatus, json: meStatus === 200 ? user : { detail: 'Unavailable' } })
    } else if (path.endsWith('/auth/token/refresh/')) {
      await route.fulfill({ status: 401, json: { detail: 'Invalid refresh' } })
    } else if (path.endsWith('/auth/notifications/')) {
      await route.fulfill({ json: { results: [], unread: 0 } })
    } else if (path.includes('platform-stats')) {
      await route.fulfill({ json: { total_students: 0, total_teachers: 0, total_groups: 0 } })
    } else if (path.includes('/stats/')) {
      await route.fulfill({ json: { score_trend: [], attendance_summary: {}, coin_trend: [] } })
    } else if (path.includes('/balance/')) {
      await route.fulfill({ json: { balance: 0 } })
    } else {
      await route.fulfill({ json: [] })
    }
  })
}

test('server failure preserves credentials and retry restores the session', async ({ page }) => {
  await seedSession(page)
  await stubApi(page, 503)
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Your session is saved')
  expect(await page.evaluate(() => localStorage.getItem('refresh'))).toBe('saved-refresh')
  await page.unroute(apiRoute)
  await stubApi(page)
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await expect(page.getByText('Your session is saved', { exact: false })).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('access'))).toBe('saved-access')
})

test('network failure preserves credentials and sign out clears them', async ({ page }) => {
  await seedSession(page)
  await page.route(apiRoute, route => route.abort('internetdisconnected'))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Your session is saved')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  expect(await page.evaluate(() => localStorage.getItem('access'))).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('refresh'))).toBeNull()
})

test('invalid access and refresh clear the session', async ({ page }) => {
  await seedSession(page)
  await stubApi(page, 401)
  await page.goto('/')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('refresh'))).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('access'))).toBeNull()
})

test('anonymous users are redirected from protected routes', async ({ page }) => {
  await stubApi(page)
  await page.goto('/coins/report')
  await expect(page).toHaveURL(/\/login$/)
})

test('students are redirected away from admin scanner', async ({ page }) => {
  await seedSession(page)
  await stubApi(page)
  await page.goto('/scanner')
  await expect(page).toHaveURL(/\/dashboard$/)
})
