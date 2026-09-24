import { createContext, useContext, useMemo, useState } from 'react'
import { demoUsers } from '../data/seed'

const AuthContext = createContext(null)
const SESSION_KEY = 'cogem_session_v1'
const DATA_KEY = 'cogem_data_v1'
const LEGACY_SESSION_KEYS = ['cogem_session_v5']
const LEGACY_DATA_KEYS = ['cogem_data_v6']

function readSession() {
  try {
    const current = localStorage.getItem(SESSION_KEY)
    if (current) return JSON.parse(current)
    const legacy = LEGACY_SESSION_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
    if (legacy) localStorage.setItem(SESSION_KEY, legacy)
    return JSON.parse(legacy || 'null')
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession)

  function login(email, password) {
    const storedUsers = (() => {
      try {
        const stored = localStorage.getItem(DATA_KEY) || LEGACY_DATA_KEYS.map((key) => localStorage.getItem(key)).find(Boolean)
        return JSON.parse(stored)?.users || demoUsers
      } catch {
        return demoUsers
      }
    })()
    const found = storedUsers.find((item) => item.email.toLowerCase() === email.trim().toLowerCase() && item.password === password)
    if (!found) throw new Error('E-mail ou senha incorretos.')
    if (!found.active) throw new Error('Este usuário está desativado.')
    const session = { id: found.id, name: found.name, email: found.email, role: found.role, unit: found.unit }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    setUser(session)
    return session
  }

  function loginAs(role) {
    const account = demoUsers.find((item) => item.role === role)
    return login(account.email, account.password)
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY)
    LEGACY_SESSION_KEYS.forEach((key) => localStorage.removeItem(key))
    setUser(null)
  }

  const value = useMemo(() => ({ user, login, loginAs, logout, isAuthenticated: Boolean(user) }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
