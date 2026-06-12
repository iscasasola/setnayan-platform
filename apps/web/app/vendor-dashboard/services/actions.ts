'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { getTaxonomy, type TaxonomySnapshot } from '@/lib/taxonomy-db';
import {
  fetchCanonicalServiceLabels,
  foldersForServiceKey,
  isAcceptedServiceCategoryKey,
  serviceCategoryKeyLabel,
} from '@/lib/service-category-keys';
import { tierCaps, asVendorTier, canPlotTimeSlots } from '@/lib/vendor-tier-caps';
import {
  SLOT_LABEL_MAX,
  SLOT_CAPACITY_MIN,
  SLOT_CAPACITY_MAX,
  SLOT_TIME_RE,
} from '@/lib/vendor-time-slots';

/**
 * The distinct PARENT folder(s) (of the 10) a service-category key surfaces
 * under — taxonomy-aware: canonical keys resolve through the live snapshot,
 * tile keys through their parent, legacy keys through the bridge. Exempt /
 * unknown keys return [] and don't count toward the cap.
 */
function parentsOfCategory(category: string, tax?: TaxonomySnapshot): string[] {
  return foldersForServiceKey(category, tax);
}

function parseCategory(
  raw: FormDataEntryValue | null,
  tax: TaxonomySnapshot,
): string {
  if (typeof raw !== 'string' || !isAcceptedServiceCategoryKey(raw, tax)) {
    throw new Error('Unknown service category.');
  }
  return raw;
}

function parseInt0OrNull(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new Error('Numeric fields must be non-negative whole numbers.');
  }
  return n;
}

/** Last-minute surcharge % (Setnayan AI §4): 0–100 whole number, blank → null. */
function parseSurchargePctOrNull(raw: FormDataEntryValue | null): number | null {
  const n = parseInt0OrNull(raw);
  if (n === null) return null;
  if (n > 100) throw new Error('Last-minute surcharge must be between 0 and 100%.');
  return n;
}

async function ensureProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, profile };
}

/**
 * Resolve a submitted branch_id to a branch the vendor actually owns, else null
 * ("main / unassigned"). The FK guarantees it's a real branch; this guarantees
 * it's THIS vendor's branch — a foreign/blank/missing value coerces to null.
 */
async function resolveBranchId(
  supabase: Awaited<ReturnType<typeof ensureProfile>>['supabase'],
  vendorProfileId: string,
  raw: FormDataEntryValue | null,
): Promise<string | null> {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (!t) return null;
  const { data } = await supabase
    .from('vendor_branches')
    .select('branch_id')
    .eq('branch_id', t)
    .eq('parent_vendor_profile_id', vendorProfileId)
    .maybeSingle();
  return data ? t : null;
}

/**
 * Parse the vendor-declared daily booking capacity (#2). Empty → null (unset →
 * no per-service daily cap). Capped by the tier's slotsPerDay: FREE 0 (can't
 * set), VERIFIED 1, PRO 3, ENTERPRISE ∞.
 */
function parseDailyCapacityOrThrow(
  raw: FormDataEntryValue | null,
  slotsCap: number,
): number | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('Daily capacity must be a positive whole number.');
  }
  if (slotsCap === 0) {
    throw new Error('Daily bookings need a paid plan — upgrade to set a capacity.');
  }
  if (n > slotsCap) {
    throw new Error(
      `Your plan allows up to ${slotsCap} booking${slotsCap === 1 ? '' : 's'} per day for a service. Upgrade for more.`,
    );
  }
  return n;
}

export async function createVendorService(formData: FormData) {
  const { supabase, profile } = await ensureProfile();
  // Live taxonomy snapshot — the picker renders from it, so validation must
  // accept exactly what it offered (admin edits land without a deploy).
  const tax = await getTaxonomy();

  let category: string;
  let starting_price_php: number | null;
  let added_pax_price_php: number | null;
  let crew_size: number | null;
  let last_minute_end_months: number | null;
  let last_minute_surcharge_pct: number | null;
  try {
    category = parseCategory(formData.get('category'), tax);
    starting_price_php = parseInt0OrNull(formData.get('starting_price_php'));
    // Optional per-added-guest surcharge (Adaptive Pax Pricing); blank = none.
    added_pax_price_php = parseInt0OrNull(formData.get('added_pax_price_php'));
    crew_size = parseInt0OrNull(formData.get('crew_size'));
    last_minute_end_months = parseInt0OrNull(formData.get('last_minute_end_months'));
    last_minute_surcharge_pct = parseSurchargePctOrNull(
      formData.get('last_minute_surcharge_pct'),
    );
  } catch (e) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent((e as Error).message)}`,
    );
  }
  const crew_meal_required = formData.get('crew_meal_required') === 'on';
  const titleRaw = formData.get('title');
  const title =
    typeof titleRaw === 'string' && titleRaw.trim().length > 0
      ? titleRaw.trim().slice(0, 80)
      : null;
  const branch_id = await resolveBranchId(
    supabase,
    profile.vendor_profile_id,
    formData.get('branch_id'),
  );

  // Tier caps on service creation (Vendor_Tier_Capability_Matrix_2026-06-07).
  // Fetch tier + the founder flag ONCE; both caps read them.
  const { data: tierRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state, is_founder')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  const tierRowTyped = tierRow as
    | { tier_state?: string | null; is_founder?: boolean | null }
    | null;
  const baseCaps = tierCaps(asVendorTier(tierRowTyped?.tier_state));
  // Founder override (owner 2026-06-09): unlimited categories + services-per-leaf
  // (the token-gate bypass lives in unlock_vendor_event). Other caps unchanged.
  const caps =
    tierRowTyped?.is_founder === true
      ? { ...baseCaps, parentCategories: Infinity, servicesPerLeaf: Infinity }
      : baseCaps;

  // (0) Per-service daily capacity (#2), capped by the tier's slotsPerDay.
  let daily_capacity: number | null;
  try {
    daily_capacity = parseDailyCapacityOrThrow(
      formData.get('daily_capacity'),
      caps.slotsPerDay,
    );
  } catch (e) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent((e as Error).message)}`,
    );
  }

  const { data: existingRows } = await supabase
    .from('vendor_services')
    .select('category')
    .eq('vendor_profile_id', profile.vendor_profile_id);
  const existing = (existingRows ?? []) as { category: string }[];

  // (1) Services-per-leaf cap (#1, owner 2026-06-07): FREE 2 · VERIFIED 2 ·
  // PRO 5 · ENTERPRISE ∞ distinct listings within one leaf category.
  if (caps.servicesPerLeaf !== Infinity) {
    const inLeaf = existing.filter((r) => r.category === category).length;
    if (inLeaf >= caps.servicesPerLeaf) {
      const msg = `Your plan allows ${caps.servicesPerLeaf} service${caps.servicesPerLeaf === 1 ? '' : 's'} per category. Upgrade to add more here.`;
      return redirect(`/vendor-dashboard/services?error=${encodeURIComponent(msg)}`);
    }
  }

  // (2) Parent-category cap (Phase B): distinct parents of the 10 — FREE 1 ·
  // VERIFIED 3 · PRO 3 · ENTERPRISE ∞. Only blocks when this service introduces
  // a NEW parent beyond the allowance (adding within covered parents is free).
  const newParents = parentsOfCategory(category, tax);
  if (caps.parentCategories !== Infinity && newParents.length > 0) {
    const existingParents = new Set(
      existing.flatMap((r) => parentsOfCategory(r.category, tax)),
    );
    const introducesNew = newParents.some((p) => !existingParents.has(p));
    const wouldBe = new Set(existingParents);
    newParents.forEach((p) => wouldBe.add(p));
    if (introducesNew && wouldBe.size > caps.parentCategories) {
      const msg = `Your plan covers ${caps.parentCategories} categor${caps.parentCategories === 1 ? 'y' : 'ies'}. Upgrade to list under more.`;
      return redirect(
        `/vendor-dashboard/services?error=${encodeURIComponent(msg)}`,
      );
    }
  }

  const { error } = await supabase.from('vendor_services').insert({
    vendor_profile_id: profile.vendor_profile_id,
    category,
    title,
    starting_price_php,
    added_pax_price_php,
    crew_size,
    crew_meal_required,
    branch_id,
    last_minute_end_months,
    last_minute_surcharge_pct,
    daily_capacity,
    is_active: true,
  });

  if (error) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/services');
  redirect('/vendor-dashboard/services?saved=1');
}

/**
 * Vendor: propose a brand-new category for what they do but can't find in the
 * picker — the "There's always a place for what you do" on-ramp (spec 0023
 * §3.2c). Lands as a PENDING row in `taxonomy_category_requests` for an admin to
 * resolve (promote / map-to-existing / keep-private / reject). RLS gates the
 * insert to the vendor's own profile; the vendor tracks status read-only.
 */
export async function proposeCategory(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  const label = String(formData.get('proposed_label') ?? '').trim();
  const note = String(formData.get('proposed_note') ?? '').trim() || null;
  if (label.length < 2 || label.length > 80) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent('Category name must be 2–80 characters.')}`,
    );
  }

  const { error } = await supabase.from('taxonomy_category_requests').insert({
    proposed_by_vendor_id: profile.vendor_profile_id,
    proposed_label: label,
    proposed_note: note,
  });
  if (error) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/services');
  redirect('/vendor-dashboard/services?requested=1');
}

export async function updateVendorService(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  const idRaw = formData.get('vendor_service_id');
  if (typeof idRaw !== 'string' || idRaw.length === 0) {
    return redirect('/vendor-dashboard/services?error=Missing+service+id');
  }

  let starting_price_php: number | null;
  let added_pax_price_php: number | null;
  let crew_size: number | null;
  let last_minute_end_months: number | null;
  let last_minute_surcharge_pct: number | null;
  try {
    starting_price_php = parseInt0OrNull(formData.get('starting_price_php'));
    added_pax_price_php = parseInt0OrNull(formData.get('added_pax_price_php'));
    crew_size = parseInt0OrNull(formData.get('crew_size'));
    last_minute_end_months = parseInt0OrNull(formData.get('last_minute_end_months'));
    last_minute_surcharge_pct = parseSurchargePctOrNull(
      formData.get('last_minute_surcharge_pct'),
    );
  } catch (e) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent((e as Error).message)}`,
    );
  }
  const crew_meal_required = formData.get('crew_meal_required') === 'on';
  const branch_id = await resolveBranchId(
    supabase,
    profile.vendor_profile_id,
    formData.get('branch_id'),
  );

  // Per-service daily capacity (#2), capped by the tier's slotsPerDay.
  const { data: tierRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  let daily_capacity: number | null;
  try {
    daily_capacity = parseDailyCapacityOrThrow(
      formData.get('daily_capacity'),
      tierCaps(asVendorTier((tierRow as { tier_state?: string | null } | null)?.tier_state))
        .slotsPerDay,
    );
  } catch (e) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent((e as Error).message)}`,
    );
  }

  const { error } = await supabase
    .from('vendor_services')
    .update({
      starting_price_php,
      added_pax_price_php,
      crew_size,
      crew_meal_required,
      branch_id,
      last_minute_end_months,
      last_minute_surcharge_pct,
      daily_capacity,
      updated_at: new Date().toISOString(),
    })
    .eq('vendor_service_id', idRaw)
    .eq('vendor_profile_id', profile.vendor_profile_id);

  if (error) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/services');
  redirect('/vendor-dashboard/services?saved=1');
}

/**
 * Linked-services-on-card (locked spec). Set which OTHER categories THIS
 * service "comes with" — the couple's card renders "comes with X · Y · Z" and
 * the linked tiles auto-tag "✓ included with {vendor}". The chosen categories
 * must be ones the vendor actually offers (validated server-side), so a vendor
 * can only advertise coverage they really provide. Replaces the full link set
 * for the anchor service each save. RLS double-scopes every write to the
 * vendor's own profile; we also re-check ownership of the anchor here.
 */
export async function setServiceLinks(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  const anchorId = formData.get('vendor_service_id');
  if (typeof anchorId !== 'string' || anchorId.length === 0) {
    return redirect('/vendor-dashboard/services?error=Missing+service+id');
  }

  // The vendor's own services: validates the anchor + bounds the link choices
  // to categories this vendor genuinely offers (no advertising coverage they
  // don't have). category → distinct, excludes the anchor's own category.
  const { data: ownRows } = await supabase
    .from('vendor_services')
    .select('vendor_service_id, category')
    .eq('vendor_profile_id', profile.vendor_profile_id);
  const own = (ownRows ?? []) as { vendor_service_id: string; category: string }[];
  const anchor = own.find((r) => r.vendor_service_id === anchorId);
  if (!anchor) {
    return redirect('/vendor-dashboard/services?error=Service+not+found');
  }
  const offeredCategories = new Set(
    own.map((r) => r.category).filter((c) => c !== anchor.category),
  );

  // Submitted checkboxes (name="linked"); keep only categories the vendor
  // actually offers, dedupe, cap at 6 for a tidy card.
  const chosen = Array.from(
    new Set(
      formData
        .getAll('linked')
        .filter((v): v is string => typeof v === 'string')
        .filter((c) => offeredCategories.has(c)),
    ),
  ).slice(0, 6);

  // Replace the anchor's link set atomically-enough for this flow: clear then
  // re-insert. Both writes are owner-scoped (RLS + explicit profile filter).
  const del = await supabase
    .from('vendor_service_links')
    .delete()
    .eq('vendor_service_id', anchorId)
    .eq('vendor_profile_id', profile.vendor_profile_id);
  if (del.error) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent(del.error.message)}`,
    );
  }

  if (chosen.length > 0) {
    // Taxonomy-aware labels: canonical keys get display_name_en from the DB,
    // tile keys their tile label, legacy keys their old label.
    const canonicalLabels = await fetchCanonicalServiceLabels(supabase, chosen);
    const rows = chosen.map((category, i) => ({
      vendor_service_id: anchorId,
      vendor_profile_id: profile.vendor_profile_id,
      linked_canonical_service: category,
      linked_label: serviceCategoryKeyLabel(category, { canonicalLabels }),
      display_order: i,
    }));
    const ins = await supabase.from('vendor_service_links').insert(rows);
    if (ins.error) {
      return redirect(
        `/vendor-dashboard/services?error=${encodeURIComponent(ins.error.message)}`,
      );
    }
  }

  revalidatePath('/vendor-dashboard/services');
  redirect('/vendor-dashboard/services?saved=1');
}

export async function toggleVendorServiceActive(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  const idRaw = formData.get('vendor_service_id');
  const nextRaw = formData.get('is_active');
  if (typeof idRaw !== 'string' || idRaw.length === 0) {
    return redirect('/vendor-dashboard/services?error=Missing+service+id');
  }
  const is_active = nextRaw === 'true' || nextRaw === 'on' || nextRaw === '1';

  const { error } = await supabase
    .from('vendor_services')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('vendor_service_id', idRaw)
    .eq('vendor_profile_id', profile.vendor_profile_id);

  if (error) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/services');
  redirect('/vendor-dashboard/services?saved=1');
}

// ============================================================================
// Tier feature #3 — Enterprise-only time-bound slot CRUD.
//
// A service with >=1 ACTIVE slot uses the #3 per-slot capacity model and SKIPS
// the #2 daily_capacity gate (finalizeVendor branches on slot presence). Adding
// slots is gated on ENTERPRISE (re-derived server-side via canPlotTimeSlots —
// never trusts the form). Deleting (soft-deactivating) is NOT tier-gated so a
// downgraded vendor can always clean up stale slots that are still enforcing
// against their bookings (verifier C8).
// ============================================================================

/** Re-derive the vendor's tier server-side; throw unless ENTERPRISE. */
async function assertCanPlotSlots(
  supabase: Awaited<ReturnType<typeof ensureProfile>>['supabase'],
  vendorProfileId: string,
): Promise<void> {
  const { data } = await supabase
    .from('vendor_profiles')
    .select('tier_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const tier = (data as { tier_state?: string | null } | null)?.tier_state ?? null;
  if (!canPlotTimeSlots(tier)) {
    throw new Error('Time slots are an Enterprise feature. Upgrade to plot them.');
  }
}

export async function addServiceTimeSlot(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  try {
    await assertCanPlotSlots(supabase, profile.vendor_profile_id);

    const serviceId = String(formData.get('vendor_service_id') ?? '');
    const label = String(formData.get('slot_label') ?? '').trim();
    const start = String(formData.get('start_time') ?? '');
    const end = String(formData.get('end_time') ?? '');
    const capRaw = String(formData.get('slot_capacity') ?? '').trim();
    const cap = capRaw.length === 0 ? 1 : Number(capRaw);
    const orderRaw = String(formData.get('display_order') ?? '').trim();
    const displayOrder = orderRaw.length === 0 ? 0 : Number(orderRaw);

    if (!label || label.length > SLOT_LABEL_MAX) {
      throw new Error(`Slot label is required (up to ${SLOT_LABEL_MAX} characters).`);
    }
    if (!SLOT_TIME_RE.test(start) || !SLOT_TIME_RE.test(end)) {
      throw new Error('Times must be on the hour or half-hour (e.g. 08:00, 14:30).');
    }
    if (end <= start) {
      throw new Error('End time must be after start time.');
    }
    if (
      !Number.isInteger(cap) ||
      cap < SLOT_CAPACITY_MIN ||
      cap > SLOT_CAPACITY_MAX
    ) {
      throw new Error(`Capacity must be a whole number ${SLOT_CAPACITY_MIN}–${SLOT_CAPACITY_MAX}.`);
    }
    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      throw new Error('Display order must be a non-negative whole number.');
    }

    // Ownership: the service must belong to THIS vendor profile.
    const { data: svc } = await supabase
      .from('vendor_services')
      .select('vendor_service_id')
      .eq('vendor_service_id', serviceId)
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    if (!svc) {
      throw new Error('Service not found.');
    }

    const { error } = await supabase.from('vendor_service_time_slots').insert({
      vendor_profile_id: profile.vendor_profile_id, // stamped server-side
      vendor_service_id: serviceId,
      slot_label: label,
      start_time: start,
      end_time: end,
      slot_capacity: cap,
      display_order: displayOrder,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent((e as Error).message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/services');
  redirect('/vendor-dashboard/services?saved=1');
}

export async function deleteServiceTimeSlot(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  // No tier gate — a downgraded vendor must still be able to remove slots that
  // are otherwise still enforcing against their bookings (verifier C8).
  const slotId = String(formData.get('slot_id') ?? '');
  if (!slotId) {
    return redirect('/vendor-dashboard/services?error=Missing+slot+id');
  }

  const { error } = await supabase
    .from('vendor_service_time_slots')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('slot_id', slotId)
    .eq('vendor_profile_id', profile.vendor_profile_id); // double-scoped

  if (error) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/services');
  redirect('/vendor-dashboard/services?saved=1');
}

export async function deleteVendorService(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  const idRaw = formData.get('vendor_service_id');
  if (typeof idRaw !== 'string' || idRaw.length === 0) {
    return redirect('/vendor-dashboard/services?error=Missing+service+id');
  }

  const { error } = await supabase
    .from('vendor_services')
    .delete()
    .eq('vendor_service_id', idRaw)
    .eq('vendor_profile_id', profile.vendor_profile_id);

  if (error) {
    return redirect(
      `/vendor-dashboard/services?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/services');
  redirect('/vendor-dashboard/services?saved=1');
}
