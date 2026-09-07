import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as dns } from 'node:dns';
import { createConnection, type Socket } from 'node:net';
import { TRUSTED_EMAIL_DOMAINS } from './disposable-domains.constant';
import {
  EMAIL_ERROR_MESSAGES,
  checkEmailSyntax,
  getEmailDomain,
  isDisposableEmail,
  isValidEmail,
  normalizeEmail,
} from './email-format.util';
import { installNpmDisposableDomains } from './disposable-domains.provider';

export type EmailCheckStatus =
  | 'valid'
  | 'invalid_syntax'
  | 'disposable'
  | 'domain_not_found'
  | 'no_mx'
  | 'mailbox_not_found'
  | 'unknown';

export interface EmailValidationOptions {
  probeMailbox?: boolean;
}

export interface EmailValidationResult {
  valid: boolean;
  status: EmailCheckStatus;
  email: string;
  domain: string;
  reason: string | null;

  degraded: boolean;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000;
const DNS_TIMEOUT_MS = 3000;
const SMTP_TIMEOUT_MS = 5000;
const SMTP_PORT = 25;

interface DomainCacheEntry {
  status: EmailCheckStatus;
  mxHost: string | null;
  expiresAt: number;
}

installNpmDisposableDomains();

@Injectable()
export class EmailValidationService {
  private readonly logger = new Logger(EmailValidationService.name);
  private readonly trustedDomains: Set<string>;
  private readonly smtpProbeEnabled: boolean;
  private readonly smtpProbeSender: string;
  private readonly domainCache = new Map<string, DomainCacheEntry>();
  private readonly mailboxCache = new Map<
    string,
    { status: EmailCheckStatus; expiresAt: number }
  >();

  constructor(private readonly configService?: ConfigService) {
    const configured = this.configService?.get<string>('EMAIL_TRUSTED_DOMAINS') ?? '';
    this.trustedDomains = new Set(
      [...TRUSTED_EMAIL_DOMAINS, ...configured.split(',')]
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    );

    this.smtpProbeEnabled = this.configService?.get<string>('EMAIL_SMTP_PROBE') === 'true';
    this.smtpProbeSender =
      this.configService?.get<string>('EMAIL_SMTP_PROBE_SENDER') ?? 'noreply@essg.mg';
  }

  async validate(
    email: unknown,
    options: EmailValidationOptions = {},
  ): Promise<EmailValidationResult> {
    const syntax = checkEmailSyntax(email);
    if (!syntax.valid) {
      const status: EmailCheckStatus =
        syntax.reason === EMAIL_ERROR_MESSAGES.disposable ? 'disposable' : 'invalid_syntax';
      return {
        valid: false,
        status,
        email: syntax.email,
        domain: getEmailDomain(syntax.email) ?? '',
        reason: syntax.reason,
        degraded: false,
      };
    }

    const normalized = syntax.email;
    const domain = getEmailDomain(normalized) as string;

    if (this.trustedDomains.has(domain)) {
      return this.result(true, 'valid', normalized, domain, false);
    }

    const domainCheck = await this.resolveDomainStatus(domain);
    if (domainCheck.status === 'domain_not_found' || domainCheck.status === 'no_mx') {
      return this.result(false, domainCheck.status, normalized, domain, false);
    }
    if (domainCheck.status === 'unknown') {
      return this.result(true, 'unknown', normalized, domain, true);
    }

    const probeMailbox = options.probeMailbox ?? this.smtpProbeEnabled;
    if (!probeMailbox || !domainCheck.mxHost) {
      return this.result(true, 'valid', normalized, domain, false);
    }

    const mailboxStatus = await this.probeMailbox(normalized, domainCheck.mxHost);
    if (mailboxStatus === 'mailbox_not_found') {
      return this.result(false, 'mailbox_not_found', normalized, domain, false);
    }
    if (mailboxStatus === 'unknown') {
      return this.result(true, 'unknown', normalized, domain, true);
    }
    return this.result(true, 'valid', normalized, domain, false);
  }

  async isDeliverableEmail(email: string, options: EmailValidationOptions = {}): Promise<boolean> {
    return (await this.validate(email, options)).valid;
  }

  isValidEmail(email: string): boolean {
    return isValidEmail(email);
  }

  isDisposableEmail(email: string): boolean {
    return isDisposableEmail(email);
  }

  normalize(email: unknown): string {
    return normalizeEmail(email);
  }

  clearCache(): void {
    this.domainCache.clear();
    this.mailboxCache.clear();
  }

  private result(
    valid: boolean,
    status: EmailCheckStatus,
    email: string,
    domain: string,
    degraded: boolean,
  ): EmailValidationResult {
    return { valid, status, email, domain, reason: this.reasonFor(status, domain), degraded };
  }

  private reasonFor(status: EmailCheckStatus, domain: string): string | null {
    switch (status) {
      case 'invalid_syntax':
        return EMAIL_ERROR_MESSAGES.invalid;
      case 'disposable':
        return EMAIL_ERROR_MESSAGES.disposable;
      case 'domain_not_found':
        return `Le domaine « ${domain} » n'existe pas. Vérifiez l'orthographe de l'adresse.`;
      case 'no_mx':
        return `Le domaine « ${domain} » n'accepte pas les e-mails.`;
      case 'mailbox_not_found':
        return EMAIL_ERROR_MESSAGES.undeliverable;
      default:
        return null;
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('TIMEOUT')), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async resolveDomainStatus(
    domain: string,
  ): Promise<{ status: EmailCheckStatus; mxHost: string | null }> {
    const cached = this.domainCache.get(domain);
    if (cached && cached.expiresAt > Date.now()) {
      return { status: cached.status, mxHost: cached.mxHost };
    }

    const resolved = await this.lookupDomain(domain);
    if (resolved.status !== 'unknown') {
      const ttl = resolved.status === 'valid' ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS;
      this.domainCache.set(domain, { ...resolved, expiresAt: Date.now() + ttl });
    }
    return resolved;
  }

  private async lookupDomain(
    domain: string,
  ): Promise<{ status: EmailCheckStatus; mxHost: string | null }> {
    try {
      const records = await this.withTimeout(dns.resolveMx(domain), DNS_TIMEOUT_MS);
      const usable = records
        .filter((record) => record.exchange && record.exchange !== '.')
        .sort((a, b) => a.priority - b.priority);
      if (usable.length > 0) {
        return { status: 'valid', mxHost: usable[0].exchange };
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOTFOUND' || code === 'NXDOMAIN') {
        return { status: 'domain_not_found', mxHost: null };
      }
      if (code !== 'ENODATA') {
        this.logger.warn(`Résolution MX indisponible pour « ${domain} » : ${code ?? 'timeout'}`);
        return { status: 'unknown', mxHost: null };
      }
    }

    try {
      const addresses = await this.withTimeout(dns.resolve(domain), DNS_TIMEOUT_MS);
      return addresses.length > 0
        ? { status: 'valid', mxHost: domain }
        : { status: 'no_mx', mxHost: null };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOTFOUND' || code === 'NXDOMAIN') {
        return { status: 'domain_not_found', mxHost: null };
      }
      if (code === 'ENODATA') {
        return { status: 'no_mx', mxHost: null };
      }
      return { status: 'unknown', mxHost: null };
    }
  }

  private async probeMailbox(email: string, mxHost: string): Promise<EmailCheckStatus> {
    const cached = this.mailboxCache.get(email);
    if (cached && cached.expiresAt > Date.now()) return cached.status;

    let status: EmailCheckStatus;
    try {
      status = await this.withTimeout(this.runSmtpDialog(email, mxHost), SMTP_TIMEOUT_MS + 1000);
    } catch {
      status = 'unknown';
    }

    if (status !== 'unknown') {
      const ttl = status === 'valid' ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS;
      this.mailboxCache.set(email, { status, expiresAt: Date.now() + ttl });
    }
    return status;
  }

  private runSmtpDialog(email: string, mxHost: string): Promise<EmailCheckStatus> {
    return new Promise<EmailCheckStatus>((resolve) => {
      const steps = [
        `EHLO ${this.smtpProbeSender.split('@')[1] ?? 'essg.mg'}`,
        `MAIL FROM:<${this.smtpProbeSender}>`,
        `RCPT TO:<${email}>`,
      ];
      let step = -1;
      let settled = false;
      const socket: Socket = createConnection({ host: mxHost, port: SMTP_PORT });
      socket.setTimeout(SMTP_TIMEOUT_MS);
      socket.setEncoding('utf8');

      const finish = (status: EmailCheckStatus) => {
        if (settled) return;
        settled = true;
        socket.destroy();
        resolve(status);
      };

      socket.on('data', (chunk: string) => {
        const code = Number(chunk.slice(0, 3));
        if (step < 0) {
          if (code !== 220) return finish('unknown');
        } else if (step === steps.length - 1) {
          if (code >= 200 && code < 300) return finish('valid');
          if (code >= 500 && code < 600) return finish('mailbox_not_found');
          return finish('unknown');
        } else if (code >= 400) {
          return finish('unknown');
        }

        step += 1;
        socket.write(`${steps[step]}\r\n`);
      });

      socket.on('timeout', () => finish('unknown'));
      socket.on('error', () => finish('unknown'));
      socket.on('close', () => finish('unknown'));
    });
  }
}
