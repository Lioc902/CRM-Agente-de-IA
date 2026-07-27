const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'

export class ApiClient {
  private token() { return typeof window === 'undefined' ? null : localStorage.getItem('nexo.accessToken') }
  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(this.token() ? { authorization: `Bearer ${this.token()}` } : {}), ...init.headers },
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Falha na comunicação com a API' }))
      throw new Error(error.message ?? `Erro ${response.status}`)
    }
    return response.json()
  }
  login(email: string, password: string) { return this.request<any>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }) }
  dashboard() { return this.request<any>('/crm/dashboard') }
  contacts(query = '') { return this.request<any[]>(`/crm/contacts?q=${encodeURIComponent(query)}`) }
  createContact(data: unknown) { return this.request('/crm/contacts', { method: 'POST', body: JSON.stringify(data) }) }
  createDeal(data: unknown) { return this.request('/crm/deals', { method: 'POST', body: JSON.stringify(data) }) }
  moveDeal(id: string, stageId: string) { return this.request(`/crm/deals/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stageId }) }) }
  conversations() { return this.request<any[]>('/operations/conversations') }
  createCampaign(data: unknown) { return this.request('/operations/campaigns', { method: 'POST', body: JSON.stringify(data) }) }
  createAutomation(data: unknown) { return this.request('/operations/automations', { method: 'POST', body: JSON.stringify(data) }) }
  createAgent(data: unknown) { return this.request('/operations/agents', { method: 'POST', body: JSON.stringify(data) }) }
}
export const api = new ApiClient()
