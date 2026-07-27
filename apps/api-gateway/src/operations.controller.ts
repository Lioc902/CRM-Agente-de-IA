import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator'
import { PrismaService } from './prisma.service'
import { CryptoService } from './crypto.service'
import { AiService } from './ai.service'
import { MessagingService } from './messaging.service'

class ChannelDto {
  @IsString() name!: string
  @IsIn(['WHATSAPP','INSTAGRAM','MESSENGER','TELEGRAM','EMAIL','WEBCHAT']) channel!: any
  @IsIn(['evolution','meta']) provider!: string
  @IsObject() credentials!: Record<string, unknown>
}
class CampaignDto {
  @IsString() name!: string
  @IsObject() audience!: Record<string, unknown>
  @IsObject() content!: Record<string, unknown>
  @IsOptional() @IsString() scheduledAt?: string
}
class AutomationDto {
  @IsString() name!: string
  @IsObject() definition!: Record<string, unknown>
}
class AgentDto {
  @IsString() name!: string
  @IsIn(['openai','gemini','anthropic']) provider!: string
  @IsString() modelId!: string
  @IsString() instructions!: string
  @IsOptional() @IsBoolean() active?: boolean
}

@ApiTags('operations')
@ApiBearerAuth()
@Controller('operations')
export class OperationsController {
  constructor(private db: PrismaService, private crypto: CryptoService, private ai: AiService, private messaging: MessagingService) {}
  private tenant(req: any) { return req.user.tenantId as string }

  @Get('conversations')
  conversations(@Req() req: any) { return this.db.conversation.findMany({ where: { tenantId: this.tenant(req) }, include: { contact: true, messages: { orderBy: { createdAt: 'asc' }, take: 100 } }, orderBy: { updatedAt: 'desc' } }) }
  @Get('tickets')
  tickets(@Req() req: any) { return this.db.ticket.findMany({ where: { tenantId: this.tenant(req) }, include: { contact: true, department: true }, orderBy: { updatedAt: 'desc' } }) }

  @Get('channels')
  channels(@Req() req: any) { return this.db.channelConnection.findMany({ where: { tenantId: this.tenant(req) }, select: { id: true, name: true, channel: true, provider: true, status: true, createdAt: true } }) }
  @Post('channels')
  channel(@Req() req: any, @Body() dto: ChannelDto) { return this.db.channelConnection.create({ data: { tenantId: this.tenant(req), name: dto.name, channel: dto.channel, provider: dto.provider, credentials: this.crypto.encrypt(dto.credentials), status: 'CONFIGURED' }, select: { id: true, name: true, channel: true, provider: true, status: true } }) }
  @Post('channels/:id/send')
  send(@Req() req: any, @Param('id') id: string, @Body() dto: {recipient:string;content:string;idempotencyKey:string}) { return this.messaging.send(this.tenant(req), id, dto.recipient, dto.content, dto.idempotencyKey) }

  @Get('campaigns')
  campaigns(@Req() req: any) { return this.db.campaign.findMany({ where: { tenantId: this.tenant(req) }, orderBy: { createdAt: 'desc' } }) }
  @Post('campaigns')
  campaign(@Req() req: any, @Body() dto: CampaignDto) { return this.db.campaign.create({ data: { tenantId: this.tenant(req), name: dto.name, audience: dto.audience as any, content: dto.content as any, scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null } }) }
  @Patch('campaigns/:id/status')
  async campaignStatus(@Req() req: any, @Param('id') id: string, @Body('status') status: string) {
    await this.db.campaign.findFirstOrThrow({ where: { id, tenantId: this.tenant(req) } })
    return this.db.campaign.update({ where: { id }, data: { status } })
  }

  @Get('automations')
  automations(@Req() req: any) { return this.db.automation.findMany({ where: { tenantId: this.tenant(req) }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } }) }
  @Post('automations')
  automation(@Req() req: any, @Body() dto: AutomationDto) { return this.db.automation.create({ data: { tenantId: this.tenant(req), name: dto.name, trigger: String((dto.definition as any).trigger?.type ?? 'manual'), versions: { create: { version: 1, definition: dto.definition as any } } }, include: { versions: true } }) }
  @Post('automations/:id/publish')
  async publish(@Req() req: any, @Param('id') id: string) {
    const automation = await this.db.automation.findFirstOrThrow({ where: { id, tenantId: this.tenant(req) }, include: { versions: { orderBy: { version: 'desc' }, take: 1 } } })
    await this.db.automationVersion.update({ where: { id: automation.versions[0].id }, data: { publishedAt: new Date() } })
    return this.db.automation.update({ where: { id }, data: { active: true } })
  }

  @Get('agents')
  agents(@Req() req: any) { return this.db.aiAgent.findMany({ where: { tenantId: this.tenant(req) }, include: { knowledgeDocs: true } }) }
  @Post('agents')
  agent(@Req() req: any, @Body() dto: AgentDto) { return this.db.aiAgent.create({ data: { tenantId: this.tenant(req), ...dto, active: dto.active ?? false } }) }
  @Post('agents/:id/test')
  testAgent(@Req() req: any, @Param('id') id: string, @Body('prompt') prompt: string) { return this.ai.chat(this.tenant(req), id, prompt) }

  @Get('integrations')
  integrations(@Req() req: any) { return this.db.integration.findMany({ where: { tenantId: this.tenant(req) }, select: { id: true, provider: true, active: true, createdAt: true, updatedAt: true } }) }
}
