'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * /admin/token-bands — edit the region → burn-band map (owner-locked
 * "admin-editable" requirement of the token economy, 2026-06-05). Each region
 * maps to a band (1/2/3); a vendor answering an inquiry for a wedding in that
 * region burns `band` tokens (₱100/token → 1/2/3 = ₱100/200/300).
 *
 * RECONCILED 2026-07-01 (burn-band single source · migration 20270331100000):
 * this writes public.regions.burn_band — the canonical map the RPC
 * (unlock_vendor_event) resolves events.region against and lib/region-source.ts
 * reads. It previously wrote a parallel token_burn_bands table whose keys
 * mis-matched events.region (6 regions under-charged); that table is retired.
 * The economy is flat 1:1 band:token at ₱100/token, so tokens = band — there is
 * no longer a separate editable `tokens` value (decoupling them is a future
 * column on regions, not built here).
 */

async function requireAdmin(): Promise<void> {
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
}

export async function updateBand(formData: FormData) {
  await requireAdmin();
  const regionSlug = formData.get('region_slug');
  const bandRaw = formData.get('band');

  if (typeof regionSlug !== 'string' || regionSlug.length === 0) {
    throw new Error('Missing region');
  }
  const band = Number(bandRaw);
  if (!Number.isInteger(band) || band < 1 || band > 3) {
    throw new Error('Band must be 1, 2, or 3');
  }

  // tokens = band (flat 1:1 at ₱100/token); the regions_set_updated_at trigger
  // bumps updated_at on write. Match on the canonical slug (regions PK is the id,
  // slug is UNIQUE and the value the page sends).
  const admin = createAdminClient();
  const { error } = await admin
    .from('regions')
    .update({ burn_band: band })
    .eq('slug', regionSlug);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/token-bands');
}
