import QRCode from 'qrcode';
import { compositeMonogram, type MonogramConfig } from './monogram';

const QR_OPTIONS = {
  errorCorrectionLevel: 'H' as const, // ~30% redundancy per spec § Locked structural rules
  margin: 4, // ≥4 modules of quiet zone
  color: {
    dark: '#1A1A1A',  // ink — Sprint 0 default, replaces with role-palette color in 0010
    light: '#FAF7F2', // cream — same as our app background
  },
};

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
}): Promise<string> {
  const url = `${params.appUrl}/${params.slug}?invite=${params.qrToken}`;
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
}): string {
  return `${params.appUrl}/${params.slug}?invite=${params.qrToken}`;
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
}): Promise<string> {
  const url = `${params.appUrl}/${params.slug}`;
  const svg = await QRCode.toString(url, { ...QR_OPTIONS, type: 'svg', width: 256 });
  if (params.monogram) {
    return compositeMonogram(svg, params.monogram);
  }
  return svg;
}

export function buildEventLandingUrl(params: { appUrl: string; slug: string }): string {
  return `${params.appUrl}/${params.slug}`;
}

// ─────────────────────────────────────────────────────────────────────────
// Branded per-guest QR — the paid CUSTOM_QR_GUEST SKU (₱1,499).
//
// The default per-guest QR (above) always renders in ink-on-cream with the
// couple's monogram in the center. The BRANDED variant additionally tints
// the QR modules with the couple's palette color (pulled from their Mood
// Board reception/couple palette) and ships inside a premium card layout
// suitable for print + share. Gated on the event owning a paid order; the
// unowned path keeps the plain default QR.
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
}): Promise<string> {
  const url = `${params.appUrl}/${params.slug}?invite=${params.qrToken}`;
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
