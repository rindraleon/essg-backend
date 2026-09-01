import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import {
  API_PROVIDER,
  API_SIGNATURE,
  API_TITLE,
  API_VERSION,
} from './common/constants/api.constants';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { createValidationException } from './common/utils/validation-messages';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: true,
      exceptionFactory: createValidationException,
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  const extraOrigins = (configService.get<string>('CORS_ORIGINS') || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: [
      'http://localhost:5000',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:4173',
      'http://localhost:8000',
      'https://gateway.tsirylab.com',
      ...extraOrigins,
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    exposedHeaders: [
      'X-Api-Signature',
      'X-Api-Version',
      'X-Response-Time',
      'X-Document-Inline-Viewable',
    ],
  });

  const appUrl = configService.get<string>('APP_URL', 'http://localhost:3000');

  const swaggerBuilder = new DocumentBuilder()
    .setTitle(API_TITLE)
    .setVersion(API_VERSION)
    .setContact(API_PROVIDER, 'https://itdcmada.mg', 'contact@itdcmada.mg')
    .setLicense('Licence propriétaire ITDCMADA', 'https://itdcmada.mg')
    .setExternalDoc('Schéma OpenAPI (JSON)', `${appUrl.replace(/\/$/, '')}/docs-json`)
    .addServer(appUrl, 'Serveur courant')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
        description:
          'Collez ici le jeton renvoyé par `POST /auth/login` (champ `data.accessToken`).',
      },
      'access-token',
    );

  const document = SwaggerModule.createDocument(app, swaggerBuilder.build(), {
    operationIdFactory: (controllerKey, methodKey) => `${controllerKey}_${methodKey}`,
  });

  document.info['x-api-signature'] = API_SIGNATURE;
  document.info['x-provider'] = API_PROVIDER;

  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: `${API_TITLE} — Documentation`,
    jsonDocumentUrl: 'docs-json',
    yamlDocumentUrl: 'docs-yaml',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      tryItOutEnabled: true,
    },
    customCss: `
      .swagger-ui .topbar { background: #0f172a; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
      .swagger-ui .info .title small.version-stamp { background: #16a34a; }
      .swagger-ui .info::after {
        content: 'Toutes les réponses de cette API sont signées ${API_SIGNATURE}';
        display: block;
        margin-top: 12px;
        padding: 10px 14px;
        border-radius: 10px;
        background: #0f172a;
        color: #e2e8f0;
        font-weight: 600;
        letter-spacing: 0.04em;
      }
    `,
  });

  const port = configService.get<number>('APP_PORT') || 3000;
  await app.listen(port);
  logger.log(`Application démarrée sur http://localhost:${port}`);
  logger.log(`Documentation disponible sur http://localhost:${port}/docs`);
  logger.log(`État de santé disponible sur http://localhost:${port}/health`);
}

void bootstrap();
