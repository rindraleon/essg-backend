import { escapeHtml } from '../mail.errors';
import { renderBaseTemplate, BaseTemplateData } from './base.template';

export interface WelcomeTemplateData {
  nom: string;
  prenom: string;
  email: string;
  motDePasse: string;
  siteUrl: string;
}

export function renderWelcomeTemplate(data: WelcomeTemplateData): string {
  const nom = escapeHtml(data.nom);
  const prenom = escapeHtml(data.prenom);

  const content = `
    <p>Bonjour <strong>${nom} ${prenom}</strong>,</p>
    <p>Nous avons le plaisir de vous informer que votre compte d’accès à la plateforme ESSG a été créé avec succès.</p>
    <p>Vous trouverez ci-dessous vos identifiants de connexion, à conserver précieusement&nbsp;:</p>
    <div class="credentials">
      <h3>Vos identifiants de connexion</h3>
      <div class="credential-row"><span class="info-label">Email</span><span class="credential-value">${escapeHtml(data.email)}</span></div>
      <div class="credential-row"><span class="info-label">Mot de passe</span><span class="credential-value">${escapeHtml(data.motDePasse)}</span></div>
    </div>
    <div class="warning"><strong>Important :</strong> pour des raisons de sécurité, nous vous recommandons vivement de modifier votre mot de passe dès votre première connexion.</div>
    <p>Nous vous invitons à accéder à la plateforme à l’aide du bouton ci-dessous&nbsp;:</p>
    <p style="text-align:center;margin:22px 0;"><a href="${data.siteUrl}" class="button">Accéder à la plateforme ESSG</a></p>
    <p>Nous vous souhaitons la bienvenue et restons à votre entière disposition pour toute assistance.</p>
    <p class="signature">Cordialement,<br><span class="sign-name">L’équipe ESSG</span><br>École Supérieure de Sciences Géomatiques<br>Université de Fianarantsoa</p>
  `;

  const templateData: BaseTemplateData = {
    title: 'Bienvenue sur la plateforme ESSG',
    subtitle: 'Votre compte a été créé avec succès',
    content,
    preheader: 'Vos identifiants de connexion à la plateforme ESSG',
    siteUrl: data.siteUrl,
  };

  return renderBaseTemplate(templateData);
}
