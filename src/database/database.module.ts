import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TypeormPerfLogger } from '../common/logger/typeorm-perf.logger';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const isProduction = configService.get<string>('NODE_ENV') === 'production';
        const verboseSql = configService.get<string>('PERF_SQL', 'false') === 'true';
        return {
          type: 'postgres',
          host: configService.get<string>('POSTGRES_HOST', 'localhost'),
          port: configService.get<number>('POSTGRES_PORT', 5432),
          username: configService.get<string>('POSTGRES_USER', 'postgres'),
          password: configService.get<string>('POSTGRES_PASSWORD', 'password'),
          database: configService.get<string>('POSTGRES_DB', 'essg'),
          entities: [__dirname + '/../**/*.entity.{js,ts}'],
          synchronize: !isProduction,
          logger: new TypeormPerfLogger(verboseSql && !isProduction),
          logging: isProduction ? ['error'] : ['error', 'warn', 'schema'],
          maxQueryExecutionTime: 200,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
