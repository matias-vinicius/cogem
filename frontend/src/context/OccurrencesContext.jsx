import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createOccurrence, listOccurrences, updateOccurrenceStatus } from '../services/occurrencesApi'
import { addActivity } from '../utils/activityLog'

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
    const response = await createOccurrence(payload)
    const createdId = response?.['Id da ocorrência'] ?? response?.id
    addActivity({
      type: 'create',
      title: `${createdId ? `Ocorrência #${String(createdId).padStart(3, '0')}` : 'Ocorrência'} cadastrada`,
      description: `${payload.descricao} — criada automaticamente como “em aberto”.`,
    })
    await refresh()
  }

  async function changeStatus(id, status) {
    const occurrence = occurrences.find((item) => item.id === Number(id))
    await updateOccurrenceStatus(id, status)
    addActivity({
      type: 'status',
      title: `Status da ocorrência #${String(id).padStart(3, '0')} alterado`,
      description: `${occurrence?.status || 'Status anterior'} → ${status}.`,
    })
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
