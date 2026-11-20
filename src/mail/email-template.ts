export interface BrandedEmailOptions {
  preview: string;
  title: string;
  greeting: string;
  message: string;
  buttonLabel: string;
  buttonUrl: string;
  note: string;
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

export function brandedEmail(options: BrandedEmailOptions): string {
  const preview = escapeHtml(options.preview);
  const title = escapeHtml(options.title);
  const greeting = escapeHtml(options.greeting);
  const message = escapeHtml(options.message);
  const buttonLabel = escapeHtml(options.buttonLabel);
  const buttonUrl = escapeHtml(options.buttonUrl);
  const note = escapeHtml(options.note);

  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:32px 16px;background:#f3f6f4;color:#172b25;font-family:Arial,Helvetica,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${preview}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto">
      <tr><td style="padding:4px 8px 20px;font-size:21px;font-weight:700;letter-spacing:-.4px;color:#173a2d">Mtonga<span style="color:#16845b">Mart</span></td></tr>
      <tr><td style="padding:36px 32px;background:#ffffff;border:1px solid #e4ebe6;border-radius:12px">
        <p style="margin:0 0 10px;color:#16845b;font-size:12px;font-weight:700;letter-spacing:1.1px;text-transform:uppercase">${title}</p>
        <h1 style="margin:0 0 18px;color:#173a2d;font-size:26px;line-height:1.25;font-weight:700">${greeting}</h1>
        <p style="margin:0 0 28px;color:#52645b;font-size:15px;line-height:1.7">${message}</p>
        <p style="margin:0 0 26px"><a href="${buttonUrl}" style="display:inline-block;padding:13px 22px;border-radius:7px;background:#147a53;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700">${buttonLabel}</a></p>
        <p style="margin:0;padding-top:20px;border-top:1px solid #edf1ee;color:#718078;font-size:13px;line-height:1.6">${note}</p>
      </td></tr>
      <tr><td style="padding:20px 8px;color:#87928c;font-size:12px;line-height:1.6">MtongaMart<br>If you need help, reply to this email.</td></tr>
    </table>
  </body>
</html>`;
}
