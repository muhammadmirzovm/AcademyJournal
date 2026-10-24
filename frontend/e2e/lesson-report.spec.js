import { test, expect } from '@playwright/test'

async function lessonPage(page, { ended = true, pending = false, stale = false } = {}) {
  let dirty = pending
  let posted = 0
  const teacher = { id: 10, username: 'teacher', role: 'teacher', academy: 1, first_name: 'Teacher' }
  await page.addInitScript(() => {
    localStorage.setItem('access', 'test-access')
    localStorage.setItem('refresh', 'test-refresh')
    localStorage.setItem('cl_lang', 'uz')
  })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    const post = route.request().method() === 'POST'
    let json = []
    if (path.endsWith('/auth/me/')) json = teacher
    else if (path === '/api/groups/1/') json = { id: 1, teacher: 10, name: 'Math', language: 'uz' }
    else if (path.endsWith('/members/')) json = [{ id: 21, student: 21, first_name: 'Ali', username: 'ali' }]
    else if (path.endsWith('/lessons/2/')) json = { id: 2, title: 'Fractions', date: '2026-10-23', ended_at: ended ? '2026-10-23T10:00:00Z' : null }
    else if (path.endsWith('/homework/')) json = { assignment: 'Original homework', submissions: [] }
    else if (path.endsWith('/attendance/')) json = [{ student: 21, present: true }]
    else if (path.endsWith('/scores/')) {
      if (post) dirty = true
      json = [{ student: 21, value: dirty ? 4 : 5 }]
    } else if (path.endsWith('/game/')) json = { status: 'closed', results: [], date: '2026-10-23' }
    else if (path.endsWith('/end/')) {
      if (post) {
        expect(route.request().postDataJSON().preview_token).toBe('preview-token')
        posted += 1
        if (stale) {
          await route.fulfill({ status: 409, json: { detail: 'Changed' } })
          return
        }
        dirty = false
        ended = true
        json = { ended_at: '2026-10-23T10:00:00Z', notified: 1, is_update: true, has_changes: true }
      } else json = {
        is_update: ended, has_changes: !ended || dirty, preview_token: 'preview-token',
        common_changes: {}, student_count: dirty || !ended ? 1 : 0,
        parent_count: dirty || !ended ? 1 : 0, group_chat: false,
        students: dirty || !ended ? [{ id: 21, name: 'Ali', changes: dirty ? { score: { old: 5, new: 4 } } : {} }] : [],
        parents: dirty || !ended ? [{ id: 31, name: 'Ali ota-onasi' }] : [],
      }
    } else if (path.endsWith('/notifications/')) json = { results: [], unread: 0 }
    await route.fulfill({ json })
  })
  await page.goto('/groups/1/lessons/2')
  return () => posted
}

test('finished unchanged lesson disables report resend', async ({ page }) => {
  const posts = await lessonPage(page)
  await expect(page.getByRole('button', { name: 'Tugagan', exact: true })).toBeDisabled()
  expect(posts()).toBe(0)
})

test('saved grade correction previews affected people and confirms once', async ({ page }) => {
  const posts = await lessonPage(page, { pending: true })
  await page.getByRole('button', { name: 'O‘zgarishlarni tasdiqlash', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Ali')
  await expect(dialog).toContainText('Ali ota-onasi')
  await expect(dialog).toContainText('5 → 4')
  expect(posts()).toBe(0)
  await dialog.getByRole('button', { name: 'O‘zgarishlarni tasdiqlash', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Tugagan', exact: true })).toBeDisabled()
  expect(posts()).toBe(1)
})

test('stale confirmation requires another review', async ({ page }) => {
  const posts = await lessonPage(page, { pending: true, stale: true })
  await page.getByRole('button', { name: 'O‘zgarishlarni tasdiqlash', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'O‘zgarishlarni tasdiqlash', exact: true }).click()
  await expect(page.getByText('Ma’lumotlar o‘zgargan. Yangilangan holatni qayta ko‘rib tasdiqlang.')).toBeVisible()
  expect(posts()).toBe(1)
})

test('first publication still offers End lesson', async ({ page }) => {
  const posts = await lessonPage(page, { ended: false })
  await page.getByRole('button', { name: 'Darsni yakunlash', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Ali ota-onasi')
  expect(posts()).toBe(0)
})

test('an edited grade autosaves and activates confirmation without sending a report', async ({ page }) => {
  const posts = await lessonPage(page)
  await expect(page.getByRole('button', { name: 'Tugagan', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: /^ballar$/i }).click()
  await page.getByRole('button', { name: '4', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Ballarni saqlash', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'O‘zgarishlarni tasdiqlash', exact: true })).toBeEnabled()
  expect(posts()).toBe(0)
  await page.getByRole('button', { name: 'O‘zgarishlarni tasdiqlash', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('5 → 4')
})


test('confirmation preview layout shows the correction and recipients', async ({ page }, testInfo) => {
  await lessonPage(page, { pending: true })
  await page.getByRole('button', { name: 'O‘zgarishlarni tasdiqlash', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('5 → 4')
  await page.screenshot({ path: testInfo.outputPath('lesson-report-preview.png'), fullPage: true })
})
