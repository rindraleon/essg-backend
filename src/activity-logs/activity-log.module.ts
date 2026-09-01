import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActivityLogController } from './activity-log.controller';
import { ActivityLogDescriptionService } from './activity-log-description.service';
import { ActivityLogService } from './activity-log.service';
import { ActivityLog } from './entities/activity-log.entity';
import { ActivityLogInterceptor } from 'src/common/interceptors/activity-log.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog])],
  controllers: [ActivityLogController],
  providers: [
    ActivityLogService,
    ActivityLogDescriptionService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLogInterceptor,
    },
  ],
  exports: [ActivityLogService, ActivityLogDescriptionService],
})
export class ActivityLogsModule {}
