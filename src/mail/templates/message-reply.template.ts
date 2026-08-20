import { escapeHtml } from '../mail.errors';
import { renderBaseTemplate, BaseTemplateData } from './base.template';

export interface MessageReplyTemplateData {
  prenom: string;
  nom: string;
  sujet: string;
  message: string;
  siteUrl?: string;
}

export function renderMessageReplyTemplate(data: MessageReplyTemplateData): string {
  const content = `
    <p>Bonjour <strong>${escapeHtml(data.prenom)} ${escapeHtml(data.nom)}</strong>,</p>
    <p>Nous revenons vers vous concernant votre message : <strong>${escapeHtml(data.sujet)}</strong>.</p>
    <div class="info-box">
      <div class="message-block">${escapeHtml(data.message)}</div>
    </div>
    <p>Nous restons à votre disposition pour toute information complémentaire.</p>
    <p>Cordialement,<br>L’équipe ESSG<br>École Supérieure de Sciences Géomatiques</p>
  `;

  const templateData: BaseTemplateData = {
    title: 'Réponse à votre message',
    subtitle: 'ESSG — Service des admissions et de l’accueil',
    content,
    preheader: `Réponse ESSG : ${data.sujet}`,
    siteUrl: data.siteUrl,
  };

  return renderBaseTemplate(templateData);
}
