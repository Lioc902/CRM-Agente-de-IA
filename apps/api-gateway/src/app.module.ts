import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { APP_GUARD } from '@nestjs/core'
import { PrismaService } from './prisma.service'
import { AuthController } from './auth.controller'
import { CrmController } from './crm.controller'
import { PlatformController } from './platform.controller'
import { JwtAuthGuard } from './jwt-auth.guard'
import { OperationsController } from './operations.controller'
import { PartnerController } from './partner.controller'
import { AiService } from './ai.service'
import { CryptoService } from './crypto.service'
import { MessagingService } from './messaging.service'
import { resolve } from 'path'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [resolve(__dirname, '../../../.env'), resolve(process.cwd(), '.env')] }),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET ?? 'change-me-in-production',
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [AuthController, CrmController, PlatformController, OperationsController, PartnerController],
  providers: [PrismaService, AiService, CryptoService, MessagingService, { provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
