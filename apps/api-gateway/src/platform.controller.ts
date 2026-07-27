import { Controller, Get, Headers, NotFoundException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { PrismaService } from './prisma.service'
import { Public } from './public.decorator'

@ApiTags('platform')
@Controller()
export class PlatformController {
  constructor(private readonly db: PrismaService) {}

  @Public()
  @Get('health')
  health() { return { status: 'ok', service: 'api-gateway', timestamp: new Date().toISOString() } }

  @Public()
  @Get('branding')
  async branding(@Headers('x-forwarded-host') forwarded?: string, @Headers('host') host?: string): Promise<any> {
    const domain = (forwarded ?? host ?? '').split(':')[0]
    const tenant = await this.db.tenant.findFirst({ where: { OR: [{ domain }, { slug: domain.split('.')[0] }] } })
    if (!tenant) throw new NotFoundException('Marca não encontrada')
    return { name: tenant.name, logoUrl: tenant.logoUrl, faviconUrl: tenant.faviconUrl, primaryColor: tenant.primaryColor, accentColor: tenant.accentColor, modules: tenant.modules }
  }
}
