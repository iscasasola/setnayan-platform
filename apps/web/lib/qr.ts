import QRCode from 'qrcode';
import { compositeMonogram, type MonogramConfig } from './monogram';
import { publicEventPath } from './public-event-url';

const QR_OPTIONS = {
  errorCorrectionLevel: 'H' as const, // ~30% redundancy per spec § Locked structural rules
  margin: 4, // ≥4 modules of quiet zone
  color: {
    dark: '#1A1A1A',  // ink — Sprint 0 default, replaces with role-palette color in 0010
    light: '#FAF7F2', // cream — same as our app background
  },
};

/**
 * Render an arbitrary URL as an inline QR SVG string (no monogram). Used for
 * the Papic seat-claim links a couple shares + prints so a friend can scan to
 * claim their photo-crew seat. Same level-H error correction + quiet zone +
 * ink/cream palette as the invitation QRs, so it scans + prints cleanly.
 */
export async function renderUrlQrSvg(url: string, width = 200): Promise<string> {
  return QRCode.toString(url, { ...QR_OPTIONS, type: 'svg', width });
}

/**
 * Render a guest's invitation QR as an inline SVG string. Encodes the HTTPS
 * fallback URL per spec § Token format and URI scheme — `setnayan://` is the
 * parsing convenience inside native apps, never embedded in printed QRs.
 *
 * When a monogram is supplied, the renderer composites a circular cream-on-
 * accent badge into the center of the QR pattern (level H error correction
 * keeps the code scannable through the clearance).
 */
export async function renderInvitationQrSvg(params: {
  appUrl: string;
  slug: string;
  qrToken: string;
  monogram?: MonogramConfig;
  /** Event owner's account slug — when the /u/ nesting cutover is ON, encodes
   *  `/u/{ownerSlug}/{slug}`; absent / cutover-OFF encodes the bare `/{slug}`. */
  ownerSlug?: string | null;
}): Promise<string> {
  // Built by buildInvitationUrl, never re-typed here — the SVG a guest looks at
  // and the PNG they save must encode the SAME url, and the only way to
  // guarantee that is to leave one place that knows how to spell it.
  const url = buildInvitationUrl(params);
  const svg = await QRCode.toString(url, { ...QR_OPTIONS, type: 'svg', width: 256 });
  if (params.monogram) {
    return compositeMonogram(svg, params.monogram);
  }
  return svg;
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
 * the My QR modal, the day-of hub's Me panel).
 *
 * Deliberately the SAME url + the SAME QR_OPTIONS + the SAME monogram badge as
 * renderInvitationQrSvg, so the picture a guest saves is the picture they were
 * shown. One thing differs, on purpose: it is BIGGER — 1024px survives being
 * printed, re-shared through a messaging app that recompresses, or held up on a
 * cracked phone at a venue door.
 *
 * ⚠ CORRECTED 2026-09-16 (owner decision #19). This docblock used to say "NO
 * MONOGRAM … the saved file is the bulletproof scannable one", and the two
 * other PNG routes said the same thing, all three citing the same cause:
 * compositeMonogram rewrites raw SVG and a PNG is not SVG. That cause was real
 * and it no longer holds — lib/qr-monogram-raster.ts rasterises the SAME badge
 * geometry (from the SAME monogramOverlaySvg) as vector outlines and composites
 * it with sharp, and the composited PNG still decodes to the same url (guarded
 * in lib/the-saved-code-carries-the-mark.test.ts).
 * 🔑 It mattered because on this platform the saved image IS the invitation:
 * 75 of 77 guests on one live wedding have neither an email address nor a
 * mobile number, so nothing digital reaches them.
 *
 * `monogram` is optional and omitting it renders exactly what this function has
 * always rendered — the plain code — so a caller that cannot resolve the
 * couple's branding degrades to a working QR rather than an error.
 *
 * ⚠ NOT the branded PNG. renderBrandedInvitationQrPng tints the modules with
 * the couple's Mood Board palette and is served by the gated
 * /api/website/qr/guest/[guestId]. This one is the plain ink-on-cream code the
 * guest can already see for free, and is gated on nothing but being that guest.
 */
export async function renderInvitationQrPng(params: {
  appUrl: string;
  slug: string;
  qrToken: string;
  monogram?: MonogramConfig;
  ownerSlug?: string | null;
  width?: number;
  onMonogramError?: (err: unknown) => void;
}): Promise<Buffer> {
  const url = buildInvitationUrl(params);
  const png = await QRCode.toBuffer(url, {
    ...QR_OPTIONS,
    type: 'png',
    width: params.width ?? 1024,
  });
  return withMonogram(png, params.monogram, params.onMonogramError);
}

/**
 * The monogram half of every PNG renderer below, in ONE place.
 *
 * The raster compositor is loaded dynamically for the same reason lib/qr-decode
 * loads sharp dynamically: lib/qr.ts is imported by a dozen server components
 * that only ever want an SVG string, and none of them should pull `sharp` and a
 * font parser into their module graph to get one.
 */
async function withMonogram(
  png: Buffer,
  monogram: MonogramConfig | undefined,
  onError?: (err: unknown) => void,
): Promise<Buffer> {
  if (!monogram) return png;
  const { compositeMonogramOntoQrPng } = await import('./qr-monogram-raster');
  return compositeMonogramOntoQrPng(png, monogram, onError);
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
  monogram?: MonogramConfig;
  ownerSlug?: string | null;
}): Promise<string> {
  const url = `${params.appUrl}${publicEventPath(params.slug, params.ownerSlug)}`;
  const svg = await QRCode.toString(url, { ...QR_OPTIONS, type: 'svg', width: 256 });
  if (params.monogram) {
    return compositeMonogram(svg, params.monogram);
  }
  return svg;
}

export function buildEventLandingUrl(params: {
  appUrl: string;
  slug: string;
  ownerSlug?: string | null;
}): string {
  return `${params.appUrl}${publicEventPath(params.slug, params.ownerSlug)}`;
}

/**
 * The master event QR as a PNG, with the couple's monogram in the centre —
 * the file behind "Download QR" on the Website hub, and safe to use directly
 * as an `<img>` source.
 *
 * The PNG twin of `renderEventLandingQrSvg`: same url (built by the same
 * `buildEventLandingUrl`), same level-H code, same badge. Bigger, because this
 * one gets printed at A4 / postcard sizes.
 */
export async function renderEventLandingQrPng(params: {
  appUrl: string;
  slug: string;
  monogram?: MonogramConfig;
  ownerSlug?: string | null;
  width?: number;
  onMonogramError?: (err: unknown) => void;
}): Promise<Buffer> {
  const url = buildEventLandingUrl(params);
  const png = await QRCode.toBuffer(url, {
    ...QR_OPTIONS,
    type: 'png',
    width: params.width ?? 1024,
  });
  return withMonogram(png, params.monogram, params.onMonogramError);
}

// ─────────────────────────────────────────────────────────────────────────
// Branded per-guest QR — CUSTOM_QR_GUEST, and it is FREE FOR EVERYONE
// (owner 2026-09-06: "keep custom QR per guest free").
//
// ⚠ THIS COMMENT USED TO READ "the paid CUSTOM_QR_GUEST SKU (₱1,499)" AND THE
// NUMBER WAS NEVER RIGHT AGAIN AFTER THE CATALOGUE MOVED. The live row has read
// ₱0.00 for some time while this line kept quoting ₱1,499 — a price in a
// comment that nothing checks, which is why `lib/public-price-literals.ts`
// exists for the ones that face a customer. Do not restore a figure here: read
// the catalogue.
//
// The default per-guest QR (above) always renders in ink-on-cream with the
// couple's monogram in the center. The BRANDED variant additionally tints
// the QR modules with the couple's palette color (pulled from their Mood
// Board reception/couple palette) and ships inside a premium card layout
// suitable for print + share. Ownership still runs through `eventOwnsSku`, and
// that helper now answers TRUE for every event because the SKU is in
// `FREE_FOR_ALL_SKUS` — so the branded variant is what everybody gets, and the
// plain default is the fallback for a read that fails, not for a couple who
// did not pay.
//
// Cross-references:
//   • CLAUDE.md 2026-05-22 "Unified QR Code Lifecycle Model" (per-guest QR)
//   • lib/v2-catalog.ts CUSTOM_QR_GUEST (the SKU this closes)
//   • lib/mood-board.ts (the role_palette the brand color is drawn from)
// ─────────────────────────────────────────────────────────────────────────

export type BrandedQrColors = {
  /** QR module (foreground) color — must stay dark enough to scan. */
  dark: string;
  /** QR background color. */
  light: string;
};

const FALLBACK_DARK = '#1A1A1A'; // ink
const FALLBACK_LIGHT = '#FAF7F2'; // cream

/**
 * Relative luminance of a #RRGGBB hex (0 = black, 1 = white), per the
 * WCAG-style sRGB formula. Used only as a coarse contrast guard, not a
 * full WCAG contrast-ratio computation.
 */
function hexLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m || !m[1]) return 0;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Pick a scannable QR module color from the couple's palette.
 *
 * A QR code only stays readable if the dark modules contrast strongly with
 * the cream background. A pale blush or champagne palette color would make
 * the code unscannable, so we only honor the palette color when it's dark
 * enough (luminance ≤ 0.5); otherwise we fall back to ink. This keeps every
 * branded QR scannable regardless of which palette the couple picked.
 *
 * Returns the resolved { dark, light } pair the renderer should use.
 */
export function resolveBrandedQrColors(
  paletteColor: string | null | undefined,
): BrandedQrColors {
  const candidate = paletteColor?.trim();
  if (candidate && /^#[0-9a-f]{6}$/i.test(candidate)) {
    // Only use the palette color for modules if it contrasts well against
    // cream. Above this luminance the code risks being unscannable.
    if (hexLuminance(candidate) <= 0.5) {
      return { dark: candidate.toUpperCase(), light: FALLBACK_LIGHT };
    }
  }
  return { dark: FALLBACK_DARK, light: FALLBACK_LIGHT };
}

/**
 * Render a guest's BRANDED invitation QR — palette-tinted modules + the
 * couple's monogram composited in the center. Encodes the same guest-token
 * URL as `renderInvitationQrSvg`; only the styling differs.
 *
 * Level-H error correction (~30% redundancy) keeps the code scannable
 * through both the center monogram clearance and the colored modules.
 */
export async function renderBrandedInvitationQrSvg(params: {
  appUrl: string;
  slug: string;
  qrToken: string;
  monogram?: MonogramConfig;
  colors: BrandedQrColors;
  ownerSlug?: string | null;
}): Promise<string> {
  const url = `${params.appUrl}${publicEventPath(params.slug, params.ownerSlug)}?invite=${params.qrToken}`;
  const svg = await QRCode.toString(url, {
    ...QR_OPTIONS,
    color: { dark: params.colors.dark, light: params.colors.light },
    type: 'svg',
    width: 256,
  });
  if (params.monogram) {
    return compositeMonogram(svg, params.monogram);
  }
  return svg;
}

/**
 * The BRANDED per-guest QR as a PNG — palette-tinted modules + the couple's
 * monogram in the centre. The PNG twin of `renderBrandedInvitationQrSvg`, and
 * the file the gated /api/website/qr/guest/[guestId] serves.
 *
 * Built from `buildInvitationUrl` like every other invitation renderer, so the
 * branded card a guest is handed and the branded picture the couple downloads
 * encode the same token.
 */
export async function renderBrandedInvitationQrPng(params: {
  appUrl: string;
  slug: string;
  qrToken: string;
  monogram?: MonogramConfig;
  colors: BrandedQrColors;
  ownerSlug?: string | null;
  width?: number;
  onMonogramError?: (err: unknown) => void;
}): Promise<Buffer> {
  const url = buildInvitationUrl(params);
  const png = await QRCode.toBuffer(url, {
    ...QR_OPTIONS,
    color: { dark: params.colors.dark, light: params.colors.light },
    type: 'png',
    width: params.width ?? 1024,
  });
  return withMonogram(png, params.monogram, params.onMonogramError);
}
