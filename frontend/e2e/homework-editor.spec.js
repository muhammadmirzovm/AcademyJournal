import { test, expect } from '@playwright/test'

async function homeworkPage(page, initial = { assignment: 'Old homework <literal>', assignment_format: 'plain' }) {
  let homework = { ...initial, submissions: [] }
  const writes = []
  let role = 'teacher'
  await page.addInitScript(() => {
    localStorage.setItem('access', 'fake-access'); localStorage.setItem('refresh', 'fake-refresh'); localStorage.setItem('cl_lang', 'uz')
  })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    let json = []
    if (path.endsWith('/auth/me/')) json = { id: role === 'teacher' ? 10 : 21, role, username: role, academy: 1 }
    else if (path === '/api/groups/1/') json = { id: 1, name: 'Mathematics', teacher: 10 }
    else if (path.endsWith('/members/')) json = [{ id: 21, username: 'ali', first_name: 'Ali' }]
    else if (path.endsWith('/lessons/2/')) json = { id: 2, title: 'Fractions', date: '2026-10-24', ended_at: '2026-10-24T10:00:00Z' }
    else if (path.endsWith('/homework/')) {
      if (route.request().method() === 'POST') { const data = route.request().postDataJSON(); writes.push(data); homework = { ...homework, ...data } }
      json = homework
    } else if (path.endsWith('/game/')) json = { status: 'closed', results: [] }
    else if (path.endsWith('/end/')) json = {
      is_update: true, has_changes: writes.length > 0, preview_token: 'preview', students: [], parents: [],
      common_changes: writes.length ? { homework: { old: initial.assignment, old_format: initial.assignment_format, new: homework.assignment, new_format: homework.assignment_format } } : {},
      student_count: 1, parent_count: 0, group_chat: true,
    }
    else if (path.includes('/notifications/')) json = { results: [], unread: 0 }
    await route.fulfill({ json })
  })
  await page.goto('/groups/1/lessons/2')
  await page.getByRole('button', { name: /^uy vazifasi$/i }).click()
  return { writes, asStudent: async () => { role = 'student'; await page.reload(); await page.getByRole('button', { name: /^uy vazifasi$/i }).click() } }
}

test('bold bullet homework saves, reloads and displays to the student', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 800 })
  const state = await homeworkPage(page)
  const editor = page.getByRole('textbox', { name: 'Topshiriq', exact: true })
  await expect(editor).toContainText('Old homework <literal>')
  await editor.fill('Birinchi vazifa')
  await editor.press('ControlOrMeta+a')
  await page.getByRole('button', { name: 'Qalin', exact: true }).click()
  await expect(editor.locator('strong')).toHaveText('Birinchi vazifa')
  await page.getByRole('button', { name: 'Punktli ro‘yxat', exact: true }).click()
  await expect(editor.locator('ul li')).toHaveCount(1)
  // Position the caret inside the paragraph instead of depending on
  // platform-specific selection movement after a toolbar action.
  await editor.locator('li p').evaluate(node => {
    node.focus()
    const range = document.createRange()
    range.selectNodeContents(node)
    range.collapse(false)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
  })
  await editor.press('Enter'); await editor.pressSequentially('Ikkinchi vazifa')
  await expect(editor.locator('li')).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Topshiriqni saqlash', exact: true })).toHaveCount(0)
  await expect.poll(() => state.writes.at(-1)?.assignment).toContain('Ikkinchi vazifa')
  await expect(page.getByRole('status')).toHaveText('Barcha o‘zgarishlar saqlandi.')
  expect(state.writes.at(-1).assignment_format).toBe('html')
  expect(state.writes.at(-1).assignment).toContain('<strong>')
  expect(state.writes.at(-1).assignment).toContain('<ul>')
  await page.getByRole('button', { name: 'O‘zgarishlarni tasdiqlash', exact: true }).click()
  await expect(page.getByRole('dialog').locator('strong').filter({ hasText: 'Birinchi vazifa' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Bekor qilish', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByText('Uy vazifasi saqlandi!', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('homework-mobile-editor.png'), fullPage: true })
  await state.asStudent()
  await expect(page.locator('.homework-rich-text ul li')).toHaveCount(2)
  await expect(page.locator('.homework-rich-text strong').first()).toHaveText('Birinchi vazifa')
  await expect(page.locator('.homework-toolbar')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})

test('italic underline strike and numbered lists work with undo and clear', async ({ page }) => {
  await homeworkPage(page, { assignment: '', assignment_format: 'plain' })
  const editor = page.getByRole('textbox', { name: 'Topshiriq', exact: true })
  await editor.fill('Muhim topshiriq'); await editor.press('ControlOrMeta+a')
  for (const name of ['Kursiv', 'Tagiga chizish', 'Ustiga chizish']) await page.getByRole('button', { name, exact: true }).click()
  for (const tag of ['em', 'u', 's']) await expect(editor.locator(tag)).toHaveText('Muhim topshiriq')
  await page.getByRole('button', { name: 'Raqamli ro‘yxat', exact: true }).click()
  await expect(editor.locator('ol li')).toHaveCount(1)
  await page.getByRole('button', { name: 'Ortga qaytarish', exact: true }).click()
  await expect(editor.locator('ol')).toHaveCount(0)
  await page.getByRole('button', { name: 'Qayta bajarish', exact: true }).click()
  await expect(editor.locator('ol')).toHaveCount(1)
  await page.getByRole('button', { name: 'Formatni tozalash', exact: true }).click()
  await expect(editor.locator('ol, em, u, s')).toHaveCount(0)
})

test('read-only homework strips hostile HTML even from an unexpected API response', async ({ page }) => {
  const state = await homeworkPage(page, { assignment: '<p><strong>Safe</strong><img src=x onerror="window.pwned=true"><script>window.pwned=true</script></p>', assignment_format: 'html' })
  await state.asStudent()
  await expect(page.locator('.homework-rich-text strong')).toHaveText('Safe')
  await expect(page.locator('.homework-rich-text img, .homework-rich-text script')).toHaveCount(0)
  expect(await page.evaluate(() => window.pwned)).toBeUndefined()
})
