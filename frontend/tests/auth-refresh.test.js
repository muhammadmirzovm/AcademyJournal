import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import axios from 'axios'
import api from '../src/api/axios.js'

const response = (config, data) => ({ config, data, status: 200, statusText: 'OK', headers: {} })
const unauthorized = config => new axios.AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null,
  { config, status: 401, data: {}, headers: {} })

beforeEach(() => {
  const values = new Map([['access', 'old-access'], ['refresh', 'old-refresh'], ['theme', 'dark']])
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    clear: () => values.clear(),
  }
  globalThis.window = { location: { pathname: '/dashboard', href: '' } }
  api.defaults.adapter = async config => {
    if (config.headers.Authorization === 'Bearer old-access') throw unauthorized(config)
    return response(config, { authorization: config.headers.Authorization })
  }
})

test('stores both rotated tokens and retries with the new access token', async () => {
  axios.defaults.adapter = async config => {
    assert.deepEqual(JSON.parse(config.data), { refresh: 'old-refresh' })
    return response(config, { access: 'new-access', refresh: 'new-refresh' })
  }
  const result = await api.get('/auth/me/')
  assert.equal(result.data.authorization, 'Bearer new-access')
  assert.equal(localStorage.getItem('refresh'), 'new-refresh')
})

test('retains the existing refresh token if rotation is disabled', async () => {
  axios.defaults.adapter = async config => response(config, { access: 'new-access' })
  await api.get('/auth/me/')
  assert.equal(localStorage.getItem('refresh'), 'old-refresh')
})

test('concurrent unauthorized requests share one token rotation', async () => {
  let calls = 0
  axios.defaults.adapter = async config => {
    calls++
    await new Promise(resolve => setImmediate(resolve))
    return response(config, { access: 'new-access', refresh: 'new-refresh' })
  }
  const results = await Promise.all([api.get('/one/'), api.get('/two/')])
  assert.equal(calls, 1)
  assert.ok(results.every(r => r.data.authorization === 'Bearer new-access'))
})

test('failed refresh clears auth only and redirects protected pages', async () => {
  axios.defaults.adapter = async config => { throw unauthorized(config) }
  await assert.rejects(api.get('/auth/me/'))
  assert.equal(localStorage.getItem('access'), null)
  assert.equal(localStorage.getItem('refresh'), null)
  assert.equal(localStorage.getItem('theme'), 'dark')
  assert.equal(window.location.href, '/login')
})

test('a pending refresh cannot restore a logged-out session', async () => {
  axios.defaults.adapter = async config => {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    return response(config, { access: 'new-access', refresh: 'new-refresh' })
  }
  await assert.rejects(api.get('/auth/me/'))
  assert.equal(localStorage.getItem('access'), null)
  assert.equal(localStorage.getItem('refresh'), null)
})

test('a repeated 401 is not retried indefinitely', async () => {
  let calls = 0
  axios.defaults.adapter = async config => {
    calls++
    return response(config, { access: 'new-access', refresh: 'new-refresh' })
  }
  api.defaults.adapter = async config => { throw unauthorized(config) }
  await assert.rejects(api.get('/auth/me/'))
  assert.equal(calls, 1)
})

test('a late 401 reuses tokens already rotated by another request', async () => {
  axios.defaults.adapter = async () => assert.fail('Must not refresh again')
  api.defaults.adapter = async config => {
    if (config.headers.Authorization === 'Bearer old-access') {
      localStorage.setItem('access', 'new-access')
      localStorage.setItem('refresh', 'new-refresh')
      throw unauthorized(config)
    }
    return response(config, { authorization: config.headers.Authorization })
  }
  const result = await api.get('/late/')
  assert.equal(result.data.authorization, 'Bearer new-access')
})

test('a pending refresh cannot overwrite a newly logged-in account', async () => {
  axios.defaults.adapter = async config => {
    localStorage.setItem('access', 'other-account-access')
    localStorage.setItem('refresh', 'other-account-refresh')
    return response(config, { access: 'new-access', refresh: 'new-refresh' })
  }
  await assert.rejects(api.get('/auth/me/'))
  assert.equal(localStorage.getItem('access'), 'other-account-access')
  assert.equal(localStorage.getItem('refresh'), 'other-account-refresh')
})
