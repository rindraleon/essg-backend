import disposableList from 'disposable-email-domains';
import wildcardList from 'disposable-email-domains/wildcard.json';
import { DisposableDomainSource, registerDisposableDomainSource } from './email-format.util';

const EXACT_DOMAINS: ReadonlySet<string> = new Set<string>(
  disposableList.map((domain) => domain.toLowerCase()),
);

const WILDCARD_DOMAINS: readonly string[] = wildcardList.map((domain) => domain.toLowerCase());

export const npmDisposableDomainSource: DisposableDomainSource = {
  isExactMatch: (domain) => EXACT_DOMAINS.has(domain),
  isWildcardMatch: (domain) =>
    WILDCARD_DOMAINS.some((suffix) => domain === suffix || domain.endsWith(`.${suffix}`)),
};

export function getDisposableDomainCount(): number {
  return EXACT_DOMAINS.size;
}

export function installNpmDisposableDomains(): void {
  registerDisposableDomainSource(npmDisposableDomainSource);
}
