/**
 * load.ts — every database read "Categories & event types" makes, turned into
 * the shapes in `model.ts`. Server only (admin client).
 *
 * 🔑 A REFUSED READ IS SAID, NEVER SHOWN AS EMPTY. Each read that fails is
 * named in `failed`, and the page prints "couldn't load" beside the list or
 * count it feeds — a refused list rendered as "No requests" or "0 services"
 * is the defect this console has paid for again and again (the old Studio's
 * ReadFailed banner, carried over).
 */
import { createAdminClient } from '@/lib/supabase/admin';
import type { AttributeFieldDef } from '@/lib/marketplaces/schemas';
import { getTaxonomy } from '@/lib/taxonomy-db';
import type { TaxonomySnapshot } from '@/lib/taxonomy-db';
import { displayUrlForCatalogueArt } from '@/lib/uploads';
import { PROJECTABLE_LEAVES } from '@/lib/refinements-mutations';
import { fetchReligionReadiness } from '@/lib/religion-readiness';
import { FAITH_REGISTRY } from '@/lib/faith-registry';
import { getServiceMergeForwards } from '@/lib/service-merge-forward-db';
import { resolveMergedService } from '@/lib/service-merge-forward';
import { validateVendorCategoryMapping } from '@/lib/vendor-category-taxonomy';
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import { logQueryError } from '@/lib/supabase/error-detect';
import type {
  Category,
  Deadline,
  EventType,
  Group,
  RefinementCard,
  RefinementOption,
  Religion,
  RequestDraft,
  SearchWord,
  Service,
  SupplierRequest,
  VocabLabel,
} from './model';

type Admin = ReturnType<typeof createAdminClient>;

/** A sample-photo ref → a URL the admin's browser can show (or null). */
async function toDisplay(raw: string | null): Promise<string | null> {
  if (!raw) return null;
  if (raw.startsWith('r2://')) {
    try {
      return await displayUrlForCatalogueArt(raw);
    } catch {
      return null;
    }
  }
  return raw; // a /public path, used verbatim
}

function noteFailure(failed: string[], what: string, err: unknown) {
  if (!err) return;
  logQueryError(`CategoriesPage (${what})`, err as Parameters<typeof logQueryError>[1]);
  failed.push(what);
}

// ── Vocabularies (every list needs the labels) ──────────────────────────────

export type Vocab = {
  eventTypes: EventType[];
  religions: Religion[];
  eventLabels: VocabLabel[];
  failed: string[];
};

/** Lowercase ceremony_type for a Title-Case faith key — via the registry, NEVER by lowercasing. */
export function ceremonyTypeFor(faithKey: string): string | null {
  if (faithKey === 'Civil') return 'civil';
  return FAITH_REGISTRY.find((f) => f.faithCol === faithKey)?.key ?? null;
}

export async function loadVocab(admin: Admin, opts: { readiness: boolean }): Promise<Vocab> {
  const failed: string[] = [];
  const [etRes, faithRes, readiness] = await Promise.all([
    admin
      .from('event_type_vocab')
      .select('event_type, label_en, emoji, description, sort_order, status, enabled, onboarding_href, hero_photo_url')
      .order('sort_order', { ascending: true })
      .order('event_type', { ascending: true }),
    admin
      .from('faith_vocab')
      .select('faith_key, label_en, sort_order, status, is_civil, asked_on_event_types')
      .order('sort_order', { ascending: true })
      .order('faith_key', { ascending: true }),
    opts.readiness ? fetchReligionReadiness(admin) : Promise.resolve([]),
  ]);
  noteFailure(failed, 'event types', etRes.error);
  noteFailure(failed, 'religions', faithRes.error);

  const eventTypes: EventType[] = (
    (etRes.data ?? []) as Array<{
      event_type: string;
      label_en: string;
      emoji: string | null;
      description: string | null;
      sort_order: number;
      status: string;
      enabled: boolean | null;
      onboarding_href: string | null;
      hero_photo_url: string | null;
    }>
  ).map((r) => ({
    key: r.event_type,
    label: r.label_en,
    emoji: r.emoji ?? '🎉',
    description: r.description,
    sortOrder: r.sort_order,
    status: r.status,
    enabled: r.enabled === true,
    onboardingHref: r.onboarding_href,
    heroPhotoUrl: r.hero_photo_url,
  }));

  const readinessBy = new Map(readiness.map((r) => [r.ceremonyType, r]));
  const religions: Religion[] = (
    (faithRes.data ?? []) as Array<{
      faith_key: string;
      label_en: string;
      sort_order: number;
      status: string;
      is_civil: boolean | null;
      asked_on_event_types: string[] | null;
    }>
  ).map((f) => {
    const ceremonyType = ceremonyTypeFor(f.faith_key);
    const r = ceremonyType ? readinessBy.get(ceremonyType) : undefined;
    return {
      key: f.faith_key,
      label: f.label_en,
      status: f.status,
      isCivil: f.is_civil === true,
      sortOrder: f.sort_order,
      askedOn: f.asked_on_event_types ?? null,
      ceremonyType,
      launch: r
        ? {
            status: r.status,
            threshold: r.threshold,
            vendorCount: r.vendorCount,
            venueCount: r.venueCount,
            total: r.total,
            ready: r.ready,
          }
        : null,
    };
  });

  return {
    eventTypes,
    religions,
    eventLabels: eventTypes.filter((e) => e.status === 'active').map((e) => ({ key: e.key, label: e.label })),
    failed,
  };
}

// ── Supplier categories ─────────────────────────────────────────────────────

export type CategoriesData = {
  tax: TaxonomySnapshot;
  groups: Group[];
  categories: Category[];
  services: Service[];
  requests: SupplierRequest[];
  deadlines: Deadline[];
  /** Couple-side category keys that point at a category that no longer exists. */
  brokenCoupleLinks: number;
  failed: string[];
};

type SchemaRow = {
  canonical_service: string;
  display_name_en: string;
  display_name_tl: string | null;
  schema_version: number;
  shared_attribute_groups: string[] | null;
  category_specific_attributes: Record<string, AttributeFieldDef> | null;
};

/**
 * Everything the Supplier categories list and its panels need. Photos are
 * signed only for the categories and cards actually on screen (`openTileId`),
 * not for all eighty — a list row never shows a photo.
 */
export async function loadCategories(admin: Admin, openTileId: string | null): Promise<CategoriesData> {
  const failed: string[] = [];
  const [tax, schemasRes, extraRes, reqRes, deadlinesRes, aliasRes, leafCountRes] = await Promise.all([
    getTaxonomy(),
    admin
      .from('canonical_service_schemas')
      .select(
        'canonical_service, display_name_en, display_name_tl, schema_version, shared_attribute_groups, category_specific_attributes',
      )
      .order('canonical_service', { ascending: true }),
    admin.from('canonical_service_taxonomy').select('canonical_service, applicable_event_types, merged_into'),
    admin
      .from('taxonomy_category_requests')
      .select('request_id, proposed_label, proposed_note, status, mapped_to_canonical, proposed_by_vendor_id')
      .order('created_at', { ascending: false }),
    admin
      .from('planning_deadlines')
      .select('deadline_id, kind, ref_key, scope, label, offset_value, offset_unit, is_active')
      .order('kind', { ascending: true }),
    admin
      .from('canonical_service_aliases')
      .select('id, phrase, canonical_service, source, reviewed_at')
      .order('phrase', { ascending: true })
      .limit(2000),
    admin.from('onboarding_refinements').select('tile_id'),
  ]);
  if (tax.source === 'fallback') failed.push('the category tree');
  noteFailure(failed, 'services', schemasRes.error);
  noteFailure(failed, 'service scopes', extraRes.error);
  noteFailure(failed, 'supplier requests', reqRes.error);
  noteFailure(failed, 'deadlines', deadlinesRes.error);
  noteFailure(failed, 'search words', aliasRes.error);
  noteFailure(failed, 'what couples choose', leafCountRes.error);

  const extra = new Map(
    ((extraRes.data ?? []) as Array<{ canonical_service: string; applicable_event_types: string[] | null; merged_into: string | null }>).map(
      (r) => [r.canonical_service, r],
    ),
  );

  const wordsBy = new Map<string, SearchWord[]>();
  for (const a of (aliasRes.data ?? []) as Array<{
    id: number;
    phrase: string;
    canonical_service: string;
    source: string;
    reviewed_at: string | null;
  }>) {
    const list = wordsBy.get(a.canonical_service) ?? [];
    list.push({ id: a.id, phrase: a.phrase, live: a.reviewed_at != null, source: a.source });
    wordsBy.set(a.canonical_service, list);
  }

  const allRequests = (reqRes.data ?? []) as Array<{
    request_id: string;
    proposed_label: string;
    proposed_note: string | null;
    status: string;
    mapped_to_canonical: string | null;
    proposed_by_vendor_id: string;
  }>;
  const askedFor = new Map<string, number>();
  for (const r of allRequests) {
    if (r.status === 'mapped' && r.mapped_to_canonical) {
      askedFor.set(r.mapped_to_canonical, (askedFor.get(r.mapped_to_canonical) ?? 0) + 1);
    }
  }

  const services: Service[] = [];
  for (const s of (schemasRes.data ?? []) as SchemaRow[]) {
    // A combined service is a tombstone that only forwards old links.
    if (extra.get(s.canonical_service)?.merged_into) continue;
    const meta = tax.map[s.canonical_service] ?? null;
    const tileId = meta?.tile && tax.tileLabel[meta.tile] ? meta.tile : null;
    const attrs = (s.category_specific_attributes ?? {}) as Record<string, AttributeFieldDef>;
    services.push({
      canonical: s.canonical_service,
      en: s.display_name_en,
      tl: s.display_name_tl,
      tileId,
      faith: meta?.faith ?? null,
      ph: Boolean(meta?.ph),
      rental: Boolean(meta?.rental),
      tradition: Boolean(meta?.tradition),
      hidden: Boolean(meta?.marketplaceHidden),
      dietary: meta?.dietary ?? null,
      secondaryTiles: Array.isArray(meta?.secondary_tiles) ? [...meta.secondary_tiles] : [],
      eventTypes: extra.get(s.canonical_service)?.applicable_event_types ?? null,
      schemaVersion: s.schema_version ?? 1,
      sharedGroups: Array.isArray(s.shared_attribute_groups) ? s.shared_attribute_groups : [],
      fields: Object.entries(attrs).map(([key, def]) => {
        const d = def as AttributeFieldDef & { retired?: boolean; retired_options?: string[] };
        const retiredOptions = Array.isArray(d.retired_options) ? d.retired_options : [];
        return {
          key,
          type: d.type,
          label: d.label ?? key,
          retired: d.retired === true,
          options: Array.isArray(d.options)
            ? d.options.map((value) => ({ value, retired: retiredOptions.includes(value) }))
            : [],
        };
      }),
      words: wordsBy.get(s.canonical_service) ?? [],
      askedFor: askedFor.get(s.canonical_service) ?? 0,
    });
  }
  services.sort((a, b) => a.en.localeCompare(b.en));

  const serviceCount = new Map<string, number>();
  const faithCount = new Map<string, number>();
  for (const s of services) {
    if (!s.tileId) continue;
    serviceCount.set(s.tileId, (serviceCount.get(s.tileId) ?? 0) + 1);
    if (s.faith) faithCount.set(s.tileId, (faithCount.get(s.tileId) ?? 0) + 1);
  }
  const refinementCount = new Map<string, number>();
  for (const r of (leafCountRes.data ?? []) as Array<{ tile_id: string | null }>) {
    if (r.tile_id) refinementCount.set(r.tile_id, (refinementCount.get(r.tile_id) ?? 0) + 1);
  }

  const groups: Group[] = tax.folderOrder.map((id) => ({
    id,
    label: tax.folderLabel[id] ?? id,
    short: tax.folderShortLabel[id] ?? tax.folderLabel[id] ?? id,
    iconName: tax.categoryIcons[id] ?? null,
  }));

  const categories: Category[] = await Promise.all(
    tax.tileOrder.map(async (id, i) => {
      const photoRaw = tax.categoryPhotos[id] ?? null;
      return {
        id,
        groupId: tax.tileParent[id] ?? '',
        label: tax.tileLabel[id] ?? id,
        slug: tax.tileSlug[id] ?? id,
        iconName: tax.categoryIcons[id] ?? null,
        photoRaw,
        photoUrl: id === openTileId ? await toDisplay(photoRaw) : null,
        eventTypes: tax.tileEventTypes[id] ?? null,
        hidden: tax.hiddenCategories[id] === true,
        sortOrder: i,
        serviceCount: serviceCount.get(id) ?? 0,
        faithCount: faithCount.get(id) ?? 0,
        refinementCount: refinementCount.get(id) ?? 0,
      };
    }),
  );

  const requests = await loadRequests(admin, allRequests.filter((r) => r.status === 'pending'), services, categories, failed);

  const deadlines: Deadline[] = (
    (deadlinesRes.data ?? []) as Array<{
      deadline_id: string;
      kind: string;
      ref_key: string;
      scope: string;
      label: string | null;
      offset_value: number;
      offset_unit: string;
      is_active: boolean;
    }>
  ).map((d) => ({
    deadlineId: d.deadline_id,
    kind: d.kind,
    refKey: d.ref_key,
    scope: d.scope,
    label: d.label,
    offsetValue: d.offset_value,
    offsetUnit: d.offset_unit,
    isActive: d.is_active,
  }));

  return {
    tax,
    groups,
    categories,
    services,
    requests,
    deadlines,
    brokenCoupleLinks: validateVendorCategoryMapping(tax).length,
    failed,
  };
}

/**
 * Pending supplier requests, each with its drafted proposal when there is one.
 *
 * 🔒 THE DRAFT IS NEVER TRUSTED TO STILL NAME A LIVE SERVICE. Every key it
 * carries is resolved through the merge-forward map and dropped if it no longer
 * names a visible service; a retired category is never pre-selected. A
 * database without the drafts table (or any read error) yields no drafts and
 * every request renders as it did before drafts existed.
 */
async function loadRequests(
  admin: Admin,
  pending: Array<{ request_id: string; proposed_label: string; proposed_note: string | null; proposed_by_vendor_id: string }>,
  services: readonly Service[],
  categories: readonly Category[],
  failed: string[],
): Promise<SupplierRequest[]> {
  if (pending.length === 0) return [];
  const ids = pending.map((r) => r.request_id);
  const supplierIds = [...new Set(pending.map((r) => r.proposed_by_vendor_id))];
  const [draftRes, vpRes, forwards] = await Promise.all([
    admin
      .from('taxonomy_category_request_drafts')
      .select('request_id, suggested_label, suggested_tile_id, tile_reason, verdict, closest_existing, near_matches, drafted_by')
      .in('request_id', ids),
    admin.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', supplierIds),
    getServiceMergeForwards().catch(() => ({})),
  ]);
  noteFailure(failed, 'supplier names', vpRes.error);
  const supplierName = new Map(
    ((vpRes.data ?? []) as Array<{ vendor_profile_id: string; business_name: string | null }>).map((v) => [
      v.vendor_profile_id,
      v.business_name ?? 'a supplier',
    ]),
  );
  const liveLabel = new Map(services.map((s) => [s.canonical, s.en]));
  const tileLabel = new Map(categories.map((c) => [c.id, c.label]));
  const labelFor = (key: string): string | null => liveLabel.get(resolveMergedService(key, forwards)) ?? null;

  const drafts = new Map<string, RequestDraft>();
  for (const row of (draftRes.data ?? []) as Array<{
    request_id: string;
    suggested_label: string;
    suggested_tile_id: string | null;
    tile_reason: string | null;
    verdict: string;
    closest_existing: string | null;
    near_matches: unknown;
    drafted_by: string;
  }>) {
    const nearMatches: RequestDraft['nearMatches'] = [];
    for (const m of Array.isArray(row.near_matches) ? row.near_matches : []) {
      if (!m || typeof m !== 'object') continue;
      const key = String((m as Record<string, unknown>).canonical_service ?? '');
      const label = labelFor(key);
      if (!label) continue;
      nearMatches.push({
        canonical: resolveMergedService(key, forwards),
        label,
        whyNot: String((m as Record<string, unknown>).why_not ?? ''),
      });
    }
    const closest = row.closest_existing ? labelFor(row.closest_existing) : null;
    drafts.set(row.request_id, {
      suggestedLabel: row.suggested_label,
      suggestedTileId: row.suggested_tile_id && tileLabel.has(row.suggested_tile_id) ? row.suggested_tile_id : null,
      suggestedTileLabel: row.suggested_tile_id ? tileLabel.get(row.suggested_tile_id) ?? null : null,
      tileReason: row.tile_reason,
      verdict: row.verdict === 'existing' && closest ? 'existing' : 'new',
      closestExisting:
        closest && row.closest_existing
          ? { canonical: resolveMergedService(row.closest_existing, forwards), label: closest }
          : null,
      nearMatches,
      draftedBy: row.drafted_by,
    });
  }

  return pending.map((r) => ({
    requestId: r.request_id,
    proposedLabel: r.proposed_label,
    proposedNote: r.proposed_note,
    supplierName: supplierName.get(r.proposed_by_vendor_id) ?? 'a supplier',
    draft: drafts.get(r.request_id) ?? null,
  }));
}

/** The "what couples choose" cards anchored to ONE category, photos signed. */
export async function loadRefinementCards(
  admin: Admin,
  tileId: string,
): Promise<{ cards: RefinementCard[]; failed: boolean }> {
  const leafRes = await admin
    .from('onboarding_refinements')
    .select('leaf_key,label_en,description_en,main_photo,is_dynamic_ceremony,sort_order,status,tile_id')
    .eq('tile_id', tileId)
    .order('sort_order', { ascending: true });
  if (leafRes.error) {
    logQueryError('CategoriesPage (what couples choose)', leafRes.error);
    return { cards: [], failed: true };
  }
  const leaves = (leafRes.data ?? []) as Array<{
    leaf_key: string;
    label_en: string;
    description_en: string | null;
    main_photo: string | null;
    is_dynamic_ceremony: boolean | null;
    sort_order: number;
    status: string;
  }>;
  if (leaves.length === 0) return { cards: [], failed: false };
  const optRes = await admin
    .from('onboarding_refinement_options')
    .select('leaf_key,option_key,emoji,label_en,photo,sort_order,status')
    .in(
      'leaf_key',
      leaves.map((l) => l.leaf_key),
    )
    .order('sort_order', { ascending: true });
  if (optRes.error) {
    logQueryError('CategoriesPage (what couples choose · options)', optRes.error);
    return { cards: [], failed: true };
  }
  const opts = (optRes.data ?? []) as Array<{
    leaf_key: string;
    option_key: string;
    emoji: string | null;
    label_en: string;
    photo: string | null;
    sort_order: number;
    status: string;
  }>;
  const refs = new Set<string>();
  for (const l of leaves) if (l.main_photo) refs.add(l.main_photo);
  for (const o of opts) if (o.photo) refs.add(o.photo);
  const urlBy = new Map(await Promise.all([...refs].map(async (r) => [r, await toDisplay(r)] as const)));
  const byLeaf = new Map<string, RefinementOption[]>();
  for (const o of opts) {
    const list = byLeaf.get(o.leaf_key) ?? [];
    list.push({
      optionKey: o.option_key,
      emoji: o.emoji ?? '',
      label: o.label_en,
      status: o.status,
      photoRaw: o.photo,
      photoUrl: o.photo ? urlBy.get(o.photo) ?? null : null,
    });
    byLeaf.set(o.leaf_key, list);
  }
  return {
    failed: false,
    cards: leaves.map((l) => ({
      leafKey: l.leaf_key,
      label: l.label_en,
      description: l.description_en ?? '',
      status: l.status,
      dynamic: l.is_dynamic_ceremony === true,
      isProjectable: PROJECTABLE_LEAVES.has(l.leaf_key),
      mainPhotoRaw: l.main_photo,
      mainPhotoUrl: l.main_photo ? urlBy.get(l.main_photo) ?? null : null,
      options: byLeaf.get(l.leaf_key) ?? [],
    })),
  };
}

/** The tile the paperwork plan group lands on — where document deadlines live. */
export function paperworkTileId(): string | null {
  return PLAN_GROUPS.find((g) => g.id === 'wedding_paperwork')?.catalogTile ?? null;
}

// ── Religions ───────────────────────────────────────────────────────────────

export type TraditionRow = {
  item_id: string;
  ceremony_type: string;
  dimension: string;
  label: string;
  note: string;
  sort_order: number;
  is_active: boolean;
};

export type ReligionsData = {
  /** Every live service with its faith tag and category name. */
  services: Array<{ canonical: string; en: string; faith: string | null; dietary: string | null; tileLabel: string }>;
  traditions: TraditionRow[];
  failed: string[];
};

export async function loadReligions(admin: Admin): Promise<ReligionsData> {
  const failed: string[] = [];
  const [tax, schemasRes, mergedRes, tradRes] = await Promise.all([
    getTaxonomy(),
    admin.from('canonical_service_schemas').select('canonical_service, display_name_en'),
    admin.from('canonical_service_taxonomy').select('canonical_service').not('merged_into', 'is', null),
    admin
      .from('wedding_tradition_items')
      .select('item_id, ceremony_type, dimension, label, note, sort_order, is_active')
      .order('ceremony_type', { ascending: true })
      .order('sort_order', { ascending: true }),
  ]);
  if (tax.source === 'fallback') failed.push('the category tree');
  noteFailure(failed, 'services', schemasRes.error);
  noteFailure(failed, 'what to expect', tradRes.error);
  const merged = new Set(((mergedRes.data ?? []) as Array<{ canonical_service: string }>).map((r) => r.canonical_service));
  const services = ((schemasRes.data ?? []) as Array<{ canonical_service: string; display_name_en: string }>)
    .filter((s) => !merged.has(s.canonical_service))
    .map((s) => {
      const meta = tax.map[s.canonical_service] ?? null;
      return {
        canonical: s.canonical_service,
        en: s.display_name_en,
        faith: meta?.faith ?? null,
        dietary: meta?.dietary ?? null,
        tileLabel: meta?.tile ? tax.tileLabel[meta.tile] ?? meta.tile : '—',
      };
    })
    .sort((a, b) => a.en.localeCompare(b.en));
  return { services, traditions: (tradRes.data ?? []) as TraditionRow[], failed };
}
