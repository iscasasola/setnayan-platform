/**
 * 🎨 THE LOOK OF EACH LINE OF THE REPLY PAGES — one optional object inside `events.rsvp_ask_config` (`look`).
 *
 * Owner, on the live Maker's RSVP stage (2026-10-09): "shouldn't it be per element?" — every line is its own part,
 * so Style is the picked line's. Controller's conditions, all held here:
 *   · ABSENT = TODAY'S LOOK. No key, no rule: a page that never met the Maker draws exactly as it did.
 *   · EVERY STORED VALUE IS ONE OF A FIXED LIST — a colour is a SLOT of the event's own five colours (1–5, never a
 *     colour typed by hand), a size is one of six named steps. Nothing a person typed ever reaches CSS: `readRsvpLook`
 *     keeps only those, and it is the ONLY way a page or the Maker reads the object.
 *   · It rides the same object, the same draft and the same Apply as the words — no new read for a guest.
 *
 * The first-load sanitiser (`sanitizeRsvpAskConfig`, read by `lib/hub-draft.ts`) only carries `look` through, so an
 * older panel's save can never drop it; the strict reading is here, in a module that loads with the pages and the
 * lazy panel. IMPORT-FREE on purpose (the canvas bridge reads it in a guest's bundle).
 *
 * 🧱 ROOM FOR WHAT COMES NEXT (the ＋, drag and Group — owner's ruling 2026-10-09): `look` is an object of named
 * keys. `lines` is here now; the card's background, the order of the lines, added lines and groups each take a key of
 * their own beside it, so nothing stored today has to move. The whole config is capped at 2,048 bytes by the
 * database (`events_rsvp_ask_config_shape`): `rsvpConfigFits` is asked before a save, so a couple is told in a
 * sentence instead of at Apply.
 */

/** Every line that can be styled: `<the Maker part>.<the line's name>` (`RSVP_SECTION_LINES`, `rsvp-canvas-parts.ts`). */
export const RSVP_LOOK_LINES = [
  'rsvp.eyebrow',
  'rsvp.question',
  'rsvp.yes',
  'rsvp.no',
  'rsvp.hint',
  'yesnote.heading',
  'yesnote.message',
  'pass.save',
  'nonote.heading',
  'nonote.message',
] as const;
export type RsvpLookLine = (typeof RSVP_LOOK_LINES)[number];

/** A BUTTON line: its colours are Look › Buttons' (one set for every button of the event) — only its size is its own. */
export const RSVP_LOOK_BUTTON_LINES: readonly RsvpLookLine[] = ['rsvp.yes', 'rsvp.no', 'pass.save'];

/** The six sizes, as % of the line's own size — a subset of the Event Hub's steps (`HUB_ELEMENT_SIZE_STEPS`). */
export const RSVP_LOOK_SIZES = [85, 92, 100, 110, 120, 132] as const;
export type RsvpLookSize = (typeof RSVP_LOOK_SIZES)[number];
/** The colour slots: the event's own five colours, in their order. */
export const RSVP_LOOK_SLOTS = [1, 2, 3, 4, 5] as const;
export type RsvpLookSlot = (typeof RSVP_LOOK_SLOTS)[number];

/** One line's look. `c` a colour slot · `s` a size. Short keys: the object lives under a 2 KB cap. */
export type RsvpLineLook = { c?: RsvpLookSlot; s?: RsvpLookSize };
export type RsvpLook = { lines?: Partial<Record<RsvpLookLine, RsvpLineLook>> };

export function rsvpLookLine(part: string | null | undefined, line: string | null | undefined): RsvpLookLine | null {
  const id = `${part}.${line}`;
  return (RSVP_LOOK_LINES as readonly string[]).includes(id) ? (id as RsvpLookLine) : null;
}

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

/** THE ONE READER — over the RAW `rsvp_ask_config`. Only known lines, only values from the lists above. */
export function readRsvpLook(config: unknown): RsvpLook {
  const raw = isObject(config) ? config.look : null;
  const lines = isObject(raw) ? raw.lines : null;
  if (!isObject(lines)) return {};
  const out: Partial<Record<RsvpLookLine, RsvpLineLook>> = {};
  for (const id of RSVP_LOOK_LINES) {
    const v = lines[id];
    if (!isObject(v)) continue;
    const look: RsvpLineLook = {};
    if (!RSVP_LOOK_BUTTON_LINES.includes(id) && (RSVP_LOOK_SLOTS as readonly unknown[]).includes(v.c)) look.c = v.c as RsvpLookSlot;
    if ((RSVP_LOOK_SIZES as readonly unknown[]).includes(v.s) && v.s !== 100) look.s = v.s as RsvpLookSize;
    if (look.c !== undefined || look.s !== undefined) out[id] = look;
  }
  return Object.keys(out).length > 0 ? { lines: out } : {};
}

/**
 * The stored `look` with one line changed (`null` = back to the page's own) — what the panel saves. Built on the
 * RAW `look` so a key this build does not know (a later one's) is carried, never dropped; `undefined` when nothing
 * is left, so an event back to its own look stores no `look` at all.
 */
export function rsvpLookWith(config: unknown, id: RsvpLookLine, patch: { c?: RsvpLookSlot | null; s?: RsvpLookSize | null }): Record<string, unknown> | undefined {
  const rest = isObject(config) && isObject(config.look) ? { ...config.look } : {};
  const lines = { ...readRsvpLook(config).lines };
  const next: RsvpLineLook = { ...lines[id] };
  if (patch.c !== undefined) {
    if (patch.c === null) delete next.c;
    else next.c = patch.c;
  }
  if (patch.s !== undefined) {
    if (patch.s === null || patch.s === 100) delete next.s;
    else next.s = patch.s;
  }
  if (next.c === undefined && next.s === undefined) delete lines[id];
  else lines[id] = next;
  if (Object.keys(lines).length > 0) rest.lines = lines;
  else delete rest.lines;
  return Object.keys(rest).length > 0 ? rest : undefined;
}

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * THE RULES A PAGE DRAWS — for the parts it shows (`['rsvp']` the form · `['yesnote', 'pass']` · `['nonote']`).
 * `board`: the event's five colours (`celebrationColours(boardSwatches(role_palette))`, the same list the Maker's
 * swatches show). Every value written is from a fixed list or that board (checked `#rrggbb`); a slot the board does
 * not hold draws nothing. `zoom` is how the Event Hub sizes a part (`lib/element-style.ts`): the line's own size ×.
 */
export function rsvpLookCss(look: RsvpLook, parts: readonly string[], board: readonly string[]): string {
  let css = '';
  for (const id of RSVP_LOOK_LINES) {
    const [part, line] = id.split('.') as [string, string];
    const v = look.lines?.[id];
    if (!v || !parts.includes(part)) continue;
    const colour = v.c ? board[v.c - 1] : undefined;
    const rules = `${colour && HEX.test(colour) ? `color:${colour.toLowerCase()};` : ''}${v.s ? `zoom:${v.s / 100};` : ''}`;
    if (rules) css += `[data-rsvp-line="${line}"][data-rsvp-line]{${rules}}`;
  }
  return css;
}

/** The `<style>` a reply page carries its lines' look in — and the Maker's canvas redraws as a look is picked. */
export const RSVP_LOOK_STYLE_ATTR = 'data-rsvp-look';
/** The bridge message's `t` — `{ source, t: 'rsvpLook', look }`: the RAW `look`, read strictly by the page. */
export const RSVP_LOOK_MESSAGE = 'rsvpLook';

/** The database's cap on the whole config, with room left for how it is stored — asked before a save. */
export const RSVP_CONFIG_ROOM = 1900;
export function rsvpConfigBytes(config: unknown): number {
  return new TextEncoder().encode(JSON.stringify(config ?? {})).length;
}
/**
 * May `next` be saved over `was`? Yes while it fits — and yes whenever it is no bigger than what is already kept, so
 * an event already over the line can always be made shorter (or left as it is) and is never locked.
 */
export function rsvpConfigFits(next: unknown, was?: unknown): boolean {
  const bytes = rsvpConfigBytes(next);
  return bytes <= RSVP_CONFIG_ROOM || (was !== undefined && bytes <= rsvpConfigBytes(was));
}
/** Said — by the row that asked, or under the list — when a save would not fit. Words and looks alike. */
export const RSVP_CONFIG_FULL = 'It is too long to keep: your RSVP’s words and looks are at their limit. Shorten a message, then try again.';
