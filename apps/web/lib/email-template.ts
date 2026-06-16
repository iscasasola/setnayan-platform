// Branded HTML email layout (iteration 0028).
//
// `lib/email.ts` sendEmail() is plain-text by default; pass the output of
// renderBrandedEmail() as the optional `html` body to send a multipart email
// whose HTML half is brand-styled (Setnayan wordmark, the v2.1 "premium-calm"
// paper palette, a single mulberry CTA). Plain-text stays the canonical
// fallback for clients that don't render HTML.
//
// Email clients strip <style> + CSS variables, so everything here is INLINE
// hex (mirrored from the --m-* tokens in globals.css) on table layout — the
// only combination that renders consistently across Gmail / Apple Mail /
// Outlook. Keep it dependency-free (no React, no MJML): a pure string builder.

// Palette — inline hex mirror of the canonical --m-* tokens (globals.css).
const C = {
  bg: '#F4F2EC', // --m-paper-2  (outer canvas)
  card: '#FBFBFA', // --m-paper   (card surface)
  ink: '#1E2229', // --m-ink      (headings)
  slate: '#4F535B', // --m-slate   (body copy)
  faint: '#898D94', // --m-slate-3 (footnote)
  line: '#E2DED4', // --m-line     (hairlines)
  mulberry: '#5C2542', // --m-mulberry (wordmark + button)
  gold: '#C5A059', // --m-orange   (accent rule)
} as const;

/** Minimal HTML-escape for interpolated text (names, copy). */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type BrandedEmailParts = {
  /** Bold headline at the top of the message body. */
  heading: string;
  /** One or more body paragraphs (plain text — escaped + wrapped in <p>). */
  paragraphs: string[];
  /** Primary button label. */
  ctaLabel: string;
  /** Primary button destination (a Setnayan URL — not escaped as text). */
  ctaHref: string;
  /** Optional small print under the button. */
  footnote?: string;
};

/**
 * Render a branded HTML email body. Pure + side-effect-free; the caller pairs
 * it with a plain-text `text` body in sendEmail().
 */
export function renderBrandedEmail(parts: BrandedEmailParts): string {
  const { heading, paragraphs, ctaLabel, ctaHref, footnote } = parts;
  const body = paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${C.slate};">${esc(
          p,
        )}</p>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${C.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${C.card};border:1px solid ${C.line};border-radius:16px;overflow:hidden;">
        <tr><td style="padding:28px 32px 0;">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;letter-spacing:0.22em;color:${C.mulberry};font-weight:600;">SETNAYAN</div>
          <div style="height:3px;width:40px;background:${C.gold};border-radius:2px;margin-top:10px;"></div>
        </td></tr>
        <tr><td style="padding:22px 32px 8px;">
          <h1 style="margin:0 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.3;color:${C.ink};font-weight:600;">${esc(
            heading,
          )}</h1>
          ${body}
        </td></tr>
        <tr><td style="padding:8px 32px 4px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:8px;background:${C.mulberry};">
            <a href="${ctaHref}" style="display:inline-block;padding:12px 24px;font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(
              ctaLabel,
            )}</a>
          </td></tr></table>
        </td></tr>
        ${
          footnote
            ? `<tr><td style="padding:14px 32px 0;"><p style="margin:0;font-size:13px;line-height:1.5;color:${C.faint};">${esc(
                footnote,
              )}</p></td></tr>`
            : ''
        }
        <tr><td style="padding:24px 32px 28px;">
          <hr style="border:none;border-top:1px solid ${C.line};margin:0 0 14px;">
          <p style="margin:0;font-size:12px;line-height:1.5;color:${C.faint};">Setnayan · Filipino wedding planning + verified vendors<br>You're receiving this because you started a Papic gallery for your event.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}
