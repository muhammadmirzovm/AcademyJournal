import { test, expect } from '@playwright/test'

async function lesson(page, { delayFirstScore = false, failFirstScore = false } = {}) {
  let scores = [{ student: 21, value: 5 }, { student: 22, value: 0 }]
  let attendance = [{ student: 21, present: true }, { student: 22, present: false }]
  let homework = { assignment: 'Old task', assignment_format: 'plain', submissions: [] }
  let dirty = false
  let reports = 0
  let release = () => {}
  const writes = []
  await page.addInitScript(() => {
    localStorage.setItem('access', 'test-access'); localStorage.setItem('refresh', 'test-refresh'); localStorage.setItem('cl_lang', 'uz')
  })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    const post = route.request().method() === 'POST'
    let json = []
    if (path.endsWith('/auth/me/')) json = { id: 10, username: 'teacher', role: 'teacher', academy: 1 }
    else if (path === '/api/groups/1/') json = { id: 1, teacher: 10, name: 'Math' }
    else if (path === '/api/groups/') json = [{ id: 1, teacher: 10, name: 'Math' }]
    else if (path.endsWith('/members/')) json = [{ id: 21, first_name: 'Ali', username: 'ali' }, { id: 22, first_name: 'Vali', username: 'vali' }]
    else if (path.endsWith('/lessons/2/')) json = { id: 2, title: 'Fractions', date: '2026-10-24', ended_at: '2026-10-24T10:00:00Z' }
    else if (path.endsWith('/scores/')) {
      if (post) {
        const records = route.request().postDataJSON().records
        writes.push({ kind: 'scores', records })
        if (failFirstScore) { failFirstScore = false; await route.fulfill({ status: 503, json: { detail: 'offline' } }); return }
        if (delayFirstScore) { delayFirstScore = false; await new Promise(resolve => { release = resolve }) }
        for (const row of records) {
          scores = scores.filter(item => item.student !== row.student)
          if (row.value !== null) scores.push(row)
        }
        dirty = true
      }
      json = scores
    } else if (path.endsWith('/attendance/')) {
      if (post) {
        const records = route.request().postDataJSON().records
        writes.push({ kind: 'attendance', records })
        for (const row of records) attendance = [...attendance.filter(item => item.student !== row.student), row]
        dirty = true
      }
      json = attendance
    } else if (path.endsWith('/homework/')) {
      if (post) { const data = route.request().postDataJSON(); homework = { ...homework, ...data }; writes.push({ kind: 'homework', ...data }); dirty = true }
      json = homework
    } else if (path.endsWith('/end/')) {
      if (post) reports += 1
      json = { is_update: true, has_changes: dirty, preview_token: 'token', students: [], parents: [], common_changes: {}, student_count: dirty ? 1 : 0, parent_count: 0, group_chat: false }
    } else if (path.endsWith('/game/')) json = { status: 'closed', results: [] }
    else if (path.includes('/notifications/')) json = { results: [], unread: 0 }
    await route.fulfill({ json })
  })
  await page.goto('/groups/1/lessons/2')
  await expect(page.locator('h2')).toHaveText('Fractions')
  return { writes, release: () => release(), scores: () => scores, reports: () => reports }
}
const row = (page, id) => page.locator(`[data-student-id="${id}"]`)
const saved = page => expect(page.getByRole('status')).toHaveText('Barcha o‘zgarishlar saqlandi.')

test('attendance saves just the changed pupil and mark-all saves one batch', async ({ page }) => {
  const state = await lesson(page)
  await expect(page.getByRole('button', { name: 'Saqlash', exact: true })).toHaveCount(0)
  await row(page, 21).getByRole('button').click()
  await saved(page)
  expect(state.writes[0]).toEqual({ kind: 'attendance', records: [{ student: 21, present: false }] })
  await page.getByRole('button', { name: 'Hammasini kelgan deb belgilash', exact: true }).click()
  await saved(page)
  expect(state.writes.at(-1).records).toEqual([{ student: 21, present: true }, { student: 22, present: true }])
  expect(state.reports()).toBe(0)
})

test('rapid grades serialize, stale responses cannot roll back edits, and clearing persists', async ({ page }) => {
  const state = await lesson(page, { delayFirstScore: true })
  await page.getByRole('button', { name: /^ballar$/i }).click()
  await row(page, 21).getByRole('button', { name: '4', exact: true }).click()
  await expect.poll(() => state.writes.length).toBe(1)
  await row(page, 21).getByRole('button', { name: '3', exact: true }).click()
  await row(page, 21).getByRole('button', { name: '2', exact: true }).click()
  await row(page, 22).getByRole('button', { name: '1', exact: true }).click()
  expect(state.writes).toHaveLength(1)
  await expect(page.locator('.lesson-header button')).toBeDisabled()
  state.release()
  await saved(page)
  expect(state.writes[1].records).toEqual([{ student: 21, value: 2 }, { student: 22, value: 1 }])
  await expect(row(page, 21).getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await row(page, 21).getByRole('button', { name: '2', exact: true }).click()
  await saved(page)
  expect(state.scores()).toEqual([{ student: 22, value: 1 }])
  expect(state.reports()).toBe(0)
})

test('homework saves after a short pause even when the tab changes', async ({ page }) => {
  const state = await lesson(page)
  await page.getByRole('button', { name: /^uy vazifasi$/i }).click()
  await page.getByRole('textbox', { name: 'Topshiriq', exact: true }).fill('Complete exercise 10')
  await page.getByRole('button', { name: /^ballar$/i }).click()
  await saved(page)
  expect(state.writes.filter(write => write.kind === 'homework')).toHaveLength(1)
  expect(state.writes[0].assignment).toContain('Complete exercise 10')
  await page.getByRole('button', { name: /^uy vazifasi$/i }).click()
  await expect(page.getByRole('textbox', { name: 'Topshiriq', exact: true })).toContainText('Complete exercise 10')
  await expect(page.locator('.lesson-header button')).toBeEnabled()
  expect(state.reports()).toBe(0)
})

test('a failed save preserves the draft across reload and restores it automatically', async ({ page }) => {
  const state = await lesson(page, { failFirstScore: true })
  await page.getByRole('button', { name: /^ballar$/i }).click()
  await row(page, 21).getByRole('button', { name: '4', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Saqlanmadi')
  await expect(row(page, 21).getByRole('button', { name: '4', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.lesson-header button')).toBeDisabled()
  page.once('dialog', dialog => dialog.accept())
  await page.reload()
  await saved(page)
  expect(state.scores().find(score => score.student === 21).value).toBe(4)
  expect(state.reports()).toBe(0)
})

test('an explicit retry sends the retained edit without a Save button', async ({ page }) => {
  const state = await lesson(page, { failFirstScore: true })
  await page.getByRole('button', { name: /^ballar$/i }).click()
  await row(page, 21).getByRole('button', { name: '4', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Saqlanmadi')
  await page.getByRole('button', { name: 'Qayta urinish', exact: true }).click()
  await saved(page)
  expect(state.scores().find(score => score.student === 21).value).toBe(4)
})

test('navigating away drains a pending homework draft', async ({ page }) => {
  const state = await lesson(page)
  await page.getByRole('button', { name: /^uy vazifasi$/i }).click()
  await page.getByRole('textbox', { name: 'Topshiriq', exact: true }).fill('Pending navigation task')
  await page.locator('nav').getByRole('link', { name: 'Guruhlar', exact: true }).click()
  await expect(page).toHaveURL(/\/groups$/)
  await expect.poll(() => state.writes.filter(write => write.kind === 'homework').at(-1)?.assignment).toContain('Pending navigation task')
  expect(state.reports()).toBe(0)
})
