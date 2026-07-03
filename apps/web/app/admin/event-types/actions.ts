'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  createEventTypeCore,
  updateEventTypeCore,
  setEventTypeEnabledCore,
  retireEventTypeCore,
  unretireEventTypeCore,
} from '@/lib/event-types-mutations';

/**
 * Setnayan HQ · Event Types actions — CRUD over `event_type_vocab`, the
 * single source for the event-type roster (2026-06-13 cutover).
 *
 * ⚠ The standalone /admin/event-types roster page was FOLDED into the Taxonomy
 * Studio's Vocabularies → Event types bucket (Taxonomy Studio PR 7) and now
 * redirect()s to /admin/taxonomy?view=vocab-event. The roster-level actions
 * below (create / update / enable / retire / unretire) are retained for any
 * bookmarked form POST and delegate to the shared cores in
 * lib/event-types-mutations.ts — the SAME cores the Studio calls. New edits
 * happen in the Studio; nothing new should import the roster actions from here.
 * The per-type category-scoping / profile / onboarding actions (further down)
 * still back their focused sub-editor pages, reached from the Studio bucket.
 *
 * The roster fans out with zero deploys: the create-event picker + the
 * EventSwitcher add-event sheet read enabled+active rows; the vendor
 * "event types you serve" checkboxes + the marketplace ?event_type= filter
 * read all active rows; the /admin/taxonomy per-tile applicability
 * checkboxes read the same vocab. DB backstops: events.event_type FK,
 * validate_event_types_vendor_profiles + validate_applicable_event_types
 * triggers (migrations 20261104000000 + 20261204000000).
 *
 * Patterns mirror /admin/taxonomy/actions.ts: requireAdmin defense-in-depth,
 * admin client writes, an admin_audit_log row per mutation, redirectBack
 * with ?ok=/?error= + #row anchors.
 */

const BASE = '/admin/event-types';

/** Vocab keys: lowercase snake, 3–31 chars, must start with a letter. */
const KEY_RE = /^[a-z][a-z0-9_]{2,30}$/;
const SAFE_ANCHOR = /[^a-z0-9_-]/g;

function redirectBack(
  kind: 'ok' | 'error',
  msg: string,
  anchor?: string,
): never {
  const p = new URLSearchParams();
  p.set(kind, msg);
  const a = (anchor ?? '').replace(SAFE_ANCHOR, '').slice(0, 80);
  redirect(`${BASE}?${p.toString()}${a ? `#et-${a}` : ''}`);
}

/**
 * Defense-in-depth admin gate (the /admin layout already 404s non-admins;
 * server actions re-check). Mirrors /admin/taxonomy. Returns the acting user
 * so writes can stamp `admin_audit_log.actor_user_id`.
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

/** Every surface that renders the roster — refresh them all after a write. */
function revalidateRosterSurfaces() {
  revalidatePath(BASE);
  revalidatePath('/dashboard/create-event');
  revalidatePath('/explore');
  revalidatePath('/vendor-dashboard/profile');
  revalidatePath('/admin/taxonomy');
}

function cleanOptional(raw: FormDataEntryValue | null, max = 300): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

/** Add a new event type. Lands status='active', enabled=FALSE — the admin
 *  flips "Show in picker" when the type is ready to launch. Delegates to the
 *  shared core (lib/event-types-mutations); the Studio calls the same core. */
export async function createEventType(formData: FormData) {
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
      redirectBack('error', `"${key}" already exists — keys are permanent, edit the existing row instead.`, key);
    }
    redirectBack('error', res.error, key);
  }
  revalidateRosterSurfaces();
  redirectBack(
    'ok',
    `${res.data.label} created. It stays out of the couple picker until you turn on "Show in picker".`,
    res.data.key,
  );
}

/** Edit presentation fields. The key itself is immutable (it's the FK target
 *  for every existing event + vendor coverage tag). Delegates to the shared core. */
export async function updateEventType(formData: FormData) {
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
    if (res.error === 'not_found') redirectBack('error', 'Event type not found.', key);
    redirectBack('error', res.error, key);
  }
  revalidateRosterSurfaces();
  redirectBack('ok', `${res.data.label} saved.`, res.data.key);
}

/** The launch lever — show/hide a type in the couple-side create-event
 *  picker. Independent of active/retired (vendors can pre-tag coverage for
 *  active-but-hidden types). Delegates to the shared core. */
export async function setEventTypeEnabled(formData: FormData) {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '').trim();
  const enable = String(formData.get('enabled') ?? '') === '1';
  const admin = createAdminClient();
  const res = await setEventTypeEnabledCore(admin, user.id, key, enable);
  if (!res.ok) {
    if (res.error === 'not_found') redirectBack('error', 'Event type not found.', key);
    redirectBack('error', res.error, key);
  }
  revalidateRosterSurfaces();
  redirectBack(
    'ok',
    enable
      ? `${res.data.label} is now live in the create-event picker.`
      : `${res.data.label} is hidden from the create-event picker. Existing ${res.data.label} events keep working.`,
    key,
  );
}

/** Retire a type: it disappears from every picker + vendor checkbox + filter,
 *  but every existing event of that type keeps working (FK stays valid —
 *  deliberately no active-status CHECK on events.event_type). Wedding is the
 *  platform's V1 anchor and cannot be retired. Delegates to the shared core. */
export async function retireEventType(formData: FormData) {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '').trim();
  const admin = createAdminClient();
  const res = await retireEventTypeCore(admin, user.id, key);
  if (!res.ok) {
    if (res.error === 'not_found') redirectBack('error', 'Event type not found.', key);
    redirectBack('error', res.error, key);
  }
  revalidateRosterSurfaces();
  redirectBack('ok', `${res.data.label} retired. Existing events keep working; nobody can pick it for new events.`, key);
}

/** Reverse a retirement — the type returns as active (picker visibility is
 *  still a separate "Show in picker" flip). Delegates to the shared core. */
export async function unretireEventType(formData: FormData) {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '').trim();
  const admin = createAdminClient();
  const res = await unretireEventTypeCore(admin, user.id, key);
  if (!res.ok) {
    if (res.error === 'not_found') redirectBack('error', 'Event type not found.', key);
    redirectBack('error', res.error, key);
  }
  revalidateRosterSurfaces();
  redirectBack('ok', `${res.data.label} is active again. Flip "Show in picker" when you’re ready to relaunch it.`, key);
}

/* ════════════════════════════════════════════════════════════════════════
 * Per-event-type CATEGORY SCOPING — the "tailor a type's taxonomy" convenience
 * (owner 2026-06-16). Adding an event type auto-covers the taxonomy (fail-open:
 * a category with NULL/empty `applicable_event_types` serves EVERY event), but
 * does NOT auto-tailor it. These actions back the focused screen at
 * /admin/event-types/[eventType]/categories where an admin flips each category
 * (taxonomy tile) Offered / Hidden for ONE event type — no need to hand-edit the
 * multi-type checkboxes on /admin/taxonomy. Writes the SAME
 * `service_categories.applicable_event_types` column the marketplace + Shortlist
 * read, so the change is live everywhere at once.
 * ════════════════════════════════════════════════════════════════════════ */

function scopedRedirect(eventType: string, kind: 'ok' | 'error', msg: string): never {
  const p = new URLSearchParams();
  p.set(kind, msg);
  redirect(`${BASE}/${eventType}/categories?${p.toString()}`);
}

/** The active event-type keys — the universe used to (a) normalize "serves all
 *  active types" back to NULL (universal) and (b) materialize "all except T"
 *  when hiding a universal tile. Active-only so we never write a retired key
 *  (the validate_applicable_event_types trigger rejects non-active members). */
async function activeEventTypeKeys(
  admin: ReturnType<typeof createAdminClient>,
): Promise<string[]> {
  const { data } = await admin
    .from('event_type_vocab')
    .select('event_type')
    .eq('status', 'active');
  return ((data ?? []) as { event_type: string }[]).map((r) => r.event_type);
}

/**
 * Compute the next `applicable_event_types` for a tile when toggling ONE type's
 * membership. `applicable_event_types` is an ALLOW-list (NULL/empty = universal,
 * serves all); there is no "deny" — hiding a universal tile materializes "all
 * active types except T". Always sanitizes to active keys so the write passes
 * the validation trigger, and normalizes "covers every active type" → NULL so a
 * fully-offered tile reverts to the clean universal state.
 */
function nextEventTypes(
  current: string[] | null,
  type: string,
  offered: boolean,
  activeTypes: string[],
): string[] | null {
  const activeSet = new Set(activeTypes);
  const curActive = (current ?? []).filter((t) => activeSet.has(t));
  const universal = curActive.length === 0;

  if (offered) {
    if (universal) return null; // already serves all → stays universal
    const set = new Set(curActive);
    set.add(type);
    if (activeTypes.every((t) => set.has(t))) return null; // now covers all → universal
    return [...set];
  }
  // hide T
  if (universal) return activeTypes.filter((t) => t !== type);
  const next = curActive.filter((t) => t !== type);
  // Degenerate: removing T would empty the list (= universal = serves T again).
  // Materialize "all except T" instead so T stays hidden.
  return next.length === 0 ? activeTypes.filter((t) => t !== type) : next;
}

/** Toggle ONE taxonomy tile Offered/Hidden for one event type. */
export async function setTileEventTypeOffered(formData: FormData) {
  const user = await requireAdmin();
  const eventType = String(formData.get('event_type') ?? '').trim();
  const tileId = String(formData.get('tile_id') ?? '').trim();
  const offered = String(formData.get('offered') ?? '') === '1';
  if (!KEY_RE.test(eventType)) redirectBack('error', 'Unknown event type.');

  const admin = createAdminClient();
  const { data: tile } = await admin
    .from('service_categories')
    .select('id, label_en, applicable_event_types')
    .eq('id', tileId)
    .eq('tier', 2)
    .maybeSingle();
  if (!tile) scopedRedirect(eventType, 'error', 'Category not found.');

  const activeTypes = await activeEventTypeKeys(admin);
  const before = (tile.applicable_event_types as string[] | null) ?? null;
  const next = nextEventTypes(before, eventType, offered, activeTypes);

  const { error } = await admin
    .from('service_categories')
    .update({ applicable_event_types: next })
    .eq('id', tileId);
  if (error) scopedRedirect(eventType, 'error', error.message);

  await admin.from('admin_audit_log').insert({
    action: 'event_types.scope_tile',
    target_table: 'service_categories',
    target_id: tileId,
    before_json: { applicable_event_types: before },
    after_json: { applicable_event_types: next, event_type: eventType, offered },
    actor_user_id: user.id,
  });
  revalidateRosterSurfaces();
  revalidatePath(`${BASE}/${eventType}/categories`);
  scopedRedirect(
    eventType,
    'ok',
    `${tile.label_en} is now ${offered ? 'offered to' : 'hidden from'} this event.`,
  );
}

/** Bulk: Offer-all / Hide-all every tile in a folder for one event type. The
 *  fast way to narrow a whole section out (e.g. hide all Look tiles from a
 *  corporate gala). */
export async function setFolderEventTypeOffered(formData: FormData) {
  const user = await requireAdmin();
  const eventType = String(formData.get('event_type') ?? '').trim();
  const folderId = String(formData.get('folder_id') ?? '').trim();
  const offered = String(formData.get('offered') ?? '') === '1';
  if (!KEY_RE.test(eventType)) redirectBack('error', 'Unknown event type.');

  const admin = createAdminClient();
  const { data: tiles } = await admin
    .from('service_categories')
    .select('id, applicable_event_types')
    .eq('tier', 2)
    .eq('parent_id', folderId);
  const rows = (tiles ?? []) as { id: string; applicable_event_types: string[] | null }[];
  if (rows.length === 0) scopedRedirect(eventType, 'error', 'No categories in that section.');

  const activeTypes = await activeEventTypeKeys(admin);
  let changed = 0;
  for (const t of rows) {
    const next = nextEventTypes(t.applicable_event_types ?? null, eventType, offered, activeTypes);
    const { error } = await admin
      .from('service_categories')
      .update({ applicable_event_types: next })
      .eq('id', t.id);
    if (!error) changed += 1;
  }

  await admin.from('admin_audit_log').insert({
    action: 'event_types.scope_folder',
    target_table: 'service_categories',
    target_id: folderId,
    after_json: { event_type: eventType, offered, tile_count: rows.length, changed },
    actor_user_id: user.id,
  });
  revalidateRosterSurfaces();
  revalidatePath(`${BASE}/${eventType}/categories`);
  scopedRedirect(
    eventType,
    'ok',
    `${changed} ${changed === 1 ? 'category' : 'categories'} ${offered ? 'offered to' : 'hidden from'} this event.`,
  );
}

/* ---- Onboarding profile (event_type_profiles · iteration 0053 Phase 3 · PR4) ---- */

/** The 9 couple-facing surfaces a profile can enable (mirrors ALL_SURFACES in
 *  lib/event-type-profile.ts). The editor renders a checkbox per surface. */
const PROFILE_SURFACES = [
  'website',
  'save_the_date',
  'rsvp',
  'seating',
  'budget',
  'schedule',
  'monogram',
  'day_of',
  'gallery',
] as const;

function profileRedirect(eventType: string, kind: 'ok' | 'error', msg: string): never {
  const p = new URLSearchParams();
  p.set(kind, msg);
  redirect(`${BASE}/${eventType}/profile?${p.toString()}`);
}

/**
 * Upsert an event type's onboarding/terminology profile (event_type_profiles).
 * Terminology drives the per-type copy across the dashboard + the generic
 * onboarding flow; enabled_surfaces gates which couple-facing surfaces apply;
 * onboarding_flow_key + role_set_key wire the engine. The table's RLS already
 * enforces is_admin() writes; requireAdmin is defense-in-depth. The partial
 * upsert preserves the other pack keys (template/monogram/reveal/budget/
 * schedule/statutory) on update — editing onboarding never wipes them.
 */
export async function upsertEventTypeProfile(formData: FormData) {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '')
    .trim()
    .toLowerCase();
  if (!KEY_RE.test(key)) {
    redirect(`${BASE}?error=${encodeURIComponent('Bad event-type key.')}`);
  }

  const terminology = {
    organizer_noun: cleanOptional(formData.get('organizer_noun'), 60),
    person_a: cleanOptional(formData.get('person_a'), 60),
    person_b: cleanOptional(formData.get('person_b'), 60),
    seat_word: cleanOptional(formData.get('seat_word'), 60),
    event_word: cleanOptional(formData.get('event_word'), 60),
    vip_tier_label: cleanOptional(formData.get('vip_tier_label'), 80),
  };
  const enabled_surfaces = PROFILE_SURFACES.filter(
    (s) => formData.get(`surface_${s}`) === 'on',
  );
  const onboarding_flow_key = cleanOptional(formData.get('onboarding_flow_key'), 60);
  const role_set_key = cleanOptional(formData.get('role_set_key'), 60);

  const row = { event_type: key, terminology, enabled_surfaces, onboarding_flow_key, role_set_key };
  const admin = createAdminClient();
  const { error } = await admin
    .from('event_type_profiles')
    .upsert(row, { onConflict: 'event_type' });
  if (error) {
    // 23503 = FK violation → the key isn't a known event_type_vocab row.
    if (error.code === '23503') {
      profileRedirect(key, 'error', `"${key}" is not a known event type.`);
    }
    profileRedirect(key, 'error', error.message);
  }

  await admin.from('admin_audit_log').insert({
    action: 'event_types.profile_upsert',
    target_table: 'event_type_profiles',
    target_id: key,
    after_json: row,
    actor_user_id: user.id,
  });
  revalidateRosterSurfaces();
  revalidatePath(`${BASE}/${key}/profile`);
  profileRedirect(key, 'ok', 'Onboarding profile saved.');
}

/* ---- Onboarding CONTENT editor (event_type_onboarding · 2026-06-28) ----
 *
 * Admin-editable per-type onboarding spec — the signature questions, the persona
 * starter-plan pack, and the reveal + intro copy of the generic onboarding flow.
 * The client editor serializes the whole spec to one JSON field; this action
 * normalizes + clamps it (the normalizers ARE the validation) and upserts the
 * override row. A missing/empty field stays an override of its default; "Reset"
 * deletes the row → the flow falls back to the code defaults (onboarding-spec.ts).
 * Wedding is never edited here (its bespoke wizard owns its content). */

/** Persona keys — must match EXP_PERSONAS / persona-packs.ts. */
const ONBOARDING_PERSONA_KEYS = [
  'keepsake',
  'big_celebration',
  'best_of_both',
  'intimate_romance',
  'modern_statement',
  'rooted_tradition',
] as const;

function onboardingRedirect(eventType: string, kind: 'ok' | 'error', msg: string): never {
  const p = new URLSearchParams();
  p.set(kind, msg);
  redirect(`${BASE}/${eventType}/onboarding?${p.toString()}`);
}

function trimStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** lowercase snake slug for ids/keys (questions, options). */
function slugifyKey(v: unknown, max = 40): string {
  return trimStr(v, max)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Clean + dedupe a string-id array, clamped to maxItems. */
function idArray(v: unknown, maxItems: number, maxLen = 60): string[] {
  if (!Array.isArray(v)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of v) {
    const t = trimStr(x, maxLen);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= maxItems) break;
  }
  return out;
}

function normalizeQuestions(v: unknown): unknown[] {
  if (!Array.isArray(v)) return [];
  const out: unknown[] = [];
  const seenIds = new Set<string>();
  for (const q of v.slice(0, 8)) {
    if (!q || typeof q !== 'object') continue;
    const x = q as Record<string, unknown>;
    const id = slugifyKey(x.id);
    const question = trimStr(x.question, 160);
    if (!id || seenIds.has(id) || !question) continue;
    const rawOptions = Array.isArray(x.options) ? x.options.slice(0, 8) : [];
    const options: unknown[] = [];
    const seenKeys = new Set<string>();
    for (const o of rawOptions) {
      if (!o || typeof o !== 'object') continue;
      const ox = o as Record<string, unknown>;
      const key = slugifyKey(ox.key);
      const title = trimStr(ox.title, 80);
      if (!key || seenKeys.has(key) || !title) continue;
      seenKeys.add(key);
      options.push({ key, title, desc: trimStr(ox.desc, 160), adds: idArray(ox.adds, 12) });
    }
    if (options.length === 0) continue;
    seenIds.add(id);
    out.push({ id, eyebrow: trimStr(x.eyebrow, 60), question, options });
  }
  return out;
}

function normalizePack(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object') return null;
  const x = v as Record<string, unknown>;
  const byPersonaIn = (x.byPersona ?? {}) as Record<string, unknown>;
  const servicesIn = (x.servicesByPersona ?? {}) as Record<string, unknown>;
  const byPersona: Record<string, string[]> = {};
  const servicesByPersona: Record<string, string[]> = {};
  for (const p of ONBOARDING_PERSONA_KEYS) {
    byPersona[p] = idArray(byPersonaIn[p], 12);
    servicesByPersona[p] = idArray(servicesIn[p], 8);
  }
  const essentials = idArray(x.essentials, 12);
  // Nothing chosen anywhere → no pack override (fall back to the code default).
  const empty =
    essentials.length === 0 &&
    ONBOARDING_PERSONA_KEYS.every(
      (p) => byPersona[p]!.length === 0 && servicesByPersona[p]!.length === 0,
    );
  return empty ? null : { essentials, byPersona, servicesByPersona };
}

function normalizeReveal(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== 'object') return null;
  const x = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const p of ONBOARDING_PERSONA_KEYS) {
    const r = x[p];
    if (!r || typeof r !== 'object') continue;
    const rx = r as Record<string, unknown>;
    const name = trimStr(rx.name, 80);
    const tagline = trimStr(rx.tagline, 200);
    const feel = trimStr(rx.feel, 40);
    if (name || tagline || feel) out[p] = { name, tagline, feel };
  }
  return Object.keys(out).length > 0 ? out : null;
}

function normalizeIntro(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== 'object') return null;
  const x = v as Record<string, unknown>;
  const eyebrow = trimStr(x.eyebrow, 80);
  const headline = trimStr(x.headline, 200);
  const subcopy = trimStr(x.subcopy, 300);
  // All-or-nothing: a partial intro would render blank lines, so treat it as none.
  return eyebrow && headline && subcopy ? { eyebrow, headline, subcopy } : null;
}

/** Save a type's onboarding content (questions / plan / reveal / intro). */
export async function upsertOnboardingSpec(formData: FormData) {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '')
    .trim()
    .toLowerCase();
  if (!KEY_RE.test(key)) {
    redirect(`${BASE}?error=${encodeURIComponent('Bad event-type key.')}`);
  }
  if (key === 'wedding') {
    onboardingRedirect(key, 'error', 'Wedding uses its own bespoke onboarding — not editable here.');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(String(formData.get('spec_json') ?? '{}')) as Record<string, unknown>;
  } catch {
    onboardingRedirect(key, 'error', 'Could not read the form — please try again.');
  }

  // The override row. Omit axis_overrides so an existing one is PRESERVED (the
  // editor doesn't touch axis copy); questions stores [] verbatim (explicit
  // "no questions"), distinct from a missing row which falls back to defaults.
  const row = {
    event_type: key,
    intro: normalizeIntro(parsed.intro),
    questions: normalizeQuestions(parsed.questions),
    persona_pack: normalizePack(parsed.personaPack),
    reveal_overrides: normalizeReveal(parsed.reveal),
  };

  const admin = createAdminClient();
  const { error } = await admin
    .from('event_type_onboarding')
    .upsert(row, { onConflict: 'event_type' });
  if (error) {
    if (error.code === '23503') {
      onboardingRedirect(key, 'error', `"${key}" is not a known event type.`);
    }
    onboardingRedirect(key, 'error', error.message);
  }

  await admin.from('admin_audit_log').insert({
    action: 'event_types.onboarding_upsert',
    target_table: 'event_type_onboarding',
    target_id: key,
    after_json: row,
    actor_user_id: user.id,
  });
  revalidateRosterSurfaces();
  revalidatePath(`${BASE}/${key}/onboarding`);
  revalidatePath(`/onboarding/${key}`);
  onboardingRedirect(key, 'ok', 'Onboarding content saved.');
}

/** Reset a type's onboarding content to the code defaults (delete the override row). */
export async function resetOnboardingSpec(formData: FormData) {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '')
    .trim()
    .toLowerCase();
  if (!KEY_RE.test(key)) {
    redirect(`${BASE}?error=${encodeURIComponent('Bad event-type key.')}`);
  }

  const admin = createAdminClient();
  const { error } = await admin.from('event_type_onboarding').delete().eq('event_type', key);
  if (error) onboardingRedirect(key, 'error', error.message);

  await admin.from('admin_audit_log').insert({
    action: 'event_types.onboarding_reset',
    target_table: 'event_type_onboarding',
    target_id: key,
    actor_user_id: user.id,
  });
  revalidateRosterSurfaces();
  revalidatePath(`${BASE}/${key}/onboarding`);
  revalidatePath(`/onboarding/${key}`);
  onboardingRedirect(key, 'ok', 'Reset to default content.');
}
