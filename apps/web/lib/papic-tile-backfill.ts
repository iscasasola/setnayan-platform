/**
 * papic-tile-backfill.ts — the one number of "Make Memory lane copies" (Admin › Papic storage), pure so the button,
 * the section's words and the server action all read the same value. The action lives in
 * `app/admin/papic-storage/actions.ts`; a `'use server'` file may only export async functions, so the number lives here.
 */

/** Photos per press. Image encoding runs inside one serverless invocation, so it stays modest. */
export const TILES_PER_PRESS = 40;
