import 'reflect-metadata';
import { renderWelcomeTemplate } from './src/mail/templates/welcome.template';
import { renderMessageReceiptTemplate } from './src/mail/templates/message-receipt.template';
import { renderMessageReplyTemplate } from './src/mail/templates/message-reply.template';
import { renderAdmissionConfirmationTemplate } from './src/mail/templates/admission/confirmation.template';
import { renderAdmissionStatusTemplate } from './src/mail/templates/admission/admission-status.template';
import { renderAdminContactNotificationTemplate } from './src/mail/templates/admin-contact-notification.template';
import { renderAdminAdmissionNotificationTemplate } from './src/mail/templates/admin-admission-notification.template';
import { AdmissionStatus } from './src/admissions/entities/admission.entity';
import { writeFileSync } from 'node:fs';

const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Preview templates email ESSG</title>
<style>body{font-family:Segoe UI,Arial;background:#eef2f1;padding:24px}h1{font-size:18px;color:#1f4a42}section{margin:24px 0}h2{font-size:14px;color:#5b726d;text-transform:uppercase;letter-spacing:1px}</style></head><body>
<h1>Aperçu des templates email ESSG</h1>
<section><h2>1. Welcome (nouvel utilisateur back-office)</h2>${renderWelcomeTemplate({
    nom: 'Doe', prenom: 'John', email: 'john.doe@essg.sn', motDePasse: 'MotDePasse@2026',
    siteUrl: ''
})}</section>
<section><h2>2. Accusé de réception candidature</h2>${renderAdmissionConfirmationTemplate({ nom: 'RAKOTO', prenom: 'Hery', formation: 'Licence Géomatique et Applications', reference: 'ESSG-42', date: '19/08/2026', siteUrl: 'https://essg.mg' })}</section>
<section><h2>3. Statut d'admission acceptée</h2>${renderAdmissionStatusTemplate({ nom: 'RAKOTO', prenom: 'Hery', email: 'h.rakoto@essg.sn', formation: 'Licence Géomatique', reference: 'ESSG-42', statut: AdmissionStatus.ACCEPTE, date: '19/08/2026', reponseDate: '2026-09-01', reponseHeure: '09:00', reponseLieu: 'Campus Andrainjato', reponseMessage: 'Merci de vous présenter avec vos originaux.' })}</section>
<section><h2>4. Notification admin — contact</h2>${renderAdminContactNotificationTemplate({ nom: 'RABE', prenom: 'Faly', email: 'faly.rabe@gmail.com', telephone: '+261 34 00 000 00', sujet: 'Demande d2019information', message: 'Bonjour, je souhaite des informations sur les frais de scolarité en Master.', date: '19/08/2026', backOfficeUrl: 'https://admin.essg.mg' })}</section>
<section><h2>5. Notification admin — nouvelle candidature</h2>${renderAdminAdmissionNotificationTemplate({ nom: 'RAKOTO', prenom: 'Hery', email: 'h.rakoto@essg.sn', telephone: '+261 33 12 345 67', niveau: 'Licence', formation: 'Géomatique et Applications', numeroBaccalaureat: 'BAC-2025-012345', numeroBordereau: 'BV-2026-000123', reference: 'ESSG-42', date: '19/08/2026', fileCount: 4, backOfficeUrl: 'https://admin.essg.mg' })}</section>
<section><h2>6. Accusé de réception contact + réponse</h2>${renderMessageReceiptTemplate({ nom: 'RAZAFY', prenom: 'Miora', sujet: 'Partenariat', siteUrl: 'https://essg.mg' })}${renderMessageReplyTemplate({ nom: 'RAZAFY', prenom: 'Miora', sujet: 'Partenariat', message: 'Bonjour, merci pour votre proposition. Nous revenons vers vous très rapidement.', siteUrl: 'https://essg.mg' })}</section>
</body></html>`;
writeFileSync('/home/user/email-templates-preview.html', html);
console.log('Preview générée');
