import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as dns } from 'node:dns';

export type EmailDomainStatus =
  | 'valid'
  | 'no_mx'
  | 'disposable'
  | 'unreachable';

export interface EmailDomainResult {
  status: EmailDomainStatus;
  domain: string;
  reason: string | null;
}

const DISPOSABLE_DOMAINS = new Set([
  'yopmail.com',
  'yopmail.fr',
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.info',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'throwawaymail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'maildrop.cc',
  'fakeinbox.com',
  'dispostable.com',
  'jetable.org',
]);

const DEFAULT_TRUSTED_DOMAINS = ['essg.mg', 'essg.sn'];
const CACHE_TTL_MS = 60 * 60 * 1000;
const DNS_TIMEOUT_MS = 3000;

interface CacheEntry {
  status: EmailDomainStatus;
  expiresAt: number;
}

@Injectable()
export class EmailDomainService {
  private readonly logger = new Logger(EmailDomainService.name);
  private readonly trustedDomains: Set<string>;

  constructor(private readonly configService?: ConfigService) {
    const configured = this.configService?.get<string>('EMAIL_TRUSTED_DOMAINS') ?? '';
    this.trustedDomains = new Set(
      [...DEFAULT_TRUSTED_DOMAINS, ...configured.split(',')]
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  private readonly cache = new Map<string, CacheEntry>();
  private extractDomain(email: string): string | null {
    const parts = email.trim().toLowerCase().split('@');
    return parts.length === 2 && parts[1] ? parts[1] : null;
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('DNS_TIMEOUT')), DNS_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async resolveDomain(domain: string): Promise<EmailDomainStatus> {
    try {
      const records = await this.withTimeout(dns.resolveMx(domain));
      if (records.some((record) => record.exchange && record.exchange !== '.')) {
        return 'valid';
      }
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOTFOUND' || code === 'NXDOMAIN') {
        return 'no_mx';
      }
      // ENODATA : le domaine existe mais n'a pas de MX → on tente A/AAAA.
      if (code !== 'ENODATA') {
        this.logger.warn(`Résolution MX impossible pour « ${domain} » : ${code ?? 'inconnu'}`);
        return 'unreachable';
      }
    }

    try {
      const addresses = await this.withTimeout(dns.resolve(domain));
      return addresses.length > 0 ? 'valid' : 'no_mx';
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'ENOTFOUND' || code === 'NXDOMAIN' || code === 'ENODATA') {
        return 'no_mx';
      }
      return 'unreachable';
    }
  }

  async check(email: string): Promise<EmailDomainResult> {
    const domain = this.extractDomain(email);

    if (!domain) {
      return { status: 'no_mx', domain: '', reason: 'Adresse email invalide.' };
    }

    // Domaine de confiance : accepté sans interroger le DNS.
    if (this.trustedDomains.has(domain)) {
      return { status: 'valid', domain, reason: null };
    }

    if (DISPOSABLE_DOMAINS.has(domain)) {
      return {
        status: 'disposable',
        domain,
        reason:
          "Les adresses email temporaires ne sont pas acceptées. Utilisez une adresse permanente.",
      };
    }

    const cached = this.cache.get(domain);
    if (cached && cached.expiresAt > Date.now()) {
      return { status: cached.status, domain, reason: this.reasonFor(cached.status, domain) };
    }

    const status = await this.resolveDomain(domain);

    // Un échec réseau n'est pas mis en cache : le domaine peut être valide.
    if (status !== 'unreachable') {
      this.cache.set(domain, { status, expiresAt: Date.now() + CACHE_TTL_MS });
    }

    return { status, domain, reason: this.reasonFor(status, domain) };
  }

  /** Message utilisateur associé à un statut. */
  private reasonFor(status: EmailDomainStatus, domain: string): string | null {
    switch (status) {
      case 'no_mx':
        return `Le domaine « ${domain} » ne peut pas recevoir d'emails. Vérifiez l'orthographe de l'adresse.`;
      case 'disposable':
        return "Les adresses email temporaires ne sont pas acceptées. Utilisez une adresse permanente.";
      default:
        return null;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}
