import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../common/storage/storage.module';
import { MailModule } from '../mail/mail.module';
import { SettingsModule } from '../settings/settings.module';
import { AdmissionsController } from './admissions.controller';
import { AdmissionsService } from './admissions.service';
import { Admission } from './entities/admission.entity';
import { AdmissionFile } from './entities/admission-file.entity';
import { AdmissionVerification } from './verification/entities/admission-verification.entity';
import { AdmissionsVerificationController } from './verification/admissions-verification.controller';
import { AdmissionDocumentVerificationService } from './verification/services/admission-document-verification.service';
import { TextExtractionService } from './verification/services/text-extraction.service';
import { OcrService } from './verification/services/ocr.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Admission, AdmissionFile, AdmissionVerification]),
    MailModule,
    StorageModule,
    SettingsModule,
  ],
  controllers: [AdmissionsController, AdmissionsVerificationController],
  providers: [
    AdmissionsService,
    AdmissionDocumentVerificationService,
    TextExtractionService,
    OcrService,
  ],
  exports: [AdmissionsService, AdmissionDocumentVerificationService],
})
export class AdmissionsModule {}
