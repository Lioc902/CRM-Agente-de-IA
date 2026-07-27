export type TenantPlan = 'BASIC' | 'PRO' | 'ENTERPRISE'
export type UserRole = 'OWNER' | 'ADMIN' | 'SUPERVISOR' | 'AGENT'
export type ChannelType =
  | 'WHATSAPP'
  | 'INSTAGRAM'
  | 'MESSENGER'
  | 'TELEGRAM'
  | 'EMAIL'
  | 'WEBCHAT'

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

export interface ApiError {
  statusCode: number
  message: string
  error: string
  requestId?: string
}

export interface JwtPayload {
  sub: string
  tenantId: string
  role: UserRole
}

export interface TenantBranding {
  name: string
  logoUrl?: string
  faviconUrl?: string
  primaryColor: string
  accentColor: string
}

export interface SendMessageInput {
  connectionId: string
  recipient: string
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'template'
  content?: string
  mediaUrl?: string
  templateId?: string
  idempotencyKey: string
}

export interface ProviderMessageResult {
  externalId: string
  status: 'queued' | 'sent' | 'failed'
}

export interface MessagingProvider {
  readonly name: string
  connect(connectionId: string): Promise<{ qrCode?: string; status: string }>
  disconnect(connectionId: string): Promise<void>
  getStatus(connectionId: string): Promise<string>
  sendMessage(input: SendMessageInput): Promise<ProviderMessageResult>
}

export interface AICompletionInput {
  tenantId: string
  agentId: string
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  tools?: Array<{ name: string; description: string; inputSchema: unknown }>
}

export interface AICompletionResult {
  content: string
  model: string
  inputTokens: number
  outputTokens: number
  toolCalls?: Array<{ name: string; arguments: unknown }>
}

export interface AIProvider {
  readonly name: string
  complete(input: AICompletionInput): Promise<AICompletionResult>
  embed(texts: string[]): Promise<number[][]>
  transcribe(audio: Uint8Array): Promise<string>
}

export const DOMAIN_EVENTS = [
  'message.received',
  'contact.created',
  'ticket.created',
  'deal.stage_changed',
  'automation.triggered',
  'payment.approved',
] as const

export type DomainEventName = (typeof DOMAIN_EVENTS)[number]

export interface DomainEvent<T = unknown> {
  id: string
  name: DomainEventName
  tenantId: string
  occurredAt: string
  payload: T
}
