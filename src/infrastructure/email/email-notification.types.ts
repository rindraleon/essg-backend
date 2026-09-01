import type { AdmissionStatus } from '../../admissions/entities/admission.entity';

export interface AdmissionConfirmationNotification {
  email: string;
  nom: string;
  prenom: string;
  formation: string;
  reference: string;
  niveau?: string;
  mention?: string;
  parcours?: string;
  bacCategorie?: string;
}

export interface AdmissionAdminNotification {
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
}

export interface AdmissionStatusNotification {
  email: string;
  nom: string;
  prenom: string;
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
}

export interface ContactReceiptNotification {
  email: string;
  nom: string;
  prenom: string;
  sujet: string;
}

export interface ContactAdminNotification {
  nom: string;
  prenom: string;
  email: string;
  telephone?: string;
  sujet: string;
  message: string;
  date: string;
}

export interface ContactReplyNotification {
  to: string;
  nom: string;
  prenom: string;
  sujet: string;
  message: string;
}

export interface UserWelcomeNotification {
  email: string;
  nom: string;
  prenom: string;
  motDePasse: string;
}
