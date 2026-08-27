export interface BaseTemplateData {
  title: string;
  subtitle?: string;
  content: string;
  preheader?: string;
  siteUrl?: string;
  logoUrl?: string;
}

export function renderBaseTemplate(data: BaseTemplateData): string {
  const { title, subtitle = '', content, preheader = '', logoUrl = '' } = data;

  const brandHtml = logoUrl
    ? `<img src="${logoUrl}" alt="ESSG" class="logo" />`
    : `<div class="brand">ESSG</div>`;

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; background-color: #f5f7f7; margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
    .wrapper { width: 100%; max-width: 620px; margin: 0 auto; padding: 28px 16px; }
    .card { background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e5eaeb; }
    .header { background: linear-gradient(135deg, #27564e, #2e6a5f); color: #ffffff; padding: 34px 30px; text-align: center; font-family: Arial, Helvetica, sans-serif; }
    .logo { max-height: 56px; margin-bottom: 12px; }
    .brand { font-size: 26px; font-weight: bold; letter-spacing: 0.5px; }
    .header h1 { font-size: 22px; margin-top: 8px; font-weight: 600; }
    .header p { font-size: 14px; opacity: 0.92; margin-top: 6px; }
    .content { padding: 30px 32px; color: #38474b; font-size: 15px; line-height: 1.7; font-family: Arial, Helvetica, sans-serif; }
    .content p { margin-bottom: 16px; text-align: justify; }
    .content strong { color: #1e2829; }
    .recap-title { font-size: 14px; font-weight: bold; color: #27564e; text-transform: uppercase; letter-spacing: 0.6px; margin: 22px 0 10px; }
    .info-box { background: #f6f9f8; border: 1px solid #d9e6e2; border-radius: 8px; padding: 12px 26px; margin: 20px 0 24px; box-shadow: none; }
    .info-item { display: flex; justify-content: space-between; align-items: baseline; padding: 13px 0; border-bottom: 1px dashed #cfdfe0; }
    .info-item:last-child { border-bottom: none; }
    .info-label { color: #546c70; font-weight: 600; padding-right: 18px; }
    .info-value { color: #1e3a35; font-weight: 600; text-align: right; }
    .status { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: bold; }
    .status-success { background: #eef4df; color: #4f6834; }
    .status-error { background: #fef2f2; color: #b42318; }
    .status-warning { background: #fef9ec; color: #92600a; }
    .status-info { background: #d9ece7; color: #27564e; }
    .button { display: inline-block; background: #2e6a5f; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; margin: 8px 0; }
    .credentials { background: #f6f9f8; border: 1px solid #d9e6e2; border-radius: 8px; padding: 18px 26px; margin: 20px 0; box-shadow: none; }
    .credentials h3 { margin: 0 0 12px; color: #27564e; font-size: 15px; }
    .credential-row { display: flex; justify-content: space-between; padding: 9px 0; border-bottom: 1px dashed #cfdfe0; }
    .credential-row:last-child { border-bottom: none; }
    .credential-value { font-family: 'Courier New', monospace; color: #2e6a5f; font-weight: bold; }
    .warning { background: #fef9ec; border-left: 4px solid #98c070; padding: 16px 18px; border-radius: 4px; margin: 18px 0; line-height: 1.6; }
    .message-block { white-space: pre-wrap; background: #ffffff; border: 1px solid #d9e6e2; border-radius: 6px; padding: 16px 18px; line-height: 1.65; }
    .signature { margin-top: 26px; padding-top: 18px; border-top: 1px solid #e5eaeb; color: #38474b; line-height: 1.7; }
    .signature .sign-name { font-weight: bold; color: #1e2829; }
    .footer { background: #eff7f4; padding: 24px 30px; text-align: center; color: #546c70; font-size: 12px; line-height: 1.8; font-family: Arial, Helvetica, sans-serif; }
    .footer a { color: #2e6a5f; text-decoration: none; }
    @media (max-width: 480px) {
      .content { padding: 24px 20px; }
      .footer { padding: 20px; }
      .header { padding: 26px 18px; }
      .info-box { padding: 8px 18px; }
      .info-item, .credential-row { flex-direction: column; gap: 3px; }
      .info-value { text-align: left; }
      .content p { text-align: left; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    ${preheader ? `<div style="display:none;max-height:0;overflow:hidden">${preheader}</div>` : ''}
    <div class="card">
      <div class="header">
        ${brandHtml}
        <h1>${title}</h1>
        ${subtitle ? `<p>${subtitle}</p>` : ''}
      </div>
      <div class="content">${content}</div>
      <div class="footer">
        <p><strong>ESSG</strong> &mdash; École Supérieure de Sciences Géomatiques</p>
        <p>Université de Fianarantsoa &middot; Andrainjato, Madagascar</p>
        <p>&copy; ${new Date().getFullYear()} ESSG &mdash; Tous droits réservés</p>
        <p>Pour toute information complémentaire, répondez à cet email ou contactez le secrétariat.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}
