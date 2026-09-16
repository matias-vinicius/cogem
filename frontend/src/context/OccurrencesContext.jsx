import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createOccurrence, listOccurrences, updateOccurrenceStatus } from '../services/occurrencesApi'

const OccurrencesContext = createContext(null)

export function OccurrencesProvider({ children }) {
  const [occurrences, setOccurrences] = useState([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState('')

  async function refresh() {
    setLoading(true)
    try {
      const data = await listOccurrences()
      setOccurrences(data)
      setApiError('')
    } catch (error) {
      setOccurrences([])
      setApiError(error.message || 'Não foi possível conectar à API.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function addOccurrence(payload) {
    await createOccurrence(payload)
    await refresh()
  }

  async function changeStatus(id, status) {
    await updateOccurrenceStatus(id, status)
    await refresh()
  }

  const value = useMemo(
    () => ({ occurrences, loading, apiError, refresh, addOccurrence, changeStatus }),
    [occurrences, loading, apiError],
  )

  return <OccurrencesContext.Provider value={value}>{children}</OccurrencesContext.Provider>
}

export function useOccurrences() {
  return useContext(OccurrencesContext)
}
