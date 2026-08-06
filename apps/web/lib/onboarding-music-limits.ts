/**
 * Onboarding background-music limits.
 *
 * ⚠ THIS LIVES HERE, NOT IN `app/admin/onboarding/actions.ts`, AND THAT IS THE
 * WHOLE REASON THE FILE EXISTS. That module carries `'use server'`, where Next
 * allows ONLY async function exports — a plain `export const` fails the
 * production build with:
 *     Only async functions are allowed to be exported in a "use server" file.
 *
 * It is invisible to `tsc --noEmit` and to `tsx --test`: both were clean while
 * the build was broken. Only `next build` sees it, which is why this shipped
 * green and failed in CI. Same shape as the standing rule about never exporting
 * plain data from a `'use client'` module — this is its server-side twin.
 *
 * The save action and the admin form must agree on one number, so it is stated
 * once, here, where both may import it.
 */

/** How many background tracks the onboarding playlist accepts. */
export const ONBOARDING_MUSIC_MAX_TRACKS = 8;
