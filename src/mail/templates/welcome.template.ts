import { renderBaseTemplate, BaseTemplateData } from './base.template';

export interface WelcomeTemplateData {
  nom: string;
  prenom: string;
  email: string;
  motDePasse: string;
  siteUrl: string;
}

export function renderWelcomeTemplate(data: WelcomeTemplateData): string {
  const content = `
    <p>Bonjour <strong>${data.nom} ${data.prenom}</strong>,</p>
    <p>Nous sommes ravis de vous accueillir sur la plateforme ESSG. Votre compte a été créé avec succès.</p>
    <div class="credentials">
      <h3 style="margin:0 0 12px;color:#1d4ed8;">Vos identifiants de connexion</h3>
      <div class="credential-row"><span class="info-label">Email :</span><span class="credential-value">${data.email}</span></div>
      <div class="credential-row"><span class="info-label">Mot de passe :</span><span class="credential-value">${data.motDePasse}</span></div>
    </div>
    <div class="warning"><strong>&#9888;&#65039; Important :</strong> pour des raisons de sécurité, nous vous recommandons de changer votre mot de passe lors de votre première connexion.</div>
    <p>Cliquez sur le bouton ci-dessous pour accéder à la plateforme :</p>
    <p><a href="${data.siteUrl}" class="button">Accéder à ESSG</a></p>
    <p>Si le bouton ne fonctionne pas, copiez et collez ce lien dans votre navigateur :<br><a href="${data.siteUrl}">${data.siteUrl}</a></p>
  `;

  const templateData: BaseTemplateData = {
    title: 'Bienvenue sur ESSG',
    subtitle: 'Votre compte a été créé avec succès',
    content,
    preheader: 'Bienvenue sur la plateforme ESSG',
    siteUrl: data.siteUrl,
  };

  return renderBaseTemplate(templateData);
}
