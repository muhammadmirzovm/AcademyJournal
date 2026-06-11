import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'
import { registerPush } from '../utils/push'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access')
    if (token) {
      api.get('/auth/me/').then(r => { setUser(r.data); registerPush() }).catch(() => {
        localStorage.clear()
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = (tokens, userData) => {
    localStorage.setItem('access', tokens.access)
    localStorage.setItem('refresh', tokens.refresh)
    setUser(userData)
    registerPush()
  }

  const logout = () => {
    localStorage.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
