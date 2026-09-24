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
 * Recommended in the 2026-09-23 plan as "six per phase"; the owner has not
 * ruled, and six slots is the same answer expressed as a shape. A seventh
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

/** Matches the recap's custom columns, so one product has one answer. */
export const CUSTOM_TITLE_MAX = 80;
export const CUSTOM_BODY_MAX = 4000;

export function isCustomSectionType(value: unknown): value is CustomSectionType {
  return typeof value === 'string' && (CUSTOM_SECTION_TYPES as readonly string[]).includes(value);
}

/** What the couple wrote. Both parts optional; neither is invented. */
export type CustomSectionContent = {
  title: string;
  body: string;
};

/**
 * Read one slot's words out of `config_json`.
 *
 * ⚠ Stored config is text a person typed months ago, not a promise about
 * shape. Anything that is not a string is dropped; what survives is trimmed and
 * bounded. Bounding rather than refusing, unlike the canvas: a body one
 * character over a limit is still the couple's writing, and losing the whole
 * paragraph to protect a number would be the worse failure.
 */
export function sanitizeCustomSection(raw: unknown): CustomSectionContent {
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const nest =
    src.custom && typeof src.custom === 'object' && !Array.isArray(src.custom)
      ? (src.custom as Record<string, unknown>)
      : src;
  const str = (v: unknown, max: number) =>
    typeof v === 'string' ? v.trim().slice(0, max) : '';
  return {
    title: str(nest.title, CUSTOM_TITLE_MAX),
    body: str(nest.body, CUSTOM_BODY_MAX),
  };
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
