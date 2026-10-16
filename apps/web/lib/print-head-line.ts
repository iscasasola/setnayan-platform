/**
 * lib/print-head-line.ts — A PRINT ROW'S SMALL LINE NAMES THE CHOSEN SIZE, NEVER EVERY SIZE (owner 2026-10-16, DECISION_LOG
 * "STUDIO › PRINTS GETS A PIECE BAR, ONE 'ON EVERY PRINT' BLOCK AND SHORT SIZE LINES"; prototype
 * `prints_page_navigation_2026-10-16.html` change 3).
 *
 * Studio › Prints' head row once listed every size beside the picture AND its size ▾ ("Calling card · ID card (CR80) · Train
 * ticket · Boarding pass · Phone card (3:4 portrait)" wrapped to eleven lines — a 245-px head, the screen the owner was on).
 * The line now says the size that is PICKED, with its millimetres; every size stays in the dropdown, where it is picked.
 * Pure, so `print-head-lines-name-the-chosen-size.test.ts` holds every format of every family.
 */

/** "90 × 54 mm" — whole millimetres (a CR80's 85.725 reads 86). */
export function printSizeMm(wMm: number, hMm: number): string {
  return `${Math.round(wMm)} × ${Math.round(hMm)} mm`;
}

/** What a piece adds after its size — the pass is printed one per guest. */
const AFTER: Readonly<Record<string, string>> = { pass: 'one per guest' };

/** A set piece's head line: "Calling card · 90 × 54 mm · one per guest", "A5 · 148 × 210 mm". */
export function printHeadLine(piece: string, chosen: { label: string; wMm: number; hMm: number }): string {
  return [chosen.label, printSizeMm(chosen.wMm, chosen.hMm), AFTER[piece]].filter(Boolean).join(' · ');
}

/** The entrance seating chart's head line: "A2 · one sheet for the door". */
export function chartHeadLine(chosen: { label: string }): string {
  return `${chosen.label} · one sheet for the door`;
}
