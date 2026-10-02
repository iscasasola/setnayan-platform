'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { CATEGORIES_PATH, backHref } from './_components/back';
import { nextEventTypes } from '@/lib/event-type-scope';
import {
  isCelebrantShape,
  surfacesStrandedWithoutWebsite,
  strandedWithoutWebsiteMessage,
} from '@/lib/event-type-profile';

/**
 * Setnayan HQ · Event type panel actions — the per-type category scoping,
 * profile and onboarding content of one event type.
 *
 * Moved 2026-10-02 from /admin/event-types/actions.ts into the one admin page
 * "Categories & event types" (/admin/categories?list=event-types). The three
 * per-type pages they used to serve (categories · profile · onboarding) are
 * now sections of the event type's panel; the old addresses forward through
 * lib/legacy-redirects.ts. The roster edits (name, status, order, picker card)
 * live in ./actions.ts beside them and call the shared cores in
 * lib/event-types-mutations.ts.
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

const BASE = CATEGORIES_PATH;

/** Vocab keys: lowercase snake, 3–31 chars, must start with a letter. */
const KEY_RE = /^[a-z][a-z0-9_]{2,30}$/;
const SAFE_ANCHOR = /[^a-z0-9_-]/g;

function redirectBack(
  kind: 'ok' | 'error',
  msg: string,
  anchor?: string,
): never {
  const p = new URLSearchParams();
  p.set('list', 'event-types');
  p.set(kind, msg);
  const a = (anchor ?? '').replace(SAFE_ANCHOR, '').slice(0, 80);
  if (a) p.set('open', a);
  redirect(`${BASE}?${p.toString()}`);
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
}

function cleanOptional(raw: FormDataEntryValue | null, max = 300): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, max);
  return t.length > 0 ? t : null;
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

function scopedRedirect(formData: FormData, eventType: string, kind: 'ok' | 'error', msg: string): never {
  redirect(backHref(formData, kind, msg, { list: 'event-types', open: eventType }));
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
  if (!tile) scopedRedirect(formData, eventType, 'error', 'Category not found.');

  const activeTypes = await activeEventTypeKeys(admin);
  const before = (tile.applicable_event_types as string[] | null) ?? null;
  const next = nextEventTypes(before, eventType, offered, activeTypes);

  const { error } = await admin
    .from('service_categories')
    .update({ applicable_event_types: next })
    .eq('id', tileId);
  if (error) scopedRedirect(formData, eventType, 'error', error.message);

  await admin.from('admin_audit_log').insert({
    action: 'event_types.scope_tile',
    target_table: 'service_categories',
    target_id: tileId,
    before_json: { applicable_event_types: before },
    after_json: { applicable_event_types: next, event_type: eventType, offered },
    actor_user_id: user.id,
  });
  revalidateRosterSurfaces();
  scopedRedirect(
    formData,
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
  if (rows.length === 0) scopedRedirect(formData, eventType, 'error', 'No categories in that section.');

  const activeTypes = await activeEventTypeKeys(admin);
  let changed = 0;
  for (const t of rows) {
    const next = nextEventTypes(t.applicable_event_types ?? null, eventType, offered, activeTypes);
    const { error } = await admin
      .from('service_categories')
      .update({ applicable_event_types: next })
      .eq('id', t.id);
    if (error) {
      logQueryError('app/admin/categories/event-type-actions.ts: setFolderEventTypeOffered service_categories', error, {
        tile_id: t.id,
        folder_id: folderId,
      });
    } else {
      changed += 1;
    }
  }

  await admin.from('admin_audit_log').insert({
    action: 'event_types.scope_folder',
    target_table: 'service_categories',
    target_id: folderId,
    after_json: { event_type: eventType, offered, tile_count: rows.length, changed },
    actor_user_id: user.id,
  });
  revalidateRosterSurfaces();
  scopedRedirect(
    formData,
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

function profileRedirect(formData: FormData, eventType: string, kind: 'ok' | 'error', msg: string): never {
  redirect(backHref(formData, kind, msg, { list: 'event-types', open: eventType }));
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
    redirectBack('error', 'Bad event-type key.');
  }

  // ⚠ MERGE OVER THE STORED BLOB, NEVER REBUILD IT. `terminology` is JSONB and
  // carries keys this form has no field for — the funeral row's `register:
  // 'solemn'` and `occasion_noun` (the whole guest-tree tone switch). A
  // rebuild-from-form here silently DROPPED any such key on every admin save,
  // flipping a wake's page back to the celebratory voice with no error. Read
  // first, spread, then overwrite only the fields this form actually edits.
  const adminForRead = createAdminClient();
  const { data: existingProfile } = await adminForRead
    .from('event_type_profiles')
    .select('terminology')
    .eq('event_type', key)
    .maybeSingle();
  const storedTerminology =
    existingProfile?.terminology && typeof existingProfile.terminology === 'object'
      ? (existingProfile.terminology as Record<string, unknown>)
      : {};
  const terminology = {
    ...storedTerminology,
    organizer_noun: cleanOptional(formData.get('organizer_noun'), 60),
    // The two words the organiser noun used to do alone (owner 2026-08-27).
    // Blank ⇒ the key is cleared and the resolver's per-row default takes over
    // (the organiser noun itself, or a plain 'host' where it names the
    // honoree), which is the same value it had before this form knew them.
    host_noun: cleanOptional(formData.get('host_noun'), 60),
    celebrant_noun: cleanOptional(formData.get('celebrant_noun'), 60),
    // Strictly parsed. An unrecognised value is written as null rather than
    // stored, so a malformed save falls back to the code default instead of
    // pinning a shape nothing understands.
    celebrant_shape: isCelebrantShape(formData.get('celebrant_shape'))
      ? formData.get('celebrant_shape')
      : null,
    person_a: cleanOptional(formData.get('person_a'), 60),
    person_b: cleanOptional(formData.get('person_b'), 60),
    seat_word: cleanOptional(formData.get('seat_word'), 60),
    event_word: cleanOptional(formData.get('event_word'), 60),
    vip_tier_label: cleanOptional(formData.get('vip_tier_label'), 80),
  };
  const enabled_surfaces = PROFILE_SURFACES.filter(
    (s) => formData.get(`surface_${s}`) === 'on',
  );
  // A day-of page or a gallery with no website is a page nobody can ever open:
  // both RENDER ON the public event site, and 'website' carries the only "go
  // live" control. REFUSE rather than silently ticking Website — the admin must
  // see which choice they are making. (Item 81; the same combination already
  // stranded simple_event once, repaired by migration 20271102084500.)
  const stranded = surfacesStrandedWithoutWebsite(enabled_surfaces);
  if (stranded.length > 0) {
    profileRedirect(formData, key, 'error', strandedWithoutWebsiteMessage(stranded));
  }
  const onboarding_flow_key = cleanOptional(formData.get('onboarding_flow_key'), 60);
  const role_set_key = cleanOptional(formData.get('role_set_key'), 60);

  // "Suppliers can serve it" — event_type_profiles.marketplace_enabled had a
  // reader (resolveProfile) and no editor. Written only when the form shows
  // the switch (`marketplace_enabled_shown`), so a form without it can never
  // switch a type's marketplace off by omission.
  const row: Record<string, unknown> = {
    event_type: key,
    terminology,
    enabled_surfaces,
    onboarding_flow_key,
    role_set_key,
  };
  if (formData.get('marketplace_enabled_shown') === '1') {
    row.marketplace_enabled = formData.get('marketplace_enabled') === 'on';
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from('event_type_profiles')
    .upsert(row, { onConflict: 'event_type' });
  if (error) {
    // 23503 = FK violation → the key isn't a known event_type_vocab row.
    if (error.code === '23503') {
      profileRedirect(formData, key, 'error', `"${key}" is not a known event type.`);
    }
    profileRedirect(formData, key, 'error', error.message);
  }

  await admin.from('admin_audit_log').insert({
    action: 'event_types.profile_upsert',
    target_table: 'event_type_profiles',
    target_id: key,
    after_json: row,
    actor_user_id: user.id,
  });
  revalidateRosterSurfaces();
  profileRedirect(formData, key, 'ok', 'Onboarding profile saved.');
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

function onboardingRedirect(formData: FormData, eventType: string, kind: 'ok' | 'error', msg: string): never {
  redirect(backHref(formData, kind, msg, { list: 'event-types', open: eventType }));
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
    redirectBack('error', 'Bad event-type key.');
  }
  if (key === 'wedding') {
    onboardingRedirect(formData, key, 'error', 'Wedding uses its own bespoke onboarding — not editable here.');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(String(formData.get('spec_json') ?? '{}')) as Record<string, unknown>;
  } catch {
    onboardingRedirect(formData, key, 'error', 'Could not read the form — please try again.');
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
      onboardingRedirect(formData, key, 'error', `"${key}" is not a known event type.`);
    }
    onboardingRedirect(formData, key, 'error', error.message);
  }

  await admin.from('admin_audit_log').insert({
    action: 'event_types.onboarding_upsert',
    target_table: 'event_type_onboarding',
    target_id: key,
    after_json: row,
    actor_user_id: user.id,
  });
  revalidateRosterSurfaces();
  revalidatePath(`/onboarding/${key}`);
  onboardingRedirect(formData, key, 'ok', 'Onboarding content saved.');
}

/** Reset a type's onboarding content to the code defaults (delete the override row). */
export async function resetOnboardingSpec(formData: FormData) {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '')
    .trim()
    .toLowerCase();
  if (!KEY_RE.test(key)) {
    redirectBack('error', 'Bad event-type key.');
  }

  const admin = createAdminClient();
  const { error } = await admin.from('event_type_onboarding').delete().eq('event_type', key);
  if (error) onboardingRedirect(formData, key, 'error', error.message);

  await admin.from('admin_audit_log').insert({
    action: 'event_types.onboarding_reset',
    target_table: 'event_type_onboarding',
    target_id: key,
    actor_user_id: user.id,
  });
  revalidateRosterSurfaces();
  revalidatePath(`/onboarding/${key}`);
  onboardingRedirect(formData, key, 'ok', 'Reset to default content.');
}
