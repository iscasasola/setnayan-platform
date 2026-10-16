/**
 * apps/web/lib/art-kits.ts — A LOOK'S ART KIT: painted pieces in FIXED SLOTS on the guest page.
 *
 * Owner, 2026-10-16 (spec corpus DECISION_LOG "APPROVED — THE VINTAGE ART KIT, AS THE PROOF SHOWS"), verbatim:
 * *"Approved — build the vintage art kit as the proof shows (decorations come with the Vintage look, with an On/Off
 * switch)."* The proof: `prototypes/art_kit_cale_ice_2026-10-16.html` (corpus d5d3f726) — eight Higgsfield pieces
 * cut to transparent (A1–A8, `art_kit_cale_ice_2026-10-16/kit/`) and two SVG hairlines, each in ONE slot.
 * And on pricing, the same evening: *"the accents we added should be part of pro."* — `ART_KIT_IS_PRO` (`lib/art-kit-pro.ts`).
 *
 * ── 🔑 KEYED BY THE THEME'S ORNAMENT HOOK, NOT BY THE THEME ──────────────────────────────────────────────────────
 * `lib/invite-themes.ts` already names each theme's ornament set (`ornament: 'lace-postmark'` on Vintage, the spec's
 * "Ornament / frame" line). A kit is that key's full meaning: `ART_KITS[INVITE_THEMES[id].ornament]`. A theme with no
 * kit draws nothing — the page it renders is byte-identical to the page before this file.
 *
 * ── 🧩 THE SLOT MODEL IS DATA: piece + slot + scene ─────────────────────────────────────────────────────────────
 * A placement says WHICH piece, in WHICH slot, of WHICH guest scene, at what box and with what motion. Nothing about
 * a piece's position lives in a component — `KitSlot` (`app/[slug]/_components/kit-piece.tsx`) draws whatever this
 * list holds for the slot it is mounted at. A later per-scene picker (the owner asked how a couple ADDS accents to a
 * scene, 2026-10-16 — a separate design) writes into this same shape: a placement list per scene.
 *
 * ── WHAT IS NOT HERE ──────────────────────────────────────────────────────────────────────────────────────────────
 * · The church watercolour on the ceremony venue card (the proof's twelfth file) belongs to the venue-card build
 *   (`rd/venue-drawing`), not to this kit.
 * · Shimmer on the Event title belongs to the Cover Scene Edit/Animate build (sibling prototype), not to this kit.
 * · No price. Whether a kit costs anything rides on Event Hub Pro (`COUPLE_WEBSITE_PRO`), read live like every Pro
 *   look — never typed here.
 *
 * PURE — no React, no I/O: the guest page, the Studio and the guards read one list.
 */
import { INVITE_THEMES, normalizeThemeId, type InviteThemeId } from '@/lib/invite-themes';

import { ART_KIT_IS_PRO, decorationsOn } from '@/lib/art-kit-pro';

/* 💎 The price switch and the switch's reading live in `lib/art-kit-pro.ts` (kept out of the Maker's first load). */
export { ART_KIT_IS_PRO, ART_KIT_ORNAMENTS, decorationsChangeIsPro, decorationsOn } from '@/lib/art-kit-pro';

/** Where a piece is mounted. Each slot is ONE mount on the guest page (`KitSlot`), never two. */
export const ART_KIT_SLOTS = ['veil', 'cover', 'countdown', 'gifts-card', 'gifts-divider', 'reply', 'closing', 'heading'] as const;
export type ArtKitSlot = (typeof ART_KIT_SLOTS)[number];

/**
 * The guest scene a slot belongs to — the key a per-scene picker would file a placement under. The shipped scene
 * vocabulary where one exists (`WIDGET_TYPES`: `hero`, `countdown`, `rsvp`); the gifts and the page's own edges are
 * not widgets, so they are named as the page names them (`data-welcome-gifts`, the veil, the sign-off).
 */
export type ArtKitScene = 'veil' | 'hero' | 'countdown' | 'gifts' | 'rsvp' | 'sign-off' | 'every-heading';

export const ART_KIT_SLOT_SCENE: Readonly<Record<ArtKitSlot, ArtKitScene>> = {
  veil: 'veil',
  cover: 'hero',
  countdown: 'countdown',
  'gifts-card': 'gifts',
  'gifts-divider': 'gifts',
  reply: 'rsvp',
  closing: 'sign-off',
  heading: 'every-heading',
};

/** Sway (about the top edge — the drape on its rod, the araña on its chain) · Float (the florals) · still. */
export type ArtKitMotion = 'sway' | 'float' | 'still';

/**
 * One piece of art, as it ships in `public/`. Raster pieces ship AVIF with a WebP fallback, each cut at 2× its slot;
 * the hairlines ship as SVG. `w`×`h` is the piece's own CSS size at 1× (the files are twice that).
 */
export type ArtKitPiece = {
  /** The file's basename under the kit's folder. */
  file: string;
  formats: readonly ('avif' | 'webp' | 'svg')[];
  w: number;
  h: number;
  /** What the piece is — for the guard's messages and the registry's reader; never shown (every piece is decorative). */
  about: string;
};

/**
 * Where a piece sits inside its slot's host, in CSS — `left`/`right`/`top`/`bottom` as lengths, `width` the drawn
 * width (the height follows the piece's own ratio). `transform` is a STILL pose only (a mirrored or turned piece);
 * a moving piece mirrors through `mirror`, so its motion and its mirror never fight over one property.
 */
export type ArtKitBox = {
  left?: string;
  right?: string;
  top?: string;
  bottom?: string;
  width: string;
  transform?: string;
};

export type ArtKitPlacement<P extends string = string> = {
  piece: P;
  slot: ArtKitSlot;
  scene: ArtKitScene;
  box: ArtKitBox;
  motion: ArtKitMotion;
  /** Drawn mirrored (one drape, one column, one spray serve both sides). */
  mirror?: boolean;
  /** A motion's phase offset, seconds (the two drapes never swing in step). */
  delay?: number;
  /** A motion's period, seconds. */
  period?: number;
};

export type ArtKit<P extends string = string> = {
  /** The ornament key it answers (`InviteTheme.ornament`). */
  ornament: string;
  /** The folder under `public/` its files ship in. */
  dir: string;
  pieces: Readonly<Record<P, ArtKitPiece>>;
  placements: readonly ArtKitPlacement<P>[];
  /** The closing band's ground and its inks — the kit's colours, never the app's (the proof's Narra Brown). */
  closing: { band: string; ink: string; date: string; soon: string; photoHole: ArtKitEllipse };
};

/**
 * The closing oval's photo hole, FITTED FRONT-ON (the owner's second nit, 2026-10-16): the proof sat a 174×178 box
 * at the report's measured edges, and the photo ran out of the frame's right side — the frame is turned a little on
 * its stand, so its opening is an ellipse, not a box. These are the moments of the opening's own pixels (the
 * frame's transparent centre, flood-filled from the middle on alpha < 40, then fitted: centre, semi-axes, tilt), in
 * the frame's own CSS box (300 × 316), each semi-axis grown 3px so the frame's inner rim — drawn over the photo —
 * hides the photo's edge. Re-measure with the corpus's `src/matte.py` cut and the fit in this PR's notes.
 */
export type ArtKitEllipse = { cx: number; cy: number; rx: number; ry: number; tilt: number };

type VintagePiece =
  | 'wax-seal'
  | 'drape'
  | 'chandelier'
  | 'countdown-frame'
  | 'corner-floral'
  | 'fan'
  | 'rsvp-ornament'
  | 'closing-frame'
  | 'heading-flourish'
  | 'divider';

/**
 * 🕯 THE VINTAGE KIT (`ornament: 'lace-postmark'`) — the proof's slots, rule for rule, with the two fixes the owner was
 * told about: the drapes sit UNDER the cover's words and further out (they clipped the top line), and the oval's
 * photo fills the measured opening (above).
 */
const VINTAGE_KIT: ArtKit<VintagePiece> = {
  ornament: 'lace-postmark',
  dir: '/art-kits/vintage',
  pieces: {
    'wax-seal': { file: 'wax-seal', formats: ['avif', 'webp'], w: 84, h: 86, about: 'Wax seal (A6), rosewood, centre blank for the mark' },
    drape: { file: 'drape', formats: ['avif', 'webp'], w: 109, h: 260, about: 'Ivory tied drape with a gold tassel (A1)' },
    chandelier: { file: 'chandelier', formats: ['avif', 'webp'], w: 140, h: 203.5, about: 'Brass araña with candles and crystal drops (A7)' },
    'countdown-frame': { file: 'countdown-frame', formats: ['avif', 'webp'], w: 90, h: 150, about: 'Narra post with a capiz window and sampaguita (A2)' },
    'corner-floral': { file: 'corner-floral', formats: ['avif', 'webp'], w: 150, h: 146.5, about: 'Corner spray of white roses (A3)' },
    fan: { file: 'fan', formats: ['avif', 'webp'], w: 150, h: 111.5, about: 'Lace abaniko, half open (A8)' },
    'rsvp-ornament': { file: 'rsvp-ornament', formats: ['avif', 'webp'], w: 343, h: 215.5, about: 'White rose and fern garland (A4)' },
    'closing-frame': { file: 'closing-frame', formats: ['avif', 'webp'], w: 300, h: 316, about: 'Ivory openwork oval frame (A5)' },
    'heading-flourish': { file: 'heading-flourish', formats: ['svg'], w: 132, h: 24, about: 'Rose and sampaguita vine — the rule after a section eyebrow' },
    divider: { file: 'divider', formats: ['svg'], w: 300, h: 24, about: 'Capiz diamonds on a narra hairline, a sampaguita medallion' },
  },
  placements: [
    // The veil: the closed door gets its seal, just above "Tap or swipe up to unveil" — the seal is the veil's own tap.
    { piece: 'wax-seal', slot: 'veil', scene: 'veil', box: { left: 'calc(50% - 42px)', bottom: '0px', width: '84px' }, motion: 'still' },
    // The cover: a drape at each side from the rod, the araña between them. UNDER the words (the slot's layer sits
    // beneath the cover's text) and further out than the proof (60px of each drape shows, not 79).
    { piece: 'drape', slot: 'cover', scene: 'hero', box: { left: '-40px', top: '-6px', width: '100px' }, motion: 'sway', period: 7 },
    { piece: 'drape', slot: 'cover', scene: 'hero', box: { right: '-40px', top: '-6px', width: '100px' }, motion: 'sway', period: 7, mirror: true, delay: -3.2 },
    { piece: 'chandelier', slot: 'cover', scene: 'hero', box: { left: 'calc(50% - 70px)', top: '-8px', width: '140px' }, motion: 'sway', period: 9, delay: -1.5 },
    // The countdown card: a narra post at each edge, overlapping the card's top; the card's sides grow so "62" stands clear.
    { piece: 'countdown-frame', slot: 'countdown', scene: 'countdown', box: { left: '-38px', top: '-18px', width: '72px' }, motion: 'still' },
    { piece: 'countdown-frame', slot: 'countdown', scene: 'countdown', box: { right: '-38px', top: '-18px', width: '72px' }, motion: 'still', mirror: true },
    // The e-gifts bank card: the spray over its top-right corner (floats), the abaniko laid over its lower-right corner.
    { piece: 'corner-floral', slot: 'gifts-card', scene: 'gifts', box: { right: '-30px', top: '-58px', width: '150px' }, motion: 'float', period: 6, mirror: true, delay: -2.4 },
    { piece: 'fan', slot: 'gifts-card', scene: 'gifts', box: { right: '-50px', bottom: '-34px', width: '150px', transform: 'scaleX(-1) rotate(-14deg)' }, motion: 'still' },
    // Between the countdown and E-gifts: the divider, centred.
    { piece: 'divider', slot: 'gifts-divider', scene: 'gifts', box: { left: 'calc(50% - 150px)', top: '0px', width: '300px' }, motion: 'still' },
    // Reply: the garland over the reply card's top edge (the card's top grows to clear its dip).
    { piece: 'rsvp-ornament', slot: 'reply', scene: 'rsvp', box: { left: 'calc(50% - min(171.5px, 50%))', top: '0px', width: 'min(343px, 100%)' }, motion: 'float', period: 6 },
    // The closing oval (the photo inside it is the couple's — `KitClosing`).
    { piece: 'closing-frame', slot: 'closing', scene: 'sign-off', box: { left: '0px', top: '0px', width: '300px' }, motion: 'still' },
    // Every section eyebrow: the flourish replaces the plain rule (drawn by the kit's stylesheet, below).
    { piece: 'heading-flourish', slot: 'heading', scene: 'every-heading', box: { width: '132px' }, motion: 'still' },
  ],
  closing: {
    band: '#6B4226',
    ink: '#F7F2EC',
    date: '#F3E5B9',
    soon: '#9A4A2C',
    photoHole: { cx: 121.4, cy: 169.8, rx: 78.1, ry: 105.5, tilt: 3.1 },
  },
};

/** Every kit, by the ornament key that asks for it. One today. */
export const ART_KITS: Readonly<Record<string, ArtKit>> = {
  [VINTAGE_KIT.ornament]: VINTAGE_KIT as ArtKit,
};

/** The kit a theme's ornament asks for, or null (most themes: no kit, nothing drawn). */
export function artKitFor(theme: InviteThemeId | null | undefined): ArtKit | null {
  if (!theme) return null;
  return ART_KITS[INVITE_THEMES[theme].ornament] ?? null;
}

/** …from a stored theme value (a retired id read as its alias, as `resolveInviteTheme` reads it). */
export function artKitForSaved(saved: unknown): ArtKit | null {
  return artKitFor(normalizeThemeId(saved));
}

/**
 * 🎚 THE ONE DECISION — does this page draw its kit?
 *
 *  · the RESOLVED theme (already gated: a Pro theme whose unlock lapsed is House here) carries a kit;
 *  · the couple's switch is not off;
 *  · and, while `ART_KIT_IS_PRO`, the event owns Event Hub Pro — or this is the host's own Maker canvas, where every
 *    Pro look is tried free (`tryOn`), never a guest's page.
 *
 * `isPro` is a parameter so the guard holds both values of the constant without editing it.
 */
export function artKitShows(input: {
  theme: InviteThemeId | null | undefined;
  decorations: unknown;
  ownsPro: boolean;
  tryOn: boolean;
  isPro?: boolean;
}): ArtKit | null {
  const kit = artKitFor(input.theme);
  if (!kit) return null;
  if (!decorationsOn(input.decorations)) return null;
  const pro = input.isPro ?? ART_KIT_IS_PRO;
  if (pro && !input.ownsPro && !input.tryOn) return null;
  return kit;
}

/** The placements of one slot, in order. */
export function kitPlacements(kit: ArtKit, slot: ArtKitSlot): readonly ArtKitPlacement[] {
  return kit.placements.filter((p) => p.slot === slot);
}

/** A piece's file path for one format (`/art-kits/vintage/drape.avif`). */
export function kitFile(kit: ArtKit, piece: ArtKitPiece, format: 'avif' | 'webp' | 'svg'): string {
  return `${kit.dir}/${piece.file}.${format}`;
}

/** Every file a kit ships — what the byte guard sums. */
export function kitFiles(kit: ArtKit): string[] {
  const out = new Set<string>();
  for (const piece of Object.values(kit.pieces) as ArtKitPiece[]) for (const f of piece.formats) out.add(kitFile(kit, piece, f));
  return [...out];
}

/** A kit's ceiling, in bytes, across every file it ships (both raster formats counted): 600 KB. */
export const ART_KIT_BYTE_CEILING = 600 * 1024;

/* ── THE STYLESHEET ─────────────────────────────────────────────────────────────────────────────────────────────── */

/**
 * Everything a kit needs, as ONE stylesheet string — drawn inline beside the page ONLY where a kit shows (the shape of
 * `AMBIENT_EFFECT_CSS`), so a page without one carries none of it.
 *
 * MOTION: two keyframes of the kit's own. `sn-fx-sway` (`lib/ambient-effects.ts`) was the first choice and does not
 * fit: it is a petal's fall — ±14px of drift and a FIXED −28°…32° turn — and its turn cannot be scaled down, so a
 * drape on it would spin. These move only `rotate` / `translate` (individual transforms, so a mirrored piece keeps
 * its `scale` and a moving one never fights it).
 *  · a moving piece is PAUSED until `ArtKitMotion` marks it on screen (`data-kit-live`) — it animates only while seen;
 *  · reduce motion = a still: the animation is taken off, the piece stands at rest. (globals.css answers reduce
 *    motion with `animation-duration:.001ms!important` inside a layer; that ends an animation at its start, which is
 *    this same rest pose — and `animation-name:none` here asks nothing of it.)
 *
 * THE PAGE: a piece may hang past the page's edge (the proof's posts and spray do), so the page clips sideways where
 * a kit is drawn — `clip`, not `hidden`, which would make a scroll container and break every sticky bar.
 */
export function artKitCss(kit: ArtKit): string {
  const flourish = kit.pieces['heading-flourish' as keyof typeof kit.pieces] as ArtKitPiece | undefined;
  const flourishRule = flourish
    ? /* 🌹 The section eyebrows' plain rule becomes the flourish. Only inside the guest page's editorial scope, the
         same scope that draws the rule. */
      `.sn-editorial .pahina-eyebrow::after{width:${flourish.w}px;max-width:40vw;height:${flourish.h}px;background:url("${kitFile(kit, flourish, 'svg')}") left center/contain no-repeat;opacity:1}`
    : '';
  return (
    'html:has([data-art-kit]){overflow-x:clip}' +
    '[data-kit-slot]{pointer-events:none}' +
    '[data-kit-slot] picture,[data-kit-slot] img{display:block;width:100%;height:auto}' +
    '[data-kit-piece]{position:absolute;line-height:0}' +
    '[data-kit-motion]{animation-play-state:paused;animation-direction:alternate;animation-iteration-count:infinite;animation-timing-function:ease-in-out}' +
    '[data-kit-motion][data-kit-live]{animation-play-state:running}' +
    '[data-kit-motion="sway"]{transform-origin:50% 0;animation-name:sn-kit-sway}' +
    '[data-kit-motion="float"]{animation-name:sn-kit-float}' +
    '[data-kit-mirror]{scale:-1 1}' +
    '@keyframes sn-kit-sway{from{rotate:-1.3deg}to{rotate:1.1deg}}' +
    '@keyframes sn-kit-float{from{translate:0 0;rotate:0deg}to{translate:0 -6px;rotate:1.4deg}}' +
    '@media (prefers-reduced-motion:reduce){[data-kit-motion]{animation-name:none!important}}' +
    /* The cover: the kit's layer sits UNDER the words — the cover's header becomes its own stacking context, the layer
       goes beneath its in-flow words and above its ground (the ground is −10). */
    'header:has(>[data-kit-slot="cover"]){position:relative;isolation:isolate}' +
    '[data-kit-slot="cover"]{position:absolute;z-index:-1;top:calc(-1 * var(--cover-scene-pad,0px));left:50%;translate:-50% 0;width:min(100vw,40rem);height:280px;overflow:visible}' +
    /* The countdown card holds its posts and grows at the sides so the numbers stand clear of them. */
    '[data-scene-card]:has(>[data-kit-slot="countdown"]){position:relative;padding-inline:2.5rem}' +
    '[data-kit-slot="countdown"],[data-kit-slot="gifts-card"],[data-kit-slot="reply"]{position:absolute;inset:0}' +
    /* The bank card shows what overlaps its corners, and its words stay above the art. */
    'li:has(>[data-kit-slot="gifts-card"]){position:relative;overflow:visible}' +
    'li:has(>[data-kit-slot="gifts-card"])>:not([data-kit-slot]){position:relative;z-index:1}' +
    '[data-kit-slot="gifts-card"]{z-index:0}' +
    /* The reply card's top grows to clear the garland's dip. */
    '[data-reply-card]:has(>[data-kit-slot="reply"]){position:relative;padding-top:9.5rem}' +
    '[data-kit-slot="gifts-divider"]{display:block;position:relative;height:24px;margin:0 auto 1.25rem;max-width:100%}' +
    '[data-kit-slot="veil"]{position:absolute;left:0;right:0;height:86px}' +
    flourishRule
  );
}
