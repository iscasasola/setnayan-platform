/**
 * 🧾 THE DRESS CODE'S DO'S & DON'TS — HOW THE TWO LISTS ARE DRAWN.
 *
 * Owner, preview check 08 Oct 2026, verbatim: *"the presentation of do's and don'ts doesn't look good with the
 * rest of the website"*. The shipped drawing is two filled notes with small mono labels and "·" bullets — app
 * furniture inside an editorial page. Two more looks draw the same two lists in the Event Hub's OWN type and
 * colours (the page's display face for the headings, its body size for the lines, gild and ink — the tokens
 * every other scene wears), with NO filled box and a ✓ / ✕ before each line:
 *
 *   · notes         — the shipped two notes. The DEFAULT and an ABSENCE, so a live page that never picked draws
 *                     exactly what it drew (guests are opening invitations the morning this ships).
 *   · marks         — "Ticks and crosses": Do, then Don't, one under the other; ✓ / ✕ before each line.
 *   · side-by-side  — "Side by side": the two lists as two columns under one rule; ✓ / ✕ before each line.
 *
 * ⚠ The approved Maker prototype draws no guest-page looks for this (it draws the Studio's ✓ / ✕ editing list
 * only), so these two are built from the owner's words and the shipped tokens — named for what they look like,
 * like every registered style (`lib/layouts-are-the-shipped-scene-styles.test.ts`).
 *
 * ── WHERE A PICK LIVES ──────────────────────────────────────────────────────────────────────────────
 * On the Dress code row, beside its layout and its palette look: `config_json.canvas.dos`
 * (`sanitizeSceneStyleId`, drafted and applied by the one canvas draft door, like `canvas.palette`). The
 * couple's WORDS stay where they are (`events.dress_code_config.dos / donts`, Studio › Mood Board). ABSENT, or
 * an id this version does not draw, reads as `notes` — a stray value can never blank the lists. FREE.
 * No migration.
 *
 * Pure. No I/O. Client-safe.
 */
import { sanitizeSceneStyleId } from '@/lib/scene-style-id';

export const DOS_LOOK_IDS = ['notes', 'marks', 'side-by-side'] as const;
export type DosLookId = (typeof DOS_LOOK_IDS)[number];

/** Absent = this. Today's drawing — a live page that never picked does not change. */
export const DOS_LOOK_DEFAULT: DosLookId = 'notes';

export const DOS_LOOKS: ReadonlyArray<{ id: DosLookId; name: string; line: string }> = [
  { id: 'notes', name: 'Two notes', line: 'A note for each list, as shipped.' },
  { id: 'marks', name: 'Ticks and crosses', line: 'Do, then Don’t — a ✓ or ✕ before each line.' },
  { id: 'side-by-side', name: 'Side by side', line: 'Two columns under one rule, a ✓ or ✕ before each line.' },
];

export function isDosLookId(v: unknown): v is DosLookId {
  return typeof v === 'string' && (DOS_LOOK_IDS as readonly string[]).includes(v);
}

/** The look the two lists are drawn in — the pick when it is one of these, else the shipped notes. */
export function resolveDosLook(picked: unknown): DosLookId {
  const id = sanitizeSceneStyleId(picked);
  return isDosLookId(id) ? id : DOS_LOOK_DEFAULT;
}

/** The look card's ask (`?style=dress_code_dos:<id>` → `canvas.dos`, `app/[slug]/_lib/style-preview.ts`). Never stored. */
export const DOS_LOOK_PREVIEW_TYPE = 'dress_code_dos';
/** The block of the Dress code scene a Do's & Don'ts card is fitted on. */
export const DOS_LOOK_CARD_FOCUS = '[data-dress-code="dos"]';
