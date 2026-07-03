'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { normalizeIconName } from '@/lib/taxonomy-icon-name';
import { validateReorder, computeReorder } from '@/lib/taxonomy-studio-order';
import {
  addOptionCore,
  removeOptionCore,
  updateLeafCore,
  updateOptionCore,
} from '@/lib/refinements-mutations';
import {
  addLeafAttributeField,
  addLeafAttributeOption,
  relabelLeafAttributeField,
  retireLeafAttributeField,
  retireLeafAttributeOption,
  type LeafAttributeMap,
  type SchemaMutationResult,
} from '@/lib/leaf-attribute-schema';
import {
  setWeddingTypeStatusCore,
  setWeddingTypeThresholdCore,
  LAUNCH_STATUSES,
  type LaunchStatus,
} from '@/lib/wedding-types-mutations';
import {
  createEventTypeCore,
  updateEventTypeCore,
  setEventTypeEnabledCore,
  retireEventTypeCore,
  unretireEventTypeCore,
} from '@/lib/event-types-mutations';
import { FAITH_REGISTRY } from '@/lib/faith-registry';
import { WEDDING_TILE_ORDER } from '@/lib/taxonomy';

const BASE = '/admin/taxonomy';
/** The onboarding read path (getOnboardingRefinements is DB-first) renders here —
 *  revalidate it alongside /admin/taxonomy so a refinement edit shows up live. */
const ONBOARDING_PATH = '/onboarding/wedding';
/** The vendor form that renders these leaf refinements (fetchSchemaWithSharedGroups
 *  is a server read) — revalidate it so a schema edit surfaces to vendors live. */
const VENDOR_ATTR_PATH = '/vendor-dashboard/attributes';

/** JSON result for the Studio's drag actions — they cannot redirect (they fire
 *  from `fetch`/`useTransition`, not a form navigation), so they hand the client
 *  a `{ ok }` / `{ error }` shape and the client calls `router.refresh()`. */
export type StudioActionResult = { ok: true; message: string } | { ok: false; error: string };

/**
 * A sample photo must be a /public image path or an r2:// ref — never arbitrary
 * text (blocks CSS-injection via a tampered POST, since the value can render as
 * a `url(…)` background). Same shape as the /admin/refinements VALID_PHOTO.
 */
const VALID_PHOTO = /^(\/[\w./-]+\.(?:webp|jpe?g|png)|r2:\/\/[\w./-]+)$/i;

const SAFE_ANCHOR = /[^a-z0-9_-]/g;
const VIEWS = new Set(['faith', 'scoped', 'unfiled', 'vocab-event', 'vocab-faith']);

/**
 * Redirect back to the spot the form was submitted from (the admin/users
 * `#u-<id>` pattern). Reads the hidden `_q` / `_view` / `_anchor` fields every
 * form carries (page-side `BackFields`); `override.anchor` lets actions that
 * KNOW the destination (remap, create-leaf, promote, delete) land there
 * instead. A `t-<tile>` anchor also sets `?open=` so the edited tile re-opens;
 * an `f-<folder>` anchor sets `?openf=` so a filter-hidden folder stays
 * visible. `q` is NOT character-stripped (it's never interpolated into SQL or
 * HTML and URLSearchParams percent-encodes it); only the anchor — appended raw
 * after `#` — gets the strict charset.
 */
function redirectBack(
  formData: FormData,
  kind: 'ok' | 'error',
  msg: string,
  override?: { anchor?: string },
): never {
  const q = String(formData.get('_q') ?? '').slice(0, 80).trim();
  const view = String(formData.get('_view') ?? '').trim();
  const rawAnchor = override?.anchor ?? String(formData.get('_anchor') ?? '');
  const anchor = rawAnchor.replace(SAFE_ANCHOR, '').slice(0, 80);
  const opentab = String(formData.get('_opentab') ?? '').trim();
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (VIEWS.has(view)) p.set('view', view);
  if (anchor.startsWith('t-')) p.set('open', anchor.slice(2));
  if (anchor.startsWith('f-')) p.set('openf', anchor.slice(2));
  // A tile form can ask the re-opened inspector to land on a specific tab
  // (e.g. the Refinements tab) so an edit + save keeps its place.
  if (opentab === 'refinements' || opentab === 'services' || opentab === 'details') {
    p.set('opentab', opentab);
  }
  p.set(kind, msg);
  const url = `${BASE}?${p.toString()}${anchor ? `#${anchor}` : ''}`;
  redirect(url);
}

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
  redirectBack(formData, 'ok', 'Deadline saved.');
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
    redirectBack(formData, 'error', 'Last-minute start must be a whole number of months (0–60).');
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
  if (error) redirectBack(formData, 'error', error.message);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.set_last_minute_start',
    target_table: 'planning_deadlines',
    target_id: refKey,
    after_json: { kind: 'last_minute_start', ref_key: refKey, scope: 'category', offset_value: months },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  redirectBack(
    formData,
    'ok',
    `Last-minute starts ${months} month${months === 1 ? '' : 's'} before the wedding for ${refKey}.`,
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
  if (error) redirectBack(formData, 'error', error.message);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.clear_last_minute_start',
    target_table: 'planning_deadlines',
    target_id: refKey,
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  redirectBack(formData, 'ok', `Last-minute disabled for ${refKey}.`);
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
    redirectBack(formData, 'error', 'Label must be 2–80 characters.');
  }
  const admin = createAdminClient();
  const { data: before } = await admin
    .from('service_categories')
    .select('id, label_en')
    .eq('id', id)
    .maybeSingle();
  if (!before) redirectBack(formData, 'error', 'Node not found.');
  if (before.label_en === label) redirectBack(formData, 'ok', 'No change.');
  const { error } = await admin
    .from('service_categories')
    .update({ label_en: label, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) redirectBack(formData, 'error', error.message);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.rename',
    target_table: 'service_categories',
    target_id: id,
    before_json: before,
    after_json: { id, label_en: label },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(formData, 'ok', `Renamed to "${label}".`);
}

/**
 * Admin: set (or clear) a taxonomy node's couple-facing Lucide icon override in
 * `service_categories.icon_name`. Read live by `getTaxonomy()` → the /explore
 * folder/tile grids swap the icon with no deploy; empty clears back to the
 * hardcoded code default. The name is validated against the curated Lucide
 * allowlist (the nav-registry source of truth) so a bad value can never reach
 * the render path. Audit-logged.
 */
export async function setCategoryIcon(formData: FormData) {
  const user = await requireAdmin();
  const categoryId = String(formData.get('category_id') ?? '').trim();
  if (!categoryId) throw new Error('Missing category_id');
  const next = normalizeIconName(String(formData.get('icon_name') ?? ''));
  if (next === null) {
    redirectBack(formData, 'error', 'Pick an icon from the list.');
  }
  const iconName = next === '' ? null : next;

  const admin = createAdminClient();
  const { data: before } = await admin
    .from('service_categories')
    .select('id, icon_name')
    .eq('id', categoryId)
    .maybeSingle();
  if (!before) redirectBack(formData, 'error', 'Category not found.');
  if ((before.icon_name ?? null) === iconName) {
    redirectBack(formData, 'ok', 'No change.');
  }

  const { error } = await admin
    .from('service_categories')
    .update({ icon_name: iconName, updated_at: new Date().toISOString() })
    .eq('id', categoryId);
  if (error) redirectBack(formData, 'error', error.message);

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.set_icon',
    target_table: 'service_categories',
    target_id: categoryId,
    before_json: { icon_name: before.icon_name ?? null },
    after_json: { icon_name: iconName },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(
    formData,
    'ok',
    iconName ? `Icon set to ${iconName}.` : 'Icon cleared — back to the default.',
  );
}

/**
 * Admin: set (or clear) a taxonomy node's sample photo in
 * `service_categories.sample_photo_r2_key`. Accepts the same refs as
 * /admin/refinements — a `/public` image path or an `r2://` ref, validated by
 * the shared VALID_PHOTO regex (an invalid value is rejected, never stored, so
 * a tampered POST can't inject a `url(…)` background). Empty clears. The value
 * is resolved to a display URL by consumers via `displayUrlForStoredAsset()`.
 * Audit-logged. (No couple-facing photo render ships in this PR.)
 */
export async function setCategoryPhoto(formData: FormData) {
  const user = await requireAdmin();
  const categoryId = String(formData.get('category_id') ?? '').trim();
  if (!categoryId) throw new Error('Missing category_id');
  const raw = String(formData.get('photo_ref') ?? '').trim();
  let photoRef: string | null = null;
  if (raw) {
    if (!VALID_PHOTO.test(raw)) {
      redirectBack(formData, 'error', 'Photo must be a /public image path or an r2:// ref.');
    }
    photoRef = raw;
  }

  const admin = createAdminClient();
  const { data: before } = await admin
    .from('service_categories')
    .select('id, sample_photo_r2_key')
    .eq('id', categoryId)
    .maybeSingle();
  if (!before) redirectBack(formData, 'error', 'Category not found.');
  if ((before.sample_photo_r2_key ?? null) === photoRef) {
    redirectBack(formData, 'ok', 'No change.');
  }

  const { error } = await admin
    .from('service_categories')
    .update({ sample_photo_r2_key: photoRef, updated_at: new Date().toISOString() })
    .eq('id', categoryId);
  if (error) redirectBack(formData, 'error', error.message);

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.set_photo',
    target_table: 'service_categories',
    target_id: categoryId,
    before_json: { sample_photo_r2_key: before.sample_photo_r2_key ?? null },
    after_json: { sample_photo_r2_key: photoRef },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(formData, 'ok', photoRef ? 'Photo saved.' : 'Photo cleared.');
}

/**
 * Admin: toggle a taxonomy node's `service_categories.marketplace_hidden` — an
 * admin-only tile/folder that never surfaces on couple-facing browse surfaces
 * (/explore tile grid, onboarding picker) but stays fully visible in this Studio
 * and to the vendor services picker (vendors must be able to list under hidden
 * tiles like officiants for faith-readiness counts). Boolean toggle read from the
 * `hidden` field ('1' = hide, else visible). No-op guarded. Audit-logged.
 */
export async function setCategoryHidden(formData: FormData) {
  const user = await requireAdmin();
  const categoryId = String(formData.get('category_id') ?? '').trim();
  if (!categoryId) throw new Error('Missing category_id');
  const next = String(formData.get('hidden') ?? '') === '1';

  const admin = createAdminClient();
  const { data: before } = await admin
    .from('service_categories')
    .select('id, marketplace_hidden')
    .eq('id', categoryId)
    .maybeSingle();
  if (!before) redirectBack(formData, 'error', 'Category not found.');
  if ((before.marketplace_hidden ?? false) === next) {
    redirectBack(formData, 'ok', 'No change.');
  }

  const { error } = await admin
    .from('service_categories')
    .update({ marketplace_hidden: next, updated_at: new Date().toISOString() })
    .eq('id', categoryId);
  if (error) redirectBack(formData, 'error', error.message);

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.set_hidden',
    target_table: 'service_categories',
    target_id: categoryId,
    before_json: { marketplace_hidden: before.marketplace_hidden ?? false },
    after_json: { marketplace_hidden: next },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(formData, 'ok', next ? 'Hidden from couples.' : 'Visible on /explore again.');
}

/**
 * Admin: re-map a `canonical_service` to a different tile (+ its parent folder)
 * in `canonical_service_taxonomy`. Read live by `getCanonicalBuckets()` → the
 * /vendors marketplace re-buckets that vendor set with no deploy. Audit-logged.
 * Success lands on the DESTINATION tile (opened) so the move is verifiable —
 * EXCEPT when filing from the Unfiled view, where the tree isn't rendered:
 * stay in the tray so serial filing keeps its place (E1).
 */
export async function remapCanonical(formData: FormData) {
  const user = await requireAdmin();
  const canonical = String(formData.get('canonical_service') ?? '').trim();
  const tileId = String(formData.get('tile_id') ?? '').trim();
  if (!canonical || !tileId) throw new Error('Missing canonical_service or tile_id');
  const stayInTray = formData.get('_view') === 'unfiled';
  const admin = createAdminClient();
  // The destination must exist + be a tile (tier 2); derive its parent folder.
  const { data: tile } = await admin
    .from('service_categories')
    .select('id, parent_id, tier')
    .eq('id', tileId)
    .maybeSingle();
  if (!tile || tile.tier !== 2 || !tile.parent_id) {
    redirectBack(formData, 'error', 'Pick a valid tile.');
  }
  const { data: before } = await admin
    .from('canonical_service_taxonomy')
    .select('canonical_service, folder_id, tile_id')
    .eq('canonical_service', canonical)
    .maybeSingle();
  if (!before) redirectBack(formData, 'error', 'Canonical not found.');
  if (before.tile_id === tileId) {
    redirectBack(formData, 'ok', 'Already on that tile.', stayInTray ? undefined : { anchor: `t-${tileId}` });
  }
  const { error } = await admin
    .from('canonical_service_taxonomy')
    .update({
      tile_id: tileId,
      folder_id: tile.parent_id,
      updated_at: new Date().toISOString(),
    })
    .eq('canonical_service', canonical);
  if (error) redirectBack(formData, 'error', error.message);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.remap_canonical',
    target_table: 'canonical_service_taxonomy',
    target_id: canonical,
    before_json: before,
    after_json: { canonical_service: canonical, folder_id: tile.parent_id, tile_id: tileId },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(
    formData,
    'ok',
    'Re-mapped — the marketplace re-buckets live.',
    stayInTray ? undefined : { anchor: `t-${tileId}` },
  );
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
      redirectBack(formData, 'error', `Unknown faith "${faithRaw}".`);
    }
    faith = faithRaw;
  }

  const { data: before } = await admin
    .from('canonical_service_taxonomy')
    .select('canonical_service, faith, dietary')
    .eq('canonical_service', canonical)
    .maybeSingle();
  if (!before) redirectBack(formData, 'error', 'Canonical not found.');
  if (before.faith === faith) redirectBack(formData, 'ok', 'Faith unchanged.');

  // De-faith guard: a dietary canonical must never be faith-gated — the
  // marketplace filter is INCLUDE-only and would hide it from every
  // non-matching couple (the exact bug fixed 2026-06-11).
  if (faith && before.dietary) {
    redirectBack(
      formData,
      'error',
      'Dietary services stay universal — dietary capability is a per-vendor grade, not a faith gate.',
    );
  }

  const { error } = await admin
    .from('canonical_service_taxonomy')
    .update({ faith, updated_at: new Date().toISOString() })
    .eq('canonical_service', canonical);
  if (error) redirectBack(formData, 'error', error.message);

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.set_faith',
    target_table: 'canonical_service_taxonomy',
    target_id: canonical,
    before_json: { faith: before.faith ?? null },
    after_json: { faith },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(
    formData,
    'ok',
    faith ? `Faith set to ${faith} — surfaces only for matching couples.` : 'Faith cleared — universal.',
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
  if (!cat) redirectBack(formData, 'error', 'Category not found.');

  let next: string[] | null = null;
  if (selected.length > 0) {
    const { data: vocab } = await admin
      .from('event_type_vocab')
      .select('event_type')
      .eq('status', 'active');
    const valid = new Set((vocab ?? []).map((v) => v.event_type));
    const unknown = selected.filter((s) => !valid.has(s));
    if (unknown.length > 0) {
      redirectBack(formData, 'error', 'Unknown event type(s): ' + unknown.join(', '));
    }
    // Every event selected == no restriction → store NULL (universal).
    next = selected.length >= valid.size ? null : selected.sort();
  }

  const { error } = await admin
    .from('service_categories')
    .update({ applicable_event_types: next })
    .eq('id', categoryId);
  if (error) redirectBack(formData, 'error', error.message);

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.set_event_types',
    target_table: 'service_categories',
    target_id: categoryId,
    before_json: { applicable_event_types: cat.applicable_event_types ?? null },
    after_json: { applicable_event_types: next },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(
    formData,
    'ok',
    next === null ? 'Set to universal (all events).' : 'Event types updated — live on the marketplace.',
  );
}

/**
 * Admin: set the event-type scope of EVERY tile under a parent folder in one
 * submit (the parent-grain bulk control — design-memo §5). Explicit by
 * construction (A4): a required `scope_mode` radio (universal | scoped) means
 * the destructive "wipe every per-tile scope" meaning is always a deliberate
 * choice, and a required `confirm_overwrite` checkbox is re-checked server-side
 * (native `required` is the zero-JS first layer). Scoped + zero chips = error,
 * never a silent universal. All-chips-selected still collapses to NULL (house
 * semantics). ONE audit row carries the per-tile before-map — the manual-restore
 * path (no UI undo in V1).
 */
export async function setFolderEventTypes(formData: FormData) {
  const user = await requireAdmin();
  const parentId = String(formData.get('parent_id') ?? '').trim();
  if (!parentId) throw new Error('Missing parent_id');

  const admin = createAdminClient();
  const { data: parent } = await admin
    .from('service_categories')
    .select('id, tier')
    .eq('id', parentId)
    .maybeSingle();
  if (!parent || parent.tier !== 1) {
    redirectBack(formData, 'error', 'Pick a valid parent.');
  }

  // Server re-check of the native `required` confirmation (zero-JS guard).
  if (formData.get('confirm_overwrite') !== 'on') {
    redirectBack(formData, 'error', 'Tick the overwrite confirmation first.');
  }

  const scopeMode = String(formData.get('scope_mode') ?? '');
  if (scopeMode !== 'universal' && scopeMode !== 'scoped') {
    redirectBack(formData, 'error', 'Choose Universal or Scoped first.');
  }

  const selected = Array.from(
    new Set(
      formData
        .getAll('event_types')
        .map((v) => String(v).trim())
        .filter(Boolean),
    ),
  );

  let next: string[] | null = null;
  if (scopeMode === 'scoped') {
    if (selected.length === 0) {
      redirectBack(formData, 'error', 'Pick at least one event, or choose Universal.');
    }
    const { data: vocab } = await admin
      .from('event_type_vocab')
      .select('event_type')
      .eq('status', 'active');
    const valid = new Set((vocab ?? []).map((v) => v.event_type));
    const unknown = selected.filter((s) => !valid.has(s));
    if (unknown.length > 0) {
      redirectBack(formData, 'error', 'Unknown event type(s): ' + unknown.join(', '));
    }
    // Every event selected == no restriction → store NULL (universal).
    next = selected.length >= valid.size ? null : selected.sort();
  }

  const { data: tiles } = await admin
    .from('service_categories')
    .select('id, applicable_event_types')
    .eq('parent_id', parentId)
    .eq('tier', 2);
  const tileRows = (tiles ?? []) as { id: string; applicable_event_types: string[] | null }[];
  if (tileRows.length === 0) {
    redirectBack(formData, 'error', 'No tiles under this folder.');
  }
  const tileIds = tileRows.map((t) => t.id);

  const scopeKey = (v: string[] | null) => JSON.stringify((v ?? []).slice().sort());
  const nextKey = scopeKey(next);
  const changedIds = tileRows.filter((t) => scopeKey(t.applicable_event_types ?? null) !== nextKey).map((t) => t.id);
  const prevScopedCount = tileRows.filter((t) => (t.applicable_event_types?.length ?? 0) > 0).length;

  const { error } = await admin
    .from('service_categories')
    .update({ applicable_event_types: next })
    .in('id', tileIds);
  if (error) redirectBack(formData, 'error', error.message);

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.bulk_set_event_types',
    target_table: 'service_categories',
    target_id: parentId,
    before_json: {
      tiles: Object.fromEntries(tileRows.map((t) => [t.id, t.applicable_event_types ?? null])),
    },
    after_json: { applicable_event_types: next, tile_ids: tileIds, changed_tile_ids: changedIds },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(
    formData,
    'ok',
    `Applied to ${tileIds.length} tiles (${changedIds.length} changed${prevScopedCount ? `, ${prevScopedCount} previously had their own scope` : ''}).`,
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
 * tile goes live on `/explore` with no deploy (the catalog reads the snapshot),
 * ready to receive re-mapped canonicals. Audit-logged.
 */
export async function createTaxonomyNode(formData: FormData) {
  const user = await requireAdmin();
  const parentId = String(formData.get('parent_id') ?? '').trim();
  const label = String(formData.get('label_en') ?? '').trim();
  if (!parentId) throw new Error('Missing parent_id');
  if (label.length < 2 || label.length > 80) {
    redirectBack(formData, 'error', 'Label must be 2–80 characters.');
  }
  const id = slugify(label, '_');
  const slug = slugify(label, '-');
  if (!id || !slug) {
    redirectBack(formData, 'error', 'Label needs letters or numbers.');
  }
  const admin = createAdminClient();
  const { data: parent } = await admin
    .from('service_categories')
    .select('id, tier')
    .eq('id', parentId)
    .maybeSingle();
  if (!parent || parent.tier !== 1) {
    redirectBack(formData, 'error', 'Pick a valid parent.');
  }
  const { data: existing } = await admin
    .from('service_categories')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (existing) {
    redirectBack(formData, 'error', `A node "${id}" already exists — pick a different label.`);
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
  if (error) redirectBack(formData, 'error', error.message);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.create',
    target_table: 'service_categories',
    target_id: id,
    after_json: row,
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(formData, 'ok', `Added tile "${label}" under ${parentId}.`);
}

/**
 * Admin: delete a tile. Guarded against orphans — refuses if it has child nodes
 * or any canonical_service still mapped to it (re-map those first). Parents are
 * owner-managed and not deletable here. Audit-logged. Success lands on the
 * parent FOLDER (the tile is gone); failures land back on the tile, open.
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
  if (!before) redirectBack(formData, 'error', 'Node not found.');
  if (before.tier === 1) {
    redirectBack(formData, 'error', 'Parents are owner-managed — can’t delete here.');
  }
  const { count: childCount } = await admin
    .from('service_categories')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', id);
  if ((childCount ?? 0) > 0) {
    redirectBack(formData, 'error', 'Has sub-categories — remove them first.');
  }
  const { count: mappedCount } = await admin
    .from('canonical_service_taxonomy')
    .select('canonical_service', { count: 'exact', head: true })
    .eq('tile_id', id);
  if ((mappedCount ?? 0) > 0) {
    redirectBack(formData, 'error', `${mappedCount} service(s) still mapped here — re-map them first.`);
  }
  const { error } = await admin.from('service_categories').delete().eq('id', id);
  if (error) redirectBack(formData, 'error', error.message);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.delete',
    target_table: 'service_categories',
    target_id: id,
    before_json: before,
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(
    formData,
    'ok',
    `Deleted "${before.label_en}".`,
    before.parent_id ? { anchor: `f-${before.parent_id}` } : undefined,
  );
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
    redirectBack(formData, 'error', 'This node can’t be moved.');
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
  if (!sibling) redirectBack(formData, 'ok', 'Already at the edge.');
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
  revalidatePath('/explore');
  redirectBack(formData, 'ok', `Moved ${direction}.`);
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
 * service). Audit-logged. Success lands on the destination tile, opened, so
 * the new service is on screen.
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
    redirectBack(formData, 'error', 'Service name must be 2–80 characters.');
  }
  const canonical = slugify(label, '_');
  if (!canonical) {
    redirectBack(formData, 'error', 'Name needs letters or numbers.');
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
      redirectBack(formData, 'error', `Unknown faith "${faithRaw}".`);
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
    redirectBack(formData, 'error', 'Pick a valid tile.');
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
    redirectBack(formData, 'error', `A service "${canonical}" already exists — pick a different name.`);
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
  if (schemaErr) redirectBack(formData, 'error', schemaErr.message);

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
    redirectBack(formData, 'error', taxErr.message);
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
  revalidatePath('/explore');
  redirectBack(
    formData,
    'ok',
    `Added service "${label}" under ${tileId}${refinementLabel ? ` with a "${refinementLabel}" refinement` : ''}.`,
    { anchor: `t-${tileId}` },
  );
}

// ── Vendor "request a category" review (taxonomy_category_requests · §3.2c) ───
// A vendor's proposal lands as a PENDING request; an admin resolves it with one
// of four outcomes. All audit-logged; the vendor tracks the result read-only.

/**
 * PROMOTE — mint a real canonical leaf for the request under a chosen tile, then
 * mark the request `promoted` (the proposing vendor keeps first-vendor credit via
 * the audit trail). Same two-table leaf write as `createCanonicalLeaf`. Success
 * lands on the destination tile, opened, so the new service is on screen.
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
  if (!req) redirectBack(formData, 'error', 'Request not found.');
  if (req.status !== 'pending') {
    redirectBack(formData, 'error', 'That request was already resolved.');
  }

  const { data: tile } = await admin
    .from('service_categories')
    .select('id, parent_id, tier')
    .eq('id', tileId)
    .maybeSingle();
  if (!tile || tile.tier !== 2 || !tile.parent_id) {
    redirectBack(formData, 'error', 'Pick a valid tile.');
  }

  const canonical = slugify(req.proposed_label, '_');
  if (!canonical) {
    redirectBack(formData, 'error', 'Label needs letters or numbers.');
  }

  const [schemaDupe, taxDupe] = await Promise.all([
    admin.from('canonical_service_schemas').select('canonical_service').eq('canonical_service', canonical).maybeSingle(),
    admin.from('canonical_service_taxonomy').select('canonical_service').eq('canonical_service', canonical).maybeSingle(),
  ]);
  if (schemaDupe.data || taxDupe.data) {
    redirectBack(formData, 'error', `"${canonical}" already exists — use Map instead of Promote.`);
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
  if (schemaErr) redirectBack(formData, 'error', schemaErr.message);

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
    redirectBack(formData, 'error', taxErr.message);
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
  revalidatePath('/explore');
  redirectBack(formData, 'ok', `Promoted "${req.proposed_label}" → new service "${canonical}".`, {
    anchor: `t-${tileId}`,
  });
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
    redirectBack(formData, 'error', 'Pick an existing service to map to.');
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
  if (error) redirectBack(formData, 'error', error.message);

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.request_map',
    target_table: 'taxonomy_category_requests',
    target_id: requestId,
    after_json: { mapped_to_canonical: canonical },
    actor_user_id: user.id,
  });

  revalidatePath(BASE);
  redirectBack(formData, 'ok', `Mapped to "${canonical}".`);
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
  if (error) redirectBack(formData, 'error', error.message);

  await admin.from('admin_audit_log').insert({
    action: `taxonomy.request_${outcome}`,
    target_table: 'taxonomy_category_requests',
    target_id: requestId,
    after_json: { status: outcome, resolution_note: note },
    actor_user_id: user.id,
  });

  revalidatePath(BASE);
  redirectBack(formData, 'ok', outcome === 'kept_private' ? 'Kept private.' : 'Request rejected.');
}

// ── Taxonomy Studio drag actions (JSON-returning · Phase 2 visual editor) ─────
// These fire from the drag/drop client (a `fetch` to the server action, NOT a
// form navigation), so they return `{ ok }` / `{ error }` and the client calls
// `router.refresh()` on success. They keep the SAME admin gate + audit-log
// contract as every other action here; only the error channel differs (a JSON
// payload instead of a redirect-with-?error=).

/**
 * JSON-flavoured admin gate for the Studio actions: same defense-in-depth check
 * as `requireAdmin`, but returns `{ user }` or `{ error }` instead of throwing /
 * redirecting so the caller can hand the client a clean `StudioActionResult`.
 */
async function requireAdminJson(): Promise<
  { user: { id: string } } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    return { error: 'Forbidden.' };
  }
  return { user };
}

/**
 * Admin: persist a drag-to-reorder of the tiles under one folder. The client
 * sends the folder id + the full new order of its child tile ids. We validate
 * the set is EXACTLY that folder's current children (a permutation — a drag can
 * shuffle but never add / drop / dupe a tile) via the pure `validateReorder`,
 * then write only the rows whose sort_order actually changed (`computeReorder`).
 * ONE audit row carries the before/after order arrays. The /explore catalogue
 * reads tile order from the snapshot, so the marketplace re-orders live.
 */
export async function reorderCategories(
  parentId: string,
  orderedIds: string[],
): Promise<StudioActionResult> {
  const gate = await requireAdminJson();
  if ('error' in gate) return { ok: false, error: gate.error };

  const parent = String(parentId ?? '').trim();
  const ordered = (orderedIds ?? []).map((s) => String(s).trim()).filter(Boolean);
  if (!parent) return { ok: false, error: 'Missing folder.' };

  const admin = createAdminClient();
  const { data: children } = await admin
    .from('service_categories')
    .select('id, sort_order')
    .eq('parent_id', parent)
    .eq('tier', 2);
  const rows = (children ?? []) as { id: string; sort_order: number }[];
  if (rows.length === 0) return { ok: false, error: 'No tiles under this folder.' };

  const currentIds = rows.map((r) => r.id);
  const valid = validateReorder(currentIds, ordered);
  if (!valid.ok) return { ok: false, error: valid.reason };

  const currentSort: Record<string, number> = {};
  for (const r of rows) currentSort[r.id] = r.sort_order;
  const writes = computeReorder(ordered, currentSort);
  if (writes.length === 0) return { ok: true, message: 'Order unchanged.' };

  // Sequential writes (no unique constraint on sort_order → interim collisions
  // are fine). A failure mid-way leaves a partially-applied order, but every
  // sort_order is still a valid integer and the next successful reorder makes it
  // dense again — no orphan / stranded canonical can result from a sort shuffle.
  for (const w of writes) {
    const { error } = await admin
      .from('service_categories')
      .update({ sort_order: w.sort_order, updated_at: new Date().toISOString() })
      .eq('id', w.id);
    if (error) return { ok: false, error: error.message };
  }

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.reorder',
    target_table: 'service_categories',
    target_id: parent,
    before_json: { order: currentIds },
    after_json: { order: ordered },
    actor_user_id: gate.user.id,
  });

  revalidatePath(BASE);
  revalidatePath('/explore');
  return { ok: true, message: 'Order saved.' };
}

/**
 * Admin: move a TILE to a different parent folder (drag onto a folder in the
 * left rail, or the inspector's "Move to folder…" picker). Re-parents the tile
 * AND re-points the DENORMALIZED `canonical_service_taxonomy.folder_id` for every
 * canonical filed on it — the two writes must stay consistent, so the second is
 * guarded with a compensating rollback if it fails. The tile appends to the end
 * of the destination folder (max sibling sort_order + 1). A tile with child
 * nodes (tier-3) is refused — only leaf tiles move here. ONE audit row carries
 * the before/after parent + the re-pointed canonical count.
 */
export async function moveTileToFolder(
  tileId: string,
  newParentId: string,
): Promise<StudioActionResult> {
  const gate = await requireAdminJson();
  if ('error' in gate) return { ok: false, error: gate.error };

  const tile = String(tileId ?? '').trim();
  const newParent = String(newParentId ?? '').trim();
  if (!tile || !newParent) return { ok: false, error: 'Missing tile or destination.' };
  if (tile === newParent) return { ok: false, error: 'Pick a different folder.' };

  const admin = createAdminClient();
  const { data: tileRow } = await admin
    .from('service_categories')
    .select('id, parent_id, tier')
    .eq('id', tile)
    .maybeSingle();
  if (!tileRow || tileRow.tier !== 2) return { ok: false, error: 'That’s not a movable tile.' };
  if (tileRow.parent_id === newParent) return { ok: true, message: 'Already in that folder.' };

  const { data: destRow } = await admin
    .from('service_categories')
    .select('id, tier')
    .eq('id', newParent)
    .maybeSingle();
  if (!destRow || destRow.tier !== 1) return { ok: false, error: 'Pick a valid folder.' };

  // A tile with sub-categories (tier-3) can't be blindly re-homed here.
  const { count: childCount } = await admin
    .from('service_categories')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', tile);
  if ((childCount ?? 0) > 0) {
    return { ok: false, error: 'This tile has sub-categories — move those first.' };
  }

  // Append to the end of the destination folder.
  const { data: lastSibling } = await admin
    .from('service_categories')
    .select('sort_order')
    .eq('parent_id', newParent)
    .eq('tier', 2)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = ((lastSibling?.sort_order as number | undefined) ?? -1) + 1;

  const prevParent = tileRow.parent_id;

  // 1. Re-parent the tile.
  const { error: parentErr } = await admin
    .from('service_categories')
    .update({ parent_id: newParent, sort_order: nextSort, updated_at: new Date().toISOString() })
    .eq('id', tile);
  if (parentErr) return { ok: false, error: parentErr.message };

  // 2. Re-point the denormalized folder_id on every canonical filed on the tile.
  const { data: mapped } = await admin
    .from('canonical_service_taxonomy')
    .select('canonical_service')
    .eq('tile_id', tile);
  const repointCount = (mapped ?? []).length;
  const { error: mapErr } = await admin
    .from('canonical_service_taxonomy')
    .update({ folder_id: newParent, updated_at: new Date().toISOString() })
    .eq('tile_id', tile);
  if (mapErr) {
    // Compensating rollback — restore the tile's parent so the denormalized
    // folder_id and the tile's parent never disagree (a split state would
    // mis-bucket the whole tile in the marketplace).
    await admin
      .from('service_categories')
      .update({ parent_id: prevParent, updated_at: new Date().toISOString() })
      .eq('id', tile);
    return { ok: false, error: `Could not re-point services: ${mapErr.message}` };
  }

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.move_tile',
    target_table: 'service_categories',
    target_id: tile,
    before_json: { parent_id: prevParent },
    after_json: { parent_id: newParent, repointed_canonicals: repointCount },
    actor_user_id: gate.user.id,
  });

  revalidatePath(BASE);
  revalidatePath('/explore');
  return {
    ok: true,
    message: repointCount > 0 ? `Moved — ${repointCount} service(s) re-pointed.` : 'Moved.',
  };
}

/**
 * Admin: delete a tile, moving its contents to a destination tile first. Extends
 * the guarded `deleteTaxonomyNode`: if the tile still has canonicals or anchored
 * refinements, a `destinationTileId` is REQUIRED (no operation may strand a
 * canonical off a leaf — the never-strand lock). We re-point
 * `canonical_service_taxonomy` (tile_id + denormalized folder_id) and
 * `onboarding_refinements.tile_id` to the destination, then delete the tile.
 * Sequential writes with a compensating rollback if a later step fails. A tile
 * with child nodes (tier-3) still hard-blocks. ONE audit row carries the full
 * before-map. An EMPTY tile needs no destination (plain delete).
 */
export async function deleteTileWithDestination(
  tileId: string,
  destinationTileId?: string,
): Promise<StudioActionResult> {
  const gate = await requireAdminJson();
  if ('error' in gate) return { ok: false, error: gate.error };

  const tile = String(tileId ?? '').trim();
  const dest = String(destinationTileId ?? '').trim();
  if (!tile) return { ok: false, error: 'Missing tile.' };

  const admin = createAdminClient();
  const { data: tileRow } = await admin
    .from('service_categories')
    .select('id, tier, label_en, parent_id')
    .eq('id', tile)
    .maybeSingle();
  if (!tileRow) return { ok: false, error: 'Tile not found.' };
  if (tileRow.tier === 1) return { ok: false, error: 'Folders are owner-managed — can’t delete here.' };

  // Sub-categories still hard-block (tier-3) — those aren't re-pointable here.
  const { count: childCount } = await admin
    .from('service_categories')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', tile);
  if ((childCount ?? 0) > 0) {
    return { ok: false, error: 'This tile has sub-categories — remove those first.' };
  }

  const [canonRes, refRes] = await Promise.all([
    admin.from('canonical_service_taxonomy').select('canonical_service').eq('tile_id', tile),
    admin.from('onboarding_refinements').select('leaf_key').eq('tile_id', tile),
  ]);
  const canonicals = (canonRes.data ?? []).map((r) => r.canonical_service as string);
  const refinements = (refRes.data ?? []).map((r) => r.leaf_key as string);
  const hasContents = canonicals.length > 0 || refinements.length > 0;

  // Empty tile → plain delete, no destination needed.
  if (!hasContents) {
    const { error } = await admin.from('service_categories').delete().eq('id', tile);
    if (error) return { ok: false, error: error.message };
    await admin.from('admin_audit_log').insert({
      action: 'taxonomy.delete_tile',
      target_table: 'service_categories',
      target_id: tile,
      before_json: { label_en: tileRow.label_en, parent_id: tileRow.parent_id, canonicals: [], refinements: [] },
      actor_user_id: gate.user.id,
    });
    revalidatePath(BASE);
    revalidatePath('/explore');
    return { ok: true, message: `Deleted "${tileRow.label_en}".` };
  }

  // Non-empty → a destination is mandatory (never strand a canonical).
  if (!dest) {
    return {
      ok: false,
      error: 'This tile still holds services or refinements — choose a destination tile for them.',
    };
  }
  if (dest === tile) return { ok: false, error: 'Pick a different destination tile.' };
  const { data: destRow } = await admin
    .from('service_categories')
    .select('id, parent_id, tier')
    .eq('id', dest)
    .maybeSingle();
  if (!destRow || destRow.tier !== 2 || !destRow.parent_id) {
    return { ok: false, error: 'Pick a valid destination tile.' };
  }

  // 1. Re-point canonicals (tile_id + denormalized folder_id → dest's folder).
  if (canonicals.length > 0) {
    const { error } = await admin
      .from('canonical_service_taxonomy')
      .update({ tile_id: dest, folder_id: destRow.parent_id, updated_at: new Date().toISOString() })
      .eq('tile_id', tile);
    if (error) return { ok: false, error: `Could not move services: ${error.message}` };
  }

  // 2. Re-point anchored refinements.
  if (refinements.length > 0) {
    const { error } = await admin
      .from('onboarding_refinements')
      .update({ tile_id: dest, updated_at: new Date().toISOString() })
      .eq('tile_id', tile);
    if (error) {
      // Compensating rollback of step 1 so nothing is stranded on a
      // half-emptied, about-to-be-deleted tile.
      if (canonicals.length > 0) {
        await admin
          .from('canonical_service_taxonomy')
          .update({ tile_id: tile, folder_id: tileRow.parent_id, updated_at: new Date().toISOString() })
          .in('canonical_service', canonicals);
      }
      return { ok: false, error: `Could not move refinements: ${error.message}` };
    }
  }

  // 3. Delete the now-empty tile.
  const { error: delErr } = await admin.from('service_categories').delete().eq('id', tile);
  if (delErr) {
    // Rollback both re-points — the tile survives, so its contents must too.
    if (canonicals.length > 0) {
      await admin
        .from('canonical_service_taxonomy')
        .update({ tile_id: tile, folder_id: tileRow.parent_id, updated_at: new Date().toISOString() })
        .in('canonical_service', canonicals);
    }
    if (refinements.length > 0) {
      await admin
        .from('onboarding_refinements')
        .update({ tile_id: tile, updated_at: new Date().toISOString() })
        .in('leaf_key', refinements);
    }
    return { ok: false, error: delErr.message };
  }

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.delete_tile',
    target_table: 'service_categories',
    target_id: tile,
    before_json: {
      label_en: tileRow.label_en,
      parent_id: tileRow.parent_id,
      canonicals,
      refinements,
      moved_to: dest,
    },
    after_json: { moved_to: dest, moved_canonicals: canonicals.length, moved_refinements: refinements.length },
    actor_user_id: gate.user.id,
  });

  revalidatePath(BASE);
  revalidatePath('/explore');
  return {
    ok: true,
    message: `Deleted "${tileRow.label_en}" — ${canonicals.length} service(s) and ${refinements.length} refinement set(s) moved.`,
  };
}

// ── Refinements (Studio inspector · Refinements tab) ────────────────────────────
//
// These edit the onboarding "what kind of X?" refinements anchored to a tile
// (onboarding_refinements.tile_id + onboarding_refinement_options). The four CRUD
// actions are redirect-back form actions (they re-open the tile on the
// Refinements tab via the `t-<tile>` anchor + `_opentab=refinements`). The two
// reorder actions return JSON (drag/up-down) following the PR-2 pattern exactly.
// All logic lives in lib/refinements-mutations.ts so it's shared, key-immutable,
// and photo-validated in one place. leaf_key / option_key are NEVER regenerated.

/** Update a refinement leaf's label / description / status / main photo. */
export async function updateRefinementLeaf(leafKey: string, formData: FormData) {
  const user = await requireAdmin();
  const key = String(leafKey ?? '').trim();
  if (!key) redirectBack(formData, 'error', 'Missing leaf.');
  const admin = createAdminClient();
  const res = await updateLeafCore(admin, key, {
    label: String(formData.get('label_en') ?? ''),
    description: String(formData.get('description_en') ?? ''),
    mainPhotoUploaded: formData.get('main_photo_url'),
    mainPhotoCurrent: formData.get('main_photo_current'),
    retired: formData.get('status') === 'retired',
  });
  if (!res.ok) redirectBack(formData, 'error', res.error);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.update_refinement_leaf',
    target_table: 'onboarding_refinements',
    target_id: key,
    after_json: { label_en: String(formData.get('label_en') ?? '').trim(), retired: formData.get('status') === 'retired' },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath(ONBOARDING_PATH);
  redirectBack(formData, 'ok', 'Refinement saved.');
}

/** Update an existing option's emoji / label / status / photo. */
export async function updateRefinementOption(leafKey: string, optionKey: string, formData: FormData) {
  const user = await requireAdmin();
  const key = String(leafKey ?? '').trim();
  const opt = String(optionKey ?? '').trim();
  if (!key || !opt) redirectBack(formData, 'error', 'Missing option.');
  const admin = createAdminClient();
  const res = await updateOptionCore(admin, key, opt, {
    emoji: String(formData.get('emoji') ?? ''),
    label: String(formData.get('label_en') ?? ''),
    photoUploaded: formData.get('photo_url'),
    photoCurrent: formData.get('photo_current'),
    retired: formData.get('status') === 'retired',
  });
  if (!res.ok) redirectBack(formData, 'error', res.error);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.update_refinement_option',
    target_table: 'onboarding_refinement_options',
    target_id: `${key}:${opt}`,
    after_json: { label_en: String(formData.get('label_en') ?? '').trim(), retired: formData.get('status') === 'retired' },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath(ONBOARDING_PATH);
  redirectBack(formData, 'ok', 'Option saved.');
}

/** Add a new option to a leaf (photo REQUIRED · projectable leaves blocked). */
export async function addRefinementOption(leafKey: string, formData: FormData) {
  const user = await requireAdmin();
  const key = String(leafKey ?? '').trim();
  if (!key) redirectBack(formData, 'error', 'Missing leaf.');
  const admin = createAdminClient();
  const label = String(formData.get('label_en') ?? '').trim();
  const res = await addOptionCore(admin, key, {
    emoji: String(formData.get('emoji') ?? ''),
    label,
    photoUploaded: formData.get('photo_url'),
  });
  if (!res.ok) redirectBack(formData, 'error', res.error);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.add_refinement_option',
    target_table: 'onboarding_refinement_options',
    target_id: `${key}:${label}`,
    after_json: { leaf_key: key, option_key: label },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath(ONBOARDING_PATH);
  redirectBack(formData, 'ok', `Added “${label}”.`);
}

/** Permanently remove an option (projectable leaves blocked). */
export async function removeRefinementOption(leafKey: string, optionKey: string, formData: FormData) {
  const user = await requireAdmin();
  const key = String(leafKey ?? '').trim();
  const opt = String(optionKey ?? '').trim();
  if (!key || !opt) redirectBack(formData, 'error', 'Missing option.');
  const admin = createAdminClient();
  const res = await removeOptionCore(admin, key, opt);
  if (!res.ok) redirectBack(formData, 'error', res.error);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.remove_refinement_option',
    target_table: 'onboarding_refinement_options',
    target_id: `${key}:${opt}`,
    before_json: { leaf_key: key, option_key: opt },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath(ONBOARDING_PATH);
  redirectBack(formData, 'ok', 'Option removed.');
}

/**
 * Admin: persist a drag-to-reorder of the LEAVES anchored to one tile. The
 * client sends the tile id + the full new order of its leaf keys. Validated as a
 * permutation of the tile's current leaves (a drag can shuffle but never add /
 * drop / dupe) via the shared `validateReorder`, then only the rows whose
 * sort_order actually changed get a write (`computeReorder`). ONE audit row
 * carries the before/after order arrays. Onboarding reads leaf order live.
 */
export async function reorderRefinementLeaves(
  tileId: string,
  orderedLeafKeys: string[],
): Promise<StudioActionResult> {
  const gate = await requireAdminJson();
  if ('error' in gate) return { ok: false, error: gate.error };

  const tile = String(tileId ?? '').trim();
  const ordered = (orderedLeafKeys ?? []).map((s) => String(s).trim()).filter(Boolean);
  if (!tile) return { ok: false, error: 'Missing tile.' };

  const admin = createAdminClient();
  const { data: leaves } = await admin
    .from('onboarding_refinements')
    .select('leaf_key, sort_order')
    .eq('tile_id', tile);
  const rows = (leaves ?? []) as { leaf_key: string; sort_order: number }[];
  if (rows.length === 0) return { ok: false, error: 'No refinements anchored to this tile.' };

  const currentIds = rows.map((r) => r.leaf_key);
  const valid = validateReorder(currentIds, ordered);
  if (!valid.ok) return { ok: false, error: valid.reason };

  const currentSort: Record<string, number> = {};
  for (const r of rows) currentSort[r.leaf_key] = r.sort_order;
  const writes = computeReorder(ordered, currentSort);
  if (writes.length === 0) return { ok: true, message: 'Order unchanged.' };

  for (const w of writes) {
    const { error } = await admin
      .from('onboarding_refinements')
      .update({ sort_order: w.sort_order, updated_at: new Date().toISOString() })
      .eq('leaf_key', w.id);
    if (error) return { ok: false, error: error.message };
  }

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.reorder_refinement_leaves',
    target_table: 'onboarding_refinements',
    target_id: tile,
    before_json: { order: currentIds },
    after_json: { order: ordered },
    actor_user_id: gate.user.id,
  });

  revalidatePath(BASE);
  revalidatePath(ONBOARDING_PATH);
  return { ok: true, message: 'Order saved.' };
}

/**
 * Admin: persist a drag-to-reorder of the OPTIONS within one leaf. Same shape as
 * reorderRefinementLeaves — validated as a permutation of the leaf's current
 * option keys, minimal-diff writes, ONE audit row. Option order is what couples
 * see in the "what kind of X?" grid.
 */
export async function reorderRefinementOptions(
  leafKey: string,
  orderedOptionKeys: string[],
): Promise<StudioActionResult> {
  const gate = await requireAdminJson();
  if ('error' in gate) return { ok: false, error: gate.error };

  const leaf = String(leafKey ?? '').trim();
  const ordered = (orderedOptionKeys ?? []).map((s) => String(s).trim()).filter(Boolean);
  if (!leaf) return { ok: false, error: 'Missing leaf.' };

  const admin = createAdminClient();
  const { data: opts } = await admin
    .from('onboarding_refinement_options')
    .select('option_key, sort_order')
    .eq('leaf_key', leaf);
  const rows = (opts ?? []) as { option_key: string; sort_order: number }[];
  if (rows.length === 0) return { ok: false, error: 'No options under this refinement.' };

  const currentIds = rows.map((r) => r.option_key);
  const valid = validateReorder(currentIds, ordered);
  if (!valid.ok) return { ok: false, error: valid.reason };

  const currentSort: Record<string, number> = {};
  for (const r of rows) currentSort[r.option_key] = r.sort_order;
  const writes = computeReorder(ordered, currentSort);
  if (writes.length === 0) return { ok: true, message: 'Order unchanged.' };

  for (const w of writes) {
    const { error } = await admin
      .from('onboarding_refinement_options')
      .update({ sort_order: w.sort_order, updated_at: new Date().toISOString() })
      .eq('leaf_key', leaf)
      .eq('option_key', w.id);
    if (error) return { ok: false, error: error.message };
  }

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.reorder_refinement_options',
    target_table: 'onboarding_refinement_options',
    target_id: leaf,
    before_json: { order: currentIds },
    after_json: { order: ordered },
    actor_user_id: gate.user.id,
  });

  revalidatePath(BASE);
  revalidatePath(ONBOARDING_PATH);
  return { ok: true, message: 'Order saved.' };
}

// ── Leaf REFINEMENTS (vendor attribute schema) ──────────────────────────────
//
// The owner-clarified "refinements" = the per-leaf vendor attributes stored in
// `canonical_service_schemas.category_specific_attributes` (shooting_style,
// cuisine, coverage_hours, …). These redirect-back form actions are the Studio's
// FIRST editor for them. Every write is ADDITIVE-ONLY (0044 never-orphan
// contract, enforced in lib/leaf-attribute-schema.ts): keys + option VALUES are
// immutable, retire is soft, and each write bumps schema_version +1. The pure
// module does all the JSONB shaping + validation; these actions only load the
// row, apply the result, audit before/after of the touched field, and
// revalidate the Studio + the vendor form that renders the schema.

/**
 * Shared spine for the five leaf-refinement form actions. Loads the schema row,
 * runs the caller's pure mutation, writes `category_specific_attributes` +
 * `schema_version` in one UPDATE, and audits the before/after of just the
 * touched field so the log stays legible. Redirect-back keeps the inspector on
 * the Services tab (`_opentab=services`) so a save re-opens where the admin was.
 */
async function applyLeafAttributeMutation(
  formData: FormData,
  fieldKeyForAudit: string,
  auditAction: string,
  mutate: (attrs: LeafAttributeMap, version: number) => SchemaMutationResult,
  successMsg: (result: Extract<SchemaMutationResult, { ok: true }>) => string,
): Promise<never> {
  const user = await requireAdmin();
  const canonical = String(formData.get('canonical_service') ?? '').trim();
  if (!canonical) redirectBack(formData, 'error', 'Missing service.');

  const admin = createAdminClient();
  const { data: row, error: readErr } = await admin
    .from('canonical_service_schemas')
    .select('canonical_service, schema_version, category_specific_attributes')
    .eq('canonical_service', canonical)
    .maybeSingle();
  if (readErr) redirectBack(formData, 'error', readErr.message);
  if (!row) redirectBack(formData, 'error', `Unknown service "${canonical}".`);

  const before = (row.category_specific_attributes ?? {}) as LeafAttributeMap;
  const version = (row.schema_version as number) ?? 1;
  const result = mutate(before, version);
  if (!result.ok) redirectBack(formData, 'error', result.error);

  const { error: writeErr } = await admin
    .from('canonical_service_schemas')
    .update({
      category_specific_attributes: result.attributes,
      schema_version: result.schemaVersion,
      updated_at: new Date().toISOString(),
    })
    .eq('canonical_service', canonical);
  if (writeErr) redirectBack(formData, 'error', writeErr.message);

  await admin.from('admin_audit_log').insert({
    action: auditAction,
    target_table: 'canonical_service_schemas',
    target_id: canonical,
    before_json: {
      schema_version: version,
      field: fieldKeyForAudit || null,
      def: fieldKeyForAudit ? before[fieldKeyForAudit] ?? null : null,
    },
    after_json: {
      schema_version: result.schemaVersion,
      field: fieldKeyForAudit || null,
      def: fieldKeyForAudit ? result.attributes[fieldKeyForAudit] ?? null : null,
    },
    actor_user_id: user.id,
  });

  revalidatePath(BASE);
  revalidatePath(VENDOR_ATTR_PATH);
  revalidatePath('/explore');
  redirectBack(formData, 'ok', successMsg(result), {
    anchor: `t-${String(formData.get('tile_id') ?? '')}`,
  });
}

/**
 * Admin: add a NEW refinement (attribute field) to a leaf. Label → immutable
 * snake_case key (collision-checked against every existing field, retired or
 * not). Type is one of the vendor-form-supported shapes; enum / multi_select
 * carry an initial comma-separated option list.
 */
export async function addLeafAttributeFieldAction(formData: FormData): Promise<never> {
  const label = String(formData.get('field_label') ?? '').trim();
  const type = String(formData.get('field_type') ?? '').trim();
  const optionsRaw = String(formData.get('field_options') ?? '').trim();
  const options = optionsRaw
    ? optionsRaw.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
  const key = slugify(label, '_');
  return applyLeafAttributeMutation(
    formData,
    key,
    'taxonomy.leaf_attr_add_field',
    (attrs, v) => addLeafAttributeField(attrs, v, { label, type, options }),
    () => `Added refinement "${label}".`,
  );
}

/** Admin: add an option to an existing pick-one / pick-many refinement. */
export async function addLeafAttributeOptionAction(formData: FormData): Promise<never> {
  const fieldKey = String(formData.get('field_key') ?? '').trim();
  const label = String(formData.get('option_label') ?? '').trim();
  return applyLeafAttributeMutation(
    formData,
    fieldKey,
    'taxonomy.leaf_attr_add_option',
    (attrs, v) => addLeafAttributeOption(attrs, v, { fieldKey, label }),
    () => `Added option to "${fieldKey}".`,
  );
}

/** Admin: relabel a refinement's display label. Key is never touched (safe —
 *  the payload keys on the field key, never the label). */
export async function relabelLeafAttributeFieldAction(formData: FormData): Promise<never> {
  const fieldKey = String(formData.get('field_key') ?? '').trim();
  const label = String(formData.get('field_label') ?? '').trim();
  return applyLeafAttributeMutation(
    formData,
    fieldKey,
    'taxonomy.leaf_attr_relabel_field',
    (attrs, v) => relabelLeafAttributeField(attrs, v, { fieldKey, label }),
    () => `Renamed "${fieldKey}".`,
  );
}

/** Admin: soft-retire OR un-retire a whole refinement. The def + its options
 *  stay in the schema so saved vendor payloads keep validating. */
export async function retireLeafAttributeFieldAction(formData: FormData): Promise<never> {
  const fieldKey = String(formData.get('field_key') ?? '').trim();
  const retired = String(formData.get('retired') ?? '') === 'true';
  return applyLeafAttributeMutation(
    formData,
    fieldKey,
    'taxonomy.leaf_attr_retire_field',
    (attrs, v) => retireLeafAttributeField(attrs, v, { fieldKey, retired }),
    () => `${retired ? 'Retired' : 'Restored'} "${fieldKey}".`,
  );
}

/** Admin: soft-retire OR un-retire a single option VALUE. The value stays inside
 *  `options` (validation survives); only the render layer hides it. */
export async function retireLeafAttributeOptionAction(formData: FormData): Promise<never> {
  const fieldKey = String(formData.get('field_key') ?? '').trim();
  const option = String(formData.get('option') ?? '').trim();
  const retired = String(formData.get('retired') ?? '') === 'true';
  return applyLeafAttributeMutation(
    formData,
    fieldKey,
    'taxonomy.leaf_attr_retire_option',
    (attrs, v) => retireLeafAttributeOption(attrs, v, { fieldKey, option, retired }),
    () => `${retired ? 'Retired' : 'Restored'} option "${option}".`,
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VOCABULARIES — the scoping vocab tables folded into the Studio (PR 6).
//
// Two additive-only vocabularies power classification scoping:
//   • event_type_vocab — validates applicable_event_types on tiles + canonicals.
//   • faith_vocab      — the FK/CHECK target for canonical faith tags (Title-Case).
//
// Additive-only contract (mirrors the leaf-attribute + refinement editors):
//   - KEYS are IMMUTABLE once minted; rows are NEVER deleted.
//   - "deactivate" = soft (status → inactive/retired); existing arrays keep the
//     key and behavior stays fail-open. Only add-new + relabel + reorder + status.
//
// Event-type vocab edits here touch ONLY event_type_vocab. They NEVER touch the
// `events.event_type` enum/CHECK (rebuilt by swap migrations) nor the couple-
// side Event-Type Engine gating — a vocab row is for CATEGORY SCOPING, not a
// couple-facing launch. That separation is intentional.
// ════════════════════════════════════════════════════════════════════════════

/** Slugify a label into a stable snake_case key (event-type vocab convention:
 *  lowercase letters/numbers/underscores, starts with a letter). */
function slugifyEventTypeKey(label: string): string {
  const base = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base;
}

/**
 * Admin: relabel an event-type vocab row (label_en only — the key is permanent).
 * Redirect-back to the Vocabularies → Event types view.
 */
export async function relabelEventTypeVocab(formData: FormData): Promise<never> {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '').trim();
  const label = String(formData.get('label_en') ?? '').trim();
  if (!key) redirectBack(formData, 'error', 'Missing event type.');
  if (label.length < 2 || label.length > 80) {
    redirectBack(formData, 'error', 'Label must be 2–80 characters.');
  }
  const admin = createAdminClient();
  const { data: before } = await admin
    .from('event_type_vocab')
    .select('label_en')
    .eq('event_type', key)
    .maybeSingle();
  if (!before) redirectBack(formData, 'error', 'Event type not found.');
  const { error } = await admin
    .from('event_type_vocab')
    .update({ label_en: label, updated_at: new Date().toISOString() })
    .eq('event_type', key);
  if (error) redirectBack(formData, 'error', error.message);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.vocab_event_relabel',
    target_table: 'event_type_vocab',
    target_id: key,
    before_json: { label_en: before.label_en },
    after_json: { label_en: label },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(formData, 'ok', `Renamed to "${label}".`);
}

/**
 * Admin: activate / deactivate an event-type vocab row. Deactivate is SOFT
 * (status → 'retired') — existing `applicable_event_types` arrays keep the key
 * and scoping stays fail-open; it just drops out of the admin scoping pickers.
 * Does NOT touch the couple-side create-event picker (that's the `enabled`
 * launch lever on /admin/event-types) or the events.event_type enum.
 */
export async function setEventTypeVocabStatus(formData: FormData): Promise<never> {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '').trim();
  const active = String(formData.get('active') ?? '') === '1';
  if (!key) redirectBack(formData, 'error', 'Missing event type.');
  if (key === 'wedding' && !active) {
    redirectBack(formData, 'error', 'Wedding is the base event type — it stays active.');
  }
  const nextStatus = active ? 'active' : 'retired';
  const admin = createAdminClient();
  const { data: before } = await admin
    .from('event_type_vocab')
    .select('status')
    .eq('event_type', key)
    .maybeSingle();
  if (!before) redirectBack(formData, 'error', 'Event type not found.');
  if (before.status === nextStatus) redirectBack(formData, 'ok', 'Status unchanged.');
  const { error } = await admin
    .from('event_type_vocab')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('event_type', key);
  if (error) redirectBack(formData, 'error', error.message);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.vocab_event_status',
    target_table: 'event_type_vocab',
    target_id: key,
    before_json: { status: before.status },
    after_json: { status: nextStatus },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(
    formData,
    'ok',
    active
      ? `"${key}" is active — available for category scoping.`
      : `"${key}" hidden from scoping pickers (existing scopes keep working).`,
  );
}

/**
 * Admin: nudge an event-type vocab row up or down in sort order (swap with its
 * neighbor). Sort order drives the order it appears in scoping pickers.
 */
export async function reorderEventTypeVocab(formData: FormData): Promise<never> {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '').trim();
  const dir = String(formData.get('dir') ?? '').trim();
  if (!key || (dir !== 'up' && dir !== 'down')) redirectBack(formData, 'error', 'Bad move.');
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('event_type_vocab')
    .select('event_type, sort_order')
    .eq('status', 'active')
    .order('sort_order', { ascending: true });
  const list = (rows ?? []) as { event_type: string; sort_order: number }[];
  const idx = list.findIndex((r) => r.event_type === key);
  if (idx === -1) redirectBack(formData, 'error', 'Event type not found.');
  const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= list.length) redirectBack(formData, 'ok', 'Already at the edge.');
  const a = list[idx]!;
  const b = list[swapIdx]!;
  const { error: e1 } = await admin
    .from('event_type_vocab')
    .update({ sort_order: b.sort_order, updated_at: new Date().toISOString() })
    .eq('event_type', a.event_type);
  const { error: e2 } = await admin
    .from('event_type_vocab')
    .update({ sort_order: a.sort_order, updated_at: new Date().toISOString() })
    .eq('event_type', b.event_type);
  if (e1 || e2) redirectBack(formData, 'error', (e1 ?? e2)!.message);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.vocab_event_reorder',
    target_table: 'event_type_vocab',
    target_id: key,
    before_json: { [a.event_type]: a.sort_order, [b.event_type]: b.sort_order },
    after_json: { [a.event_type]: b.sort_order, [b.event_type]: a.sort_order },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(formData, 'ok', 'Reordered.');
}

/**
 * Admin: mint a new event-type vocab row. Key = slugified snake_case from the
 * label, IMMUTABLE once created. Additive-only — this only makes the type
 * available for CATEGORY SCOPING; it does NOT surface a new couple-facing event
 * type (that's the gated Event-Type Engine + the `enabled` lever on
 * /admin/event-types). New rows sort after every existing one.
 */
export async function createEventTypeVocab(formData: FormData): Promise<never> {
  const user = await requireAdmin();
  const label = String(formData.get('label_en') ?? '').trim();
  if (label.length < 2 || label.length > 80) {
    redirectBack(formData, 'error', 'Label must be 2–80 characters.');
  }
  const key = slugifyEventTypeKey(label);
  if (!key || !/^[a-z][a-z0-9_]{1,30}$/.test(key)) {
    redirectBack(formData, 'error', 'Label needs to start with a letter and yield a valid key.');
  }
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('event_type_vocab')
    .select('event_type')
    .eq('event_type', key)
    .maybeSingle();
  if (existing) {
    redirectBack(formData, 'error', `An event type "${key}" already exists.`);
  }
  const { data: last } = await admin
    .from('event_type_vocab')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = ((last?.sort_order as number | undefined) ?? -1) + 1;
  const row = { event_type: key, label_en: label, sort_order: nextSort, status: 'active' };
  const { error } = await admin.from('event_type_vocab').insert(row);
  if (error) redirectBack(formData, 'error', error.message);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.vocab_event_create',
    target_table: 'event_type_vocab',
    target_id: key,
    after_json: row,
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(formData, 'ok', `Added event type "${label}" (${key}) for scoping.`);
}

// ── Event-type ROSTER grain (couple launch) — folded from /admin/event-types ──
//
// The event_type_vocab row carries TWO lifecycle levers, edited from ONE Studio
// bucket now (Taxonomy Studio PR 7 folds the standalone /admin/event-types
// roster in). The vocab actions above own the CATEGORY-SCOPING grain (relabel /
// reorder / activate-deactivate for the scoping pickers). The actions below own
// the COUPLE-LAUNCH grain that used to live on /admin/event-types: the `enabled`
// create-event-picker lever, the richer presentation fields (emoji · tagline ·
// sort · onboarding href · hero photo), and retire/unretire (status). They
// delegate to the SAME shared cores the legacy surface calls
// (lib/event-types-mutations) — one source of truth, byte-identical writes, no
// gating-semantics change. `status` is one column: "Deactivate" (scoping) and
// "Retire" (launch) write the same value; both surfaces are shown so the admin
// sees the full lifecycle without leaving the bucket.

/** Every surface that renders the event-type roster — refresh after a launch/
 *  presentation/retire write so the couple picker + vendor checkboxes + the
 *  marketplace filter follow live (matches the legacy revalidateRosterSurfaces). */
function revalidateEventTypeRosterSurfaces() {
  revalidatePath(BASE);
  revalidatePath('/explore');
  revalidatePath('/dashboard/create-event');
  revalidatePath('/vendor-dashboard/profile');
}

/**
 * Studio: create an event type with the FULL roster shape (explicit snake_case
 * key + name + emoji + tagline + sort). Lands status='active', enabled=FALSE.
 * Delegates to the shared core; the legacy /admin/event-types create-form uses
 * the same core. Replaces the label-only scoping quick-add for the Studio bucket
 * so there is ONE add path (createEventTypeVocab stays exported for old POSTs).
 */
export async function createEventTypeRoster(formData: FormData): Promise<never> {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '').trim().toLowerCase();
  const admin = createAdminClient();
  const res = await createEventTypeCore(admin, user.id, {
    key,
    label: String(formData.get('label_en') ?? ''),
    emoji: String(formData.get('emoji') ?? ''),
    description: String(formData.get('description') ?? ''),
    sortOrder: Number(formData.get('sort_order')),
  });
  if (!res.ok) {
    if (res.error === 'exists') {
      redirectBack(formData, 'error', `"${key}" already exists — keys are permanent, edit the existing row instead.`);
    }
    redirectBack(formData, 'error', res.error);
  }
  revalidateEventTypeRosterSurfaces();
  redirectBack(
    formData,
    'ok',
    `${res.data.label} created. It stays out of the couple picker until you turn on "Show in picker".`,
  );
}

/**
 * Studio: edit an event type's presentation fields (name · emoji · tagline ·
 * sort · onboarding href · hero photo). The key is immutable. Delegates to the
 * shared core.
 */
export async function updateEventTypePresentation(formData: FormData): Promise<never> {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '').trim();
  const admin = createAdminClient();
  const res = await updateEventTypeCore(admin, user.id, {
    key,
    label: String(formData.get('label_en') ?? ''),
    emoji: String(formData.get('emoji') ?? ''),
    description: String(formData.get('description') ?? ''),
    onboardingHref: String(formData.get('onboarding_href') ?? ''),
    heroPhotoUrl: String(formData.get('hero_photo_url') ?? ''),
    sortOrder: Number(formData.get('sort_order')),
  });
  if (!res.ok) {
    if (res.error === 'not_found') redirectBack(formData, 'error', 'Event type not found.');
    redirectBack(formData, 'error', res.error);
  }
  revalidateEventTypeRosterSurfaces();
  redirectBack(formData, 'ok', `${res.data.label} saved.`);
}

/**
 * Studio: the couple-launch lever — show/hide a type in the create-event picker
 * (`event_type_vocab.enabled`). Independent of active/retired. Delegates to the
 * shared core.
 */
export async function setEventTypeLaunch(formData: FormData): Promise<never> {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '').trim();
  const enable = String(formData.get('enabled') ?? '') === '1';
  const admin = createAdminClient();
  const res = await setEventTypeEnabledCore(admin, user.id, key, enable);
  if (!res.ok) {
    if (res.error === 'not_found') redirectBack(formData, 'error', 'Event type not found.');
    redirectBack(formData, 'error', res.error);
  }
  revalidateEventTypeRosterSurfaces();
  redirectBack(
    formData,
    'ok',
    enable
      ? `${res.data.label} is now live in the create-event picker.`
      : `${res.data.label} is hidden from the create-event picker. Existing events keep working.`,
  );
}

/**
 * Studio: retire an event type (status → 'retired', forces enabled=false). It
 * leaves every picker + vendor checkbox + marketplace filter; existing events
 * keep working. Wedding can't be retired. Delegates to the shared core. This is
 * the launch-grain framing of the same `status` column the scoping-grain
 * "Deactivate" (setEventTypeVocabStatus) writes.
 */
export async function retireEventTypeVocab(formData: FormData): Promise<never> {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '').trim();
  const admin = createAdminClient();
  const res = await retireEventTypeCore(admin, user.id, key);
  if (!res.ok) {
    if (res.error === 'not_found') redirectBack(formData, 'error', 'Event type not found.');
    redirectBack(formData, 'error', res.error);
  }
  revalidateEventTypeRosterSurfaces();
  redirectBack(formData, 'ok', `${res.data.label} retired. Existing events keep working; nobody can pick it for new events.`);
}

/**
 * Studio: reverse a retirement (status → 'active'; picker visibility stays a
 * separate "Show in picker" flip). Delegates to the shared core.
 */
export async function unretireEventTypeVocab(formData: FormData): Promise<never> {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '').trim();
  const admin = createAdminClient();
  const res = await unretireEventTypeCore(admin, user.id, key);
  if (!res.ok) {
    if (res.error === 'not_found') redirectBack(formData, 'error', 'Event type not found.');
    redirectBack(formData, 'error', res.error);
  }
  revalidateEventTypeRosterSurfaces();
  redirectBack(formData, 'ok', `${res.data.label} is active again. Flip "Show in picker" when you’re ready to relaunch it.`);
}

// ── Faith vocabulary ─────────────────────────────────────────────────────────
//
// ⚠ FAITH LANDMINE: faith_vocab.faith_key is TITLE-CASE and compared with strict
// `===`. NEVER lowercase, re-case, or normalize a faith key — the add-new mint
// preserves the admin's casing from the label; storage + comparisons stay
// Title-Case. New keys are Title-Cased for a clean default but the raw label
// wins if it already contains casing (e.g. 'INC').

/** Faith launch key = the LOWERCASE ceremony_type that wedding_type_launch_status
 *  rows on, derived from a Title-Case faith_key via the faith registry (NEVER by
 *  lowercasing the faith_key blindly — 'Born Again' → 'born_again', not
 *  'born again'). Falls back to a conservative lowercase+underscore for keys the
 *  registry doesn't row (a freshly-minted faith), which matches the launch seed
 *  convention. */
function faithKeyToCeremonyType(faithKey: string): string {
  if (faithKey === 'Civil') return 'civil';
  const entry = FAITH_REGISTRY.find((f) => f.faithCol === faithKey);
  if (entry) return entry.key;
  return faithKey.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

/** Title-Case a fresh faith key from a label — capitalizes each word. Preserves
 *  an all-caps acronym the admin typed (INC, LDS, SDA, JW). */
function titleCaseFaithKey(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .map((w) => (w === w.toUpperCase() ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

/** Admin: relabel a faith vocab row (label_en only — faith_key is permanent). */
export async function relabelFaithVocab(formData: FormData): Promise<never> {
  const user = await requireAdmin();
  const key = String(formData.get('faith_key') ?? '').trim();
  const label = String(formData.get('label_en') ?? '').trim();
  if (!key) redirectBack(formData, 'error', 'Missing faith.');
  if (label.length < 2 || label.length > 80) {
    redirectBack(formData, 'error', 'Label must be 2–80 characters.');
  }
  const admin = createAdminClient();
  const { data: before } = await admin
    .from('faith_vocab')
    .select('label_en')
    .eq('faith_key', key)
    .maybeSingle();
  if (!before) redirectBack(formData, 'error', 'Faith not found.');
  const { error } = await admin
    .from('faith_vocab')
    .update({ label_en: label, updated_at: new Date().toISOString() })
    .eq('faith_key', key);
  if (error) redirectBack(formData, 'error', error.message);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.vocab_faith_relabel',
    target_table: 'faith_vocab',
    target_id: key,
    before_json: { label_en: before.label_en },
    after_json: { label_en: label },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(formData, 'ok', `Renamed to "${label}".`);
}

/**
 * Admin: activate / deactivate a faith vocab row (SOFT — status → 'retired').
 * Existing canonical faith tags keep the key; it just drops out of the faith
 * scoping pickers. The couple-facing launch is governed separately by the
 * launch-gate rows (below), not by this taxonomy status.
 */
export async function setFaithVocabStatus(formData: FormData): Promise<never> {
  const user = await requireAdmin();
  const key = String(formData.get('faith_key') ?? '').trim();
  const active = String(formData.get('active') ?? '') === '1';
  if (!key) redirectBack(formData, 'error', 'Missing faith.');
  const nextStatus = active ? 'active' : 'retired';
  const admin = createAdminClient();
  const { data: before } = await admin
    .from('faith_vocab')
    .select('status')
    .eq('faith_key', key)
    .maybeSingle();
  if (!before) redirectBack(formData, 'error', 'Faith not found.');
  if (before.status === nextStatus) redirectBack(formData, 'ok', 'Status unchanged.');
  const { error } = await admin
    .from('faith_vocab')
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq('faith_key', key);
  if (error) redirectBack(formData, 'error', error.message);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.vocab_faith_status',
    target_table: 'faith_vocab',
    target_id: key,
    before_json: { status: before.status },
    after_json: { status: nextStatus },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(
    formData,
    'ok',
    active
      ? `"${key}" is active for faith scoping.`
      : `"${key}" hidden from scoping pickers (existing tags keep working).`,
  );
}

/** Admin: swap a faith vocab row's sort order with its neighbor. */
export async function reorderFaithVocab(formData: FormData): Promise<never> {
  const user = await requireAdmin();
  const key = String(formData.get('faith_key') ?? '').trim();
  const dir = String(formData.get('dir') ?? '').trim();
  if (!key || (dir !== 'up' && dir !== 'down')) redirectBack(formData, 'error', 'Bad move.');
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from('faith_vocab')
    .select('faith_key, sort_order')
    .eq('status', 'active')
    .order('sort_order', { ascending: true });
  const list = (rows ?? []) as { faith_key: string; sort_order: number }[];
  const idx = list.findIndex((r) => r.faith_key === key);
  if (idx === -1) redirectBack(formData, 'error', 'Faith not found.');
  const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= list.length) redirectBack(formData, 'ok', 'Already at the edge.');
  const a = list[idx]!;
  const b = list[swapIdx]!;
  const { error: e1 } = await admin
    .from('faith_vocab')
    .update({ sort_order: b.sort_order, updated_at: new Date().toISOString() })
    .eq('faith_key', a.faith_key);
  const { error: e2 } = await admin
    .from('faith_vocab')
    .update({ sort_order: a.sort_order, updated_at: new Date().toISOString() })
    .eq('faith_key', b.faith_key);
  if (e1 || e2) redirectBack(formData, 'error', (e1 ?? e2)!.message);
  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.vocab_faith_reorder',
    target_table: 'faith_vocab',
    target_id: key,
    before_json: { [a.faith_key]: a.sort_order, [b.faith_key]: b.sort_order },
    after_json: { [a.faith_key]: b.sort_order, [b.faith_key]: a.sort_order },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(formData, 'ok', 'Reordered.');
}

/**
 * Admin: mint a new faith vocab row. The Title-Case key is derived from the
 * label (acronyms preserved) and is IMMUTABLE. Additive-only. A matching
 * launch-gate row (region 'all', status 'coming_soon') is seeded so the new
 * faith is immediately gate-able. ⚠ NEVER lowercase the minted key.
 */
export async function createFaithVocab(formData: FormData): Promise<never> {
  const user = await requireAdmin();
  const label = String(formData.get('label_en') ?? '').trim();
  if (label.length < 2 || label.length > 80) {
    redirectBack(formData, 'error', 'Label must be 2–80 characters.');
  }
  const key = titleCaseFaithKey(label);
  if (!key || key.length > 40) redirectBack(formData, 'error', 'Could not derive a faith key.');
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from('faith_vocab')
    .select('faith_key')
    .eq('faith_key', key)
    .maybeSingle();
  if (existing) redirectBack(formData, 'error', `A faith "${key}" already exists.`);
  const { data: last } = await admin
    .from('faith_vocab')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSort = ((last?.sort_order as number | undefined) ?? -1) + 1;
  const row = { faith_key: key, label_en: label, sort_order: nextSort, status: 'active', is_civil: false };
  const { error } = await admin.from('faith_vocab').insert(row);
  if (error) redirectBack(formData, 'error', error.message);

  // Seed a launch-gate row (coming_soon) so the new faith is immediately
  // gate-able from the readiness panel. Non-fatal if it collides.
  const ceremonyType = faithKeyToCeremonyType(key);
  await admin
    .from('wedding_type_launch_status')
    .upsert(
      { ceremony_type: ceremonyType, region: 'all', status: 'coming_soon', updated_at: new Date().toISOString() },
      { onConflict: 'ceremony_type,region', ignoreDuplicates: true },
    );

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.vocab_faith_create',
    target_table: 'faith_vocab',
    target_id: key,
    after_json: { ...row, launch_ceremony_type: ceremonyType },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(formData, 'ok', `Added faith "${label}" (${key}). Gate it live from its readiness panel.`);
}

// ── Faith launch gate (folded from /admin/wedding-types) ─────────────────────

/**
 * Admin: flip a faith's launch status (Live / Coming soon / Disabled). Delegates
 * to the shared launch-gate core. The form carries the TITLE-CASE faith_key; we
 * map it to the lowercase ceremony_type via the registry (never lowercase the
 * key). Refreshes the couple-facing picker surfaces too.
 */
export async function setFaithLaunchStatus(formData: FormData): Promise<never> {
  const user = await requireAdmin();
  const faithKey = String(formData.get('faith_key') ?? '').trim();
  const status = String(formData.get('status') ?? '').trim();
  if (!faithKey || !LAUNCH_STATUSES.includes(status as LaunchStatus)) {
    redirectBack(formData, 'error', 'Invalid input.');
  }
  const admin = createAdminClient();
  const ceremonyType = faithKeyToCeremonyType(faithKey);
  const res = await setWeddingTypeStatusCore(
    admin,
    user.id,
    ceremonyType,
    'all',
    status as LaunchStatus,
  );
  if (!res.ok) redirectBack(formData, 'error', res.error);
  revalidatePath(BASE);
  revalidatePath('/dashboard/create-event');
  revalidatePath('/onboarding/wedding');
  const label =
    status === 'active' ? 'live' : status === 'coming_soon' ? 'coming soon' : 'disabled';
  redirectBack(formData, 'ok', `${faithKey} is now ${label} for couples.`);
}

/** Admin: set a faith's vendor-readiness threshold. Delegates to the shared
 *  launch-gate core; maps faith_key → ceremony_type via the registry. */
export async function setFaithLaunchThreshold(formData: FormData): Promise<never> {
  const user = await requireAdmin();
  const faithKey = String(formData.get('faith_key') ?? '').trim();
  const threshold = Number(formData.get('threshold'));
  if (!faithKey) redirectBack(formData, 'error', 'Missing faith.');
  const admin = createAdminClient();
  const ceremonyType = faithKeyToCeremonyType(faithKey);
  const res = await setWeddingTypeThresholdCore(admin, user.id, ceremonyType, 'all', threshold);
  if (!res.ok) redirectBack(formData, 'error', res.error);
  revalidatePath(BASE);
  redirectBack(formData, 'ok', `Threshold saved for ${faithKey}.`);
}

// ════════════════════════════════════════════════════════════════════════════
// LEAF FLAGS — the per-canonical scoping/marketplace flags, editable after
// creation (PR 6). These were settable ONLY at leaf creation before.
//   is_tradition · is_ph · is_rental · marketplace_hidden  (booleans)
//   secondary_tiles (text[] — cross-listing on additional tiles)
// The `dietary` column stays READ-ONLY here (a dietary canonical must never be
// faith-gated — mirrors setServiceFaith's de-faith guard; dietary is a per-vendor
// grade, edited elsewhere). Every write is audit-logged + redirect-back.
// ════════════════════════════════════════════════════════════════════════════

const SERVICE_BOOLEAN_FLAGS: Record<string, string> = {
  is_tradition: 'Cultural / tradition',
  is_ph: 'PH-specific',
  is_rental: 'Rental',
  marketplace_hidden: 'Hidden from marketplace',
};

/**
 * Admin: toggle ONE boolean scoping flag on a canonical. The form carries the
 * flag name + the desired value. Audit-logged, redirect-back to the tile.
 */
export async function setServiceFlag(formData: FormData): Promise<never> {
  const user = await requireAdmin();
  const canonical = String(formData.get('canonical_service') ?? '').trim();
  const flag = String(formData.get('flag') ?? '').trim();
  const value = String(formData.get('value') ?? '') === '1';
  if (!canonical) redirectBack(formData, 'error', 'Missing canonical_service.');
  if (!(flag in SERVICE_BOOLEAN_FLAGS)) redirectBack(formData, 'error', 'Unknown flag.');

  const admin = createAdminClient();
  // Select all four boolean flags (static columns) rather than a dynamic column
  // name — the typed query builder can't accept an interpolated select string.
  const { data: before } = await admin
    .from('canonical_service_taxonomy')
    .select('canonical_service, is_tradition, is_ph, is_rental, marketplace_hidden')
    .eq('canonical_service', canonical)
    .maybeSingle();
  if (!before) redirectBack(formData, 'error', 'Canonical not found.');
  const beforeVal = Boolean((before as Record<string, unknown>)[flag]);
  if (beforeVal === value) redirectBack(formData, 'ok', 'Flag unchanged.');

  const { error } = await admin
    .from('canonical_service_taxonomy')
    .update({ [flag]: value, updated_at: new Date().toISOString() })
    .eq('canonical_service', canonical);
  if (error) redirectBack(formData, 'error', error.message);

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.set_service_flag',
    target_table: 'canonical_service_taxonomy',
    target_id: canonical,
    before_json: { [flag]: beforeVal },
    after_json: { [flag]: value },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(
    formData,
    'ok',
    `${SERVICE_BOOLEAN_FLAGS[flag]} ${value ? 'on' : 'off'} for ${canonical}.`,
  );
}

/**
 * Admin: set a canonical's `secondary_tiles` (cross-listing on additional tiles
 * beyond its home tile). Values are validated against the live tile catalog
 * (WEDDING_TILE_ORDER) — the home tile is excluded (it's not a "secondary").
 * Empty selection clears the array to NULL. Audit-logged, redirect-back.
 */
export async function setServiceSecondaryTiles(formData: FormData): Promise<never> {
  const user = await requireAdmin();
  const canonical = String(formData.get('canonical_service') ?? '').trim();
  if (!canonical) redirectBack(formData, 'error', 'Missing canonical_service.');
  const selected = Array.from(
    new Set(
      formData
        .getAll('secondary_tiles')
        .map((v) => String(v).trim())
        .filter(Boolean),
    ),
  );

  const admin = createAdminClient();
  const { data: before } = await admin
    .from('canonical_service_taxonomy')
    .select('canonical_service, tile_id, secondary_tiles')
    .eq('canonical_service', canonical)
    .maybeSingle();
  if (!before) redirectBack(formData, 'error', 'Canonical not found.');

  // Validate every selected tile is a real tile; never let the home tile be its
  // own secondary.
  const validTiles = new Set<string>(WEDDING_TILE_ORDER as readonly string[]);
  const homeTile = (before as { tile_id: string | null }).tile_id;
  const cleaned = selected.filter((t) => t !== homeTile);
  const unknown = cleaned.filter((t) => !validTiles.has(t));
  if (unknown.length > 0) {
    redirectBack(formData, 'error', 'Unknown tile(s): ' + unknown.join(', '));
  }
  const next = cleaned.length > 0 ? cleaned.sort() : null;

  const { error } = await admin
    .from('canonical_service_taxonomy')
    .update({ secondary_tiles: next, updated_at: new Date().toISOString() })
    .eq('canonical_service', canonical);
  if (error) redirectBack(formData, 'error', error.message);

  await admin.from('admin_audit_log').insert({
    action: 'taxonomy.set_secondary_tiles',
    target_table: 'canonical_service_taxonomy',
    target_id: canonical,
    before_json: { secondary_tiles: (before as { secondary_tiles: string[] | null }).secondary_tiles ?? null },
    after_json: { secondary_tiles: next },
    actor_user_id: user.id,
  });
  revalidatePath(BASE);
  revalidatePath('/explore');
  redirectBack(
    formData,
    'ok',
    next ? `Cross-listed on ${next.length} more ${next.length === 1 ? 'tile' : 'tiles'}.` : 'Cross-listing cleared.',
  );
}
