import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { EmailValidationService } from './email-validation.service';
import type { EmailValidationOptions } from './email-validation.service';

@Injectable()
export class EmailGuardService {
  private readonly logger = new Logger(EmailGuardService.name);

  constructor(private readonly emailValidation: EmailValidationService) {}

  async assertUsable(
    email?: string | null,
    champ = 'email',
    options: EmailValidationOptions = {},
  ): Promise<string | undefined> {
    if (email === undefined || email === null || email === '') return undefined;

    const result = await this.emailValidation.validate(email, options);
    if (!result.valid) {
      throw new BadRequestException(result.reason ?? 'Adresse e-mail invalide.');
    }
    if (result.degraded) {
      this.logger.warn(
        `Vérification de délivrabilité indisponible pour « ${result.email} » (${champ}) : acceptée par repli.`,
      );
    }
    return result.email;
  }

  async assertDeliverable(email?: string | null, champ = 'email'): Promise<string | undefined> {
    return this.assertUsable(email, champ, { probeMailbox: true });
  }
}
