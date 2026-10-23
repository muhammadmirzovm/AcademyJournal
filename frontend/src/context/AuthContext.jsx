import { useState, useEffect, useRef } from 'react'
import api from '../api/axios'
import { registerPush } from '../utils/push'
import { isInvalidSession } from '../utils/session'

import { AuthContext } from './auth'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('access')))
  const [sessionError, setSessionError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)
  const sessionVersion = useRef(0)

  useEffect(() => {
    const version = sessionVersion.current
    let active = true
    const token = localStorage.getItem('access')
    if (token) {
      api.get('/auth/me/').then(r => {
        if (!active || version !== sessionVersion.current) return
        setUser(r.data)
        registerPush()
      }).catch(error => {
        if (!active || version !== sessionVersion.current) return
        if (isInvalidSession(error)) {
          localStorage.removeItem('access')
          localStorage.removeItem('refresh')
        } else {
          setSessionError('Unable to connect. Your session is saved. Please try again.')
        }
      }).finally(() => {
        if (active && version === sessionVersion.current) setLoading(false)
      })
    }
    return () => { active = false }
  }, [retryCount])

  const login = (tokens, userData) => {
    sessionVersion.current++
    localStorage.setItem('access', tokens.access)
    localStorage.setItem('refresh', tokens.refresh)
    setUser(userData)
    setSessionError(null)
    setLoading(false)
    registerPush()
  }

  const logout = () => {
    sessionVersion.current++
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    setUser(null)
    setSessionError(null)
    setLoading(false)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {sessionError ? (
        <main role="alert" style={{ maxWidth: 480, margin: '15vh auto', padding: 24 }}>
          <p>{sessionError}</p>
          <button onClick={() => {
            setLoading(true)
            setSessionError(null)
            setRetryCount(n => n + 1)
          }}>Try again</button>
          <button onClick={logout}>Sign out</button>
        </main>
      ) : children}
    </AuthContext.Provider>
  )
}
