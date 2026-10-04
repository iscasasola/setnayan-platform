/**
 * THE NAVIGATOR'S TILE PREVIEWS — a real, scaled-down picture of each section
 * exactly as the canvas draws it (owner 2026-09-26, verbatim: *"the navigator
 * preview must really show the preview. it is so hard to see what i will edit
 * because i do not see it."*).
 *
 * 🔴 WHAT WAS WRONG. Each tile was a beige card built from the section's own
 * WORDS (`maker-navigator-data.ts` → "TOGETHER W…", "COUNTING D…", "RUN OF
 * SHOW"). No theme, no photo, no layout — a label dressed as a thumbnail.
 *
 * ── HOW, AND WHY THIS WAY (measured, not assumed) ─────────────────────────
 * The canvas iframe is same-origin and has ALREADY rendered every section, with
 * the couple's theme, fonts, photos and layout, at the device width being
 * edited. So a tile does not render anything itself: it takes a STATIC COPY of
 * that one section out of the canvas and shows it in a tiny script-less
 * document (`<iframe srcdoc sandbox="allow-same-origin">`), scaled down.
 *
 *   · vs. a DOM-to-image rasteriser: none ships in `package.json`; a rasteriser
 *     must re-fetch every photo and font as a data URL (and R2 photos are
 *     cross-origin), and cannot draw a playing `<video>`. The copy reuses the
 *     very URLs the canvas already loaded — the browser cache answers them.
 *   · vs. a mini iframe of the whole page per tile: each would be a full server
 *     render + hydration + the stage's opening, sixteen times. The copy is one
 *     `outerHTML` and no script at all.
 *   · vs. cloning into the Maker's own document: the section's CSS is keyed to
 *     its ancestors (the theme scope, the editorial fonts on `<html>`) and to
 *     the canvas's VIEWPORT (`vw`, `svh`, `fixed inset-0` — the Save-the-Date
 *     film). A document of its own, sized like the canvas, gets all three right.
 *
 * Only the tiles on screen mount a document (the navigator's own scroller is
 * the observer root), so sixteen sections cost what four or five do.
 *
 * Pure: no DOM. The half that reads the canvas lives beside the navigator
 * (`app/dashboard/[eventId]/website/editor/_components/scene-snapshot.ts`).
 */

import { heroDesignCropAnchor, type HeroDesignId } from '@/lib/hero-design';

/** An element's attributes, in order, as `[name, value]`. */
export type TileAttr = readonly [name: string, value: string];

/** One ancestor of the section, kept as its tag and attributes (never its other children). */
export type TileAncestor = { tag: string; attrs: readonly TileAttr[] };

export type TileSnapshot = {
  /** The navigator key (`f:hero`, `w:countdown`, …). */
  key: string;
  /** `outerHTML` of the section, already made static (`staticSectionHtml`). */
  section: string;
  /** From `<body>` down to the section's parent, outermost first. */
  chain: readonly TileAncestor[];
  /** The canvas's width when it was copied — the tile document is this wide. */
  frameWidth: number;
};

/**
 * 🌄 THE PAGE'S GROUND — the theme's backdrop (its poster photo, its colour),
 * a `fixed inset-0 -z-10` layer every scene floats over (`[data-guest-ground]`).
 * It is a SIBLING of the page, never an ancestor of a section, so a copy made
 * from the section alone came out on bare white: the owner's iPhone, 2026-10-05,
 * "Guest's look" a plain white tile, "Reminders" white with only its eye. Each
 * ground travels with its own theme scope, already made static (no autoplay).
 */
export type TileGround = { chain: readonly TileAncestor[]; html: string };

export type TileHead = {
  htmlAttrs: readonly TileAttr[];
  bodyAttrs: readonly TileAttr[];
  /** Serialized `<link rel=stylesheet>` and `<style>` elements, in document order. */
  styles: readonly string[];
  /** The page's ground layers, in document order (absent = the page draws none). */
  grounds?: readonly TileGround[];
};

/**
 * Classes that only mean something while the canvas's own script runs:
 *   · `pahina-js` — the scroll-reveal's "hidden until seen" state. A copy has
 *     no observer, so keeping it would leave chapters invisible forever.
 *   · `hub-*` — the Scroll · Scrub · Auto machinery (pinned screens, stacked
 *     auto cells, timeline names). A tile shows the section at rest.
 */
const DROP_CLASS = /^(pahina-js|hub-[a-z0-9-]+)$/;

/** Inline custom properties that drive that same machinery. */
const DROP_STYLE_PROP = /^--hub-/;

/** Only attributes that style or theme survive on the copied ancestors. */
const KEEP_ANCESTOR_ATTR = /^(class|style|id|lang|dir|data-[\w-]+)$/;

export function filterTileAttrs(attrs: readonly TileAttr[]): TileAttr[] {
  const out: TileAttr[] = [];
  for (const [name, value] of attrs) {
    const n = name.toLowerCase();
    if (!KEEP_ANCESTOR_ATTR.test(n)) continue;
    // The canvas's own editor bookkeeping never travels.
    if (n.startsWith('data-setnayan-editor') || n === 'data-maker-section') continue;
    if (n === 'class') {
      const kept = value
        .split(/\s+/)
        .filter((c) => c && !DROP_CLASS.test(c))
        .join(' ');
      if (kept) out.push(['class', kept]);
      continue;
    }
    if (n === 'style') {
      const kept = value
        .split(';')
        .map((d) => d.trim())
        .filter((d) => d && !DROP_STYLE_PROP.test(d.split(':')[0]!.trim()))
        .join('; ');
      if (kept) out.push(['style', kept]);
      continue;
    }
    out.push([n, value]);
  }
  return out;
}

export function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function attrString(attrs: readonly TileAttr[]): string {
  return attrs.map(([n, v]) => ` ${n}="${escapeAttr(v)}"`).join('');
}

/** Tag names are copied from the DOM; anything else is refused as a plain div. */
function safeTag(tag: string): string {
  const t = tag.toLowerCase();
  return /^[a-z][a-z0-9-]*$/.test(t) && t !== 'script' && t !== 'iframe' ? t : 'div';
}

/**
 * Freezes the copy at rest: no entrance animations (they would replay in every
 * tile and start from opacity 0), no scroll-driven timelines, no transitions,
 * no scrollbars, and none of the app's floating notices.
 */
export const TILE_FREEZE_CSS = [
  '*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important;caret-color:transparent!important}',
  'html,body{overflow:hidden!important;scrollbar-width:none!important}',
  'html::-webkit-scrollbar,body::-webkit-scrollbar{display:none}',
  '[data-app-chrome]{display:none!important}',
  '[data-snm-embed]{display:block;background:rgba(120,110,95,.14)}',
].join('');

/**
 * 🎴 A HERO DESIGN THAT SITS LOW IS CUT FROM THE BOTTOM. The tile shows the
 * section from its top edge (`overflow:hidden`), which is right for every
 * design but The Letter, whose names and date are anchored low — a top crop
 * showed a mark in a corner and no names (DECISION_LOG 2026-09-26, the finding
 * recorded with the design set: *"its cover needs its own crop (anchor on the
 * names)"*). When the copied hero carries `data-hero-design` with a bottom
 * anchor, the document's body is pinned to the viewport's foot, so the tile
 * keeps the names. Pure CSS — the tile document runs no script.
 */
export const TILE_ANCHOR_BOTTOM_CSS =
  'body{position:absolute!important;left:0!important;right:0!important;top:auto!important;bottom:0!important;min-height:0!important}';

/** The crop edge the copied section asks for (see `heroDesignCropAnchor`). */
export function tileCropAnchor(sectionHtml: string): 'top' | 'bottom' {
  const m = /\sdata-hero-design="([a-z]+)"/.exec(sectionHtml);
  return m && heroDesignCropAnchor(m[1] as HeroDesignId) === 'bottom' ? 'bottom' : 'top';
}

/** The whole tile document. Static: the tile iframe is sandboxed WITHOUT scripts. */
export function buildTileDocument(head: TileHead, snap: TileSnapshot): string {
  const open = snap.chain.map((a) => `<${safeTag(a.tag)}${attrString(filterTileAttrs(a.attrs))}>`).join('');
  const close = [...snap.chain]
    .reverse()
    .map((a) => `</${safeTag(a.tag)}>`)
    .join('');
  const anchor = tileCropAnchor(snap.section) === 'bottom' ? `<style>${TILE_ANCHOR_BOTTOM_CSS}</style>` : '';
  /* 🌄 The ground first, under everything — each inside its own theme scope. */
  const grounds = (head.grounds ?? [])
    .map(
      (g) =>
        g.chain.map((a) => `<${safeTag(a.tag)}${attrString(filterTileAttrs(a.attrs))}>`).join('') +
        g.html +
        [...g.chain]
          .reverse()
          .map((a) => `</${safeTag(a.tag)}>`)
          .join(''),
    )
    .join('');
  return (
    `<!doctype html><html${attrString(filterTileAttrs(head.htmlAttrs))}><head><meta charset="utf-8">` +
    head.styles.join('') +
    `<style>${TILE_FREEZE_CSS}</style>${anchor}</head>` +
    `<body${attrString(filterTileAttrs(head.bodyAttrs))}>${grounds}${open}${snap.section}${close}</body></html>`
  );
}

/** The tile's shape per device — the SAME ratios the tile box already draws. */
export const TILE_ASPECT: Record<'desktop' | 'phone', number> = {
  desktop: 16 / 10,
  phone: 9 / 19.5,
};

/**
 * The tile document's own viewport and the scale that fits it into the tile.
 * The document is as wide as the canvas was (so the section lays out exactly as
 * it does there) and as tall as the tile's shape needs.
 */
export function tileFrame(
  device: 'desktop' | 'phone',
  frameWidth: number,
  tileWidth: number,
): { width: number; height: number; scale: number } {
  const width = Math.max(1, Math.round(frameWidth));
  const height = Math.max(1, Math.round(width / TILE_ASPECT[device]));
  const scale = tileWidth > 0 ? tileWidth / width : 0;
  return { width, height, scale };
}
