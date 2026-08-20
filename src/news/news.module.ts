import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';
import { Actualite } from './entities/news-item.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Actualite])],
  controllers: [NewsController],
  providers: [NewsService],
})
export class NewsModule {}
