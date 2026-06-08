'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { VENDOR_CATEGORIES, type VendorCategory } from '@/lib/vendors';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { tilesForVendorCategory } from '@/lib/vendor-category-taxonomy';
import { TILE_PARENT } from '@/lib/taxonomy';
import { tierCaps, asVendorTier } from '@/lib/vendor-tier-caps';

const CATEGORY_SET: ReadonlySet<string> = new Set(VENDOR_CATEGORIES);

/**
 * The distinct PARENT folder(s) (of the 10) a vendor category surfaces under.
 * Routes through the vendor→canonical bridge (NOT TAXONOMY_MAP, which is keyed
 * by v11 canonicals the legacy VendorCategory enum doesn't match). Exempt
 * categories (officiant/fees/etc.) return [] and don't count toward the cap.
 */
function parentsOfCategory(category: VendorCategory): string[] {
  return tilesForVendorCategory(category)
    .map((tile) => TILE_PARENT[tile] as string)
    .filter(Boolean);
}

function parseCategory(raw: FormDataEntryValue | null): VendorCategory {
  if (typeof raw !== 'string' || !CATEGORY_SET.has(raw)) {
    throw new Error('Unknown service category.');
  }
  return raw as VendorCategory;
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

export async function createVendorService(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  let category: VendorCategory;
  let starting_price_php: number | null;
  let crew_size: number | null;
  let last_minute_end_months: number | null;
  let last_minute_surcharge_pct: number | null;
  try {
    category = parseCategory(formData.get('category'));
    starting_price_php = parseInt0OrNull(formData.get('starting_price_php'));
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
  // Fetch tier + the vendor's existing service rows ONCE; both caps read them.
  const { data: tierRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  const caps = tierCaps(
    asVendorTier((tierRow as { tier_state?: string | null } | null)?.tier_state),
  );
  const { data: existingRows } = await supabase
    .from('vendor_services')
    .select('category')
    .eq('vendor_profile_id', profile.vendor_profile_id);
  const existing = (existingRows ?? []) as { category: VendorCategory }[];

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
  const newParents = parentsOfCategory(category);
  if (caps.parentCategories !== Infinity && newParents.length > 0) {
    const existingParents = new Set(
      existing.flatMap((r) => parentsOfCategory(r.category)),
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
    crew_size,
    crew_meal_required,
    branch_id,
    last_minute_end_months,
    last_minute_surcharge_pct,
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
  let crew_size: number | null;
  let last_minute_end_months: number | null;
  let last_minute_surcharge_pct: number | null;
  try {
    starting_price_php = parseInt0OrNull(formData.get('starting_price_php'));
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

  const { error } = await supabase
    .from('vendor_services')
    .update({
      starting_price_php,
      crew_size,
      crew_meal_required,
      branch_id,
      last_minute_end_months,
      last_minute_surcharge_pct,
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
