import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImagesModule } from '../common/images/images.module';
import { StorageModule } from '../common/storage/storage.module';
import { MailModule } from '../mail/mail.module';
import { Utilisateur } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([Utilisateur]), StorageModule, ImagesModule, MailModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
})
export class UsersModule {}
