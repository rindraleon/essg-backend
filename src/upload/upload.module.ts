import { Module } from '@nestjs/common';
import { ImagesModule } from '../common/images/images.module';
import { StorageModule } from '../common/storage/storage.module';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

@Module({
  imports: [StorageModule, ImagesModule],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
