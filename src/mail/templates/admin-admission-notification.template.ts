import { renderBaseTemplate, BaseTemplateData } from './base.template';
import { escapeHtml } from '../mail.errors';

export interface AdminAdmissionNotificationData {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  niveau: string;
  formation: string;
  numeroBaccalaureat?: string;
  numeroBordereau?: string;
  reference: string;
  date: string;
  fileCount: number;
  backOfficeUrl: string;
}

export function renderAdminAdmissionNotificationTemplate(
  data: AdminAdmissionNotificationData,
): string {
  const content = `
    <p>Une <strong>nouvelle candidature</strong> vient d'être soumise sur le site.</p>
    <div class="info-box">
      <div class="info-item">
        <span class="info-label">Référence: </span>
        <span class="info-value">${escapeHtml(data.reference)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Candidat: </span>
        <span class="info-value">${escapeHtml(data.nom)} ${escapeHtml(data.prenom)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Email</span>
        <span class="info-value">${escapeHtml(data.email)}</span>
      </div>
      ${data.telephone ? `<div class="info-item"><span class="info-label">Téléphone</span><span class="info-value">${escapeHtml(data.telephone)}</span></div>` : ''}
      <div class="info-item">
        <span class="info-label">Niveau</span>
        <span class="info-value">${escapeHtml(data.niveau)}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Formation</span>
        <span class="info-value">${escapeHtml(data.formation)}</span>
      </div>
      ${data.numeroBaccalaureat ? `<div class="info-item"><span class="info-label">N° baccalauréat</span><span class="info-value">${escapeHtml(data.numeroBaccalaureat)}</span></div>` : ''}
      ${data.numeroBordereau ? `<div class="info-item"><span class="info-label">N° bordereau</span><span class="info-value">${escapeHtml(data.numeroBordereau)}</span></div>` : ''}
      <div class="info-item">
        <span class="info-label">Pièces jointes</span>
        <span class="info-value">${data.fileCount}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Date</span>
        <span class="info-value">${escapeHtml(data.date)}</span>
      </div>
    </div>
    <p>Le dossier complet (informations et pièces justificatives) est disponible dans le back-office.</p>
    <p><a href="${data.backOfficeUrl}" class="button">Ouvrir le back-office</a></p>
  `;

  const templateData: BaseTemplateData = {
    title: 'Nouvelle candidature reçue',
    subtitle: `${data.nom} ${data.prenom} — ${data.formation}`,
    content,
    preheader: `Nouvelle candidature ${data.reference}`,
    siteUrl: data.backOfficeUrl,
  };

  return renderBaseTemplate(templateData);
}
