import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { IS_PUBLIC_KEY } from './public.decorator'

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()])) return true
    const request = context.switchToHttp().getRequest()
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
    if (!token) throw new UnauthorizedException('Token de acesso obrigatório')
    try {
      request.user = await this.jwt.verifyAsync(token)
      return true
    } catch {
      throw new UnauthorizedException('Token inválido ou expirado')
    }
  }
}
