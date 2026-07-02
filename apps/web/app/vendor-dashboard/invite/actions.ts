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

/** Parse a hidden JSON-array field into a clean string[] (empty on any junk). */
function parseStringArray(v: FormDataEntryValue | null): string[] {
  try {
    const parsed = JSON.parse(String(v ?? '[]'));
    return Array.isArray(parsed) ? parsed.map((x) => String(x).trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Advisory date-conflict check for the Locked-QR generator: does the vendor
 * already have a calendar block (manual OR booking-derived) on the chosen event
 * date? Returns up to a few block labels. Read-only, own-vendor scoped — never
 * blocks issuance, just warns.
 */
export async function checkVendorDateConflict(
  dateIso: string,
): Promise<{ labels: string[] }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return { labels: [] };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { labels: [] };
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { labels: [] };
  const vendorProfileId = (profile as { vendor_profile_id: string }).vendor_profile_id;

  const { data } = await supabase
    .from('vendor_calendar_blocks')
    .select('block_label')
    .eq('vendor_profile_id', vendorProfileId)
    .lte('blocked_at', `${dateIso}T23:59:59Z`)
    .gt('blocked_until', `${dateIso}T00:00:00Z`)
    .limit(5);

  const labels = (data ?? [])
    .map((b) => (b as { block_label: string }).block_label)
    .filter(Boolean);
  return { labels };
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

  // Service picker is the vendor's own leaf offerings (vendor_services,
  // DB-driven, MULTI-select). Each ref is a vendor_service_id, or a
  // VendorCategory key for the no-published-services fallback. Resolve every ref
  // back to its coarse category; the FIRST is the primary that sets
  // event_vendors.category, and the matched leaf ids are stored as the full set.
  const { data: profRow } = await supabase
    .from('vendor_profiles')
    .select('services')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const coverage = vendorCoverageCategories(((profRow?.services ?? []) as string[]) ?? []);
  const serviceRefs = parseStringArray(formData.get('service_refs'));
  if (serviceRefs.length === 0) fail('category');
  const activeServices = (await fetchVendorServices(supabase, vendorProfileId).catch(() => [])).filter(
    (s) => s.is_active,
  );
  const resolved = serviceRefs.map((ref) => {
    const svc = activeServices.find((s) => s.vendor_service_id === ref) ?? null;
    return { ref, svc, category: svc ? svc.category : ref };
  });
  // Every selected category must be a real vendor_category enum. A matched leaf
  // is the vendor's OWN row (fetchVendorServices is vendor-scoped) so it's
  // trusted; the fallback category-key path is re-checked against coverage.
  for (const r of resolved) {
    if (!VENDOR_CATEGORIES.includes(r.category as VendorCategory)) fail('category');
    if (!r.svc && !coverage.includes(r.category as VendorCategory)) fail('category');
  }
  const primary = resolved[0]!;
  const category = primary.category;
  const vendorServiceId = primary.svc?.vendor_service_id ?? null;
  const vendorServiceIds = resolved
    .map((r) => r.svc?.vendor_service_id)
    .filter((id): id is string => Boolean(id));

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
  // Money validation, independent of the client gate (never trust the client):
  // a real total, a real downpayment, and the downpayment never exceeds the
  // total. Without the total>0 guard a blanked total_php (null) would skip the
  // overpaid check and persist a null-total token with an oversized downpayment.
  if (totalPhp == null || totalPhp <= 0) fail('total');
  if (initialPaid <= 0) fail('downpayment');
  if (initialPaid > totalPhp) fail('overpaid');
  // Proof of the received downpayment is required; a remembrance photo optional.
  const proofRef = String(formData.get('proof_r2_ref') ?? '').trim() || null;
  if (!proofRef) fail('proof');
  const remembranceRef = String(formData.get('remembrance_r2_ref') ?? '').trim() || null;

  // Chosen contract must be one of the vendor's own saved contracts.
  const sourceContractId = String(formData.get('source_contract_id') ?? '').trim() || null;
  if (!sourceContractId) fail('contract');
  const { data: contractRow } = await supabase
    .from('vendor_contracts')
    .select('contract_id')
    .eq('contract_id', sourceContractId)
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (!contractRow) fail('contract');

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
      vendor_service_ids: vendorServiceIds,
      service_description: serviceDescription,
      event_date: eventDate,
      total_php: totalPhp,
      initial_paid_php: initialPaid,
      schedule_json: schedule,
      proof_r2_key: proofRef,
      remembrance_r2_key: remembranceRef,
      source_contract_id: sourceContractId,
    })
    .select('token')
    .single();

  if (error || !inserted) fail('issue');

  redirect(`/vendor-dashboard/invite?mode=locked&issued=${inserted.token}`);
}
