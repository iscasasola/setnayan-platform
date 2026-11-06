/**
 * lib/personal-invite-card.ts — THE INVITE CARD as one SVG picture (prototype `supplier_personal_invite_2026-10-23`
 * frame A3). Pure: the same string is drawn on the admin's screen and saved by "Download the card", so what the admin
 * sees is what the supplier gets (owner 2026-05-21: the admin sends it by hand — Viber, Messenger, print).
 *
 * The QR is the shipped drawing (`styledQrSvg` in the free look — the Setnayan mark in its centre, level H), nested
 * whole; nothing new in QR. Under it: "Scan to open your shop", the offer pill, and the link in words for a camera
 * that will not scan. Fixed light colours: it is a printed card, not a themed screen.
 */
import { styledQrSvg, setnayanMarkSvg } from './qr-style-svg';
import { FREE_QR_LOOK } from './qr-look';

const W = 360;
const INK = '#1e2229';
const INK_2 = '#4b4f57';
const INK_3 = '#6f7278';
const GOLD = '#a9834b';
const PILL = '#f4f2ee';
const SANS = `-apple-system, 'SF Pro Text', Inter, system-ui, sans-serif`;
const MONO = `ui-monospace, SFMono-Regular, Menlo, monospace`;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Split a long link into lines of at most `n` characters (it has no spaces to wrap on). */
function chunks(s: string, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out;
}

export function personalInviteCardSvg(input: {
  businessName: string;
  /** "Caterer" — the shop's category in words, or null. */
  categoryLabel: string | null;
  claimUrl: string;
  /** `offerPill(…)`, or null for an invite with no offer. */
  pill: string | null;
}): string {
  const { businessName, categoryLabel, claimUrl, pill } = input;
  const nameSize = businessName.length > 34 ? 15 : businessName.length > 26 ? 18 : 22;
  const kicker = `${categoryLabel ? `${categoryLabel} · ` : ''}your shop is ready`.toUpperCase();
  const qrSide = 188;
  const qrX = (W - qrSide) / 2;
  const qrY = 128;
  const qr = styledQrSvg(claimUrl, FREE_QR_LOOK)
    .replace(/^<svg /, `<svg x="${qrX}" y="${qrY}" width="${qrSide}" height="${qrSide}" `);

  let y = qrY + qrSide + 26;
  const parts: string[] = [];
  parts.push(`<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${SANS}" font-size="14" fill="${INK_2}">Scan to open your shop</text>`);
  y += 16;
  if (pill) {
    const pw = Math.min(W - 40, Math.round(pill.length * 7.1) + 26);
    parts.push(
      `<rect x="${(W - pw) / 2}" y="${y}" width="${pw}" height="28" rx="14" fill="${PILL}"/>` +
        `<text x="${W / 2}" y="${y + 18.5}" text-anchor="middle" font-family="${SANS}" font-size="13" font-weight="600" fill="${INK}" data-card-offer="">${esc(pill)}</text>`,
    );
    y += 28 + 10;
  }
  const link = claimUrl.replace(/^https?:\/\//, '');
  for (const line of chunks(link, 46)) {
    y += 14;
    parts.push(`<text x="${W / 2}" y="${y}" text-anchor="middle" font-family="${MONO}" font-size="10.5" fill="${INK_3}">${esc(line)}</text>`);
  }
  const H = y + 22;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(`Invite card for ${businessName}`)}" data-invite-card="">` +
    `<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="18" fill="#ffffff" stroke="rgba(0,0,0,0.08)"/>` +
    // SETNAYAN mark + word, centred.
    setnayanMarkSvg(W / 2 - 52, 34, 22, GOLD) +
    `<text x="${W / 2 + 12}" y="40" text-anchor="middle" font-family="${SANS}" font-size="16" font-weight="800" letter-spacing="1" fill="${INK}">SETNAYAN</text>` +
    `<text x="${W / 2}" y="84" text-anchor="middle" font-family="${SANS}" font-size="${nameSize}" font-weight="600" fill="${INK}" data-card-name="">${esc(businessName)}</text>` +
    `<text x="${W / 2}" y="106" text-anchor="middle" font-family="${MONO}" font-size="11" letter-spacing="2" fill="${GOLD}">${esc(kicker)}</text>` +
    qr +
    parts.join('') +
    `</svg>`
  );
}
