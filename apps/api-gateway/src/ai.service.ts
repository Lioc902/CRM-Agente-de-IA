import { BadGatewayException, Injectable } from '@nestjs/common'
import { PrismaService } from './prisma.service'

@Injectable()
export class AiService {
  constructor(private readonly db: PrismaService) {}
  async chat(tenantId: string, agentId: string, prompt: string) {
    const agent = await this.db.aiAgent.findFirstOrThrow({ where: { id: agentId, tenantId, active: true } })
    const started = Date.now()
    if (agent.provider !== 'openai') throw new BadGatewayException(`Provedor ${agent.provider} ainda não configurado neste ambiente`)
    if (!process.env.OPENAI_API_KEY) throw new BadGatewayException('Chave da OpenAI não configurada')
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({ model: agent.modelId, instructions: agent.instructions, input: prompt }),
    })
    if (!response.ok) throw new BadGatewayException(`Falha do provedor de IA (${response.status})`)
    const result: any = await response.json()
    const content = result.output_text ?? result.output?.flatMap((o: any) => o.content ?? []).find((c: any) => c.type === 'output_text')?.text ?? ''
    await this.db.activity.create({ data: { tenantId, type: 'ai.response', content: `Agente ${agent.name} respondeu em ${Date.now() - started}ms` } })
    return { content, model: result.model, usage: result.usage, latencyMs: Date.now() - started }
  }
}
