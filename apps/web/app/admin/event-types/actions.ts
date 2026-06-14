'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Setnayan HQ · Event Types actions — CRUD over `event_type_vocab`, the
 * single source for the event-type roster (2026-06-13 cutover).
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

/** Hrefs/URLs the picker can route to: in-app path or absolute http(s) URL. */
function cleanHrefLike(raw: FormDataEntryValue | null): string | null {
  const t = cleanOptional(raw, 300);
  if (!t) return null;
  if (t.startsWith('/') || t.startsWith('https://') || t.startsWith('http://')) return t;
  return null;
}

/** Add a new event type. Lands status='active', enabled=FALSE — the admin
 *  flips "Show in picker" when the type is ready to launch. */
export async function createEventType(formData: FormData) {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '').trim().toLowerCase();
  const label = String(formData.get('label_en') ?? '').trim().slice(0, 80);
  const emoji = String(formData.get('emoji') ?? '').trim().slice(0, 16) || '🎉';
  const description = cleanOptional(formData.get('description'));
  const sortRaw = Number(formData.get('sort_order'));
  const sortOrder = Number.isInteger(sortRaw) && sortRaw >= 0 ? sortRaw : 100;

  if (!KEY_RE.test(key)) {
    redirectBack(
      'error',
      'Key must be 3–31 characters: lowercase letters, numbers, underscores, starting with a letter (e.g. house_blessing).',
    );
  }
  if (!label) redirectBack('error', 'Give the event type a display name.');

  const admin = createAdminClient();
  const { error } = await admin.from('event_type_vocab').insert({
    event_type: key,
    label_en: label,
    emoji,
    description,
    sort_order: sortOrder,
    status: 'active',
    enabled: false,
  });
  if (error) {
    if (error.code === '23505') {
      redirectBack('error', `"${key}" already exists — keys are permanent, edit the existing row instead.`, key);
    }
    redirectBack('error', error.message);
  }

  await admin.from('admin_audit_log').insert({
    action: 'event_types.create',
    target_table: 'event_type_vocab',
    target_id: key,
    after_json: { event_type: key, label_en: label, emoji, description, sort_order: sortOrder, status: 'active', enabled: false },
    actor_user_id: user.id,
  });
  revalidateRosterSurfaces();
  redirectBack('ok', `${label} created. It stays out of the couple picker until you turn on "Show in picker".`, key);
}

/** Edit presentation fields. The key itself is immutable (it's the FK target
 *  for every existing event + vendor coverage tag). */
export async function updateEventType(formData: FormData) {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '').trim();
  const label = String(formData.get('label_en') ?? '').trim().slice(0, 80);
  const emoji = String(formData.get('emoji') ?? '').trim().slice(0, 16) || '🎉';
  const description = cleanOptional(formData.get('description'));
  const onboardingHref = cleanHrefLike(formData.get('onboarding_href'));
  const heroPhotoUrl = cleanHrefLike(formData.get('hero_photo_url'));
  const sortRaw = Number(formData.get('sort_order'));
  const sortOrder = Number.isInteger(sortRaw) && sortRaw >= 0 ? sortRaw : null;

  if (!KEY_RE.test(key)) redirectBack('error', 'Unknown event type.');
  if (!label) redirectBack('error', 'Display name can’t be empty.', key);

  const admin = createAdminClient();
  const patch: Record<string, unknown> = {
    label_en: label,
    emoji,
    description,
    onboarding_href: onboardingHref,
    hero_photo_url: heroPhotoUrl,
    updated_at: new Date().toISOString(),
  };
  if (sortOrder !== null) patch.sort_order = sortOrder;

  const { data, error } = await admin
    .from('event_type_vocab')
    .update(patch)
    .eq('event_type', key)
    .select('event_type')
    .maybeSingle();
  if (error) redirectBack('error', error.message, key);
  if (!data) redirectBack('error', 'Event type not found.');

  await admin.from('admin_audit_log').insert({
    action: 'event_types.update',
    target_table: 'event_type_vocab',
    target_id: key,
    after_json: patch,
    actor_user_id: user.id,
  });
  revalidateRosterSurfaces();
  redirectBack('ok', `${label} saved.`, key);
}

/** The launch lever — show/hide a type in the couple-side create-event
 *  picker. Independent of active/retired (vendors can pre-tag coverage for
 *  active-but-hidden types). */
export async function setEventTypeEnabled(formData: FormData) {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '').trim();
  const enable = String(formData.get('enabled') ?? '') === '1';
  if (!KEY_RE.test(key)) redirectBack('error', 'Unknown event type.');

  const admin = createAdminClient();
  const { data: row } = await admin
    .from('event_type_vocab')
    .select('event_type, label_en, status')
    .eq('event_type', key)
    .maybeSingle();
  if (!row) redirectBack('error', 'Event type not found.');
  if (enable && row.status !== 'active') {
    redirectBack('error', `${row.label_en} is retired — un-retire it first.`, key);
  }

  const { error } = await admin
    .from('event_type_vocab')
    .update({ enabled: enable, updated_at: new Date().toISOString() })
    .eq('event_type', key);
  if (error) redirectBack('error', error.message, key);

  await admin.from('admin_audit_log').insert({
    action: enable ? 'event_types.enable' : 'event_types.disable',
    target_table: 'event_type_vocab',
    target_id: key,
    after_json: { enabled: enable },
    actor_user_id: user.id,
  });
  revalidateRosterSurfaces();
  redirectBack(
    'ok',
    enable
      ? `${row.label_en} is now live in the create-event picker.`
      : `${row.label_en} is hidden from the create-event picker. Existing ${row.label_en} events keep working.`,
    key,
  );
}

/** Retire a type: it disappears from every picker + vendor checkbox + filter,
 *  but every existing event of that type keeps working (FK stays valid —
 *  deliberately no active-status CHECK on events.event_type). Wedding is the
 *  platform's V1 anchor and cannot be retired. */
export async function retireEventType(formData: FormData) {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '').trim();
  if (!KEY_RE.test(key)) redirectBack('error', 'Unknown event type.');
  if (key === 'wedding') {
    redirectBack('error', 'Wedding is the platform anchor — it can’t be retired.', key);
  }

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('event_type_vocab')
    .update({ status: 'retired', enabled: false, updated_at: new Date().toISOString() })
    .eq('event_type', key)
    .select('label_en')
    .maybeSingle();
  if (error) redirectBack('error', error.message, key);
  if (!row) redirectBack('error', 'Event type not found.');

  await admin.from('admin_audit_log').insert({
    action: 'event_types.retire',
    target_table: 'event_type_vocab',
    target_id: key,
    after_json: { status: 'retired', enabled: false },
    actor_user_id: user.id,
  });
  revalidateRosterSurfaces();
  redirectBack('ok', `${row.label_en} retired. Existing events keep working; nobody can pick it for new events.`, key);
}

/** Reverse a retirement — the type returns as active (picker visibility is
 *  still a separate "Show in picker" flip). */
export async function unretireEventType(formData: FormData) {
  const user = await requireAdmin();
  const key = String(formData.get('event_type') ?? '').trim();
  if (!KEY_RE.test(key)) redirectBack('error', 'Unknown event type.');

  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('event_type_vocab')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('event_type', key)
    .select('label_en')
    .maybeSingle();
  if (error) redirectBack('error', error.message, key);
  if (!row) redirectBack('error', 'Event type not found.');

  await admin.from('admin_audit_log').insert({
    action: 'event_types.unretire',
    target_table: 'event_type_vocab',
    target_id: key,
    after_json: { status: 'active' },
    actor_user_id: user.id,
  });
  revalidateRosterSurfaces();
  redirectBack('ok', `${row.label_en} is active again. Flip "Show in picker" when you’re ready to relaunch it.`, key);
}
