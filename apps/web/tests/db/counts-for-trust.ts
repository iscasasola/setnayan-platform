/**
 * A fixture helper: make a shop's booking on an event COUNT FOR TRUST in the sense of the owner's 21 Nov 2026 ruling
 * ("TRUST NEEDS ONE COMPLETED, PAID EVENT THE TWO SHOPS SERVED TOGETHER", migration 20271361607663,
 * `booking_counts_for_trust`): delivered, a payment the supplier confirmed, and arm's length — the couple found the
 * shop on Setnayan (`foundOnSetnayan`, the 23 Nov rule). Since that ruling a shared event makes two shops "served
 * together" only when BOTH bookings count, so a test whose fixture means "they worked that event" calls this for each
 * shop on it.
 *
 * What it writes (superuser, like every fixture): the shop's booking(s) on the event set to delivered, one confirmed
 * payment on each, and what `foundOnSetnayan` writes (the shop verified long ago, one Setnayan chat thread).
 */
import type { ReplayResult } from './replay-migrations';
import { foundOnSetnayan } from './found-on-setnayan';

export async function completedAndPaid(db: ReplayResult['db'], eventId: string, shop: string): Promise<void> {
  const { rows } = await db.query<{ vendor_id: string }>(
    `UPDATE public.event_vendors SET status = 'delivered'
      WHERE event_id = $1 AND marketplace_vendor_id = $2
      RETURNING vendor_id`,
    [eventId, shop],
  );
  for (const r of rows) {
    await db.query(
      `INSERT INTO public.event_vendor_payments (event_id, vendor_id, amount_php, method, paid_at, vendor_confirmed_at)
       VALUES ($1, $2, 5000, 'GCash', NOW(), NOW())`,
      [eventId, r.vendor_id],
    );
  }
  await foundOnSetnayan(db, shop, eventId);
}
