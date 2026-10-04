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
 * ⚠ 2026-09-30: the on-page TEACHING card is gone (owner, on the Event Hub:
 * "remove this part on the website"), and with it `installPlatform` /
 * `INSTALL_STEPS`, which had no other reader. The manifest and the icon below
 * are untouched — installing from the browser's own menu still gets the
 * couple's tile, not ours.
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
 * The label under the icon.
 *
 * 🔴 SEEN IN PRODUCTION, 2026-09-20, minutes after this shipped: a plain
 * 12-character slice turned "Indalecio & Claire" into **"Indalecio & "** —
 * clipped mid-phrase, ending on an ampersand and a space. A home screen shows
 * about a dozen characters, so the label has to be CHOSEN, not cut.
 *
 * In order: the whole name when it fits; else the first partner's name, which
 * is what a person would say out loud; else a hard cut with trailing
 * punctuation and whitespace removed, so it can never end on "&" or a comma.
 */
export function homeScreenLabel(raw: string | null | undefined, max = 12): string {
  const name = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (name.length === 0) return 'Invitation';
  if (name.length <= max) return name;
  // Trailing punctuation is stripped on EVERY path, not just the hard cut:
  // "Maria, Jose, and everyone else" splits to "Maria, Jose," which fits but
  // still ends on a comma.
  const tidy = (v: string) => v.replace(/[\s&+,.;:·-]+$/, '').trim();
  const firstPartner = tidy(name.split(/\s*(?:&|\+|\band\b)\s*/i)[0]?.trim() ?? '');
  if (firstPartner.length > 0 && firstPartner.length <= max) return firstPartner;
  const cut = tidy(name.slice(0, max));
  return cut.length > 0 ? cut : name.slice(0, max).trim();
}

/**
 * 🔑 THE TAGS THAT MAKE A HOME-SCREEN SHORTCUT THE COUPLE'S — ONE copy, read by
 * every page a guest may add to their home screen: the Event Hub
 * (`app/[slug]/page.tsx`) and the thank-you that carries the one quiet
 * "Keep it handy" line (`app/[slug]/invite/enter/page.tsx`, owner 2026-10-03).
 * The per-event manifest names THAT event as the tile's start; iOS ignores
 * manifest icons, so the apple-touch-icon is named separately; and
 * `appleWebApp.title` is the label under the icon — without it iOS writes
 * "Setnayan" under a couple's monogram.
 */
export function eventShortcutMetadata(
  slug: string,
  displayName: string | null | undefined,
  opts: { reentryCode?: string | null } = {},
) {
  // 📲 The thank-you's tile carries the guest in (I9, 2026-10-04): a manifest
  // whose start address spends a one-time re-entry code (`?k=`), because an
  // iPhone home-screen web app keeps its own cookies. See the manifest route.
  const tileQuery = opts.reentryCode ? `?${new URLSearchParams({ k: opts.reentryCode }).toString()}` : '';
  return {
    manifest: `/${slug}/manifest.webmanifest${tileQuery}`,
    appleWebApp: {
      capable: true,
      title: displayName || 'Invitation',
      statusBarStyle: 'default' as const,
    },
    icons: {
      icon: [
        { url: `/${slug}/icon/192.svg`, type: 'image/svg+xml', sizes: '192x192' },
        { url: `/${slug}/icon/512.png`, type: 'image/png', sizes: '512x512' },
      ],
      apple: [
        { url: `/${slug}/icon/180.png`, sizes: '180x180', type: 'image/png' },
        { url: `/${slug}/icon/167.png`, sizes: '167x167', type: 'image/png' },
        { url: `/${slug}/icon/152.png`, sizes: '152x152', type: 'image/png' },
      ],
    },
  };
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
  /** The tile's first open, when it must carry a guest in (a path inside `base`). Default: `base`. */
  startUrl?: string | null;
}): Record<string, unknown> {
  const name = (input.displayName ?? '').trim() || 'Our celebration';
  const base = `/${input.slug}`;
  const start = input.startUrl && input.startUrl.startsWith(`${base}/`) ? input.startUrl : base;
  const bg = safeHex(input.background, DEFAULT_ICON_BG);
  return {
    name,
    short_name: homeScreenLabel(name),
    description: input.eventDate ? `${name} · ${input.eventDate}` : name,
    start_url: start,
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
