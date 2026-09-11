import { renderBaseTemplate } from './base.template';

export interface PasswordResetTemplateData {
  prenom: string;
  nom: string;
  resetUrl: string;
  expiresMinutes: number;
  siteUrl: string;
  logoUrl?: string;
}

export function renderPasswordResetTemplate(data: PasswordResetTemplateData): string {
  const { prenom, nom, resetUrl, expiresMinutes, siteUrl, logoUrl } = data;

  const content = `
    <p>Bonjour <strong>${prenom} ${nom}</strong>,</p>
    <p>Une demande de réinitialisation du mot de passe de votre compte <strong>ESSG Admin</strong> a été effectuée. Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
    <p style="text-align:center; margin: 26px 0;">
      <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
    </p>
    <p>Ce lien est valable <strong>${expiresMinutes} minutes</strong> et ne peut être utilisé qu'une seule fois.</p>
    <p>Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
    <p style="word-break: break-all; font-family: 'Courier New', monospace; font-size: 13px; color: #2e6a5f;">${resetUrl}</p>
    <div class="warning">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité : votre mot de passe reste inchangé.</div>
    <div class="signature">
      <p>Cordialement,</p>
      <p class="sign-name">L'équipe ESSG Admin</p>
      <p><a href="${siteUrl}" style="color:#2e6a5f;">École Supérieure des Sciences Géomatiques</a></p>
    </div>
  `;

  return renderBaseTemplate({
    title: 'Réinitialisation de votre mot de passe',
    subtitle: 'ESSG Admin — Espace d’administration',
    preheader: 'Réinitialisation de votre mot de passe ESSG Admin',
    content,
    siteUrl,
    logoUrl,
  });
}
