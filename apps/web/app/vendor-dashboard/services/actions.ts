'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { servicesReturnBase } from '@/lib/vendor-services-return';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hashAndScanVendorImages } from '@/lib/vendor-image-repost-watch';
import { vendorQrGuardRejects } from '@/lib/vendor-qr-media-guard';
import { VENDOR_QR_MEDIA_ERROR } from '@/lib/vendor-qr-guard-shared';
import {
  VENDOR_CATEGORIES,
  displayServiceLabel,
  type VendorCategory,
} from '@/lib/vendors';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  parseDiscountRows,
  type DiscountDraft,
} from '@/lib/vendor-discount-rows';
import { parentsOfKind, coverageParents } from '@/lib/vendor-category-parents';
import { getCoverageTaxonomy } from '@/lib/vendor-coverages';
import {
  buildLeafIndex,
  isCoverageLeafKind,
  EMPTY_LEAF_INDEX,
  type LeafIndex,
} from '@/lib/service-card-kind';
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
import { findVendorTextViolation } from '@/lib/service-text-integrity';
import {
  PUBLISH_REFUSAL_MESSAGE,
  exclusiveIsSet,
  priceIsSet,
  unmetPublishRequirements,
} from '@/lib/service-publish-gate';
import { packageAuthoringEnabled } from '@/lib/package-authoring-flag';
import { validatePackageDraft, type DraftItem } from '@/lib/package-authoring';
import {
  CUSTOMIZATION_FIELD_NAME,
  autoNameDraftItems,
  canonicalServiceForVendorCategory,
  countAutoNamed,
  parseCustomizationDraft,
  toPackageDraft,
} from '@/lib/service-customization-draft';
import { savePackage } from '../packages/actions';

const CATEGORY_SET: ReadonlySet<string> = new Set(VENDOR_CATEGORIES);

/**
 * THE ONE GATE THAT DECIDES WHAT A CARD MAY BE FILED UNDER.
 *
 * ⚖ WIDENED 2026-08-28 (owner, asked twice: *"yes their own words"*). Two
 * vocabularies are now legal in `vendor_services.category`:
 *
 *   · a COVERAGE LEAF from the live admin taxonomy — the supplier's own word,
 *     *Pabati*, which is what the chooser now offers first; and
 *   · a legacy `VENDOR_CATEGORIES` key, kept as the fallback for a shop whose
 *     coverage does not cover what this card is for. Nothing was removed and
 *     nothing was migrated.
 *
 * 🔒 STILL A CLOSED SET, AND THAT MATTERS: the column is plain TEXT with no
 * database-level check and `save_vendor_service` validates nothing (read out of
 * production with `pg_get_functiondef`), so this function is the entire fence.
 * The leaf half is checked against the LIVE TREE rather than a list in code —
 * that is the whole reason the taxonomy lives in the database, and it is why an
 * admin adding a trade makes it a card kind with no deploy.
 *
 * ⚠ THE ALLOWED-LEAF SET IS PASSED IN, NEVER FETCHED HERE. It comes from the
 * same `getCoverageTaxonomy()` the chooser rendered, so the screen cannot offer
 * a kind the save then refuses — two copies of a permission rule always drift,
 * and the copy on the screen would be the optimistic one. An unreadable tree
 * yields an empty index and this degrades to exactly the legacy behaviour: a
 * refusal a supplier can act on, never a silently accepted unknown word.
 */
function parseCategory(
  raw: FormDataEntryValue | null,
  leaves: LeafIndex = EMPTY_LEAF_INDEX,
): VendorCategory {
  if (
    typeof raw !== 'string' ||
    !(CATEGORY_SET.has(raw) || isCoverageLeafKind(raw, leaves))
  ) {
    throw new Error('Unknown service category.');
  }
  return raw as VendorCategory;
}

/**
 * The live coverage leaves, for the gate above and the family caps below.
 *
 * FAIL-SOFT to an empty index — a taxonomy hiccup must not stop a supplier
 * saving a card under a legacy kind, and it must never widen the gate either.
 */
async function currentLeafIndex(): Promise<LeafIndex> {
  try {
    return buildLeafIndex(await getCoverageTaxonomy());
  } catch {
    return EMPTY_LEAF_INDEX;
  }
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

// (The legacy single-discount parser — discount_type/discount_value scalar
// fields — was removed 2026-07-03 with wizard parity: the wizard now submits
// the same multi-discount arrays as the inline form, parsed by
// parseDiscountRows.)

// ── List editors (service-card redesign · Phase 3b) ─────────────────────────
// Three repeatable child-table lists submitted as parallel, index-aligned
// arrays of HIDDEN inputs (formData.getAll). Each parses into validated draft
// rows; the caller replace-alls them into the matching child table. Fully-blank
// rows are ignored so an empty repeater cleanly clears the list.
//
// The DISCOUNT parser now lives in `@/lib/vendor-discount-rows` (imported at the
// top of this file) — this module is `'use server'`, so nothing inside it can be
// unit-tested, and the early-booking LADDER rule (owner-locked 2026-07-27) is
// exactly the kind of rule that must be. Behaviour, validation order and the
// vendor-facing error strings are unchanged by the move.

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
 * Showcase media (service-card redesign · Phase 3c): one ≤30s clip ref + up to
 * 5 photo refs (FileUpload emits one hidden input per photo → getAll). The
 * photos column carries a cardinality ≤5 CHECK — slice defensively even though
 * the picker also caps at 5.
 */
function parseShowcaseMedia(formData: FormData): {
  showcase_video_r2_key: string | null;
  showcase_photo_r2_keys: string[];
} {
  const videoRaw = formData.get('showcase_video_r2_key');
  const showcase_video_r2_key =
    typeof videoRaw === 'string' && videoRaw.trim().length > 0 ? videoRaw.trim() : null;
  const showcase_photo_r2_keys = formData
    .getAll('showcase_photo_r2_keys')
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0)
    .slice(0, 5);
  return { showcase_video_r2_key, showcase_photo_r2_keys };
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
        // The early-booking ladder rung (migration 20271017996549).
        min_lead_months: d.min_lead_months,
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
  let showcase: ReturnType<typeof parseShowcaseMedia>;
  // The live leaves, read ONCE and used for both the gate and the family cap —
  // so "may I file under this?" and "which family does it count against?" can
  // never answer from two different snapshots of the tree.
  const leaves = await currentLeafIndex();
  try {
    category = parseCategory(formData.get('category'), leaves);
    // Pricing basis (fixed | per_pax | per_hour) + synced starting_price anchor.
    pricing = parsePricingFields(formData);
    transport_flat_fee_php = parseInt0OrNull(formData.get('transport_flat_fee_php'));
    showcase = parseShowcaseMedia(formData);
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

  // Card-text integrity (owner 2026-07-27 · flag-dark): no off-platform contact
  // info in anything that renders on the public card. Runs BEFORE the first
  // write so a bounce never leaves a half-saved service.
  //
  // No auto-naming here, unlike savePackage: `parseInclusionRows` /
  // `parseDiscountRows` already DROP a blank row (`if (label.length === 0)
  // continue`), so a blank never reaches the write to be named — and the title
  // has its own publish gate.
  {
    const viol = findVendorTextViolation([
      { field: 'Title', value: title },
      { field: 'Setnayan Exclusive', value: exclusive_perk_text },
      ...inclusionRows.map((n, i) => ({
        field: `Inclusion ${i + 1}`,
        value: n.label,
      })),
      ...discountRows.map((d, i) => ({
        field: `Discount ${i + 1} conditions`,
        value: d.conditions_md,
      })),
    ]);
    if (viol) {
      return redirect(`${await servicesReturnBase()}?error=${encodeURIComponent(viol)}`);
    }
  }

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
  // Counts the UNION of legacy service-category parents ∪ coverage parents —
  // coverage is becoming the source of truth (see coverageParents).
  const newParents = parentsOfKind(category, leaves);
  if (caps.parentCategories !== Infinity && newParents.length > 0) {
    const existingParents = new Set([
      ...existing.flatMap((r) => parentsOfKind(r.category, leaves)),
      ...(await coverageParents(supabase, profile.vendor_profile_id)),
    ]);
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

  // QR-in-media guard (owner-locked 2026-07-03): showcase photos render on the
  // public service card — they may not embed the vendor's invite/lock QR. All
  // refs are new on create. Fails OPEN on scanner trouble (never blocks an
  // honest save); the video is checked client-side at pick time.
  if (
    showcase.showcase_photo_r2_keys.length > 0 &&
    (await vendorQrGuardRejects(showcase.showcase_photo_r2_keys))
  ) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent(VENDOR_QR_MEDIA_ERROR)}`,
    );
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
      showcase_video_r2_key: showcase.showcase_video_r2_key,
      showcase_photo_r2_keys: showcase.showcase_photo_r2_keys,
      primary_photo_r2_key: parsePrimaryPhoto(formData),
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

  // Repost-watch/NSFW hash-scan on a new cover — same post-response hook the
  // wizard path schedules (cron-free; self-swallowing; skips already-hashed).
  const createdCover = parsePrimaryPhoto(formData);
  if (createdCover) {
    after(() =>
      hashAndScanVendorImages({
        vendorProfileId: profile.vendor_profile_id,
        refs: [createdCover],
        surface: 'service_primary',
      }),
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
  // Set only when this submit came from the maker's plan-locked-kind link
  // (S3, owner 2026-08-28) — carries "Back to your card" through the redirect,
  // since a server action can't read the page's own URL for it.
  const fromLockedKind = formData.get('from_locked_kind') === '1' ? '&wantCategory=1' : '';
  if (label.length < 2 || label.length > 80) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent('Category name must be 2–80 characters.')}${fromLockedKind}`,
    );
  }

  const { error } = await supabase.from('taxonomy_category_requests').insert({
    proposed_by_vendor_id: profile.vendor_profile_id,
    proposed_label: label,
    proposed_note: note,
  });
  if (error) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent(error.message)}${fromLockedKind}`,
    );
  }

  revalidatePath('/vendor-dashboard/services');
  revalidatePath('/vendor-dashboard/shop');
  redirect(`${await servicesReturnBase()}?requested=1${fromLockedKind}`);
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
  let showcase: ReturnType<typeof parseShowcaseMedia>;
  try {
    // Pricing basis (fixed | per_pax | per_hour) + synced starting_price anchor.
    pricing = parsePricingFields(formData);
    transport_flat_fee_php = parseInt0OrNull(formData.get('transport_flat_fee_php'));
    showcase = parseShowcaseMedia(formData);
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

  // Card-text integrity (owner 2026-07-27 · flag-dark), same gate as create.
  // No Title entry: this legacy edit form does not submit or write `title`
  // (the wizard's commitVendorService owns that field) — checking a value the
  // action never reads would bounce on text it cannot save.
  {
    const viol = findVendorTextViolation([
      { field: 'Setnayan Exclusive', value: exclusive_perk_text },
      ...inclusionRows.map((n, i) => ({
        field: `Inclusion ${i + 1}`,
        value: n.label,
      })),
      ...discountRows.map((d, i) => ({
        field: `Discount ${i + 1} conditions`,
        value: d.conditions_md,
      })),
    ]);
    if (viol) {
      return redirect(`${await servicesReturnBase()}?error=${encodeURIComponent(viol)}`);
    }
  }

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

  // QR-in-media guard (owner-locked 2026-07-03): scan only showcase photos NOT
  // already stored on this row (an unchanged gallery re-save costs nothing).
  if (showcase.showcase_photo_r2_keys.length > 0) {
    const { data: curRow } = await supabase
      .from('vendor_services')
      .select('showcase_photo_r2_keys')
      .eq('vendor_service_id', idRaw)
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    const stored = new Set(
      ((curRow as { showcase_photo_r2_keys?: string[] | null } | null)
        ?.showcase_photo_r2_keys ?? []).filter(Boolean),
    );
    const fresh = showcase.showcase_photo_r2_keys.filter((r) => !stored.has(r));
    if (fresh.length > 0 && (await vendorQrGuardRejects(fresh))) {
      return redirect(
        `${await servicesReturnBase()}?error=${encodeURIComponent(VENDOR_QR_MEDIA_ERROR)}`,
      );
    }
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
      showcase_video_r2_key: showcase.showcase_video_r2_key,
      showcase_photo_r2_keys: showcase.showcase_photo_r2_keys,
      primary_photo_r2_key: parsePrimaryPhoto(formData),
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

  // Repost-watch/NSFW hash-scan on the (possibly new) cover — parity with the
  // wizard path; already-hashed refs are a cheap no-op.
  const updatedCover = parsePrimaryPhoto(formData);
  if (updatedCover) {
    after(() =>
      hashAndScanVendorImages({
        vendorProfileId: profile.vendor_profile_id,
        refs: [updatedCover],
        surface: 'service_primary',
      }),
    );
  }

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
 * create-only tier-cap pre-check). `publish=true` flips is_active on, gated on
 * `unmetPublishRequirements` (a starting price + a non-empty Setnayan
 * Exclusive) — and re-enforced under it by the RPC and by the
 * `enforce_service_publish_gate` trigger, which is the actual fence.
 * Time-slots are NOT handled here —
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
  // Wizard parity 2026-07-03: mirrors createVendorService/updateVendorService —
  // pricing basis + synced anchor, showcase media, included flags, and the
  // three replace-all lists (multi-discounts · inclusions · Fixed brackets).
  let category: VendorCategory;
  let fields: Record<string, unknown>;
  // Hoisted so the QR guard + RPC payload below the parse try can read them.
  let showcase: ReturnType<typeof parseShowcaseMedia>;
  let discountRows: DiscountDraft[];
  let inclusionRows: InclusionDraft[];
  let bracketRows: BracketDraft[];
  try {
    // On edit the category is immutable; read it from the existing row instead
    // of trusting the form. On create it comes from the chosen category step.
    if (isCreate) {
      category = parseCategory(formData.get('category'), await currentLeafIndex());
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
    const branch_id = await resolveBranchId(
      supabase,
      profile.vendor_profile_id,
      formData.get('branch_id'),
    );

    // Pricing basis (fixed | per_pax | per_hour) + synced starting_price anchor.
    const pricing = parsePricingFields(formData);
    let transport_flat_fee_php = parseInt0OrNull(formData.get('transport_flat_fee_php'));
    showcase = parseShowcaseMedia(formData);
    // Phase 3b list editors — brackets only apply to the Fixed basis (the
    // editor is mounted only there); drop them otherwise.
    discountRows = parseDiscountRows(formData);
    inclusionRows = parseInclusionRows(formData);
    bracketRows =
      pricing.pricing_basis === 'fixed' ? parseBracketRows(formData) : [];
    // Fixed basis WITH brackets → the "from ₱X" anchor is the lowest bracket
    // price (Explore/budget read starting_price_php); else keep the parsed one.
    if (pricing.pricing_basis === 'fixed' && bracketRows.length > 0) {
      pricing.starting_price_php = Math.min(...bracketRows.map((b) => b.price_php));
    }
    // What's-included flags. crew_meal_required is kept as the INVERSE of
    // crew_meal_included so the 0007 budget's Crew-Meal line still triggers
    // (the old wizard's raw crew_meal_required checkbox could contradict the
    // card); transport fee only applies when transport is NOT included.
    const crew_meal_included = formData.get('crew_meal_included') === 'on';
    const transport_included = formData.get('transport_included') === 'on';
    if (transport_included) transport_flat_fee_php = null;

    fields = {
      category,
      title,
      ...pricing, // pricing_basis + starting_price_php anchor + per-basis scalars
      coverage_id: await resolveOwnedCoverageId(
        supabase,
        profile.vendor_profile_id,
        formData.get('coverage_id'),
      ),
      crew_size: parseInt0OrNull(formData.get('crew_size')),
      crew_meal_included,
      crew_meal_required: !crew_meal_included, // 0007 budget bridge
      transport_included,
      transport_flat_fee_php,
      showcase_video_r2_key: showcase.showcase_video_r2_key,
      showcase_photo_r2_keys: showcase.showcase_photo_r2_keys,
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

  // ---- THE PUBLISH GATE (owner-drawn 2026-08-28) --------------------------
  //
  // A card may go live only once it carries a starting price and a Setnayan
  // Exclusive. Asked HERE, from `lib/service-publish-gate.ts`, so the vendor
  // gets a sentence naming the field instead of a database error — the same
  // function the maker's meter asks, so the screen and the save cannot disagree
  // about whether Publish should have been pressable.
  //
  // 🔒 THIS IS NOT THE FENCE. `enforce_service_publish_gate` (migration
  // 20271176775619) is, because `authenticated` holds UPDATE on every column of
  // `vendor_services` under a row-ownership policy — a shop can flip
  // `is_active` through PostgREST and never reach this line. Removing this
  // check would not open the door; it would only make the refusal ugly.
  //
  // A DRAFT IS NEVER JUDGED. `publish === false` skips all of it, which is what
  // keeps "Save as draft" a real escape from an unfinished card.
  if (publish) {
    const unmet = unmetPublishRequirements({
      hasPrice: priceIsSet(fields.starting_price_php as number | null),
      hasExclusive: exclusiveIsSet(fields.exclusive_perk_text as string | null),
    });
    if (unmet.length > 0) return back(PUBLISH_REFUSAL_MESSAGE[unmet[0]]);
  }

  // ---- ★ Customization step (flag-dark behind packageAuthoringEnabled) ----
  //
  // The wizard is ONE <form>, so this step arrives as ONE hidden JSON field
  // alongside everything else. PARSED HERE, WRITTEN LATER: every bounce below
  // is a `redirect`, so the parse has to happen while a bounce is still free —
  // but the write has to wait until the service row exists. Malformed JSON
  // bounces with a readable sentence; it never throws, and it is never
  // degraded into an empty structure that would then be saved as a real
  // package (an empty package renders an empty configurator to the couple).
  //
  // With the flag OFF the field is not rendered and is not read, so this whole
  // block is inert and the action behaves exactly as it does today.
  let customizationItems: DraftItem[] = [];
  let customizationAutoNamed = 0;
  if (packageAuthoringEnabled()) {
    const parsed = parseCustomizationDraft(formData.get(CUSTOMIZATION_FIELD_NAME));
    if (!parsed.ok) return back(parsed.message);
    // Counted BEFORE naming — afterwards there are no blanks left to count.
    // Reported back to the vendor on the success redirect.
    customizationAutoNamed = countAutoNamed(parsed.items);
    // Blank names are FILLED IN, never refused (owner-locked 2026-07-27), and
    // filled in BEFORE validation — `validatePackageDraft` refuses a blank
    // `service_description`, and `savePackage`'s own auto-naming runs after it.
    customizationItems = autoNameDraftItems(parsed.items);
  }

  // Card-text integrity (owner 2026-07-27 · flag-dark). The wizard writes the
  // card text itself (title + perk go into the `fields` payload, the lists into
  // the same atomic RPC), so it needs its own gate — it does not route through
  // create/updateVendorService. Placed AFTER the parse try/catch on purpose:
  // `back()` redirects, and a redirect thrown inside that try would be caught
  // and re-reported as a parse error. Still ahead of the RPC, the first write.
  {
    const viol = findVendorTextViolation([
      { field: 'Title', value: fields.title as string | null },
      {
        field: 'Setnayan Exclusive',
        value: fields.exclusive_perk_text as string | null,
      },
      ...inclusionRows.map((n, i) => ({
        field: `Inclusion ${i + 1}`,
        value: n.label,
      })),
      ...discountRows.map((d, i) => ({
        field: `Discount ${i + 1} conditions`,
        value: d.conditions_md,
      })),
      // Customization lines are card text too — a couple reads them on the
      // configurator exactly the way they read an inclusion label. Routed
      // through the SAME gate (its 'card' profile), never a second one.
      ...customizationItems.flatMap((item, i) => [
        { field: `Customization line ${i + 1}`, value: item.service_description },
        ...item.options.map((o, j) => ({
          field: `Customization line ${i + 1} option ${j + 1}`,
          value: o.label,
        })),
      ]),
    ]);
    if (viol) return back(viol);
  }

  // The customization draft becomes a ONE-SERVICE package anchored to this
  // service's category. Built and validated HERE, before the service is
  // written, so a bad draft costs the vendor a bounce rather than leaving a
  // saved service whose customization silently vanished.
  const customizationPriceCentavos =
    typeof fields.starting_price_php === 'number' && fields.starting_price_php > 0
      ? // The ONE peso→centavo conversion site on this path.
        // `vendor_services.starting_price_php` is INTEGER PESOS;
        // `vendor_packages.total_price_centavos` is BIGINT CENTAVOS.
        fields.starting_price_php * 100
      : 0;
  if (customizationItems.length > 0) {
    if (customizationPriceCentavos <= 0) {
      return back(
        'Customization options need one price to sit under. Add a starting price on the Pricing step, or remove the customization lines.',
      );
    }
    const problems = validatePackageDraft(
      toPackageDraft(customizationItems, {
        packageName: (fields.title as string | null) ?? displayServiceLabel(category),
        totalPriceCentavos: customizationPriceCentavos,
      }),
    );
    const first = problems[0];
    if (first) return back(first.message);
  }

  // Publish gate (owner 2026-06-20 "the card needs a photo"): a live service
  // card must carry a real cover photo. Drafts can save without one. The perk
  // gate is re-checked inside the RPC; the photo gate lives here in TS.
  if (publish && !fields.primary_photo_r2_key) {
    return back('Add a cover photo before publishing — drafts can save without one.');
  }

  // QR-in-media guard (owner-locked 2026-07-03): the cover photo leads the
  // public service card — it may not embed the vendor's invite/lock QR.
  // Fails OPEN on scanner trouble so an honest save is never blocked.
  {
    const coverRef = fields.primary_photo_r2_key as string | null;
    if (coverRef && (await vendorQrGuardRejects([coverRef]))) {
      return back(VENDOR_QR_MEDIA_ERROR);
    }
  }

  // QR-in-media guard on the showcase photos (parity with the inline actions):
  // on create everything is new; on edit scan only refs NOT already stored on
  // this row (an unchanged gallery re-save costs nothing). Fails OPEN.
  if (showcase.showcase_photo_r2_keys.length > 0) {
    let fresh = showcase.showcase_photo_r2_keys;
    if (!isCreate) {
      const { data: curRow } = await supabase
        .from('vendor_services')
        .select('showcase_photo_r2_keys')
        .eq('vendor_service_id', serviceId)
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .maybeSingle();
      const stored = new Set(
        ((curRow as { showcase_photo_r2_keys?: string[] | null } | null)
          ?.showcase_photo_r2_keys ?? []).filter(Boolean),
      );
      fresh = fresh.filter((r) => !stored.has(r));
    }
    if (fresh.length > 0 && (await vendorQrGuardRejects(fresh))) {
      return back(VENDOR_QR_MEDIA_ERROR);
    }
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
    // Parent cap counts the UNION of legacy service-category parents ∪ the
    // vendor's coverage parents — coverage is becoming the source of truth
    // (see coverageParents; fail-soft to services-only on read error).
    const capLeaves = await currentLeafIndex();
    const newParents = parentsOfKind(category, capLeaves);
    if (caps.parentCategories !== Infinity && newParents.length > 0) {
      const existingParents = new Set([
        ...existing.flatMap((r) => parentsOfKind(r.category, capLeaves)),
        ...(await coverageParents(supabase, profile.vendor_profile_id)),
      ]);
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

  // The three replace-all lists → the RPC's jsonb args (wizard parity: same
  // rows the inline actions write via replaceServiceLists; sort_order = the
  // submitted array index, migration 20270502342558).
  const svcDiscounts = discountRows.map((d, i) => ({
    discount_type: d.discount_type,
    rate: d.rate,
    unit: d.unit,
    // The early-booking ladder rung — save_vendor_service reads
    // e->>'min_lead_months' (migration 20271017996549). Without this key the
    // WIZARD path would silently drop every tier the vendor just authored.
    min_lead_months: d.min_lead_months,
    expires_at: d.expires_at,
    conditions_md: d.conditions_md,
    sort_order: i,
  }));
  const svcBrackets = bracketRows.map((b, i) => ({
    min_pax: b.min_pax,
    max_pax: b.max_pax,
    price_php: b.price_php,
    sort_order: i,
  }));
  const svcInclusions = inclusionRows.map((n, i) => ({
    label: n.label,
    worth_php: n.worth_php,
    sort_order: i,
  }));

  // ---- ONE atomic write ----
  // ⚠ ADMIN CLIENT, DELIBERATELY (2026-08-01 security round two).
  // `save_vendor_service` is SECURITY DEFINER and took `p_vendor_profile_id` as
  // a TRUSTED PARAMETER with no ownership check in its body — so while this
  // action resolved the vendor correctly from the session, ANY authenticated
  // account could call the RPC directly and rewrite ANY vendor's published
  // prices, discounts, payment schedules and inclusions. Migration
  // 20271030569442 revokes it from `anon` and `authenticated`; the ownership
  // answer now comes from `ensureProfile()` above — the session — instead of
  // from an argument the database was willing to believe.
  const { data: savedId, error } = await createAdminClient().rpc('save_vendor_service', {
    p_vendor_profile_id: profile.vendor_profile_id,
    p_service_id: serviceId,
    p_fields: fields,
    p_links: links,
    p_schedule: schedule,
    p_discounts: svcDiscounts,
    p_brackets: svcBrackets,
    p_inclusions: svcInclusions,
    p_publish: publish,
  });
  if (error) return back(error.message);

  // ---- ★ Customization → the one-service package (write LATE) ----
  //
  // Only now, once the service row genuinely exists. Everything that could
  // reject this draft — the JSON parse, the card-text gate, the cross-row
  // validator, the missing-price check — already ran above, while a bounce was
  // still free; `savePackage` re-runs the validator itself as the backstop.
  //
  // ✅ HOW A SERVICE RESOLVES TO ITS PACKAGE ROW: through
  // `vendor_packages.vendor_service_id`, added 2026-08-24 (migration
  // 20271159436100) — the nullable link this comment used to say was missing.
  // It is stamped below so the card can compile which of its own options
  // couples chose; the database refuses a card owned by a different vendor.
  //
  // ⚠ STILL CREATE-ONLY. `/services/new/[category]` is this path's single
  // mount, so one run mints one package and nothing here can fork a second.
  // Re-opening a service to EDIT its customization is now UNBLOCKED by the link
  // but is not built — that is its own change, not a side effect of this one.
  //
  // A failure here does NOT bounce through `back()`: the service is already
  // saved, and on the claim path `back()` re-renders the wizard, which would
  // invite a re-submit and a duplicate service. Report it and move on.
  let customizationError: string | null = null;
  if (customizationItems.length > 0) {
    const res = await savePackage({
      ...toPackageDraft(customizationItems, {
        packageName: (fields.title as string | null) ?? displayServiceLabel(category),
        totalPriceCentavos: customizationPriceCentavos,
      }),
      primary_canonical_service: canonicalServiceForVendorCategory(category),
      // The link. `savedId` is the row `save_vendor_service` just returned, so
      // it is this session's own card by construction — and the database
      // re-checks that anyway rather than believing an argument.
      vendorServiceId: typeof savedId === 'string' && savedId.length > 0 ? savedId : null,
    });
    if (res.status !== 'ok') {
      customizationError =
        res.status === 'invalid'
          ? (res.problems[0]?.message ?? 'Some customization options need fixing.')
          : res.status === 'error'
            ? res.message
            : `Customization options could not be saved (${res.status}).`;
    }
  }

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
  // (savePackage revalidates /vendor-dashboard/packages itself on success.)

  // A LATE customization failure is reported as an ERROR even though the
  // service saved — "Services updated" and nothing else would let the vendor
  // believe their options went live. Checked BEFORE the claim redirect on
  // purpose: `/vendor-dashboard` renders no `?error=`, so routing the failure
  // there would swallow it. The couple registration above has already run, so
  // the only thing given up in this rare branch is the `claimed=1` banner.
  if (customizationError) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent(
        `Your service was saved, but its customization options were not: ${customizationError}`,
      )}#service-${savedId ?? ''}`,
    );
  }

  // PR-C — after a claim-driven first service, send the vendor on to their
  // dashboard to "continue from there" (the new client is in their pipeline).
  // The normal flow stays on the Services page with the saved anchor.
  if (cameFromClaim) {
    revalidatePath('/vendor-dashboard');
    redirect('/vendor-dashboard?claimed=1&service=1');
  }
  // Blank names are auto-named, never refused — so the save REPORTS how many
  // it filled in (the placeholder showed the same names before the save).
  const named = customizationAutoNamed > 0 ? `&autonamed=${customizationAutoNamed}` : '';
  // A CREATE gets its congratulations moment (owner 2026-07-28) — the landing
  // banner teaches the card's value (care for it; substance over count; events
  // document onto the card). The value says whether the new card went live, so
  // the "you now have X active cards" line can be worded truthfully. On success
  // `publish` IS the final is_active — a publish the RPC refuses errors above.
  const made = isCreate ? `&created=${publish ? 'live' : 'draft'}` : '';
  redirect(`${await servicesReturnBase()}?saved=1${made}${named}#service-${savedId ?? ''}`);
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

  // Publish gate — the SAME rule the maker's meter and the database trigger
  // ask (lib/service-publish-gate.ts). This path is the on/off switch on the
  // Services list, which can turn a long-forgotten draft live without ever
  // opening the maker, so it has to ask the whole question and not just the
  // half this action used to know (the Exclusive). Drafts are never judged.
  //
  // ⚠ A READ ERROR FAILS CLOSED. Supabase resolves with `{ error }` rather than
  // throwing, and an unread row used to reach `perk === undefined` and be
  // refused for the wrong reason. It is refused deliberately now, and said so:
  // publishing on a row we could not read would be publishing on no evidence.
  if (is_active) {
    const { data: svcRow, error: readError } = await supabase
      .from('vendor_services')
      .select('exclusive_perk_text, starting_price_php')
      .eq('vendor_service_id', idRaw)
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    if (readError || !svcRow) {
      return redirect(
        `${await servicesReturnBase()}?error=${encodeURIComponent(
          'We could not read this card just now, so it was not published. Try again in a moment.',
        )}`,
      );
    }
    const row = svcRow as {
      exclusive_perk_text?: string | null;
      starting_price_php?: number | null;
    };
    const unmet = unmetPublishRequirements({
      hasPrice: priceIsSet(row.starting_price_php),
      hasExclusive: exclusiveIsSet(row.exclusive_perk_text),
    });
    if (unmet.length > 0) {
      return redirect(
        `${await servicesReturnBase()}?error=${encodeURIComponent(
          PUBLISH_REFUSAL_MESSAGE[unmet[0]],
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

  // A couple's booked row points here via `event_vendors.service_id`, and that
  // FK is ON DELETE **SET NULL** — so a hard delete does not fail, it silently
  // erases which service the couple booked, including on a `contracted` row.
  // The same applies to `thread_service_interests` and `vendor_locked_qr_tokens`.
  //
  // So: a service anyone has ever picked is RETIRED (is_active = false), never
  // deleted. It vanishes from the vendor's public page exactly as before, and
  // the couple keeps the record of what they bought. Only a service nobody has
  // touched is deleted outright.
  const { count: pickedCount } = await supabase
    .from('event_vendors')
    .select('vendor_id', { count: 'exact', head: true })
    .eq('service_id', idRaw);

  if ((pickedCount ?? 0) > 0) {
    const { error: retireErr } = await supabase
      .from('vendor_services')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('vendor_service_id', idRaw)
      .eq('vendor_profile_id', profile.vendor_profile_id);

    if (retireErr) {
      return redirect(
        `${await servicesReturnBase()}?error=${encodeURIComponent(retireErr.message)}`,
      );
    }

    revalidatePath('/vendor-dashboard/services');
    revalidatePath('/vendor-dashboard/shop');
    return redirect(`${await servicesReturnBase()}?retired=1`);
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
