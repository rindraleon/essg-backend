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
  const nom = escapeHtml(data.nom);
  const prenom = escapeHtml(data.prenom);
  const sujet = escapeHtml(data.sujet);

  const content = `
    <p>Bonjour <strong>${nom} ${prenom}</strong>,</p>
    <p>Nous faisons suite à votre message intitulé «&nbsp;<strong>${sujet}</strong>&nbsp;» et nous vous remercions de l’intérêt que vous portez à l’ESSG.</p>
    <p>Vous trouverez ci-dessous la réponse apportée par notre équipe&nbsp;:</p>
    <div class="info-box">
      <div class="message-block">${escapeHtml(data.message)}</div>
    </div>
    <p>Nous restons à votre entière disposition pour tout complément d’information.</p>
    <p class="signature">Cordialement,<br><span class="sign-name">L’équipe ESSG</span><br>École Supérieure de Sciences Géomatiques<br>Université de Fianarantsoa</p>
  `;

  const templateData: BaseTemplateData = {
    title: 'Réponse à votre message',
    subtitle: 'ESSG — Service des admissions et de l’accueil',
    content,
    preheader: `Réponse de l’ESSG à votre message « ${data.sujet} »`,
    siteUrl: data.siteUrl,
  };

  return renderBaseTemplate(templateData);
}
