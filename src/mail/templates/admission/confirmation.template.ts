import { escapeHtml } from '../../mail.errors';
import { renderBaseTemplate, BaseTemplateData } from '../base.template';

export interface AdmissionConfirmationData {
  nom: string;
  prenom: string;
  formation: string;
  reference: string;
  niveau?: string;
  mention?: string;
  parcours?: string;
  bacCategorie?: string;
  date: string;
  siteUrl?: string;
}

export function renderAdmissionConfirmationTemplate(data: AdmissionConfirmationData): string {
  const nom = escapeHtml(data.nom);
  const prenom = escapeHtml(data.prenom);
  const formation = escapeHtml(data.formation || data.parcours || '—');

  const infoItems = [
    ['Référence du dossier', escapeHtml(data.reference)],
    ['Candidat(e)', `${nom} ${prenom}`],
    ['Niveau', escapeHtml(data.niveau ?? '—')],
    ['Mention', escapeHtml(data.mention ?? '—')],
    ['Parcours', formation],
    ['Catégorie du Bac', escapeHtml(data.bacCategorie?.toLocaleUpperCase('fr-FR') ?? '—')],
    ['Date de dépôt', escapeHtml(data.date)],
    ['Statut', 'En attente d’étude'],
  ]
    .map(
      ([label, value]) =>
        `<div class="info-item"><span class="info-label">${label}</span><span class="info-value">${value}</span></div>`,
    )
    .join('');

  const content = `
    <p>Bonjour <strong>${nom} ${prenom}</strong>,</p>
    <p>Nous vous confirmons la bonne réception de votre dossier de candidature pour la formation <strong>${formation}</strong>. Votre dossier a été enregistré avec succès et sera traité par nos services dans les meilleurs délais.</p>
    <p>Vous trouverez ci-dessous un récapitulatif des informations que vous nous avez transmises. Nous vous invitons à les vérifier attentivement&nbsp;; en cas d’erreur ou d’oubli, n’hésitez pas à nous contacter au plus vite.</p>
    <p class="recap-title">Récapitulatif de votre dossier</p>
    <div class="info-box">${infoItems}</div>
    <p>Votre candidature va maintenant être examinée par notre commission pédagogique, qui étudie chaque dossier avec attention afin de garantir une évaluation juste et rigoureuse. Cette étape peut prendre un certain temps compte tenu du nombre de candidatures reçues&nbsp;; nous vous remercions par avance de votre patience.</p>
    <p>Dès qu’une décision aura été rendue, vous en serez informé(e) par email à l’adresse que vous avez renseignée lors de votre inscription. Nous vous invitons donc à vérifier régulièrement votre boîte de réception.</p>
    <p>Pour toute question concernant votre dossier ou le déroulement du processus d’admission, notre équipe reste à votre entière disposition.</p>
    ${data.siteUrl ? `<p style="text-align:center;margin:22px 0;"><a href="${data.siteUrl}" class="button">Visiter notre site &rarr;</a></p>` : ''}
    <p>Nous vous remercions pour l’intérêt que vous portez à notre établissement et vous souhaitons une pleine réussite dans vos démarches.</p>
    <p class="signature">Cordialement,<br><span class="sign-name">L’équipe ESSG</span><br>École Supérieure de Sciences Géomatiques<br>Université de Fianarantsoa</p>
  `;

  const templateData: BaseTemplateData = {
    title: 'Accusé de réception',
    subtitle: 'Votre candidature a bien été enregistrée',
    content,
    preheader: `Dossier ${data.reference} enregistré — votre candidature est en attente d’étude`,
    siteUrl: data.siteUrl,
  };

  return renderBaseTemplate(templateData);
}
