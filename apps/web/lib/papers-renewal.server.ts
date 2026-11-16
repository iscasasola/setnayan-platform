import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { RenewalPageFacts } from '@/lib/papers-renewal';

/**
 * The renewal facts for ONE shop, read for the shop's own pages (Today, the verification page) — the server half of
 * `lib/papers-renewal.ts`. The renewal day is a trust column no session reads off `vendor_profiles`
 * (20271217955839), so it comes from the shop's own projection `vendor_profiles_self` (the read Today's old
 * permit row made, which this replaces).
 *
 * NEVER THROWS. A refused read is logged and answers `null` — the pages then say nothing about renewal, never a
 * deadline they did not read.
 */
export type RenewalView = RenewalPageFacts;

/** Bookings that carry on: booked and not yet delivered (`vendor_status`). */
const CARRYING_ON = ['contracted', 'deposit_paid'] as const;

export async function readRenewalView(supabase: SupabaseClient, vendorProfileId: string): Promise<RenewalView | null> {
  try {
    const [self, app] = await Promise.all([
      supabase
        .from('vendor_profiles_self')
        .select('verification_state, next_renewal_due_at, papers_lapsed_at, last_verified_at')
        .eq('vendor_profile_id', vendorProfileId)
        .maybeSingle(),
      supabase
        .from('vendor_verification_applications')
        .select('application_type, status')
        .eq('vendor_profile_id', vendorProfileId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (self.error) {
      logQueryError('papers-renewal: own row', self.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
      return null;
    }
    if (!self.data) return null;
    const row = self.data as {
      verification_state?: string | null;
      next_renewal_due_at?: string | null;
      papers_lapsed_at?: string | null;
      last_verified_at?: string | null;
    };
    if (app.error) logQueryError('papers-renewal: latest application', app.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    const latest = (app.data ?? null) as { application_type?: string | null; status?: string | null } | null;

    let bookings: number | null = null;
    if (row.papers_lapsed_at) {
      // Service role, scoped by the session-proved shop id (the caller's own shop): a count, no rows leave.
      const { count, error } = await createAdminClient()
        .from('event_vendors')
        .select('event_id', { count: 'exact', head: true })
        .eq('marketplace_vendor_id', vendorProfileId)
        .in('status', [...CARRYING_ON]);
      if (error) logQueryError('papers-renewal: bookings count', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
      else bookings = count ?? null;
    }
    return {
      verified: row.verification_state === 'verified',
      dueAt: row.next_renewal_due_at ?? null,
      lapsedAt: row.papers_lapsed_at ?? null,
      lastVerifiedAt: row.last_verified_at ?? null,
      renewed: latest?.application_type === 'annual_renewal' && latest.status === 'approved',
      bookings,
    };
  } catch {
    return null;
  }
}
