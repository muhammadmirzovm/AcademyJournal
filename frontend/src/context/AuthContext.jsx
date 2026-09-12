import { useState, useEffect } from 'react'
import api from '../api/axios'
import { registerPush } from '../utils/push'

import { AuthContext } from './auth'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('access')))

  useEffect(() => {
    const token = localStorage.getItem('access')
    if (token) {
      api.get('/auth/me/').then(r => { setUser(r.data); registerPush() }).catch(() => {
        localStorage.removeItem('access')
        localStorage.removeItem('refresh')
      }).finally(() => setLoading(false))
    }
  }, [])

  const login = (tokens, userData) => {
    localStorage.setItem('access', tokens.access)
    localStorage.setItem('refresh', tokens.refresh)
    setUser(userData)
    registerPush()
  }

  const logout = () => {
    localStorage.removeItem('access')
    localStorage.removeItem('refresh')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}
