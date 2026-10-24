import { test, expect } from '@playwright/test'

const longName = 'Muhammadmirzo Abdurahmonov'
const student = { id: 21, membership_id: 101, username: 'muhammadmirzo', first_name: 'Muhammadmirzo', last_name: 'Abdurahmonov', role: 'student', academy: 1, is_active: true, joined_at: '2026-10-01', comprehension: 85, attendance_rate: 95, has_parent: true, student_telegram: true, groups: [{ id: 1, name: 'Advanced Mathematics' }] }
const group = { id: 1, name: 'Advanced Mathematics — International Academy', teacher: 10, teacher_name: longName, status: 'active', language: 'uz', join_key: 'ABC12345', class_days: [0, 2, 4], class_time: '14:00-16:00', member_count: 1, lesson_count: 1 }
const lesson = { id: 2, title: 'Fractions and mathematical reasoning', date: '2026-10-24', ended_at: '2026-10-24T10:00:00Z' }
const paginated = results => ({ results, pages: 1, page: 1, total: results.length, count: results.length })

async function mockApp(page, lang = 'ru') {
  await page.addInitScript(lang => {
    localStorage.setItem('access', 'test-access')
    localStorage.setItem('refresh', 'test-refresh')
    localStorage.setItem('cl_lang', lang)
  }, lang)
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    let json = []
    if (path === '/auth/me/') json = { id: 10, username: 'admin', first_name: longName, role: 'admin', academy: 1 }
    else if (path === '/academy/') json = { id: 1, name: 'International Learning Academy', primary_color: '#0D9488', report_time: '13:00', weekly_report_time: '12:00' }
    else if (path === '/academy/members/') json = new URL(route.request().url()).searchParams.has('role') && !new URL(route.request().url()).searchParams.has('page') ? [student] : paginated([student, { ...student, id: 22, role: 'parent' }, { ...student, id: 23, role: 'teacher' }])
    else if (path === '/auth/admin/students/') json = paginated([student])
    else if (path === '/auth/admin-stats/') json = { total_students: 1, total_teachers: 1, total_groups: 1, students_per_teacher: [{ teacher: longName, students: 1 }], students_growth: [], absences_by_month: [] }
    else if (path === '/auth/users/21/') json = student
    else if (path.endsWith('/stats/')) json = { score_trend: [], coin_trend: [], exam_trend: [], attendance_calendar: [{ date: '2026-10-24', present: true }], streak: { current: 12, longest: 25 }, attendance_summary: { total: 10, present: 9 } }
    else if (path.endsWith('/notify/')) json = { student: { id: 21, name: longName, telegram: true }, parents: [] }
    else if (path === '/groups/' || path === '/auth/users/21/groups/') json = [group]
    else if (path === '/groups/1/') json = group
    else if (path.endsWith('/lessons/')) json = paginated([lesson])
    else if (path.endsWith('/lessons/2/')) json = lesson
    else if (path.endsWith('/members/')) json = [student]
    else if (path.endsWith('/homework/')) json = { assignment: 'Homework assignment', submissions: [] }
    else if (path.endsWith('/attendance/')) json = [{ student: 21, present: true }]
    else if (path.endsWith('/scores/')) json = [{ student: 21, value: 4 }]
    else if (path.endsWith('/game/')) json = { status: 'closed', results: [] }
    else if (path.endsWith('/end/')) json = { is_update: true, has_changes: true, preview_token: 'token', common_changes: {}, student_count: 1, parent_count: 1, students: [{ id: 21, name: longName, changes: { score: { old: 5, new: 4 } } }], parents: [{ id: 22, name: longName }], group_chat: false }
    else if (path === '/exams/upcoming/') json = { exam_ready_groups: [group], active_exams: [] }
    else if (path.endsWith('/exams/')) json = paginated([])
    else if (path === '/coins/report/') json = { outstanding_balance: 1500, issued_last_30_days: 500, spent_last_30_days: 100, spend_by_category: [] }
    else if (path.includes('/purchases/')) json = paginated([])
    else if (path === '/coins/settings/') json = {}
    else if (path === '/invites/') json = paginated([{ id: 1, token: 'test', role: 'student', created_at: '2026-10-24', used_count: 1, max_uses: 5, note: 'Invite for the international mathematics group' }])
    else if (path.includes('/notifications/')) json = { results: [], unread: 0 }
    else if (path.endsWith('/games/1/')) json = { id: 1, name: 'Mathematics Quiz', status: 'active', created_by: 10, team_count: 2, timer_seconds: 30, teams: [{ id: 1, name: 'First team', score: 100, members: [student], color: '#6366F1' }], board: { Algebra: [{ id: 1, value: 100, difficulty: 'easy', answered: false }], Geometry: [{ id: 2, value: 200, difficulty: 'medium', answered: false }] } }
    await route.fulfill({ json })
  })
}

async function fitsViewport(page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
}

const routes = ['/dashboard', '/groups', '/groups/1', '/groups/1?tab=members', '/groups/1/lessons/2', '/settings', '/students', '/questions', '/profile/21', '/rewards', '/coins/report', '/exams', '/groups/1/games/1']
for (const width of [320, 390, 768, 1440]) {
  test(`populated pages fit ${width}px in Russian`, async ({ page }) => {
    test.setTimeout(120000)
    await page.setViewportSize({ width, height: 900 })
    await mockApp(page)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('main')).toBeVisible()
      if (route.includes('/games/')) await expect(page.getByText('Mathematics Quiz')).toBeVisible()
      else await expect(page.locator('main h1, main h2').first()).toBeVisible()
      await expect(page.locator('main')).not.toHaveText('')
      await test.step(route, () => fitsViewport(page))
      expect(errors, route).toEqual([])
    }
  })
}

test('mobile settings actions stay inside cards and tabs remain named', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await mockApp(page)
  await page.goto('/settings')
  await expect(page.locator('.settings-tabs-btn')).toHaveCount(3)
  await page.locator('.settings-tabs-btn').nth(1).click()
  await expect(page.locator('.member-row')).toHaveCount(3)
  for (const action of await page.locator('.member-row-action').all()) {
    const box = await action.boundingBox()
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(320)
  }
  await fitsViewport(page)
  await page.locator('.settings-tabs-btn').nth(2).click()
  await expect(page.locator('.invite-row')).toBeVisible()
  await fitsViewport(page)
})

test('phone lesson confirmation remains usable', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await mockApp(page, 'uz')
  await page.goto('/groups/1/lessons/2')
  await page.getByRole('button', { name: 'O‘zgarishlarni tasdiqlash', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('5 → 4')
  await fitsViewport(page)
  const button = dialog.getByRole('button', { name: 'O‘zgarishlarni tasdiqlash', exact: true })
  await button.scrollIntoViewIfNeeded()
  const box = await button.boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(320)
  expect(box.y + box.height).toBeLessThanOrEqual(640)
  await page.screenshot({ path: testInfo.outputPath('responsive-lesson.png'), fullPage: true })
})

for (const width of [320, 768, 1440]) {
  test(`public pages fit ${width}px`, async ({ page }) => {
    test.setTimeout(60000)
    await page.setViewportSize({ width, height: 900 })
    await page.route(url => url.pathname.startsWith('/api/'), route => route.fulfill({ json: {} }))
    for (const route of ['/', '/login', '/register', '/forgot-password', '/missing-page']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('main')).toBeVisible()
      await test.step(route, () => fitsViewport(page))
    }
  })
}

test('group action menu fits phone and member names remain visible', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await mockApp(page)
  await page.goto('/groups/1?tab=members')
  await page.locator('.group-detail-hd-btns button[title]').last().click()
  await expect(page.locator('.hd-dropdown')).toBeVisible()
  await fitsViewport(page)
  const box = await page.locator('.hd-dropdown').boundingBox()
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(320)
  await page.screenshot({ path: testInfo.outputPath('responsive-group.png'), fullPage: true })
  await page.locator('.group-detail-hd-btns button[title]').last().click()
  await page.locator('.group-member-card button').last().click()
  await expect(page.locator('.group-member-card')).toContainText('Удалить')
  await fitsViewport(page)
})
