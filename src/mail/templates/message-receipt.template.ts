import { escapeHtml } from '../mail.errors';
import { renderBaseTemplate, BaseTemplateData } from './base.template';

export interface MessageReceiptTemplateData {
  nom: string;
  prenom: string;
  sujet: string;
  siteUrl?: string;
}

export function renderMessageReceiptTemplate(data: MessageReceiptTemplateData): string {
  const nom = escapeHtml(data.nom);
  const prenom = escapeHtml(data.prenom);
  const sujet = escapeHtml(data.sujet);

  const content = `
    <p>Bonjour <strong>${nom} ${prenom}</strong>,</p>
    <p>Nous accusons bonne réception de votre message intitulé «&nbsp;<strong>${sujet}</strong>&nbsp;» et nous vous remercions de nous avoir contactés.</p>
    <p>Votre demande a été transmise au service concerné. Notre équipe mettra tout en œuvre pour vous répondre dans les meilleurs délais.</p>
    <p>Pour toute information complémentaire, notre secrétariat reste à votre entière disposition.</p>
    ${data.siteUrl ? `<p style="text-align:center;margin:22px 0;"><a href="${data.siteUrl}" class="button">Visiter notre site &rarr;</a></p>` : ''}
    <p>Nous vous remercions de l’intérêt que vous portez à notre établissement.</p>
    <p class="signature">Cordialement,<br><span class="sign-name">L’équipe ESSG</span><br>École Supérieure de Sciences Géomatiques<br>Université de Fianarantsoa</p>
  `;

  const templateData: BaseTemplateData = {
    title: 'Accusé de réception',
    subtitle: 'Nous avons bien reçu votre message',
    content,
    preheader: `Accusé de réception de votre message « ${data.sujet} »`,
    siteUrl: data.siteUrl,
  };

  return renderBaseTemplate(templateData);
}
