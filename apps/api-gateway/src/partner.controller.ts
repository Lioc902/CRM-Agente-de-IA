import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { IsArray, IsHexColor, IsOptional, IsString } from 'class-validator'
import { PrismaService } from './prisma.service'

class BrandingDto {
  @IsOptional() @IsString() name?: string
  @IsOptional() @IsString() domain?: string
  @IsOptional() @IsString() logoUrl?: string
  @IsOptional() @IsString() faviconUrl?: string
  @IsOptional() @IsHexColor() primaryColor?: string
  @IsOptional() @IsHexColor() accentColor?: string
  @IsOptional() @IsArray() modules?: string[]
}

@ApiTags('partner')
@ApiBearerAuth()
@Controller('partner')
export class PartnerController {
  constructor(private db: PrismaService) {}
  @Get('overview')
  async overview(@Req() req: any) {
    const tenantId = req.user.tenantId
    const tenant = await this.db.tenant.findUniqueOrThrow({ where: { id: tenantId } })
    const [users, contacts, channels, automations] = await Promise.all([
      this.db.user.count({ where: { tenantId } }), this.db.contact.count({ where: { tenantId, deletedAt: null } }),
      this.db.channelConnection.count({ where: { tenantId } }), this.db.automation.count({ where: { tenantId, active: true } }),
    ])
    return { tenant, usage: { users, contacts, channels, automations }, limits: { users: tenant.maxUsers, contacts: tenant.maxContacts } }
  }
  @Patch('branding')
  branding(@Req() req: any, @Body() dto: BrandingDto) { return this.db.tenant.update({ where: { id: req.user.tenantId }, data: dto }) }
}
