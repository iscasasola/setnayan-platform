import 'server-only';
import type { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';

/**
 * lib/lock-request-notices.server.ts — THE BOOKING-REQUEST NOTICES THAT MORE
 * THAN ONE DOOR HAS TO SEND, WRITTEN ONCE.
 *
 * 🔴 WHY THIS EXISTS (2026-10-10). A booking request closes unanswered through
 * THREE doors, and only one of them told the couple:
 *
 *   · the sweep (`expire_stale_lock_requests`, lib/lock-request-expiry.ts)
 *     — told them;
 *   · the supplier pressing AGREE after the 48 hours (`vendor_agree_to_lock`
 *     flips the row to `expired` itself and answers `status: 'expired'`)
 *     — told nobody;
 *   · the supplier pressing DECLINE after the 48 hours (`vendor_decline_lock`,
 *     same lazy flip) — told nobody.
 *
 * The two late presses are not rare: the sweep rides request traffic with a
 * 20-hour floor, so on a quiet day the FIRST thing to notice a dead request is
 * the supplier opening the app and pressing a button. The row then read
 * `expired`, the sweep (which selects `pending` only) never saw it again, and
 * the couple's "Waiting for their yes" row simply disappeared.
 *
 * 🔑 ONE NOTICE, ONE PLACE. The words live here so every door says the same
 * sentence, and `couple-supplier-notices-reach-email.test.ts` fails if the type
 * is ever emitted from anywhere else.
 *
 * 🔒 IT CANNOT SEND TWICE, AND THE REASON IS IN THE DATABASE, NOT HERE. Each of
 * the three doors is the transaction that MOVES the row `pending → expired`,
 * under a row lock, and each reports the row only when it did the moving:
 * the sweep returns the rows its own UPDATE touched (`WHERE lock_request_state =
 * 'pending' … FOR UPDATE SKIP LOCKED`); the two functions answer `expired` only
 * on the call that flips it and `not_pending` on every call after. So exactly
 * one door ever holds the row to announce.
 * `tests/db/lock-handshake-wiring.db.test.ts` runs all three against the real
 * functions: late press → `expired`; sweep → nothing; second press →
 * `not_pending`.
 */

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Tell every couple member that their booking request closed unanswered.
 * Returns how many people were told. Never throws for a missing supplier name;
 * a refused member read is logged and tells nobody (the caller already
 * committed the state change — a notice must not undo it).
 */
export async function tellCoupleLockRequestExpired(
  admin: Admin,
  args: { eventId: string; eventVendorId: string },
): Promise<number> {
  const { data: ev, error: evError } = await admin
    .from('event_vendors')
    .select('vendor_name')
    .eq('vendor_id', args.eventVendorId)
    .maybeSingle();
  // An unreadable name is not a reason to stay silent: the notice still goes,
  // naming "The supplier", and the refusal is logged.
  if (evError) {
    console.error(
      `[lock-request-notices] could not read the supplier's name, vendor_id=${args.eventVendorId}:`,
      evError.message,
    );
  }
  const vendorName = (ev as { vendor_name?: string } | null)?.vendor_name ?? 'The supplier';
  const { data: members, error } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', args.eventId)
    .eq('member_type', 'couple');
  if (error) {
    console.error(
      `[lock-request-notices] could not read who to tell that the request expired, event_id=${args.eventId}:`,
      error.message,
    );
    return 0;
  }
  let told = 0;
  for (const m of members ?? []) {
    if (!m.user_id) continue;
    await emitNotification({
      userId: m.user_id,
      type: 'lock_request_expired',
      title: `${vendorName} did not answer`,
      body: `${vendorName} did not reply within 48 hours, so your request is closed. You can ask them again or pick someone else.`,
      relatedUrl: `/dashboard/${args.eventId}/vendors`,
    });
    told += 1;
  }
  return told;
}
