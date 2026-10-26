/**
 * taxonomy-writes.ts — every write the four-level Categories page makes, as plain functions over an
 * admin (service-role) client. 🌳 ③b of the taxonomy build (owner 2026-10-26, DECISION_LOG "APPROVED —
 * BUILD THE TAXONOMY"; corpus prototypes/admin_taxonomy_four_levels_2026-10-26/interactive-v4.html +
 * PLAN.md § 7.2–7.3, § 7.8).
 *
 * WHY A MODULE OF CORES, NOT MORE CODE IN `actions.ts`. The page writes from two kinds of door: the
 * shipped forms (which redirect back, `actions.ts`) and the map's in-place rows and pickers (which
 * answer in JSON, `four-level-actions.ts`). Both doors call the SAME core here, so "add a category" is
 * one rule whichever door the admin used — `createTaxonomyNode`, `createCanonicalLeaf` and
 * `remapCanonical` were refactored onto these cores rather than copied. And because a core takes the
 * client as an argument, `tests/db/the-four-levels-write-through.db.test.ts` runs the REAL function
 * against the replayed schema (through `tests/db/supabase-over-pglite.ts`) instead of re-stating it.
 *
 * Every core: validates against the LIVE tables (never a list in code), writes, records one
 * `admin_audit_log` row, and returns `{ ok, message }` or `{ ok:false, error }` — never throws for a
 * refusal. The caller gates admin and revalidates.
 *
 * ⚠ Only the call shapes `supabase-over-pglite.ts` models are used here (select/eq/in/is/order/limit/
 * maybeSingle, single-row insert/update/delete). A new shape needs the adapter extended, or the db test
 * stops being a test of this file.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { validateReorder, computeReorder } from '@/lib/taxonomy-studio-order';
import { VENDOR_CATEGORIES } from '@/lib/vendors';

// The service-role client is untyped in this repo (`createAdminClient()`), and the test adapter is
// supabase-js-SHAPED, not supabase-js — so the cores take the loose shape both satisfy.
export type AdminDb = SupabaseClient;

export type WriteResult = { ok: true; message: string; id?: string; previous?: string } | { ok: false; error: string };

const now = () => new Date().toISOString();

/** A label → a stable key (`_` for an id, `-` for a slug). The one copy the page's writes share. */
export function slugify(label: string, sep: '_' | '-'): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, sep)
    .replace(new RegExp(`^\\${sep}+|\\${sep}+$`, 'g'), '');
}

/** A part's key: lower-case words, starts with a letter, 2–40 chars (the `inspiration_parts_slot_key_shape` CHECK). */
export function partKeyFromName(label: string): string {
  let k = slugify(label, '_').slice(0, 40).replace(/_+$/g, '');
  if (!/^[a-z]/.test(k)) k = `p_${k}`.slice(0, 40);
  return k;
}

async function audit(
  admin: AdminDb,
  row: { action: string; target_table: string; target_id: string; before_json?: unknown; after_json?: unknown; actor_user_id: string },
): Promise<void> {
  // Best effort, like every shipped taxonomy write: a refused audit insert never undoes the edit.
  // supabase-error-ignored: the audit row is a record of an edit that already succeeded — refusing it must not undo or fail the edit
  await admin.from('admin_audit_log').insert(row);
}

function cleanLabel(raw: string, min = 2, max = 80): string | null {
  const label = String(raw ?? '').trim();
  return label.length >= min && label.length <= max ? label : null;
}

// ── Group (tier 1) ────────────────────────────────────────────────────────────

/**
 * "＋ Add a group" — a new tier-1 row, last in the order. 🔑 BORN HIDDEN FROM COUPLES (controller call
 * recorded in DECISION_LOG "APPROVED — BUILD THE TAXONOMY": "a new empty group is hidden from couples
 * until it holds a category"); `addCategoryCore` shows it again when its first category lands.
 */
export async function addGroupCore(admin: AdminDb, actorId: string, rawLabel: string): Promise<WriteResult> {
  const label = cleanLabel(rawLabel);
  if (!label) return { ok: false, error: 'A name needs 2–80 characters.' };
  const id = slugify(label, '_');
  const slug = slugify(label, '-');
  if (!id || !slug) return { ok: false, error: 'A name needs letters or numbers.' };
  const { data: existing } = await admin.from('service_categories').select('id').eq('id', id).maybeSingle();
  if (existing) return { ok: false, error: `“${label}” is already a name we use — pick another.` };
  const { data: last } = await admin
    .from('service_categories')
    .select('sort_order')
    .eq('tier', 1)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = {
    id,
    parent_id: null,
    tier: 1,
    kind: 'branch',
    label_en: label,
    slug,
    sort_order: (((last as { sort_order?: number } | null)?.sort_order ?? -1) as number) + 1,
    scope: 'global',
    marketplace_hidden: true,
    status: 'active',
  };
  const { error } = await admin.from('service_categories').insert(row);
  if (error) return { ok: false, error: error.message };
  await audit(admin, { action: 'taxonomy.create_group', target_table: 'service_categories', target_id: id, after_json: row, actor_user_id: actorId });
  return { ok: true, id, message: `Added “${label}” — hidden from couples until it holds a category.` };
}

// ── Category (tier 2) ─────────────────────────────────────────────────────────

/**
 * A new category, last in its group — the core behind the shipped `createTaxonomyNode` form AND the
 * map's "＋ Add a category" row. `coarse_category` is left to the database: the BEFORE INSERT trigger
 * `service_categories_inherit_coarse_category` (③0-c part 2) files its shops like its siblings.
 */
export async function addCategoryCore(admin: AdminDb, actorId: string, parentId: string, rawLabel: string): Promise<WriteResult> {
  const label = cleanLabel(rawLabel);
  if (!label) return { ok: false, error: 'Label must be 2–80 characters.' };
  const id = slugify(label, '_');
  const slug = slugify(label, '-');
  if (!id || !slug) return { ok: false, error: 'Label needs letters or numbers.' };
  const { data: parent } = await admin
    .from('service_categories')
    .select('id, tier, marketplace_hidden')
    .eq('id', parentId)
    .maybeSingle();
  const p = parent as { id: string; tier: number; marketplace_hidden: boolean | null } | null;
  if (!p || p.tier !== 1) return { ok: false, error: 'Pick a valid group.' };
  const { data: existing } = await admin.from('service_categories').select('id').eq('id', id).maybeSingle();
  if (existing) return { ok: false, error: `A node "${id}" already exists — pick a different label.` };
  const { data: siblings } = await admin.from('service_categories').select('id, sort_order').eq('parent_id', parentId);
  const sibs = (siblings ?? []) as Array<{ id: string; sort_order: number }>;
  const nextSort = sibs.reduce((m, s) => Math.max(m, s.sort_order ?? 0), -1) + 1;
  const row = {
    id,
    parent_id: parentId,
    tier: 2,
    kind: 'leaf',
    label_en: label,
    slug,
    sort_order: nextSort,
    scope: 'global',
    marketplace_hidden: false,
    status: 'active',
  };
  const { data: inserted, error } = await admin.from('service_categories').insert(row).select('coarse_category').maybeSingle();
  if (error) return { ok: false, error: error.message };
  // The group was the new-and-empty kind ("hidden until it holds a category"): its first category shows it.
  let shownGroup = false;
  if (p.marketplace_hidden && sibs.length === 0) {
    const { error: showErr } = await admin
      .from('service_categories')
      .update({ marketplace_hidden: false, updated_at: now() })
      .eq('id', parentId);
    shownGroup = !showErr;
  }
  await audit(admin, {
    action: 'taxonomy.create',
    target_table: 'service_categories',
    target_id: id,
    after_json: {
      ...row,
      coarse_category: (inserted as { coarse_category: string | null } | null)?.coarse_category ?? null,
      shown_group: shownGroup ? parentId : null,
    },
    actor_user_id: actorId,
  });
  return { ok: true, id, message: `Added category "${label}".${shownGroup ? ' Its group now shows to couples.' : ''}` };
}

/**
 * "Files shops as ▾" — the coarse category a category's shops are filed under (③0-c: the column
 * `service_categories.coarse_category`; NULL = misc). An explicit admin pick overrides what the
 * insert trigger inherited. Validated against the app's `VendorCategory` list.
 */
export async function setCoarseCategoryCore(admin: AdminDb, actorId: string, categoryId: string, raw: string): Promise<WriteResult> {
  const value = String(raw ?? '').trim();
  const next = value === '' ? null : value;
  if (next !== null && !(VENDOR_CATEGORIES as readonly string[]).includes(next)) return { ok: false, error: `Unknown filing “${next}”.` };
  const { data: before } = await admin.from('service_categories').select('id, tier, coarse_category').eq('id', categoryId).maybeSingle();
  const b = before as { id: string; tier: number; coarse_category: string | null } | null;
  if (!b || b.tier !== 2) return { ok: false, error: 'Category not found.' };
  if ((b.coarse_category ?? null) === next) return { ok: true, message: 'No change.' };
  const { error } = await admin.from('service_categories').update({ coarse_category: next, updated_at: now() }).eq('id', categoryId);
  if (error) return { ok: false, error: error.message };
  await audit(admin, {
    action: 'taxonomy.set_coarse_category',
    target_table: 'service_categories',
    target_id: categoryId,
    before_json: { coarse_category: b.coarse_category },
    after_json: { coarse_category: next },
    actor_user_id: actorId,
  });
  return { ok: true, message: next ? 'Saved — new shops here are filed under that.' : 'Cleared — shops here are filed under “Other”.', previous: b.coarse_category ?? '' };
}

/** Order ▾ on a GROUP — the tier-1 rows, a permutation only (the shipped `validateReorder`). */
export async function reorderGroupsCore(admin: AdminDb, actorId: string, orderedIds: readonly string[]): Promise<WriteResult> {
  const ordered = orderedIds.map((s) => String(s).trim()).filter(Boolean);
  const { data } = await admin.from('service_categories').select('id, sort_order').eq('tier', 1);
  const rows = (data ?? []) as Array<{ id: string; sort_order: number }>;
  const valid = validateReorder(rows.map((r) => r.id), ordered);
  if (!valid.ok) return { ok: false, error: valid.reason };
  const writes = computeReorder(ordered, Object.fromEntries(rows.map((r) => [r.id, r.sort_order])));
  for (const w of writes) {
    const { error } = await admin.from('service_categories').update({ sort_order: w.sort_order, updated_at: now() }).eq('id', w.id);
    if (error) return { ok: false, error: error.message };
  }
  if (writes.length) {
    await audit(admin, { action: 'taxonomy.reorder_groups', target_table: 'service_categories', target_id: 'tier1', after_json: { order: ordered }, actor_user_id: actorId });
  }
  return { ok: true, message: writes.length ? 'Order saved.' : 'Order unchanged.' };
}

// ── Service ───────────────────────────────────────────────────────────────────

export type NewServiceInput = {
  tileId: string;
  label: string;
  faith?: string;
  isPh?: boolean;
  isRental?: boolean;
  isTradition?: boolean;
  refinementLabel?: string;
  refinementOptions?: string;
};

/**
 * A brand-new service under a category — the core behind the shipped `createCanonicalLeaf` form AND the
 * map's "＋ Add a service" row. Two tables (schema first, then placement; the schema is rolled back if
 * the placement fails), exactly as the form always did.
 */
export async function addServiceCore(admin: AdminDb, actorId: string, input: NewServiceInput): Promise<WriteResult> {
  const label = cleanLabel(input.label);
  if (!label) return { ok: false, error: 'Service name must be 2–80 characters.' };
  const canonical = slugify(label, '_');
  if (!canonical) return { ok: false, error: 'Name needs letters or numbers.' };

  let faith: string | null = null;
  const faithRaw = String(input.faith ?? '').trim();
  if (faithRaw) {
    const { data: vocabRow } = await admin.from('faith_vocab').select('faith_key').eq('faith_key', faithRaw).eq('status', 'active').maybeSingle();
    if (!vocabRow) return { ok: false, error: `Unknown faith "${faithRaw}".` };
    faith = faithRaw;
  }

  const { data: tile } = await admin.from('service_categories').select('id, parent_id, tier, label_en').eq('id', input.tileId).maybeSingle();
  const t = tile as { id: string; parent_id: string | null; tier: number; label_en: string | null } | null;
  if (!t || t.tier !== 2 || !t.parent_id) return { ok: false, error: 'Pick a valid category.' };

  const [schemaDupe, taxDupe] = await Promise.all([
    admin.from('canonical_service_schemas').select('canonical_service').eq('canonical_service', canonical).maybeSingle(),
    admin.from('canonical_service_taxonomy').select('canonical_service').eq('canonical_service', canonical).maybeSingle(),
  ]);
  if (schemaDupe.data || taxDupe.data) return { ok: false, error: `A service "${canonical}" already exists — pick a different name.` };

  const categoryAttrs: Record<string, unknown> = {};
  const refinementLabel = String(input.refinementLabel ?? '').trim();
  const refinementOptionsRaw = String(input.refinementOptions ?? '').trim();
  if (refinementLabel && refinementOptionsRaw) {
    const fieldKey = slugify(refinementLabel, '_');
    const options = refinementOptionsRaw
      .split(',')
      .map((o) => slugify(o, '_'))
      .filter(Boolean);
    if (fieldKey && options.length > 0) categoryAttrs[fieldKey] = { type: 'multi_select', label: refinementLabel, options };
  }

  const { error: schemaErr } = await admin.from('canonical_service_schemas').insert({
    canonical_service: canonical,
    schema_version: 1,
    display_name_en: label,
    shared_attribute_groups: [],
    category_specific_attributes: categoryAttrs,
    filter_facets: [],
    required_for_visibility: {},
    ranking_signal_weights: {},
  });
  if (schemaErr) return { ok: false, error: schemaErr.message };

  // A new service lands LAST among its category's (Order ▾ keeps a place since ③b).
  const { data: sibs } = await admin.from('canonical_service_taxonomy').select('canonical_service, sort_order').eq('tile_id', input.tileId);
  const nextSort = ((sibs ?? []) as Array<{ sort_order: number | null }>).reduce((m, s) => Math.max(m, s.sort_order ?? 0), -1) + 1;

  const { error: taxErr } = await admin.from('canonical_service_taxonomy').insert({
    canonical_service: canonical,
    folder_id: t.parent_id,
    tile_id: input.tileId,
    phase: 'V1.1 base',
    faith,
    is_ph: Boolean(input.isPh),
    is_rental: Boolean(input.isRental),
    is_setnayan: false,
    is_tradition: Boolean(input.isTradition),
    marketplace_hidden: false,
    secondary_tiles: [],
    sort_order: nextSort,
  });
  if (taxErr) {
    // supabase-error-ignored: the compensating rollback of a half-created service; the placement error is what the admin is told
    await admin.from('canonical_service_schemas').delete().eq('canonical_service', canonical);
    return { ok: false, error: taxErr.message };
  }
  await audit(admin, {
    action: 'taxonomy.create_leaf',
    target_table: 'canonical_service_taxonomy',
    target_id: canonical,
    after_json: { canonical_service: canonical, folder_id: t.parent_id, tile_id: input.tileId, display_name_en: label, category_specific_attributes: categoryAttrs },
    actor_user_id: actorId,
  });
  return { ok: true, id: canonical, message: `Saved — "${label}" is live under ${t.label_en ?? input.tileId}. Suppliers can pick it now.` };
}

/**
 * Move a service to another category — the core behind the shipped "Where it sits › Category" pick
 * (`remapCanonical`) AND the map's drag-a-service-onto-a-category. Re-points the denormalized
 * `folder_id` with it. `previous` carries the old category so the map's Undo can move it back.
 */
export async function moveServiceCore(admin: AdminDb, actorId: string, canonical: string, tileId: string): Promise<WriteResult> {
  const { data: tile } = await admin.from('service_categories').select('id, parent_id, tier, label_en').eq('id', tileId).maybeSingle();
  const t = tile as { id: string; parent_id: string | null; tier: number; label_en: string | null } | null;
  if (!t || t.tier !== 2 || !t.parent_id) return { ok: false, error: 'Pick a valid category.' };
  const { data: before } = await admin
    .from('canonical_service_taxonomy')
    .select('canonical_service, folder_id, tile_id')
    .eq('canonical_service', canonical)
    .maybeSingle();
  const b = before as { canonical_service: string; folder_id: string | null; tile_id: string | null } | null;
  if (!b) return { ok: false, error: 'Canonical not found.' };
  if (b.tile_id === tileId) return { ok: true, message: 'Already in that category.', previous: b.tile_id ?? '' };
  const { error } = await admin
    .from('canonical_service_taxonomy')
    .update({ tile_id: tileId, folder_id: t.parent_id, updated_at: now() })
    .eq('canonical_service', canonical);
  if (error) return { ok: false, error: error.message };
  await audit(admin, {
    action: 'taxonomy.remap_canonical',
    target_table: 'canonical_service_taxonomy',
    target_id: canonical,
    before_json: b,
    after_json: { canonical_service: canonical, folder_id: t.parent_id, tile_id: tileId },
    actor_user_id: actorId,
  });
  return { ok: true, message: `Moved to ${t.label_en ?? tileId} — the marketplace re-buckets live.`, previous: b.tile_id ?? '' };
}

/** Order ▾ on a SERVICE — one category's services, a permutation, written dense 0..n-1. */
export async function reorderServicesCore(admin: AdminDb, actorId: string, tileId: string, orderedKeys: readonly string[]): Promise<WriteResult> {
  const ordered = orderedKeys.map((s) => String(s).trim()).filter(Boolean);
  const { data } = await admin.from('canonical_service_taxonomy').select('canonical_service, sort_order, merged_into').eq('tile_id', tileId);
  const rows = ((data ?? []) as Array<{ canonical_service: string; sort_order: number | null; merged_into: string | null }>).filter((r) => !r.merged_into);
  const valid = validateReorder(rows.map((r) => r.canonical_service), ordered);
  if (!valid.ok) return { ok: false, error: valid.reason };
  const writes = computeReorder(ordered, Object.fromEntries(rows.map((r) => [r.canonical_service, r.sort_order ?? 0])));
  for (const w of writes) {
    const { error } = await admin.from('canonical_service_taxonomy').update({ sort_order: w.sort_order, updated_at: now() }).eq('canonical_service', w.id);
    if (error) return { ok: false, error: error.message };
  }
  if (writes.length) {
    await audit(admin, { action: 'taxonomy.reorder_services', target_table: 'canonical_service_taxonomy', target_id: tileId, after_json: { order: ordered }, actor_user_id: actorId });
  }
  return { ok: true, message: writes.length ? 'Order saved.' : 'Order unchanged.' };
}

// ── Part ──────────────────────────────────────────────────────────────────────

async function liveServiceKeys(admin: AdminDb, keys: readonly string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const { data } = await admin.from('canonical_service_taxonomy').select('canonical_service, merged_into').in('canonical_service', [...keys]);
  return new Set(((data ?? []) as Array<{ canonical_service: string; merged_into: string | null }>).filter((r) => !r.merged_into).map((r) => r.canonical_service));
}

/**
 * Link (`on`) or unlink services on a part — rows in `inspiration_part_services` (③a). A tick in the
 * "＋ Add a part to <service>" picker links THAT service; nothing is copied. The ③a trigger keeps the
 * part's derived categories (and the double-written `inspiration_part_categories`) true in the same
 * transaction.
 */
export async function linkPartServicesCore(
  admin: AdminDb,
  actorId: string,
  slotKey: string,
  services: readonly string[],
  on: boolean,
): Promise<WriteResult> {
  const { data: part } = await admin.from('inspiration_parts').select('slot_key, kind, label_en').eq('slot_key', slotKey).maybeSingle();
  const p = part as { slot_key: string; kind: string; label_en: string } | null;
  if (!p) return { ok: false, error: 'That part no longer exists.' };
  if (p.kind !== 'part') return { ok: false, error: 'A system part takes no services.' };
  const wanted = [...new Set(services.map((s) => String(s).trim()).filter(Boolean))];
  if (wanted.length === 0) return { ok: false, error: 'Pick at least one service.' };
  const { data: current } = await admin.from('inspiration_part_services').select('canonical_service, sort_order').eq('slot_key', slotKey);
  const have = (current ?? []) as Array<{ canonical_service: string; sort_order: number }>;
  const haveSet = new Set(have.map((r) => r.canonical_service));
  if (on) {
    const live = await liveServiceKeys(admin, wanted);
    const unknown = wanted.filter((k) => !live.has(k));
    if (unknown.length) return { ok: false, error: `Unknown service(s): ${unknown.join(', ')}.` };
    let next = have.reduce((m, r) => Math.max(m, r.sort_order ?? 0), -1) + 1;
    const added: string[] = [];
    for (const k of wanted) {
      if (haveSet.has(k)) continue;
      const { error } = await admin.from('inspiration_part_services').insert({ slot_key: slotKey, canonical_service: k, sort_order: next++ });
      if (error) return { ok: false, error: error.message };
      added.push(k);
    }
    if (added.length) {
      await audit(admin, { action: 'taxonomy.link_part_services', target_table: 'inspiration_part_services', target_id: slotKey, after_json: { linked: added }, actor_user_id: actorId });
    }
    return { ok: true, message: added.length ? `Linked ${p.label_en}.` : `${p.label_en} was already linked.` };
  }
  const removed: string[] = [];
  for (const k of wanted) {
    if (!haveSet.has(k)) continue;
    const { error } = await admin.from('inspiration_part_services').delete().eq('slot_key', slotKey).eq('canonical_service', k);
    if (error) return { ok: false, error: error.message };
    removed.push(k);
  }
  if (removed.length) {
    await audit(admin, { action: 'taxonomy.unlink_part_services', target_table: 'inspiration_part_services', target_id: slotKey, before_json: { linked: removed }, actor_user_id: actorId });
  }
  return { ok: true, message: removed.length ? `Unlinked ${p.label_en}.` : `${p.label_en} was not linked.` };
}

/** "Services it links ▾" on the part's drawer — the whole list at once; only the difference is written. */
export async function setPartServicesCore(admin: AdminDb, actorId: string, slotKey: string, services: readonly string[]): Promise<WriteResult> {
  const { data: current } = await admin.from('inspiration_part_services').select('canonical_service').eq('slot_key', slotKey);
  const have = new Set(((current ?? []) as Array<{ canonical_service: string }>).map((r) => r.canonical_service));
  const want = new Set(services.map((s) => String(s).trim()).filter(Boolean));
  const add = [...want].filter((k) => !have.has(k));
  const drop = [...have].filter((k) => !want.has(k));
  if (add.length) {
    const r = await linkPartServicesCore(admin, actorId, slotKey, add, true);
    if (!r.ok) return r;
  }
  if (drop.length) {
    const r = await linkPartServicesCore(admin, actorId, slotKey, drop, false);
    if (!r.ok) return r;
  }
  return { ok: true, message: add.length || drop.length ? 'Saved.' : 'No change.' };
}

/**
 * A new part — born with home = that category and linked to the services the admin was looking at (the
 * picker's service, or every service of the category; PLAN § 7.2 / § 7.1 v4). The key is made from the
 * name and is permanent (photos carry it).
 */
export async function addPartCore(
  admin: AdminDb,
  actorId: string,
  input: { homeCategoryId: string; label: string; services: readonly string[] },
): Promise<WriteResult> {
  const label = cleanLabel(input.label, 2, 60);
  if (!label) return { ok: false, error: 'A part name needs 2–60 characters.' };
  const { data: home } = await admin.from('service_categories').select('id, tier, label_en').eq('id', input.homeCategoryId).maybeSingle();
  const h = home as { id: string; tier: number; label_en: string } | null;
  if (!h || h.tier !== 2) return { ok: false, error: 'Pick a valid home category.' };
  const base = partKeyFromName(label);
  if (base.length < 2) return { ok: false, error: 'A part name needs letters.' };
  const { data: all } = await admin.from('inspiration_parts').select('slot_key, sort_order');
  const parts = (all ?? []) as Array<{ slot_key: string; sort_order: number }>;
  const taken = new Set(parts.map((r) => r.slot_key));
  let key = base;
  for (let i = 2; taken.has(key); i += 1) key = `${base.slice(0, 36)}_${i}`;
  const services = [...new Set(input.services.map((s) => String(s).trim()).filter(Boolean))];
  const live = await liveServiceKeys(admin, services);
  const unknown = services.filter((k) => !live.has(k));
  if (unknown.length) return { ok: false, error: `Unknown service(s): ${unknown.join(', ')}.` };
  const row = {
    slot_key: key,
    label_en: label,
    kind: 'part',
    home_category_id: h.id,
    sort_order: parts.reduce((m, r) => Math.max(m, r.sort_order ?? 0), -1) + 1,
    hidden: false,
    status: 'active',
  };
  const { error } = await admin.from('inspiration_parts').insert(row);
  if (error) return { ok: false, error: error.message };
  let n = 0;
  for (const k of services) {
    const { error: linkErr } = await admin.from('inspiration_part_services').insert({ slot_key: key, canonical_service: k, sort_order: n });
    if (linkErr) return { ok: false, error: linkErr.message };
    n += 1;
  }
  await audit(admin, { action: 'taxonomy.create_part', target_table: 'inspiration_parts', target_id: key, after_json: { ...row, services }, actor_user_id: actorId });
  return { ok: true, id: key, message: `Created ${label} — home ${h.label_en}${services.length ? `, linked to ${services.length} service${services.length === 1 ? '' : 's'}` : ''}.` };
}

/**
 * Move a part's HOME (its heading on the couple's board). 🔑 The heading moves, the door does not:
 * who may add photos is the service links alone (DECISION_LOG "CONTROLLER CALLS ON THE TAXONOMY
 * FOUNDATION" (3)). `previous` carries the old home for Undo.
 */
export async function movePartHomeCore(admin: AdminDb, actorId: string, slotKey: string, categoryId: string): Promise<WriteResult> {
  const { data: cat } = await admin.from('service_categories').select('id, tier, label_en').eq('id', categoryId).maybeSingle();
  const c = cat as { id: string; tier: number; label_en: string } | null;
  if (!c || c.tier !== 2) return { ok: false, error: 'Pick a valid category.' };
  const { data: part } = await admin.from('inspiration_parts').select('slot_key, kind, home_category_id').eq('slot_key', slotKey).maybeSingle();
  const p = part as { slot_key: string; kind: string; home_category_id: string | null } | null;
  if (!p) return { ok: false, error: 'That part no longer exists.' };
  if (p.kind !== 'part') return { ok: false, error: 'A system part has no home.' };
  if (p.home_category_id === categoryId) return { ok: true, message: 'Already its home.', previous: p.home_category_id ?? '' };
  const { error } = await admin.from('inspiration_parts').update({ home_category_id: categoryId, updated_at: now() }).eq('slot_key', slotKey);
  if (error) return { ok: false, error: error.message };
  await audit(admin, {
    action: 'taxonomy.move_part_home',
    target_table: 'inspiration_parts',
    target_id: slotKey,
    before_json: { home_category_id: p.home_category_id },
    after_json: { home_category_id: categoryId },
    actor_user_id: actorId,
  });
  return { ok: true, message: `Moved to ${c.label_en}.`, previous: p.home_category_id ?? '' };
}

/**
 * Order ▾ on a PART — among the parts that share its home. `inspiration_parts.sort_order` is one order
 * across every part, so the parts of this home trade their EXISTING positions (the set of numbers is
 * kept); a part in another category never moves.
 */
export async function reorderPartsCore(admin: AdminDb, actorId: string, homeId: string, orderedKeys: readonly string[]): Promise<WriteResult> {
  const ordered = orderedKeys.map((s) => String(s).trim()).filter(Boolean);
  const { data } = await admin.from('inspiration_parts').select('slot_key, sort_order').eq('home_category_id', homeId);
  const rows = (data ?? []) as Array<{ slot_key: string; sort_order: number }>;
  const valid = validateReorder(rows.map((r) => r.slot_key), ordered);
  if (!valid.ok) return { ok: false, error: valid.reason };
  // The positions this home owns, low to high; with ties (a seed of equal numbers) spread them apart first.
  let slots = rows.map((r) => r.sort_order ?? 0).sort((a, b) => a - b);
  if (new Set(slots).size !== slots.length) slots = slots.map((s, i) => s * 1000 + i);
  let changed = 0;
  for (let i = 0; i < ordered.length; i += 1) {
    const key = ordered[i]!;
    const target = slots[i]!;
    if (rows.find((r) => r.slot_key === key)?.sort_order === target) continue;
    const { error } = await admin.from('inspiration_parts').update({ sort_order: target, updated_at: now() }).eq('slot_key', key);
    if (error) return { ok: false, error: error.message };
    changed += 1;
  }
  if (changed) {
    await audit(admin, { action: 'taxonomy.reorder_parts', target_table: 'inspiration_parts', target_id: homeId, after_json: { order: ordered }, actor_user_id: actorId });
  }
  return { ok: true, message: changed ? 'Order saved.' : 'Order unchanged.' };
}

/** Rename a part (the label only — the key and every photo stay). */
export async function renamePartCore(admin: AdminDb, actorId: string, slotKey: string, rawLabel: string): Promise<WriteResult> {
  const label = cleanLabel(rawLabel, 1, 60);
  if (!label) return { ok: false, error: 'A part name needs 1–60 characters.' };
  const { data: before } = await admin.from('inspiration_parts').select('slot_key, label_en').eq('slot_key', slotKey).maybeSingle();
  const b = before as { slot_key: string; label_en: string } | null;
  if (!b) return { ok: false, error: 'That part no longer exists.' };
  if (b.label_en === label) return { ok: true, message: 'No change.' };
  const { error } = await admin.from('inspiration_parts').update({ label_en: label, updated_at: now() }).eq('slot_key', slotKey);
  if (error) return { ok: false, error: error.message };
  await audit(admin, { action: 'taxonomy.rename_part', target_table: 'inspiration_parts', target_id: slotKey, before_json: { label_en: b.label_en }, after_json: { label_en: label }, actor_user_id: actorId });
  return { ok: true, message: 'Saved.' };
}

/** Hidden from couples (a part with photos is hidden, never deleted — its photos stay). */
export async function setPartHiddenCore(admin: AdminDb, actorId: string, slotKey: string, hidden: boolean): Promise<WriteResult> {
  const { data: before } = await admin.from('inspiration_parts').select('slot_key, hidden').eq('slot_key', slotKey).maybeSingle();
  const b = before as { slot_key: string; hidden: boolean } | null;
  if (!b) return { ok: false, error: 'That part no longer exists.' };
  if (b.hidden === hidden) return { ok: true, message: 'No change.' };
  const { error } = await admin.from('inspiration_parts').update({ hidden, updated_at: now() }).eq('slot_key', slotKey);
  if (error) return { ok: false, error: error.message };
  await audit(admin, { action: 'taxonomy.set_part_hidden', target_table: 'inspiration_parts', target_id: slotKey, before_json: { hidden: b.hidden }, after_json: { hidden }, actor_user_id: actorId });
  return { ok: true, message: hidden ? 'Hidden from couples — its photos stay.' : 'Shown to couples again.' };
}
