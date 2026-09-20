/**
 * apps/web/lib/event-app-icon.ts
 *
 * THEIR WEDDING, AS AN ICON ON A PHONE.
 *
 * Owner 2026-09-20: teach a guest to save the invitation to their home screen,
 * "so they can access it anytime" — and give it the EVENT's icon, not ours.
 * A tile that says "Setnayan" is our app on their phone; a tile that shows the
 * couple's mark is their wedding on their phone, which is the whole point.
 *
 * WHAT THE ICON IS. The couple's monogram on a ground taken from their own mood
 * board, drawn as one square SVG. Two consumers, both served from it:
 *   • Android / Chrome reads the SVG straight out of the per-event manifest —
 *     the app's own manifest already ships SVG icons, so this is not a new bet.
 *   • iOS ignores manifest icons entirely and uses `apple-touch-icon`, which
 *     must be a PNG. The route rasterises this same SVG with sharp, so the two
 *     platforms cannot drift into showing different marks.
 *
 * ⚠ THE MARK IS THE COUPLE'S OWN FILE AND IS ALREADY SANITIZED. Callers pass
 * what `resolveEventMonogramSvg()` returns — `safeMonogramSvg` has stripped
 * scripts, animation, `foreignObject` and embedded images. This file does not
 * re-open that question; it must never be handed raw `monogram_uploaded_svg`.
 *
 * 🔑 AND IT FALLS BACK RATHER THAN FAILING. A couple with no mark gets their
 * initials set in the same serif on the same ground. An icon is the one asset
 * that cannot be absent: a home-screen tile with nothing in it is worse than
 * one with two letters.
 *
 * Pure. Returns strings; the routes do the I/O.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;

/** The ground behind the mark. Their palette's paper, else the app's. */
export const DEFAULT_ICON_BG = '#FBFBFA';
/** The ink the initials are set in when there is no mark. */
export const DEFAULT_ICON_INK = '#1E2229';

export function safeHex(v: unknown, fallback: string): string {
  return typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toUpperCase() : fallback;
}

/**
 * Strip the outer `<svg>` wrapper off a sanitized mark so its contents can be
 * placed inside our square. Returns the inner markup plus the viewBox we must
 * map it through — a mark drawn in its own coordinate space is meaningless
 * without it.
 */
export function unwrapMark(markSvg: string | null | undefined): { inner: string; viewBox: string } | null {
  if (typeof markSvg !== 'string' || markSvg.trim().length === 0) return null;
  const open = markSvg.match(/<svg\b[^>]*>/i);
  const close = markSvg.lastIndexOf('</svg>');
  if (!open || close === -1) return null;
  const inner = markSvg.slice(open.index! + open[0].length, close).trim();
  if (!inner) return null;
  const viewBox = open[0].match(/viewBox\s*=\s*"([^"]+)"/i)?.[1]?.trim();
  if (!viewBox || !/^-?[\d.]+\s+-?[\d.]+\s+[\d.]+\s+[\d.]+$/.test(viewBox)) return null;
  return { inner, viewBox };
}

/**
 * Up to two LETTERS, uppercased — the fallback face of the icon.
 *
 * Letters only, deliberately: keeping the ampersand made "C&I" render as "C&",
 * an icon that reads as a typo. The joiner is not an initial.
 */
export function iconInitials(raw: string | null | undefined): string {
  const t = (raw ?? '').replace(/[^A-Za-z]/g, '').toUpperCase();
  return t.slice(0, 2) || 'S';
}

export type EventIconInput = {
  /** A SANITIZED monogram svg (resolveEventMonogramSvg), or null. */
  markSvg?: string | null;
  /** Fallback letters when there is no mark. */
  initials?: string | null;
  /** Ground colour, from the couple's palette. */
  background?: string | null;
  /** Ink for the initials. */
  ink?: string | null;
  /** Square edge in px. */
  size?: number;
  /**
   * Leave the maskable safe area clear. Android may crop an icon to a circle,
   * so a mark drawn edge to edge loses its corners; at 0.8 the whole mark
   * survives every mask Android applies.
   */
  inset?: number;
};

/**
 * Build the square icon as one self-contained SVG string.
 *
 * The mark is placed through a nested `<svg>` with its own viewBox, which is
 * what makes an arbitrary mark — portrait, landscape, off-centre origin —
 * land centred and whole inside our square without any measurement here.
 */
export function buildEventIconSvg(input: EventIconInput): string {
  const size = Number.isFinite(input.size) && (input.size ?? 0) > 0 ? Math.round(input.size!) : 512;
  const bg = safeHex(input.background, DEFAULT_ICON_BG);
  const ink = safeHex(input.ink, DEFAULT_ICON_INK);
  const inset = input.inset ?? 0.78;
  const box = Math.round(size * inset);
  const off = Math.round((size - box) / 2);
  const mark = unwrapMark(input.markSvg);

  const face = mark
    ? `<svg x="${off}" y="${off}" width="${box}" height="${box}" viewBox="${mark.viewBox}" preserveAspectRatio="xMidYMid meet">${mark.inner}</svg>`
    : `<text x="${size / 2}" y="${size / 2}" fill="${ink}" font-family="Georgia, 'Times New Roman', serif" font-size="${Math.round(size * 0.42)}" text-anchor="middle" dominant-baseline="central" letter-spacing="${Math.round(size * 0.01)}">${escapeXml(iconInitials(input.initials))}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${bg}"/>${face}</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * The per-event manifest. `start_url` and `scope` are the couple's own address,
 * so the installed tile opens THEIR invitation and stays inside it — an install
 * that lands on our homepage is not their wedding on their phone.
 */
export function buildEventManifest(input: {
  slug: string;
  displayName: string | null;
  eventDate?: string | null;
  background?: string | null;
}): Record<string, unknown> {
  const name = (input.displayName ?? '').trim() || 'Our celebration';
  const base = `/${input.slug}`;
  const bg = safeHex(input.background, DEFAULT_ICON_BG);
  return {
    name,
    // Home-screen labels are clipped around 12 characters on iOS and Android,
    // so the short name is the couple, never "Maria & Jose's Wedding Invitation".
    short_name: name.slice(0, 12),
    description: input.eventDate ? `${name} · ${input.eventDate}` : name,
    start_url: base,
    scope: base,
    id: base,
    display: 'standalone',
    orientation: 'portrait',
    theme_color: bg,
    background_color: bg,
    lang: 'en-PH',
    icons: [
      { src: `${base}/icon/192.svg`, sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: `${base}/icon/512.svg`, sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
      { src: `${base}/icon/512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${base}/icon/512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

/** The platforms the teaching card can be looking at. */
export type InstallPlatform = 'ios-safari' | 'ios-other' | 'android' | 'desktop' | 'installed';

/**
 * Which instructions to show. Deliberately a pure function of the two strings a
 * browser gives us, so it is testable — and so the iOS case, which has NO
 * install prompt and therefore needs words, is decided in one place.
 */
export function installPlatform(input: { userAgent: string; standalone: boolean }): InstallPlatform {
  if (input.standalone) return 'installed';
  const ua = (input.userAgent ?? '').toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua) || (/macintosh/.test(ua) && /mobile/.test(ua));
  if (isIOS) {
    // Every iOS browser renders in WebKit, but only Safari's share sheet
    // carries "Add to Home Screen". Chrome and Firefox on iOS cannot install.
    const isRealSafari = /safari/.test(ua) && !/crios|fxios|edgios|opios/.test(ua);
    return isRealSafari ? 'ios-safari' : 'ios-other';
  }
  if (/android/.test(ua)) return 'android';
  return 'desktop';
}

export const INSTALL_STEPS: Record<InstallPlatform, string[]> = {
  'ios-safari': [
    'Tap the Share button at the bottom of Safari.',
    'Scroll down and tap Add to Home Screen.',
    'Tap Add. The invitation appears as an icon.',
  ],
  'ios-other': [
    'Open this page in Safari — only Safari can add an icon on iPhone.',
    'Tap Share, then Add to Home Screen.',
  ],
  android: [
    'Tap Install below, or open the browser menu and tap Add to Home screen.',
    'Confirm, and the invitation appears as an icon.',
  ],
  desktop: ['Open this page on your phone to keep it on your home screen.'],
  installed: [],
};
