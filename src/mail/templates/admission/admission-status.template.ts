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
  { title: string; badge: string; badgeClass: string; message: string }
> = {
  [AdmissionStatus.ACCEPTE]: {
    title: 'Confirmation de votre admission',
    badge: 'Acceptée',
    badgeClass: 'status-success',
    message:
      'Nous avons le plaisir de vous informer que votre admission a été validée.',
  },
  [AdmissionStatus.REFUSE]: {
    title: 'Décision concernant votre candidature',
    badge: 'Refusée',
    badgeClass: 'status-error',
    message:
      'Après étude de votre dossier, nous regrettons de vous informer que votre candidature n’a pas été retenue pour cette formation.',
  },
  [AdmissionStatus.EN_COURS_ETUDE]: {
    title: 'Dossier en cours d’étude',
    badge: 'En cours d’étude',
    badgeClass: 'status-info',
    message:
      'Votre dossier de candidature est actuellement en cours d’étude par notre commission pédagogique.',
  },
  [AdmissionStatus.EN_ATTENTE]: {
    title: 'Dossier en attente',
    badge: 'En attente',
    badgeClass: 'status-warning',
    message: 'Votre dossier de candidature a bien été enregistré et est en attente de traitement.',
  },
};

function infoRow(label: string, value?: string): string {
  if (!value?.trim()) return '';
  return `<div class="info-item"><span class="info-label">${escapeHtml(label)}</span><span class="info-value">${escapeHtml(value)}</span></div>`;
}

export function renderAdmissionStatusTemplate(data: AdmissionNotificationData): string {
  const meta = STATUS_META[data.statut];

  const infoItems = [
    infoRow('Référence du dossier', data.reference),
    infoRow('Candidat(e)', `${data.prenom} ${data.nom}`),
    infoRow('Formation concernée', data.formation),
    infoRow('Statut', meta.badge),
    infoRow('Date de décision', data.date),
    infoRow('Date', data.reponseDate),
    infoRow('Heure', data.reponseHeure),
    infoRow('Lieu', data.reponseLieu),
  ].join('');

  const complementary =
    data.reponseInstructions || data.reponseMessage || data.commentaire
      ? `
        <p><strong>Informations complémentaires :</strong></p>
        ${data.reponseInstructions ? `<p>${escapeHtml(data.reponseInstructions)}</p>` : ''}
        ${
          data.reponseMessage || data.commentaire
            ? `<div class="info-box"><span class="info-label">Message</span><div class="message-block">${escapeHtml(
                data.reponseMessage || data.commentaire || '',
              )}</div></div>`
            : ''
        }
      `
      : '';

  const content = `
    <p>Bonjour <strong>${escapeHtml(data.prenom)} ${escapeHtml(data.nom)}</strong>,</p>
    <p>${meta.message}</p>
    <div class="info-box">
      ${infoItems}
    </div>
    <p><span class="status ${meta.badgeClass}">${meta.badge}</span></p>
    ${complementary}
    <p>Nous restons à votre disposition pour toute information complémentaire.</p>
    <p>Cordialement,<br>L’équipe ESSG<br>École Supérieure de Sciences Géomatiques</p>
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
