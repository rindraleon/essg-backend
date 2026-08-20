import { renderBaseTemplate, BaseTemplateData } from './base.template';

export interface MessageReceiptTemplateData {
  nom: string;
  prenom: string;
  sujet: string;
  siteUrl?: string;
}

export function renderMessageReceiptTemplate(data: MessageReceiptTemplateData): string {
  const content = `
    <p>Bonjour <strong>${data.nom} ${data.prenom}</strong>,</p>
    <p>Nous avons bien reçu votre message concernant : <strong>${data.sujet}</strong>.</p>
    <p>Notre équipe vous répondra dans les plus brefs délais.</p>
    <p>Cordialement,<br>L’équipe ESSG</p>
    ${data.siteUrl ? `<p><a href="${data.siteUrl}" class="button">Visiter notre site</a></p>` : ''}
  `;

  const templateData: BaseTemplateData = {
    title: 'Accusé de réception',
    subtitle: 'Nous avons bien reçu votre message',
    content,
    preheader: 'Accusé de réception de votre message',
    siteUrl: data.siteUrl,
  };

  return renderBaseTemplate(templateData);
}
