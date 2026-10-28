import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../../mail/mail.module';
import { Utilisateur } from '../../users/entities/user.entity';
import { EmailNotificationService } from './email-notification.service';

@Global()
@Module({
  imports: [MailModule, TypeOrmModule.forFeature([Utilisateur])],
  providers: [EmailNotificationService],
  exports: [EmailNotificationService],
})
export class EmailNotificationModule {}
