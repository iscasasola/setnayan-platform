'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  runSpotlightRecompute,
  currentPeriodMonth,
  type SpotlightAwardType,
} from '@/lib/spotlight-awards';

/**
 * Setnayan HQ · Spotlight Awards server actions — the ONLY write path into
 * `vendor_spotlight_awards`. Cron-free recompute ("Run now") + manual curation
 * (add / remove / feature). Every mutation revalidates both the admin console
 * and the public homepage (the strip reads featured rows), so changes show with
 * no redeploy.
 *
 * All writes go through the service-role admin client (RLS-bypassing); the
 * `requireAdmin` gate below re-asserts admin context (defense in depth — the
 * /admin layout already 404s non-admins).
 */

const BASE = '/admin/spotlight-awards';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AWARD_TYPES: ReadonlySet<SpotlightAwardType> = new Set([
  'top_pick',
  'most_booked',
  'rising',
]);

function back(kind: 'ok' | 'error', msg: string): never {
  const p = new URLSearchParams();
  p.set(kind, msg);
  redirect(`${BASE}?${p.toString()}`);
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return user;
}

/** Revalidate the console + every surface that reads featured awards. */
function revalidateSurfaces() {
  revalidatePath(BASE);
  revalidatePath('/'); // homepage Spotlight strip reads is_homepage_featured
}

/**
 * "Run now" — cron-free recompute. Snapshots the current-period AUTO winners
 * (top_pick + most_booked) from the live badge engine into the table. Idempotent
 * (UPSERT on the UNIQUE key); admin-curated + featured rows are preserved.
 */
export async function recomputeSpotlightAwards(): Promise<void> {
  await requireAdmin();
  let summary: Awaited<ReturnType<typeof runSpotlightRecompute>>;
  try {
    summary = await runSpotlightRecompute();
  } catch (err) {
    back('error', err instanceof Error ? err.message : 'Recompute failed.');
  }
  revalidateSurfaces();
  const total = summary.written.top_pick + summary.written.most_booked;
  back(
    'ok',
    `Recompute done · ${summary.poolSize} verified vendors scanned · ` +
      `${total} new award${total === 1 ? '' : 's'} written ` +
      `(${summary.written.top_pick} Top Pick · ${summary.written.most_booked} Most Booked)` +
      (summary.adminPreserved > 0
        ? ` · ${summary.adminPreserved} admin pick${summary.adminPreserved === 1 ? '' : 's'} kept`
        : ''),
  );
}

/**
 * Toggle `is_homepage_featured` on one award. This is the homepage gate — only
 * featured rows reach the public strip. Owner sign-off pending before featuring
 * goes live.
 */
export async function toggleHomepageFeatured(formData: FormData): Promise<void> {
  await requireAdmin();
  const awardId = String(formData.get('award_id') ?? '');
  const next = String(formData.get('next') ?? '') === 'true';
  if (!UUID_RE.test(awardId)) back('error', 'Invalid award id.');

  const admin = createAdminClient();
  const { error } = await admin
    .from('vendor_spotlight_awards')
    .update({ is_homepage_featured: next })
    .eq('award_id', awardId);
  if (error) back('error', error.message);

  revalidateSurfaces();
  back('ok', next ? 'Featured on the homepage.' : 'Removed from the homepage.');
}

/** Remove an award row entirely (auto or admin). */
export async function removeAward(formData: FormData): Promise<void> {
  await requireAdmin();
  const awardId = String(formData.get('award_id') ?? '');
  if (!UUID_RE.test(awardId)) back('error', 'Invalid award id.');

  const admin = createAdminClient();
  const { error } = await admin
    .from('vendor_spotlight_awards')
    .delete()
    .eq('award_id', awardId);
  if (error) back('error', error.message);

  revalidateSurfaces();
  back('ok', 'Award removed.');
}

/**
 * Add an award by hand (awarded_by='admin') for a given vendor + type in the
 * current period. Used mainly for Rising Star (no auto formula) but works for
 * any type. UPSERTs on the UNIQUE key: re-adding the same (vendor, type, month)
 * promotes an existing auto row to admin-curated rather than erroring.
 */
export async function addAwardManually(formData: FormData): Promise<void> {
  await requireAdmin();
  const vendorId = String(formData.get('vendor_profile_id') ?? '').trim();
  const awardType = String(formData.get('award_type') ?? '') as SpotlightAwardType;
  const period = String(formData.get('period_month') ?? '') || currentPeriodMonth();

  if (!UUID_RE.test(vendorId)) back('error', 'Enter a valid vendor profile ID (UUID).');
  if (!AWARD_TYPES.has(awardType)) back('error', 'Invalid award type.');

  const admin = createAdminClient();

  // Verify the vendor exists (FK would reject anyway, but a clear message helps).
  const { data: vendor } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name')
    .eq('vendor_profile_id', vendorId)
    .maybeSingle();
  if (!vendor) back('error', 'No vendor profile with that ID.');

  const { error } = await admin.from('vendor_spotlight_awards').upsert(
    {
      vendor_profile_id: vendorId,
      award_type: awardType,
      period_month: period,
      awarded_by: 'admin',
    },
    { onConflict: 'vendor_profile_id,award_type,period_month' },
  );
  if (error) back('error', error.message);

  revalidateSurfaces();
  back('ok', `Award added for ${vendor.business_name ?? 'vendor'}.`);
}
