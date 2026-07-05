'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { VENDOR_CATEGORIES } from '@/lib/vendors';
import { resolveApplicationFeeCentavos } from '@/lib/vendor-verification';
import { buildSlotValue } from '@/lib/vendor-verification-slots';

/**
 * Vendor onboarding submit (owner 2026-07-03: "create a vendor onboarding. we
 * just need the basic — shop name, primary service (pick 1), location, contact
 * name, contact number … we also want to find their soc med, websites").
 *
 * Provisions the shop the same way the signup trigger does (bare
 * `vendor_profiles` + founding `vendor_team_members` admin seat — idempotent,
 * admin client after the auth check) and writes the onboarding basics onto it:
 *
 *   shop_name       → business_name        (required)
 *   logo_url        → logo_url              (required · §2.1b mandatory logo —
 *                     r2:// ref from the shared <FileUpload>, same as My Shop)
 *   primary_service → services = [one of VENDOR_CATEGORIES]  (required)
 *   contact_name    → business_owner_name   (owner name)
 *   contact_phone   → contact_phone         (contact number)
 *   contact_email   → contact_email         (company email)
 *   location_city   → location_city
 *   website         → website
 *   social_url      → seeds the Get-verified `social_media` document slot on a
 *                     draft application, so their social link is already in the
 *                     verification checklist when they reach My Shop
 *
 * The REST of the profile (exact HQ pin, EST, portfolio) + documents stay on My
 * Shop — the profile checklist + Get-verified journey ARE the rest of the
 * onboarding. Existing non-empty values are never clobbered by blanks (safe to
 * re-run on a half-filled shop).
 */

function clean(raw: FormDataEntryValue | null, max = 128): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

function cleanUrl(raw: FormDataEntryValue | null): string | null {
  const t = clean(raw, 300);
  if (!t) return null;
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    // Validates shape; stores the normalized href.
    return new URL(withScheme).href;
  } catch {
    return null;
  }
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
  const website = cleanUrl(formData.get('website'));
  const socialUrl = cleanUrl(formData.get('social_url'));

  const admin = createAdminClient();

  // Find-or-create the OWNED shop (mirrors the signup trigger; idempotent).
  const { data: existing } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, services')
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
  if (website) patch.website = website;
  const { error: updErr } = await admin
    .from('vendor_profiles')
    .update(patch)
    .eq('vendor_profile_id', vendorProfileId);
  if (updErr) {
    redirect(`/open-shop?error=${encodeURIComponent(updErr.message)}`);
  }

  // Social link → seed the verification checklist's social_media slot on a
  // draft application (find-or-create), via the SAME buildSlotValue the doc
  // actions use. Best-effort — a hiccup never blocks onboarding.
  if (socialUrl) {
    try {
      const { data: app } = await admin
        .from('vendor_verification_applications')
        .select('application_id, status, doc_uploads')
        .eq('vendor_profile_id', vendorProfileId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const row = app as
        | { application_id: string; status: string; doc_uploads: Record<string, unknown> | null }
        | null;
      const slot = buildSlotValue('social_media', {
        r2Ref: null,
        url: socialUrl,
        scheduledAt: null,
      });
      if (row && row.status === 'draft') {
        const uploads = { ...(row.doc_uploads ?? {}) };
        if (!uploads.social_media) {
          uploads.social_media = slot;
          await admin
            .from('vendor_verification_applications')
            .update({ doc_uploads: uploads, updated_at: new Date().toISOString() })
            .eq('application_id', row.application_id);
        }
      } else if (!row) {
        // Fee from service_catalog (initial is free — active row at ₱0); the
        // resolver returns 0 for an inactive/missing row too.
        const feeCentavos = await resolveApplicationFeeCentavos(admin, 'initial');
        await admin.from('vendor_verification_applications').insert({
          vendor_profile_id: vendorProfileId,
          application_type: 'initial',
          fee_php_centavos: feeCentavos,
          status: 'draft',
          doc_uploads: { social_media: slot },
        });
      }
    } catch {
      // non-fatal
    }
  }

  revalidatePath('/vendor-dashboard');
  revalidatePath('/vendor-dashboard/shop');
  redirect('/vendor-dashboard/shop');
}
