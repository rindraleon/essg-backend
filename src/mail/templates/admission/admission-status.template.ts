import { AdmissionStatus } from '../../../admissions/entities/admission.entity';
import { escapeHtml } from '../../mail.errors';
import { renderBaseTemplate, BaseTemplateData } from '../base.template';

export interface AdmissionNotificationData {
  nom: string;
  prenom: string;
  email: string;
  formation: string;
  reference: string;
  statut: AdmissionStatus;
  date: string;
  commentaire?: string;
  reponseDate?: string;
  reponseHeure?: string;
  reponseLieu?: string;
  reponseInstructions?: string;
  reponseMessage?: string;
  siteUrl?: string;
}

const STATUS_META: Record<
  AdmissionStatus,
  { title: string; badge: string; badgeClass: string; message: string; closing: string }
> = {
  [AdmissionStatus.ACCEPTE]: {
    title: 'Confirmation de votre admission',
    badge: 'Acceptée',
    badgeClass: 'status-success',
    message:
      'À la suite de l’examen de votre dossier par notre commission pédagogique, nous avons le plaisir de vous informer que votre candidature a été <strong>acceptée</strong> pour la formation demandée. Nous vous adressons toutes nos félicitations.',
    closing:
      'Nous nous réjouissons de vous accueillir au sein de notre établissement et vous souhaitons une excellente année universitaire.',
  },
  [AdmissionStatus.REFUSE]: {
    title: 'Décision concernant votre candidature',
    badge: 'Refusée',
    badgeClass: 'status-error',
    message:
      'À la suite de l’examen attentif de votre dossier par notre commission pédagogique, nous regrettons de vous informer que votre candidature n’a pas pu être retenue pour la formation demandée.',
    closing:
      'Cette décision ne remet pas en cause la qualité de votre parcours. Nous vous encourageons à poursuivre vos démarches et vous souhaitons une pleine réussite dans vos projets.',
  },
  [AdmissionStatus.EN_COURS_ETUDE]: {
    title: 'Votre dossier est en cours d’étude',
    badge: 'En cours d’étude',
    badgeClass: 'status-info',
    message:
      'Nous vous informons que votre dossier de candidature est actuellement en cours d’examen par notre commission pédagogique. Chaque dossier étant étudié avec la plus grande attention, cette étape peut nécessiter un certain délai.',
    closing:
      'Nous vous remercions par avance de votre patience et ne manquerons pas de vous informer dès qu’une décision aura été rendue.',
  },
  [AdmissionStatus.EN_ATTENTE]: {
    title: 'Votre dossier est en attente',
    badge: 'En attente',
    badgeClass: 'status-warning',
    message:
      'Nous vous informons que votre dossier de candidature a bien été enregistré et qu’il est actuellement en attente de traitement par nos services.',
    closing:
      'Vous serez informé(e) par email dès que votre dossier aura été examiné. Nous vous remercions de votre patience.',
  },
};

function infoRow(label: string, value?: string): string {
  if (!value?.trim()) return '';
  return `<div class="info-item"><span class="info-label">${escapeHtml(label)}</span><span class="info-value">${escapeHtml(value)}</span></div>`;
}

export function renderAdmissionStatusTemplate(data: AdmissionNotificationData): string {
  const meta = STATUS_META[data.statut];
  const nom = escapeHtml(data.nom);
  const prenom = escapeHtml(data.prenom);

  const infoItems = [
    infoRow('Référence du dossier', data.reference),
    infoRow('Candidat(e)', `${nom} ${prenom}`),
    infoRow('Formation concernée', data.formation),
    infoRow('Statut du dossier', meta.badge),
    infoRow('Date de décision', data.date),
    infoRow('Date', data.reponseDate),
    infoRow('Heure', data.reponseHeure),
    infoRow('Lieu', data.reponseLieu),
  ].join('');

  let complementary = '';
  if (data.reponseInstructions || data.reponseMessage || data.commentaire) {
    const instructions = data.reponseInstructions
      ? `<p>${escapeHtml(data.reponseInstructions)}</p>`
      : '';
    let messageBlock = '';
    if (data.reponseMessage || data.commentaire) {
      messageBlock = `<div class="message-block">${escapeHtml(
        data.reponseMessage || data.commentaire || '',
      )}</div>`;
    }
    complementary = `
      <p><strong>Informations complémentaires :</strong></p>
      ${instructions}
      ${messageBlock}
    `;
  }

  const content = `
    <p>Bonjour <strong>${nom} ${prenom}</strong>,</p>
    <p>${meta.message}</p>
    <p class="recap-title">Situation de votre dossier</p>
    <div class="info-box">${infoItems}</div>
    <p><span class="status ${meta.badgeClass}">${meta.badge}</span></p>
    ${complementary}
    <p>${meta.closing}</p>
    <p>Pour toute question relative à votre dossier, notre équipe reste à votre entière disposition.</p>
    <p class="signature">Cordialement,<br><span class="sign-name">L’équipe ESSG</span><br>École Supérieure de Sciences Géomatiques<br>Université de Fianarantsoa</p>
  `;

  const templateData: BaseTemplateData = {
    title: meta.title,
    subtitle: 'Notification de candidature',
    content,
    preheader: `Décision concernant votre dossier ${data.reference}`,
    siteUrl: data.siteUrl,
  };

  return renderBaseTemplate(templateData);
}
