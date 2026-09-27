import QRCode from 'qrcode';
import { publicEventPath } from './public-event-url';
import { FREE_QR_LOOK, type QrLook } from './qr-look';
import { styledQrSvg } from './qr-style-svg';

const QR_OPTIONS = {
  errorCorrectionLevel: 'H' as const, // ~30% redundancy per spec § Locked structural rules
  margin: 4, // ≥4 modules of quiet zone
  color: {
    dark: '#1A1A1A',  // ink — Sprint 0 default, replaces with role-palette color in 0010
    light: '#FAF7F2', // cream — same as our app background
  },
};

/**
 * ─────────────────────────────────────────────────────────────────────────
 * EVERY GUEST QR WEARS A `QrLook` (owner 2026-09-27 — see lib/qr-look.ts).
 *
 * The renderers below take `look?: QrLook`. Left out, they render
 * `FREE_QR_LOOK` — ink on cream, the SETNAYAN mark in the centre — so a call
 * site that forgets to resolve the event's look still ships a code that obeys
 * the free rule rather than a bare one. A Pro event's look (the couple's own
 * logo, shape, pattern, palette ink) comes from `resolveEventQrLook`
 * (lib/qr-look.server.ts), which is the ONE place the Pro entitlement is read
 * for a QR.
 *
 * ⚠ CORRECTED 2026-09-28. Until this build these functions took `monogram?`
 * and drew the couple's lettered lockup in the centre of every code, free or
 * not, and a separate `renderBranded*` pair tinted the modules for the
 * "Custom QR per guest" product. Both are gone: the centre and the colour are
 * facts of the LOOK, and the look is decided by Event Hub Pro.
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * Render an arbitrary URL as an inline QR SVG string — the PLAIN code, no
 * centre mark. For codes that are NOT a guest's: the Papic seat-claim links a
 * couple shares with their photo crew, a supplier's shortlist/locked QR, a
 * cost-claim link. Same level-H error correction + quiet zone + ink/cream
 * palette as the guest QRs, so it scans + prints cleanly.
 *
 * ⛔ Not for a guest-facing code. A QR a guest scans to reach the Event Hub,
 * their pass, their seat or the invite door goes through `renderStyledUrlQrSvg`
 * (or the invitation/landing renderers), so it carries the mark the free rule
 * requires.
 */
export async function renderUrlQrSvg(url: string, width = 200): Promise<string> {
  return QRCode.toString(url, { ...QR_OPTIONS, type: 'svg', width });
}

/**
 * Any guest-facing URL in the event's look — the join-link QR the couple
 * shares, the poster's story code, the seating pack's table and place-card
 * codes. Synchronous underneath; async to match its siblings.
 */
export async function renderStyledUrlQrSvg(url: string, look: QrLook = FREE_QR_LOOK, width = 256): Promise<string> {
  return styledQrSvg(url, look, { width });
}

/** PNG twin of `renderStyledUrlQrSvg` — for PDFs and print packs. */
export async function renderStyledUrlQrPng(
  url: string,
  look: QrLook = FREE_QR_LOOK,
  width = 600,
  onLookError?: (err: unknown) => void,
): Promise<Buffer> {
  return styledPngOrPlain(url, look, width, onLookError);
}

/**
 * Render a guest's invitation QR as an inline SVG string. Encodes the HTTPS
 * fallback URL per spec § Token format and URI scheme — `setnayan://` is the
 * parsing convenience inside native apps, never embedded in printed QRs.
 *
 * The centre carries the look's mark (Setnayan's for a free event, the
 * couple's for Pro); level H error correction keeps the code scannable through
 * the clearance — lib/every-qr-look-decodes.test.ts proves it for every look.
 */
export async function renderInvitationQrSvg(params: {
  appUrl: string;
  slug: string;
  qrToken: string;
  look?: QrLook;
  /** Event owner's account slug — when the /u/ nesting cutover is ON, encodes
   *  `/u/{ownerSlug}/{slug}`; absent / cutover-OFF encodes the bare `/{slug}`. */
  ownerSlug?: string | null;
}): Promise<string> {
  // Built by buildInvitationUrl, never re-typed here — the SVG a guest looks at
  // and the PNG they save must encode the SAME url, and the only way to
  // guarantee that is to leave one place that knows how to spell it.
  const url = buildInvitationUrl(params);
  return styledQrSvg(url, params.look ?? FREE_QR_LOOK, { width: 256 });
}

export function buildInvitationUrl(params: {
  appUrl: string;
  slug: string;
  qrToken: string;
  ownerSlug?: string | null;
}): string {
  return `${params.appUrl}${publicEventPath(params.slug, params.ownerSlug)}?invite=${params.qrToken}`;
}

/**
 * Render a guest's OWN invitation QR as a keepsake PNG — the file behind
 * "Save the code" on the guest's three QR surfaces (the invitation QR card,
 * the My QR modal, the day-of hub's Me panel), and the code on every printed
 * pass.
 *
 * Deliberately the SAME url + the SAME look as renderInvitationQrSvg, so the
 * picture a guest saves is the picture they were shown. One thing differs, on
 * purpose: it is BIGGER — 1024px survives being printed, re-shared through a
 * messaging app that recompresses, or held up on a cracked phone at a venue
 * door.
 *
 * 🔑 It matters because on this platform the saved image IS the invitation:
 * 75 of 77 guests on one live wedding have neither an email address nor a
 * mobile number, so nothing digital reaches them (owner decision #19,
 * 2026-09-16).
 *
 * `onMonogramError` — kept under its historical name, which the route guards
 * pin — fires when the STYLED render fails and the plain level-H code is
 * served instead. A failed mark must never cost a guest their code, and must
 * never be silent either: every route puts the outcome on the wire
 * (`X-Setnayan-Monogram: composited | fallback`).
 */
export async function renderInvitationQrPng(params: {
  appUrl: string;
  slug: string;
  qrToken: string;
  look?: QrLook;
  ownerSlug?: string | null;
  width?: number;
  onMonogramError?: (err: unknown) => void;
}): Promise<Buffer> {
  const url = buildInvitationUrl(params);
  return styledPngOrPlain(url, params.look ?? FREE_QR_LOOK, params.width ?? 1024, params.onMonogramError);
}

/**
 * The styled raster, or the plain code when it cannot be drawn.
 *
 * The raster module is loaded dynamically for the same reason lib/qr-decode
 * loads sharp dynamically: lib/qr.ts is imported by a dozen server components
 * that only ever want an SVG string, and none of them should pull `sharp` and a
 * font parser into their module graph to get one.
 */
async function styledPngOrPlain(
  url: string,
  look: QrLook,
  width: number,
  onError?: (err: unknown) => void,
): Promise<Buffer> {
  try {
    const { styledQrPng } = await import('./qr-style-raster');
    return await styledQrPng(url, look, width);
  } catch (err) {
    onError?.(err);
    return QRCode.toBuffer(url, { ...QR_OPTIONS, type: 'png', width });
  }
}

/**
 * Render the event's master QR — encodes `setnayan.com/{slug}` with no token
 * suffix. The same QR drives:
 *   (a) host-shared public landing page (Facebook · WhatsApp · save-the-date),
 *   (b) vendor scan-at-venue Tier 1 / Tier 2 flow per 0006 (CLAUDE.md 2026-05-22
 *       unified QR lifecycle lock).
 *
 * Distinct from `renderInvitationQrSvg` which encodes a guest-token URL. The
 * master QR is anonymous; only the slug matters.
 */
export async function renderEventLandingQrSvg(params: {
  appUrl: string;
  slug: string;
  look?: QrLook;
  ownerSlug?: string | null;
}): Promise<string> {
  const url = buildEventLandingUrl(params);
  return styledQrSvg(url, params.look ?? FREE_QR_LOOK, { width: 256 });
}

export function buildEventLandingUrl(params: {
  appUrl: string;
  slug: string;
  ownerSlug?: string | null;
}): string {
  return `${params.appUrl}${publicEventPath(params.slug, params.ownerSlug)}`;
}

/**
 * The master event QR as a PNG in the event's look — the file behind the
 * Event Hub address on the Maker's Details page, the code every printed piece
 * carries, and safe to use directly as an `<img>` source.
 *
 * The PNG twin of `renderEventLandingQrSvg`: same url (built by the same
 * `buildEventLandingUrl`), same level-H code, same look. Bigger, because this
 * one gets printed at A4 / postcard sizes.
 */
export async function renderEventLandingQrPng(params: {
  appUrl: string;
  slug: string;
  look?: QrLook;
  ownerSlug?: string | null;
  width?: number;
  onMonogramError?: (err: unknown) => void;
}): Promise<Buffer> {
  const url = buildEventLandingUrl(params);
  return styledPngOrPlain(url, params.look ?? FREE_QR_LOOK, params.width ?? 1024, params.onMonogramError);
}
