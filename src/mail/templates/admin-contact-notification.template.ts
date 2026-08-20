import { renderBaseTemplate, BaseTemplateData } from './base.template';
import { escapeHtml } from '../mail.errors';

export interface AdminContactNotificationData {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  sujet: string;
  message: string;
  date: string;
  backOfficeUrl: string;
}

export function renderAdminContactNotificationTemplate(data: AdminContactNotificationData): string {
  const content = `
    <p>Un nouveau message a été envoyé depuis le <strong>formulaire de contact</strong> du site.</p>
    <div class="info-box">
      <div class="info-item">
        <span class="info-label">Nom :</span>
        <span class="info-value"> ${escapeHtml(data.nom)} ${escapeHtml(data.prenom)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Email</span>
        <span class="info-value">${escapeHtml(data.email)}</span>
      </div>
      ${data.telephone ? `<div class="info-item"><span class="info-label">Téléphone</span><span class="info-value">${escapeHtml(data.telephone)}</span></div>` : ''}
      <div class="info-item">
        <span class="info-label">Objet</span>
        <span class="info-value">${escapeHtml(data.sujet)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Date</span>
        <span class="info-value">${escapeHtml(data.date)}</span>
      </div>
    </div>
    <p><strong>Message :</strong></p>
    <p style="white-space: pre-line;">${escapeHtml(data.message)}</p>
    <p>Le message est également conservé dans le back-office, où vous pourrez y répondre.</p>
    <p><a href="${data.backOfficeUrl}" class="button">Ouvrir le back-office</a></p>
  `;

  const templateData: BaseTemplateData = {
    title: 'Nouveau message de contact',
    subtitle: `${data.prenom} ${data.nom} vous a écrit`,
    content,
    preheader: `Nouveau message de ${data.prenom} ${data.nom}`,
    siteUrl: data.backOfficeUrl,
  };

  return renderBaseTemplate(templateData);
}
