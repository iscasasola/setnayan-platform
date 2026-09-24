/**
 * apps/web/lib/custom-sections.ts
 *
 * A SECTION THE COUPLE WRITES THEMSELVES.
 *
 * Owner, 2026-09-23: *"they can add a blank screen in between, to create
 * content on the website as well, correct?"* — "in between" is the whole
 * requirement, and it is the reason this is not a separate table.
 *
 * ── WHY SIX SLOTS ON `invitation_widgets`, AND NOT A NEW TABLE ─────────────
 * 🔑 "IN BETWEEN" MEANS ONE ORDERING, NOT TWO. Sections are ordered by
 * `invitation_widgets.display_order`. A second table with its own order would
 * be a second source of truth for one fact — what order the page is in — and
 * the two would have to be interleaved by something, which is exactly the
 * competing-mechanism trap. A custom section IS a widget, so it is one.
 *
 * ✅ AND IT INHERITS EVERYTHING ALREADY BUILT: move up / move down, the
 * Auto · Shown · Hidden three-state, the phase fence, the background photo, the
 * focal point, the motion preset. None of that had to be written twice.
 *
 * ⚠ THE COST, SAID OUT LOUD: `invitation_widgets` is `UNIQUE (event_id,
 * widget_type)` — one row per type per event, documented at the table's birth.
 * Several custom sections therefore need several TYPES, so they are six fixed
 * slots rather than an unbounded list. Dropping that UNIQUE to allow N rows of
 * one type would weaken an invariant the whole table rests on, for a feature
 * whose own recommended ceiling is six.
 *
 * 🔑 SO THE CEILING IS STRUCTURAL, NOT A RULE SOMEBODY HAS TO REMEMBER.
 * Owner, 2026-09-24, verbatim: *"6 per phase"*. Every slot shows in every
 * phase, so no phase can ever carry more than six — the ruling is met by the
 * shape, and the controller ruled the same day that NO per-phase slots or phase
 * picker be added on top of it. A seventh
 * cannot be created by any path, including a hand-crafted POST, because the
 * database CHECK does not name one.
 *
 * ── EMPTY IS INVISIBLE ─────────────────────────────────────────────────────
 * A slot with no words has no content, so the existing `hasContent` /
 * Auto machinery hides it from guests while the couple still sees it in the
 * editor. A blank section never reaches a wedding page by accident.
 *
 * Pure. No I/O.
 */

/** The six slots. Fixed, and the CHECK in the migration names exactly these. */
export const CUSTOM_SECTION_TYPES = [
  'custom_1',
  'custom_2',
  'custom_3',
  'custom_4',
  'custom_5',
  'custom_6',
] as const;
export type CustomSectionType = (typeof CUSTOM_SECTION_TYPES)[number];

/* 🔑 THE LIMITS HAVE ONE HOME — the recap's custom columns. Owner-locked
   2026-09-24 (DECISION_LOG): the main page's own sections reuse
   `CUSTOM_COLUMN_TITLE_MAX` / `CUSTOM_COLUMN_BODY_MAX`. This file used to keep
   its own 80 / 4000; equal today, and two numbers that happen to agree are two
   numbers that will one day not. Imported, never copied. */
import {
  CUSTOM_COLUMN_BODY_MAX,
  CUSTOM_COLUMN_TITLE_MAX,
} from '@/app/[slug]/_components/editorial/custom-columns';
export { CUSTOM_COLUMN_BODY_MAX, CUSTOM_COLUMN_TITLE_MAX };

export function isCustomSectionType(value: unknown): value is CustomSectionType {
  return typeof value === 'string' && (CUSTOM_SECTION_TYPES as readonly string[]).includes(value);
}

/** What the couple wrote. Both parts optional; neither is invented. */
export type CustomSectionContent = {
  title: string;
  body: string;
};

/**
 * A browser posts a textarea's line breaks as CRLF, while `maxLength` counted
 * each one as ONE character. Measured without this, a 4,000-character body
 * with forty line breaks arrives as 4,040 and a limit the couple could see and
 * obeyed would refuse them. Normalised before anything is measured.
 */
function normaliseBreaks(v: string): string {
  return v.replace(/\r\n?/g, '\n');
}

/**
 * Read one slot's words out of `config_json`.
 *
 * ⚠ Stored config is text a person typed months ago, not a promise about
 * shape. Anything that is not a string is dropped; what survives is trimmed.
 *
 * ⛔ OVER THE LIMIT IS DROPPED, NOT TRUNCATED — the recap's custom columns
 * (`readCustomColumns`) follow the same rule, so one product has one answer.
 * The earlier reading here cut an over-long body to 4,000 characters, which is
 * a sentence cut in half on a wedding page with nobody told. The writer below
 * (`readCustomSectionInput`) now REFUSES an over-long save, and the editor's
 * `maxLength` stops one being typed, so a value over the limit in storage was
 * not written by the editor — and guessing which half of it the couple meant
 * is the repair this module does not do. The whole section drops (renders
 * nothing) rather than publishing a heading over a body we chose to lose.
 */
export function sanitizeCustomSection(raw: unknown): CustomSectionContent {
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const nest =
    src.custom && typeof src.custom === 'object' && !Array.isArray(src.custom)
      ? (src.custom as Record<string, unknown>)
      : src;
  const str = (v: unknown) => (typeof v === 'string' ? normaliseBreaks(v).trim() : '');
  const title = str(nest.title);
  const body = str(nest.body);
  if (title.length > CUSTOM_COLUMN_TITLE_MAX || body.length > CUSTOM_COLUMN_BODY_MAX) {
    return { title: '', body: '' };
  }
  return { title, body };
}

/**
 * THE WRITE DOOR — what a save may store, or why it may not.
 *
 * 🔑 REFUSED, NOT TRUNCATED, AND SAID OUT LOUD. At the door the couple is still
 * there to be told, so cutting their words silently would be the one failure
 * this can avoid. In practice it is unreachable from the editor — the inputs
 * carry the same `maxLength` — so a refusal here means the POST was not made by
 * the editor.
 *
 * Pure so a unit test can reach it: a `'use server'` module may only export
 * async functions.
 */
export type CustomSectionInput =
  | { ok: true; value: CustomSectionContent }
  | { ok: false; reason: 'too_long' };

export function readCustomSectionInput(title: unknown, body: unknown): CustomSectionInput {
  const t = typeof title === 'string' ? normaliseBreaks(title).trim() : '';
  const b = typeof body === 'string' ? normaliseBreaks(body).trim() : '';
  if (t.length > CUSTOM_COLUMN_TITLE_MAX || b.length > CUSTOM_COLUMN_BODY_MAX) {
    return { ok: false, reason: 'too_long' };
  }
  return { ok: true, value: { title: t, body: b } };
}

/* ══ WHO MAY DO WHAT — the Pro line (owner 2026-09-22) ══════════════════════
   "Free is the page we write. Pro is changing how it looks." A section the
   couple writes themselves is ARRANGING, not fixing a word we wrote, so adding
   one is Pro.

   🔑 THE GRANDFATHER RULE, kept exactly as the editor states it (`lockedIf` in
   website/editor/page.tsx, PR #3664): a couple who already HAS content keeps
   editing it. A lapsed or never-bought Pro must not freeze words that are
   already on their page — they could not even correct a typo.

   ⛔ REMOVING IS NEVER LOCKED. Taking your own words off your own page is not
   a feature anybody should have to buy; a lock there would hold a couple's
   page hostage to a purchase.

   Prod measured 2026-09-24 by the controller: 0 custom rows on any event, so
   the gate takes nothing away from anybody today. */
export const CUSTOM_SECTION_INTENTS = ['save', 'arrange', 'delete'] as const;
export type CustomSectionIntent = (typeof CUSTOM_SECTION_INTENTS)[number] | 'add';

export function customSectionIntent(raw: unknown): (typeof CUSTOM_SECTION_INTENTS)[number] | null {
  if (raw === null || raw === undefined || raw === '') return 'save';
  return typeof raw === 'string' && (CUSTOM_SECTION_INTENTS as readonly string[]).includes(raw)
    ? (raw as (typeof CUSTOM_SECTION_INTENTS)[number])
    : null;
}

export function customSectionWriteAllowed(input: {
  intent: CustomSectionIntent;
  ownsPro: boolean;
  /** Did THIS section already have words before this write? */
  hadContent: boolean;
}): boolean {
  if (input.intent === 'delete') return true;
  if (input.ownsPro) return true;
  if (input.intent === 'add') return false;
  return input.hadContent;
}

/**
 * Has this slot anything to show a guest?
 *
 * 🔑 THE BODY IS WHAT COUNTS, and a title alone is not enough. A heading with
 * nothing under it is a section that reads as broken — the guest sees a promise
 * and a blank. The couple keeps the title in the editor either way; it simply
 * does not publish on its own.
 */
export function customSectionHasContent(raw: unknown): boolean {
  return sanitizeCustomSection(raw).body.length > 0;
}

/** The slot a new section should take, or null when all six are in use. */
export function nextFreeCustomSlot(
  used: readonly string[],
): CustomSectionType | null {
  const taken = new Set(used);
  return CUSTOM_SECTION_TYPES.find((t) => !taken.has(t)) ?? null;
}

/** "Your own section" · "Your own section 2" … — what the editor row is called. */
export function customSectionEditorLabel(type: CustomSectionType): string {
  const n = CUSTOM_SECTION_TYPES.indexOf(type) + 1;
  return n === 1 ? 'Your own section' : `Your own section ${n}`;
}
