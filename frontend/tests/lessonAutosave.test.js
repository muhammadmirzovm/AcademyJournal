import test from 'node:test'
import assert from 'node:assert/strict'
import { setTimeout as tick } from 'node:timers/promises'
import { createLessonAutosave, mergeRecords } from '../src/utils/lessonAutosave.js'

function harness(initial) {
  const values = new Map(initial ? [['draft', JSON.stringify(initial)]] : [])
  const requests = []
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
  const queue = createLessonAutosave({ storage, storageKey: 'draft', send: (kind, payload) => new Promise((resolve, reject) => requests.push({ kind, payload, resolve, reject })) })
  return { values, requests, queue }
}

test('rapid changes are serialized and newer student values win over old acknowledgements', async () => {
  const { queue, requests, values } = harness()
  queue.enqueue('scores', [{ student: 1, value: 1 }])
  await tick(5)
  queue.enqueue('scores', [{ student: 1, value: 5 }])
  queue.enqueue('scores', [{ student: 2, value: 0 }])
  assert.equal(requests.length, 1)
  assert.deepEqual(JSON.parse(values.get('draft')).scores, [{ student: 1, value: 5 }, { student: 2, value: 0 }])
  requests[0].resolve()
  await tick(5)
  assert.deepEqual(requests[1].payload, [{ student: 1, value: 5 }, { student: 2, value: 0 }])
  const done = queue.flush()
  requests[1].resolve()
  await done
  assert.equal(queue.getSnapshot().status, 'saved')
  assert.equal(values.size, 0)
})

test('homework debounce saves only the latest version and flush drains it before leaving', async () => {
  const { queue, requests } = harness()
  queue.enqueue('homework', { assignment: 'A', assignment_format: 'html' }, 600)
  queue.enqueue('homework', { assignment: '<p>ABC</p>', assignment_format: 'html' }, 600)
  await tick(10)
  assert.equal(requests.length, 0)
  const done = queue.flush()
  await tick(5)
  assert.equal(requests[0].payload.assignment, '<p>ABC</p>')
  requests[0].resolve()
  await done
})

test('failed requests retain edits and retry merges the latest correction', async () => {
  const { queue, requests, values } = harness()
  queue.enqueue('attendance', [{ student: 1, present: true }, { student: 2, present: true }])
  await tick(5)
  queue.enqueue('attendance', [{ student: 1, present: false }])
  requests[0].reject(new Error('offline'))
  await tick(5)
  assert.equal(queue.getSnapshot().status, 'error')
  assert.deepEqual(JSON.parse(values.get('draft')).attendance, [{ student: 1, present: false }, { student: 2, present: true }])
  await assert.rejects(queue.flush(), /offline/)
  const done = queue.retry()
  await tick(5)
  assert.deepEqual(requests[1].payload, [{ student: 1, present: false }, { student: 2, present: true }])
  requests[1].resolve()
  await done
  assert.equal(queue.getSnapshot().pending, false)
})

test('reload restores only eligible students and retains rich homework', async () => {
  const { queue, requests } = harness({ scores: [{ student: 1, value: null }, { student: 99, value: 5 }], homework: { assignment: '<p><strong>Read</strong></p>', assignment_format: 'html' } })
  const draft = queue.restore([1])
  assert.deepEqual(draft.scores, [{ student: 1, value: null }])
  assert.equal(draft.homework.assignment_format, 'html')
  const done = queue.flush()
  await tick(5)
  requests[0].resolve()
  await tick(5)
  requests[1].resolve()
  await done
})

test('clearing a grade removes it without losing zero or touching another pupil', () => {
  assert.deepEqual(mergeRecords([{ student: 1, value: 5 }, { student: 2, value: 0 }], [{ student: 1, value: null }], 'value'), [{ student: 2, value: 0 }])
})

test('identical editor updates do not create duplicate saves during or after a request', async () => {
  const { queue, requests } = harness()
  const homework = { assignment: '<p>Same task</p>', assignment_format: 'html' }
  queue.enqueue('homework', homework)
  await tick(5)
  queue.enqueue('homework', { ...homework })
  const done = queue.flush()
  requests[0].resolve()
  await done
  queue.enqueue('homework', { ...homework })
  await tick(5)
  assert.equal(requests.length, 1)
  assert.equal(queue.getSnapshot().status, 'saved')
})
