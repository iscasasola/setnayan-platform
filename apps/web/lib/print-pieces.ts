/**
 * lib/print-pieces.ts — PRINTS & TICKETS, the pure half.
 *
 * Event Hub Maker Phase 9 (`EVENT_HUB_MAKER_BUILD_PLAN_2026-09-25.md`), owner
 * rulings in DECISION_LOG 2026-09-24/25:
 *   · "printables that align to their event hub"  → every piece wears the theme
 *     the couple chose (`lib/invite-themes.ts`), never a print-only look;
 *   · "print outs are pro feature. but we can show them a sample. just
 *     compressed so not print ready"             → `printAccess` below;
 *   · "the free version is the PDF of QRs if they want to do it themselves" /
 *     "found on Guestlist"                        → the `qr-codes` piece is free
 *     for every event and lives on the Guest list, not in the Maker;
 *   · media themes print the loop's FIRST frame (`<slug>-poster.jpg`, paper
 *     cannot move); Classic prints on paper alone (THEMES-2026-09-24.md).
 *
 * Sizes are the spec's: event pass CR80 3.375 × 2.125 in · invitation 3 cards
 * 5 × 7 in · welcome/QR poster A3 297 × 420 mm · event card 3 : 4. Safe area
 * 5 mm, bleed 3 mm.
 *
 * PURE. No I/O, no `server-only` — the Node test runner loads it, and so can a
 * client component that needs a piece's name.
 */
import { formatWallClock } from '@/lib/schedule-datetime-local';
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';

/** 72 PDF points to the inch. */
export const PT_PER_IN = 72;
export const PT_PER_MM = 72 / 25.4;

/** The print standard (THEMES-2026-09-24.md "Print"). */
export const BLEED_MM = 3;
export const SAFE_MM = 5;

export type PrintPieceKey =
  | 'invitation'
  | 'entourage'
  | 'details'
  | 'pass'
  | 'poster'
  | 'card'
  | 'passes'
  | 'qr-codes';

export type PrintPieceSpec = {
  key: PrintPieceKey;
  /** What a couple reads. */
  label: string;
  /** One line under the name: the size, as a printer asks for it. */
  size: string;
  /** Trim size in points. */
  widthPt: number;
  heightPt: number;
  /** In the themed set (samples + Pro PDF), or a utility (the per-guest batch, the free QR sheet). */
  kind: 'set' | 'batch' | 'free';
};

const inch = (n: number) => n * PT_PER_IN;
const mm = (n: number) => n * PT_PER_MM;

/**
 * The themed set, in the order the Maker shows it: the three invitation cards
 * first (the owner is at the Invitation stage), then the pass, the poster and
 * the event card.
 */
export const PRINT_PIECES: Record<PrintPieceKey, PrintPieceSpec> = {
  invitation: { key: 'invitation', label: 'The Invitation', size: '5 × 7 in', widthPt: inch(5), heightPt: inch(7), kind: 'set' },
  entourage: { key: 'entourage', label: 'The Entourage', size: '5 × 7 in', widthPt: inch(5), heightPt: inch(7), kind: 'set' },
  details: { key: 'details', label: 'The Finer Details', size: '5 × 7 in', widthPt: inch(5), heightPt: inch(7), kind: 'set' },
  // CR80 — a real card size; a business card (3.5 × 2) is 4 % wider.
  // The pass's real size is its FORMAT (calling card by default) — see PRINT_FORMATS.
  pass: { key: 'pass', label: 'Event pass', size: 'Calling card · train · boarding pass', widthPt: 90 * (72 / 25.4), heightPt: 54 * (72 / 25.4), kind: 'set' },
  poster: { key: 'poster', label: 'Welcome poster', size: 'A3 · 297 × 420 mm', widthPt: mm(297), heightPt: mm(420), kind: 'set' },
  // Laid out at 3 : 4 and fitted to its FORMAT (A5 by default, or an index card).
  card: { key: 'card', label: 'Event card', size: 'A5 · index card', widthPt: inch(4.5), heightPt: inch(6), kind: 'set' },
  passes: { key: 'passes', label: 'Every guest’s pass', size: 'ganged on A4 with cut lines', widthPt: 90 * (72 / 25.4), heightPt: 54 * (72 / 25.4), kind: 'batch' },
  'qr-codes': { key: 'qr-codes', label: 'QR codes', size: 'A4 · every guest', widthPt: mm(210), heightPt: mm(297), kind: 'free' },
};

/** The six themed pieces, in the Maker's order. */
export const PRINT_SET_KEYS = ['invitation', 'entourage', 'details', 'pass', 'poster', 'card'] as const satisfies readonly PrintPieceKey[];
export type PrintSetKey = (typeof PRINT_SET_KEYS)[number];

export function isPrintSetKey(v: unknown): v is PrintSetKey {
  return typeof v === 'string' && (PRINT_SET_KEYS as readonly string[]).includes(v);
}

// ─── Formats — the couple picks one per piece ───────────────────────────────

/**
 * THE FORMAT REGISTRY. Owner 2026-09-25, verbatim: *"event pass can be a calling
 * card size or train ticket, plane ticket. Event card can be index card / a5"*.
 * Each format is a real trim size in millimetres, and each theme LAYS OUT in it
 * (the pass is parametric; the cards are laid out at their design size and
 * fitted without stretching) — never a stretched copy.
 *
 * `sheet` = how many print-ready copies gang onto one A4 for the per-guest pass
 * batch (bleeds touching, cut lines in the margins), and whether that A4 is
 * turned landscape to fit. Add a format by adding a row.
 */
export type PrintFormatId =
  | 'calling-card'
  | 'cr80'
  | 'train'
  | 'boarding'
  | 'inv-5x7'
  | 'inv-a5'
  | 'card-a5'
  | 'index-5x3'
  | 'index-6x4';

export type PrintFormat = {
  id: PrintFormatId;
  /** Which pieces may wear it. */
  for: 'pass' | 'invitation' | 'card';
  label: string;
  wMm: number;
  hMm: number;
  /** The pass's composition in this format. */
  style?: 'card' | 'train' | 'boarding';
  /** Imposition on A4 (per-guest batch). */
  sheet?: { cols: number; rows: number; landscape: boolean };
};

export const PRINT_FORMATS: Record<PrintFormatId, PrintFormat> = {
  // The PH calling card: 3.5 × 2 in.
  'calling-card': { id: 'calling-card', for: 'pass', label: 'Calling card', wMm: 90, hMm: 54, style: 'card', sheet: { cols: 2, rows: 4, landscape: false } },
  // CR80 — the ID-card size the build plan specified; kept as an option.
  cr80: { id: 'cr80', for: 'pass', label: 'ID card (CR80)', wMm: 85.725, hMm: 53.975, style: 'card', sheet: { cols: 2, rows: 4, landscape: false } },
  train: { id: 'train', for: 'pass', label: 'Train ticket', wMm: 140, hMm: 70, style: 'train', sheet: { cols: 1, rows: 3, landscape: false } },
  // Boarding pass 3.25 × 8 in — Table · Seat · Time where a gate and seat would be.
  boarding: { id: 'boarding', for: 'pass', label: 'Boarding pass', wMm: 203, hMm: 82, style: 'boarding', sheet: { cols: 1, rows: 2, landscape: true } },
  'inv-5x7': { id: 'inv-5x7', for: 'invitation', label: '5 × 7 in', wMm: 127, hMm: 177.8 },
  'inv-a5': { id: 'inv-a5', for: 'invitation', label: 'A5', wMm: 148, hMm: 210 },
  'card-a5': { id: 'card-a5', for: 'card', label: 'A5', wMm: 148, hMm: 210 },
  'index-5x3': { id: 'index-5x3', for: 'card', label: 'Index card 5 × 3 in', wMm: 127, hMm: 76.2 },
  'index-6x4': { id: 'index-6x4', for: 'card', label: 'Index card 6 × 4 in', wMm: 152.4, hMm: 101.6 },
};

export const DEFAULT_FORMAT: Record<PrintFormat['for'], PrintFormatId> = {
  pass: 'calling-card',
  invitation: 'inv-5x7',
  card: 'card-a5',
};

/** Which format family a piece wears (the poster is A3, always). */
export function formatFamilyOf(piece: PrintPieceKey): PrintFormat['for'] | null {
  if (piece === 'pass' || piece === 'passes') return 'pass';
  if (piece === 'invitation' || piece === 'entourage' || piece === 'details') return 'invitation';
  if (piece === 'card') return 'card';
  return null;
}

/** The format a piece is drawn in — the asked one when it fits the piece, else the default. */
export function formatFor(piece: PrintPieceKey, asked?: string | null): PrintFormat | null {
  const family = formatFamilyOf(piece);
  if (!family) return null;
  const hit = asked && Object.prototype.hasOwnProperty.call(PRINT_FORMATS, asked) ? PRINT_FORMATS[asked as PrintFormatId] : null;
  return hit && hit.for === family ? hit : PRINT_FORMATS[DEFAULT_FORMAT[family]];
}

export function formatsFor(family: PrintFormat['for']): PrintFormat[] {
  return Object.values(PRINT_FORMATS).filter((f) => f.for === family);
}

export function isPrintPieceKey(v: unknown): v is PrintPieceKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(PRINT_PIECES, v);
}

// ─── Die-cut shapes, per theme ──────────────────────────────────────────────

/**
 * ⚖ EVERY PER-THEME TABLE IN THIS FILE IS A `Record<InviteThemeId, …>` — keyed
 * by the ONE registry's type, never a second list of ids (`invite-themes.test.ts`
 * "no file outside the registry declares the theme list"). A theme added to the
 * registry fails to COMPILE here until it is given its print look.
 *
 * The sheet's outline, as the print shop cuts it (THEMES-2026-09-24.md "Print"
 * per theme): Whimsical is scalloped, Cinderella arch-cut, Great Gatsby a
 * chevron-cut top, Rustic a deckled edge, Cyber a softly rounded card. The rest
 * are straight-cut. Drawn on its own "Die cut" layer in the print-ready PDF.
 */
export type DieCut = 'rect' | 'rounded' | 'scallop' | 'arch' | 'chevron' | 'deckle';

export const DIE_CUTS: Record<InviteThemeId, DieCut> = {
  house: 'rect',
  abaca: 'deckle',
  galeriya: 'rect',
  cinderella: 'arch',
  velvet: 'rect',
  vintage: 'rounded',
  whimsical: 'scallop',
  regency: 'arch',
  gatsby: 'chevron',
  cyber: 'rounded',
};

/**
 * The die-cut applies to the invitation cards and the event card. The pass is
 * CR80 (rounded corners are the card standard) and the poster is A3 flat —
 * cutting a poster into an arch is not something a print shop quotes.
 */
export function dieCutFor(theme: InviteThemeId, piece: PrintPieceKey): DieCut {
  if (piece === 'pass' || piece === 'passes') return 'rounded';
  if (piece === 'poster' || piece === 'qr-codes') return 'rect';
  return DIE_CUTS[theme];
}

// ─── Spot layers (print-ready only) ─────────────────────────────────────────

/**
 * FOIL: the metal themes print the couple's names in foil (Luxe and Gatsby —
 * the owner's foil themes, 2026-09-25 — plus Regency's gilt and Cinderella's
 * silver). WHITE INK: themes whose stock is dark or kraft need a white
 * underprint for light type (Luxe, Gatsby, Cyber, Rustic's kraft).
 *
 * A sample never carries either — "no foil/white-ink layers" (owner 09-25).
 */
const SPOT_LAYERS: Record<InviteThemeId, { foil: boolean; whiteInk: boolean }> = {
  house: { foil: false, whiteInk: false },
  abaca: { foil: false, whiteInk: true },
  galeriya: { foil: false, whiteInk: false },
  cinderella: { foil: true, whiteInk: false },
  velvet: { foil: true, whiteInk: true },
  vintage: { foil: false, whiteInk: false },
  whimsical: { foil: false, whiteInk: false },
  regency: { foil: true, whiteInk: false },
  gatsby: { foil: true, whiteInk: true },
  cyber: { foil: false, whiteInk: true },
};

export function spotLayersFor(theme: InviteThemeId): { foil: boolean; whiteInk: boolean } {
  return SPOT_LAYERS[theme];
}

// ─── The theme on paper ─────────────────────────────────────────────────────

/** Where the theme's still sits on a card (THEMES-2026-09-24.md "Print"). */
export type StillPlacement = 'none' | 'top' | 'left' | 'full';

export type PrintLook = {
  theme: InviteThemeId;
  paper: string;
  ink: string;
  muted: string;
  accent: string;
  heading: string;
  /** The still (theme poster or the couple's hero) and where it sits. */
  still: StillPlacement;
  /** A veil over a `full` still, so type reads (the theme's own scrim). */
  scrim: { color: string; opacity: number } | null;
  /** Sepia the still (Vintage's collage). */
  sepia: boolean;
  /** The rule's centre glyph. */
  ornament: string;
  /** Font keys (see `PRINT_FONT_FILES`). */
  headFont: PrintFontKey;
  scriptFont: PrintFontKey | null;
  bodyFont: PrintFontKey;
  /** Names print in caps (the deco and neon faces). */
  capsNames: boolean;
};

/**
 * Fonts that ship IN the repo and are traced into every lambda
 * (`next.config.ts` outputFileTracingIncludes: `assets/cipher-fonts/*.ttf`,
 * `lib/social/fonts/*.ttf`). A theme's web face that is not bundled maps to the
 * nearest bundled one — the print route can only draw what the server holds.
 */
export const PRINT_FONT_FILES = {
  cormorant: 'assets/cipher-fonts/cormorant.ttf',
  bodoni: 'assets/cipher-fonts/bodoni-moda.ttf',
  cinzel: 'assets/cipher-fonts/cinzel.ttf',
  caslon: 'assets/cipher-fonts/libre-caslon-display.ttf',
  vidaloka: 'assets/cipher-fonts/vidaloka.ttf',
  pinyon: 'assets/cipher-fonts/pinyon-script.ttf',
  tangerine: 'assets/cipher-fonts/tangerine.ttf',
  luxurious: 'assets/cipher-fonts/luxurious-script.ttf',
  haviland: 'assets/cipher-fonts/mr-de-haviland.ttf',
  greatVibes: 'lib/social/fonts/GreatVibes-Regular.ttf',
  cardo: 'lib/social/fonts/Cardo-Regular.ttf',
  cardoBold: 'lib/social/fonts/Cardo-Bold.ttf',
  poppins: 'lib/social/fonts/Poppins-Regular.ttf',
  poppinsMedium: 'lib/social/fonts/Poppins-Medium.ttf',
  poppinsBold: 'lib/social/fonts/Poppins-Bold.ttf',
} as const;
export type PrintFontKey = keyof typeof PRINT_FONT_FILES;

const STILLS: Record<InviteThemeId, StillPlacement> = {
  house: 'none',
  abaca: 'top',
  galeriya: 'left',
  cinderella: 'top',
  velvet: 'full',
  vintage: 'top',
  whimsical: 'top',
  regency: 'top',
  gatsby: 'full',
  cyber: 'full',
};

const TYPE: Record<
  InviteThemeId,
  { head: PrintFontKey; script: PrintFontKey | null; body: PrintFontKey; ornament: string; caps?: boolean }
> = {
  house: { head: 'cormorant', script: 'greatVibes', body: 'cardo', ornament: '❦' },
  abaca: { head: 'caslon', script: 'tangerine', body: 'cardo', ornament: '❧' },
  galeriya: { head: 'cormorant', script: null, body: 'poppins', ornament: '—' },
  cinderella: { head: 'cormorant', script: 'pinyon', body: 'cardo', ornament: '✧' },
  velvet: { head: 'bodoni', script: 'pinyon', body: 'cardo', ornament: '✦' },
  vintage: { head: 'caslon', script: 'haviland', body: 'cardo', ornament: '❦' },
  whimsical: { head: 'vidaloka', script: 'greatVibes', body: 'cardo', ornament: '✿' },
  regency: { head: 'bodoni', script: 'luxurious', body: 'cardo', ornament: '❦' },
  gatsby: { head: 'cinzel', script: null, body: 'cardo', ornament: '◆', caps: true },
  cyber: { head: 'poppinsBold', script: null, body: 'poppins', ornament: '◆', caps: true },
};

export function printLookFor(theme: InviteThemeId): PrintLook {
  const t = INVITE_THEMES[theme];
  const type = TYPE[theme];
  const still = STILLS[theme];
  return {
    theme,
    paper: t.palette.canvas,
    ink: t.palette.ink,
    muted: t.palette.muted,
    accent: t.palette.accent,
    heading: t.palette.heading,
    still: t.media ? still : 'none',
    scrim: still === 'full' ? t.scrim : null,
    sepia: theme === 'vintage',
    ornament: type.ornament,
    headFont: type.head,
    scriptFont: type.script,
    bodyFont: type.body,
    capsNames: type.caps === true,
  };
}

// ─── Who gets what ──────────────────────────────────────────────────────────

export type PrintMode = 'screen' | 'sample' | 'print';

/**
 * The gate, in one place (owner 2026-09-25 "PRINTABLES ARE PRO"):
 *   · everyone who can edit the event sees and downloads SAMPLES — compressed,
 *     screen resolution, a "Sample" mark, no bleed, no crop marks, no layers;
 *   · the PRINT-READY PDF and the per-guest pass batch need Event Hub Pro;
 *   · the plain QR sheet (`qr-codes`) is free for every event, store shell
 *     included — a QR is not a purchase;
 *   · in the app-store shell the Pro path is ABSENT, not locked (App Review
 *     3.1.1), so `printReady` is false there whatever the unlock says.
 */
export function printAccess(input: { ownsPro: boolean; storeShell: boolean }): {
  samples: boolean;
  printReady: boolean;
  offerPro: boolean;
} {
  const printReady = input.ownsPro && !input.storeShell;
  return { samples: true, printReady, offerPro: !input.ownsPro && !input.storeShell };
}

/** May this mode of this piece be served to this viewer? The route's refusal. */
export function mayServe(piece: PrintPieceKey, mode: PrintMode, access: { printReady: boolean }): boolean {
  if (piece === 'qr-codes') return true;
  if (piece === 'passes') return access.printReady;
  if (mode === 'print') return access.printReady;
  return true;
}

// ─── The facts a card prints ────────────────────────────────────────────────

export type ScheduleBlockRow = {
  label?: string | null;
  block_type?: string | null;
  start_at?: string | null;
  location?: string | null;
  sort_order?: number | null;
  parent_block_id?: string | null;
};

/**
 * THE CEREMONY BLOCK — not the first item of the run of show. The hub leads
 * with the first public block ("Guests arrive"); paper prints when the ceremony
 * starts (THEMES-2026-09-24.md: "the hub shows 1:30 PM; the owner's print says
 * 2:30 PM"). A top-level block of type `ceremony`, earliest first; null when the
 * couple has none — never a guess.
 */
export function ceremonyBlock<T extends ScheduleBlockRow>(blocks: readonly T[]): T | null {
  const ceremonies = blocks.filter((b) => b.block_type === 'ceremony' && !b.parent_block_id && b.start_at);
  ceremonies.sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
  return ceremonies[0] ?? null;
}

/** The first top-level block of a type, earliest first. */
export function firstBlockOf<T extends ScheduleBlockRow>(blocks: readonly T[], type: string): T | null {
  const hits = blocks.filter((b) => b.block_type === type && !b.parent_block_id && b.start_at);
  hits.sort((a, b) => String(a.start_at).localeCompare(String(b.start_at)));
  return hits[0] ?? null;
}

/**
 * `start_at` stores the VENUE'S WALL CLOCK in a timestamptz column (prod holds
 * `14:00+00` for a 2 pm Manila ceremony) — so it is read as a wall clock, never
 * converted (`formatWallClock`). Converting it prints 10 PM.
 */
export function blockTime(block: ScheduleBlockRow | null): string | null {
  const t = formatWallClock(block?.start_at ?? null);
  return t || null;
}

// ─── The words on the cards ─────────────────────────────────────────────────

/**
 * What the cards print, RESOLVED — the layout's input. Each fact has ONE home,
 * and none of them is typed twice (owner 2026-09-25):
 *   · parents      — the GUEST LIST: guests whose role (or extra role) is
 *                    `bride_parents` / `groom_parents`. *"Parent's names should be
 *                    on the guest list"*. None there → the block is simply omitted.
 *   · openingLine  — `events.print_details.opening_line`, typed or started from a
 *                    template (`OPENING_LINE_TEMPLATES`).
 *   · rsvpContact  — a HOST picked from the event's hosts (coordinator included),
 *                    or the couple's own manual line. *"will either be the host
 *                    information or coordinator they just pick and allow manual
 *                    input as well"*.
 *   · giftLines    — E-GIFTS (`event_egift_methods`, the Pabuya page). *"E-Gifts
 *                    details should already have its own place on the sidebar.
 *                    that is where you get the information"*. Masked on paper.
 */
export type PrintParent = { name: string; deceased: boolean; side: 'groom' | 'bride' };
export type PrintDetails = {
  parents: PrintParent[];
  openingLine: string | null;
  rsvpContact: string | null;
  giftLines: string[];
  /** The E-Gifts thank-you message (`events.pabuya_message`), when ticked. */
  thankYou?: string | null;
  /** The closing words (`events.special_message`), when ticked. */
  specialMessage?: string | null;
  /** Guest-visible schedule moments ("2:00 PM · Ceremony"), when ticked. */
  program?: string[];
  /** Add a 25 mm NFC sticker spot beside the QR (the QR itself is ALWAYS printed). */
  nfc?: boolean;
  /** A short excerpt of the couple's story (`events.our_story`), when ticked. */
  storyExcerpt?: string | null;
  /** Print guests' names on their passes (the Guest list toggle). */
  guestNames?: boolean;
};

/**
 * The NFC sticker the owner recommends, verbatim: *"The NFC Sticker recommended
 * is the 25mm diameter stickers"*. The "Place NFC sticker here" spot is drawn
 * true to this size in the print-ready PDF, with a clear margin around it.
 */
export const NFC_STICKER_DIAMETER_MM = 25;
export const NFC_STICKER_MARGIN_MM = 2;

export const EMPTY_PRINT_DETAILS: PrintDetails = { parents: [], openingLine: null, rsvpContact: null, giftLines: [] };

/** Who guests reply to — the CHOICE is what is stored, never a copied number. */
export type RsvpChoice = { kind: 'host'; moderatorId: string } | { kind: 'manual'; text: string };

/**
 * THE INCLUDE CHECKLIST — owner 2026-09-25: *"So they will check on what they
 * want added from the sidebar menu. Guest List · 3D Plan / 2D Plan / List ·
 * EGifts · Love Story · Schedule · Event Hub Link - QR or place sticker here"*,
 * then: *"QR is automatic. NFC is optional. we need that QR code since it is
 * universal and works for all"* — so the QR is not an include item at all.
 * Each source is ticked (with its sub-options) in the Maker's Details panel and
 * READ from where it already lives; an unticked item is simply left off.
 */
export type PrintInclude = {
  guestNames: boolean;
  parents: boolean;
  seatPlan: 'none' | '3d' | '2d' | 'list';
  giftDetails: boolean;
  thankYou: boolean;
  loveStory: 'none' | 'excerpt';
  schedule: boolean;
  moodBoard: boolean;
  /** An NFC sticker spot IN ADDITION to the QR (the QR is always printed). */
  nfc: boolean;
  openingLine: boolean;
  rsvp: boolean;
  specialMessage: boolean;
};

export const DEFAULT_INCLUDE: PrintInclude = {
  guestNames: true,
  parents: true,
  seatPlan: 'none',
  giftDetails: true,
  thankYou: false,
  loveStory: 'none',
  schedule: false,
  moodBoard: true,
  nfc: false,
  openingLine: true,
  rsvp: true,
  specialMessage: false,
};

export function parseInclude(raw: unknown): PrintInclude {
  const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const bool = (k: keyof PrintInclude) => (typeof r[k] === 'boolean' ? (r[k] as boolean) : (DEFAULT_INCLUDE[k] as boolean));
  const pick = <T extends string>(k: keyof PrintInclude, allowed: readonly T[]): T =>
    (allowed as readonly unknown[]).includes(r[k]) ? (r[k] as T) : (DEFAULT_INCLUDE[k] as T);
  return {
    guestNames: bool('guestNames'),
    parents: bool('parents'),
    seatPlan: pick('seatPlan', ['none', '3d', '2d', 'list'] as const),
    giftDetails: bool('giftDetails'),
    thankYou: bool('thankYou'),
    loveStory: pick('loveStory', ['none', 'excerpt'] as const),
    schedule: bool('schedule'),
    moodBoard: bool('moodBoard'),
    nfc: bool('nfc'),
    openingLine: bool('openingLine'),
    rsvp: bool('rsvp'),
    specialMessage: bool('specialMessage'),
  };
}

/** `events.print_details` as stored: only what has no other home, plus the include choices. */
export type StoredPrintDetails = { openingLine: string | null; rsvp: RsvpChoice | null; include: PrintInclude };

const LINE_MAX = 160;
const clean = (v: unknown, max = LINE_MAX): string | null => {
  if (typeof v !== 'string') return null;
  const s = v.replace(/\s+/g, ' ').trim().slice(0, max);
  return s || null;
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `events.print_details` → what was chosen. Stored JSON is data a person typed,
 * not a promise about shape: anything unknown is DROPPED, never repaired, and an
 * absent or broken value is nothing — never an invented opening line.
 */
export function parsePrintDetails(raw: unknown): StoredPrintDetails {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { openingLine: null, rsvp: null, include: { ...DEFAULT_INCLUDE } };
  const r = raw as Record<string, unknown>;
  let rsvp: RsvpChoice | null = null;
  const c = r.rsvp && typeof r.rsvp === 'object' ? (r.rsvp as Record<string, unknown>) : null;
  if (c?.kind === 'host' && typeof c.moderator_id === 'string' && UUID_RE.test(c.moderator_id)) {
    rsvp = { kind: 'host', moderatorId: c.moderator_id };
  } else if (c?.kind === 'manual') {
    const text = clean(c.text);
    if (text) rsvp = { kind: 'manual', text };
  }
  return { openingLine: clean(r.opening_line, 240), rsvp, include: parseInclude(r.include) };
}

/** The stored shape — what the form writes (snake_case, like every column). */
export function serializePrintDetails(d: StoredPrintDetails): Record<string, unknown> {
  return {
    opening_line: d.openingLine,
    rsvp: d.rsvp ? (d.rsvp.kind === 'host' ? { kind: 'host', moderator_id: d.rsvp.moderatorId } : { kind: 'manual', text: d.rsvp.text }) : null,
    include: d.include,
  };
}

/**
 * OPENING-LINE TEMPLATES — owner 2026-09-25: *"Opening line, yes you can place it
 * there but provide a template as well"*, on the pattern the E-Gifts page already
 * uses for its message (`PABUYA_TEMPLATES`): a template FILLS THE BOX; what is
 * saved is always the couple's text, so improving a template's wording later
 * never rewrites anybody's card.
 */
export type OpeningLineTemplate = { key: string; name: string; body: string };
export const OPENING_LINE_TEMPLATES: readonly OpeningLineTemplate[] = [
  { key: 'faith', name: 'Faith', body: 'With thanksgiving to God and with the blessing of our parents,' },
  { key: 'formal', name: 'Formal', body: 'Together with their families, request the honour of your presence at their marriage' },
  { key: 'warm', name: 'Warm', body: 'With joyful hearts, we invite you to celebrate the beginning of our forever' },
  { key: 'filipino', name: 'Filipino', body: 'Sa biyaya ng Diyos at sa basbas ng aming mga magulang, kami ay nag-aanyaya' },
  { key: 'simple', name: 'Simple', body: 'Please join us as we begin our life together' },
];

/** A parent's printed name: the † follows ONLY a departed parent. */
export function parentLine(p: PrintParent): string {
  return p.deceased ? `${p.name} †` : p.name;
}

/**
 * A gift line with its account number MASKED: every run of 6+ digits keeps its
 * last four (`•••• 7890`). An invitation is handed to a hundred people and
 * photographed; the full number belongs on the couple's gift page, not on
 * paper (the board's placeholder is `Account number: •••• ••••` — never real).
 */
export function maskAccountLine(line: string): string {
  return line.replace(/\d[\d\s-]{4,}\d/g, (run) => {
    const digits = run.replace(/\D/g, '');
    if (digits.length < 6) return run;
    return `•••• ${digits.slice(-4)}`;
  });
}

/** "Indalecio & Claire" → the two names; one name stays one. */
export function coupleNames(displayName: string | null | undefined): { first: string; second: string | null } {
  const raw = (displayName ?? '').trim();
  const parts = raw.split(/\s+(?:&|and|\+)\s+/i).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return { first: parts[0]!, second: parts.slice(1).join(' & ') };
  return { first: raw || 'Our celebration', second: null };
}

/** `2026-12-18` → "Friday, the eighteenth of December, 2026" is the formal
 *  form; paper uses the plain one: "Friday · December 18, 2026". */
export function printedDate(eventDate: string | null | undefined): string | null {
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}/.test(eventDate)) return null;
  const [y, m, d] = eventDate.slice(0, 10).split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const md = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return `${weekday} · ${md}`;
}

/**
 * Characters a bundled face can draw. The glyph pipeline turns text into
 * outlines from the TTF; a character the face lacks draws as `.notdef` (a box).
 * Emoji and pictographs are dropped rather than printed as boxes.
 */
export function printableText(s: string): string {
  return s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}]/gu, (ch) =>
    ch === '†' || ch === '✦' || ch === '❦' || ch === '❧' || ch === '✧' || ch === '✿' || ch === '◆' ? ch : '',
  ).trim();
}
