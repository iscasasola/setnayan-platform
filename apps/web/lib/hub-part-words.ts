/**
 * apps/web/lib/hub-part-words.ts
 *
 * ✍ THE NAMES tap-to-type needs everywhere — which hero parts a tap types in,
 * the card's two eyebrows, and the closed lists of Format ▾ keys — with NO
 * imports, so the guest page's editing bridge (`type-in-place-canvas.ts`), the
 * sanitizer (`lib/element-style.ts`) and the Maker's first load can read them
 * without pulling the formatters or the bar in with them. The rest is
 * `lib/type-in-place.ts` (the Maker's) and `lib/hub-date-formats.ts`.
 */

/** The hero parts a tap opens the type bar on (the mark is a drawing; the venue's words are Details'). */
export const HUB_TYPE_PARTS = ['eyebrow', 'line', 'names', 'joiner', 'link', 'caption', 'date', 'time'] as const;
export type HubTypePart = (typeof HUB_TYPE_PARTS)[number];
/** …of them, the ones whose words are the hero's OWN — a caret in the words, kept on the canvas. */
export const HUB_TYPE_WORD_PARTS: readonly string[] = ['eyebrow', 'line', 'joiner', 'link', 'caption'];
/**
 * …and the ones whose words are an event FACT — a caret in the words, written
 * to the event's DRAFT (owner 2026-10-01, "wait for apply"): the names are
 * `events.display_name`, the same names Details › Names edits. Each person's
 * name is its own `[data-el-person]` inside the part, so the joiner between
 * them stays the Joiner's.
 */
export const HUB_TYPE_FACT_PARTS: readonly string[] = ['names'];

export function isHubTypePart(el: unknown): el is HubTypePart {
  return typeof el === 'string' && (HUB_TYPE_PARTS as readonly string[]).includes(el);
}
export function isTypeCaretPart(el: unknown): boolean {
  return typeof el === 'string' && (HUB_TYPE_WORD_PARTS.includes(el) || HUB_TYPE_FACT_PARTS.includes(el));
}

/**
 * The invitation card's small line on top — one for two people at the centre,
 * one for everyone else (`invitationCard`, `mastheadEyebrow`). Wording ▾ offers
 * both on the eyebrow: they are the lines the product already writes there.
 */
export const HUB_CARD_EYEBROWS = {
  twoPeople: 'Together with their families',
  one: 'You are invited',
} as const;

/** Format ▾ — the date's ways besides the page's own ("March 13, 2027"). */
export const HUB_DATE_FORMATS = ['dmy', 'weekday', 'short', 'numeric', 'tagalog'] as const;
export type HubDateFormat = (typeof HUB_DATE_FORMATS)[number];
/** Format ▾ — the time's ways besides the page's own ("2:30 PM"). */
export const HUB_TIME_FORMATS = ['24h', 'words', 'past'] as const;
export type HubTimeFormat = (typeof HUB_TIME_FORMATS)[number];

export function isHubDateFormat(v: unknown): v is HubDateFormat {
  return typeof v === 'string' && (HUB_DATE_FORMATS as readonly string[]).includes(v);
}
export function isHubTimeFormat(v: unknown): v is HubTimeFormat {
  return typeof v === 'string' && (HUB_TIME_FORMATS as readonly string[]).includes(v);
}

/**
 * A tap began typing — the canvas's `type` message (phase `start`), as the
 * Maker's shell keeps it until the bar has loaded (`type-in-place.tsx`). `n`
 * tells one tap from the next.
 */
export type TypeStart = {
  key: string;
  el: string;
  text: string;
  rect: { top: number; left: number; width: number; height: number };
  vw: number;
  auto?: string;
  iso?: string;
  at?: string;
  title?: string;
  caret: boolean;
  source: MessageEventSource | null;
  n: number;
};

/** The canvas's `type` start message, read — or null when it is not one. */
export function readTypeStart(d: unknown, source: MessageEventSource | null, n: number): TypeStart | null {
  const m = d as Record<string, unknown> | null;
  if (!m || m.source !== 'setnayan-site' || m.t !== 'type' || m.phase !== 'start') return null;
  if (typeof m.key !== 'string' || !isHubTypePart(m.el)) return null;
  const s = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const r = m.rect as TypeStart['rect'] | undefined;
  return {
    key: m.key,
    el: m.el,
    text: typeof m.text === 'string' ? m.text : '',
    rect: r && typeof r.top === 'number' ? r : { top: 0, left: 0, width: 0, height: 0 },
    vw: typeof m.vw === 'number' && m.vw > 0 ? m.vw : 1,
    auto: typeof m.auto === 'string' ? m.auto : undefined,
    iso: s(m.iso),
    at: s(m.at),
    title: s(m.title),
    caret: m.caret === true,
    source,
    n,
  };
}
