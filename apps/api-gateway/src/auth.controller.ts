import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { JwtService } from '@nestjs/jwt'
import { IsEmail, IsString, MinLength } from 'class-validator'
import { createHash, timingSafeEqual } from 'crypto'
import { PrismaService } from './prisma.service'
import { Public } from './public.decorator'

class LoginDto {
  @IsEmail() email!: string
  @IsString() @MinLength(8) password!: string
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly db: PrismaService, private readonly jwt: JwtService) {}

  @Public()
  @Post('login')
  async login(@Body() input: LoginDto): Promise<any> {
    const user = await this.db.user.findFirst({ where: { email: input.email.toLowerCase(), active: true }, include: { tenant: true } })
    const candidate = createHash('sha256').update(input.password).digest()
    const stored = user ? Buffer.from(user.passwordHash, 'hex') : Buffer.alloc(candidate.length)
    if (!user || stored.length !== candidate.length || !timingSafeEqual(stored, candidate)) throw new UnauthorizedException('E-mail ou senha inválidos')
    const accessToken = await this.jwt.signAsync({ sub: user.id, tenantId: user.tenantId, role: user.role })
    await this.db.auditLog.create({ data: { tenantId: user.tenantId, userId: user.id, action: 'auth.login', entity: 'User', entityId: user.id } })
    return { accessToken, user: { id: user.id, name: user.name, email: user.email, role: user.role }, tenant: user.tenant }
  }
}
