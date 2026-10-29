import { checkEmailSyntax } from '../common/email/email-format.util';

export const PASSWORD_SALT_ROUNDS = 10;

export const USERS_TABLE = 'users';

export const USER_ROLES = ['admin', 'editeur', 'scolarite', 'lecteur'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const PERMISSIONS = {
  DASHBOARD_VIEW: 'dashboard.view',
  CONTENT_VIEW: 'content.view',
  CONTENT_CREATE: 'content.create',
  CONTENT_UPDATE: 'content.update',
  CONTENT_DELETE: 'content.delete',
  MEDIA_UPLOAD: 'media.upload',
  ADMISSION_VIEW: 'admission.view',
  ADMISSION_DOWNLOAD: 'admission.download',
  ADMISSION_MANAGE: 'admission.manage',
  ADMISSION_DELETE: 'admission.delete',
  CONTACT_VIEW: 'contact.view',
  CONTACT_MANAGE: 'contact.manage',
  CONTACT_DELETE: 'contact.delete',
  SETTINGS_ADMISSION: 'settings.admission',
  SETTINGS_NAVIGATION: 'settings.navigation',
  RESULTAT_VIEW: 'resultat.view',
  RESULTAT_CREATE: 'resultat.create',
  RESULTAT_UPDATE: 'resultat.update',
  RESULTAT_DELETE: 'resultat.delete',
  RESULTAT_PUBLISH: 'resultat.publish',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS: readonly Permission[] = Object.values(PERMISSIONS);

const EDITORIAL_PERMISSIONS: readonly Permission[] = [
  PERMISSIONS.DASHBOARD_VIEW,
  PERMISSIONS.CONTENT_VIEW,
  PERMISSIONS.CONTENT_CREATE,
  PERMISSIONS.CONTENT_UPDATE,
  PERMISSIONS.CONTENT_DELETE,
  PERMISSIONS.MEDIA_UPLOAD,
];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: ALL_PERMISSIONS,
  editeur: EDITORIAL_PERMISSIONS,
  scolarite: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ADMISSION_VIEW,
    PERMISSIONS.ADMISSION_DOWNLOAD,
    PERMISSIONS.CONTACT_VIEW,
    PERMISSIONS.CONTACT_MANAGE,
    PERMISSIONS.SETTINGS_ADMISSION,
    PERMISSIONS.SETTINGS_NAVIGATION,
    PERMISSIONS.RESULTAT_VIEW,
    PERMISSIONS.RESULTAT_CREATE,
    PERMISSIONS.RESULTAT_UPDATE,
    PERMISSIONS.RESULTAT_DELETE,
    PERMISSIONS.RESULTAT_PUBLISH,
  ],
  lecteur: [PERMISSIONS.DASHBOARD_VIEW, PERMISSIONS.CONTENT_VIEW],
};

export function permissionsForRole(role: string | null | undefined): readonly Permission[] {
  if (!role || !Object.hasOwn(ROLE_PERMISSIONS, role)) return [];
  return ROLE_PERMISSIONS[role as UserRole];
}

export function roleHasPermission(
  role: string | null | undefined,
  permission: Permission,
): boolean {
  return permissionsForRole(role).includes(permission);
}

export function rolesWithPermission(permission: Permission): UserRole[] {
  return USER_ROLES.filter((role) => ROLE_PERMISSIONS[role].includes(permission));
}

export interface DefaultAdminCredentials {
  email: string;
  password: string;
  prenom: string;
  nom: string;
  role: UserRole;
}

const FALLBACK_ADMIN_EMAIL = 'admin@essg.itdcmada.com';

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
