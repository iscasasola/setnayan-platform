'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const BASE = '/admin/taxonomy';

/**
 * Defense-in-depth admin gate (the /admin layout already 404s non-admins;
 * server actions re-check). Mirrors /admin/songs + /admin/pricing. Returns the
 * acting user so writes can stamp `admin_audit_log.actor_user_id`.
 */
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return user;
}

/**
 * Admin: update a `planning_deadlines` row's offset (the recommended lock-by
 * deadline the Home reminders read). RLS (`is_admin()`) gates the write — a
 * non-admin's UPDATE matches zero rows, so this is safe even though the form
 * posts from a page that's already admin-gated by the admin layout.
 */
export async function updatePlanningDeadline(formData: FormData) {
  const deadlineId = formData.get('deadline_id');
  const offsetValue = Number(formData.get('offset_value'));
  const offsetUnit = formData.get('offset_unit');

  if (typeof deadlineId !== 'string' || !deadlineId) {
    throw new Error('Missing deadline_id');
  }
  if (!Number.isInteger(offsetValue) || offsetValue < 0) {
    throw new Error('Offset must be a non-negative whole number');
  }
  if (offsetUnit !== 'day' && offsetUnit !== 'week' && offsetUnit !== 'month') {
    throw new Error('Invalid offset unit');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('planning_deadlines')
    .update({
      offset_value: offsetValue,
      offset_unit: offsetUnit,
      updated_at: new Date().toISOString(),
    })
    .eq('deadline_id', deadlineId);

  if (error) throw new Error(error.message);

  revalidatePath('/admin/taxonomy');
}

/**
 * Admin: set (upsert) the platform last-minute START for a category — the month
 * before the wedding when "last-minute" begins for that category's services
 * (Setnayan AI §4). Writes a `planning_deadlines` row with
 * kind='last_minute_start', scope='category', ref_key = plan-group id. No row =
 * dormant (the whole last-minute mechanic does nothing until a START is set, so
 * this is the on-switch). Audit-logged; the marketplace reads it live.
 */
export async function setLastMinuteStart(formData: FormData) {
  const user = await requireAdmin();
  const refKey = String(formData.get('ref_key') ?? '').trim();
  const label = String(formData.get('label') ?? '').trim() || null;
  const months = Number(formData.get('months'));
  if (!refKey) throw new Error('Missing ref_key');
  if (!Number.isInteger(months) || months < 0 || months > 60) {
    redirect(
      `${BASE}?error=${encodeURIComponent('Last-minute start must be a whole number of months (0–60).')}`,
    );
  }
  const admin = createAdminClient();
  const { error } = await admin.from('planning_deadlines').upsert(
    {
      kind: 'last_minute_start',
      ref_key: refKey,
      scope: 'category',
      label,
      offset_value: months,
      offset_unit: 'month',
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'kind,ref_key,scope' },
  );
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.set_last_minute_start',
    target_table: 'planning_deadlines',
    target_id: refKey,
    after_json: { kind: 'last_minute_start', ref_key: refKey, scope: 'category', offset_value: months },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  redirect(
    `${BASE}?ok=${encodeURIComponent(`Last-minute starts ${months} month${months === 1 ? '' : 's'} before the wedding for ${refKey}.`)}`,
  );
}

/**
 * Admin: clear a category's last-minute START → back to dormant (delete the row).
 * The category stops surfacing last-minute vendors / showing the badge.
 */
export async function clearLastMinuteStart(formData: FormData) {
  const user = await requireAdmin();
  const refKey = String(formData.get('ref_key') ?? '').trim();
  if (!refKey) throw new Error('Missing ref_key');
  const admin = createAdminClient();
  const { error } = await admin
    .from('planning_deadlines')
    .delete()
    .eq('kind', 'last_minute_start')
    .eq('scope', 'category')
    .eq('ref_key', refKey);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.clear_last_minute_start',
    target_table: 'planning_deadlines',
    target_id: refKey,
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  redirect(`${BASE}?ok=${encodeURIComponent(`Last-minute disabled for ${refKey}.`)}`);
}

/**
 * Admin: rename a taxonomy node (parent or tile) in `service_categories`. The
 * new label is read live by `getTaxonomy()` (no deploy) — the ♾️ "Finalize =
 * permanent live publish" lock. Audit-logged.
 */
export async function renameTaxonomyNode(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const label = String(formData.get('label_en') ?? '').trim();
  if (!id) throw new Error('Missing node id');
  if (label.length < 2 || label.length > 80) {
    redirect(`${BASE}?error=${encodeURIComponent('Label must be 2–80 characters.')}`);
  }
  const admin = createAdminClient();
  const { data: before } = await admin
    .from('service_categories')
    .select('id, label_en')
    .eq('id', id)
    .maybeSingle();
  if (!before) redirect(`${BASE}?error=${encodeURIComponent('Node not found.')}`);
  if (before.label_en === label) redirect(`${BASE}?ok=${encodeURIComponent('No change.')}`);
  const { error } = await admin
    .from('service_categories')
    .update({ label_en: label, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.rename',
    target_table: 'service_categories',
    target_id: id,
    before_json: before,
    after_json: { id, label_en: label },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/vendors');
  redirect(`${BASE}?ok=${encodeURIComponent(`Renamed to "${label}".`)}`);
}

/**
 * Admin: re-map a `canonical_service` to a different tile (+ its parent folder)
 * in `canonical_service_taxonomy`. Read live by `getCanonicalBuckets()` → the
 * /vendors marketplace re-buckets that vendor set with no deploy. Audit-logged.
 */
export async function remapCanonical(formData: FormData) {
  const user = await requireAdmin();
  const canonical = String(formData.get('canonical_service') ?? '').trim();
  const tileId = String(formData.get('tile_id') ?? '').trim();
  if (!canonical || !tileId) throw new Error('Missing canonical_service or tile_id');
  const admin = createAdminClient();
  // The destination must exist + be a tile (tier 2); derive its parent folder.
  const { data: tile } = await admin
    .from('service_categories')
    .select('id, parent_id, tier')
    .eq('id', tileId)
    .maybeSingle();
  if (!tile || tile.tier !== 2 || !tile.parent_id) {
    redirect(`${BASE}?error=${encodeURIComponent('Pick a valid tile.')}`);
  }
  const { data: before } = await admin
    .from('canonical_service_taxonomy')
    .select('canonical_service, folder_id, tile_id')
    .eq('canonical_service', canonical)
    .maybeSingle();
  if (!before) redirect(`${BASE}?error=${encodeURIComponent('Canonical not found.')}`);
  if (before.tile_id === tileId) redirect(`${BASE}?ok=${encodeURIComponent('Already on that tile.')}`);
  const { error } = await admin
    .from('canonical_service_taxonomy')
    .update({
      tile_id: tileId,
      folder_id: tile.parent_id,
      updated_at: new Date().toISOString(),
    })
    .eq('canonical_service', canonical);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.remap_canonical',
    target_table: 'canonical_service_taxonomy',
    target_id: canonical,
    before_json: before,
    after_json: { canonical_service: canonical, folder_id: tile.parent_id, tile_id: tileId },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/vendors');
  redirect(`${BASE}?ok=${encodeURIComponent('Re-mapped — the marketplace re-buckets live.')}`);
}

/**
 * Admin: set (or clear) the faith tag on a canonical service — the write
 * control the faith column never had (`createCanonicalLeaf` minted every
 * service faith-NULL and the badge was read-only). Validated against
 * `faith_vocab` (active rows); empty selection = NULL = universal ("untagged
 * always delivered"). Faith is INCLUDE-only match-scope: it makes a service
 * surface ONLY for matching couples, so it stays reserved for genuinely
 * faith-restricted services (officiants / seminars / counseling) — never food
 * or cultural items (de-faith lock, 2026-06-11). Audit-logged.
 */
export async function setServiceFaith(formData: FormData) {
  const user = await requireAdmin();
  const canonical = String(formData.get('canonical_service') ?? '').trim();
  const faithRaw = String(formData.get('faith') ?? '').trim();
  if (!canonical) throw new Error('Missing canonical_service');

  const admin = createAdminClient();
  let faith: string | null = null;
  if (faithRaw) {
    const { data: vocabRow } = await admin
      .from('faith_vocab')
      .select('faith_key')
      .eq('faith_key', faithRaw)
      .eq('status', 'active')
      .maybeSingle();
    if (!vocabRow) {
      redirect(`${BASE}?error=${encodeURIComponent(`Unknown faith "${faithRaw}".`)}`);
    }
    faith = faithRaw;
  }

  const { data: before } = await admin
    .from('canonical_service_taxonomy')
    .select('canonical_service, faith, dietary')
    .eq('canonical_service', canonical)
    .maybeSingle();
  if (!before) redirect(`${BASE}?error=${encodeURIComponent('Canonical not found.')}`);
  if (before.faith === faith) redirect(`${BASE}?ok=${encodeURIComponent('Faith unchanged.')}`);

  // De-faith guard: a dietary canonical must never be faith-gated — the
  // marketplace filter is INCLUDE-only and would hide it from every
  // non-matching couple (the exact bug fixed 2026-06-11).
  if (faith && before.dietary) {
    redirect(
      `${BASE}?error=${encodeURIComponent(
        'Dietary services stay universal — dietary capability is a per-vendor grade, not a faith gate.',
      )}`,
    );
  }

  const { error } = await admin
    .from('canonical_service_taxonomy')
    .update({ faith, updated_at: new Date().toISOString() })
    .eq('canonical_service', canonical);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.set_faith',
    target_table: 'canonical_service_taxonomy',
    target_id: canonical,
    before_json: { faith: before.faith ?? null },
    after_json: { faith },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/vendors');
  redirect(
    `${BASE}?ok=${encodeURIComponent(
      faith ? `Faith set to ${faith} — surfaces only for matching couples.` : 'Faith cleared — universal.',
    )}`,
  );
}

/**
 * Admin: set which event types a TILE serves (multi-event applicability, Phase 1).
 * Writes `service_categories.applicable_event_types` — NULL = universal (serves
 * ALL events; the FAIL-OPEN default). Read live by `getTaxonomy()` → the
 * marketplace + onboarding scope to the couple's event type with no deploy.
 * Audit-logged. The DB validation trigger rejects unknown event types as a
 * backstop. Selecting EVERY event type collapses to NULL (universal) so we never
 * store a brittle full-list array.
 */
export async function setCategoryEventTypes(formData: FormData) {
  const user = await requireAdmin();
  const categoryId = String(formData.get('category_id') ?? '').trim();
  if (!categoryId) throw new Error('Missing category_id');
  const selected = Array.from(
    new Set(
      formData
        .getAll('event_types')
        .map((v) => String(v).trim())
        .filter(Boolean),
    ),
  );

  const admin = createAdminClient();
  const { data: cat } = await admin
    .from('service_categories')
    .select('id, tier, applicable_event_types')
    .eq('id', categoryId)
    .maybeSingle();
  if (!cat) redirect(`${BASE}?error=${encodeURIComponent('Category not found.')}`);

  let next: string[] | null = null;
  if (selected.length > 0) {
    const { data: vocab } = await admin
      .from('event_type_vocab')
      .select('event_type')
      .eq('status', 'active');
    const valid = new Set((vocab ?? []).map((v) => v.event_type));
    const unknown = selected.filter((s) => !valid.has(s));
    if (unknown.length > 0) {
      redirect(`${BASE}?error=${encodeURIComponent('Unknown event type(s): ' + unknown.join(', '))}`);
    }
    // Every event selected == no restriction → store NULL (universal).
    next = selected.length >= valid.size ? null : selected.sort();
  }

  const { error } = await admin
    .from('service_categories')
    .update({ applicable_event_types: next })
    .eq('id', categoryId);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.set_event_types',
    target_table: 'service_categories',
    target_id: categoryId,
    before_json: { applicable_event_types: cat.applicable_event_types ?? null },
    after_json: { applicable_event_types: next },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/vendors');
  redirect(
    `${BASE}?ok=${encodeURIComponent(
      next === null ? 'Set to universal (all events).' : 'Event types updated — live on the marketplace.',
    )}`,
  );
}

/** Slugify a label into a stable key (sep '_' for the id, '-' for the slug). */
function slugify(label: string, sep: '_' | '-'): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, sep)
    .replace(new RegExp(`^\\${sep}+|\\${sep}+$`, 'g'), '');
}

/**
 * Admin: add a new tile under a parent — the expandable-taxonomy core. The
 * tile goes live on `/vendors` with no deploy (the catalog reads the snapshot),
 * ready to receive re-mapped canonicals. Audit-logged.
 */
export async function createTaxonomyNode(formData: FormData) {
  const user = await requireAdmin();
  const parentId = String(formData.get('parent_id') ?? '').trim();
  const label = String(formData.get('label_en') ?? '').trim();
  if (!parentId) throw new Error('Missing parent_id');
  if (label.length < 2 || label.length > 80) {
    redirect(`${BASE}?error=${encodeURIComponent('Label must be 2–80 characters.')}`);
  }
  const id = slugify(label, '_');
  const slug = slugify(label, '-');
  if (!id || !slug) {
    redirect(`${BASE}?error=${encodeURIComponent('Label needs letters or numbers.')}`);
  }
  const admin = createAdminClient();
  const { data: parent } = await admin
    .from('service_categories')
    .select('id, tier')
    .eq('id', parentId)
    .maybeSingle();
  if (!parent || parent.tier !== 1) {
    redirect(`${BASE}?error=${encodeURIComponent('Pick a valid parent.')}`);
  }
  const { data: existing } = await admin
    .from('service_categories')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (existing) {
    redirect(`${BASE}?error=${encodeURIComponent(`A node "${id}" already exists — pick a different label.`)}`);
  }
  const { data: lastSibling } = await admin
    .from('service_categories')
    .select('sort_order')
    .eq('parent_id', parentId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = ((lastSibling?.sort_order as number | undefined) ?? -1) + 1;
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
  const { error } = await admin.from('service_categories').insert(row);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.create',
    target_table: 'service_categories',
    target_id: id,
    after_json: row,
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/vendors');
  redirect(`${BASE}?ok=${encodeURIComponent(`Added tile "${label}" under ${parentId}.`)}`);
}

/**
 * Admin: delete a tile. Guarded against orphans — refuses if it has child nodes
 * or any canonical_service still mapped to it (re-map those first). Parents are
 * owner-managed and not deletable here. Audit-logged.
 */
export async function deleteTaxonomyNode(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  if (!id) throw new Error('Missing node id');
  const admin = createAdminClient();
  const { data: before } = await admin
    .from('service_categories')
    .select('id, tier, label_en, parent_id')
    .eq('id', id)
    .maybeSingle();
  if (!before) redirect(`${BASE}?error=${encodeURIComponent('Node not found.')}`);
  if (before.tier === 1) {
    redirect(`${BASE}?error=${encodeURIComponent('Parents are owner-managed — can’t delete here.')}`);
  }
  const { count: childCount } = await admin
    .from('service_categories')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', id);
  if ((childCount ?? 0) > 0) {
    redirect(`${BASE}?error=${encodeURIComponent('Has sub-categories — remove them first.')}`);
  }
  const { count: mappedCount } = await admin
    .from('canonical_service_taxonomy')
    .select('canonical_service', { count: 'exact', head: true })
    .eq('tile_id', id);
  if ((mappedCount ?? 0) > 0) {
    redirect(`${BASE}?error=${encodeURIComponent(`${mappedCount} service(s) still mapped here — re-map them first.`)}`);
  }
  const { error } = await admin.from('service_categories').delete().eq('id', id);
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.delete',
    target_table: 'service_categories',
    target_id: id,
    before_json: before,
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/vendors');
  redirect(`${BASE}?ok=${encodeURIComponent(`Deleted "${before.label_en}".`)}`);
}

/**
 * Admin: reorder a tile within its parent by swapping `sort_order` with the
 * adjacent sibling. The catalog reads tile order from the snapshot, so the
 * marketplace re-orders live with no deploy. Audit-logged.
 */
export async function moveTaxonomyNode(formData: FormData) {
  const user = await requireAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const direction = String(formData.get('direction') ?? '');
  if (!id) throw new Error('Missing node id');
  if (direction !== 'up' && direction !== 'down') throw new Error('Bad direction');
  const admin = createAdminClient();
  const { data: node } = await admin
    .from('service_categories')
    .select('id, parent_id, tier, sort_order')
    .eq('id', id)
    .maybeSingle();
  if (!node || node.parent_id == null) {
    redirect(`${BASE}?error=${encodeURIComponent('This node can’t be moved.')}`);
  }
  // Adjacent sibling: same parent + tier, nearest sort_order in the direction.
  const base = admin
    .from('service_categories')
    .select('id, sort_order')
    .eq('parent_id', node.parent_id)
    .eq('tier', node.tier);
  const { data: sibling } =
    direction === 'up'
      ? await base
          .lt('sort_order', node.sort_order)
          .order('sort_order', { ascending: false })
          .limit(1)
          .maybeSingle()
      : await base
          .gt('sort_order', node.sort_order)
          .order('sort_order', { ascending: true })
          .limit(1)
          .maybeSingle();
  if (!sibling) redirect(`${BASE}?ok=${encodeURIComponent('Already at the edge.')}`);
  // Swap (no unique constraint on sort_order, so the interim collision is fine).
  await admin
    .from('service_categories')
    .update({ sort_order: sibling.sort_order, updated_at: new Date().toISOString() })
    .eq('id', node.id);
  await admin
    .from('service_categories')
    .update({ sort_order: node.sort_order, updated_at: new Date().toISOString() })
    .eq('id', sibling.id);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.move',
    target_table: 'service_categories',
    target_id: id,
    before_json: { sort_order: node.sort_order },
    after_json: { sort_order: sibling.sort_order, direction },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/vendors');
  redirect(`${BASE}?ok=${encodeURIComponent(`Moved ${direction}.`)}`);
}

/**
 * Admin: mint a BRAND-NEW bookable canonical service (a "leaf") under a chosen
 * tile — the capability that lets the taxonomy GROW from the editor with no
 * deploy (the ♾️ "Finalize = permanent live publish" lock). A leaf lives in two
 * tables, so we write both atomically-ish (schema first, then mapping, rolling
 * back the schema if the mapping insert fails):
 *   • canonical_service_schemas    — the attribute-schema row, so the service
 *     shows in the vendor onboarding "add a service" picker
 *     (listCanonicalServices reads this table) and can carry refinements.
 *   • canonical_service_taxonomy   — the tile placement + facet flags, so the
 *     /vendors marketplace buckets it (getCanonicalBuckets reads this) the
 *     moment it's added.
 *
 * An optional starter refinement seeds the leaf's first category-specific
 * attribute as a `multi_select` (e.g. a "Customization" refinement with
 * options plain · custom_monogram · custom_logo for a new table-linen-rental
 * service). Audit-logged.
 */
export async function createCanonicalLeaf(formData: FormData) {
  const user = await requireAdmin();
  const tileId = String(formData.get('tile_id') ?? '').trim();
  const label = String(formData.get('display_name_en') ?? '').trim();
  const isRental = formData.get('is_rental') === 'on';
  const isPh = formData.get('is_ph') === 'on';
  const faithRaw = String(formData.get('faith') ?? '').trim();
  const refinementLabel = String(formData.get('refinement_label') ?? '').trim();
  const refinementOptionsRaw = String(formData.get('refinement_options') ?? '').trim();

  if (!tileId) throw new Error('Missing tile_id');
  if (label.length < 2 || label.length > 80) {
    redirect(`${BASE}?error=${encodeURIComponent('Service name must be 2–80 characters.')}`);
  }
  const canonical = slugify(label, '_');
  if (!canonical) {
    redirect(`${BASE}?error=${encodeURIComponent('Name needs letters or numbers.')}`);
  }

  const admin = createAdminClient();

  // Optional faith scope — validated against faith_vocab so admin-minted
  // services are no longer born faith-blind (Phase 2). Empty = universal.
  let faith: string | null = null;
  if (faithRaw) {
    const { data: vocabRow } = await admin
      .from('faith_vocab')
      .select('faith_key')
      .eq('faith_key', faithRaw)
      .eq('status', 'active')
      .maybeSingle();
    if (!vocabRow) {
      redirect(`${BASE}?error=${encodeURIComponent(`Unknown faith "${faithRaw}".`)}`);
    }
    faith = faithRaw;
  }

  // Destination must exist + be a tier-2 tile; derive its parent folder so the
  // mapping's folder_id stays consistent with remapCanonical's invariant.
  const { data: tile } = await admin
    .from('service_categories')
    .select('id, parent_id, tier')
    .eq('id', tileId)
    .maybeSingle();
  if (!tile || tile.tier !== 2 || !tile.parent_id) {
    redirect(`${BASE}?error=${encodeURIComponent('Pick a valid tile.')}`);
  }

  // The key must be free in BOTH leaf tables (schema PK + mapping PK).
  const [schemaDupeRes, taxDupeRes] = await Promise.all([
    admin
      .from('canonical_service_schemas')
      .select('canonical_service')
      .eq('canonical_service', canonical)
      .maybeSingle(),
    admin
      .from('canonical_service_taxonomy')
      .select('canonical_service')
      .eq('canonical_service', canonical)
      .maybeSingle(),
  ]);
  if (schemaDupeRes.data || taxDupeRes.data) {
    redirect(
      `${BASE}?error=${encodeURIComponent(`A service "${canonical}" already exists — pick a different name.`)}`,
    );
  }

  // Optional starter refinement → one multi_select category-specific attribute.
  const categoryAttrs: Record<string, unknown> = {};
  if (refinementLabel && refinementOptionsRaw) {
    const fieldKey = slugify(refinementLabel, '_');
    const options = refinementOptionsRaw
      .split(',')
      .map((o) => slugify(o, '_'))
      .filter(Boolean);
    if (fieldKey && options.length > 0) {
      categoryAttrs[fieldKey] = {
        type: 'multi_select',
        label: refinementLabel,
        options,
      };
    }
  }

  // 1. Schema stub — appears in onboarding, taggable, refinement-ready.
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
  if (schemaErr) redirect(`${BASE}?error=${encodeURIComponent(schemaErr.message)}`);

  // 2. Tile placement — /vendors buckets it live.
  const { error: taxErr } = await admin.from('canonical_service_taxonomy').insert({
    canonical_service: canonical,
    folder_id: tile.parent_id,
    tile_id: tileId,
    phase: 'V1.1 base',
    faith,
    is_ph: isPh,
    is_rental: isRental,
    is_setnayan: false,
    is_tradition: false,
    marketplace_hidden: false,
    secondary_tiles: [],
  });
  if (taxErr) {
    // Roll back the schema stub so a half-created leaf can't linger.
    await admin.from('canonical_service_schemas').delete().eq('canonical_service', canonical);
    redirect(`${BASE}?error=${encodeURIComponent(taxErr.message)}`);
  }

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.create_leaf',
    target_table: 'canonical_service_taxonomy',
    target_id: canonical,
    after_json: {
      canonical_service: canonical,
      folder_id: tile.parent_id,
      tile_id: tileId,
      display_name_en: label,
      category_specific_attributes: categoryAttrs,
    },
    actor_user_id: user.id,
  });

  revalidatePath(BASE);
  revalidatePath('/vendors');
  redirect(
    `${BASE}?ok=${encodeURIComponent(
      `Added service "${label}" under ${tileId}${refinementLabel ? ` with a "${refinementLabel}" refinement` : ''}.`,
    )}`,
  );
}

// ── Vendor "request a category" review (taxonomy_category_requests · §3.2c) ───
// A vendor's proposal lands as a PENDING request; an admin resolves it with one
// of four outcomes. All audit-logged; the vendor tracks the result read-only.

/**
 * PROMOTE — mint a real canonical leaf for the request under a chosen tile, then
 * mark the request `promoted` (the proposing vendor keeps first-vendor credit via
 * the audit trail). Same two-table leaf write as `createCanonicalLeaf`.
 */
export async function promoteCategoryRequest(formData: FormData) {
  const user = await requireAdmin();
  const requestId = String(formData.get('request_id') ?? '').trim();
  const tileId = String(formData.get('tile_id') ?? '').trim();
  if (!requestId || !tileId) throw new Error('Missing request_id or tile_id');
  const admin = createAdminClient();

  const { data: req } = await admin
    .from('taxonomy_category_requests')
    .select('request_id, proposed_label, status')
    .eq('request_id', requestId)
    .maybeSingle();
  if (!req) redirect(`${BASE}?error=${encodeURIComponent('Request not found.')}`);
  if (req.status !== 'pending') {
    redirect(`${BASE}?error=${encodeURIComponent('That request was already resolved.')}`);
  }

  const { data: tile } = await admin
    .from('service_categories')
    .select('id, parent_id, tier')
    .eq('id', tileId)
    .maybeSingle();
  if (!tile || tile.tier !== 2 || !tile.parent_id) {
    redirect(`${BASE}?error=${encodeURIComponent('Pick a valid tile.')}`);
  }

  const canonical = slugify(req.proposed_label, '_');
  if (!canonical) {
    redirect(`${BASE}?error=${encodeURIComponent('Label needs letters or numbers.')}`);
  }

  const [schemaDupe, taxDupe] = await Promise.all([
    admin.from('canonical_service_schemas').select('canonical_service').eq('canonical_service', canonical).maybeSingle(),
    admin.from('canonical_service_taxonomy').select('canonical_service').eq('canonical_service', canonical).maybeSingle(),
  ]);
  if (schemaDupe.data || taxDupe.data) {
    redirect(
      `${BASE}?error=${encodeURIComponent(`"${canonical}" already exists — use Map instead of Promote.`)}`,
    );
  }

  const { error: schemaErr } = await admin.from('canonical_service_schemas').insert({
    canonical_service: canonical,
    schema_version: 1,
    display_name_en: req.proposed_label,
    shared_attribute_groups: [],
    category_specific_attributes: {},
    filter_facets: [],
    required_for_visibility: {},
    ranking_signal_weights: {},
  });
  if (schemaErr) redirect(`${BASE}?error=${encodeURIComponent(schemaErr.message)}`);

  const { error: taxErr } = await admin.from('canonical_service_taxonomy').insert({
    canonical_service: canonical,
    folder_id: tile.parent_id,
    tile_id: tileId,
    phase: 'V1.1 base',
    marketplace_hidden: false,
    secondary_tiles: [],
  });
  if (taxErr) {
    await admin.from('canonical_service_schemas').delete().eq('canonical_service', canonical);
    redirect(`${BASE}?error=${encodeURIComponent(taxErr.message)}`);
  }

  await admin
    .from('taxonomy_category_requests')
    .update({
      status: 'promoted',
      mapped_to_canonical: canonical,
      reviewed_by_admin_id: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('request_id', requestId);

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.request_promote',
    target_table: 'taxonomy_category_requests',
    target_id: requestId,
    after_json: { canonical_service: canonical, tile_id: tileId, label: req.proposed_label },
    actor_user_id: user.id,
  });

  revalidatePath(BASE);
  revalidatePath('/vendors');
  redirect(`${BASE}?ok=${encodeURIComponent(`Promoted "${req.proposed_label}" → new service "${canonical}".`)}`);
}

/**
 * MAP — "your X is our existing Y": point the request at an existing canonical.
 * The count of requests mapped to the same target is the demand signal that the
 * node has earned its own promotion later.
 */
export async function mapCategoryRequest(formData: FormData) {
  const user = await requireAdmin();
  const requestId = String(formData.get('request_id') ?? '').trim();
  const canonical = String(formData.get('mapped_to_canonical') ?? '').trim();
  if (!requestId || !canonical) throw new Error('Missing request_id or target');
  const admin = createAdminClient();

  const { data: target } = await admin
    .from('canonical_service_taxonomy')
    .select('canonical_service')
    .eq('canonical_service', canonical)
    .maybeSingle();
  if (!target) {
    redirect(`${BASE}?error=${encodeURIComponent('Pick an existing service to map to.')}`);
  }

  const { error } = await admin
    .from('taxonomy_category_requests')
    .update({
      status: 'mapped',
      mapped_to_canonical: canonical,
      resolution_note: `Mapped to "${canonical}".`,
      reviewed_by_admin_id: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('request_id', requestId)
    .eq('status', 'pending');
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.request_map',
    target_table: 'taxonomy_category_requests',
    target_id: requestId,
    after_json: { mapped_to_canonical: canonical },
    actor_user_id: user.id,
  });

  revalidatePath(BASE);
  redirect(`${BASE}?ok=${encodeURIComponent(`Mapped to "${canonical}".`)}`);
}

/**
 * KEEP-PRIVATE or REJECT — the two terminal acknowledgements (no new node).
 * `outcome` ∈ kept_private | rejected; an optional note is shown to the vendor.
 */
export async function resolveCategoryRequest(formData: FormData) {
  const user = await requireAdmin();
  const requestId = String(formData.get('request_id') ?? '').trim();
  const outcome = String(formData.get('outcome') ?? '');
  const note = String(formData.get('resolution_note') ?? '').trim() || null;
  if (!requestId) throw new Error('Missing request_id');
  if (outcome !== 'kept_private' && outcome !== 'rejected') {
    throw new Error('Bad outcome');
  }
  const admin = createAdminClient();

  const { error } = await admin
    .from('taxonomy_category_requests')
    .update({
      status: outcome,
      resolution_note: note,
      reviewed_by_admin_id: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('request_id', requestId)
    .eq('status', 'pending');
  if (error) redirect(`${BASE}?error=${encodeURIComponent(error.message)}`);

  await admin.from('admin_audit_log').insert({
    action: `taxonomy.request_${outcome}`,
    target_table: 'taxonomy_category_requests',
    target_id: requestId,
    after_json: { status: outcome, resolution_note: note },
    actor_user_id: user.id,
  });

  revalidatePath(BASE);
  redirect(
    `${BASE}?ok=${encodeURIComponent(outcome === 'kept_private' ? 'Kept private.' : 'Request rejected.')}`,
  );
}
