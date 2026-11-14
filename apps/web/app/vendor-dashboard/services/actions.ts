'use server';

import { withoutAlbumRefs } from '@/lib/put-photo-on-my-page';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { servicesReturnBase } from '@/lib/vendor-services-return';
import { QUOTE_RETURN_FIELD, QUOTE_RETURN_PARAM, quoteReturnPath, quoteReturnWithCard } from '@/lib/quote-card-return';
import {
  CARD_QUEUE_FIELD,
  CARD_QUEUE_PARAM,
  CARD_SPECIALTIES_FIELD,
  CARD_SPECIALTIES_PARAM,
  cardMakerQueueHref,
  encodeCardSpecialties,
  parseCardQueue,
  parseCardSpecialties,
} from '@/lib/card-queue';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { hashAndScanVendorImages, releaseCardPhotos } from '@/lib/vendor-image-repost-watch';
import { cardCheckRefusal } from '@/lib/service-card-checks.server';
import { vendorQrGuardRejects } from '@/lib/vendor-qr-media-guard';
import { VENDOR_QR_MEDIA_ERROR } from '@/lib/vendor-qr-guard-shared';
import {
  VENDOR_CATEGORIES,
  displayServiceLabel,
  type VendorCategory,
} from '@/lib/vendors';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { createAdminClient } from '@/lib/supabase/admin';
import { BOOKINGS_UNREAD, openBookingsRefusal, readCardBookings } from '@/lib/service-open-bookings';
import {
  deriveBranchStatus,
  fetchLatestBranchOrders,
  resolveBranchAssignment,
  type BranchAssignment,
  type RequestedBranchStatus,
} from '@/lib/vendor-branches';
import {
  parseDiscountRows,
  type DiscountDraft,
} from '@/lib/vendor-discount-rows';
import { parentsOfKind, coverageParents } from '@/lib/vendor-category-parents';
import { getCoverageTaxonomy } from '@/lib/vendor-coverages';
import { maybeDraftCategoryProposal } from '@/lib/category-proposal-draft-server';
import { recordCollectedTradePhrase } from '@/lib/service-trade-aliases-db';
import {
  buildLeafIndex,
  isCoverageLeafKind,
  EMPTY_LEAF_INDEX,
  type LeafIndex,
} from '@/lib/service-card-kind';
import { fetchCapsWithAddOns } from '@/lib/vendor-ultra-addons';
import { bookingsPerDateRefusal } from '@/lib/card-bookings-per-date';
import {
  assignCardSchedule,
  checkSlot,
  parseAddonRows,
  parseNewSlotRows,
  parsePaymentScheduleForm,
  parseRemovedSlotIds,
  parseScheduleChoice,
  replaceServiceAddons,
  writeSchedulePolicy,
  type ParsedScheduleRow,
} from '@/lib/service-card-save-parts';
import { mergeServiceRefinements } from '@/lib/vendor-service-refinements-write';
import { registerClaimedServiceToCouple } from '@/lib/vendor-invite-actions';
import { findVendorTextViolation } from '@/lib/service-text-integrity';
import {
  PUBLISH_REFUSAL_MESSAGE,
  coverIsSet,
  inclusionsAreSet,
  priceIsSet,
  publishRefusalFor,
  unmetForALiveCard,
  unmetPublishRequirements,
} from '@/lib/service-publish-gate';
import { SERVICE_UPDATE_MATCHED_NOTHING } from '@/lib/a-write-that-matched-nothing';
import { serviceCardTitleOrAuto } from '@/lib/service-card-auto-title';
import { cardKindLabeller } from '@/lib/card-kind-labeller';
import { humanizeKind } from '@/lib/service-card-kind';
import { isVendorNameRevealed } from '@/lib/vendors';
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
import { SHOP_PACK_GIFTS_DELIVER, giftColumns } from '@/lib/gift-pick';
import { freeByKind, shopGiftKindOf } from '@/lib/shop-gifts';
import { fetchShopGiftPacks, fetchShopGiftStock } from '@/lib/shop-gifts.server';
import { revalidateShopPage } from '@/lib/shop-page-cache';
import { SERVICE_REQUESTS_HREF, SERVICE_REQUEST_NEW_HREF, sameNameKey } from '@/lib/service-requests';
import { draftSaysExisting, loadRequestTree } from '@/lib/service-requests.server';

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

type InclusionDraft = { label: string };

/**
 * Parse the inclusion rows (Phase 3b). Field array: inclusion_label[]. A row with a blank label is skipped. Validates:
 * label 1–80.
 *
 * 🚫 WORDS ONLY (owner 11 Nov 2026: "The inclusions should not have a price … They only get price for the service").
 * No `inclusion_worth` is read — the makers no longer draw one, and a stray one posted by an old tab is ignored.
 */
function parseInclusionRows(formData: FormData): InclusionDraft[] {
  const labels = formData.getAll('inclusion_label');
  const out: InclusionDraft[] = [];
  for (const raw of labels) {
    const label = typeof raw === 'string' ? raw.trim() : '';
    if (label.length === 0) continue; // blank row → skip
    if (label.length > 80) {
      throw new Error('An inclusion label can be up to 80 characters.');
    }
    out.push({ label: label.slice(0, 80) });
  }
  return out;
}

/**
 * 🗄 HIDE, DON'T DELETE. The inclusion lists are replace-all writes (DELETE then INSERT), so a re-save that simply
 * stopped sending `worth_php` would wipe every worth a supplier ever typed. The value is no longer shown or asked
 * anywhere, but it is kept: a saved line whose label (case-insensitive) is unchanged carries its stored `worth_php`
 * forward untouched. Never displayed, never summed, never used for a price. A read error carries nothing — the save
 * still goes through, it just does not preserve a value nobody can see.
 */
async function storedInclusionWorth(
  supabase: SupabaseClient,
  vendorServiceId: string,
  vendorProfileId: string,
): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  const { data, error } = await supabase
    .from('vendor_service_inclusions')
    .select('label, worth_php')
    .eq('vendor_service_id', vendorServiceId)
    .eq('vendor_profile_id', vendorProfileId);
  if (error) {
    console.error('[supabase-error] services/actions.ts · from:vendor_service_inclusions.select (keep hidden worth)', error);
    return out;
  }
  for (const r of (data ?? []) as { label: string; worth_php: number | null }[]) {
    out.set(r.label.trim().toLowerCase(), r.worth_php);
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

/**
 * Parse the supplier's whole say over the Setnayan gift: yes or no.
 *
 * Owner 2026-09-09, on whether a supplier may give more than the 40% ceiling:
 * *"no. just max to 40%. nothing more."* — so there is no amount to parse. The
 * gift is Papic credits, sized from the booking fee and capped at the
 * 50,000-credit rung, and the photo count is computed at quote time from a
 * price that does not exist here.
 *
 * ⚠ `'on'` OR THE STRING `'off'` — never absence. Every surface sends this key
 * explicitly (a hidden input in the maker and the wizard, a radio pair in the
 * manager) because the save RPC reads a MISSING key as "leave the stored value
 * alone". That rule is what stops the retirement of `exclusive_perk_text` from
 * erasing the two live cards still promising through it, and it means an absent
 * key here must never be silently read as "no".
 */
function parseSetnayanGift(formData: FormData): boolean {
  return formData.get('includes_setnayan_gift') === 'on';
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
  // An event-album photo never goes on a card — no guest notice, no takedown reach (`withoutAlbumRefs`).
  return withoutAlbumRefs([raw.trim()])[0] ?? null;
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
  const showcase_photo_r2_keys = withoutAlbumRefs(
    formData
      .getAll('showcase_photo_r2_keys')
      .map((v) => String(v).trim())
      .filter((v) => v.length > 0),
  ).slice(0, 5);
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
 * Resolve a submitted branch_id to the branch this card is filed under.
 *
 * Two questions, in order:
 *  1. **Is it yours?** A foreign / blank / missing value coerces to null
 *     ("main / unassigned") exactly as it always has — the FK proves the branch
 *     is real, this proves it is THIS vendor's.
 *  2. **Is it paid for?** Owner-ruled 2026-08-28: "paid". Until this, the only
 *     filter anywhere was `status !== 'cancelled'`, so a branch nobody had ever
 *     paid for could be chosen in the picker AND accepted here. The picker no
 *     longer offers one; THIS is the half that holds when the form is posted
 *     directly, because a hidden option is not a rule.
 *
 * ⚠ The paid status is read with a SERVICE-ROLE client. `orders_owner_read`
 * scopes activation orders to whoever paid, so a shop's second manager reads
 * every branch as unpaid — which, once status is a gate, refuses a live branch.
 * The vendor id it is scoped by comes from the session, never from the form.
 *
 * Returns a refusal in WORDS rather than silently coercing to "main": moving a
 * vendor's card somewhere they did not ask for, with no message, is the shape
 * this repo keeps paying for.
 */
async function resolveBranchId(
  supabase: Awaited<ReturnType<typeof ensureProfile>>['supabase'],
  vendorProfileId: string,
  raw: FormDataEntryValue | null,
  serviceId: string | null,
): Promise<BranchAssignment> {
  if (typeof raw !== 'string') return { ok: true, branchId: null };
  const t = raw.trim();
  if (!t) return { ok: true, branchId: null };

  const { data: owned } = await supabase
    .from('vendor_branches')
    .select('branch_id,cancelled_at,included_in_plan')
    .eq('branch_id', t)
    .eq('parent_vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (!owned) {
    return resolveBranchAssignment({ requested: t, requestedStatus: null, current: null });
  }

  let current: string | null = null;
  if (serviceId) {
    const { data: svc } = await supabase
      .from('vendor_services')
      .select('branch_id')
      .eq('vendor_service_id', serviceId)
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    current = (svc as { branch_id?: string | null } | null)?.branch_id ?? null;
  }

  // Direction on a read error here is neither "unpaid" nor "fine": an
  // unreadable order is UNKNOWN, and it gets its own refusal. Reading it as
  // unpaid would tell a vendor whose branch is live that they have not paid
  // for it — a false statement about their money, which they would act on.
  let status: RequestedBranchStatus;
  try {
    const latest = await fetchLatestBranchOrders(createAdminClient(), [t]);
    status = deriveBranchStatus(
      owned as { cancelled_at: string | null; included_in_plan?: boolean | null },
      latest.get(t),
      Date.now(),
    );
  } catch {
    status = 'unknown';
  }
  return resolveBranchAssignment({ requested: t, requestedStatus: status, current });
}

/**
 * Parse the vendor-declared daily booking capacity (#2). Empty → null (unset →
 * no per-service daily cap; the schedule decides).
 *
 * ⚖ NO PLAN LIMIT (owner 2026-10-23, "plans price reach, not income"): the
 * supplier's own number governs on every plan. This used to refuse Free ("need a
 * paid plan") and cap the rest at the plan's `slotsPerDay` (Verified/Solo 1 ·
 * Pro 3 · Enterprise 8). The column's own CHECK (> 0) is the only rule left.
 */
function parseDailyCapacityOrThrow(raw: FormDataEntryValue | null): number | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const n = Number(raw.trim());
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('Daily capacity must be a positive whole number.');
  }
  return n;
}

/**
 * A CARD'S BOOKINGS PER DATE STAYS INSIDE ITS PLAN (owner 2026-11-06, DECISION_LOG "BOOKINGS PER DATE PER SERVICE IS A
 * PLAN ALLOWANCE": Solo 1 · Pro 3 · Ultra 5, plus any "+1 booking per date" bought). Null = it may be saved; else the
 * sentence to show. Free · Verified: 1 each, like Solo (owner click 2026-11-06). A card re-saved with the SAME number
 * it already holds above a lowered cap is grandfathered (lib/card-bookings-per-date.ts). The database honours only the
 * cap either way (`service_card_daily_limit`).
 */
async function bookingsPerDatePlanRefusal(
  supabase: SupabaseClient,
  vendorProfileId: string,
  requested: number | null,
  serviceId: string | null,
): Promise<string | null> {
  if (requested === null) return null;
  const { data: tierRow } = await supabase
    .from('vendor_profiles')
    .select('tier_state')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const tier = (tierRow as { tier_state?: string | null } | null)?.tier_state ?? null;
  const caps = await fetchCapsWithAddOns(supabase, vendorProfileId, tier);
  let stored: number | null = null;
  if (serviceId) {
    const { data: row } = await supabase
      .from('vendor_services')
      .select('daily_capacity')
      .eq('vendor_service_id', serviceId)
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    const n = Number((row as { daily_capacity?: number | null } | null)?.daily_capacity);
    stored = Number.isInteger(n) && n > 0 ? n : null;
  }
  return bookingsPerDateRefusal({ tier, effectiveCap: caps.bookingsPerDatePerService, requested, stored });
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

  const keptWorth = await storedInclusionWorth(supabase, vendorServiceId, vendorProfileId);
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
        worth_php: keptWorth.get(n.label.toLowerCase()) ?? null,
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
  let includes_setnayan_gift: boolean;
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
    includes_setnayan_gift = parseSetnayanGift(formData);
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
      // The Setnayan Exclusive free text is NOT checked here any more: since
      // 2026-09-09 no surface submits it, so scanning it would judge a stored
      // value the supplier cannot reach — a refusal with nothing to fix.
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

  const branchPick = await resolveBranchId(
    supabase,
    profile.vendor_profile_id,
    formData.get('branch_id'),
    null,
  );
  if (!branchPick.ok) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent(branchPick.message)}`,
    );
  }
  const branch_id = branchPick.branchId;

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
  // The plan's allowances PLUS the Ultra add-ons the shop bought (owner 2026-11-06 — +1 category, +1 service card,
  // +1 booking per date). Plan-only for every other tier (fetchCapsWithAddOns skips the read).
  const baseCaps = await fetchCapsWithAddOns(supabase, profile.vendor_profile_id, tierRowTyped?.tier_state);
  // Founder override (owner 2026-06-09): unlimited categories + services-per-leaf
  // ONLY. There is NO founder token-gate bypass — the bypass was dropped at
  // migration 20270221294989, so founders burn tokens like any paid tier in
  // unlock_vendor_event. Other caps unchanged.
  const caps =
    tierRowTyped?.is_founder === true
      ? { ...baseCaps, parentCategories: Infinity, servicesPerLeaf: Infinity }
      : baseCaps;

  // (0) Per-service daily capacity (#2) — the supplier's own number, inside the plan's bookings per date per card
  // (owner 2026-11-06; Free · Verified 1 each, like Solo).
  let daily_capacity: number | null;
  try {
    daily_capacity = parseDailyCapacityOrThrow(formData.get('daily_capacity'));
  } catch (e) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent((e as Error).message)}`,
    );
  }
  {
    const overPlan = await bookingsPerDatePlanRefusal(supabase, profile.vendor_profile_id, daily_capacity, null);
    if (overPlan) return redirect(`${await servicesReturnBase()}?error=${encodeURIComponent(overPlan)}`);
  }

  const { data: existingRows } = await supabase
    .from('vendor_services')
    .select('category')
    .eq('vendor_profile_id', profile.vendor_profile_id)
    // A "Copy to another branch" card is the same service at another location — it uses no card (owner 2026-11-14).
    .is('branch_copy_of', null);
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

  // 🃏 THE CARD CHECKS — FIX BEFORE CREATE (owner 2026-10-26). This older add form (a deep-linked `?add=`) writes a
  // card too, so it asks the same three as `commitVendorService` — no door skips them. lib/service-card-checks.server.ts
  {
    const refusal = await cardCheckRefusal({
      vendorProfileId: profile.vendor_profile_id,
      serviceId: null,
      category,
      categoryLabel: displayServiceLabel(category),
      title: title ?? '',
      inclusionLabels: inclusionRows.map((n) => n.label),
      addonLabels: [],
      cover: parsePrimaryPhoto(formData),
      showcase: showcase.showcase_photo_r2_keys,
    });
    if (refusal) return redirect(`${await servicesReturnBase()}?error=${encodeURIComponent(refusal)}`);
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
      includes_setnayan_gift,
      // New services are created as drafts (is_active: false) so the publish
      // gate (a starting price) is enforced only on the toggle action. The
      // Setnayan gift stopped being a publish requirement on 2026-09-09.
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
    // Priced add-ons (`addons-editor.tsx` rows) — the same replace-all the canvas save runs, only when the form carried
    // the editor. The claim door's Extras arrive this way (v2, owner 2026-11-13). Best-effort, like the lists above.
    if (formData.get('addons_present') === '1') {
      const addonErr = await replaceServiceAddons(supabase, created.vendor_service_id, profile.vendor_profile_id, parseAddonRows(formData));
      if (addonErr) console.warn('[createVendorService] the add-ons were not saved:', addonErr);
    }
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

  revalidateShopPage(profile.vendor_profile_id);
  revalidatePath('/vendor-dashboard/services');
  revalidatePath('/vendor-dashboard/shop');
  redirect(`${await servicesReturnBase()}?saved=1`);
}

/**
 * Vendor: tell us a service we don't list — the "Can't find yours? Tell us what you do" door
 * (spec 0023 §3.2c; owner rulings 2026-11-13). Lands as a PENDING row in
 * `taxonomy_category_requests` for an admin to decide (Add · Move · Keep · Not added). RLS gates
 * the insert to the vendor's own profile; the vendor tracks it on "Your requests".
 *
 * 2026-11-13 — the supplier now browses group → category FIRST and the request carries that
 * category (`tile_id`, a column the table has had since 2026-08-11 that this action never filled).
 * Until a decision, their cards sit under "<category> › Others" — a TAG on the card
 * (`vendor_services.category_request_id`), never a new taxonomy row.
 */
export async function proposeCategory(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  const label = String(formData.get('proposed_label') ?? '').trim();
  const note = String(formData.get('proposed_note') ?? '').trim().slice(0, 400) || null;
  // Set only when this submit came from the maker's plan-locked-kind link
  // (S3, owner 2026-08-28) — carries "Back to your card" through the redirect,
  // since a server action can't read the page's own URL for it.
  const fromLockedKind = formData.get('from_locked_kind') === '1' ? '&wantCategory=1' : '';
  // The category the supplier browsed to (a tier-2 `service_categories` id). Required: the owner's
  // "pick a category until they find where they want to be in" comes BEFORE the name.
  const tileId = String(formData.get('tile_id') ?? '').trim();
  const back = `${SERVICE_REQUEST_NEW_HREF}?tile=${encodeURIComponent(tileId)}`;
  if (label.length < 2 || label.length > 80) {
    return redirect(
      `${back}&error=${encodeURIComponent('Give it a name of 2–80 characters.')}${fromLockedKind}`,
    );
  }
  const tree = await loadRequestTree();
  // An unreadable tree does not refuse a supplier (the FK still guards a bad id); a READ tree that
  // does not hold the id does.
  if (!tileId || (tree !== null && !tree.categoryLabel.has(tileId))) {
    return redirect(
      `${SERVICE_REQUEST_NEW_HREF}?error=${encodeURIComponent('Pick the category it belongs in first.')}${fromLockedKind}`,
    );
  }

  // A name this shop already has WAITING is the same request, not a twin.
  {
    const { data: mine } = await supabase
      .from('taxonomy_category_requests')
      .select('request_id, proposed_label')
      .eq('proposed_by_vendor_id', profile.vendor_profile_id)
      .eq('status', 'pending');
    const twin = ((mine ?? []) as Array<{ request_id: string; proposed_label: string }>).find(
      (r) => sameNameKey(r.proposed_label) === sameNameKey(label),
    );
    if (twin) {
      return redirect(`${SERVICE_REQUESTS_HREF}/${twin.request_id}?already=1${fromLockedKind}`);
    }
  }

  const { data: created, error } = await supabase
    .from('taxonomy_category_requests')
    .insert({
      proposed_by_vendor_id: profile.vendor_profile_id,
      proposed_label: label,
      proposed_note: note,
      tile_id: tileId,
    })
    // RETURNING the id, because the draft below is keyed on an id THIS INSERT
    // produced. A drafter that accepted a request id from the form would let a
    // signed-in stranger attach a forged proposal to somebody else's request —
    // the rule is the call site, not the function.
    .select('request_id')
    .single();
  if (error) {
    return redirect(
      `${back}&error=${encodeURIComponent(error.message)}${fromLockedKind}`,
    );
  }

  // ── THE REQUEST IS READ BY THE AI FIRST (C4 2026-08-28 · owner 2026-11-13) ──
  // Draft the proposal for the admin queue: a cleaner name, the branch it may
  // belong under, and the near-matches we rejected with a reason each. SHIPS
  // DARK (`CATEGORY_PROPOSAL_DRAFT_ENABLED`, default OFF — the owner's to flip).
  //
  // ⛔ IT DRAFTS; IT NEVER MINTS. A person decides on Admin › Service requests.
  // 🔒 AND IT CANNOT COST THE SUPPLIER THEIR REQUEST — the insert above has
  // already happened, and `maybeDraftCategoryProposal` never throws: no key, no
  // network, a refusal or a slow model all leave a plain request in the queue,
  // exactly as before this existed.
  await maybeDraftCategoryProposal(created?.request_id ?? '', label, note);

  revalidatePath('/vendor-dashboard/services');
  revalidatePath('/vendor-dashboard/shop');
  revalidatePath(SERVICE_REQUESTS_HREF);

  // An EXISTING match (owner ruling 3): the supplier goes straight to that service's card maker.
  // The request stays in the queue with the AI's recommendation for admin to approve or decline —
  // the AI only recommends. With the flag off there is no draft and this is always null.
  const existing = await draftSaysExisting(created?.request_id ?? '', tree);
  if (existing) {
    return redirect(`/vendor-dashboard/services/new/${encodeURIComponent(existing)}?fromRequest=1${fromLockedKind}`);
  }
  redirect(`${SERVICE_REQUESTS_HREF}/${created?.request_id ?? ''}?requested=1${fromLockedKind}`);
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
  let includes_setnayan_gift: boolean;
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
    includes_setnayan_gift = parseSetnayanGift(formData);
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
      // See the create path: the retired free text is no longer submitted, so
      // checking it could only bounce a save on text this form cannot change.
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

  const branchPick = await resolveBranchId(
    supabase,
    profile.vendor_profile_id,
    formData.get('branch_id'),
    idRaw,
  );
  if (!branchPick.ok) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent(branchPick.message)}`,
    );
  }
  const branch_id = branchPick.branchId;

  // Per-service daily capacity (#2) — the supplier's own number, inside the plan's bookings per date per card
  // (owner 2026-11-06; an unchanged number above a lowered cap is grandfathered).
  let daily_capacity: number | null;
  try {
    daily_capacity = parseDailyCapacityOrThrow(formData.get('daily_capacity'));
  } catch (e) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent((e as Error).message)}`,
    );
  }
  {
    const overPlan = await bookingsPerDatePlanRefusal(supabase, profile.vendor_profile_id, daily_capacity, idRaw);
    if (overPlan) return redirect(`${await servicesReturnBase()}?error=${encodeURIComponent(overPlan)}`);
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

  // 🃏 THE CARD CHECKS — FIX BEFORE CREATE (owner 2026-10-26), on this older edit path too: its name and kind are the
  // stored ones (this form edits neither), its lines and photos the posted ones.
  {
    const { data: cardRow } = await supabase
      .from('vendor_services')
      .select('category, title')
      .eq('vendor_service_id', idRaw)
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    const stored = cardRow as { category?: string | null; title?: string | null } | null;
    if (stored?.category) {
      const refusal = await cardCheckRefusal({
        vendorProfileId: profile.vendor_profile_id,
        serviceId: idRaw,
        category: stored.category,
        categoryLabel: displayServiceLabel(stored.category),
        title: stored.title ?? '',
        inclusionLabels: inclusionRows.map((n) => n.label),
        addonLabels: [],
        cover: parsePrimaryPhoto(formData),
        showcase: showcase.showcase_photo_r2_keys,
      });
      if (refusal) return redirect(`${await servicesReturnBase()}?error=${encodeURIComponent(refusal)}`);
    }
  }

  // 🔑 `.select()` IS NOT DECORATION — it is how we learn whether anything was
  // written. A Supabase `.update()` that matches ZERO rows returns
  // `error: null`, so without asking for the changed rows back, "saved one
  // card" and "saved nothing at all" are the same value here, and the redirect
  // at the end of this function would say `?saved=1` for both. Both ways to
  // match nothing are live: a stale or wrong `vendor_service_id` in the form,
  // and an RLS USING clause that excludes the row (`vendor_services_manage`
  // resolves through `current_vendor_profile_ids()`, so losing a team
  // membership is enough). Either hands a supplier a green save and an
  // unchanged card.
  const { data: updatedRows, error } = await supabase
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
      includes_setnayan_gift,
      // One gift per card (migration a_card_carries_a_shop_gift): the Setnayan gift switched on here drops any shop pack.
      ...(includes_setnayan_gift ? { gift_pack_code: null } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('vendor_service_id', idRaw)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .select('vendor_service_id');

  if (error) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent(error.message)}`,
    );
  }
  // Matched nothing. Not an error to PostgREST, and a lie to the supplier if we
  // fall through to `?saved=1`. Say what is true: the card was not written.
  if (!updatedRows || updatedRows.length === 0) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent(SERVICE_UPDATE_MATCHED_NOTHING)}`,
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

  revalidateShopPage(profile.vendor_profile_id);
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

  revalidateShopPage(profile.vendor_profile_id);
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

  // Parse the parallel arrays — the SAME parser the maker's one save uses (`parsePaymentScheduleForm`, 2026-10-14),
  // no-show terms on the first payment included. Any malformed row aborts the whole save.
  let rows: Array<ParsedScheduleRow & { vendor_service_id: string; vendor_profile_id: string }>;
  try {
    rows = parsePaymentScheduleForm(formData).map((r) => ({
      ...r,
      vendor_service_id: serviceId,
      vendor_profile_id: profile.vendor_profile_id,
    }));
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
 * The name a card is saved under when its supplier left the box blank.
 *
 * 🔴 WHY THE SERVER DOES THIS AT ALL. Measured in production 2026-09-10: BOTH
 * live service cards carry `title IS NULL` while `is_active = true`, so a couple
 * reads the bare kind where the shop's name for that service should be. The
 * auto-namer already existed and is a CLIENT-SIDE effect in `canvas-maker.tsx`
 * gated on `initial === null` — it fires for a brand-new card and for nothing
 * else, so no edit, no copy and no seeded row has ever been named. Naming at the
 * WRITE covers every route that reaches this action instead of the ones somebody
 * remembered.
 *
 * ⛔ NOT A PUBLISH REQUIREMENT. Owner-locked 2026-07-27: *"saving builds blank
 * will make us autocreate a name"*. Refusing a publish for a missing title would
 * demand the one thing we promise to write. `PUBLISH_REQUIREMENTS` is untouched.
 *
 * 🔒 THE SHOP NAME PASSES THE SAME ANONYMITY TEST THE MARKETPLACE USES. A stored
 * title is rendered raw, with no anonymity filter downstream, so an unrevealed
 * shop's real `business_name` baked into it would be published AND frozen there.
 * When the name is hidden the card is named after its kind alone.
 *
 * ⚠ FAILS SOFT, ALWAYS. Every read here is wrapped: a taxonomy or profile read
 * that hiccups degrades the WORDING (humanised kind, no shop name) and never the
 * save. A naming helper must not be able to refuse a supplier's card — and the
 * database trigger names anything that still arrives blank.
 */
async function titleForCard(
  supabase: Awaited<ReturnType<typeof ensureProfile>>['supabase'],
  profile: Awaited<ReturnType<typeof ensureProfile>>['profile'],
  category: string,
  typed: string | null,
): Promise<string | null> {
  // The supplier's own words always win, and cost nothing to honour.
  if (typed !== null && typed.trim().length > 0) return typed.trim().slice(0, 80);

  const kindLabel = await cardKindLabeller()
    .then((label) => label(category))
    .catch(() => humanizeKind(category));

  let shopName: string | null = null;
  try {
    const { data } = await supabase
      .from('vendor_profiles')
      .select('name_revealed_at,verification_state')
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    const row = (data ?? null) as
      | { name_revealed_at: string | null; verification_state: string | null }
      | null;
    // No row read → treat the name as HIDDEN. The safe direction: a card named
    // after its kind is plain, a card that publishes a hidden name is a leak.
    if (
      row &&
      isVendorNameRevealed({
        name_revealed_at: row.name_revealed_at ?? null,
        is_verified: row.verification_state === 'verified',
        services: profile.services ?? [],
      })
    ) {
      shopName = profile.business_name?.trim() || null;
    }
  } catch {
    shopName = null;
  }

  return serviceCardTitleOrAuto(typed, { kindLabel, shopName });
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
 * `unmetPublishRequirements` (a cover photo, a starting price and what's
 * included — the gift left it 2026-09-09, the cover and inclusions joined it
 * 2026-09-11) — and re-enforced under it by the RPC and by the
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
  // THE MAKER ASKS TO BE RETURNED TO (supplier-easy step 3, 2026-10-14). A refusal used to land on My Shop with
  // the card's screen gone; the maker now names its own address (`return_to`), allowlisted to the card screens, so
  // the supplier reads the sentence ON the card — and a new card's typing is offered back from the device keep.
  const returnToRaw = formData.get('return_to');
  const returnTo =
    typeof returnToRaw === 'string' && /^\/vendor-dashboard\/services\/(new(\/[a-z0-9_]+)?|[0-9a-f-]{36})$/i.test(returnToRaw)
      ? returnToRaw
      : null;
  // ＋ OPENED FROM A QUOTE (owner 11 Nov 2026, the quote's "Make a new card" door): where the quote is — checked
  // (`quoteReturnPath`, only the two pages that draw the quote, never an open redirect). A refusal keeps it on the
  // maker's address; a new card's save returns there with the card (below).
  const quoteReturn = quoteReturnPath(formData.get(QUOTE_RETURN_FIELD));
  // ➕ MAKE N CARDS (ruling 5820): the services still to make after this one — checked (`parseCardQueue`), only on a
  // CREATE. A refusal keeps them on the card's address; a made card opens the next one's maker (below).
  const cardQueue = isCreate ? parseCardQueue(formData.get(CARD_QUEUE_FIELD)) : [];
  // 🏷 …and each queued service's own specialties, carried to its card (pre-ticked there, saved only with that card).
  const queuedSpecialties = parseCardSpecialties(formData.get(CARD_SPECIALTIES_FIELD), cardQueue);
  const back = async (msg: string) => {
    if (returnTo && !(isCreate && claimToken)) {
      const keepQuote = quoteReturn ? `&${QUOTE_RETURN_PARAM}=${encodeURIComponent(quoteReturn)}` : '';
      const keepSp = encodeCardSpecialties(queuedSpecialties, cardQueue);
      const keepQueue =
        cardQueue.length > 0
          ? `&${CARD_QUEUE_PARAM}=${cardQueue.join(',')}${keepSp ? `&${CARD_SPECIALTIES_PARAM}=${encodeURIComponent(keepSp)}` : ''}`
          : '';
      return redirect(`${returnTo}?error=${encodeURIComponent(msg)}${keepQuote}${keepQueue}`);
    }
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
  // Plan + bought Ultra add-ons (owner 2026-11-06), the same read as createVendorService.
  const baseCaps = await fetchCapsWithAddOns(supabase, profile.vendor_profile_id, tierRowTyped?.tier_state);
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
    const typedTitle =
      typeof titleRaw === 'string' && titleRaw.trim().length > 0
        ? titleRaw.trim().slice(0, 80)
        : null;
    // A blank box is NAMED here, not refused. See `titleForCard`.
    const title = await titleForCard(supabase, profile, category, typedTitle);
    const branchPick = await resolveBranchId(
      supabase,
      profile.vendor_profile_id,
      formData.get('branch_id'),
      serviceId,
    );
    if (!branchPick.ok) return back(branchPick.message);
    const branch_id = branchPick.branchId;

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
      daily_capacity: parseDailyCapacityOrThrow(formData.get('daily_capacity')),
      // ⛔ `exclusive_perk_text` IS DELIBERATELY ABSENT FROM THIS PAYLOAD.
      // `save_vendor_service` reads a missing key as "leave the stored value
      // alone" (migration 20271216515644) and a PRESENT key as set-or-clear.
      // Sending it here — even as null — would erase the promise on the two
      // live cards that still carry one, which is the exact thing the owner
      // ruled against: the field is retired as a CONTROL, not as DATA.
      includes_setnayan_gift: parseSetnayanGift(formData),
      primary_photo_r2_key: parsePrimaryPhoto(formData),
    };
  } catch (e) {
    return back((e as Error).message);
  }

  // ---- 🎁 THE GIFT ROW'S SHOP PACK (makers prototype 7 Nov 2026 § 3) ------
  //
  // The card's Gift dropdown is ONE answer: No gift · Setnayan gift · one of the shop's own packs. The Setnayan gift
  // stays where it always lived (`includes_setnayan_gift`, in `fields` above, through the RPC); a pack is
  // `vendor_services.gift_pack_code` (migration a_card_carries_a_shop_gift), written in its own owner-scoped UPDATE
  // around the RPC so `save_vendor_service` is not re-defined. Only a screen that DRAWS the row posts
  // `gift_pack_present` — every other writer leaves the stored pack alone (the same missing-key rule the RPC keeps).
  // `undefined` = leave alone · `null` = no pack · a code = that pack.
  let giftPackCode: string | null | undefined;
  if (formData.get('gift_pack_present') === '1') {
    const raw = formData.get('gift_pack_code');
    const code = typeof raw === 'string' && raw.length > 0 ? raw : null;
    const cols = giftColumns(code);
    if (code && (!cols || !shopGiftKindOf(code))) return back('That gift can’t be offered on a card.');
    // 🚧 Not offered yet (see `SHOP_PACK_GIFTS_DELIVER`): a pack would save and reach no quote or couple-facing card.
    if (code && !SHOP_PACK_GIFTS_DELIVER) return back('Your own gifts can’t be put on a card yet — pick No gift or the Setnayan gift.');
    if (code && fields.includes_setnayan_gift === true) {
      return back('A card gives one gift — pick the Setnayan gift or one of your own, not both.');
    }
    giftPackCode = code;
    // "Offered only while in stock" (DECISION_LOG 2026-11-04). The dropdown lists a short pack disabled; the save
    // asks the same ledger, but only of a pack this save ADDS — re-saving a card never strands the gift it already
    // shows. A stock the server cannot read does not block the save (it is an offer; the quote moves the stock).
    if (code) {
      const { data: had } = isCreate
        ? { data: null }
        : await supabase
            .from('vendor_services')
            .select('gift_pack_code')
            .eq('vendor_service_id', serviceId as string)
            .eq('vendor_profile_id', profile.vendor_profile_id)
            .maybeSingle();
      const before = (had as { gift_pack_code?: string | null } | null)?.gift_pack_code ?? null;
      if (before !== code) {
        const [packs, stock] = await Promise.all([
          // 🔒 The catalogue's gift price is withheld from a session (G6): the packs are read with the service role.
          fetchShopGiftPacks(createAdminClient()).catch(() => null),
          fetchShopGiftStock(supabase, profile.vendor_profile_id).catch(() => null),
        ]);
        const pack = packs?.find((p) => p.code === code) ?? null;
        const free = freeByKind(stock);
        if (packs && !pack) return back('That gift is not on sale right now — pick another.');
        if (pack && free && free[pack.kind] < pack.credits) {
          return back('Not enough of that gift in your stock — buy it first (Shop › Promote › Your gifts).');
        }
      }
    }
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
  //
  // ⚖ H2 (2026-09-11): a card GOING live also needs a cover photo and what's
  // included — the owner's "the cover-photo · title · inclusions requirements
  // stay". A card ALREADY live is held only to its price (`unmetForALiveCard`);
  // it is flagged for the rest, never refused. `save_vendor_service` and the
  // trigger draw the same line, in the same order, with the same sentences.
  // A card's bookings per date stays inside its plan (owner 2026-11-06) — the maker's save, same rule as the editor's.
  {
    const overPlan = await bookingsPerDatePlanRefusal(
      supabase,
      profile.vendor_profile_id,
      (fields.daily_capacity as number | null | undefined) ?? null,
      serviceId,
    );
    if (overPlan) return back(overPlan);
  }

  // 🔒 THE MAKER'S "Couples can see it" SWITCH TURNED OFF is the same go-offline as the list's switch — the same
  // open-bookings refusal (`offlineRefusal`), so an open booking cannot be turned off from either place.
  // Only a card that IS live is being turned off; saving an offline card as it is never asks.
  if (!isCreate && !publish && serviceId) {
    const { data: wasRow, error: wasError } = await supabase
      .from('vendor_services')
      .select('is_active')
      .eq('vendor_service_id', serviceId)
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .maybeSingle();
    if (wasError) {
      console.error('[supabase-error] services: read the card before turning it off', wasError);
      return back(BOOKINGS_UNREAD);
    }
    if ((wasRow as { is_active?: boolean | null } | null)?.is_active === true) {
      const stillOpen = await offlineRefusal(supabase, profile.vendor_profile_id, serviceId);
      if (stillOpen) return back(stillOpen);
    }
  }

  if (publish) {
    let alreadyLive = false;
    if (!isCreate) {
      const { data: liveRow, error: liveReadError } = await supabase
        .from('vendor_services')
        .select('is_active')
        .eq('vendor_service_id', serviceId)
        .eq('vendor_profile_id', profile.vendor_profile_id)
        .maybeSingle();
      // ⚠ A refused read is NOT "a draft": judging it as one would refuse a
      // live card for rules it is exempt from. Say we could not read it.
      if (liveReadError) {
        return back('We could not read this card just now, so it was not saved. Try again in a moment.');
      }
      alreadyLive = (liveRow as { is_active?: boolean | null } | null)?.is_active === true;
    }
    const facts = {
      hasPrice: priceIsSet(fields.starting_price_php as number | null),
      hasCover: coverIsSet(fields.primary_photo_r2_key as string | null),
      hasInclusions: inclusionsAreSet(inclusionRows.map((n) => n.label)),
    };
    const unmet = alreadyLive ? unmetForALiveCard(facts) : unmetPublishRequirements(facts);
    const firstUnmet = unmet[0];
    if (firstUnmet) return back(PUBLISH_REFUSAL_MESSAGE[firstUnmet]);
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

  // ---- 🃏 THE CARD CHECKS — FIX BEFORE CREATE (owner 2026-10-26) ----------
  //
  // *"when there is something they need to change, they must fix it before the service card is created"*. The maker
  // keeps Create / Save shut while a check is open; the save asks the SAME three again and refuses with the sentence
  // the row showed — claim words · the card matches its service · one photo = one service card. Nothing is created
  // and then held; there is no review queue. ⛔ No price check of any kind. lib/service-card-checks.server.ts
  {
    const refusal = await cardCheckRefusal({
      vendorProfileId: profile.vendor_profile_id,
      serviceId,
      category,
      categoryLabel: displayServiceLabel(category),
      title: (fields.title as string | null) ?? '',
      inclusionLabels: inclusionRows.map((n) => n.label),
      addonLabels: parseAddonRows(formData).map((a) => a.label),
      cover: (fields.primary_photo_r2_key as string | null) ?? null,
      showcase: showcase.showcase_photo_r2_keys,
    });
    if (refusal) return back(refusal);
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

  // (The cover-photo check that stood here — owner 2026-06-20, "the card needs
  // a photo" — moved INTO the shared publish gate above on 2026-09-11 (H2), so
  // the list's on/off switch and the database now ask it too. One rule, one
  // sentence: PUBLISH_REFUSAL_MESSAGE.cover.)

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
      .eq('vendor_profile_id', profile.vendor_profile_id)
      // A "Copy to another branch" card uses no card (owner 2026-11-14, SIMPLER SUPPLIER PLANS item 10).
      .is('branch_copy_of', null);
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

  // ---- Payment schedule rows — the SAME parser as setServicePaymentSchedule (2026-10-14) ----
  // The RPC replace-alls the schedule WITHOUT the no-show terms, so they are written onto the first payment after
  // it (`writeSchedulePolicy`, below) — never dropped.
  let scheduleRows: ParsedScheduleRow[];
  let newSlots: ReturnType<typeof parseNewSlotRows>;
  try {
    scheduleRows = parsePaymentScheduleForm(formData);
    newSlots = parseNewSlotRows(formData);
  } catch (e) {
    return back((e as Error).message);
  }
  const schedule = scheduleRows.map((r) => ({
    seq: r.seq,
    label: r.label,
    amount_kind: r.amount_kind,
    percent_bps: r.percent_bps,
    amount_centavos: r.amount_centavos,
    due_anchor: r.due_anchor,
    due_offset_days: r.due_offset_days,
  }));

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
  // Words only; a stored worth rides along unseen on an unchanged line (storedInclusionWorth — hide, don't delete).
  const keptWorth = isCreate
    ? new Map<string, number | null>()
    : await storedInclusionWorth(supabase, serviceId as string, profile.vendor_profile_id);
  const svcInclusions = inclusionRows.map((n, i) => ({
    label: n.label,
    worth_php: keptWorth.get(n.label.toLowerCase()) ?? null,
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
  // 🎁 A card moving OFF a pack drops it BEFORE the RPC: the one-gift CHECK refuses a row holding both, so turning the
  // Setnayan gift on over a stored pack must clear the pack first. Owner-scoped like every write here.
  if (!isCreate && giftPackCode === null) {
    const { error: clearErr } = await supabase
      .from('vendor_services')
      .update({ gift_pack_code: null })
      .eq('vendor_service_id', serviceId as string)
      .eq('vendor_profile_id', profile.vendor_profile_id);
    if (clearErr) return back('Your gift could not be changed just now — try again.');
  }
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

  // ---- THE PARTS THAT USED TO NEED THEIR OWN SAVE (supplier-easy step 3, 2026-10-14) ----
  // The maker shows every field of a card and saves it with ONE press (owner 2026-10-08 Q3). These are written
  // after the card row exists, each through the SAME body as its own per-part action, owner-scoped. A part that
  // fails is SAID on arrival — the card itself is saved, so it is never a bounce that invites a second card.
  const partProblems: string[] = [];
  const cardId = typeof savedId === 'string' && savedId.length > 0 ? savedId : null;
  if (cardId) {
    // 🎁 …and a card moving ONTO a pack writes it AFTER, once the RPC has set `includes_setnayan_gift` to false.
    if (typeof giftPackCode === 'string') {
      const { error: packErr } = await supabase
        .from('vendor_services')
        .update({ gift_pack_code: giftPackCode })
        .eq('vendor_service_id', cardId)
        .eq('vendor_profile_id', profile.vendor_profile_id);
      if (packErr) partProblems.push('its gift');
    }
    const policyErr = await writeSchedulePolicy(supabase, cardId, profile.vendor_profile_id, scheduleRows);
    if (policyErr) partProblems.push('the no-show terms on the first payment');
    if (formData.get('addons_present') === '1') {
      const addonErr = await replaceServiceAddons(supabase, cardId, profile.vendor_profile_id, parseAddonRows(formData));
      if (addonErr) partProblems.push('the add-ons');
    }
    if (formData.get('refinement_keys') !== null) {
      const refErr = await mergeServiceRefinements(supabase, profile.vendor_profile_id, category, formData);
      if (refErr) partProblems.push('the details');
    }
    const removedSlots = parseRemovedSlotIds(formData);
    if (removedSlots.length > 0) {
      for (const slotId of removedSlots) {
        const { error: slotErr } = await supabase
          .from('vendor_service_time_slots')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('slot_id', slotId)
          .eq('vendor_service_id', cardId)
          .eq('vendor_profile_id', profile.vendor_profile_id);
        if (slotErr) partProblems.push('a time slot you removed');
      }
    }
    if (newSlots.length > 0) {
      const { error: slotErr } = await supabase.from('vendor_service_time_slots').insert(
        newSlots.map((sl) => ({
          ...sl,
          vendor_profile_id: profile.vendor_profile_id,
          vendor_service_id: cardId,
        })),
      );
      if (slotErr) partProblems.push('the new time slots');
    }
    const scheduleChoice = parseScheduleChoice(formData.get('schedule_choice'));
    if (scheduleChoice !== '') {
      const schedErr = await assignCardSchedule(
        supabase,
        profile.vendor_profile_id,
        cardId,
        scheduleChoice,
        (fields.title as string | null) ?? displayServiceLabel(category),
      );
      if (schedErr) partProblems.push('its schedule');
    }
  }

  // ---- C3 — remember a search miss the supplier resolved themselves ----
  //
  // "When we do not have data yet, do not recommend. collect first." (owner,
  // 2026-08-28). The card is already saved by this line, and `category` is
  // already the ONE key that survived every validation above — CREATE ran
  // it through `parseCategory`/`isCoverageLeafKind` against the live
  // taxonomy, EDIT read it back off the existing row. `collected_kind_phrase`
  // is the ONE piece of this the browser is trusted to have supplied
  // honestly, and it is not trusted: re-derive whether `category` is a live
  // coverage TRADE (not Miscellaneous, not a legacy department pill) fresh,
  // server-side, from the same taxonomy the save just enforced — a tampered
  // hidden field cannot queue a pairing for a category that was never a real
  // trade. `recordCollectedTradePhrase` lands the row `reviewed_at IS NULL`
  // regardless — collecting is never the same act as serving.
  //
  // Fire-and-forget, after the response is on its way, same shape as the
  // repost-watch hash below: a supplier's save must never wait on, or fail
  // because of, this best-effort memory write.
  const collectedPhraseRaw = formData.get('collected_kind_phrase');
  if (typeof collectedPhraseRaw === 'string' && collectedPhraseRaw.trim().length > 0) {
    const collectLeaves = await currentLeafIndex();
    if (isCoverageLeafKind(category, collectLeaves)) {
      after(() => recordCollectedTradePhrase(collectedPhraseRaw, category));
    }
  }

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
  //
  // 🃏 ONE PHOTO = ONE SERVICE CARD (owner 2026-10-26): every hash names the card it is on (cover AND showcase — the
  // showcase used to go unhashed), and a photo this card dropped lets go of it, so it can go on another card.
  const primaryPhoto = fields.primary_photo_r2_key;
  const cardForHashes = typeof savedId === 'string' && savedId.length > 0 ? savedId : null;
  if (typeof primaryPhoto === 'string' && primaryPhoto.length > 0) {
    after(() =>
      hashAndScanVendorImages({
        vendorProfileId: profile.vendor_profile_id,
        refs: [primaryPhoto],
        surface: 'service_primary',
        vendorServiceId: cardForHashes,
      }),
    );
  }
  if (showcase.showcase_photo_r2_keys.length > 0) {
    after(() =>
      hashAndScanVendorImages({
        vendorProfileId: profile.vendor_profile_id,
        refs: showcase.showcase_photo_r2_keys,
        surface: 'service_showcase',
        vendorServiceId: cardForHashes,
      }),
    );
  }
  if (cardForHashes) {
    const keepRefs = [
      ...(typeof primaryPhoto === 'string' && primaryPhoto.length > 0 ? [primaryPhoto] : []),
      ...showcase.showcase_photo_r2_keys,
    ];
    after(() => releaseCardPhotos({ vendorProfileId: profile.vendor_profile_id, vendorServiceId: cardForHashes, keepRefs }));
  }

  revalidateShopPage(profile.vendor_profile_id);
  revalidatePath('/vendor-dashboard/services');
  revalidatePath('/vendor-dashboard/shop');
  // (savePackage revalidates /vendor-dashboard/packages itself on success.)

  // A LATE customization failure is reported as an ERROR even though the
  // service saved — "Services updated" and nothing else would let the vendor
  // believe their options went live. Checked BEFORE the claim redirect on
  // purpose: `/vendor-dashboard` renders no `?error=`, so routing the failure
  // there would swallow it. The couple registration above has already run, so
  // the only thing given up in this rare branch is the `claimed=1` banner.
  if (partProblems.length > 0 && !customizationError) {
    return redirect(
      `${await servicesReturnBase()}?error=${encodeURIComponent(
        `Your card was saved, but ${partProblems.join(', ')} could not be — open the card and try again.`,
      )}#service-${savedId ?? ''}`,
    );
  }
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
  // ＋ A NEW CARD MADE FROM A QUOTE goes back into that quote (prototype frame 6: "returns here with it picked") —
  // the quote reads `quote_card` and puts the card in as lines.
  const backToQuote = isCreate && typeof savedId === 'string' && quoteReturn ? quoteReturnWithCard(quoteReturn, savedId) : null;
  if (backToQuote) redirect(backToQuote);
  // ➕ MAKE N CARDS (ruling 5820): this card is made — the next queued service's maker opens, the rest behind it.
  const nextCard = isCreate && typeof savedId === 'string' ? cardMakerQueueHref(cardQueue, queuedSpecialties) : null;
  if (nextCard) redirect(nextCard);
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
 * 🔒 May this OWN card be turned off? `null` = yes. Else the sentence to show: its open bookings, each on its own line,
 * or "could not check" — a card is never turned off on an unread read. Shared by the list's switch and the Card
 * Maker's "Couples can see it" switch (`commitVendorService`), so the two can never disagree.
 */
async function offlineRefusal(
  supabase: Awaited<ReturnType<typeof ensureProfile>>['supabase'],
  vendorProfileId: string,
  serviceId: string,
): Promise<string | null> {
  const { data: own, error: ownError } = await supabase
    .from('vendor_services')
    .select('vendor_service_id')
    .eq('vendor_service_id', serviceId)
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (ownError) {
    console.error('[supabase-error] services: read the card before the open-bookings check', ownError);
    return BOOKINGS_UNREAD;
  }
  if (!own) return null; // not this shop's card — the update below matches nothing and says so
  const bookings = (await readCardBookings(createAdminClient(), [serviceId]))?.get(serviceId) ?? null;
  if (!bookings) return BOOKINGS_UNREAD;
  return openBookingsRefusal(bookings.open);
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
    const [{ data: svcRow, error: readError }, { data: incRows, error: incError }] =
      await Promise.all([
        supabase
          .from('vendor_services')
          .select('starting_price_php, primary_photo_r2_key, is_active')
          .eq('vendor_service_id', idRaw)
          .eq('vendor_profile_id', profile.vendor_profile_id)
          .maybeSingle(),
        supabase
          .from('vendor_service_inclusions')
          .select('label')
          .eq('vendor_service_id', idRaw)
          .eq('vendor_profile_id', profile.vendor_profile_id),
      ]);
    if (readError || !svcRow || incError) {
      return redirect(
        `${await servicesReturnBase()}?error=${encodeURIComponent(
          'We could not read this card just now, so it was not published. Try again in a moment.',
        )}`,
      );
    }
    const row = svcRow as {
      starting_price_php?: number | null;
      primary_photo_r2_key?: string | null;
      is_active?: boolean | null;
    };
    // H2 — turning a DRAFT on is going live: cover · price · what's included.
    // A card already on is held to its price only (flagged for the rest).
    const facts = {
      hasPrice: priceIsSet(row.starting_price_php),
      hasCover: coverIsSet(row.primary_photo_r2_key),
      hasInclusions: inclusionsAreSet(
        ((incRows ?? []) as { label?: string | null }[]).map((r) => r.label),
      ),
    };
    const unmet = row.is_active === true ? unmetForALiveCard(facts) : unmetPublishRequirements(facts);
    // 🃏 EVERY missing thing at once, never only the first (owner 10 Nov, "EDIT · SHARE · GO ONLINE": the card lacked
    // a cover AND what's included, and was refused for the photo alone). One missing → its own sentence, unchanged.
    const refusal = publishRefusalFor(unmet);
    if (refusal) {
      return redirect(`${await servicesReturnBase()}?error=${encodeURIComponent(refusal)}`);
    }
  }

  // 🔒 TURNING A CARD OFF WAITS FOR ITS OPEN BOOKINGS (owner 10 Nov on PR #7464: *"You cannot turn off a service card
  // until all booked completed."*). The refusal names each open booking on its own line; the switch stays Online.
  if (!is_active) {
    const stillOpen = await offlineRefusal(supabase, profile.vendor_profile_id, idRaw);
    if (stillOpen) return redirect(`${await servicesReturnBase()}?error=${encodeURIComponent(stillOpen)}`);
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

  revalidateShopPage(profile.vendor_profile_id);
  revalidatePath('/vendor-dashboard/services');
  revalidatePath('/vendor-dashboard/shop');
  redirect(`${await servicesReturnBase()}?saved=1`);
}

// ============================================================================
// Exact time slots — on EVERY plan (owner 2026-10-14, DECISION_LOG 🧑‍🤝‍🧑 call 3;
// were Enterprise-only, "tier feature #3").
//
// A service with >=1 ACTIVE slot uses the per-slot capacity model and SKIPS
// the #2 daily_capacity gate (finalizeVendor branches on slot presence).
// 🗑 The Enterprise check that lived here (`assertCanPlotSlots`, one
// `vendor_profiles` read per plot) is gone with the ruling — `canPlotTimeSlots`
// answers true for every plan, so the read could only ever cost a request.
// Ownership is still checked on every write below. Deleting (soft-deactivating)
// was never tier-gated.
// ============================================================================

export async function addServiceTimeSlot(formData: FormData) {
  const { supabase, profile } = await ensureProfile();

  try {
    const serviceId = String(formData.get('vendor_service_id') ?? '');
    // The one set of slot checks — shared with the maker's one save (lib/service-card-save-parts.ts).
    const slot = checkSlot({
      label: String(formData.get('slot_label') ?? ''),
      start: String(formData.get('start_time') ?? ''),
      end: String(formData.get('end_time') ?? ''),
      capRaw: String(formData.get('slot_capacity') ?? ''),
      orderRaw: String(formData.get('display_order') ?? ''),
    });

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
      ...slot,
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

  const r = await deleteOrRetireOwnService(supabase, profile, idRaw);
  if (!r.ok) return redirect(`${await servicesReturnBase()}?error=${encodeURIComponent(r.error)}`);
  redirect(`${await servicesReturnBase()}${r.retired ? '?retired=1' : '?saved=1'}`);
}

/**
 * 👈 THE SERVICES LIST'S SWIPE-LEFT DELETE (owner 10 Nov on PR #7464: *"swipe left to delete"*). The SAME delete as the
 * Card Maker's (`deleteOrRetireOwnService`: a card anyone ever picked is RETIRED — hidden — never deleted), answered
 * as a value instead of a redirect, because the list calls it from `deleteWithUndo` after the Undo window, with the
 * card already hidden in place. 🔒 app/vendor-dashboard/services/the-card-menu-row-is-edit-share-go-online.test.ts
 */
export async function removeVendorServiceFromList(
  vendorServiceId: string,
): Promise<{ ok: true; retired: boolean } | { ok: false; error: string }> {
  const { supabase, profile } = await ensureProfile();
  if (typeof vendorServiceId !== 'string' || vendorServiceId.length === 0) return { ok: false, error: 'Missing service id' };
  return deleteOrRetireOwnService(supabase, profile, vendorServiceId);
}

/** The one delete-or-retire, shared by the maker's Delete and the list's swipe. */
async function deleteOrRetireOwnService(
  supabase: Awaited<ReturnType<typeof ensureProfile>>['supabase'],
  profile: Awaited<ReturnType<typeof ensureProfile>>['profile'],
  idRaw: string,
): Promise<{ ok: true; retired: boolean } | { ok: false; error: string }> {
  // A couple's booked row points here via `event_vendors.service_id`, and that
  // FK is ON DELETE **SET NULL** — so a hard delete does not fail, it silently
  // erases which service the couple booked, including on a `contracted` row.
  // The same applies to `thread_service_interests` and `vendor_locked_qr_tokens`.
  //
  // So: a service anyone has ever picked is RETIRED (is_active = false), never
  // deleted. It vanishes from the vendor's public page exactly as before, and
  // the couple keeps the record of what they bought. Only a service nobody has
  // touched is deleted outright.
  /*
    🔴 THIS COUNT RAN ON THE SHOP'S OWN SESSION AND COULD ONLY EVER ANSWER ZERO.
    Measured against production 2026-08-28 as the shop's authenticated role, in a
    rolled-back transaction: `event_vendors` carries four policies — couple read,
    couple write, moderator read, moderator write — and NOT ONE admits a vendor,
    so a shop reads zero rows of a table holding 45. The guard the comment above
    describes therefore could not fire: every delete took the "nobody has touched
    it" branch, hard-deleted the service, and SET NULL'd `event_vendors.service_id`
    on any booking that pointed at it — erasing which service a couple bought,
    including on a `contracted` row.

    🔢 NOBODY HAS BEEN HARMED, and the arithmetic is why: production holds 45
    bookings and ZERO of them carry a `service_id` at all, so the true count is
    also zero today. The guard was inert, not wrong-answered — which is exactly
    the window in which to fix it.

    The admin client answers "has anyone picked this?", a yes/no about a service
    id the caller is proved to own on the very next statement. It reads one
    count and no rows.
  */
  //
  // 🔒 AND A CARD WITH AN OPEN BOOKING IS NOT DELETED AT ALL (owner 10 Nov on PR #7464: *"You cannot delete a service
  // card until all booked are complete."*). The SAME read answers both questions — who ever picked it, and which of
  // those bookings are still open (`readCardBookings`, lib/service-open-bookings.ts). Ownership is proved FIRST, on the
  // shop's own session, because the refusal names the couples' events.
  const { data: own, error: ownError } = await supabase
    .from('vendor_services')
    .select('vendor_service_id')
    .eq('vendor_service_id', idRaw)
    .eq('vendor_profile_id', profile.vendor_profile_id)
    .maybeSingle();
  if (ownError) {
    console.error('[supabase-error] services: read the card before removing it', ownError);
    return { ok: false, error: BOOKINGS_UNREAD };
  }
  if (!own) return { ok: false, error: 'This card is not in your shop.' };

  // ⚠ AN UNREADABLE READ MUST NOT MEAN "NOBODY BOOKED". It used to fail toward RETIRING (hiding) the card; with open
  // bookings now a refusal, an unread read refuses outright — the card is neither deleted nor hidden on no evidence.
  const bookings = (await readCardBookings(createAdminClient(), [idRaw]))?.get(idRaw) ?? null;
  if (!bookings) return { ok: false, error: BOOKINGS_UNREAD };
  const stillOpen = openBookingsRefusal(bookings.open);
  if (stillOpen) return { ok: false, error: stillOpen };

  if (bookings.picked > 0) {
    const { error: retireErr } = await supabase
      .from('vendor_services')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('vendor_service_id', idRaw)
      .eq('vendor_profile_id', profile.vendor_profile_id);

    if (retireErr) return { ok: false, error: retireErr.message };

    revalidateShopPage(profile.vendor_profile_id);
    revalidatePath('/vendor-dashboard/services');
    revalidatePath('/vendor-dashboard/shop');
    return { ok: true, retired: true };
  }

  const { error } = await supabase
    .from('vendor_services')
    .delete()
    .eq('vendor_service_id', idRaw)
    .eq('vendor_profile_id', profile.vendor_profile_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/vendor-dashboard/services');
  revalidatePath('/vendor-dashboard/shop');
  return { ok: true, retired: false };
}
