import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.setGlobalPrefix('api/v1')
  app.enableCors({ origin: process.env.WEB_URL?.split(',') ?? ['http://localhost:3000'], credentials: true })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  const config = new DocumentBuilder()
    .setTitle('ASAX CRM API').setDescription('API pública multi-tenant do ASAX CRM')
    .setVersion('1.0').addBearerAuth().build()
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config))
  await app.listen(Number(process.env.PORT ?? 3001))
}
bootstrap()
