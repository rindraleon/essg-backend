import { Global, Module } from '@nestjs/common';
import { EmailDomainService } from './email-domain.service';

@Global()
@Module({
  providers: [EmailDomainService],
  exports: [EmailDomainService],
})
export class EmailDomainModule {}
