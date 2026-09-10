import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isLockHandshakeEnabled } from '@/lib/lock-handshake-flag';
import { lockRequestStateOf } from '@/lib/lock-request-state';
import type { ThreadLockHandshake } from '@/lib/lock-freeze-copy';

/**
 * IS THE BOOKING BEHIND THIS CHAT THREAD ACTUALLY BOOKED, OR MERELY ASKED?
 *
 * The chat thread is where the couple presses "🔒 Lock this deal", and under
 * PR-H that press only ASKS. The card that reports the outcome sits in the
 * thread for BOTH people, so both pages need one answer to the same question —
 * and deriving it twice is how two screens come to disagree.
 *
 * 🔑 SCOPED BY THE PAIR THE THREAD IS ALREADY ABOUT. `eventId` and
 * `vendorProfileId` both come off the thread row the caller has already been
 * authorized against; this reads NOTHING that is not the handshake state of
 * that one booking — three columns, no money, no guest data, no schedule.
 *
 * ⚠ WHICH CLIENT TO PASS, AND WHY IT IS NOT THE SAME ON BOTH SIDES.
 * `event_vendors` has FOUR policies in production and every one of them is
 * couple- or moderator-scoped — **a supplier cannot read this table through
 * their own session at all**. So the couple's surfaces pass their OWN session
 * client (RLS is the boundary, as it should be) and the supplier's surfaces
 * pass the admin client scoped to their own `vendor_profile_id`, which is the
 * shape already shipping in `fetchLockAgreementRequests` and on the customer
 * card. Passing the session client on the supplier's side is not a security
 * improvement — it silently returns nothing, and the card falls back to the
 * vague line.
 */
export type { ThreadLockHandshake };

export async function fetchThreadLockHandshake(
  client: SupabaseClient,
  args: { eventId: string; vendorProfileId: string | null },
): Promise<ThreadLockHandshake | null> {
  const { eventId, vendorProfileId } = args;
  if (!eventId || !vendorProfileId) return null;

  const { data, error } = await client
    .from('event_vendors')
    .select('status, lock_request_state, lock_request_expires_at, lock_requested_at')
    .eq('event_id', eventId)
    .eq('marketplace_vendor_id', vendorProfileId)
    // A covered cascade line carries no request of its own — only the anchor is
    // ever asked. An archived row is a withdrawn booking. Same floors the
    // supplier's own Answers Desk read carries.
    .or('package_role.is.null,package_role.eq.anchor')
    .is('archived_at', null)
    .order('lock_requested_at', { ascending: false, nullsFirst: false })
    .limit(1);

  // A refused or failed read must NOT be reported as "no booking" — that would
  // downgrade a real "Deal locked" to the vague line for reasons nobody can
  // see. Null means "unknown", and the card's unknown branch says only what is
  // certainly true.
  if (error) {
    console.error('[thread-lock-handshake] read failed', error);
    return null;
  }

  const row = (data ?? [])[0] as
    | { status: string | null; lock_request_state: string | null; lock_request_expires_at: string | null }
    | undefined;
  if (!row) return null;

  return {
    state: lockRequestStateOf(
      { status: row.status, lock_request_state: row.lock_request_state },
      isLockHandshakeEnabled(),
    ),
    expiresAt: row.lock_request_expires_at ?? null,
  };
}
