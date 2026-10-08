import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Formation } from '../formations/entities/formation.entity';
import { Mention } from './entities/mention.entity';
import { Parcours } from './entities/parcours.entity';
import { MentionsService } from './mentions.service';
import { ParcoursService } from './parcours.service';
import { MentionsController } from './mentions.controller';
import { ParcoursController } from './parcours.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Mention, Parcours, Formation])],
  controllers: [MentionsController, ParcoursController],
  providers: [MentionsService, ParcoursService],
  exports: [MentionsService, ParcoursService],
})
export class MentionsModule {}
