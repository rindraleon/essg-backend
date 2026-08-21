import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../common/storage/storage.module';
import { MailModule } from '../mail/mail.module';
import { SettingsModule } from '../settings/settings.module';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsService } from './admissions.service';
import { Admission } from './entities/admission.entity';
import { AdmissionFile } from './entities/admission-file.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Admission, AdmissionFile]),
    MailModule,
    StorageModule,
    SettingsModule,
  ],
  controllers: [AdmissionsController],
  providers: [AdmissionsService],
  exports: [AdmissionsService],
})
export class AdmissionsModule {}
