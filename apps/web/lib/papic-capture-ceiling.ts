/**
 * The per-camera capture ceiling — the "accepts/sec limiter" the Papic plan
 * listed under open risks (Papic_Build_Brief_2026-07-17 · Papic_v3_Whats_Next_
 * 2026-07-18).
 *
 * NOT a product rule and not a quota: a runaway-client backstop. A human with a
 * shutter never reaches it; a stuck loop reaches it at once. 60 shots per 5
 * seconds is ~12/second sustained with a full second of burst headroom.
 *
 * 🔑 PER CAMERA, NEVER PER EVENT. The owner's stated peak is 1–250 captures per
 * second FOR AN EVENT, spread over many phones. An event-level limiter would
 * have to sit above 250/s to avoid capping the product — and a limit above the
 * intended peak protects nothing.
 *
 * 🪤 WHY THESE TWO NUMBERS LIVE HERE AND NOT IN `app/papic/actions.ts`. That
 * file carries `'use server'`, and **a "use server" module may only export
 * async functions** — exporting a constant from it typechecks perfectly and
 * then fails the production build with "Only async functions are allowed to be
 * exported in a 'use server' file". `tsc` cannot see it because it is a bundler
 * rule, not a type rule. Constants shared with a server action belong in an
 * ordinary module like this one.
 */
export const PAPIC_SEAT_BURST = 60;
export const PAPIC_SEAT_BURST_WINDOW_S = 5;
