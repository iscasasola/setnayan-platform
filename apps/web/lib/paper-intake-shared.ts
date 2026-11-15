/**
 * paper-intake-shared.ts — the one number the supplier's screen and the server
 * intake share, kept free of `node:crypto` so a client component can import it.
 */

/** Tries per paper (owner 2026-11-14: "3 tries per paper"). */
export const MAX_TRIES = 3;
