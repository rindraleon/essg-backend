import { Global, Module } from '@nestjs/common';
import { MailModule } from '../../mail/mail.module';
import { EmailNotificationService } from './email-notification.service';

@Global()
@Module({
  imports: [MailModule],
  providers: [EmailNotificationService],
  exports: [EmailNotificationService],
})
export class EmailNotificationModule {}
