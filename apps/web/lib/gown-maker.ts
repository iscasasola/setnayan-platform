/**
 * 👗 THE GOWN MAKER — the platform's half (owner, 26 Nov 2026).
 *
 * The Gown Maker is a separate 3D designer page (it runs outside the platform and holds no Setnayan secret). Its
 * setup — quotations, fabrics, inspirations, pricing — is the tool's OWN Settings, seen only by the supplier. The
 * platform does three things, and this file holds the pure parts of each:
 *
 *   1. A tile in Shop › Your widgets that OPENS THE TOOL directly (owner: people launch it far more than they set it up)
 *      — `GOWN_MAKER_URL`, suggested for attire shops (`isGownKind`, from the one taxonomy's coarse categories).
 *   2. THE HANDOFF: the tool exports a `.gown.json` file (`GownExport`, below); the supplier drops it into the share
 *      sheet in Customers › QR codes › Gown design, picks the event type and Shortlist or Booked. No public endpoint
 *      (CLAUDE.md §6: no public API endpoints in V1), no link that could be replayed, nothing the static page must
 *      keep secret: the file goes from the supplier's own device into their own signed-in session.
 *   3. THE CARD: a scan adds the shop to the couple's event (shortlisted or booked) and posts ONE message in that
 *      couple-supplier chat, `formatGownDesignBlock` — drawn as the design card (thumbnail · summary · the price shown
 *      to the client). The tool's `state` is kept for the shop and never reaches a couple.
 *
 * 🔒 lib/gown-maker.test.ts
 */
import { resolveVendorCategory } from '@/lib/vendor-packages';
import { VENDOR_CATEGORIES, type VendorCategory } from '@/lib/vendors';
import { formatCentavosPhp } from '@/lib/php';

/** Where the Gown Maker lives (a published page; the tile opens it in a new tab). */
export const GOWN_MAKER_URL = 'https://claude.ai/artifact/3criE8gtKGSGscsN53Kkng';

/**
 * The coarse categories the Gown Maker suits — the one taxonomy's attire categories (`vendor_category`, resolved from
 * any leaf by `resolveVendorCategory`, the same reading the Shortlist QR files a shop under). A pair, not a list of
 * leaves: an admin's new gown or barong leaf inherits its branch with no code change.
 */
const GOWN_CATEGORIES: ReadonlySet<VendorCategory> = new Set<VendorCategory>(['gown_designer', 'suit_designer']);

/** Is this service kind (a leaf, a tile or a coarse category) one the Gown Maker is for? */
export function isGownKind(kind: string | null | undefined): boolean {
  if (!kind) return false;
  if (GOWN_CATEGORIES.has(kind as VendorCategory)) return true;
  return GOWN_CATEGORIES.has(resolveVendorCategory(kind));
}

/**
 * The category the shop lands under on the couple's event: its own attire category that fits the design (a man's
 * design → the suit category first), else its first attire category, else null (the writer's own coercion decides).
 */
export function gownShareCategory(which: GownWhich, services: readonly string[]): VendorCategory | null {
  const mine: VendorCategory[] = [];
  for (const s of services) {
    const c = VENDOR_CATEGORIES.includes(s as VendorCategory) ? (s as VendorCategory) : resolveVendorCategory(s);
    if (GOWN_CATEGORIES.has(c) && !mine.includes(c)) mine.push(c);
  }
  if (mine.length === 0) return null;
  const want: VendorCategory = which === 'male' ? 'suit_designer' : 'gown_designer';
  return mine.includes(want) ? want : mine[0]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// The handoff — what the Gown Maker exports
// ─────────────────────────────────────────────────────────────────────────────

export type GownWhich = 'female' | 'male';
export type GownShareAs = 'shortlist' | 'booked';
export const GOWN_SHARE_AS: readonly GownShareAs[] = ['shortlist', 'booked'];

/** The file the tool exports, version 1 — exactly the fields below; anything else in the file is ignored. */
export type GownExport = {
  v: 1;
  which: GownWhich;
  summary: string[];
  priceShown: number | null;
  currency: 'PHP';
  thumb: string;
  state: Record<string, unknown>;
};

/** The design as it is stored (`gown_designs`) — checked, bounded, money in centavos. */
export type GownDesignInput = {
  which: GownWhich;
  summary: string[];
  priceShownCentavos: number | null;
  thumbDataUrl: string;
  state: Record<string, unknown>;
};

export const GOWN_FILE_MAX_CHARS = 200_000;
export const GOWN_THUMB_MAX_BYTES = 60 * 1024;
export const GOWN_STATE_MAX_CHARS = 60_000;
export const GOWN_SUMMARY_MAX_LINES = 12;
export const GOWN_SUMMARY_LINE_MAX = 140;
/** Bounds a typo only — it prices nothing. */
const PRICE_MAX_PESOS = 100_000_000;
const PNG_PREFIX = 'data:image/png;base64,';

export type GownParse = { ok: true; design: GownDesignInput } | { ok: false; problem: string };

const no = (problem: string): GownParse => ({ ok: false, problem });

/** One summary line, cleaned: control characters out, spaces folded, bounded. Empty → dropped. */
function cleanLine(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.slice(0, GOWN_SUMMARY_LINE_MAX) : null;
}

/** Decoded size of a base64 body, or null when it is not base64. */
function base64Bytes(b64: string): number | null {
  if (b64.length === 0 || b64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0;
  return (b64.length / 4) * 3 - pad;
}

/**
 * Check a `.gown.json` file's text and return the design to store, or the words to show. Never guesses: a missing or
 * wrong field is refused by name. The file is the supplier's own; this is what makes it safe to keep.
 */
export function parseGownExport(text: unknown): GownParse {
  if (typeof text !== 'string' || !text.trim()) return no('Choose the .gown.json file the Gown Maker saved.');
  if (text.length > GOWN_FILE_MAX_CHARS) return no('That file is too big for a Gown Maker design. Export it again from the Gown Maker.');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return no('That isn’t a Gown Maker file. Export the design again with Share → Save .gown.json.');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return no('That isn’t a Gown Maker file.');
  const o = raw as Record<string, unknown>;
  if (o.v !== 1) return no('This Gown Maker file is from a newer version. Update the Gown Maker page, then export again.');
  if (o.which !== 'female' && o.which !== 'male') return no('The file doesn’t say whose design it is.');
  if (o.currency !== 'PHP') return no('The design’s price must be in pesos.');

  if (!Array.isArray(o.summary)) return no('The file has no design summary.');
  const summary = o.summary.map(cleanLine).filter((s): s is string => s !== null).slice(0, GOWN_SUMMARY_MAX_LINES);
  if (summary.length === 0) return no('The file has no design summary.');

  let priceShownCentavos: number | null = null;
  if (o.priceShown !== null && o.priceShown !== undefined) {
    const n = Number(o.priceShown);
    if (typeof o.priceShown !== 'number' || !Number.isFinite(n) || n < 0 || n > PRICE_MAX_PESOS) return no('The design’s price isn’t a peso amount.');
    priceShownCentavos = Math.round(n * 100);
  }

  if (typeof o.thumb !== 'string' || !o.thumb.startsWith(PNG_PREFIX)) return no('The file has no PNG picture of the design.');
  const bytes = base64Bytes(o.thumb.slice(PNG_PREFIX.length));
  if (bytes === null) return no('The design’s picture couldn’t be read.');
  if (bytes > GOWN_THUMB_MAX_BYTES) return no('The design’s picture is bigger than 60 KB. Export it again from the Gown Maker.');

  if (!o.state || typeof o.state !== 'object' || Array.isArray(o.state)) return no('The file is missing the design itself.');
  if (JSON.stringify(o.state).length > GOWN_STATE_MAX_CHARS) return no('The design is too big to keep. Export it again from the Gown Maker.');

  return {
    ok: true,
    design: { which: o.which, summary, priceShownCentavos, thumbDataUrl: o.thumb, state: o.state as Record<string, unknown> },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The chat message — plain words anywhere; the design names its stored row last
// ─────────────────────────────────────────────────────────────────────────────

/** The head of a design message — the SAME words as `GOWN_DESIGN_HEAD_WORDS` (lib/chat-card-lines.ts, pinned by test). */
export const GOWN_DESIGN_HEAD = '👗 Gown design · ';
export const GOWN_DESIGN_REF = 'Gown design ref: ';

export function gownWhichWords(which: GownWhich): string {
  return which === 'male' ? 'For him' : 'For her';
}

/** The price line the client reads — the proposal price the tool showed, never a cost. */
export function gownPriceWords(priceShownCentavos: number | null): string {
  return priceShownCentavos != null
    ? `Price shown: ${formatCentavosPhp(priceShownCentavos)} — your quote confirms it.`
    : 'The shop quotes the price in this chat.';
}

export function formatGownDesignBlock(d: Pick<GownDesignInput, 'which' | 'summary' | 'priceShownCentavos'>, designId: string): string {
  return [`${GOWN_DESIGN_HEAD}${gownWhichWords(d.which)}`, ...d.summary, gownPriceWords(d.priceShownCentavos), `${GOWN_DESIGN_REF}${designId}`].join('\n');
}

/** The stored row a design message names, or null (a message without a design, or a ref that is not a uuid). */
export function gownDesignRefOf(body: string | null | undefined): string | null {
  const at = (body ?? '').lastIndexOf(GOWN_DESIGN_REF);
  if (at < 0) return null;
  const m = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s*$/i.exec((body ?? '').slice(at + GOWN_DESIGN_REF.length));
  return m ? m[1]!.toLowerCase() : null;
}

/** The Shortlist code's query key on the Shortlist QR landing (`/{shop}/invite?gown=<share_code>`). */
export const GOWN_SHARE_PARAM = 'gown';

/** A share code's shape (24 hex characters, minted by the database). Anything else is no code at all. */
export function gownShareCodeOf(raw: unknown): string | null {
  return typeof raw === 'string' && /^[0-9a-f]{24}$/.test(raw) ? raw : null;
}
