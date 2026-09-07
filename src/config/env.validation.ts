import { IsBoolean, IsNumber, IsOptional, IsString, validateSync } from 'class-validator';
import { plainToInstance, Type } from 'class-transformer';

class EnvironmentVariables {
  @IsString()
  @IsOptional()
  NODE_ENV: string = 'development';

  @IsString()
  @IsOptional()
  POSTGRES_HOST: string = 'localhost';

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  POSTGRES_PORT: number = 5432;

  @IsString()
  @IsOptional()
  POSTGRES_USER: string = 'postgres';

  @IsString()
  @IsOptional()
  POSTGRES_PASSWORD: string = 'password';

  @IsString()
  @IsOptional()
  POSTGRES_DB: string = 'essg';

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  APP_PORT: number = 3000;

  @IsString()
  @IsOptional()
  APP_URL: string = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  UPLOAD_PATH: string = 'uploads';

  @IsString()
  @IsOptional()
  PERF_LOG: string = 'false';

  @IsString()
  @IsOptional()
  PERF_SQL: string = 'false';

  @IsString()
  @IsOptional()
  PERF_SLOW_MS: string = '400';

  @IsString()
  @IsOptional()
  ADMIN_EMAIL?: string;

  @IsString()
  @IsOptional()
  ADMIN_PASSWORD?: string;

  @IsString()
  @IsOptional()
  ADMIN_PRENOM?: string;

  @IsString()
  @IsOptional()
  ADMIN_NOM?: string;

  @IsString()
  @IsOptional()
  JWT_SECRET: string = 'essg-default-secret-key-change-in-production';

  @IsString()
  @IsOptional()
  JWT_EXPIRATION: string = '24h';

  @IsString()
  @IsOptional()
  SMTP_HOST: string = 'smtp.gmail.com';

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  SMTP_PORT: number = 587;

  @IsBoolean()
  @IsOptional()
  SMTP_SECURE: boolean = false;

  @IsString()
  @IsOptional()
  SMTP_USER: string = '';

  @IsString()
  @IsOptional()
  DB_AUTO_MIGRATE: string = 'true';

  @IsString()
  @IsOptional()
  EMAIL_TRUSTED_DOMAINS: string = '';

  @IsString()
  @IsOptional()
  EMAIL_SMTP_PROBE: string = 'false';

  @IsString()
  @IsOptional()
  EMAIL_SMTP_PROBE_SENDER: string = 'noreply@essg.mg';

  @IsString()
  @IsOptional()
  SMTP_PASS: string = '';

  @IsString()
  @IsOptional()
  SMTP_FROM: string = '';

  @IsString()
  @IsOptional()
  ADMIN_NOTIFY_EMAILS: string = '';

  @IsString()
  @IsOptional()
  BACK_OFFICE_URL: string = 'http://localhost:5000';

  @IsString()
  @IsOptional()
  MINIO_ENDPOINT: string = 'localhost';

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  MINIO_PORT: number = 9000;

  @IsBoolean()
  @IsOptional()
  MINIO_USE_SSL: boolean = false;

  @IsString()
  @IsOptional()
  MINIO_ACCESS_KEY: string = '';

  @IsString()
  @IsOptional()
  MINIO_SECRET_KEY: string = '';

  @IsString()
  @IsOptional()
  MINIO_BUCKET: string = 'essg';

  @IsString()
  @IsOptional()
  MINIO_PUBLIC_URL: string = '';

  @IsString()
  @IsOptional()
  CORS_ORIGINS: string = '';

  @IsString()
  @IsOptional()
  RATE_LIMIT_ENABLED: string = 'true';

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  HEALTH_MEMORY_LIMIT_MB: number = 512;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`Validation de la configuration échouée: ${errors.toString()}`);
  }
  return validatedConfig;
}
