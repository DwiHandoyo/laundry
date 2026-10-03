import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })
  app.useLogger(app.get(Logger))
  app.setGlobalPrefix('api/v1')
  app.enableShutdownHooks()

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Laundry API')
      .setDescription('API operasional laundry & perawatan sepatu')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config))
  }

  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port)
}

void bootstrap()
