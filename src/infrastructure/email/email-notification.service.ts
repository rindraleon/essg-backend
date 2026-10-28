import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MailService } from '../../mail/mail.service';
import { Utilisateur } from '../../users/entities/user.entity';
import { PERMISSIONS, rolesWithPermission, type Permission } from '../../users/users.constants';
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

  constructor(
    private readonly mailService: MailService,
    @InjectRepository(Utilisateur)
    private readonly usersRepository: Repository<Utilisateur>,
  ) {}

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
    await this.safeSend('notification admission administrateurs', data.email, async () =>
      this.mailService.sendAdminsAdmissionNotification(
        data,
        await this.findAlertRecipients(PERMISSIONS.ADMISSION_VIEW),
      ),
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
    await this.safeSend('notification contact administrateurs', data.email, async () =>
      this.mailService.sendAdminsContactNotification(
        data,
        await this.findAlertRecipients(PERMISSIONS.CONTACT_VIEW),
      ),
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

  private async findAlertRecipients(permission: Permission): Promise<string[]> {
    const roles = rolesWithPermission(permission);
    if (roles.length === 0) return [];
    try {
      const users = await this.usersRepository.find({
        select: { email: true },
        where: { estActif: true, role: In(roles) },
      });
      return users.map((user) => user.email);
    } catch (error: unknown) {
      this.logger.error(
        `Lecture des destinataires d'alertes impossible : ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
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
