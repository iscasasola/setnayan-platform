import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { emitNotification } from '@/lib/notification-emit';
import { createAdminClient } from '@/lib/supabase/admin';
import { clearHomeShelf } from '@/lib/home-shelf-clear';
import {
  PAPERS_LAPSED_AUDIT_ACTION,
  PAPERS_LAPSED_NOTICE,
  papersLapseDue,
  type LapseCandidate,
} from '@/lib/papers-lapse';

/**
 * Stamp every shop whose renewal day passed with no renewed papers — the
 * server half of `lib/papers-lapse.ts`, run by the existing daily badge pass
 * (`runVerifiedBadgeDeadlineSweep`). No new scheduler.
 *
 * What a lapse DOES (owner DECISION_LOG 481b9b6b, correcting "block new"):
 *   · `papers_lapsed_at` is stamped → the shop leaves search, Discover and every
 *     couple-facing list (`FINDABLE_SHOP_GATE` reads `papers_current`);
 *   · a free "verified" plan becomes "free" (paid plans are left alone);
 *   · the supplier is told once, in-app and by email.
 * What it does NOT do: refuse any booking request (the app's booking gate and the
 * database trigger do not read the stamp — whether an event that inquired before
 * the lapse can be booked after it is unconfirmed, so it stays as today), stop
 * hand-imported clients, or touch `verification_state`, `public_visibility`, or
 * any booking, chat, payment, schedule or Event Hub row.
 *
 * 🔁 IDEMPOTENT: the stamp is a conditional write (`papers_lapsed_at IS NULL`),
 * and only a row that write actually changed is told. A second run changes
 * nothing and says nothing.
 *
 * NEVER THROWS.
 */
export async function stampLapsedPapers(_admin: SupabaseClient, now: Date = new Date()): Promise<number> {
  // The SERVICE ROLE, inline: the shop's renewal day is a trust column no session reads (20271217955839).
  const admin = createAdminClient();
  try {
    const { data, error } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, user_id, tier_state, verification_state, next_renewal_due_at, papers_lapsed_at')
      .eq('verification_state', 'verified')
      .is('papers_lapsed_at', null)
      .not('next_renewal_due_at', 'is', null)
      .lt('next_renewal_due_at', now.toISOString())
      .limit(200);
    if (error) {
      console.error('[papers-lapse] candidate read failed:', error.message);
      return 0;
    }
    let stamped = 0;
    for (const row of (data ?? []) as Array<LapseCandidate & { vendor_profile_id: string; user_id: string | null; tier_state: string | null }>) {
      if (!papersLapseDue(row, now)) continue;
      const stampedAt = now.toISOString();
      const { data: changed, error: stampErr } = await admin
        .from('vendor_profiles')
        .update({
          papers_lapsed_at: stampedAt,
          // Free · Unverified: the free "verified" plan drops to "free". A paid plan is left as it is.
          ...(row.tier_state === 'verified' ? { tier_state: 'free' } : {}),
          updated_at: stampedAt,
        })
        .eq('vendor_profile_id', row.vendor_profile_id)
        .is('papers_lapsed_at', null)
        .select('vendor_profile_id');
      // The home page remembers the live shops for 60 s — this shop just left them (lib/home-shelf-clear.ts).
      clearHomeShelf('shops');
      if (stampErr) console.error('[papers-lapse] stamp failed', stampErr.message);
      if (stampErr || !Array.isArray(changed) || changed.length !== 1) continue;
      stamped += 1;
      if (row.user_id) {
        await emitNotification({
          userId: row.user_id,
          type: 'vendor_status_change',
          title: PAPERS_LAPSED_NOTICE.title,
          body: PAPERS_LAPSED_NOTICE.body,
          relatedUrl: '/vendor-dashboard/profile#docs',
        }).catch(() => undefined);
      }
      const { error: auditErr } = await admin.from('admin_audit_log').insert({
        action: PAPERS_LAPSED_AUDIT_ACTION,
        target_table: 'vendor_profiles',
        target_id: row.vendor_profile_id,
        actor_user_id: null,
        metadata: {
          deadline: row.next_renewal_due_at,
          lapsed_at: stampedAt,
          tier_before: row.tier_state,
          tier_after: row.tier_state === 'verified' ? 'free' : row.tier_state,
          notified: Boolean(row.user_id),
        },
      });
      if (auditErr) console.error('[papers-lapse] audit write failed', auditErr.message);
    }
    return stamped;
  } catch (e) {
    console.error('[papers-lapse] pass failed:', e instanceof Error ? e.message : String(e));
    return 0;
  }
}
