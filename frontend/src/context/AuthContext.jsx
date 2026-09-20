import { createContext, useContext, useMemo, useState } from 'react'
import { demoUsers } from '../data/seed'

const AuthContext = createContext(null)
const SESSION_KEY = 'cogem_session_v3'

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')
  } catch {
    return null
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession)

  function login(email, password) {
    const storedUsers = (() => {
      try {
        return JSON.parse(localStorage.getItem('cogem_data_v3'))?.users || demoUsers
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
    setUser(null)
  }

  const value = useMemo(() => ({ user, login, loginAs, logout, isAuthenticated: Boolean(user) }), [user])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
