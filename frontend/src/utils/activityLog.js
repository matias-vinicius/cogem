const STORAGE_KEY = 'cogem_activity_log'
const EVENT_NAME = 'cogem-activity-updated'

export function readActivityLog() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

export function addActivity(activity) {
  const current = readActivityLog()
  const next = [
    {
      id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
      createdAt: new Date().toISOString(),
      ...activity,
    },
    ...current,
  ].slice(0, 200)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(EVENT_NAME))
}

export function clearActivityLog() {
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event(EVENT_NAME))
}

export const activityEventName = EVENT_NAME
