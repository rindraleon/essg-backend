import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from '../common/storage/storage.module';
import { ActivityLogsModule } from '../activity-logs/activity-log.module';
import { ResultatsController } from './results.controller';
import { ResultsService } from './results.service';
import { ResultatPublication } from './entities/resultat-publication.entity';
import { ResultatIndividuel } from './entities/resultat-individuel.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ResultatPublication, ResultatIndividuel]),
    StorageModule,
    ActivityLogsModule,
  ],
  controllers: [ResultatsController],
  providers: [ResultsService],
  exports: [ResultsService],
})
export class ResultsModule {}
