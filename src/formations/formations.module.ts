import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormationsService } from './formations.service';
import { FormationsController } from './formations.controller';
import { Formation } from './entities/formation.entity';
import { RessourceHumaine } from '../ressources-humaines/entities/ressource-humaine.entity';
import { Mention } from '../mentions/entities/mention.entity';
import { Parcours } from '../mentions/entities/parcours.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Formation, RessourceHumaine, Parcours, Mention])],
  controllers: [FormationsController],
  providers: [FormationsService],
})
export class FormationsModule {}
