import assert from 'node:assert/strict'
import test from 'node:test'
import { rosterValues } from '../src/utils/roster.js'

test('attendance form excludes withdrawn students but retains current attendance', () => {
  assert.deepEqual(rosterValues([{ id: 1 }, { id: 3 }], [
    { student: 1, present: true }, { student: 2, present: true },
  ], 'present', false), { 1: true, 3: false })
})

test('score form excludes old results, preserves zero and leaves new students ungraded', () => {
  assert.deepEqual(rosterValues([{ id: 1 }, { id: 3 }], [
    { student: 1, value: 0 }, { student: 2, value: 5 },
  ], 'value', ''), { 1: 0, 3: '' })
})

test('empty roster produces no editable records even when history exists', () => {
  assert.deepEqual(rosterValues([], [{ student: 2, value: 5 }], 'value', ''), {})
})
