/**
 * ONE SPELLING OF "WHAT IS CURRENTLY SAVED" FOR A COVERAGE'S AUDIENCE.
 *
 * Pure module — no env, no I/O. Lives outside the `'use server'` file because a
 * server-action module may export nothing but async functions.
 *
 * The canvas maker's audience sheet saves WITHOUT navigating away, so its
 * "Saved" note stays on screen while the vendor keeps editing chips. A note
 * that says "Saved" under a selection nobody saved is a lie the vendor will
 * only discover on the couple's side, so the note is bound to a key: the server
 * returns the key of what it STORED, the sheet computes the key of what is on
 * SCREEN, and the note shows only while they are equal.
 *
 * Built from the server's NARROWED values on the write side — so a chip the
 * server dropped (an admin narrowed the leaf between render and save) produces a
 * different key, and the note quietly stops claiming it rather than confirming
 * something that did not happen.
 */
export function coverageServesKey(
  coverageId: number | string,
  eventTypes: readonly string[],
  faiths: readonly string[],
): string {
  return [
    String(coverageId),
    [...eventTypes].sort().join(','),
    [...faiths].sort().join(','),
  ].join('|');
}
