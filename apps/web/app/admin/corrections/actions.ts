'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { geocodeNominatim } from '@/lib/geo';
import {
  isLockedIdentityFieldKey,
  type LockedIdentityFieldKey,
  type VendorCorrectionRequestRow,
} from '@/lib/vendor-corrections';
import {
  SLUG_FORMAT,
  SLUG_CONFLICT_MESSAGE,
  findSlugConflict,
} from '@/lib/slug-availability';

// Shared admin gate (require-admin.ts) — identical contract to the local
// requireAdmin this file used to duplicate (login redirect · Forbidden throw).
import { requireAdminAction as requireAdmin } from '@/lib/admin/require-admin';
// /admin/corrections actions — resolution path for the request-a-correction
// queue (verified vendors' locked identity fields, owner 2026-07-02).
//
//   · apply   — writes the requested value to vendor_profiles (admin client,
//               the ONLY write path that may touch a verified shop's identity)
//               and stamps status='applied' + resolved_at/_by.
//   · decline — stamps status='declined' + resolved_at/_by; profile untouched.
//
// Mirrors the requireAdmin + revalidatePath shape of
// app/admin/repost-watch/actions.ts.

function fail(message: string): never {
  redirect(`/admin/corrections?error=${encodeURIComponent(message)}`);
}

/**
 * Parses the free-text requested_value into the typed vendor_profiles column
 * value for the given field. Throws a redirect on values that can't be
 * applied (bad year, bad email, bad logo ref) so the admin sees WHY.
 */
function parseRequestedValue(
  field: LockedIdentityFieldKey,
  raw: string | null,
): unknown {
  const trimmed = raw?.trim() ?? '';
  switch (field) {
    case 'business_name': {
      if (!trimmed) fail('Shop name can’t be blank — decline instead.');
      return trimmed.slice(0, 128);
    }
    case 'business_owner_name':
    case 'hq_address':
    case 'contact_phone':
      return trimmed ? trimmed.slice(0, 256) : null;
    // 64 to match the column, and the same limit the signup wizard enforces —
    // a value that fits one screen and not the other would be approved here and
    // rejected on the vendor's next save.
    case 'location_city':
      return trimmed ? trimmed.slice(0, 64) : null;
    case 'contact_email': {
      if (!trimmed) return null;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        fail('The requested email isn’t a valid address — decline instead.');
      }
      return trimmed.slice(0, 256);
    }
    case 'logo_url': {
      if (!trimmed) return null;
      if (!trimmed.startsWith('r2://') && !/^https?:\/\//i.test(trimmed)) {
        fail('Logo must be an r2:// ref or an http(s) URL — decline instead.');
      }
      return trimmed;
    }
    case 'services': {
      // Comma- or newline-separated list, mirroring the display serialization
      // the vendor's request snapshot uses (comma-joined).
      const items = trimmed
        .split(/[,\n]/)
        .map((s) => s.trim().slice(0, 48))
        .filter((s) => s.length > 0)
        .slice(0, 24);
      if (items.length === 0) {
        fail('Services list can’t be empty — decline instead.');
      }
      return items;
    }
    case 'in_business_since_year': {
      if (!trimmed) return null;
      const y = Number(trimmed);
      if (!Number.isInteger(y) || y < 1900 || y > 2100) {
        fail('The requested year isn’t valid (1900–2100) — decline instead.');
      }
      return y;
    }
    case 'business_slug': {
      // Shape only. WHETHER the word is free is decided by `findSlugConflict`
      // at the apply site — it needs an admin client and five async probes, and
      // this function is synchronous by design.
      const lower = trimmed.toLowerCase();
      if (!SLUG_FORMAT.test(lower)) {
        fail(SLUG_CONFLICT_MESSAGE.invalid_format);
      }
      return lower;
    }
  }
}

/**
 * Move a shop's web address — the ONE deliberate door through
 * `vendor_profiles_business_slug_immutable`, which stays shut to everyone else.
 *
 * Order matters and is the whole safety argument:
 *   1. ASK THE SHARED AVAILABILITY ANSWER FIRST. `findSlugConflict` checks
 *      reserved words, weddings, shops, people and live ledger holds, and FAILS
 *      CLOSED on a probe it could not run. A second, thinner copy of this logic
 *      is exactly how the auto-mint and the registration wizard came to
 *      disagree, so the database function deliberately does not re-derive it.
 *   2. THEN move it, inside a function that also writes the forwarding row.
 *      Moving an address WITHOUT forwarding is the precise harm the trigger
 *      exists to prevent — a correction that skipped it would just change who
 *      caused the damage.
 *
 * Refusals are LOUD. A guard that refuses in silence is indistinguishable from
 * one that passed, so every path here redirects with a readable reason rather
 * than returning quietly.
 */
async function moveShopAddress(
  admin: ReturnType<typeof createAdminClient>,
  vendorProfileId: string,
  requestedSlug: string,
  changedBy: string | null,
): Promise<void> {
  const conflict = await findSlugConflict(admin, requestedSlug, {
    vendorProfileId,
  });
  if (conflict) fail(SLUG_CONFLICT_MESSAGE[conflict]);

  const { error } = await admin.rpc('admin_correct_business_slug', {
    p_vendor_profile_id: vendorProfileId,
    p_new_slug: requestedSlug,
    p_changed_by: changedBy,
  });
  // ⚠ SUPABASE RESOLVES `{ error }` — IT DOES NOT THROW, and a phantom argument
  // name would be REJECTED before the function body ran. Checked explicitly, and
  // `tests/db/rpc-argument-names.db.test.ts` covers the argument set.
  if (error) {
    if (error.message.includes('SHOP_ADDRESS_FORMAT')) {
      fail(SLUG_CONFLICT_MESSAGE.invalid_format);
    }
    if (error.message.includes('SHOP_NOT_FOUND')) {
      fail('That shop no longer exists.');
    }
    // A lost race on the unique index — somebody took the word between the
    // availability check and the write.
    if (error.code === '23505') {
      fail('That address was just taken. Please pick another.');
    }
    fail(`The address could not be moved: ${error.message}`);
  }
}

async function loadOpenRequest(
  requestId: string,
): Promise<VendorCorrectionRequestRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('vendor_correction_requests')
    .select(
      'id,public_id,vendor_profile_id,field_key,current_value,requested_value,note,status,created_at,resolved_at,resolved_by',
    )
    .eq('id', Number(requestId))
    .maybeSingle();
  if (error || !data) return null;
  return data as VendorCorrectionRequestRow;
}

/**
 * Apply — writes the requested value to the vendor's profile, then marks the
 * request applied. Idempotent: an already-resolved request no-ops back to the
 * queue instead of double-writing.
 */
export async function applyCorrectionRequest(formData: FormData) {
  const { userId } = await requireAdmin();
  const requestId = formData.get('request_id');
  if (typeof requestId !== 'string' || !requestId) throw new Error('Invalid input');

  const request = await loadOpenRequest(requestId);
  if (!request) fail('Correction request not found.');
  if (request.status !== 'open') {
    redirect('/admin/corrections?already_resolved=1');
  }
  if (!isLockedIdentityFieldKey(request.field_key)) {
    fail('Unknown field on this request.');
  }

  const value = parseRequestedValue(request.field_key, request.requested_value);

  const admin = createAdminClient();

  if (request.field_key === 'business_slug') {
    // The web address does NOT go through the generic update below — the
    // immutability trigger refuses it, correctly. It goes through the one
    // deliberate door, which also writes the forwarding row.
    await moveShopAddress(admin, request.vendor_profile_id, String(value), userId);
  } else {
    const { error: writeErr } = await admin
      .from('vendor_profiles')
      .update({ [request.field_key]: value, updated_at: new Date().toISOString() })
      .eq('vendor_profile_id', request.vendor_profile_id);
    if (writeErr) fail(writeErr.message);
  }

  // Address corrections re-geocode best-effort (same contract as the vendor
  // save path — a Nominatim miss never fails the apply).
  if (request.field_key === 'hq_address' && typeof value === 'string' && value) {
    const geo = await geocodeNominatim(value);
    if (geo) {
      await admin
        .from('vendor_profiles')
        .update({ hq_latitude: geo.latitude, hq_longitude: geo.longitude })
        .eq('vendor_profile_id', request.vendor_profile_id);
    }
  }

  const { error: stampErr } = await admin
    .from('vendor_correction_requests')
    .update({
      status: 'applied',
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    })
    .eq('id', request.id)
    .eq('status', 'open');
  if (stampErr) fail(stampErr.message);

  revalidatePath('/admin/corrections');
  revalidatePath('/vendor-dashboard/profile');
  revalidatePath('/vendor-dashboard/shop');
  redirect('/admin/corrections?applied=1');
}

/**
 * Correct a shop's web address, straight from the admin console.
 *
 * ⚠ WHY THIS IS A DIRECT ACTION AND NOT "APPLY A REQUEST". Because NOTHING CAN
 * FILE A REQUEST. `requestProfileCorrection` exists in
 * `app/vendor-dashboard/actions.ts` and has **zero callers** — no screen
 * anywhere renders a form for it — so this queue has never had an intake and
 * production holds zero rows. Routing the only remedy for a permanent address
 * through a queue nobody can put anything into would have shipped a fix that
 * cannot be reached, which is no fix at all.
 *
 * The applied row is still written, so the decision has a durable record with
 * the before value, the after value, the reason and who did it.
 */
export async function correctShopAddress(formData: FormData) {
  const { userId } = await requireAdmin();

  const currentSlug = String(formData.get('current_slug') ?? '').trim().toLowerCase();
  const newSlug = String(formData.get('new_slug') ?? '').trim().toLowerCase();
  const reason = String(formData.get('reason') ?? '').trim();

  if (!currentSlug || !newSlug) fail('Enter the shop’s current address and the new one.');
  if (!SLUG_FORMAT.test(newSlug)) fail(SLUG_CONFLICT_MESSAGE.invalid_format);
  // A permanent public address is being moved. WHY is the part a future admin
  // will need and cannot reconstruct — the same reason a review override
  // refuses to run without one.
  if (reason.length < 10) {
    fail('Say why this address is being corrected — a future admin will need it.');
  }
  if (currentSlug === newSlug) fail('That is already the shop’s address.');

  const admin = createAdminClient();
  const { data: shopRow, error: shopErr } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, business_slug')
    .ilike('business_slug', currentSlug)
    .maybeSingle();
  // ⚠ An unreadable probe is NOT "no such shop" — say which one it was.
  if (shopErr) fail(`Couldn’t look that shop up: ${shopErr.message}`);
  const shop = shopRow as {
    vendor_profile_id: string;
    business_name: string | null;
    business_slug: string | null;
  } | null;
  if (!shop) fail(`No shop currently lives at “${currentSlug}”.`);

  await moveShopAddress(admin, shop!.vendor_profile_id, newSlug, userId);

  // The durable record. Best-effort by design: the address has already moved
  // and is already forwarding, so a ledger hiccup must not present as a failed
  // correction and invite a second attempt.
  await admin.from('vendor_correction_requests').insert({
    vendor_profile_id: shop!.vendor_profile_id,
    field_key: 'business_slug',
    current_value: shop!.business_slug,
    requested_value: newSlug,
    note: reason.slice(0, 1000),
    status: 'applied',
    resolved_at: new Date().toISOString(),
    resolved_by: userId,
  });

  revalidatePath('/admin/corrections');
  revalidatePath('/vendor-dashboard/shop');
  revalidatePath(`/${newSlug}`);
  revalidatePath(`/${currentSlug}`);
  redirect('/admin/corrections?address_moved=1');
}

/** Decline — stamps the verdict; the vendor's profile is untouched. */
export async function declineCorrectionRequest(formData: FormData) {
  const { userId } = await requireAdmin();
  const requestId = formData.get('request_id');
  if (typeof requestId !== 'string' || !requestId) throw new Error('Invalid input');

  const admin = createAdminClient();
  const { error } = await admin
    .from('vendor_correction_requests')
    .update({
      status: 'declined',
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    })
    .eq('id', Number(requestId))
    .eq('status', 'open');
  if (error) fail(error.message);

  revalidatePath('/admin/corrections');
  redirect('/admin/corrections?declined=1');
}
