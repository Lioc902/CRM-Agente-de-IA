import { BadGatewayException, Injectable } from '@nestjs/common'
import { CryptoService } from './crypto.service'
import { PrismaService } from './prisma.service'

@Injectable()
export class MessagingService {
  constructor(private readonly db: PrismaService, private readonly crypto: CryptoService) {}
  async send(tenantId: string, connectionId: string, recipient: string, content: string, idempotencyKey: string) {
    const connection = await this.db.channelConnection.findFirstOrThrow({ where: { id: connectionId, tenantId } })
    const existing = await this.db.message.findFirst({ where: { idempotencyKey, conversation: { tenantId } } })
    if (existing) return existing
    const config = this.crypto.decrypt<any>(connection.credentials)
    let externalId: string
    if (connection.provider === 'evolution') {
      const response = await fetch(`${config.baseUrl}/message/sendText/${config.instance}`, {
        method: 'POST', headers: { 'content-type': 'application/json', apikey: config.apiKey },
        body: JSON.stringify({ number: recipient, text: content }),
      })
      if (!response.ok) throw new BadGatewayException(`Evolution API respondeu ${response.status}`)
      externalId = ((await response.json()) as any).key?.id
    } else if (connection.provider === 'meta') {
      const response = await fetch(`https://graph.facebook.com/v23.0/${config.phoneNumberId}/messages`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${config.token}` },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: recipient, type: 'text', text: { body: content } }),
      })
      if (!response.ok) throw new BadGatewayException(`Meta API respondeu ${response.status}`)
      externalId = ((await response.json()) as any).messages?.[0]?.id
    } else throw new BadGatewayException('Provedor de mensageria não suportado')
    return { externalId, status: 'SENT' }
  }
}
