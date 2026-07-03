'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Open a vendor shop on the CURRENT logged-in account (owner gap-fix
 * 2026-07-03: vendor shops were only ever born at signup via the
 * `on_users_vendor_created` trigger, so an existing account — every couple, or
 * anyone who registered as a customer — had NO path to become a vendor, and
 * the "Register your business" CTAs dead-ended for them).
 *
 * Mirrors the signup trigger exactly: a bare `vendor_profiles` row (all
 * defaults — the My Shop profile checklist + Get-verified journey take it from
 * there) + the founding `vendor_team_members` admin seat. Idempotent: an
 * account that already owns a shop just lands on My Shop. Writes go through
 * the admin client after the auth check — same pattern as the trigger's
 * SECURITY DEFINER (vendor_profiles has no self-INSERT policy).
 */
export async function becomeVendor(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Logged out → the existing vendor signup handles account + shop together.
  if (!user) redirect('/signup?as=vendor');

  const admin = createAdminClient();

  // Idempotent find-or-create of the OWNED shop (team membership of someone
  // else's shop doesn't count — this account is opening its own).
  const { data: existing } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id')
    .eq('user_id', user.id)
    .maybeSingle();
  let vendorProfileId =
    (existing as { vendor_profile_id?: string } | null)?.vendor_profile_id ?? null;

  if (!vendorProfileId) {
    const { data: inserted, error } = await admin
      .from('vendor_profiles')
      .insert({ user_id: user.id })
      .select('vendor_profile_id')
      .single();
    if (error || !inserted) {
      redirect(
        `/open-shop?error=${encodeURIComponent(error?.message ?? 'Could not open your shop.')}`,
      );
    }
    vendorProfileId = (inserted as { vendor_profile_id: string }).vendor_profile_id;
  }

  // Founding admin seat (multi-admin org model — 'owner' was renamed 'admin'
  // in 20270401574089). ignoreDuplicates keeps this idempotent.
  await admin
    .from('vendor_team_members')
    .upsert(
      { vendor_profile_id: vendorProfileId, user_id: user.id, role: 'admin' },
      { onConflict: 'vendor_profile_id,user_id', ignoreDuplicates: true },
    )
    .then(
      () => undefined,
      () => undefined,
    );

  revalidatePath('/vendor-dashboard');
  revalidatePath('/vendor-dashboard/shop');
  redirect('/vendor-dashboard/shop');
}
