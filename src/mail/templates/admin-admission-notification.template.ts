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

function infoRow(label: string, value: string): string {
  return `<div class="info-item"><span class="info-label">${escapeHtml(label)}</span><span class="info-value">${value}</span></div>`;
}

export function renderAdminAdmissionNotificationTemplate(
  data: AdminAdmissionNotificationData,
): string {
  const infoItems = [
    infoRow('Référence du dossier', escapeHtml(data.reference)),
    infoRow('Candidat(e)', `${escapeHtml(data.nom)} ${escapeHtml(data.prenom)}`),
    infoRow('Email', escapeHtml(data.email)),
    data.telephone ? infoRow('Téléphone', escapeHtml(data.telephone)) : '',
    infoRow('Niveau', escapeHtml(data.niveau)),
    infoRow('Formation', escapeHtml(data.formation)),
    data.numeroBaccalaureat ? infoRow('N° baccalauréat', escapeHtml(data.numeroBaccalaureat)) : '',
    data.numeroBordereau ? infoRow('N° bordereau', escapeHtml(data.numeroBordereau)) : '',
    infoRow('Pièces jointes', String(data.fileCount)),
    infoRow('Date de dépôt', escapeHtml(data.date)),
  ]
    .filter(Boolean)
    .join('');

  const content = `
    <p>Bonjour,</p>
    <p>Nous vous informons qu’une <strong>nouvelle candidature</strong> vient d’être déposée sur le site de l’ESSG. Vous trouverez ci-dessous les informations relatives au dossier&nbsp;:</p>
    <p class="recap-title">Détails de la candidature</p>
    <div class="info-box">${infoItems}</div>
    <p>Le dossier complet, comprenant les informations déclarées ainsi que les pièces justificatives, est consultable dans le back-office afin de procéder à son étude.</p>
    <p style="text-align:center;margin:22px 0;"><a href="${data.backOfficeUrl}" class="button">Ouvrir le back-office</a></p>
    <p class="signature">Cordialement,<br><span class="sign-name">Notification automatique</span><br>Plateforme ESSG</p>
  `;

  const templateData: BaseTemplateData = {
    title: 'Nouvelle candidature reçue',
    subtitle: `${data.nom} ${data.prenom} — ${data.formation}`,
    content,
    preheader: `Nouvelle candidature ${data.reference} à traiter`,
    siteUrl: data.backOfficeUrl,
  };

  return renderBaseTemplate(templateData);
}
