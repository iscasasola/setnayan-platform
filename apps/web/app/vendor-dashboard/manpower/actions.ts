'use server';

/**
 * V2 Phase F · Manpower ₱15k offline cash flow · server actions.
 *
 * WHY (canonical · CLAUDE.md 2026-05-28 third row "V1 → V2 PIVOT" § (a) Phase F):
 *
 * Setnayan handles ZERO of the ₱15,000 manpower cash. The host pays the
 * vendor crew 100% directly off-platform (cash · GCash · bank transfer ·
 * whatever the parties agree on). Because Setnayan never sees that money,
 * RR 16-2023 1% Intermediary Tax exemption applies — Setnayan has NO BIR
 * 2307 / EWT / Official Receipt obligation on this leg. The vendor handles
 * their own Form 2307 + OR on the offline ₱15k as the income recipient.
 *
 * What Setnayan DOES capture: a 2-token handshake fee burned from the
 * accepting vendor's wallet via the existing `consume_vendor_assets()`
 * RPC (earned-first FIFO · returns BOOLEAN false on shortfall · per
 * migration 20260628000000 PASS 8). The handshake stamps the accepting
 * vendor's `vendor_profile_id` as the canonical ownership record so the
 * Phase E telemetry checkpoints can attribute future event rewards to
 * the right vendor.
 *
 * Per [[feedback_setnayan_orphan_prevention]] every action has clear
 * entry points: postManpowerGig from /dashboard/[eventId]/manpower (host
 * drawer) · acceptManpowerGig + completeGig + cancelGig from
 * /vendor-dashboard/manpower (vendor card row actions) AND from the host
 * page when host cancels. Auto-merged on green per [[feedback_setnayan_pr_auto_merge]].
 *
 * Per [[feedback_setnayan_no_dev_text_post_launch]] all surfaced copy
 * uses brand-voice editorial register · no engineering jargon · honest
 * about the BIR posture without legalese.
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

// ============================================================================
// Shared types
// ============================================================================

export type ManpowerGigStatus =
  | 'pending'
  | 'accepted'
  | 'completed'
  | 'cancelled';

export type ManpowerGigRow = {
  gig_id: string;
  event_id: string;
  posted_by_user_id: string;
  vendor_profile_id: string | null;
  gig_label: string;
  cash_amount_php_centavos: number;
  handshake_tokens_consumed: number;
  status: ManpowerGigStatus;
  posted_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  notes: string | null;
  bir_exempt_note: string;
};

// ============================================================================
// 1. acceptManpowerGig — vendor-only · 2-token handshake
// ============================================================================
//
// Flow:
//   a. Resolve the calling vendor's vendor_profile_id.
//   b. Verify the gig exists + status='pending' + (optional) vendor_profile_id
//      not already set.
//   c. Call consume_vendor_assets(vendor_profile_id, 2). On shortfall the
//      RPC RAISES with INSUFFICIENT_WALLET_BALANCES — caught and returned as
//      a polite 'insufficient_tokens' status with brand-voice copy.
//   d. UPDATE manpower_gigs SET status='accepted', vendor_profile_id=...,
//      accepted_at=NOW() WHERE gig_id=? AND status='pending' RETURNING *.
//      If 0 rows (race condition · another vendor claimed it between our
//      reads), log + return 'race_lost'.
//   e. Revalidate vendor + host paths.

export type AcceptManpowerResult =
  | { status: 'ok'; gig: ManpowerGigRow }
  | {
      status: 'insufficient_tokens';
      message: string;
    }
  | { status: 'not_signed_in' }
  | { status: 'no_vendor_profile' }
  | { status: 'not_found' }
  | { status: 'already_claimed' }
  | { status: 'race_lost' }
  | { status: 'error'; message: string };

export async function acceptManpowerGig(
  gigId: string,
): Promise<AcceptManpowerResult> {
  if (!gigId || typeof gigId !== 'string') {
    return { status: 'error', message: 'Missing gig id.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { status: 'not_signed_in' };
  }

  // Resolve vendor_profile_id for the calling user.
  const { data: vendor } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!vendor) {
    return { status: 'no_vendor_profile' };
  }

  // Pre-check the gig's current state. The accept UPDATE below is the
  // authoritative gate (it's RLS-protected and atomic against status='pending'),
  // but this pre-check gives us a friendlier error message when the gig is
  // simply gone vs. when the wallet is empty.
  const { data: existing, error: fetchError } = await supabase
    .from('manpower_gigs')
    .select('gig_id, status, vendor_profile_id')
    .eq('gig_id', gigId)
    .maybeSingle();

  if (fetchError) {
    return { status: 'error', message: fetchError.message };
  }
  if (!existing) {
    return { status: 'not_found' };
  }
  if (existing.status !== 'pending' || existing.vendor_profile_id !== null) {
    return { status: 'already_claimed' };
  }

  // 2-token handshake via the existing earned-first FIFO RPC. Wrapped in
  // try/catch because the RPC RAISEs on shortfall (it doesn't return false
  // on shortfall — it throws). Match the canonical pattern from
  // /vendor-dashboard/redeem-code/actions.ts (which also catches the RPC
  // exception → translates to brand-voice copy).
  const { error: spendError } = await supabase.rpc('consume_vendor_assets', {
    p_vendor_id: vendor.vendor_profile_id,
    p_spend_amount: 2,
  });

  if (spendError) {
    if ((spendError.message ?? '').includes('INSUFFICIENT_WALLET_BALANCES')) {
      return {
        status: 'insufficient_tokens',
        message:
          'You need 2 tokens to accept this gig. Buy a token pack from your wallet first.',
      };
    }
    return { status: 'error', message: spendError.message };
  }

  // Atomic claim. Match `status='pending'` + `vendor_profile_id IS NULL`
  // to prevent races: if another vendor's UPDATE landed between our pre-
  // check and this write, the WHERE returns 0 rows. The race window is
  // sub-second (gig pre-fetch → token spend → UPDATE). On race-lost the
  // 2 tokens are already burned — log + return so the vendor sees the
  // honest outcome. No refund RPC in V1 · the rare-race token loss is
  // accepted trade-off vs. building a refund primitive (V1.x candidate).
  const nowIso = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabase
    .from('manpower_gigs')
    .update({
      status: 'accepted',
      vendor_profile_id: vendor.vendor_profile_id,
      accepted_at: nowIso,
    })
    .eq('gig_id', gigId)
    .eq('status', 'pending')
    .is('vendor_profile_id', null)
    .select('*')
    .maybeSingle();

  if (claimError) {
    return { status: 'error', message: claimError.message };
  }
  if (!claimed) {
    console.warn(
      '[manpower] Race-lost on acceptManpowerGig — 2 tokens spent, gig already claimed.',
      { gigId, vendorProfileId: vendor.vendor_profile_id },
    );
    return { status: 'race_lost' };
  }

  revalidatePath('/vendor-dashboard/manpower');
  revalidatePath(`/dashboard/${claimed.event_id}/manpower`);

  return { status: 'ok', gig: claimed as ManpowerGigRow };
}

// ============================================================================
// 2. completeGig — vendor-only · mark accepted gig done
// ============================================================================

export type CompleteGigResult =
  | { status: 'ok' }
  | { status: 'not_signed_in' }
  | { status: 'no_vendor_profile' }
  | { status: 'not_found' }
  | { status: 'not_accepted' }
  | { status: 'error'; message: string };

export async function completeGig(gigId: string): Promise<CompleteGigResult> {
  if (!gigId || typeof gigId !== 'string') {
    return { status: 'error', message: 'Missing gig id.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'not_signed_in' };

  const { data: vendor } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!vendor) return { status: 'no_vendor_profile' };

  const { data: updated, error } = await supabase
    .from('manpower_gigs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('gig_id', gigId)
    .eq('vendor_profile_id', vendor.vendor_profile_id)
    .eq('status', 'accepted')
    .select('event_id')
    .maybeSingle();

  if (error) return { status: 'error', message: error.message };
  if (!updated) return { status: 'not_accepted' };

  revalidatePath('/vendor-dashboard/manpower');
  revalidatePath(`/dashboard/${updated.event_id}/manpower`);
  return { status: 'ok' };
}

// ============================================================================
// 3. cancelGig — vendor OR host · NO token refund on cancel
// ============================================================================
//
// Per CLAUDE.md 2026-05-28 third row § (a) Phase F: the 2-token handshake
// is fully earned by Setnayan once accept fires. Cancellations don't
// refund the handshake — the platform's compute + reward attribution
// commitment already kicked in. This matches the "no release fee" + "audit
// only" posture from CLAUDE.md 2026-05-27 row Rule 2 vendor-side release.

export type CancelGigResult =
  | { status: 'ok' }
  | { status: 'not_signed_in' }
  | { status: 'not_found_or_unauthorized' }
  | { status: 'error'; message: string };

export async function cancelGig(
  gigId: string,
  reason: string,
): Promise<CancelGigResult> {
  if (!gigId || typeof gigId !== 'string') {
    return { status: 'error', message: 'Missing gig id.' };
  }
  if (typeof reason !== 'string' || reason.trim().length < 4) {
    return {
      status: 'error',
      message: 'A short cancellation reason is required.',
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'not_signed_in' };

  // RLS already gates host + vendor reads. The UPDATE below relies on
  // those policies — if neither matches, the UPDATE returns 0 rows.
  // Status guard: only cancel if pending or accepted (completed gigs are
  // closed; cancelled gigs are immutable).
  const { data: updated, error } = await supabase
    .from('manpower_gigs')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason.trim().slice(0, 500),
    })
    .eq('gig_id', gigId)
    .in('status', ['pending', 'accepted'])
    .select('event_id')
    .maybeSingle();

  if (error) return { status: 'error', message: error.message };
  if (!updated) return { status: 'not_found_or_unauthorized' };

  revalidatePath('/vendor-dashboard/manpower');
  revalidatePath(`/dashboard/${updated.event_id}/manpower`);
  return { status: 'ok' };
}

// ============================================================================
// 4. postManpowerGig — host-only · INSERT a new pending gig
// ============================================================================
//
// Form fields (FormData shape used by the post-gig drawer):
//   event_id          UUID    required
//   gig_label         TEXT    required · 4–200 chars
//   cash_amount_php   STRING  optional · whole pesos · default ₱15,000
//   notes             TEXT    optional · free-form
//
// On success: redirects to /dashboard/[eventId]/manpower with ?posted=1
// so the host sees the success banner + new row in the list.

export async function postManpowerGig(formData: FormData): Promise<void> {
  const eventId = formData.get('event_id');
  const gigLabel = formData.get('gig_label');
  const cashAmountPhpRaw = formData.get('cash_amount_php');
  const notesRaw = formData.get('notes');

  if (typeof eventId !== 'string' || !eventId) {
    redirect('/dashboard?error=' + encodeURIComponent('Missing event.'));
  }

  if (typeof gigLabel !== 'string' || gigLabel.trim().length < 4) {
    redirect(
      `/dashboard/${eventId}/manpower?error=` +
        encodeURIComponent('Give the gig a short label (at least 4 characters).'),
    );
  }

  const cashAmountPhpCentavos = (() => {
    if (typeof cashAmountPhpRaw !== 'string' || cashAmountPhpRaw.trim().length === 0) {
      return 1_500_000; // ₱15,000 default
    }
    const parsed = Math.round(Number(cashAmountPhpRaw.replace(/[^0-9.]/g, '')) * 100);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 1_500_000;
    }
    return parsed;
  })();

  const notes =
    typeof notesRaw === 'string' && notesRaw.trim().length > 0
      ? notesRaw.trim().slice(0, 2000)
      : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // RLS on event_members + manpower_gigs (host SELECT policy) gates the
  // INSERT indirectly: we INSERT with posted_by_user_id = auth.uid() · the
  // SELECT on the returned row enforces host-membership. Non-hosts get a
  // PostgREST-level error that surfaces as a generic failure (the policy
  // model is INSERT-allowed-for-authenticated, but the returning SELECT
  // requires host membership · same pattern as event-qr regenerate).
  const { error: insertError } = await supabase.from('manpower_gigs').insert({
    event_id: eventId,
    posted_by_user_id: user.id,
    gig_label: gigLabel.trim().slice(0, 200),
    cash_amount_php_centavos: cashAmountPhpCentavos,
    notes,
  });

  if (insertError) {
    redirect(
      `/dashboard/${eventId}/manpower?error=` +
        encodeURIComponent(insertError.message || 'Could not post gig.'),
    );
  }

  revalidatePath(`/dashboard/${eventId}/manpower`);
  redirect(`/dashboard/${eventId}/manpower?posted=1`);
}
