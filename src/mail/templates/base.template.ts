export interface BaseTemplateData {
  title: string;
  subtitle?: string;
  content: string;
  preheader?: string;
  siteUrl?: string;
  logoUrl?: string;
}

export function renderBaseTemplate(data: BaseTemplateData): string {
  const {
    title,
    subtitle = '',
    content,
    preheader = '',
    siteUrl = 'https://essg.mg',
    logoUrl = '',
  } = data;

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
    .wrapper { width: 100%; max-width: 600px; margin: 0 auto; padding: 24px 16px; }
    .card { background-color: #ffffff; border-radius: 10px; overflow: hidden; border: 1px solid #e5eaeb; box-shadow: 0 2px 8px rgba(15, 33, 30, 0.06); }
    .header { background: linear-gradient(135deg, #27564e, #2e6a5f); color: #ffffff; padding: 32px 28px; text-align: center; }
    .logo { max-height: 56px; margin-bottom: 12px; }
    .brand { font-size: 26px; font-weight: bold; letter-spacing: 0.5px; }
    .header h1 { font-size: 22px; margin-top: 8px; font-weight: 600; }
    .header p { font-size: 14px; opacity: 0.92; margin-top: 6px; }
    .content { padding: 28px; color: #38474b; font-size: 15px; line-height: 1.65; }
    .content p { margin-bottom: 14px; }
    .content strong { color: #1e2829; }
    .info-box { background: #eff7f4; border-left: 4px solid #2e6a5f; border-radius: 6px; padding: 18px; margin: 18px 0; }
    .info-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #d9ece7; }
    .info-item:last-child { border-bottom: none; }
    .info-label { color: #546c70; font-weight: 600; }
    .info-value { color: #1e3a35; font-weight: 600; text-align: right; }
    .status { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: bold; }
    .status-success { background: #eef4df; color: #4f6834; }
    .status-error { background: #fef2f2; color: #b42318; }
    .status-warning { background: #fef9ec; color: #92600a; }
    .status-info { background: #d9ece7; color: #27564e; }
    .button { display: inline-block; background: #2e6a5f; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: bold; margin: 8px 0; }
    .credentials { background: #f5f7f7; border: 1px solid #e5eaeb; border-radius: 6px; padding: 16px; margin: 16px 0; }
    .credential-row { display: flex; justify-content: space-between; padding: 6px 0; }
    .credential-value { font-family: 'Courier New', monospace; color: #2e6a5f; }
    .warning { background: #fef9ec; border-left: 4px solid #98c070; padding: 14px; border-radius: 4px; margin: 16px 0; }
    .footer { background: #eff7f4; padding: 22px 28px; text-align: center; color: #546c70; font-size: 12px; line-height: 1.7; }
    .footer a { color: #2e6a5f; text-decoration: none; }
    .message-block { white-space: pre-wrap; background: #ffffff; border: 1px solid #d9ece7; border-radius: 6px; padding: 14px; }
    @media (max-width: 480px) {
      .content, .footer { padding: 20px; }
      .header { padding: 24px 18px; }
      .info-item, .credential-row { flex-direction: column; gap: 2px; }
      .info-value { text-align: left; }
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
