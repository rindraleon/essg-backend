import { renderBaseTemplate, BaseTemplateData } from '../base.template';

export interface AdmissionConfirmationData {
  nom: string;
  prenom: string;
  formation: string;
  reference: string;
  date: string;
  siteUrl?: string;
}

export function renderAdmissionConfirmationTemplate(data: AdmissionConfirmationData): string {
  const infoItems = [
    ['Référence du dossier', data.reference],
    ['Candidat(e)', ` ${data.nom} ${data.prenom}`],
    ['Formation souhaitée', data.formation],
    ['Date de dépôt', data.date],
    ['Statut', 'En attente d’étude'],
  ]
    .map(
      ([label, value]) =>
        `<div class="info-item"><span class="info-label"> ${label}</span><span class="info-value"> ${value}</span></div>`,
    )
    .join('');

  const content = `
    <p>Bonjour <strong> ${data.nom} ${data.prenom} </strong>,</p>
    <p>Nous vous confirmons la bonne réception de votre dossier de candidature pour la formation <strong> ${data.formation}</strong>.</p>
    <div class="info-box"> ${infoItems}</div>
    <p>Notre commission pédagogique va étudier votre dossier. Vous recevrez un email vous informant de la décision.</p>
     ${data.siteUrl ? `<p><a href=" ${data.siteUrl}" class="button">Visiter notre site</a></p>` : ''}
  `;

  const templateData: BaseTemplateData = {
    title: 'Accusé de réception',
    subtitle: 'Votre candidature a bien été enregistrée',
    content,
    preheader: `Dossier ${data.reference} enregistré`,
    siteUrl: data.siteUrl,
  };

  return renderBaseTemplate(templateData);
}
