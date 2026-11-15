/**
 * 🎁 A BOOKING-FEE CHARGE RAISED BEFORE THE PHOTO GIFT RETIRED (owner 2026-11-15, gift for services).
 *
 * Since migration `gifts_picked_when_the_supplier_agrees` a NEW charge is never offered the old "N free Papic photos"
 * gift; a charge that was offered it BEFORE keeps it ("gifts already given stay"). The tests that pin how such a charge
 * is sized, billed, frozen and granted use this to stand up exactly that charge: it applies the OLD snapshot rule
 * (verbatim from 20271222508050 — `kind = 'primary' AND source = 'lock' AND event_vendor_id IS NOT NULL AND
 * setnayan_gift_offered_on(event_vendor_id)`), and re-sizes the row the way the trigger does on any update.
 *
 * The sizing trigger is paused only for the one UPDATE that writes the snapshot — the trigger itself refuses that write
 * on purpose (a client can never turn the gift on), and a test has no other way to reach a pre-retirement row.
 */
import type { PGlite } from '@electric-sql/pglite';

export async function asRaisedBeforeTheRetirement(db: PGlite, chargeId: string | null | undefined): Promise<void> {
  if (!chargeId) return;
  const r = await db.query<{ offered: boolean | null }>(
    `SELECT (kind = 'primary' AND source = 'lock' AND event_vendor_id IS NOT NULL
             AND public.setnayan_gift_offered_on(event_vendor_id)) AS offered
       FROM public.booking_fee_charges WHERE charge_id = $1`,
    [chargeId],
  );
  if (r.rows[0]?.offered !== true) return;
  await db.exec(`ALTER TABLE public.booking_fee_charges DISABLE TRIGGER booking_fee_charges_size_the_gift`);
  try {
    await db.query(`UPDATE public.booking_fee_charges SET setnayan_gift_offered = TRUE WHERE charge_id = $1`, [chargeId]);
  } finally {
    await db.exec(`ALTER TABLE public.booking_fee_charges ENABLE TRIGGER booking_fee_charges_size_the_gift`);
  }
  await db.query(`UPDATE public.booking_fee_charges SET updated_at = NOW() WHERE charge_id = $1`, [chargeId]);
}
