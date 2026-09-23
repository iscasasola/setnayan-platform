/**
 * THE RAIL'S ROW STATUS — two pure helpers, and deliberately NOT in a client file.
 *
 * 🔴 WHY THIS FILE EXISTS. `done()` and `todo()` used to be exported from
 * `editor-shell.tsx`, which carries `'use client'`, and the SERVER page called
 * them seventeen times. In development that works; in a production build the
 * client module is a reference, not a module, and React refuses:
 *
 *     Attempted to call done() from the server but done is on the client.
 *
 * The whole website editor returned a 500 to the couple — measured on
 * production 2026-09-23, digest 2184633741, one user, one route. The owner hit
 * it while looking at the editor I had asked him to look at.
 *
 * 🔑 A `'use client'` FILE IS A BOUNDARY, NOT A FOLDER. Anything exported from
 * one is a client reference: a component may be RENDERED from the server, but a
 * plain function may not be CALLED from it. Types are fine — they are erased.
 * So the pure helpers live here, where both sides may use them, and
 * `the-editor-page-calls-no-client-function.test.ts` fails the build if a
 * server page ever imports a value from a client module again.
 *
 * ⚠ These are not re-exported from `editor-shell.tsx`. A re-export would make
 * the old import path work again and put the trap straight back.
 */

/** One rail row's chip: the words, and whether they mean "filled" or "empty". */
export type RowStatus = { label: string; filled: boolean };

/** A row with something in it — the lit chip. */
export function done(label: string): RowStatus {
  return { label, filled: true };
}

/** A row with nothing in it yet — the quiet chip. Say this whenever the words
 *  mean "empty", "off", "private" or "none", however they are phrased. */
export function todo(label: string): RowStatus {
  return { label, filled: false };
}
