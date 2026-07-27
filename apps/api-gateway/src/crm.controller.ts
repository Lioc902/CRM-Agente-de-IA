import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { IsEmail, IsNumber, IsOptional, IsString, MinLength } from 'class-validator'
import { PrismaService } from './prisma.service'

class ContactDto {
  @IsString() @MinLength(2) name!: string
  @IsOptional() @IsEmail() email?: string
  @IsOptional() @IsString() phone?: string
  @IsOptional() @IsString() company?: string
}
class DealDto {
  @IsString() @MinLength(2) title!: string
  @IsString() stageId!: string
  @IsOptional() @IsString() contactId?: string
  @IsOptional() @IsNumber() value?: number
}

@ApiTags('crm')
@ApiBearerAuth()
@Controller('crm')
export class CrmController {
  constructor(private readonly db: PrismaService) {}
  private tenant(req: any): string { return req.user.tenantId }

  @Get('dashboard')
  async dashboard(@Req() req: any): Promise<any> {
    const tenantId = this.tenant(req)
    const [contacts, deals, openTickets, pipeline] = await Promise.all([
      this.db.contact.count({ where: { tenantId } }),
      this.db.deal.aggregate({ where: { tenantId, status: 'OPEN' }, _count: true, _sum: { value: true } }),
      this.db.ticket.count({ where: { tenantId, status: { in: ['OPEN', 'PENDING'] } } }),
      this.db.pipeline.findFirst({ where: { tenantId }, include: { stages: { orderBy: { order: 'asc' }, include: { deals: { where: { status: 'OPEN' }, include: { contact: true } } } } } }),
    ])
    return { contacts, activeDeals: deals._count, pipelineValue: deals._sum.value ?? 0, openTickets, pipeline }
  }

  @Get('contacts')
  async contacts(@Req() req: any, @Query('q') q?: string): Promise<any> {
    return this.db.contact.findMany({ where: { tenantId: this.tenant(req), deletedAt: null, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }, { email: { contains: q, mode: 'insensitive' } }] } : {}) }, orderBy: { updatedAt: 'desc' }, take: 100 })
  }
  @Post('contacts')
  createContact(@Req() req: any, @Body() data: ContactDto): Promise<any> {
    return this.db.contact.create({ data: { ...data, email: data.email?.toLowerCase(), tenantId: this.tenant(req) } })
  }
  @Patch('contacts/:id')
  updateContact(@Req() req: any, @Param('id') id: string, @Body() data: Partial<ContactDto>): Promise<any> {
    return this.db.contact.update({ where: { tenantId_id: { tenantId: this.tenant(req), id } }, data })
  }
  @Delete('contacts/:id')
  deleteContact(@Req() req: any, @Param('id') id: string): Promise<any> {
    return this.db.contact.update({ where: { tenantId_id: { tenantId: this.tenant(req), id } }, data: { deletedAt: new Date() } })
  }

  @Post('deals')
  createDeal(@Req() req: any, @Body() data: DealDto): Promise<any> {
    return this.db.deal.create({ data: { ...data, value: data.value ?? 0, tenantId: this.tenant(req) } })
  }
  @Patch('deals/:id/stage')
  moveDeal(@Req() req: any, @Param('id') id: string, @Body('stageId') stageId: string): Promise<any> {
    return this.db.$transaction(async tx => {
      const deal = await tx.deal.update({ where: { tenantId_id: { tenantId: this.tenant(req), id } }, data: { stageId } })
      await tx.activity.create({ data: { tenantId: this.tenant(req), type: 'deal.stage_changed', content: 'Negócio movido de etapa', dealId: id, userId: req.user.sub } })
      return deal
    })
  }
}
