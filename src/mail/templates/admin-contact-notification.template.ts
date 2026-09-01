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

function infoRow(label: string, value: string): string {
  return `<div class="info-item"><span class="info-label">${escapeHtml(label)}</span><span class="info-value">${value}</span></div>`;
}

export function renderAdminContactNotificationTemplate(data: AdminContactNotificationData): string {
  const infoItems = [
    infoRow('Nom', `${escapeHtml(data.nom)} ${escapeHtml(data.prenom)}`),
    infoRow('Email', escapeHtml(data.email)),
    data.telephone ? infoRow('Téléphone', escapeHtml(data.telephone)) : '',
    infoRow('Objet', escapeHtml(data.sujet)),
    infoRow('Date d’envoi', escapeHtml(data.date)),
  ]
    .filter(Boolean)
    .join('');

  const content = `
    <p>Bonjour,</p>
    <p>Nous vous informons qu’un nouveau message a été envoyé depuis le <strong>formulaire de contact</strong> du site de l’ESSG. Vous trouverez ci-dessous les coordonnées de l’expéditeur ainsi que le contenu du message.</p>
    <p class="recap-title">Coordonnées de l’expéditeur</p>
    <div class="info-box">${infoItems}</div>
    <p><strong>Contenu du message :</strong></p>
    <div class="info-box">
      <div class="message-block">${escapeHtml(data.message)}</div>
    </div>
    <p>Le message est également conservé dans le back-office, où vous pourrez y répondre directement.</p>
    <p style="text-align:center;margin:22px 0;"><a href="${data.backOfficeUrl}" class="button">Ouvrir le back-office</a></p>
    <p class="signature">Cordialement,<br><span class="sign-name">Notification automatique</span><br>Plateforme ESSG</p>
  `;

  const templateData: BaseTemplateData = {
    title: 'Nouveau message de contact',
    subtitle: `${data.nom} ${data.prenom} vous a écrit`,
    content,
    preheader: `Nouveau message de ${data.nom} ${data.prenom}`,
    siteUrl: data.backOfficeUrl,
  };

  return renderBaseTemplate(templateData);
}
