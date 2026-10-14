import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  SERVICE_GROUPS,
  VENDOR_CATEGORY_LABEL,
  groupDisplayOptions,
  isCanonicalService,
  type VendorCategory,
} from '@/lib/vendors';
import { primaryTileForVendorCategory } from '@/lib/vendor-category-taxonomy';
import {
  fetchVendorCoverages,
  getCoverageTaxonomy,
  resolveCoverageLabels,
  type CoverageParent,
} from '@/lib/vendor-coverages';
import { getVendorServableEventTypes } from '@/lib/event-types-db';
import { FAITH_REGISTRY } from '@/lib/faith-registry';
import { tierCaps, asVendorTier, isTierAtLeast } from '@/lib/vendor-tier-caps';
import { parentsOfKind, standingForCategory } from '@/lib/vendor-category-parents';
import { buildLeafIndex, cardKindLabel, humanizeKind, type LeafIndex } from '@/lib/service-card-kind';
import type { TradeMatch } from '@/lib/kind-search-trades';
import { reviewedAliasesByLiveTrade } from '@/lib/service-trade-aliases';
import { getReviewedTradeAliasRows } from '@/lib/service-trade-aliases-db';
import { getServiceMergeForwards } from '@/lib/service-merge-forward-db';
import {
  coverageAskFor,
  supplierTypeForShop,
  type SupplierType,
} from '@/lib/service-card-maker';
import { fetchVendorBranches, branchIsUsable } from '@/lib/vendor-branches';
import { createAdminClient } from '@/lib/supabase/admin';
import type { CategoryGroup, MakerEditing, MakerSchedule } from '@/app/vendor-dashboard/services/_components/canvas-maker';
import type { CanvasInitial } from '@/lib/canvas-initial';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { bracketsToDrafts, discountsToDrafts, inclusionsToDrafts } from '@/lib/vendor-service-drafts';
import type { VendorServiceDiscount, VendorServiceInclusion, VendorServicePriceBracket } from '@/lib/vendor-services';
import { rowToDraft, type PaymentScheduleItemRow } from '@/lib/vendor-service-payment-schedules';
import type { VendorServiceTimeSlot } from '@/lib/vendor-time-slots';
import type { AudienceOption } from '@/lib/canvas-audience-groups';
import { fetchCategoryChipRefinementsMany, type CategoryRefinements } from '@/lib/vendor-service-attributes';

/**
 * service-card-maker.server.ts — EVERYTHING THE SIMPLER MAKER READS, read once, for all three doors.
 *
 * `/services/new` (the kind is asked on the card) · `/services/new/[category]` (the kind came with the address: a
 * copy `?from=`, a couple's link `?claim=`) · `/services/[serviceId]` (an existing card — the edit sheet). Before
 * 2026-10-14 the first two pages each carried their own copy of these reads; one loader means one count of requests
 * and one place a refusal rule is asked.
 *
 * Every read fails SOFT to "less to choose from" — never to an empty maker nobody can finish, never to a refusal.
 *
 * REQUESTS (2026-10-14, counted from the code — re-count with `grep -n "from('" this file + the readers it calls):
 * the shared ones the old `/services/new` already made, LESS the coverage re-read `coverageParents()` made (the
 * families are derived from the coverages read here) and LESS `getTaxonomy()` (legacy kind labels come from the
 * coverage tree already read), PLUS the shop's schedules (pools + which kind books on which).
 */

export type MakerContext = {
  categoryOptions: CategoryGroup[];
  tradeOptions: TradeMatch[];
  coverageNames: string[];
  otherCategories: { value: string; label: string }[];
  coverages: { id: number; label: string }[];
  eventTypeOptions: AudienceOption[];
  faithOptions: AudienceOption[];
  coverageAudience: Record<number, { eventTypes: string[]; faiths: string[] }>;
  coverageAllowed: Record<number, string[] | null>;
  firstCardEver: boolean;
  supplierType: SupplierType;
  folderOfKind: Record<string, string>;
  coverageAsk: Record<string, { leaf: string; label: string }>;
  schedules: MakerSchedule[];
  scheduleOfKind: Record<string, string>;
  slotsPerDay: number;
  branches: { id: string; label: string; usable: boolean }[];
  leaves: LeafIndex;
  /** A covered kind the shop has exactly one of — the maker pre-picks it. */
  onlyKind: string | null;
  kindLabel: (kind: string) => string;
};

export async function loadMakerContext(
  supabase: SupabaseClient,
  vendorProfileId: string,
  opts: { fixedCategory?: string | null; withKindList?: boolean } = {},
): Promise<MakerContext> {
  const withKindList = opts.withKindList ?? true;

  const [ownRowsRes, tierRes, tree, vendorCoverages, eventTypes, poolsRes, poolCatsRes] = await Promise.all([
    supabase.from('vendor_services').select('category').eq('vendor_profile_id', vendorProfileId),
    supabase.from('vendor_profiles').select('tier_state, is_founder').eq('vendor_profile_id', vendorProfileId).maybeSingle(),
    getCoverageTaxonomy().catch(() => [] as CoverageParent[]),
    fetchVendorCoverages(supabase, vendorProfileId).catch(() => []),
    getVendorServableEventTypes().catch(() => []),
    supabase
      .from('vendor_schedule_pools')
      .select('pool_id, calendar_name, pool_label, daily_booking_capacity')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('is_active', true),
    supabase
      .from('vendor_schedule_pool_categories')
      .select('category_key, pool_id')
      .eq('vendor_profile_id', vendorProfileId),
  ]);
  const coverageLabels = await resolveCoverageLabels().catch(() => null);

  const ownCategories = ((ownRowsRes.data ?? []) as { category: string }[]).map((r) => r.category);
  const cardsByCategory: Record<string, number> = {};
  for (const c of ownCategories) cardsByCategory[c] = (cardsByCategory[c] ?? 0) + 1;

  const tierRow = tierRes.data as { tier_state?: string | null; is_founder?: boolean | null } | null;
  const baseCaps = tierCaps(asVendorTier(tierRow?.tier_state));
  // Founder override, identical to the save's (owner 2026-06-09).
  const caps =
    tierRow?.is_founder === true
      ? { ...baseCaps, parentCategories: Infinity, servicesPerLeaf: Infinity }
      : baseCaps;

  const leaves = buildLeafIndex(tree);
  // The families already claimed — cards ∪ coverages, the SAME union the save counts (coverageParents() reads the
  // coverages again; they are already here).
  const coveredLeafSet = new Set(vendorCoverages.map((c) => c.canonical_service));
  const existingParents = new Set<string>([
    ...ownCategories.flatMap((c) => parentsOfKind(c, leaves)),
    ...[...coveredLeafSet].map((l) => leaves.folder.get(l)).filter((f): f is string => Boolean(f)),
  ]);
  const standingOf = (key: string) =>
    standingForCategory(key, {
      existingParents,
      cardsByCategory,
      parentCategories: caps.parentCategories,
      servicesPerLeaf: caps.servicesPerLeaf,
      leaves,
    });

  // Legacy kind labels from the tree already read (tile → label) — `getTaxonomy()` is no longer a second read.
  const tileLabel = new Map<string, string>();
  for (const p of tree) for (const b of p.branches) tileLabel.set(b.tileId, b.label);
  const labelFor = (cat: VendorCategory): string => {
    const tile = primaryTileForVendorCategory(cat);
    return (tile ? tileLabel.get(tile) : undefined) ?? VENDOR_CATEGORY_LABEL[cat];
  };
  const kindLabel = (kind: string): string =>
    cardKindLabel(kind, leaves, isCanonicalService(kind) ? labelFor(kind as VendorCategory) : null);

  // ── The kind list: the shop's own words first (owner 2026-08-28 "yes their own words") ──
  const coverageKindOptions = vendorCoverages.map((c) => {
    const st = standingOf(c.canonical_service);
    return {
      value: c.canonical_service,
      label: coverageLabels ? coverageLabels.leafLabel(c.canonical_service) : humanizeKind(c.canonical_service),
      standing: st.standing === 'locked' ? ('locked' as const) : ('covered' as const),
      why: st.standing === 'locked' ? st.why : undefined,
    };
  });
  const leadWithOwnWords = coverageKindOptions.some((o) => o.standing === 'covered');
  const legacyGroups: CategoryGroup[] = withKindList
    ? SERVICE_GROUPS.map((group) => ({
        key: group.key,
        label: group.label,
        options: groupDisplayOptions(group.members, labelFor).map((opt) => {
          const st = standingOf(opt.primaryKey);
          return {
            value: opt.primaryKey,
            label: opt.label,
            // ⚠ RE-BANDED, NEVER REMOVED — a legacy kind in a family the shop's own words already lead moves to
            // "Something else" rather than competing with their word for it.
            standing: leadWithOwnWords && st.standing === 'covered' ? ('open' as const) : st.standing,
            why: st.standing === 'locked' ? st.why : undefined,
          };
        }),
      })).filter((g) => g.options.length > 0)
    : [];
  const categoryOptions: CategoryGroup[] = withKindList
    ? [
        ...(coverageKindOptions.length > 0
          ? [{ key: 'your-coverage', label: 'What you cover', options: coverageKindOptions }]
          : []),
        ...legacyGroups,
      ]
    : [];

  // ── Every live trade, for the search band (C1 2026-08-28) — reviewed aliases ride along (C2) ──
  let tradeOptions: TradeMatch[] = [];
  if (withKindList) {
    const liveTradeKeys = new Set<string>(
      tree.flatMap((p) => p.branches.flatMap((b) => b.leaves.map((l) => l.canonicalService))),
    );
    const [aliasRows, mergeForwards] = await Promise.all([
      getReviewedTradeAliasRows().catch(() => []),
      getServiceMergeForwards().catch(() => ({})),
    ]);
    const aliasesByLiveKey = reviewedAliasesByLiveTrade(aliasRows, mergeForwards, liveTradeKeys);
    tradeOptions = tree.flatMap((p) =>
      p.branches.flatMap((b) =>
        b.leaves.map((l) => {
          const st = standingOf(l.canonicalService);
          return {
            key: l.canonicalService,
            label: l.label,
            branch: b.label,
            standing: st.standing,
            why: st.standing === 'locked' ? st.why : undefined,
            aliases: aliasesByLiveKey.get(l.canonicalService),
          };
        }),
      ),
    );
  }

  // ── 🏷 which kinds would ask "Add <kind> to what you do?" — every kind the sheet can offer ──
  const coverageAsk: Record<string, { leaf: string; label: string }> = {};
  const askable = new Set<string>([
    ...categoryOptions.flatMap((g) => g.options.map((o) => o.value)),
    ...tradeOptions.map((t) => t.key),
    ...(opts.fixedCategory ? [opts.fixedCategory] : []),
  ]);
  for (const k of askable) {
    const a = coverageAskFor(k, leaves, coveredLeafSet);
    if (a) coverageAsk[k] = { leaf: a.leaf, label: coverageLabels ? coverageLabels.leafLabel(a.leaf) : a.label };
  }

  const folderOfKind: Record<string, string> = {};
  for (const [k, f] of leaves.folder) folderOfKind[k] = f;

  const supplierType = supplierTypeForShop([
    ...vendorCoverages.map((c) => ({ kind: c.canonical_service, folder: leaves.folder.get(c.canonical_service) ?? null })),
    ...ownCategories.map((c) => ({ kind: c, folder: leaves.folder.get(c) ?? null })),
  ]);

  // ── Schedules — the shop's active pools and which kind books on which (Schedule row) ──
  const pools = ((poolsRes.data ?? []) as {
    pool_id: string;
    calendar_name: string | null;
    pool_label: string | null;
    daily_booking_capacity: number | null;
  }[]).map((p) => ({
    id: p.pool_id,
    name: (p.calendar_name?.trim() || (p.pool_label ? kindLabel(p.pool_label) : '') || 'Main').slice(0, 60),
    perDay: p.daily_booking_capacity ?? null,
  }));
  const activePool = new Set(pools.map((p) => p.id));
  const scheduleOfKind: Record<string, string> = {};
  for (const r of (poolCatsRes.data ?? []) as { category_key: string; pool_id: string }[]) {
    if (activePool.has(r.pool_id)) scheduleOfKind[r.category_key] = r.pool_id;
  }

  // ── Branches (Enterprise) — only a paid, in-window branch may be chosen ──
  // A lapsed branch stays LISTED (not choosable) so a card filed under it keeps naming it — dropping it would
  // relabel that card "You" and the save would move it (owner 2026-08-28 "paid").
  const branches = isTierAtLeast(tierRow?.tier_state ?? null, 'enterprise')
    ? (await fetchVendorBranches(supabase, vendorProfileId, createAdminClient()).catch(() => []))
        .filter((b) => b.status !== 'cancelled')
        .map((b) => ({ id: b.branch_id, label: b.branch_label, usable: branchIsUsable(b.status) }))
    : [];

  // ── Audience (who it's for) ──
  const allowedByLeaf = new Map<string, string[] | null>();
  for (const p of tree) for (const b of p.branches) for (const l of b.leaves) allowedByLeaf.set(l.canonicalService, l.allowedEventTypes);
  const coverageAudience: Record<number, { eventTypes: string[]; faiths: string[] }> = {};
  const coverageAllowed: Record<number, string[] | null> = {};
  for (const c of vendorCoverages) {
    coverageAudience[c.id] = { eventTypes: c.event_types ?? [], faiths: c.faiths ?? [] };
    coverageAllowed[c.id] = allowedByLeaf.get(c.canonical_service) ?? null;
  }

  const coveredChoices = coverageKindOptions.filter((o) => o.standing === 'covered');

  return {
    categoryOptions,
    tradeOptions,
    coverageNames: vendorCoverages
      .map((c) => (coverageLabels ? coverageLabels.leafLabel(c.canonical_service) : c.canonical_service))
      .filter((n): n is string => typeof n === 'string' && n.length > 0),
    otherCategories: Array.from(new Set(ownCategories))
      .filter((c) => c !== opts.fixedCategory)
      .map((c) => ({ value: c, label: kindLabel(c) })),
    coverages: vendorCoverages.map((c) => ({
      id: c.id,
      label: coverageLabels ? coverageLabels.pathLabel(c.canonical_service) : c.canonical_service,
    })),
    eventTypeOptions: eventTypes.map((e) => ({ key: e.key, label: e.label })),
    faithOptions: FAITH_REGISTRY.map((f) => ({ key: f.faithCol, label: f.label })),
    coverageAudience,
    coverageAllowed,
    firstCardEver: ownCategories.length === 0,
    supplierType,
    folderOfKind,
    coverageAsk,
    schedules: pools,
    scheduleOfKind,
    slotsPerDay: caps.slotsPerDay,
    branches,
    leaves,
    onlyKind: coveredChoices.length === 1 ? (coveredChoices[0]?.value ?? null) : null,
    kindLabel,
  };
}

/**
 * The kind's chip details ("Details" fold) — its schema and the shop's saved values, two reads, made only when the
 * kind is known on the server (a fixed kind, a one-trade shop, an existing card). Fails soft to null (the fold then
 * points at the full details tool).
 */
export async function loadKindDetails(
  supabase: SupabaseClient,
  vendorProfileId: string,
  kind: string | null,
): Promise<{ refinements: CategoryRefinements; values: Record<string, unknown> } | null> {
  if (!kind) return null;
  try {
    const [schemas, payloadRes] = await Promise.all([
      fetchCategoryChipRefinementsMany(supabase, [kind]),
      supabase
        .from('vendor_service_attributes')
        .select('attribute_payload')
        .eq('vendor_profile_id', vendorProfileId)
        .eq('canonical_service', kind)
        .maybeSingle(),
    ]);
    const refinements = schemas.get(kind);
    if (!refinements) return null;
    return {
      refinements,
      values: ((payloadRes.data as { attribute_payload?: Record<string, unknown> | null } | null)?.attribute_payload ?? {}) as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

export type CardForEdit = {
  category: string;
  initial: CanvasInitial;
  editing: MakerEditing;
  /** Parts that could not be read. NON-EMPTY BLOCKS SAVE — the save replace-alls these lists, so saving over an
   *  unread (empty-looking) list would erase what the card really holds. Said on the card, never shown as "none". */
  unread: string[];
};

/**
 * AN EXISTING CARD, OPENED IN THE MAKER (the edit sheet). Every list the one save replaces is read HERE with its
 * error checked — the shared fetchers degrade a refused read to an empty list, which on a screen that saves the list
 * back would delete it. Owner-scoped on every read. `null` = no such card of this shop's.
 */
export async function loadCardForEdit(
  supabase: SupabaseClient,
  vendorProfileId: string,
  serviceId: string,
): Promise<CardForEdit | null> {
  if (!/^[0-9a-fA-F-]{36}$/.test(serviceId)) return null;
  const { data: row, error } = await supabase
    .from('vendor_services')
    .select(
      'vendor_service_id,category,title,pricing_basis,starting_price_php,base_pax,added_pax_price_php,per_pax_price_php,min_pax,hour_base_php,min_hours,extra_hour_php,crew_size,crew_meal_included,transport_included,transport_flat_fee_php,recommended_lead_time_months,last_minute_end_months,last_minute_surcharge_pct,includes_setnayan_gift,coverage_id,primary_photo_r2_key,showcase_video_r2_key,showcase_photo_r2_keys,is_active,daily_capacity,branch_id,exclusive_perk_text',
    )
    .eq('vendor_service_id', serviceId)
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  if (error || !row) return null;
  const c = row as Record<string, unknown> & {
    category: string;
    title: string | null;
    primary_photo_r2_key: string | null;
    showcase_video_r2_key: string | null;
    showcase_photo_r2_keys: string[] | null;
  };

  const [disc, inc, brk, links, sched, addons, slots, member] = await Promise.all([
    supabase
      .from('vendor_service_discounts')
      .select('vendor_service_id,discount_type,rate,unit,min_lead_months,expires_at,conditions_md,sort_order')
      .eq('vendor_service_id', serviceId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('vendor_service_inclusions')
      .select('vendor_service_id,label,worth_php,sort_order')
      .eq('vendor_service_id', serviceId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('vendor_service_price_brackets')
      .select('vendor_service_id,min_pax,max_pax,price_php,sort_order')
      .eq('vendor_service_id', serviceId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('vendor_service_links')
      .select('linked_canonical_service,display_order')
      .eq('vendor_service_id', serviceId)
      .eq('vendor_profile_id', vendorProfileId)
      .order('display_order', { ascending: true }),
    supabase
      .from('vendor_service_payment_schedules')
      .select('*')
      .eq('vendor_service_id', serviceId)
      .order('seq', { ascending: true }),
    supabase
      .from('vendor_service_addons')
      .select('label,from_price_php,sort_order')
      .eq('vendor_service_id', serviceId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('vendor_service_time_slots')
      .select('slot_id,vendor_service_id,slot_label,start_time,end_time,slot_capacity,display_order')
      .eq('vendor_service_id', serviceId)
      .eq('vendor_profile_id', vendorProfileId)
      .eq('is_active', true)
      .order('display_order', { ascending: true }),
    supabase
      .from('vendor_schedule_calendar_services')
      .select('pool_id')
      .eq('vendor_service_id', serviceId)
      .maybeSingle(),
  ]);
  const unread: string[] = [];
  if (disc.error) unread.push('discounts');
  if (inc.error) unread.push('what’s included');
  if (brk.error) unread.push('prices by guest count');
  if (links.error) unread.push('comes with');
  if (sched.error) unread.push('payment schedule');
  if (addons.error) unread.push('add-ons');
  if (slots.error) unread.push('time slots');

  const mediaRefs = [c.primary_photo_r2_key, c.showcase_video_r2_key, ...(c.showcase_photo_r2_keys ?? [])].filter(
    (k): k is string => typeof k === 'string' && k.length > 0,
  );
  const mediaDisplayUrls: Record<string, string> = {};
  await Promise.all(
    mediaRefs.map(async (ref) => {
      const url = await displayUrlForStoredAsset(ref).catch(() => null);
      if (url) mediaDisplayUrls[ref] = url;
    }),
  );

  const n = (v: unknown): number | null => (typeof v === 'number' ? v : v == null ? null : Number(v));
  const str = (v: unknown): string => (v == null ? '' : String(v));
  const initial: CanvasInitial = {
    sourceServiceId: serviceId,
    sourceTitle: c.title?.trim() || null,
    sourceWasOtherCategory: false,
    title: c.title?.trim() || '',
    includesSetnayanGift: c.includes_setnayan_gift === true,
    coverageId: str(c.coverage_id),
    crewSize: str(c.crew_size),
    recommendedLeadTimeMonths: str(c.recommended_lead_time_months),
    lastMinuteEndMonths: str(c.last_minute_end_months),
    lastMinuteSurchargePct: str(c.last_minute_surcharge_pct),
    pricing: {
      pricing_basis: (c.pricing_basis as 'fixed' | 'per_pax' | 'per_hour' | null) ?? 'fixed',
      starting_price_php: n(c.starting_price_php),
      base_pax: n(c.base_pax),
      added_pax_price_php: n(c.added_pax_price_php),
      per_pax_price_php: n(c.per_pax_price_php),
      min_pax: n(c.min_pax),
      hour_base_php: n(c.hour_base_php),
      min_hours: n(c.min_hours),
      extra_hour_php: n(c.extra_hour_php),
    },
    included: {
      crew_meal_included: c.crew_meal_included === true,
      transport_included: c.transport_included === true,
      transport_flat_fee_php: n(c.transport_flat_fee_php),
    },
    brackets: bracketsToDrafts((brk.data ?? []) as VendorServicePriceBracket[]),
    discounts: discountsToDrafts((disc.data ?? []) as VendorServiceDiscount[]),
    inclusions: inclusionsToDrafts((inc.data ?? []) as VendorServiceInclusion[]),
    linkedCategories: ((links.data ?? []) as { linked_canonical_service: string }[]).map((l) => l.linked_canonical_service),
    coverPhotoR2Key: c.primary_photo_r2_key ?? null,
    showcaseVideoR2Key: c.showcase_video_r2_key ?? null,
    showcasePhotoR2Keys: c.showcase_photo_r2_keys ?? [],
    mediaDisplayUrls,
    // Choices are create-only in the save; the edit sheet keeps them as they are and never re-posts them.
    customization: { status: 'none_linked' },
  };
  const editing: MakerEditing = {
    serviceId,
    isActive: c.is_active === true,
    coverUrl: c.primary_photo_r2_key ? (mediaDisplayUrls[c.primary_photo_r2_key] ?? null) : null,
    coverKey: c.primary_photo_r2_key ?? null,
    dailyCapacity: str(c.daily_capacity),
    branchId: str(c.branch_id),
    schedule: ((sched.data ?? []) as PaymentScheduleItemRow[]).map(rowToDraft),
    addons: ((addons.data ?? []) as { label: string; from_price_php: number | null }[]).map((a) => ({
      label: a.label,
      price: a.from_price_php != null ? String(a.from_price_php) : '',
    })),
    slots: (slots.data ?? []) as VendorServiceTimeSlot[],
    poolId: (member.data as { pool_id?: string | null } | null)?.pool_id ?? null,
    legacyPromise: typeof c.exclusive_perk_text === 'string' && c.exclusive_perk_text.trim() ? c.exclusive_perk_text.trim() : null,
  };
  return { category: c.category, initial, editing, unread };
}
