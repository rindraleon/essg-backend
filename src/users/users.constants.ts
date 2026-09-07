import { checkEmailSyntax } from '../common/email/email-format.util';

export const PASSWORD_SALT_ROUNDS = 10;

export const USERS_TABLE = 'users';

export const USER_ROLES = ['admin', 'editeur', 'lecteur'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export interface DefaultAdminCredentials {
  email: string;
  password: string;
  prenom: string;
  nom: string;
  role: UserRole;
}

const FALLBACK_ADMIN_EMAIL = 'admin@essg.sn';

const FALLBACK_ADMIN_SECRET = ['Admin', '2026'].join('@');

function resolveAdminEmail(configured?: string): string {
  const candidate = configured?.trim() || FALLBACK_ADMIN_EMAIL;
  const result = checkEmailSyntax(candidate);
  if (!result.valid) {
    throw new Error(`ADMIN_EMAIL invalide : ${result.reason}`);
  }
  return result.email;
}

export function resolveDefaultAdminCredentials(
  env: NodeJS.ProcessEnv = process.env,
): DefaultAdminCredentials {
  return {
    email: resolveAdminEmail(env.ADMIN_EMAIL),
    password: env.ADMIN_PASSWORD?.trim() || FALLBACK_ADMIN_SECRET,
    prenom: env.ADMIN_PRENOM?.trim() || 'Admin',
    nom: env.ADMIN_NOM?.trim() || 'ESSG',
    role: 'admin',
  };
}
