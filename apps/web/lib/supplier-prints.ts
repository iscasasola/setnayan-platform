import type { PromoteQrMode } from '@/lib/supplier-qr-codes';

/**
 * 🖨 THE SUPPLIER'S PRINTS — Shop › Promote part 3 (owner APPROVED all 15 looks, 5 Nov 2026: "perfect").
 *
 * Source of truth: Setnayan-specs `prototypes/supplier_prints_2026-11-05/` (`index.html` + `placed/placement.json`).
 * Its DATA TABLES say "the real build copies these as-is" — so this file is those tables, copied, not redrawn:
 *
 *   PRINT_PIECES  — the 7 fixed layouts: size, the words under each name, the QR keep-out zone
 *   PRINT_DESIGNS — the 15 looks: ground, type pairing, inks, ornament — nothing else
 *   PRINT_QR      — which of the shop's OWN codes prints on every piece (Check a date by default · Shortlist · My page ·
 *                   Reviews), keyed by the Promote dropdown's modes (`lib/supplier-qr-codes.ts`) and their printed
 *                   captions; Reviews is print-only (owner 2026-11-06, below)
 *   PRINT_SCENES  — "See it in use": the real event photos and the printed surfaces in each, from `placement.json`
 *
 * A design changes ONLY the look; the shop changes the facts; nothing on a print is typed, moved or uploaded. The
 * drawing itself is `lib/supplier-prints-svg.ts` (server — it reads the bundled fonts): ONE renderer for the screen,
 * the Save file and the photos.
 *
 * Pure and client-safe (no fs, no env). 🔒 lib/supplier-prints.test.ts · lib/supplier-prints-decode.test.ts
 */

export type PrintPieceId = 'card' | 'standee' | 'door' | 'backdrop' | 'tarp' | 'rollup' | 'table';
export type PrintSide = 'f' | 'b';

export type PrintPiece = {
  id: PrintPieceId;
  name: string;
  size: string;
  /** width / height of the trim. */
  ratio: number;
  /** The trim in millimetres — the Save file's exact size (plus the bleed). */
  mm: { w: number; h: number };
  line: string;
  sides: 1 | 2;
  view: string;
  /** The QR keep-out zone in piece units (width = 100). Every ornament is masked out of it. */
  keep: { x: number; y: number; w: number; h: number };
  maxBadges: number;
};

const IN = 25.4;
const FT = 304.8;

/** The 7 pieces — the prototype's PIECES, verbatim (names, sizes, lines, keep-out zones). */
export const PRINT_PIECES: readonly PrintPiece[] = [
  { id: 'card', name: 'Calling card', size: '3.5 × 2 in', ratio: 3.5 / 2, mm: { w: 3.5 * IN, h: 2 * IN }, line: 'Front + back · 8 to a sheet', sides: 2, view: 'in the hand', keep: { x: 62, y: 8, w: 34, h: 42 }, maxBadges: 2 },
  { id: 'standee', name: 'A5 mini standee', size: '148 × 210 mm', ratio: 148 / 210, mm: { w: 148, h: 210 }, line: 'Clear acrylic desk holder', sides: 1, view: 'on a desk or welcome table', keep: { x: 20.5, y: 44, w: 59, h: 73 }, maxBadges: 2 },
  { id: 'door', name: 'Door print', size: 'A4 · 210 × 297 mm', ratio: 210 / 297, mm: { w: 210, h: 297 }, line: '“We are part of Setnayan” · your door or window', sides: 1, view: 'on glass', keep: { x: 23.5, y: 62, w: 53, h: 60 }, maxBadges: 2 },
  { id: 'backdrop', name: 'Booth backdrop', size: '8 × 8 ft', ratio: 1, mm: { w: 8 * FT, h: 8 * FT }, line: 'Big QR, seen from a few steps', sides: 1, view: 'from a few steps', keep: { x: 56.5, y: 48, w: 37, h: 46 }, maxBadges: 2 },
  { id: 'tarp', name: 'Booth / office tarp', size: '6 × 3 ft', ratio: 2, mm: { w: 6 * FT, h: 3 * FT }, line: 'Name, line, QR', sides: 1, view: 'on a wall', keep: { x: 66.5, y: 8, w: 30, h: 34 }, maxBadges: 2 },
  { id: 'rollup', name: 'Roll-up banner', size: '80 × 200 cm', ratio: 80 / 200, mm: { w: 800, h: 2000 }, line: 'Stands beside your table', sides: 1, view: 'standing', keep: { x: 16.5, y: 92, w: 67, h: 94 }, maxBadges: 2 },
  { id: 'table', name: 'Table-front', size: '6 × 2.5 ft', ratio: 6 / 2.5, mm: { w: 6 * FT, h: 2.5 * FT }, line: 'Hangs on the table edge', sides: 1, view: 'at waist height', keep: { x: 71, y: 6, w: 26, h: 30 }, maxBadges: 2 },
];

export const PRINT_PIECE_IDS = PRINT_PIECES.map((p) => p.id);

/* ── PRINTS BY PURPOSE AND SIZE (owner 2026-11-06, "Yes ship it"; DECISION_LOG "PRINTS BY PURPOSE AND SIZE") ─────────
 * Each piece carries what its size and its reading distance allow — the prototype's PIECES table (purpose · what ·
 * carries · type), copied with the ruling's deltas: NO PRICE on any print (a printed price cannot update), no phone or
 * email (the 2026-09-10 no-door-out-of-the-app rule). A missing fact drops its block — never a zero, never an empty box. */

/** The content blocks the ONE `On your prints ▾` pick switches — the prototype's BLOCKS, minus prices. Name and QR are always on. */
export type PrintBlock = 'logo' | 'tagline' | 'services' | 'stars' | 'badges' | 'since' | 'area' | 'photo' | 'about' | 'reach';

export const PRINT_BLOCKS: ReadonlyArray<{ key: PrintBlock; label: string; from: string }> = [
  { key: 'logo', label: 'Logo', from: 'Shop › Details' },
  { key: 'tagline', label: 'Tagline', from: 'Shop › Details' },
  { key: 'services', label: 'Services', from: 'Shop › Services' },
  { key: 'stars', label: 'Stars and reviews', from: 'earned' },
  { key: 'badges', label: 'Badges', from: 'earned' },
  { key: 'since', label: 'In business since', from: 'Shop › Details' },
  { key: 'area', label: 'Area served', from: 'Where you work' },
  { key: 'photo', label: 'Photo', from: 'Shop › Portfolio' },
  { key: 'about', label: 'About', from: 'Shop › Page' },
  { key: 'reach', label: 'Web address', from: 'Shop › Page' },
];
export const PRINT_BLOCK_KEYS: readonly PrintBlock[] = PRINT_BLOCKS.map((b) => b.key);

/** The `hide=` list a print is asked for with → the blocks switched OFF (unknown words ignored, in the table's order). */
export function printHidden(raw: string | readonly string[] | null | undefined): PrintBlock[] {
  const words = new Set((typeof raw === 'string' ? raw.split(',') : (raw ?? [])).map((w) => w.trim()));
  return PRINT_BLOCK_KEYS.filter((k) => words.has(k));
}

/** Per piece: who reads it from how far, what it carries, and the type and QR sizes that follow (its ⓘ). */
export type PrintPurpose = { purpose: string; what: string; carries: readonly string[]; type: string; blocks: readonly PrintBlock[] };

export const PRINT_PURPOSE: Readonly<Record<PrintPieceId, PrintPurpose>> = {
  card: {
    purpose: 'Handed over · read in the hand (40 cm).',
    what: 'Identity + QR. Stays minimal.',
    carries: ['Your logo — in the monogram’s place when your shop has one', 'Name', 'One line: your tagline (else your trade line)', 'Verified seal', 'Back: your Setnayan address · stars line · 2 badge words · QR'],
    type: 'Smallest letter 2 mm (6 pt). QR 23 mm wide — scans at 20–25 cm, in the hand.',
    blocks: ['logo', 'tagline', 'stars', 'badges', 'reach'],
  },
  standee: {
    purpose: 'On a desk or welcome table · read at arm’s length (0.8 m).',
    what: 'Services + rating + QR.',
    carries: ['Logo + name + tagline', 'Up to 3 services', 'Stars + review count', 'Up to 3 badges', 'QR + caption', 'Setnayan mark'],
    type: 'Smallest letter 3 mm (≈ 9 pt); name ≥ 8 mm. QR 60 mm — scans from 60 cm; it sits mid-height, facing the chair.',
    blocks: ['logo', 'tagline', 'services', 'stars', 'badges'],
  },
  door: {
    purpose: 'On glass · read walking past (2 m).',
    what: '“We are part of Setnayan” + QR. Kept as is.',
    carries: ['Unchanged. More content would slow a passer-by; the page behind the QR carries the rest.'],
    type: 'Letters ≥ 17 mm read at 2 m — the name does; the small lines are for the one who stops. QR 92 mm — scans from ~90 cm. Hang it with the QR at 1.2–1.5 m from the floor.',
    blocks: ['stars', 'badges'],
  },
  table: {
    purpose: 'Hangs on the table edge, at waist height · read walking up (2–3 m).',
    what: 'Name, top services, rating, QR.',
    carries: ['Logo + name + tagline', 'Up to 3 services', 'Stars + reviews', 'Up to 3 badges', 'QR + caption'],
    type: 'Letters ≥ 25 mm read at 3 m: name 90 mm, services 45 mm. QR 40 cm — scans from 3–4 m; at waist height it is at hand height by itself.',
    blocks: ['logo', 'tagline', 'services', 'stars', 'badges'],
  },
  tarp: {
    purpose: 'On a wall · read from across a room (5 m).',
    what: 'Name, tagline, top services, big QR.',
    carries: ['Logo + name + tagline', 'Up to 4 services', 'Stars + reviews', 'Up to 5 badges', 'In business since · area served', 'Big QR + caption', 'Web address (your own domain, then your Setnayan address)'],
    type: 'Letters ≥ 40 mm read at 5 m: name 120 mm, services 50 mm, meta 35 mm (readable from 4 m). QR 49 cm — scans from ~5 m. Hang it so the QR’s centre is 1.2–1.6 m from the floor.',
    blocks: ['logo', 'tagline', 'services', 'stars', 'badges', 'since', 'area', 'reach'],
  },
  rollup: {
    purpose: 'Standing beside a table · read top to bottom as people approach (3 m → 0.5 m).',
    what: 'Photo, story, services, badges, QR at hand height.',
    carries: ['Logo + name + tagline (read from 3 m)', 'A portfolio photo', 'About, 3 lines (read from 1 m)', 'QR at hand height', 'Up to 6 services', 'Stars + reviews', 'Up to 5 badges', 'Since · area · web address', 'Setnayan mark'],
    type: 'Name 70 mm letters (3 m); services 20 mm (1.5 m); the About 12 mm (0.5–1 m). QR 45 cm — scans from 3–4 m. The bottom 60 cm is below reach and often behind a table: only the mark and the address live there.',
    blocks: ['logo', 'tagline', 'services', 'stars', 'badges', 'since', 'area', 'photo', 'about', 'reach'],
  },
  backdrop: {
    purpose: 'Seen from a few steps (3 m), and in photos.',
    what: 'A big brand mark, a photo, a big QR.',
    carries: ['Big logo + name + tagline across the top (in every photo taken in front of it)', 'A portfolio photo, one panel', 'Big QR + caption, at the side so people posing do not cover it', 'Web address', 'Stars + reviews · up to 5 badges · since · area (small, for the one who walks up)', 'No service list'],
    type: 'Name 180 mm letters read at 10 m and in photos. QR 75 cm — scans from 6–7 m; it sits at the right edge, above the floor.',
    blocks: ['logo', 'tagline', 'stars', 'badges', 'since', 'area', 'photo', 'reach'],
  },
};

/** The personal calling card's ⓘ (owner 2026-11-06: "Yes") — the member's own card, the shop's back. */
export const PERSONAL_CARD_PURPOSE: PrintPurpose = {
  purpose: 'Handed over by you · read in the hand.',
  what: 'Your name and role on the front; your shop’s QR on the back.',
  carries: ['Front: your name (your account name) · your role word (Team › your label — none when it is empty) · your shop’s logo and name', 'Back: the same back as the shop’s card'],
  type: 'Same sizes as the calling card.',
  blocks: ['logo', 'stars', 'badges', 'reach'],
};

export function printPiece(id: string | null | undefined): PrintPiece | null {
  return PRINT_PIECES.find((p) => p.id === id) ?? null;
}

/** The faces a design sets its type in — each one a TTF under `public/print-fonts/` (outlined at draw time). */
export type PrintFace =
  | 'cormorant-700'
  | 'cormorant-600'
  | 'playfair-700'
  | 'playfair-500'
  | 'playfair-500i'
  | 'bodoni-600'
  | 'caslon-text-700'
  | 'caslon-text-400'
  | 'jost-500'
  | 'jost-600'
  | 'jost-700'
  | 'syne-800'
  | 'syne-700'
  | 'manrope-500'
  | 'italiana-400'
  | 'fraunces-700'
  | 'marcellus-400';

export type PrintOrnament =
  | 'inkgold'
  | 'ivory'
  | 'marble'
  | 'classic'
  | 'sage'
  | 'terracotta'
  | 'mono'
  | 'spotlight'
  | 'electric'
  | 'fiesta'
  | 'blush'
  | 'kraft'
  | 'forest'
  | 'pearl'
  | 'slate';

export type PrintDesign = {
  id: PrintOrnament;
  name: string;
  suits: string;
  /** The ground — a colour, or a two-stop 135° gradient (Terracotta). */
  ground: string | { from: string; to: string };
  ink: string;
  sub: string;
  acc: string;
  /** The name's face (its weight and style chosen: `nmF` + `nmW` + `nmI` in the prototype). */
  nameFace: PrintFace;
  /** The monogram's face — the name's family and weight, always upright (the prototype's `.mono` sets no italic). */
  monoFace: PrintFace;
  nameUpper: boolean;
  /** letter-spacing, em. */
  nameLs: number;
  /** The trade line's face (`subF`, weight 500 → the nearest cut the family has). */
  subFace: PrintFace;
  /** The gold the name and monogram are foiled in, when `foilName`. */
  foil: readonly string[] | null;
  mkC: string;
  sealC: string | null;
  /** The QR plate's ring: [colour, width in em of the QR's type size] — null = the default 1 px hairline. */
  plateRing: [string, number] | null;
  /** The name's size factor (`nmFit`). */
  nmFit: number;
};

const GOLD = ['#8a6a2c', '#d9b866', '#f6e7b0', '#b88d3b', '#e9cf86', '#8e6b2b', '#e6c97d'] as const;

/** The 15 looks — the prototype's DESIGNS, verbatim (values copied; nothing added). */
export const PRINT_DESIGNS: readonly PrintDesign[] = [
  { id: 'inkgold', name: 'Ink & gold', suits: 'Weddings · attire · venues · premium', ground: '#151312', ink: '#F4EFE6', sub: '#B9AD97', acc: '#cb9e4b', nameFace: 'cormorant-700', monoFace: 'cormorant-700', nameUpper: true, nameLs: 0.1, subFace: 'jost-500', foil: GOLD, mkC: '#cb9e4b', sealC: null, plateRing: ['rgba(203,158,75,.22)', 0.3], nmFit: 0.86 },
  { id: 'ivory', name: 'Ivory foil', suits: 'Weddings · debuts · christenings · styling', ground: '#F7F2E8', ink: '#2C2A29', sub: '#8A7F72', acc: '#B88D3B', nameFace: 'playfair-700', monoFace: 'playfair-700', nameUpper: false, nameLs: 0, subFace: 'jost-500', foil: ['#8e6b2b', '#cb9e4b', '#e9cf86', '#b88d3b', '#8e6b2b'], mkC: '#B88D3B', sealC: null, plateRing: null, nmFit: 1 },
  { id: 'marble', name: 'Marble', suits: 'Venues · cake · styling · makeup', ground: '#FBFAF8', ink: '#2B2B2B', sub: '#767A82', acc: '#B88D3B', nameFace: 'bodoni-600', monoFace: 'bodoni-600', nameUpper: true, nameLs: 0.2, subFace: 'jost-500', foil: null, mkC: '#B88D3B', sealC: null, plateRing: null, nmFit: 0.78 },
  { id: 'classic', name: 'Classic serif', suits: 'Photographers · coordinators · anyone', ground: '#FFFEFC', ink: '#1F1C19', sub: '#6B655F', acc: '#1F1C19', nameFace: 'caslon-text-700', monoFace: 'caslon-text-700', nameUpper: false, nameLs: 0, subFace: 'caslon-text-400', foil: null, mkC: '#1F1C19', sealC: null, plateRing: null, nmFit: 0.84 },
  { id: 'sage', name: 'Sage linen', suits: 'Garden weddings · florists · caterers', ground: '#DCE2D6', ink: '#2E3A2F', sub: '#64725F', acc: '#4F6B4A', nameFace: 'cormorant-600', monoFace: 'cormorant-600', nameUpper: false, nameLs: 0.01, subFace: 'jost-500', foil: null, mkC: '#4F6B4A', sealC: null, plateRing: null, nmFit: 1 },
  { id: 'terracotta', name: 'Terracotta', suits: 'Coordinators · hosts · any event', ground: { from: '#974930', to: '#C24E25' }, ink: '#FBFAF7', sub: 'rgba(251,250,247,.78)', acc: '#FBFAF7', nameFace: 'jost-600', monoFace: 'jost-600', nameUpper: false, nameLs: -0.01, subFace: 'jost-500', foil: null, mkC: '#FBFAF7', sealC: '#FBFAF7', plateRing: null, nmFit: 1 },
  { id: 'mono', name: 'Jet mono', suits: 'Photo & video · sound · corporate', ground: '#FFFFFF', ink: '#111111', sub: '#5A5A5A', acc: '#111111', nameFace: 'syne-800', monoFace: 'syne-800', nameUpper: true, nameLs: -0.01, subFace: 'manrope-500', foil: null, mkC: '#111111', sealC: null, plateRing: ['#111', 0.18], nmFit: 0.7 },
  { id: 'spotlight', name: 'Spotlight', suits: 'Bands · hosts · DJs · lights & sound', ground: '#0F1230', ink: '#F2DFAE', sub: '#B8AD8E', acc: '#E2B964', nameFace: 'italiana-400', monoFace: 'italiana-400', nameUpper: true, nameLs: 0.16, subFace: 'jost-500', foil: null, mkC: '#E2B964', sealC: null, plateRing: null, nmFit: 0.86 },
  { id: 'electric', name: 'Electric blue', suits: 'Corporate · lights & sound · printing · rentals', ground: '#1F3FD1', ink: '#FFFFFF', sub: 'rgba(255,255,255,.78)', acc: '#FFFFFF', nameFace: 'syne-700', monoFace: 'syne-700', nameUpper: true, nameLs: -0.005, subFace: 'manrope-500', foil: null, mkC: '#FFFFFF', sealC: '#FFFFFF', plateRing: null, nmFit: 0.9 },
  { id: 'fiesta', name: 'Fiesta', suits: 'Birthdays · kids’ parties · caterers · fiestas', ground: '#E8A33C', ink: '#2A1A12', sub: '#5E3A22', acc: '#C8401E', nameFace: 'fraunces-700', monoFace: 'fraunces-700', nameUpper: false, nameLs: -0.01, subFace: 'jost-500', foil: null, mkC: '#2A1A12', sealC: '#2A1A12', plateRing: null, nmFit: 1 },
  { id: 'blush', name: 'Blush', suits: 'Makeup · bridal · debuts · cake', ground: '#F6E8E4', ink: '#6E2C40', sub: '#A07784', acc: '#B9566F', nameFace: 'playfair-500i', monoFace: 'playfair-500', nameUpper: false, nameLs: 0, subFace: 'jost-500', foil: null, mkC: '#B9566F', sealC: null, plateRing: null, nmFit: 1 },
  { id: 'kraft', name: 'Kraft', suits: 'Caterers · rentals · rustic · printing', ground: '#BE9A6C', ink: '#F6ECDC', sub: '#F1E3CC', acc: '#F6ECDC', nameFace: 'jost-600', monoFace: 'jost-600', nameUpper: true, nameLs: 0.14, subFace: 'jost-500', foil: null, mkC: '#F6ECDC', sealC: '#F6ECDC', plateRing: null, nmFit: 0.86 },
  { id: 'forest', name: 'Forest', suits: 'Florists · garden venues · caterers', ground: '#223A2E', ink: '#F1ECDF', sub: '#AFBBA8', acc: '#C9A961', nameFace: 'cormorant-600', monoFace: 'cormorant-600', nameUpper: false, nameLs: 0.01, subFace: 'jost-500', foil: null, mkC: '#C9A961', sealC: null, plateRing: null, nmFit: 1 },
  { id: 'pearl', name: 'Pearl', suits: 'Venues · attire · christenings · Filipiniana', ground: '#F4F1F2', ink: '#3A3F4A', sub: '#7C8594', acc: '#9AA4B4', nameFace: 'cormorant-600', monoFace: 'cormorant-600', nameUpper: false, nameLs: 0.02, subFace: 'jost-500', foil: null, mkC: '#8A94A6', sealC: null, plateRing: null, nmFit: 1 },
  { id: 'slate', name: 'Slate', suits: 'Corporate · venues · coordinators · anyone', ground: '#2F3A48', ink: '#F3F5F8', sub: '#A9B5C4', acc: '#8FB4D9', nameFace: 'marcellus-400', monoFace: 'marcellus-400', nameUpper: true, nameLs: 0.14, subFace: 'jost-500', foil: null, mkC: '#8FB4D9', sealC: null, plateRing: null, nmFit: 0.86 },
];

export const PRINT_DESIGN_IDS = PRINT_DESIGNS.map((d) => d.id);
export const DEFAULT_PRINT_DESIGN: PrintOrnament = 'inkgold';

export function printDesign(id: string | null | undefined): PrintDesign | null {
  return PRINT_DESIGNS.find((d) => d.id === id) ?? null;
}

/** The ground as CSS — the swatch in the Design ▾ list and the bleed around a "contain" surface in the photos. */
export function groundCss(d: PrintDesign): string {
  return typeof d.ground === 'string' ? d.ground : `linear-gradient(135deg,${d.ground.from},${d.ground.to})`;
}

/**
 * Which code prints on every piece — the prototype's QR table, keyed by the Promote dropdown's own modes so the
 * address is the one `lib/supplier-qr-codes.ts` / `lib/check-a-date-qr.ts` already build. Check a date is the default.
 */
/**
 * ⭐ REVIEWS joins the print codes (owner 2026-11-06, DECISION_LOG "ONE HOME FOR EVERY PROMOTE TOOL", a controller call
 * under the owner's "use fable to decide": *"a Reviews QR (`/v/<slug>#reviews`) joins the prints QR ▾ (For Suppliers
 * promises a printable review QR)"*). Print-only: the Promote screen's code picker stays Check a date · Shortlist ·
 * My page.
 * ✍ IT OPENS WRITE A REVIEW (owner 2026-11-06, verbatim pick: "Write a review (Recommended)"): `/v/<slug>/review`
 * sends a couple with a booking ready for a review to "Leave a review", everyone else to the page's reviews
 * (`printQrUrl`, `lib/shop-review-door.ts`). Caption "Scan to review us"; the title stays "Reviews".
 */
export type PrintQrMode = PromoteQrMode | 'reviews';

export const PRINT_QR: Readonly<Record<PrintQrMode, { t: string; sub: string; cap: string }>> = {
  dates: { t: 'Check a date', sub: 'free', cap: 'Scan to check our dates' },
  shortlist: { t: 'Shortlist', sub: 'free', cap: 'Scan to save us' },
  page: { t: 'My page', sub: '', cap: 'Scan to see our work' },
  reviews: { t: 'Reviews', sub: '', cap: 'Scan to review us' },
};
/** The dropdown's order — the prototype's (Check a date · Shortlist · My page), then Reviews. */
export const PRINT_QR_ORDER: readonly PrintQrMode[] = ['dates', 'shortlist', 'page', 'reviews'];
export const DEFAULT_PRINT_QR: PrintQrMode = 'dates';

export function printQrMode(raw: string | null | undefined): PrintQrMode {
  return (PRINT_QR_ORDER as readonly string[]).includes(raw ?? '') ? (raw as PrintQrMode) : DEFAULT_PRINT_QR;
}

/** The pieces that carry the QR — every one but the card's front (the card's QR is on its back). */
export function pieceHasQr(piece: PrintPieceId, side: PrintSide): boolean {
  return !(piece === 'card' && side === 'f');
}

/* ── See it in use — `placement.json`, the 8 photos the prototype shows ─────────────────────────────────────────── */

export type SceneSurface = {
  piece: PrintPieceId;
  side: PrintSide;
  /** fill = the design stretched to the quad; contain = the piece at its ratio, the design's ground as bleed around it. */
  fit: 'fill' | 'contain';
  /** tl, tr, br, bl — in the 2048-px plate's pixels. */
  quad: readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]];
  /** The surface's own width / height. */
  aspect: number;
  veil: number;
  blur: number;
  shade: { file: string; x: number; y: number; w: number; h: number };
  mask?: { file: string; x: number; y: number; w: number; h: number };
};

export type PrintScene = {
  slug: string;
  cap: string;
  sub: string;
  /** The plate's size (2048 on the long edge) — quads are in these pixels; the photo file is 800 on the long edge. */
  size: readonly [number, number];
  surfaces: readonly SceneSurface[];
};

/** Where the photos and their masks are served (`public/supplier-prints/placed/`, copied from the prototype). */
export const PRINT_SCENE_DIR = '/supplier-prints/placed';

/**
 * Captions and which piece sits on each surface: the prototype's PLACEMENTS (what the owner approved in "See it in
 * use"); quads, shades, masks, veil and blur: `placement.json`, as generated 2026-11-05 — with ONE measured correction:
 * the expo booth's roll-up shade says h 1104, but its file is 918 tall (it stops at the photo's bottom edge, 234 + 918 =
 * 1152); drawn at 1104 it stretched the light and printed a seam across the counter. Every size here now equals its
 * file's (🔒 lib/supplier-prints.test.ts reads each PNG's header).
 */
export const PRINT_SCENES: readonly PrintScene[] = [
  {
    slug: '07-expo-booth', cap: 'Expo booth', sub: 'Backdrop 8 × 8 ft + roll-up', size: [2048, 1152],
    surfaces: [
      { piece: 'backdrop', side: 'f', fit: 'contain', quad: [[565, 128], [1541, 90], [1541, 941], [565, 939]], aspect: 1.2044, veil: 0.06, blur: 0.6, shade: { file: 'masks/07-expo-booth--0-backdrop-shade.png', x: 564, y: 90, w: 978, h: 851 }, mask: { file: 'masks/07-expo-booth--0-backdrop-fg.png', x: 562, y: 543, w: 982, h: 400 } },
      { piece: 'rollup', side: 'f', fit: 'contain', quad: [[1481, 235], [1951, 235], [1951, 1337], [1481, 1337]], aspect: 0.4255, veil: 0.06, blur: 0.6, shade: { file: 'masks/07-expo-booth--1-roll-up-shade.png', x: 1481, y: 234, w: 470, h: 918 }, mask: { file: 'masks/07-expo-booth--1-roll-up-fg.png', x: 1479, y: 821, w: 269, h: 331 } },
    ],
  },
  {
    slug: '04-floor-standee', cap: 'Venue entrance', sub: 'Roll-up 80 × 200 cm', size: [1536, 2048],
    surfaces: [{ piece: 'rollup', side: 'f', fit: 'contain', quad: [[651, 359], [920, 357], [904, 905], [637, 914]], aspect: 0.5, veil: 0.06, blur: 0.6, shade: { file: 'masks/04-floor-standee--0-floor-standee-shade.png', x: 637, y: 357, w: 284, h: 557 } }],
  },
  {
    slug: '13-shop-door-decal', cap: 'Your shop door', sub: 'Door print A4', size: [1536, 2048],
    surfaces: [{ piece: 'door', side: 'f', fit: 'fill', quad: [[578, 691], [989, 687], [992, 1251], [583, 1254]], aspect: 0.7273, veil: 0.06, blur: 0.6, shade: { file: 'masks/13-shop-door-decal--0-door-shade.png', x: 578, y: 686, w: 414, h: 569 } }],
  },
  {
    slug: '16-shop-window', cap: 'Shop window', sub: 'Door print A4', size: [2048, 1152],
    surfaces: [{ piece: 'door', side: 'f', fit: 'fill', quad: [[891, 430], [1188, 430], [1185, 823], [887, 820]], aspect: 0.75, veil: 0.06, blur: 0.6, shade: { file: 'masks/16-shop-window--0-window-poster-shade.png', x: 887, y: 429, w: 301, h: 394 } }],
  },
  {
    slug: '08-card-and-phone-scan', cap: 'A guest scans', sub: 'Calling card · back', size: [1536, 2048],
    surfaces: [{ piece: 'card', side: 'b', fit: 'fill', quad: [[664, 1152], [975, 1135], [993, 1323], [678, 1343]], aspect: 1.75, veil: 0.06, blur: 0.6, shade: { file: 'masks/08-card-and-phone-scan--0-calling-card-shade.png', x: 663, y: 1134, w: 331, h: 209 }, mask: { file: 'masks/08-card-and-phone-scan--0-calling-card-fg.png', x: 674, y: 1294, w: 68, h: 51 } }],
  },
  {
    slug: '05-buffet-card', cap: 'At the buffet', sub: 'Calling card · front', size: [2048, 1152],
    surfaces: [{ piece: 'card', side: 'f', fit: 'fill', quad: [[916, 729], [1269, 717], [1275, 939], [916, 952]], aspect: 1.6667, veil: 0.06, blur: 0.6, shade: { file: 'masks/05-buffet-card--0-buffet-card-shade.png', x: 915, y: 716, w: 361, h: 236 }, mask: { file: 'masks/05-buffet-card--0-buffet-card-fg.png', x: 913, y: 915, w: 11, h: 39 } }],
  },
  {
    slug: '01-welcome-table', cap: 'Welcome table', sub: 'A5 standee · landscape holder', size: [2048, 1152],
    surfaces: [{ piece: 'standee', side: 'f', fit: 'contain', quad: [[712, 555], [1115, 563], [1111, 839], [712, 815]], aspect: 1.4286, veil: 0.06, blur: 0.6, shade: { file: 'masks/01-welcome-table--0-standee-a5-shade.png', x: 711, y: 554, w: 404, h: 286 }, mask: { file: 'masks/01-welcome-table--0-standee-a5-fg.png', x: 1099, y: 560, w: 18, h: 281 } }],
  },
  {
    slug: '14-studio-reception', cap: 'Your office', sub: 'Tarp 6 × 3 ft + A5 standee', size: [2048, 1152],
    surfaces: [
      { piece: 'tarp', side: 'f', fit: 'contain', quad: [[543, 50], [1507, 25], [1507, 739], [543, 739]], aspect: 1.35, veil: 0.06, blur: 1.4, shade: { file: 'masks/14-studio-reception--0-wall-poster-shade.png', x: 542, y: 25, w: 966, h: 714 }, mask: { file: 'masks/14-studio-reception--0-wall-poster-fg.png', x: 540, y: 330, w: 970, h: 411 } },
      { piece: 'standee', side: 'f', fit: 'contain', quad: [[481, 720], [940, 720], [940, 1027], [481, 1024]], aspect: 1.4286, veil: 0.06, blur: 0.6, shade: { file: 'masks/14-studio-reception--1-standee-a5-shade.png', x: 480, y: 720, w: 461, h: 307 }, mask: { file: 'masks/14-studio-reception--1-standee-a5-fg.png', x: 649, y: 983, w: 157, h: 45 } },
    ],
  },
];

/* ── The homography: the unit box (0,0)–(W,H) → a quad, as a CSS matrix3d (the prototype's `matrix3d`, verbatim) ── */

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]!]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r;
    [M[c], M[p]] = [M[p]!, M[c]!];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r]![c]! / M[c]![c]!;
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!;
    }
  }
  return M.map((r, i) => r[n]! / r[i]!);
}

/** The 3×3 homography h (8 terms, h33 = 1) mapping the box's corners onto `quad` (tl, tr, br, bl). */
export function homography(W: number, H: number, quad: SceneSurface['quad']): number[] {
  const src = [[0, 0], [W, 0], [W, H], [0, H]] as const;
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]!;
    const [u, v] = quad[i]!;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  return solve(A, b);
}

export function matrix3d(W: number, H: number, quad: SceneSurface['quad']): string {
  const h = homography(W, H, quad);
  return `matrix3d(${[h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1].map((x) => +x!.toFixed(6)).join(',')})`;
}

/** Where a point of the box lands in the photo — what the test uses to check a surface lands on its quad. */
export function project(h: readonly number[], x: number, y: number): [number, number] {
  const w = h[6]! * x + h[7]! * y + 1;
  return [(h[0]! * x + h[1]! * y + h[2]!) / w, (h[3]! * x + h[4]! * y + h[5]!) / w];
}

/* ── The address a print fetches its drawing from (the one route, `app/api/vendor/prints/route.ts`) ──────────────── */

export const PRINTS_API = '/api/vendor/prints';

/**
 * `base` is the route that draws — the real one unless a /dev lab hands in its fixture route. `hide` = the blocks the
 * `On your prints ▾` pick switched off (the picture AND the Save file honour it); `who: 'me'` = the signed-in member's
 * own calling card (the card's front carries their name; the back is the shop's).
 */
export function printHref(o: { piece: PrintPieceId; side?: PrintSide; design: string; qr: PrintQrMode; save?: boolean; base?: string; hide?: readonly PrintBlock[]; who?: 'me' }): string {
  const q = new URLSearchParams({ piece: o.piece, design: o.design, qr: o.qr });
  if (o.side === 'b') q.set('side', 'b');
  if (o.save) q.set('save', '1');
  const hidden = printHidden(o.hide ?? []);
  if (hidden.length) q.set('hide', hidden.join(','));
  if (o.who === 'me' && o.piece === 'card') q.set('who', 'me');
  return `${o.base ?? PRINTS_API}?${q.toString()}`;
}

/** The Save file's name: `setnayan-calling-card-ink-gold.svg` — a member's own card adds their name. */
export function printFilename(piece: PrintPiece, design: PrintDesign, who?: string | null): string {
  const slug = (s: string) => s.toLowerCase().replace(/&/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const me = who ? slug(who) : '';
  return `setnayan-${slug(piece.name)}${me ? `-${me}` : ''}-${slug(design.name)}.svg`;
}
