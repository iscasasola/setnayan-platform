'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { VENDOR_CATEGORIES } from '@/lib/vendors';
import { canOpenAnotherShop } from '@/lib/shop-limits';

/**
 * Vendor onboarding submit (owner 2026-07-03: "create a vendor onboarding. we
 * just need the basic"; owner 2026-07-05: keep onboarding to the SIX basics +
 * location — website + social move to the dashboard).
 *
 * Provisions the shop the same way the signup trigger does (bare
 * `vendor_profiles` + founding `vendor_team_members` admin seat — idempotent,
 * admin client after the auth check) and writes the onboarding basics onto it:
 *
 *   shop_name       → business_name        (required)
 *   logo_url        → logo_url              (required · §2.1b mandatory logo —
 *                     r2:// ref from the shared <FileUpload>, same as My Shop)
 *   primary_service → services = [one of VENDOR_CATEGORIES]  (required)
 *   contact_name    → business_owner_name   (owner name · required)
 *   contact_phone   → contact_phone         (contact number · required)
 *   contact_email   → contact_email         (company email · required)
 *   location_city   → location_city         (optional)
 *
 * Website + social links, exact HQ pin, EST, portfolio + documents stay on My
 * Shop — the profile checklist + Get-verified journey ARE the rest of the
 * onboarding (the `website` column + the `social_media` verification slot are
 * editable there). Existing non-empty values are never clobbered by blanks
 * (safe to re-run on a half-filled shop).
 */

function clean(raw: FormDataEntryValue | null, max = 128): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

/**
 * Logo column accepts an r2:// ref (from the shared <FileUpload>) or a legacy
 * http(s) URL — identical to My Shop's `parseLogoValue`. Anything else → null
 * so the column never accumulates junk.
 */
function cleanLogo(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  if (t.startsWith('r2://')) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return null;
}

/** Light email shape check — enough to keep obviously-broken strings out. */
function cleanEmail(raw: FormDataEntryValue | null): string | null {
  const t = clean(raw, 254)?.toLowerCase() ?? null;
  if (!t) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t : null;
}

const CATEGORY_SET: ReadonlySet<string> = new Set(VENDOR_CATEGORIES);

export async function becomeVendor(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Logged out → the existing vendor signup handles account + shop together.
  if (!user) redirect('/signup?as=vendor');

  const shopName = clean(formData.get('shop_name'));
  const logoUrl = cleanLogo(formData.get('logo_url'));
  const primaryService = clean(formData.get('primary_service'), 64);
  const contactName = clean(formData.get('contact_name'));
  const contactPhone = clean(formData.get('contact_phone'), 32);
  const contactEmail = cleanEmail(formData.get('contact_email'));
  if (!shopName) redirect('/open-shop?error=' + encodeURIComponent('Give your shop a name.'));
  if (!logoUrl) redirect('/open-shop?error=' + encodeURIComponent('Add your shop logo.'));
  if (!primaryService || !CATEGORY_SET.has(primaryService)) {
    redirect('/open-shop?error=' + encodeURIComponent('Pick your primary service.'));
  }
  if (!contactName) redirect('/open-shop?error=' + encodeURIComponent('Add the owner name.'));
  if (!contactPhone)
    redirect('/open-shop?error=' + encodeURIComponent('Add a contact number.'));
  if (!contactEmail)
    redirect('/open-shop?error=' + encodeURIComponent('Add a valid company email.'));
  const locationCity = clean(formData.get('location_city'), 64);

  const admin = createAdminClient();

  // Find-or-create the OWNED shop (mirrors the signup trigger; idempotent).
  // Read the full owned set (not `.maybeSingle()`) so the multi-business dial
  // can be enforced by count: re-open the existing shop, or mint the first —
  // but never exceed MAX_SHOPS_PER_USER. Today the cap is 1 (also held by
  // `vendor_profiles.user_id UNIQUE`), so this only ever reuses or creates the
  // one shop; the guard becomes live enforcement when the cap is raised and
  // the UNIQUE constraint is dropped. See lib/shop-limits.ts.
  const { data: ownedRows } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, services')
    .eq('user_id', user.id);
  const owned = (ownedRows ?? []) as Array<{ vendor_profile_id: string; services?: string[] }>;
  const existing = owned[0] ?? null;
  let vendorProfileId = existing?.vendor_profile_id ?? null;
  if (!vendorProfileId) {
    if (!canOpenAnotherShop(owned.length)) {
      redirect(
        '/open-shop?error=' +
          encodeURIComponent("You've reached the maximum number of shops for your account."),
      );
    }
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

  // Founding admin seat ('owner' → 'admin' per 20270401574089). Idempotent.
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

  // Write the basics. Blanks never clobber existing values; the primary
  // service leads the services array (kept as the sole entry when the shop is
  // fresh — the full picker on My Shop adds more).
  const existingServices =
    ((existing as { services?: string[] } | null)?.services ?? []).filter(Boolean);
  const services = existingServices.includes(primaryService)
    ? existingServices
    : [primaryService, ...existingServices];
  const patch: Record<string, unknown> = {
    business_name: shopName,
    logo_url: logoUrl,
    business_owner_name: contactName,
    contact_phone: contactPhone,
    contact_email: contactEmail,
    services,
    updated_at: new Date().toISOString(),
  };
  if (locationCity) patch.location_city = locationCity;
  const { error: updErr } = await admin
    .from('vendor_profiles')
    .update(patch)
    .eq('vendor_profile_id', vendorProfileId);
  if (updErr) {
    redirect(`/open-shop?error=${encodeURIComponent(updErr.message)}`);
  }

  revalidatePath('/vendor-dashboard');
  revalidatePath('/vendor-dashboard/shop');
  redirect('/vendor-dashboard/shop');
}
