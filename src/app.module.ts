import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdmissionsModule } from './admissions/admissions.module';
import { SessionsModule } from './sessions/sessions.module';
import { AuthModule } from './auth/auth.module';
import { PerformanceInterceptor } from './common/interceptors/performance.interceptor';
import { StorageModule } from './common/storage/storage.module';
import { EmailModule } from './common/email/email.module';
import { validate } from './config/env.validation';
import { DashboardModule } from './dashboard/dashboard.module';
import { CacheModule } from './infrastructure/cache/cache.module';
import { EmailNotificationModule } from './infrastructure/email/email-notification.module';
import { RateLimitModule } from './infrastructure/rate-limit/rate-limit.module';
import { DatabaseModule } from './database/database.module';
import { FormationsModule } from './formations/formations.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { MediaModule } from './media/media.module';
import { MessagesModule } from './messages/messages.module';
import { ActivityLogsModule } from './activity-logs/activity-log.module';
import { NewsModule } from './news/news.module';
import { PartnersModule } from './parteners/partners.module';
import { ProjectsModule } from './projects/projects.module';
import { RessourcesHumainesModule } from './ressources-humaines/ressources-humaines.module';
import { SettingsModule } from './settings/settings.module';
import { UploadModule } from './upload/upload.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate,
    }),
    DatabaseModule,
    CacheModule,
    EmailNotificationModule,
    RateLimitModule,
    StorageModule,
    EmailModule,
    UsersModule,
    AuthModule,
    SessionsModule,
    FormationsModule,
    ProjectsModule,
    PartnersModule,
    MessagesModule,
    NewsModule,
    RessourcesHumainesModule,
    UploadModule,
    MediaModule,
    HealthModule,
    DashboardModule,
    MailModule,
    AdmissionsModule,
    ActivityLogsModule,
    SettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_INTERCEPTOR, useClass: PerformanceInterceptor }],
})
export class AppModule {}
