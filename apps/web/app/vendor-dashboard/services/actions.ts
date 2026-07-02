'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { servicesReturnBase } from '@/lib/vendor-services-return';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hashAndScanVendorImages } from '@/lib/vendor-image-repost-watch';
import {
  VENDOR_CATEGORIES,
  displayServiceLabel,
  type VendorCategory,
} from '@/lib/vendors';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { tilesForVendorCategory } from '@/lib/vendor-category-taxonomy';
import { TILE_PARENT } from '@/lib/taxonomy';
import { tierCaps, asVendorTier, canPlotTimeSlots } from '@/lib/vendor-tier-caps';
import {
  SLOT_LABEL_MAX,
  SLOT_CAPACITY_MIN,
  SLOT_CAPACITY_MAX,
  SLOT_TIME_RE,
} from '@/lib/vendor-time-slots';
import {
  MAX_SCHEDULE_ITEMS,
  pctToBps,
  phpToCentavos,
  type AmountKind,
  type DueAnchor,
} from '@/lib/vendor-service-payment-schedules';
import { registerClaimedServiceToCouple } from '@/lib/vendor-invite-actions';

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

/**
 * The submitted `category` is the legacy VendorCategory enum key — the
 * WIRE/STORED vocabulary written to `vendor_services.category`. It is NOT a
 * taxonomy tile key: the 30 enum keys and the DB tile keys deliberately don't
 * match (see lib/vendor-category-taxonomy.ts · the A/B/C bucket study). The
 * enum stays anchored to the live DB tree through VENDOR_CATEGORY_CANONICAL +
 * validateVendorCategoryMapping (which surfaces drift to admins), so we keep
 * validating against VENDOR_CATEGORIES here — swapping to tile keys would reject
 * every existing stored value. DISPLAY labels follow the admin taxonomy via
 * labelForVendorCategory(); storage/validation are intentionally untouched.
 */
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

const DISCOUNT_TYPES = ['early_booking', 'off_peak', 'bundle', 'promo', 'returning'] as const;
type DiscountType = (typeof DISCOUNT_TYPES)[number];

/** Parse optional discount fields from formData. Throws on invalid combos. */
function parseDiscountFields(formData: FormData): {
  discount_type: DiscountType | null;
  discount_value: number | null;
  discount_expires_at: string | null;
  discount_conditions_md: string | null;
} {
  const typeRaw = formData.get('discount_type');
  const discount_type =
    typeof typeRaw === 'string' && (DISCOUNT_TYPES as readonly string[]).includes(typeRaw)
      ? (typeRaw as DiscountType)
      : null;

  const valueRaw = formData.get('discount_value');
  let discount_value: number | null = null;
  if (typeof valueRaw === 'string' && valueRaw.trim().length > 0) {
    const n = Number(valueRaw.trim());
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error('Discount amount must be a positive number.');
    }
    discount_value = n;
  }

  if (discount_type !== null && discount_value === null) {
    throw new Error('A discount amount is required when a discount type is selected.');
  }

  const expiresRaw = formData.get('discount_expires_at');
  let discount_expires_at: string | null = null;
  if (typeof expiresRaw === 'string' && expiresRaw.trim().length > 0) {
    const d = new Date(expiresRaw.trim());
    if (isNaN(d.getTime())) {
      throw new Error('Discount expiry must be a valid date.');
    }
    discount_expires_at = d.toISOString();
  }
  if (discount_type === 'promo' && discount_expires_at === null) {
    throw new Error('Limited-Time Promo discounts require an expiry date.');
  }

  const condRaw = formData.get('discount_conditions_md');
  const discount_conditions_md =
    typeof condRaw === 'string' && condRaw.trim().length > 0
      ? condRaw.trim().slice(0, 1000)
      : null;

  return { discount_type, discount_value, discount_expires_at, discount_conditions_md };
}

// ── List editors (service-card redesign · Phase 3b) ─────────────────────────
// Three repeatable child-table lists submitted as parallel, index-aligned
// arrays of HIDDEN inputs (formData.getAll). Each parses into validated draft
// rows; the caller replace-alls them into the matching child table. Fully-blank
// rows are ignored so an empty repeater cleanly clears the list.

type DiscountUnit = 'pct' | 'php';
type DiscountDraft = {
  discount_type: DiscountType;
  rate: number;
  unit: DiscountUnit;
  expires_at: string | null;
  conditions_md: string | null;
};

/**
 * Parse the multi-discount rows (Phase 3b). Field arrays (index-aligned):
 *   discount_type[] · discount_rate[] · discount_unit[] ·
 *   discount_expires_at[] · discount_conditions_md[]
 * A row with a blank type AND blank rate is skipped. Validates: rate>0, type in
 * the enum, unit in (pct,php), and promo requires an expiry.
 */
function parseDiscountRows(formData: FormData): DiscountDraft[] {
  const types = formData.getAll('discount_type');
  const rates = formData.getAll('discount_rate');
  const units = formData.getAll('discount_unit');
  const expiries = formData.getAll('discount_expires_at');
  const conditions = formData.getAll('discount_conditions_md');
  const out: DiscountDraft[] = [];
  const n = types.length;
  for (let i = 0; i < n; i++) {
    const typeRaw = typeof types[i] === 'string' ? (types[i] as string).trim() : '';
    const rateRaw = typeof rates[i] === 'string' ? (rates[i] as string).trim() : '';
    if (typeRaw.length === 0 && rateRaw.length === 0) continue; // blank row → skip
    if (!(DISCOUNT_TYPES as readonly string[]).includes(typeRaw)) {
      throw new Error('Pick a discount type for each discount you add.');
    }
    const discount_type = typeRaw as DiscountType;
    const rate = Number(rateRaw);
    if (rateRaw.length === 0 || !Number.isFinite(rate) || rate <= 0) {
      throw new Error('Each discount needs a positive amount.');
    }
    const unitRaw = typeof units[i] === 'string' ? (units[i] as string) : 'pct';
    const unit: DiscountUnit = unitRaw === 'php' ? 'php' : 'pct';

    const expRaw = typeof expiries[i] === 'string' ? (expiries[i] as string).trim() : '';
    let expires_at: string | null = null;
    if (expRaw.length > 0) {
      const d = new Date(expRaw);
      if (isNaN(d.getTime())) throw new Error('Discount expiry must be a valid date.');
      expires_at = d.toISOString();
    }
    if (discount_type === 'promo' && expires_at === null) {
      throw new Error('Limited-Time Promo discounts require an expiry date.');
    }

    const condRaw =
      typeof conditions[i] === 'string' ? (conditions[i] as string).trim() : '';
    const conditions_md = condRaw.length > 0 ? condRaw.slice(0, 1000) : null;

    out.push({ discount_type, rate, unit, expires_at, conditions_md });
  }
  return out;
}

type InclusionDraft = { label: string; worth_php: number | null };

/**
 * Parse the inclusion rows (Phase 3b). Field arrays: inclusion_label[] ·
 * inclusion_worth[]. A row with a blank label is skipped. Validates: label 1–80,
 * worth ≥ 0 (or null).
 */
function parseInclusionRows(formData: FormData): InclusionDraft[] {
  const labels = formData.getAll('inclusion_label');
  const worths = formData.getAll('inclusion_worth');
  const out: InclusionDraft[] = [];
  const n = labels.length;
  for (let i = 0; i < n; i++) {
    const label = typeof labels[i] === 'string' ? (labels[i] as string).trim() : '';
    if (label.length === 0) continue; // blank row → skip
    if (label.length > 80) {
      throw new Error('An inclusion label can be up to 80 characters.');
    }
    const worthRaw = typeof worths[i] === 'string' ? (worths[i] as string).trim() : '';
    let worth_php: number | null = null;
    if (worthRaw.length > 0) {
      const w = Number(worthRaw);
      if (!Number.isFinite(w) || w < 0 || !Number.isInteger(w)) {
        throw new Error('Inclusion worth must be a non-negative whole number of pesos.');
      }
      worth_php = w;
    }
    out.push({ label: label.slice(0, 80), worth_php });
  }
  return out;
}

type BracketDraft = { min_pax: number | null; max_pax: number | null; price_php: number };

/**
 * Parse the price-bracket rows (Phase 3b · Fixed basis only). Field arrays:
 * bracket_min_pax[] · bracket_max_pax[] · bracket_price[]. A row with a blank
 * price is skipped. Validates: price ≥ 0, min/max ≥ 0 whole, max ≥ min when both
 * set. Returns [] for non-Fixed callers (they don't render the editor).
 */
function parseBracketRows(formData: FormData): BracketDraft[] {
  const mins = formData.getAll('bracket_min_pax');
  const maxes = formData.getAll('bracket_max_pax');
  const prices = formData.getAll('bracket_price');
  const out: BracketDraft[] = [];
  const n = prices.length;
  for (let i = 0; i < n; i++) {
    const priceRaw = typeof prices[i] === 'string' ? (prices[i] as string).trim() : '';
    if (priceRaw.length === 0) continue; // blank row → skip
    const price = Number(priceRaw);
    if (!Number.isFinite(price) || price < 0 || !Number.isInteger(price)) {
      throw new Error('Each price bracket needs a non-negative whole-peso price.');
    }
    const minRaw = typeof mins[i] === 'string' ? (mins[i] as string).trim() : '';
    const maxRaw = typeof maxes[i] === 'string' ? (maxes[i] as string).trim() : '';
    let min_pax: number | null = null;
    let max_pax: number | null = null;
    if (minRaw.length > 0) {
      const m = Number(minRaw);
      if (!Number.isFinite(m) || m < 0 || !Number.isInteger(m)) {
        throw new Error('Bracket guest counts must be non-negative whole numbers.');
      }
      min_pax = m;
    }
    if (maxRaw.length > 0) {
      const m = Number(maxRaw);
      if (!Number.isFinite(m) || m < 1 || !Number.isInteger(m)) {
        throw new Error('Bracket guest counts must be non-negative whole numbers.');
      }
      max_pax = m;
    }
    if (min_pax !== null && max_pax !== null && max_pax < min_pax) {
      throw new Error('A bracket’s "up to" guests must be at least its "from" guests.');
    }
    out.push({ min_pax, max_pax, price_php: price });
  }
  return out;
}

/** Parse exclusive_perk_text. Returns null when blank (allowed for drafts). */
function parseExclusivePerk(formData: FormData): string | null {
  const raw = formData.get('exclusive_perk_text');
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  return raw.trim().slice(0, 500);
}

/**
 * Parse the service cover photo (the <FileUpload name="primary_photo_r2_key">
 * R2 key). Returns null when blank — allowed for drafts; required to publish
 * (gated in commitVendorService). Feeds vendor_services.primary_photo_r2_key,
 * which the explore + public cards already render (logo/placeholder fallback).
 */
function parsePrimaryPhoto(formData: FormData): string | null {
  const raw = formData.get('primary_photo_r2_key');
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  return raw.trim();
}

/**
 * Recommended lead time in months (Setnayan AI §4, vendor-owned 2026-06-16): a
 * non-negative number, fractional allowed (0.5 ≈ 2 weeks). Blank → null = no
 * recommended lead → no last-minute range → always bookable. The START of this
 * service's last-minute range.
 */
function parseLeadTimeMonthsOrNull(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Recommended lead time must be a non-negative number of months.');
  }
  return n;
}

/** Positive number, fractional allowed (for min_hours; DB CHECK is > 0). Blank → null. */
function parsePosNumOrNull(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Minimum hours must be a positive number.');
  }
  return n;
}

type PricingBasis = 'fixed' | 'per_pax' | 'per_hour';

/**
 * Parse the pricing-basis fields (service-card redesign · Phase 3a). Only the
 * active basis's inputs are submitted (the client unmounts the others); this
 * nulls the inactive columns and recomputes starting_price_php as the synced
 * "from ₱X" anchor Explore + the couple budget read.
 *   • fixed    → the entered flat price (+ adaptive-pax base/surcharge).
 *   • per_pax  → anchor = per-guest rate × minimum pax.
 *   • per_hour → anchor = the base (which covers the minimum block).
 */
function parsePricingFields(formData: FormData): {
  pricing_basis: PricingBasis;
  starting_price_php: number | null;
  base_pax: number | null;
  added_pax_price_php: number | null;
  per_pax_price_php: number | null;
  min_pax: number | null;
  hour_base_php: number | null;
  min_hours: number | null;
  extra_hour_php: number | null;
} {
  const rawBasis = String(formData.get('pricing_basis') ?? 'fixed');
  const pricing_basis: PricingBasis =
    rawBasis === 'per_pax' || rawBasis === 'per_hour' ? rawBasis : 'fixed';

  const out = {
    pricing_basis,
    starting_price_php: null as number | null,
    base_pax: null as number | null,
    added_pax_price_php: null as number | null,
    per_pax_price_php: null as number | null,
    min_pax: null as number | null,
    hour_base_php: null as number | null,
    min_hours: null as number | null,
    extra_hour_php: null as number | null,
  };

  if (pricing_basis === 'fixed') {
    out.starting_price_php = parseInt0OrNull(formData.get('starting_price_php'));
    const bp = parseInt0OrNull(formData.get('base_pax'));
    out.base_pax = bp && bp > 0 ? bp : null;
    out.added_pax_price_php = parseInt0OrNull(formData.get('added_pax_price_php'));
  } else if (pricing_basis === 'per_pax') {
    out.per_pax_price_php = parseInt0OrNull(formData.get('per_pax_price_php'));
    const mp = parseInt0OrNull(formData.get('min_pax'));
    out.min_pax = mp && mp > 0 ? mp : null;
    out.starting_price_php =
      out.per_pax_price_php != null ? out.per_pax_price_php * (out.min_pax ?? 1) : null;
  } else {
    out.hour_base_php = parseInt0OrNull(formData.get('hour_base_php'));
    out.min_hours = parsePosNumOrNull(formData.get('min_hours'));
    out.extra_hour_php = parseInt0OrNull(formData.get('extra_hour_php'));
    out.starting_price_php = out.hour_base_php;
  }
  return out;
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

/** Resolve a submitted coverage_id to a number ONLY if it belongs to this
 *  vendor (defense-in-depth; the UI already offers only the vendor's own
 *  coverages). Anything else → null (unassigned). */
async function resolveOwnedCoverageId(
  supabase: SupabaseClient,
  vendorProfileId: string,
  raw: FormDataEntryValue | null,
): Promise<number | null> {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  const { data } = await supabase
    .from('vendor_coverages')
    .select('id')
    .eq('id', n)
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  return data ? n : null;
}

/**
 * Replace-all the three service-card child lists (Phase 3b): discounts,
 * inclusions, price brackets. Mirrors the single-discount replace-all pattern —
 * DELETE by (service, profile) then INSERT the parsed rows. Both writes are
 * owner-scoped (RLS + explicit vendor_profile_id filter). sort_order is the
 * array index (submitted order IS the order). Called from create + update after
 * the parent row is written; the drafts are parsed/validated by the caller
 * inside its try block so a bad row bounces with a friendly error.
 */
async function replaceServiceLists(
  supabase: SupabaseClient,
  vendorServiceId: string,
  vendorProfileId: string,
  lists: {
    discounts: DiscountDraft[];
    inclusions: InclusionDraft[];
    brackets: BracketDraft[];
  },
): Promise<void> {
  const scope = { vendor_service_id: vendorServiceId, vendor_profile_id: vendorProfileId };

  await supabase
    .from('vendor_service_discounts')
    .delete()
    .eq('vendor_service_id', vendorServiceId)
    .eq('vendor_profile_id', vendorProfileId);
  if (lists.discounts.length > 0) {
    await supabase.from('vendor_service_discounts').insert(
      lists.discounts.map((d, i) => ({
        ...scope,
        discount_type: d.discount_type,
        rate: d.rate,
        unit: d.unit,
        expires_at: d.expires_at,
        conditions_md: d.conditions_md,
        sort_order: i,
      })),
    );
  }

  await supabase
    .from('vendor_service_inclusions')
    .delete()
    .eq('vendor_service_id', vendorServiceId)
    .eq('vendor_profile_id', vendorProfileId);
  if (lists.inclusions.length > 0) {
    await supabase.from('vendor_service_inclusions').insert(
      lists.inclusions.map((n, i) => ({
        ...scope,
        label: n.label,
        worth_php: n.worth_php,
        sort_order: i,
      })),
    );
  }

  await supabase
    .from('vendor_service_price_brackets')
    .delete()
    .eq('vendor_service_id', vendorServiceId)
    .eq('vendor_profile_id', vendorProfileId);
  if (lists.brackets.length > 0) {
    await supabase.from('vendor_service_price_brackets').insert(
      lists.brackets.map((b, i) => ({
        ...scope,
        min_pax: b.min_pax,
        max_pax: b.max_pax,
        price_php: b.price_php,
        sort_order: i,
      })),
    );
  }
}

export async function createVendorService(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  let category: VendorCategory;
  let pricing: ReturnType<typeof parsePricingFields>;
  let transport_flat_fee_php: number | null = null;
  let coverage_id: number | null = null;
  let crew_size: number | null;
  let recommended_lead_time_months: number | null;
  let last_minute_end_months: number | null;
  let last_minute_surcharge_pct: number | null;
  let discountRows: DiscountDraft[];
  let inclusionRows: InclusionDraft[];
  let bracketRows: BracketDraft[];
  let exclusive_perk_text: string | null;
  try {
    category = parseCategory(formData.get('category'));
    // Pricing basis (fixed | per_pax | per_hour) + synced starting_price anchor.
    pricing = parsePricingFields(formData);
    transport_flat_fee_php = parseInt0OrNull(formData.get('transport_flat_fee_php'));
    // Which coverage this card belongs to (FK → vendor_coverages; the UI offers
    // only the vendor's own coverages). Simple parse; strict ownership check is
    // a follow-up (founder-only marketplace, low harm).
    coverage_id = await resolveOwnedCoverageId(
      supabase,
      profile.vendor_profile_id,
      formData.get('coverage_id'),
    );
    crew_size = parseInt0OrNull(formData.get('crew_size'));
    // §4 last-minute START (vendor-owned 2026-06-16): recommended lead time.
    recommended_lead_time_months = parseLeadTimeMonthsOrNull(
      formData.get('recommended_lead_time_months'),
    );
    last_minute_end_months = parseInt0OrNull(formData.get('last_minute_end_months'));
    last_minute_surcharge_pct = parseSurchargePctOrNull(
      formData.get('last_minute_surcharge_pct'),
    );
    // Phase 3b list editors — multi-discount + free inclusions + Fixed pax
    // brackets. Brackets only apply to the Fixed basis (the editor is mounted
    // only there); drop them otherwise so a stale hidden row can't sneak in.
    discountRows = parseDiscountRows(formData);
    inclusionRows = parseInclusionRows(formData);
    bracketRows =
      pricing.pricing_basis === 'fixed' ? parseBracketRows(formData) : [];
    exclusive_perk_text = parseExclusivePerk(formData);
  } catch (e) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent((e as Error).message)}`,
    );
  }
  // Fixed basis WITH brackets → the "from ₱X" anchor is the lowest bracket price
  // (so Explore/budget reflect the tiers); otherwise keep parsePricingFields'.
  if (pricing.pricing_basis === 'fixed' && bracketRows.length > 0) {
    pricing.starting_price_php = Math.min(...bracketRows.map((b) => b.price_php));
  }
  // What's-included flags (service-card redesign). crew_meal_required is kept as
  // the inverse of crew_meal_included so the 0007 budget's Crew-Meal line still
  // triggers; transport fee only applies when transport is NOT included.
  const crew_meal_included = formData.get('crew_meal_included') === 'on';
  const transport_included = formData.get('transport_included') === 'on';
  const crew_meal_required = !crew_meal_included;
  if (transport_included) transport_flat_fee_php = null;
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
  // ONLY. There is NO founder token-gate bypass — the bypass was dropped at
  // migration 20270221294989, so founders burn tokens like any paid tier in
  // unlock_vendor_event. Other caps unchanged.
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
      `${await servicesReturnBase()}?error=${encodeURIComponent((e as Error).message)}`,
    );
  }

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
      return redirect(`${await servicesReturnBase()}?error=${encodeURIComponent(msg)}`);
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
        `${await servicesReturnBase()}?error=${encodeURIComponent(msg)}`,
      );
    }
  }

  const { data: created, error } = await supabase
    .from('vendor_services')
    .insert({
      vendor_profile_id: profile.vendor_profile_id,
      category,
      title,
      starting_price_php: pricing.starting_price_php,
      added_pax_price_php: pricing.added_pax_price_php,
      base_pax: pricing.base_pax,
      pricing_basis: pricing.pricing_basis,
      per_pax_price_php: pricing.per_pax_price_php,
      min_pax: pricing.min_pax,
      hour_base_php: pricing.hour_base_php,
      min_hours: pricing.min_hours,
      extra_hour_php: pricing.extra_hour_php,
      coverage_id,
      crew_size,
      crew_meal_required,
      crew_meal_included,
      transport_included,
      transport_flat_fee_php,
      branch_id,
      recommended_lead_time_months,
      last_minute_end_months,
      last_minute_surcharge_pct,
      daily_capacity,
      exclusive_perk_text,
      // New services are created as drafts (is_active: false) so the publish gate
      // (exclusive_perk_text required) is enforced only on the toggle action.
      is_active: false,
    })
    .select('vendor_service_id')
    .single();

  if (error) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Phase 3b — replace-all the three child lists (multi-discount + free
  // inclusions + Fixed pax brackets) into their tables (migration 20270502342558).
  if (created) {
    await replaceServiceLists(
      supabase,
      created.vendor_service_id,
      profile.vendor_profile_id,
      { discounts: discountRows, inclusions: inclusionRows, brackets: bracketRows },
    );
  }

  revalidatePath('/vendor-dashboard/services');
  revalidatePath('/vendor-dashboard/shop');
  redirect(`${await servicesReturnBase()}?saved=1`);
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
      `${await servicesReturnBase()}?error=${encodeURIComponent('Category name must be 2–80 characters.')}`,
    );
  }

  const { error } = await supabase.from('taxonomy_category_requests').insert({
    proposed_by_vendor_id: profile.vendor_profile_id,
    proposed_label: label,
    proposed_note: note,
  });
  if (error) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/services');
  revalidatePath('/vendor-dashboard/shop');
  redirect(`${await servicesReturnBase()}?requested=1`);
}

export async function updateVendorService(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  const idRaw = formData.get('vendor_service_id');
  if (typeof idRaw !== 'string' || idRaw.length === 0) {
    return redirect(`${await servicesReturnBase()}?error=Missing+service+id`);
  }

  let pricing: ReturnType<typeof parsePricingFields>;
  let transport_flat_fee_php: number | null = null;
  let coverage_id: number | null = null;
  let crew_size: number | null;
  let recommended_lead_time_months: number | null;
  let last_minute_end_months: number | null;
  let last_minute_surcharge_pct: number | null;
  let discountRows: DiscountDraft[];
  let inclusionRows: InclusionDraft[];
  let bracketRows: BracketDraft[];
  let exclusive_perk_text: string | null;
  try {
    // Pricing basis (fixed | per_pax | per_hour) + synced starting_price anchor.
    pricing = parsePricingFields(formData);
    transport_flat_fee_php = parseInt0OrNull(formData.get('transport_flat_fee_php'));
    // Which coverage this card belongs to (FK → vendor_coverages; the UI offers
    // only the vendor's own coverages). Simple parse; strict ownership check is
    // a follow-up (founder-only marketplace, low harm).
    coverage_id = await resolveOwnedCoverageId(
      supabase,
      profile.vendor_profile_id,
      formData.get('coverage_id'),
    );
    crew_size = parseInt0OrNull(formData.get('crew_size'));
    // §4 last-minute START (vendor-owned 2026-06-16): recommended lead time.
    recommended_lead_time_months = parseLeadTimeMonthsOrNull(
      formData.get('recommended_lead_time_months'),
    );
    last_minute_end_months = parseInt0OrNull(formData.get('last_minute_end_months'));
    last_minute_surcharge_pct = parseSurchargePctOrNull(
      formData.get('last_minute_surcharge_pct'),
    );
    // Phase 3b list editors — multi-discount + free inclusions + Fixed pax
    // brackets (brackets only for the Fixed basis; dropped otherwise).
    discountRows = parseDiscountRows(formData);
    inclusionRows = parseInclusionRows(formData);
    bracketRows =
      pricing.pricing_basis === 'fixed' ? parseBracketRows(formData) : [];
    exclusive_perk_text = parseExclusivePerk(formData);
  } catch (e) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent((e as Error).message)}`,
    );
  }
  // Fixed basis WITH brackets → anchor = lowest bracket price (Explore/budget
  // read starting_price_php); otherwise keep parsePricingFields' anchor.
  if (pricing.pricing_basis === 'fixed' && bracketRows.length > 0) {
    pricing.starting_price_php = Math.min(...bracketRows.map((b) => b.price_php));
  }
  // What's-included flags (crew_meal_required kept = NOT included for the budget).
  const crew_meal_included = formData.get('crew_meal_included') === 'on';
  const transport_included = formData.get('transport_included') === 'on';
  const crew_meal_required = !crew_meal_included;
  if (transport_included) transport_flat_fee_php = null;
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
      `${await servicesReturnBase()}?error=${encodeURIComponent((e as Error).message)}`,
    );
  }

  const { error } = await supabase
    .from('vendor_services')
    .update({
      starting_price_php: pricing.starting_price_php,
      added_pax_price_php: pricing.added_pax_price_php,
      base_pax: pricing.base_pax,
      pricing_basis: pricing.pricing_basis,
      per_pax_price_php: pricing.per_pax_price_php,
      min_pax: pricing.min_pax,
      hour_base_php: pricing.hour_base_php,
      min_hours: pricing.min_hours,
      extra_hour_php: pricing.extra_hour_php,
      coverage_id,
      crew_size,
      crew_meal_required,
      crew_meal_included,
      transport_included,
      transport_flat_fee_php,
      branch_id,
      recommended_lead_time_months,
      last_minute_end_months,
      last_minute_surcharge_pct,
      daily_capacity,
      exclusive_perk_text,
      updated_at: new Date().toISOString(),
    })
    .eq('vendor_service_id', idRaw)
    .eq('vendor_profile_id', profile.vendor_profile_id);

  if (error) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Phase 3b — replace-all the three child lists (multi-discount + free
  // inclusions + Fixed pax brackets) for this service (migration 20270502342558).
  await replaceServiceLists(supabase, idRaw, profile.vendor_profile_id, {
    discounts: discountRows,
    inclusions: inclusionRows,
    brackets: bracketRows,
  });

  revalidatePath('/vendor-dashboard/services');
  revalidatePath('/vendor-dashboard/shop');
  redirect(`${await servicesReturnBase()}?saved=1`);
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
    return redirect(`${await servicesReturnBase()}?error=Missing+service+id`);
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
    return redirect(`${await servicesReturnBase()}?error=Service+not+found`);
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
      `${await servicesReturnBase()}?error=${encodeURIComponent(del.error.message)}`,
    );
  }

  if (chosen.length > 0) {
    const rows = chosen.map((category, i) => ({
      vendor_service_id: anchorId,
      vendor_profile_id: profile.vendor_profile_id,
      linked_canonical_service: category,
      linked_label: displayServiceLabel(category),
      display_order: i,
    }));
    const ins = await supabase.from('vendor_service_links').insert(rows);
    if (ins.error) {
      return redirect(
        `${await servicesReturnBase()}?error=${encodeURIComponent(ins.error.message)}`,
      );
    }
  }

  revalidatePath('/vendor-dashboard/services');
  revalidatePath('/vendor-dashboard/shop');
  redirect(`${await servicesReturnBase()}?saved=1`);
}

/**
 * Vendor Transaction Lifecycle · Phase 2 · PR-A — define/replace a service's
 * PAYMENT SCHEDULE (downpayment + payment 1…X). The schedule is a reusable
 * TEMPLATE on the service; couples read it for display (PR-B renders it). It is
 * OPTIONAL — submitting zero installments clears the schedule.
 *
 * The client editor submits parallel arrays (one entry per installment):
 *   item_label[] · item_amount_kind[] · item_value[] · item_due_anchor[] ·
 *   item_due_offset_days[]
 * Order in the arrays IS the order — seq is assigned 0..N here (0 = the first /
 * downpayment row), NOT trusted from the client.
 *
 * Persisted as a replace-all set: clear the service's rows, re-insert. Both
 * writes are owner-scoped (RLS + explicit vendor_profile_id filter), mirroring
 * setServiceLinks. The anchor service's ownership is re-checked here too.
 */
export async function setServicePaymentSchedule(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  const serviceId = formData.get('vendor_service_id');
  if (typeof serviceId !== 'string' || serviceId.length === 0) {
    return redirect(`${await servicesReturnBase()}?error=Missing+service+id`);
  }

  // Ownership: the service must belong to THIS vendor profile.
  const { data: svc } = await supabase
    .from('vendor_services')
    .select('vendor_service_id')
    .eq('vendor_service_id', serviceId)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  if (!svc) {
    return redirect(`${await servicesReturnBase()}?error=Service+not+found`);
  }

  // Parse the parallel arrays into validated draft rows. Any malformed row
  // aborts the whole save (the schedule is replaced atomically-enough; we don't
  // want to half-apply it).
  const labels = formData.getAll('item_label');
  const kinds = formData.getAll('item_amount_kind');
  const values = formData.getAll('item_value');
  const anchors = formData.getAll('item_due_anchor');
  const offsets = formData.getAll('item_due_offset_days');
  // No-Show Downpayment Protection — reservation-policy parallel arrays. The
  // editor emits one entry per row (always present, even on non-downpayment
  // rows, to keep the index aligned); only seq 0 ever carries real values.
  const nonRefundables = formData.getAll('item_downpayment_non_refundable');
  const noShowForfeits = formData.getAll('item_no_show_forfeit');
  const refundWindows = formData.getAll('item_refund_window_days');
  const cancellationTerms = formData.getAll('item_cancellation_terms');

  type Insert = {
    vendor_service_id: string;
    vendor_profile_id: string;
    seq: number;
    label: string;
    amount_kind: AmountKind;
    percent_bps: number | null;
    amount_centavos: number | null;
    due_anchor: DueAnchor | null;
    due_offset_days: number | null;
    cancellation_terms: string | null;
    downpayment_non_refundable: boolean;
    refund_window_days: number | null;
    no_show_forfeit: boolean;
  };
  const rows: Insert[] = [];

  try {
    const n = labels.length;
    if (n > MAX_SCHEDULE_ITEMS) {
      throw new Error(`A schedule can have up to ${MAX_SCHEDULE_ITEMS} installments.`);
    }
    for (let i = 0; i < n; i++) {
      const label = typeof labels[i] === 'string' ? (labels[i] as string).trim() : '';
      if (label.length === 0 || label.length > 80) {
        throw new Error('Each installment needs a label (up to 80 characters).');
      }

      const kindRaw = kinds[i];
      if (kindRaw !== 'percent' && kindRaw !== 'fixed') {
        throw new Error('Each installment must be a percent or a fixed amount.');
      }
      const amount_kind: AmountKind = kindRaw;

      const valueRaw = typeof values[i] === 'string' ? (values[i] as string).trim() : '';
      const value = Number(valueRaw);
      if (valueRaw.length === 0 || !Number.isFinite(value) || value < 0) {
        throw new Error('Each installment needs a non-negative amount.');
      }

      let percent_bps: number | null = null;
      let amount_centavos: number | null = null;
      if (amount_kind === 'percent') {
        if (!Number.isInteger(value) || value > 100) {
          throw new Error('A percentage must be a whole number between 0 and 100.');
        }
        percent_bps = pctToBps(value);
      } else {
        if (!Number.isInteger(value)) {
          throw new Error('A fixed amount must be a whole peso figure.');
        }
        amount_centavos = phpToCentavos(value);
      }

      // Due date is optional. Blank anchor → no anchored due date.
      const anchorRaw = anchors[i];
      let due_anchor: DueAnchor | null = null;
      let due_offset_days: number | null = null;
      if (anchorRaw === 'on_lock' || anchorRaw === 'before_event') {
        due_anchor = anchorRaw;
        const offRaw = typeof offsets[i] === 'string' ? (offsets[i] as string).trim() : '';
        if (offRaw.length > 0) {
          const off = Number(offRaw);
          if (!Number.isInteger(off) || off < 0) {
            throw new Error('Due-date days must be a non-negative whole number.');
          }
          due_offset_days = off;
        } else {
          due_offset_days = 0;
        }
      }

      // No-Show Downpayment Protection — the reservation policy lives on the
      // downpayment (seq 0) ONLY. Parse it for row 0; force defaults elsewhere
      // so a stray submitted value can't smuggle a policy onto a later
      // installment.
      let cancellation_terms: string | null = null;
      let downpayment_non_refundable = false;
      let refund_window_days: number | null = null;
      let no_show_forfeit = false;
      if (i === 0) {
        downpayment_non_refundable = nonRefundables[i] === '1';
        no_show_forfeit = noShowForfeits[i] === '1';
        const termsRaw =
          typeof cancellationTerms[i] === 'string'
            ? (cancellationTerms[i] as string).trim()
            : '';
        cancellation_terms = termsRaw.length > 0 ? termsRaw.slice(0, 2000) : null;
        const windowRaw =
          typeof refundWindows[i] === 'string' ? (refundWindows[i] as string).trim() : '';
        if (windowRaw.length > 0) {
          const w = Number(windowRaw);
          if (!Number.isInteger(w) || w < 0) {
            throw new Error('Refund window must be a non-negative whole number of days.');
          }
          refund_window_days = w;
        }
      }

      rows.push({
        vendor_service_id: serviceId,
        vendor_profile_id: profile.vendor_profile_id,
        seq: i, // order in the submitted arrays IS the order
        label: label.slice(0, 80),
        amount_kind,
        percent_bps,
        amount_centavos,
        due_anchor,
        due_offset_days,
        cancellation_terms,
        downpayment_non_refundable,
        refund_window_days,
        no_show_forfeit,
      });
    }
  } catch (e) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent((e as Error).message)}`,
    );
  }

  // Replace the service's schedule. Both writes are owner-scoped (RLS + explicit
  // profile filter), same as setServiceLinks.
  const del = await supabase
    .from('vendor_service_payment_schedules')
    .delete()
    .eq('vendor_service_id', serviceId)
    .eq('vendor_profile_id', profile.vendor_profile_id);
  if (del.error) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent(del.error.message)}`,
    );
  }

  if (rows.length > 0) {
    const ins = await supabase.from('vendor_service_payment_schedules').insert(rows);
    if (ins.error) {
      return redirect(
        `${await servicesReturnBase()}?error=${encodeURIComponent(ins.error.message)}`,
      );
    }
  }

  revalidatePath('/vendor-dashboard/services');
  revalidatePath('/vendor-dashboard/shop');
  redirect(`${await servicesReturnBase()}?saved=1`);
}

/**
 * commitVendorService — the guided "create a service" flow's SINGLE save.
 *
 * Validates EVERYTHING in TypeScript (reusing the same parse* helpers the legacy
 * per-form actions use — single source of truth, no SQL/TS drift), then calls
 * ONE atomic RPC (`save_vendor_service`, migration 20270208451790) that writes
 * the vendor_services row + replace-all links + replace-all payment schedule in
 * a single transaction. Replaces the four-independent-save-buttons footgun for
 * the wizard path (the legacy card keeps its own actions per owner 2026-06-20).
 *
 * vendor_service_id present → UPDATE (edit); absent → INSERT (create, with the
 * create-only tier-cap pre-check). `publish=true` flips is_active on (gated to a
 * non-empty perk, re-enforced in the RPC). Time-slots are NOT handled here —
 * they keep addServiceTimeSlot/deleteServiceTimeSlot (Enterprise + booking lock).
 */
export async function commitVendorService(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  const idRaw = formData.get('vendor_service_id');
  const serviceId =
    typeof idRaw === 'string' && idRaw.length > 0 ? idRaw : null;
  const isCreate = serviceId === null;
  const publish = formData.get('publish') === 'true';

  // PR-C — preserve claim context across a validation bounce. When a claim-
  // driven first-service CREATE fails validation, the plain
  // `${await servicesReturnBase()}?error=…` redirect would drop the claim_token and
  // strand the vendor on the generic list (no banner, no registration on retry).
  // So on the claim-driven CREATE path we route failures back to the guided
  // /services/new/<category>?claim=<token>&error=… page instead, keeping the
  // banner + threaded token alive through the retry. The category for the URL is
  // the form's chosen category (CREATE always carries a valid one); if it's not a
  // known category we fall back to the generic list rather than build a bad URL.
  const claimTokenRaw0 = formData.get('claim_token');
  const claimToken =
    typeof claimTokenRaw0 === 'string' && claimTokenRaw0.length > 0
      ? claimTokenRaw0
      : null;
  const formCategoryRaw = formData.get('category');
  const formCategory =
    typeof formCategoryRaw === 'string' && CATEGORY_SET.has(formCategoryRaw)
      ? formCategoryRaw
      : null;
  const back = async (msg: string) => {
    if (isCreate && claimToken && formCategory) {
      return redirect(
        `/vendor-dashboard/services/new/${formCategory}?claim=${encodeURIComponent(
          claimToken,
        )}&error=${encodeURIComponent(msg)}`,
      );
    }
    return redirect(`${await servicesReturnBase()}?error=${encodeURIComponent(msg)}`);
  };

  // ---- Tier + caps (read once) ----
  const { data: tierRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state, is_founder')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  const tierRowTyped = tierRow as
    | { tier_state?: string | null; is_founder?: boolean | null }
    | null;
  const baseCaps = tierCaps(asVendorTier(tierRowTyped?.tier_state));
  const caps =
    tierRowTyped?.is_founder === true
      ? { ...baseCaps, parentCategories: Infinity, servicesPerLeaf: Infinity }
      : baseCaps;

  // ---- Parse the vendor_services fields (reuse the legacy helpers) ----
  let category: VendorCategory;
  let fields: Record<string, unknown>;
  // Hoisted so the multi-discount write below the parse try can read it.
  let discount: ReturnType<typeof parseDiscountFields>;
  try {
    // On edit the category is immutable; read it from the existing row instead
    // of trusting the form. On create it comes from the chosen category step.
    if (isCreate) {
      category = parseCategory(formData.get('category'));
    } else {
      const { data: row } = await supabase
        .from('vendor_services')
        .select('category')
        .eq('vendor_service_id', serviceId)
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .maybeSingle();
      const existingCat = (row as { category?: string } | null)?.category;
      if (!existingCat) return back('Service not found.');
      category = existingCat as VendorCategory;
    }

    const titleRaw = formData.get('title');
    const title =
      typeof titleRaw === 'string' && titleRaw.trim().length > 0
        ? titleRaw.trim().slice(0, 80)
        : null;
    discount = parseDiscountFields(formData);
    const branch_id = await resolveBranchId(
      supabase,
      profile.vendor_profile_id,
      formData.get('branch_id'),
    );

    fields = {
      category,
      title,
      starting_price_php: parseInt0OrNull(formData.get('starting_price_php')),
      added_pax_price_php: parseInt0OrNull(formData.get('added_pax_price_php')),
      base_pax: parseInt0OrNull(formData.get('base_pax')) || null,
      coverage_id: await resolveOwnedCoverageId(
        supabase,
        profile.vendor_profile_id,
        formData.get('coverage_id'),
      ),
      crew_size: parseInt0OrNull(formData.get('crew_size')),
      crew_meal_required: formData.get('crew_meal_required') === 'on',
      branch_id,
      recommended_lead_time_months: parseLeadTimeMonthsOrNull(
        formData.get('recommended_lead_time_months'),
      ),
      last_minute_end_months: parseInt0OrNull(formData.get('last_minute_end_months')),
      last_minute_surcharge_pct: parseSurchargePctOrNull(
        formData.get('last_minute_surcharge_pct'),
      ),
      daily_capacity: parseDailyCapacityOrThrow(
        formData.get('daily_capacity'),
        caps.slotsPerDay,
      ),
      exclusive_perk_text: parseExclusivePerk(formData),
      primary_photo_r2_key: parsePrimaryPhoto(formData),
    };
  } catch (e) {
    return back((e as Error).message);
  }

  // Publish gate (owner 2026-06-20 "the card needs a photo"): a live service
  // card must carry a real cover photo. Drafts can save without one. The perk
  // gate is re-checked inside the RPC; the photo gate lives here in TS.
  if (publish && !fields.primary_photo_r2_key) {
    return back('Add a cover photo before publishing — drafts can save without one.');
  }

  // ---- Tier caps on CREATE only (a new row can introduce a new leaf/parent) ----
  if (isCreate) {
    const { data: existingRows } = await supabase
      .from('vendor_services')
      .select('category')
      .eq('vendor_profile_id', profile.vendor_profile_id);
    const existing = (existingRows ?? []) as { category: VendorCategory }[];

    if (caps.servicesPerLeaf !== Infinity) {
      const inLeaf = existing.filter((r) => r.category === category).length;
      if (inLeaf >= caps.servicesPerLeaf) {
        return back(
          `Your plan allows ${caps.servicesPerLeaf} service${caps.servicesPerLeaf === 1 ? '' : 's'} per category. Upgrade to add more here.`,
        );
      }
    }
    const newParents = parentsOfCategory(category);
    if (caps.parentCategories !== Infinity && newParents.length > 0) {
      const existingParents = new Set(
        existing.flatMap((r) => parentsOfCategory(r.category)),
      );
      const introducesNew = newParents.some((p) => !existingParents.has(p));
      const wouldBe = new Set(existingParents);
      newParents.forEach((p) => wouldBe.add(p));
      if (introducesNew && wouldBe.size > caps.parentCategories) {
        return back(
          `Your plan covers ${caps.parentCategories} categor${caps.parentCategories === 1 ? 'y' : 'ies'}. Upgrade to list under more.`,
        );
      }
    }
  }

  // ---- "Comes with" links: keep only categories this vendor actually offers ----
  const { data: ownRows } = await supabase
    .from('vendor_services')
    .select('category')
    .eq('vendor_profile_id', profile.vendor_profile_id);
  const offered = new Set(
    ((ownRows ?? []) as { category: string }[])
      .map((r) => r.category)
      .filter((c) => c !== category),
  );
  const links = Array.from(
    new Set(
      formData
        .getAll('linked')
        .filter((v): v is string => typeof v === 'string')
        .filter((c) => offered.has(c)),
    ),
  )
    .slice(0, 6)
    .map((c, i) => ({
      linked_canonical_service: c,
      linked_label: displayServiceLabel(c as VendorCategory),
      display_order: i,
    }));

  // ---- Payment schedule rows (reuse the legacy parsing shape) ----
  let schedule: Array<Record<string, unknown>>;
  try {
    schedule = parseScheduleRows(formData);
  } catch (e) {
    return back((e as Error).message);
  }

  // Discount → the multi-discount table via the RPC's replace-all. The single-
  // discount wizard form carries no unit; derive it with the migration's backfill
  // heuristic (rate <= 100 ⇒ %, else ₱). p_brackets / p_inclusions are [] until
  // the Phase-3 UI wires them (nothing to preserve yet · migration 20270502342558).
  const svcDiscounts =
    discount.discount_type && discount.discount_value != null
      ? [
          {
            discount_type: discount.discount_type,
            rate: discount.discount_value,
            unit: discount.discount_value <= 100 ? 'pct' : 'php',
            expires_at: discount.discount_expires_at,
            conditions_md: discount.discount_conditions_md,
            sort_order: 0,
          },
        ]
      : [];

  // ---- ONE atomic write ----
  const { data: savedId, error } = await supabase.rpc('save_vendor_service', {
    p_vendor_profile_id: profile.vendor_profile_id,
    p_service_id: serviceId,
    p_fields: fields,
    p_links: links,
    p_schedule: schedule,
    p_discounts: svcDiscounts,
    p_brackets: [],
    p_inclusions: [],
    p_publish: publish,
  });
  if (error) return back(error.message);

  // ---- PR-C — register the freshly-created service to the inviting couple ----
  // When this create came from a couple's claim QR (?claim=<token> threaded
  // through as a hidden field), link the new service back to the couple's plan
  // (event_vendors.service_id). registerClaimedServiceToCouple re-verifies the
  // full security chain server-side (claim owned by THIS user, claimed to THIS
  // profile, couple already linked to THIS profile, service owned by THIS
  // profile) before the cross-actor admin write, and is idempotent (won't
  // clobber an existing service_id). On CREATE only — an edit never re-registers.
  // Best-effort: a stale/foreign/failed claim never blocks the save; the
  // service is already committed and the vendor continues to their dashboard.
  // (claimToken was read up top so the validation-failure `back()` path can
  // preserve it; reuse it here rather than re-reading the form.)
  let cameFromClaim = false;
  if (isCreate && claimToken && typeof savedId === 'string' && savedId.length > 0) {
    cameFromClaim = true;
    try {
      // Identity is derived from the session inside the helper — we only pass
      // the claim token and the just-created service id, both re-verified there.
      const res = await registerClaimedServiceToCouple({
        claimToken,
        vendorServiceId: savedId,
      });
      if (!res.ok) {
        console.warn('[claim] service→couple registration skipped:', res.code, res.message);
      }
    } catch (e) {
      console.warn('[claim] service→couple registration threw (service kept):', e);
    }
  }

  // Reverse-image repost-watch: hash the cover photo + flag cross-vendor,
  // non-demo perceptual matches, post-response (cron-free). Scheduled BEFORE the
  // redirect (which throws to unwind) and self-swallowing so it never affects
  // the save. Skips refs already hashed, so an edit that didn't change the photo
  // is a cheap no-op.
  const primaryPhoto = fields.primary_photo_r2_key;
  if (typeof primaryPhoto === 'string' && primaryPhoto.length > 0) {
    after(() =>
      hashAndScanVendorImages({
        vendorProfileId: profile.vendor_profile_id,
        refs: [primaryPhoto],
        surface: 'service_primary',
      }),
    );
  }

  revalidatePath('/vendor-dashboard/services');
  revalidatePath('/vendor-dashboard/shop');
  // PR-C — after a claim-driven first service, send the vendor on to their
  // dashboard to "continue from there" (the new client is in their pipeline).
  // The normal flow stays on the Services page with the saved anchor.
  if (cameFromClaim) {
    revalidatePath('/vendor-dashboard');
    redirect('/vendor-dashboard?claimed=1&service=1');
  }
  redirect(`${await servicesReturnBase()}?saved=1#service-${savedId ?? ''}`);
}

/**
 * Parse the wizard's installment rows (same field names the legacy
 * payment-schedule editor submits) into the RPC's schedule jsonb shape — WITHOUT
 * the service/profile ids (the RPC fills those). Mirrors setServicePaymentSchedule.
 */
function parseScheduleRows(formData: FormData): Array<Record<string, unknown>> {
  const labels = formData.getAll('item_label');
  const kinds = formData.getAll('item_amount_kind');
  const values = formData.getAll('item_value');
  const anchors = formData.getAll('item_due_anchor');
  const offsets = formData.getAll('item_due_offset_days');
  const rows: Array<Record<string, unknown>> = [];
  const n = labels.length;
  if (n > MAX_SCHEDULE_ITEMS) {
    throw new Error(`A schedule can have up to ${MAX_SCHEDULE_ITEMS} installments.`);
  }
  for (let i = 0; i < n; i++) {
    const label = typeof labels[i] === 'string' ? (labels[i] as string).trim() : '';
    if (label.length === 0 || label.length > 80) {
      throw new Error('Each installment needs a label (up to 80 characters).');
    }
    const kindRaw = kinds[i];
    if (kindRaw !== 'percent' && kindRaw !== 'fixed') {
      throw new Error('Each installment must be a percent or a fixed amount.');
    }
    const amount_kind = kindRaw as AmountKind;
    const valueRaw = typeof values[i] === 'string' ? (values[i] as string).trim() : '';
    const value = Number(valueRaw);
    if (valueRaw.length === 0 || !Number.isFinite(value) || value < 0) {
      throw new Error('Each installment needs a non-negative amount.');
    }
    let percent_bps: number | null = null;
    let amount_centavos: number | null = null;
    if (amount_kind === 'percent') {
      if (!Number.isInteger(value) || value > 100) {
        throw new Error('A percentage must be a whole number between 0 and 100.');
      }
      percent_bps = pctToBps(value);
    } else {
      if (!Number.isInteger(value)) {
        throw new Error('A fixed amount must be a whole peso figure.');
      }
      amount_centavos = phpToCentavos(value);
    }
    const anchorRaw = anchors[i];
    let due_anchor: DueAnchor | null = null;
    let due_offset_days: number | null = null;
    if (anchorRaw === 'on_lock' || anchorRaw === 'before_event') {
      due_anchor = anchorRaw;
      const offRaw = typeof offsets[i] === 'string' ? (offsets[i] as string).trim() : '';
      if (offRaw.length > 0) {
        const off = Number(offRaw);
        if (!Number.isInteger(off) || off < 0) {
          throw new Error('Due-date days must be a non-negative whole number.');
        }
        due_offset_days = off;
      } else {
        due_offset_days = 0;
      }
    }
    rows.push({
      seq: i,
      label: label.slice(0, 80),
      amount_kind,
      percent_bps,
      amount_centavos,
      due_anchor,
      due_offset_days,
    });
  }
  return rows;
}

export async function toggleVendorServiceActive(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  const idRaw = formData.get('vendor_service_id');
  const nextRaw = formData.get('is_active');
  if (typeof idRaw !== 'string' || idRaw.length === 0) {
    return redirect(`${await servicesReturnBase()}?error=Missing+service+id`);
  }
  const is_active = nextRaw === 'true' || nextRaw === 'on' || nextRaw === '1';

  // Publish gate (Part B, v2.1 §7.2): exclusive_perk_text is required to
  // publish (is_active=true). Drafts (is_active=false) may omit it.
  if (is_active) {
    const { data: svcRow } = await supabase
      .from('vendor_services')
      .select('exclusive_perk_text')
      .eq('vendor_service_id', idRaw)
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    const perk = (svcRow as { exclusive_perk_text?: string | null } | null)
      ?.exclusive_perk_text;
    if (!perk || perk.trim().length === 0) {
      return redirect(
        `${await servicesReturnBase()}?error=${encodeURIComponent(
          'A Setnayan Exclusive perk is required to publish this service.',
        )}`,
      );
    }
  }

  const { error } = await supabase
    .from('vendor_services')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('vendor_service_id', idRaw)
    .eq('vendor_profile_id', profile.vendor_profile_id);

  if (error) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/services');
  revalidatePath('/vendor-dashboard/shop');
  redirect(`${await servicesReturnBase()}?saved=1`);
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
      `${await servicesReturnBase()}?error=${encodeURIComponent((e as Error).message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/services');
  revalidatePath('/vendor-dashboard/shop');
  redirect(`${await servicesReturnBase()}?saved=1`);
}

export async function deleteServiceTimeSlot(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  // No tier gate — a downgraded vendor must still be able to remove slots that
  // are otherwise still enforcing against their bookings (verifier C8).
  const slotId = String(formData.get('slot_id') ?? '');
  if (!slotId) {
    return redirect(`${await servicesReturnBase()}?error=Missing+slot+id`);
  }

  const { error } = await supabase
    .from('vendor_service_time_slots')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('slot_id', slotId)
    .eq('vendor_profile_id', profile.vendor_profile_id); // double-scoped

  if (error) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/services');
  revalidatePath('/vendor-dashboard/shop');
  redirect(`${await servicesReturnBase()}?saved=1`);
}

export async function deleteVendorService(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  const idRaw = formData.get('vendor_service_id');
  if (typeof idRaw !== 'string' || idRaw.length === 0) {
    return redirect(`${await servicesReturnBase()}?error=Missing+service+id`);
  }

  const { error } = await supabase
    .from('vendor_services')
    .delete()
    .eq('vendor_service_id', idRaw)
    .eq('vendor_profile_id', profile.vendor_profile_id);

  if (error) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath('/vendor-dashboard/services');
  revalidatePath('/vendor-dashboard/shop');
  redirect(`${await servicesReturnBase()}?saved=1`);
}
