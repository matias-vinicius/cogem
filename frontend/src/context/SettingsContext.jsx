import { createContext, useContext, useMemo, useState } from 'react'

const SettingsContext = createContext(null)

const defaultProfile = {
  name: 'Administrador',
  email: 'admin@cogem.com',
  phone: '',
  role: 'Administrador do condomínio',
  condominium: 'Condomínio COGEM',
}

const defaultNotifications = {
  newOccurrence: true,
  statusChanges: true,
  urgentOccurrence: true,
  browser: false,
}

function readStorage(key, fallback) {
  try {
    const saved = localStorage.getItem(key)
    return saved ? { ...fallback, ...JSON.parse(saved) } : fallback
  } catch {
    return fallback
  }
}

export function SettingsProvider({ children }) {
  const [profile, setProfile] = useState(() => readStorage('cogem_profile', defaultProfile))
  const [notifications, setNotifications] = useState(() => readStorage('cogem_notifications', defaultNotifications))

  function saveProfile(nextProfile) {
    const normalized = {
      ...nextProfile,
      name: nextProfile.name.trim(),
      email: nextProfile.email.trim().toLowerCase(),
      phone: nextProfile.phone.trim(),
      role: nextProfile.role.trim(),
      condominium: nextProfile.condominium.trim(),
    }
    localStorage.setItem('cogem_profile', JSON.stringify(normalized))
    setProfile(normalized)
  }

  function saveNotifications(nextNotifications) {
    localStorage.setItem('cogem_notifications', JSON.stringify(nextNotifications))
    setNotifications(nextNotifications)
  }

  const value = useMemo(
    () => ({ profile, notifications, saveProfile, saveNotifications }),
    [profile, notifications],
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings() {
  return useContext(SettingsContext)
}
