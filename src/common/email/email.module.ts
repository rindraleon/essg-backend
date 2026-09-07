import { Global, Module } from '@nestjs/common';
import { EmailValidationService } from './email-validation.service';
import { EmailGuardService } from './email-guard.service';

@Global()
@Module({
  providers: [EmailValidationService, EmailGuardService],
  exports: [EmailValidationService, EmailGuardService],
})
export class EmailModule {}
