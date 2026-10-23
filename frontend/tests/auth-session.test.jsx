import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { JSDOM } from 'jsdom'
import axios from 'axios'

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' })
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.localStorage = dom.window.localStorage
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const { render, screen, fireEvent, waitFor, cleanup, act } = await import('@testing-library/react')
const { AuthProvider } = await import('../src/context/AuthContext.jsx')
const { useAuth } = await import('../src/context/auth.js')
const api = (await import('../src/api/axios.js')).default

function Harness() {
  const { user, login, logout } = useAuth()
  return <>
    <div data-testid="user">{user?.username || 'anonymous'}</div>
    <button onClick={logout}>Log out</button>
    <button onClick={() => login({ access: 'new-access', refresh: 'new-refresh' }, { username: 'new-user' })}>Log in</button>
  </>
}

function seed() {
  localStorage.setItem('access', 'old-access')
  localStorage.setItem('refresh', 'old-refresh')
}
const ok = config => ({ config, data: { username: 'old-user' }, status: 200, statusText: 'OK', headers: {} })
const failed = (config, status) => new axios.AxiosError('Failed', undefined, config, null,
  status ? { config, status, data: {}, headers: {} } : undefined)
afterEach(() => { cleanup(); localStorage.clear() })

for (const status of [undefined, 503]) {
  test(`session survives ${status || 'network'} failure and recovers on retry`, async () => {
    seed()
    api.defaults.adapter = async config => { throw failed(config, status) }
    render(<AuthProvider><Harness /></AuthProvider>)
    await screen.findByRole('alert')
    assert.equal(localStorage.getItem('refresh'), 'old-refresh')
    api.defaults.adapter = async config => ok(config)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => assert.equal(screen.getByTestId('user').textContent, 'old-user'))
    assert.equal(localStorage.getItem('refresh'), 'old-refresh')
  })
}

test('invalid credentials clear the session', async () => {
  seed()
  api.defaults.adapter = async config => { throw failed(config, 401) }
  axios.defaults.adapter = async config => { throw failed(config, 401) }
  render(<AuthProvider><Harness /></AuthProvider>)
  await waitFor(() => assert.equal(localStorage.getItem('refresh'), null))
  assert.equal(localStorage.getItem('access'), null)
  assert.equal(screen.queryByRole('alert'), null)
})

test('late profile response cannot restore a logged-out session', async () => {
  seed()
  let finish
  api.defaults.adapter = config => new Promise(resolve => { finish = () => resolve(ok(config)) })
  render(<AuthProvider><Harness /></AuthProvider>)
  await waitFor(() => assert.equal(typeof finish, 'function'))
  fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
  await act(async () => finish())
  assert.equal(screen.getByTestId('user').textContent, 'anonymous')
  assert.equal(localStorage.getItem('refresh'), null)
})

test('late profile response cannot overwrite a newly logged-in user', async () => {
  seed()
  let finish
  api.defaults.adapter = config => new Promise(resolve => { finish = () => resolve(ok(config)) })
  render(<AuthProvider><Harness /></AuthProvider>)
  await waitFor(() => assert.equal(typeof finish, 'function'))
  fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
  await act(async () => finish())
  assert.equal(screen.getByTestId('user').textContent, 'new-user')
  assert.equal(localStorage.getItem('refresh'), 'new-refresh')
})
