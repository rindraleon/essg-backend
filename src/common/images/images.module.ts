import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { ImageOptimizerService } from './image-optimizer.service';
import { ImageUploadService } from './image-upload.service';

@Module({
  imports: [StorageModule],
  providers: [ImageOptimizerService, ImageUploadService],
  exports: [ImageOptimizerService, ImageUploadService],
})
export class ImagesModule {}
