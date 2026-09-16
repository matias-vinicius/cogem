const API_URL = import.meta.env.VITE_API_URL || '/api'

function normalize(item) {
  return {
    id: Number(item.ID ?? item.id),
    bloco: item.bloco,
    andar: Number(item.andar),
    lado: item.lado,
    descricao: item['descrição'] ?? item.descricao,
    criadoEm: item['criado em'] ?? item.criado_em ?? item.criadoEm,
    status: (item.Status ?? item.status ?? 'em aberto').toLowerCase(),
    tipo: (item.Tipo ?? item.tipo ?? 'comum').toLowerCase(),
  }
}

async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) throw new Error(`Erro ${response.status} ao acessar a API`)
  return response.json()
}

export async function listOccurrences() {
  const data = await request('/Ocorrencias')
  return data.map(normalize)
}

export async function createOccurrence(payload) {
  return request('/Ocorrencia', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateOccurrenceStatus(id, status) {
  return request(`/Ocorrencia/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  })
}
