import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RessourceHumaine } from './entities/ressource-humaine.entity';
import { RessourcesHumainesService } from './ressources-humaines.service';
import { RessourcesHumainesController } from './ressources-humaines.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RessourceHumaine])],
  controllers: [RessourcesHumainesController],
  providers: [RessourcesHumainesService],
  exports: [RessourcesHumainesService],
})
export class RessourcesHumainesModule {}
