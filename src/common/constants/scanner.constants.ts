export const SCANNER_PROBE_PATTERNS: readonly RegExp[] = [
  // --- Fichiers de configuration / secrets exposés ---
  /(^|\/)\.env(\.|$)/,
  /(^|\/)\.git(\/|$)/,
  /(^|\/)\.gitignore$/,
  /(^|\/)\.gitmodules$/,
  /(^|\/)\.gitattributes$/,
  /(^|\/)\.svn(\/|$)/,
  /(^|\/)\.hg(\/|$)/,
  /(^|\/)\.bzr(\/|$)/,
  /(^|\/)\.aws(\/|$)/,
  /(^|\/)\.ssh(\/|$)/,
  /(^|\/)\.npmrc$/,
  /(^|\/)\.yarnrc$/,
  /(^|\/)\.htaccess$/,
  /(^|\/)\.htpasswd$/,
  /(^|\/)\.dockerignore$/,
  /(^|\/)\.travis\.yml$/,
  /(^|\/)docker-compose(\.[a-z0-9-]+)?\.ya?ml$/,
  /(^|\/)\.ds_store$/,
  /(^|\/)\.vscode(\/|$)/,
  /(^|\/)\.idea(\/|$)/,

  // --- Bruit navigateur / SEO (doit être servi par Nginx, pas par l'API) ---
  /^\/robots\.txt$/,
  /^\/favicon\.ico$/,
  /^\/sitemap\.xml$/,
  /^\/sitemap\.txt$/,
  /^\/ads\.txt$/,
  /^\/humans\.txt$/,
  /^\/security\.txt$/,
  /(^|\/)\.well-known(\/|$)/,
  /(^|\/)(license|readme)\.(txt|html?)$/,

  // --- Bruit frontend / monitoring mal configuré ---
  /\/api\/session\/properties/,
  /\/api\/session\/database/,
  /\/api\/session\/collection\/.*\/databases/,

  // --- Écosystème PHP / WordPress ---
  /(^|\/)wp-(admin|content|includes|json|login|config|cron|signup|activate)/,
  /(^|\/)wordpress(\/|$)/,
  /xmlrpc\.php/,
  /wlwmanifest\.xml/,
  /(^|\/)vendor(\/|$)/,
  /eval-stdin\.php/,
  /phpunit/,
  /(^|\/)(adminer|phpmyadmin|pma)(\/|$)/,

  // --- Manifestes de paquets ---
  /(^|\/)(package|package-lock|composer|composer-lock)\.json$/,
  /(^|\/)(composer|gemfile|yarn|pnpm-lock)\.lock$/,
  /(^|\/)pnpm-lock\.yaml$/,

  // --- Sondes d'autres stacks ---
  /(^|\/)(actuator|jolokia)(\/|$)/,
  /(^|\/)manager\/html$/,
  /(^|\/)solr(\/|$)/,
  /(^|\/)(jenkins|hudson)(\/|$)/,
  /(^|\/)elmah\.axd$/,
  /(^|\/)server-status$/,
  /(^|\/)cgi-bin(\/|$)/,
  /(^|\/)_profiler(\/|$)/,

  // --- Tentatives de traversée de répertoire ---
  /(\.\.\/|\.\.$|%2e%2e)/,
];

export const SCANNER_FILE_PROBE_PATTERNS: readonly RegExp[] = [
  /\.(php\d?|phtml|asp|aspx|jsp|jspx|cgi|pl|cfm)(\/|$)/,
  /\.(sql|bak|old|orig|save|swp|swo|ini|sln|csproj)(\/|$)/,
  /\.(zip|tar|gz|tgz|rar|7z|log|yml|yaml|conf|config)(\/|$)/,
];

export const FILE_SERVING_PREFIXES: readonly string[] = ['/media/'];

export function normalizeProbePath(rawUrl: string | null | undefined): string {
  if (!rawUrl) return '';
  const withoutQuery = rawUrl.split(/[?#]/, 1)[0] ?? '';
  let decoded = withoutQuery;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch (error: unknown) {
    decoded = withoutQuery;
  }
  return decoded.toLowerCase();
}

export function isScannerProbePath(rawUrl: string | null | undefined): boolean {
  const path = normalizeProbePath(rawUrl);
  if (!path) return false;
  if (SCANNER_PROBE_PATTERNS.some((p) => p.test(path))) return true;
  const isFileServingRoute = FILE_SERVING_PREFIXES.some((prefix) => path.startsWith(prefix));
  if (isFileServingRoute) return false;
  return SCANNER_FILE_PROBE_PATTERNS.some((p) => p.test(path));
}
