import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import { AdmissionStatus } from '../admissions/entities/admission.entity';
import {
  AdmissionConfirmationData,
  renderAdmissionConfirmationTemplate,
} from './templates/admission/confirmation.template';
import {
  AdmissionNotificationData,
  renderAdmissionStatusTemplate,
} from './templates/admission/admission-status.template';
import {
  MessageReceiptTemplateData,
  renderMessageReceiptTemplate,
} from './templates/message-receipt.template';
import { renderMessageReplyTemplate } from './templates/message-reply.template';
import { renderWelcomeTemplate } from './templates/welcome.template';
import {
  AdminAdmissionNotificationData,
  renderAdminAdmissionNotificationTemplate,
} from './templates/admin-admission-notification.template';
import {
  AdminContactNotificationData,
  renderAdminContactNotificationTemplate,
} from './templates/admin-contact-notification.template';
import { htmlToText, MAIL_ERROR, toMailHttpException } from './mail.errors';
import { checkEmailSyntax } from '../common/email/email-format.util';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly replyTo: string;
  private readonly appUrl: string;
  private readonly backOfficeUrl: string;
  private readonly adminNotifyEmails: string[];
  private readonly configured: boolean;

  constructor(private readonly configService: ConfigService) {
    const host = this.readString('SMTP_HOST', 'smtp.gmail.com');
    const port = this.readNumber('SMTP_PORT', 587);
    const secure = port === 465;
    const user = this.readString('SMTP_USER', '');
    const pass = this.readString('SMTP_PASS', '');
    this.from = this.readString('SMTP_FROM', user || 'no-reply@essg.mg');
    this.replyTo = this.readString('SMTP_REPLY_TO', this.from);
    this.appUrl = this.readString('APP_URL', 'http://localhost:3000');
    this.backOfficeUrl = this.readString('BACK_OFFICE_URL', 'http://localhost:5000');
    const rawAdminEmails = this.readString('ADMIN_NOTIFY_EMAILS', '')
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean);
    this.adminNotifyEmails = rawAdminEmails.filter((email) => checkEmailSyntax(email).valid);
    if (rawAdminEmails.length !== this.adminNotifyEmails.length) {
      this.logger.warn('ADMIN_NOTIFY_EMAILS contient des adresses invalides — elles sont ignorées');
    }
    this.configured = Boolean(host && user && pass && !user.startsWith('your-'));

    const explicitSecure = this.readBoolean('SMTP_SECURE', false);
    if (explicitSecure !== secure) {
      this.logger.warn(
        `SMTP_SECURE=${explicitSecure} ignoré : incohérent avec le port ${port} — ${secure ? 'TLS direct (465)' : 'STARTTLS (587/25)'} utilisé`,
      );
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: this.configured ? { user, pass } : undefined,
      tls: { minVersion: 'TLSv1.2' },
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });

    this.logger.log(
      `SMTP initialisé (host=${host} port=${port} secure=${secure} from=${this.from} configuré=${this.configured})`,
    );
  }

  async onModuleInit(): Promise<void> {
    if (!this.configured) {
      this.logger.warn(
        'SMTP non configuré — les envois d’email échoueront jusqu’à correction du .env',
      );
      return;
    }
    try {
      await this.transporter.verify();
      this.logger.log('Connexion SMTP vérifiée');
    } catch (error) {
      this.logger.error(
        'Échec de la vérification SMTP — vérifiez host, port, TLS et identifiants',
        error instanceof Error ? error.stack : error,
      );
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<void> {
    const to = options.to.trim();
    const validation = checkEmailSyntax(to);
    if (!validation.valid) {
      this.logger.warn(`Envoi refusé : adresse invalide (${to || 'vide'})`);
      throw new BadRequestException(validation.reason ?? MAIL_ERROR.INVALID_ADDRESS);
    }
    if (!this.configured) {
      this.logger.error(`Envoi impossible vers ${to} : SMTP non configuré`);
      throw new ServiceUnavailableException(MAIL_ERROR.SMTP_CONNECTION);
    }

    try {
      const info = (await this.transporter.sendMail({
        from: this.from,
        to,
        replyTo: options.replyTo || this.replyTo,
        subject: options.subject,
        html: options.html,
        text: options.text ?? htmlToText(options.html),
      })) as {
        messageId?: string;
        accepted?: string[];
        rejected?: string[];
        response?: string;
      };

      const accepted = Array.isArray(info.accepted) ? info.accepted.length : 0;
      if (accepted === 0) {
        this.logger.error(
          `SMTP n’a accepté aucun destinataire pour ${to} (rejected=${JSON.stringify(info.rejected)} response=${info.response})`,
        );
        throw new ServiceUnavailableException(MAIL_ERROR.SEND_FAILED);
      }

      this.logger.log(`Email transmis à ${to} (messageId=${info.messageId ?? 'n/a'})`);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof ServiceUnavailableException) {
        throw error;
      }
      this.logger.error(
        `Échec d’envoi SMTP vers ${to} : ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : error,
      );
      throw toMailHttpException(error);
    }
  }

  async sendMail(options: { to: string; subject: string; html: string }): Promise<void> {
    await this.sendEmail(options);
  }

  async sendAdmissionConfirmationEmail(
    email: string,
    nom: string,
    prenom: string,
    formation: string,
    reference: string,
    details: Pick<AdmissionConfirmationData, 'niveau' | 'mention' | 'parcours' | 'bacCategorie'>,
  ): Promise<void> {
    const data: AdmissionConfirmationData = {
      nom,
      prenom,
      formation,
      reference,
      ...details,
      date: new Date().toLocaleDateString('fr-FR'),
      siteUrl: this.appUrl,
    };

    await this.sendEmail({
      to: email,
      subject: 'Accusé de réception - Candidature ESSG',
      html: renderAdmissionConfirmationTemplate(data),
    });
  }

  async sendAdmissionStatusEmail(
    email: string,
    data: Omit<AdmissionNotificationData, 'email' | 'siteUrl'>,
  ): Promise<void> {
    const subjectByStatus: Record<AdmissionStatus, string> = {
      [AdmissionStatus.ACCEPTE]: 'Confirmation de votre admission — ESSG',
      [AdmissionStatus.REFUSE]: 'Décision concernant votre candidature — ESSG',
      [AdmissionStatus.EN_COURS_ETUDE]: 'Votre dossier est en cours d’étude — ESSG',
      [AdmissionStatus.EN_ATTENTE]: 'Votre dossier est en attente — ESSG',
    };

    const notificationData: AdmissionNotificationData = {
      ...data,
      email,
      siteUrl: this.appUrl,
    };

    await this.sendEmail({
      to: email,
      subject: subjectByStatus[data.statut],
      html: renderAdmissionStatusTemplate(notificationData),
    });
  }

  async sendWelcomeEmail(
    email: string,
    nom: string,
    prenom: string,
    motDePasse: string,
  ): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Bienvenue sur ESSG - Votre compte a été créé',
      html: renderWelcomeTemplate({
        nom,
        prenom,
        email,
        motDePasse,
        siteUrl: this.appUrl,
      }),
    });
  }

  async sendMessageReceiptEmail(email: string, data: MessageReceiptTemplateData): Promise<void> {
    await this.sendEmail({
      to: email,
      subject: 'Accusé de réception - ESSG',
      html: renderMessageReceiptTemplate({
        ...data,
        siteUrl: this.appUrl,
      }),
    });
  }

  async sendAdminsContactNotification(
    data: Omit<AdminContactNotificationData, 'backOfficeUrl'>,
  ): Promise<void> {
    await this.notifyAdmins({
      subject: 'Nouveau message de contact — ESSG',
      html: renderAdminContactNotificationTemplate({
        ...data,
        backOfficeUrl: this.backOfficeUrl,
      }),
    });
  }

  async sendAdminsAdmissionNotification(
    data: Omit<AdminAdmissionNotificationData, 'backOfficeUrl'>,
  ): Promise<void> {
    await this.notifyAdmins({
      subject: 'Nouvelle candidature reçue — ESSG',
      html: renderAdminAdmissionNotificationTemplate({
        ...data,
        backOfficeUrl: this.backOfficeUrl,
      }),
    });
  }

  async sendMessageReplyEmail(options: {
    to: string;
    prenom: string;
    nom: string;
    sujet: string;
    message: string;
  }): Promise<void> {
    await this.sendEmail({
      to: options.to,
      subject: options.sujet,
      html: renderMessageReplyTemplate({
        prenom: options.prenom,
        nom: options.nom,
        sujet: options.sujet,
        message: options.message,
        siteUrl: this.appUrl,
      }),
    });
  }

  private async notifyAdmins(options: {
    subject: string;
    html: string;
    text?: string;
  }): Promise<void> {
    if (this.adminNotifyEmails.length === 0) {
      this.logger.warn(
        'Aucun destinataire administrateur configuré (ADMIN_NOTIFY_EMAILS) — notification ignorée',
      );
      return;
    }

    let sent = 0;
    for (const to of this.adminNotifyEmails) {
      try {
        await this.sendEmail({
          to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });
        sent += 1;
      } catch (error) {
        this.logger.error(
          `Échec de la notification administrateur vers ${to}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    if (sent === 0) {
      throw new ServiceUnavailableException(MAIL_ERROR.SEND_FAILED);
    }
  }

  private readString(key: string, fallback: string): string {
    const value = this.configService.get<string>(key, fallback);
    return typeof value === 'string' ? value : fallback;
  }

  private readNumber(key: string, fallback: number): number {
    const raw = this.configService.get<string | number>(key, fallback);
    const parsed = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private readBoolean(key: string, fallback: boolean): boolean {
    const raw = this.configService.get<string | boolean>(key);
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') {
      const normalized = raw.trim().toLowerCase();
      if (['true', '1', 'yes'].includes(normalized)) return true;
      if (['false', '0', 'no'].includes(normalized)) return false;
    }
    return fallback;
  }
}
