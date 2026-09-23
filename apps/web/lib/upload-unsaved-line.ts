/**
 * upload-unsaved-line.ts — what a freshly uploaded file says about itself.
 * Pure; executed by `upload-unsaved-line.test.ts`.
 *
 * ── THE DEFECT (owner, 2026-09-23, on /open-shop step 1) ──────────────────
 * The logo uploaded and the chip read "NOT SAVED YET — PRESS SAVE BELOW".
 * Owner: "asking me to press save when there is no save." The button on that
 * step is Continue; the shop is created four steps later by "Open my shop".
 * The sentence was written for /dashboard/profile, whose button IS Save, and
 * then rendered on every one of the 38 places the widget is mounted with a
 * form `name` — the You card ("Done"), the receipt log ("Log"), the dispute
 * ("File flag"), the checkout ("Submit request"), the story editor (a rung).
 *
 * ── THE RULE ──────────────────────────────────────────────────────────────
 * The widget owns the CLAIM ("not saved yet"), because that part is true
 * everywhere: the value reaches the row only when the parent form posts. The
 * parent owns the NEXT STEP, because only the parent knows its own button.
 * So the caller passes the tail, this function joins it, and the type on
 * `FileUpload` refuses a `name` without a tail (a mount that saves the upload
 * itself passes `null` and the widget stays silent).
 *
 * The same idea as `lib/sign-in-door.ts`: never let a sentence written for
 * one screen describe another.
 */

/** The half the widget owns. A caller never repeats it. */
export const UNSAVED_PREFIX = 'Not saved yet — ';

/**
 * Join the widget's claim to the parent's next step. The tail is trimmed and
 * a tail that already carries the claim (a caller pasting the old sentence)
 * is not doubled — "Not saved yet — Not saved yet — press Save below" is
 * the kind of chip nobody reads.
 */
export function unsavedTail(tail: string): string {
  const t = tail.trim();
  if (t === '') throw new Error('unsavedHint must name the next step — an empty tail says nothing');
  return t.replace(/^not saved yet\s*[—–-]\s*/i, '');
}

/** The whole chip, as the widget prints it: the claim it owns + the caller's tail. */
export function unsavedLine(tail: string): string {
  return `${UNSAVED_PREFIX}${unsavedTail(tail)}`;
}

/** The sentence for a parent whose submit control is a button called `label`. */
export function pressBelow(label: string): string {
  const l = label.trim();
  if (l === '') throw new Error('pressBelow needs the button’s label');
  return `press ${l} below`;
}
