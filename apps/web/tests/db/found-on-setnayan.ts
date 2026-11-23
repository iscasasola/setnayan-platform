/**
 * A fixture helper: make one (shop, event) ARM'S LENGTH in the sense of the owner's 2026-11-23 ruling (specs
 * DECISION_LOG b89e2420, migration 20271361301072) — the couple FOUND the shop on Setnayan, and the shop was verified
 * before it first met the event. Since that ruling only such an event moves a shop's stars, events done and track
 * record, so a test whose fixture means "a real booking that counts" calls this for that event — and ONLY that event:
 * a sourced chat thread makes the event a Setnayan save whatever its booking row's source says.
 *
 * What it writes (superuser, like every fixture): the shop verified long ago (only when it is not verified yet, or
 * verified too recently), and one chat thread for the pair from a Setnayan surface (`inquiry_source = 'search'`,
 * `booking_fee_is_sourced_surface`).
 */
import type { ReplayResult } from './replay-migrations';

export async function foundOnSetnayan(db: ReplayResult['db'], shop: string, event: string): Promise<void> {
  await db.query(
    `UPDATE public.vendor_profiles
        SET verification_state = 'verified',
            last_verified_at = LEAST(COALESCE(last_verified_at, NOW()), NOW() - INTERVAL '365 days')
      WHERE vendor_profile_id = $1`,
    [shop],
  );
  await db.query(
    `INSERT INTO public.chat_threads (event_id, vendor_profile_id, inquiry_status, inquiry_source)
     VALUES ($1, $2, 'pending', 'search')
     ON CONFLICT DO NOTHING`,
    [event, shop],
  );
}
