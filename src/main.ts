import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Swagger config
  const config = new DocumentBuilder()
    .setTitle('Backend ITDC')
    .setDescription('Documentation des API ITDC')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = configService.get<number>('APP_PORT') || 3000;
  await app.listen(port);
  console.debug(`Application is running on: http://localhost:${port}`);

  console.debug(`Documentation is running on: http://localhost:${port}/docs`);
}

bootstrap();
