'use server';

/**
 * Locked QR issuance. The vendor fills the deal (event-type + service + total +
 * downpayment + schedule + proof) in the generator and this inserts a single-use
 * `vendor_locked_qr_tokens` row under their own RLS session (the vendor-org
 * INSERT policy gates vendor_profile_id). The token is then rendered as a QR by
 * the generator page (?mode=locked&issued=<token>). Consumption happens later,
 * atomically, via the vendor_claim_locked_qr() RPC when the couple scans.
 */

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { vendorCoverageCategories } from '@/lib/vendor-couple-invite';
import { fetchVendorServices } from '@/lib/vendor-services';
import { VENDOR_CATEGORIES, type VendorCategory } from '@/lib/vendors';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { sanitizeLockSchedule } from '@/lib/vendor-locked-qr';

function toAmount(v: FormDataEntryValue | null): number | null {
  // Tolerate thousands separators — the generator submits clean numbers, but a
  // stray comma-formatted value must not silently coerce to NaN → null.
  const s = String(v ?? '').replace(/,/g, '').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function fail(reason: string): never {
  redirect(`/vendor-dashboard/invite?mode=locked&error=${reason}`);
}

export async function issueLockedQr(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  const vendorProfileId = (profile as { vendor_profile_id: string }).vendor_profile_id;

  // Service picker is now the vendor's own leaf offerings (vendor_services,
  // DB-driven). The option value is a vendor_service_id, or a VendorCategory key
  // for the no-published-services fallback. Resolve either back to the coarse
  // category (required for event_vendors) and record the leaf id when present.
  const { data: profRow } = await supabase
    .from('vendor_profiles')
    .select('services')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const coverage = vendorCoverageCategories(((profRow?.services ?? []) as string[]) ?? []);
  const serviceRef = String(formData.get('service_ref') ?? '').trim();
  const activeServices = (await fetchVendorServices(supabase, vendorProfileId).catch(() => [])).filter(
    (s) => s.is_active,
  );
  const matchedService = activeServices.find((s) => s.vendor_service_id === serviceRef) ?? null;
  const category = matchedService ? matchedService.category : serviceRef;
  const vendorServiceId = matchedService ? matchedService.vendor_service_id : null;
  // event_vendors.category is the vendor_category enum, so it must be a real
  // category either way. A matched leaf is the vendor's OWN vendor_services row
  // (fetchVendorServices is vendor-scoped) so it's trusted even if its category
  // isn't in the coarse coverage list; only the fallback category-key path is
  // re-checked against coverage.
  if (!VENDOR_CATEGORIES.includes(category as VendorCategory)) {
    fail('category');
  }
  if (!matchedService && !coverage.includes(category as VendorCategory)) {
    fail('category');
  }

  // Event-type (optional) must be in the creatable roster when provided.
  const rawEt = String(formData.get('event_type') ?? '').trim();
  const eventTypes = await getCreatableEventTypes();
  const eventType = rawEt && eventTypes.some((t) => t.key === rawEt) ? rawEt : null;

  // Owner 2026-07: a Locked QR must carry WHAT the couple availed + the AGREED
  // wedding date. Both required at issue (legacy tokens predate them).
  const serviceDescription = String(formData.get('service_description') ?? '').trim();
  if (serviceDescription.length === 0) fail('description');
  const rawDate = String(formData.get('event_date') ?? '').trim();
  const eventDate =
    /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && !Number.isNaN(Date.parse(rawDate))
      ? rawDate
      : null;
  if (!eventDate) fail('event_date');

  const totalPhp = toAmount(formData.get('total_php'));
  const initialPaid = toAmount(formData.get('initial_paid_php')) ?? 0;
  const proofRef = String(formData.get('proof_r2_ref') ?? '').trim() || null;

  let schedule: ReturnType<typeof sanitizeLockSchedule> = [];
  try {
    schedule = sanitizeLockSchedule(JSON.parse(String(formData.get('schedule_json') ?? '[]')));
  } catch {
    schedule = [];
  }

  const { data: inserted, error } = await supabase
    .from('vendor_locked_qr_tokens')
    .insert({
      vendor_profile_id: vendorProfileId,
      created_by_user_id: user.id,
      event_type: eventType,
      category,
      vendor_service_id: vendorServiceId,
      service_description: serviceDescription,
      event_date: eventDate,
      total_php: totalPhp,
      initial_paid_php: initialPaid,
      schedule_json: schedule,
      proof_r2_key: proofRef,
    })
    .select('token')
    .single();

  if (error || !inserted) fail('issue');

  redirect(`/vendor-dashboard/invite?mode=locked&issued=${inserted.token}`);
}
