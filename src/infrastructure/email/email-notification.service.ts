import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../../mail/mail.service';
import type {
  AdmissionAdminNotification,
  AdmissionConfirmationNotification,
  AdmissionStatusNotification,
  ContactAdminNotification,
  ContactReceiptNotification,
  ContactReplyNotification,
  UserWelcomeNotification,
} from './email-notification.types';

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);

  constructor(private readonly mailService: MailService) {}

  async sendAdmissionConfirmation(data: AdmissionConfirmationNotification): Promise<void> {
    await this.safeSend('accusé de réception admission', data.email, () =>
      this.mailService.sendAdmissionConfirmationEmail(
        data.email,
        data.nom,
        data.prenom,
        data.formation,
        data.reference,
        {
          niveau: data.niveau,
          mention: data.mention,
          parcours: data.parcours,
          bacCategorie: data.bacCategorie,
        },
      ),
    );
  }

  async sendAdmissionAdminNotification(data: AdmissionAdminNotification): Promise<void> {
    await this.safeSend('notification admission administrateurs', data.email, () =>
      this.mailService.sendAdminsAdmissionNotification(data),
    );
  }

  async sendAdmissionStatus(data: AdmissionStatusNotification): Promise<void> {
    const { email, ...notification } = data;
    await this.safeSend('statut admission', email, () =>
      this.mailService.sendAdmissionStatusEmail(email, notification),
    );
  }

  async sendContactReceipt(data: ContactReceiptNotification): Promise<void> {
    const { email, ...notification } = data;
    await this.safeSend('accusé de réception contact', email, () =>
      this.mailService.sendMessageReceiptEmail(email, notification),
    );
  }

  async sendContactAdminNotification(data: ContactAdminNotification): Promise<void> {
    await this.safeSend('notification contact administrateurs', data.email, () =>
      this.mailService.sendAdminsContactNotification(data),
    );
  }

  async sendContactReply(data: ContactReplyNotification): Promise<void> {
    await this.safeSend('réponse contact', data.to, () =>
      this.mailService.sendMessageReplyEmail(data),
    );
  }

  async sendUserWelcome(data: UserWelcomeNotification): Promise<void> {
    await this.safeSend('bienvenue utilisateur', data.email, () =>
      this.mailService.sendWelcomeEmail(data.email, data.nom, data.prenom, data.motDePasse),
    );
  }

  private async safeSend(
    label: string,
    recipient: string,
    send: () => Promise<void>,
  ): Promise<void> {
    try {
      await send();
      this.logger.log(`${label} envoyé à ${this.maskEmail(recipient)}`);
    } catch (error) {
      this.logger.error(
        `Échec ${label} vers ${this.maskEmail(recipient)} : ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private maskEmail(email: string): string {
    const [local = '', domain = ''] = email.split('@');
    return domain ? `${local.slice(0, 2)}***@${domain}` : 'adresse-inconnue';
  }
}
