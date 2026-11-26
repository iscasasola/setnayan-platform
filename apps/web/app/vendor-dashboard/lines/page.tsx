import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { logQueryError } from '@/lib/supabase/error-detect';
import { LinesView } from './_components/lines-view';
import type { LineActivity, LineRow } from './_components/line-rows';

export const metadata = { title: 'My lines · Supplier' };

/**
 * MY LINES — the emcee's script library.
 *
 * Owner-locked 2026-08-01, spec item 5. Sibling of
 * `/vendor-dashboard/activities` (his named segments) and deliberately the same
 * kind of screen: a vendor-owned reusable list, plain form posts, no client
 * state machine.
 *
 * ── WHY THIS SCREEN EXISTS ─────────────────────────────────────────────────
 *
 * Lines land here automatically as he writes them on a wedding — the save is
 * automatic precisely because an explicit "save to my lines" is curation
 * homework skipped 40×/year. This is where he sees what has accumulated, fixes
 * a phrasing he has outgrown, and retires one.
 *
 * ── THREE THINGS THIS SCREEN MUST NOT GET WRONG ────────────────────────────
 *
 *  1. SHOW THE TEMPLATE, SLOTS AND ALL. Not a filled preview. The whole promise
 *     is that a stored line carries no real person, and he should be able to
 *     SEE that — `⟨the couple⟩`, not "Bea & Marco". Seeing the slot is also how
 *     he learns to write one.
 *  2. PRIVATE LINES ARE SEPARATED AND LABELLED NEVER-REUSED. They are here so
 *     he can find them, not so they get used. `matchLines` refuses them at the
 *     source; this screen must not imply otherwise.
 *  3. EDITING HERE NEVER TOUCHES A WEDDING. The library is upstream of every
 *     event copy, never retroactive — rewriting a script he has already
 *     rehearsed would be the worst thing this screen could do.
 */

export default async function VendorLinesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/vendor-dashboard/lines');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  // The one "no shop" landing, as every other tool (final check A5-G2-12).
  if (!profile) redirect('/vendor-dashboard');

  const [linesRes, activitiesRes] = await Promise.all([
    supabase
      .from('vendor_lines')
      .select('line_id, activity_id, label_key, block_type, body, is_private_note, use_count, last_used_at')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .is('deleted_at', null)
      .order('last_used_at', { ascending: false, nullsFirst: false }),
    supabase
      .from('vendor_activities')
      .select('activity_id, label')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .order('display_order', { ascending: true }),
  ]);

  // 🔴 BOTH reads are measured (controller 21 Nov): a refused segments read used to make the "Tied to" picker vanish in
  // silence — now `null`, and the picker's place says "Couldn't load your segments" with Try again.
  if (linesRes.error) logQueryError('VendorLinesPage.lines', linesRes.error, { vendorProfileId: profile.vendor_profile_id }, 'graceful_degrade');
  if (activitiesRes.error) logQueryError('VendorLinesPage.activities', activitiesRes.error, { vendorProfileId: profile.vendor_profile_id }, 'graceful_degrade');
  const linesRead = !linesRes.error;
  const lines = (linesRes.data ?? []) as LineRow[];
  const activities = activitiesRes.error ? null : ((activitiesRes.data ?? []) as LineActivity[]);

  return <LinesView lines={lines} activities={activities} linesRead={linesRead} error={sp.error ?? null} />;
}
