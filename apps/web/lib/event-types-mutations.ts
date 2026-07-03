/**
 * event-types-mutations.ts — the shared `event_type_vocab` write core.
 *
 * The event-type roster CRUD (create / relabel-presentation / the `enabled`
 * couple-launch lever / retire / unretire) used to live only in
 * /admin/event-types/actions.ts. Taxonomy Studio PR 7 folds that standalone
 * roster into the Studio's Vocabularies → Event types bucket, so the write
 * logic moves here as framework-free cores that BOTH the Studio actions and the
 * (now-redirecting) legacy surface can call — one source of truth, no
 * duplicated lifecycle logic (the PR 5/6 shared-core pattern, mirrors
 * lib/wedding-types-mutations.ts).
 *
 * These take an already-constructed ADMIN client + the acting user id, do the
 * DB write + an admin_audit_log row, and return a plain result. Revalidation +
 * auth stay in the caller (the server action), since those are request-scoped.
 *
 * TWO lifecycle fields, two different gates (see lib/event-types-db.ts):
 *   - `status`  active/retired — retired types vanish from every scoping picker,
 *     vendor checkbox and marketplace filter EXCEPT historical events
 *     (events.event_type keeps an FK, not an active CHECK). "Deactivate" in the
 *     Studio == "Retire" here: same column, same value.
 *   - `enabled` TRUE = appears in the couple-side create-event picker. The
 *     launch lever. Independent of status — vendors may pre-tag coverage for an
 *     active-but-disabled type before a public unlock. RETIRING forces
 *     enabled=false (a retired type can't be creatable).
 *
 * ⚠ Write shapes here are byte-identical to the pre-fold /admin/event-types
 * actions — this is a RELOCATION, not a behavior change. The couple-facing
 * gating semantics (what `enabled` / `status` mean and who reads them) are
 * unchanged; only the admin home moves.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/** Vocab keys: lowercase snake, 3–31 chars, must start with a letter. */
export const EVENT_TYPE_KEY_RE = /^[a-z][a-z0-9_]{2,30}$/;

export type MutationResult<T = void> =
  | ({ ok: true } & (T extends void ? Record<never, never> : { data: T }))
  | { ok: false; error: string };

function cleanOptional(raw: string | null | undefined, max = 300): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

/** Hrefs/URLs the picker can route to: in-app path or absolute http(s) URL. */
function cleanHrefLike(raw: string | null | undefined): string | null {
  const t = cleanOptional(raw, 300);
  if (!t) return null;
  if (t.startsWith('/') || t.startsWith('https://') || t.startsWith('http://')) return t;
  return null;
}

export type CreateEventTypeInput = {
  key: string;
  label: string;
  emoji?: string | null;
  description?: string | null;
  sortOrder?: number | null;
};

/**
 * Add a new event type. Lands `status='active'`, `enabled=FALSE` — the admin
 * flips "Show in picker" (setEventTypeEnabledCore) when the type is ready to
 * launch. Returns `{ ok:false, error:'exists' }` on a duplicate key so the
 * caller can craft a "keys are permanent" message; other errors pass through.
 */
export async function createEventTypeCore(
  admin: SupabaseClient,
  actorUserId: string,
  input: CreateEventTypeInput,
): Promise<MutationResult<{ key: string; label: string }>> {
  const key = input.key.trim().toLowerCase();
  const label = input.label.trim().slice(0, 80);
  const emoji = (input.emoji ?? '').trim().slice(0, 16) || '🎉';
  const description = cleanOptional(input.description);
  const sortRaw = Number(input.sortOrder);
  const sortOrder = Number.isInteger(sortRaw) && sortRaw >= 0 ? sortRaw : 100;

  if (!EVENT_TYPE_KEY_RE.test(key)) {
    return {
      ok: false,
      error:
        'Key must be 3–31 characters: lowercase letters, numbers, underscores, starting with a letter (e.g. house_blessing).',
    };
  }
  if (!label) return { ok: false, error: 'Give the event type a display name.' };

  const row = {
    event_type: key,
    label_en: label,
    emoji,
    description,
    sort_order: sortOrder,
    status: 'active',
    enabled: false,
  };
  const { error } = await admin.from('event_type_vocab').insert(row);
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'exists' };
    return { ok: false, error: error.message };
  }

  await admin.from('admin_audit_log').insert({
    action: 'event_types.create',
    target_table: 'event_type_vocab',
    target_id: key,
    after_json: row,
    actor_user_id: actorUserId,
  });
  return { ok: true, data: { key, label } };
}

export type UpdateEventTypeInput = {
  key: string;
  label: string;
  emoji?: string | null;
  description?: string | null;
  onboardingHref?: string | null;
  heroPhotoUrl?: string | null;
  sortOrder?: number | null;
};

/**
 * Edit presentation fields. The key itself is immutable (it's the FK target for
 * every existing event + vendor coverage tag). Returns `{ ok:false,
 * error:'not_found' }` when the key doesn't exist.
 */
export async function updateEventTypeCore(
  admin: SupabaseClient,
  actorUserId: string,
  input: UpdateEventTypeInput,
): Promise<MutationResult<{ key: string; label: string }>> {
  const key = input.key.trim();
  const label = input.label.trim().slice(0, 80);
  const emoji = (input.emoji ?? '').trim().slice(0, 16) || '🎉';
  const description = cleanOptional(input.description);
  const onboardingHref = cleanHrefLike(input.onboardingHref);
  const heroPhotoUrl = cleanHrefLike(input.heroPhotoUrl);
  const sortRaw = Number(input.sortOrder);
  const sortOrder = Number.isInteger(sortRaw) && sortRaw >= 0 ? sortRaw : null;

  if (!EVENT_TYPE_KEY_RE.test(key)) return { ok: false, error: 'Unknown event type.' };
  if (!label) return { ok: false, error: 'Display name can’t be empty.' };

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
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: 'not_found' };

  await admin.from('admin_audit_log').insert({
    action: 'event_types.update',
    target_table: 'event_type_vocab',
    target_id: key,
    after_json: patch,
    actor_user_id: actorUserId,
  });
  return { ok: true, data: { key, label } };
}

/**
 * The launch lever — show/hide a type in the couple-side create-event picker
 * (`event_type_vocab.enabled`). Independent of active/retired (vendors can
 * pre-tag coverage for active-but-hidden types). Enabling a retired type is
 * rejected — un-retire it first. Returns the row's label on success.
 */
export async function setEventTypeEnabledCore(
  admin: SupabaseClient,
  actorUserId: string,
  key: string,
  enable: boolean,
): Promise<MutationResult<{ label: string }>> {
  const k = key.trim();
  if (!EVENT_TYPE_KEY_RE.test(k)) return { ok: false, error: 'Unknown event type.' };

  const { data: row } = await admin
    .from('event_type_vocab')
    .select('event_type, label_en, status')
    .eq('event_type', k)
    .maybeSingle();
  if (!row) return { ok: false, error: 'not_found' };
  if (enable && row.status !== 'active') {
    return { ok: false, error: `${row.label_en} is retired — un-retire it first.` };
  }

  const { error } = await admin
    .from('event_type_vocab')
    .update({ enabled: enable, updated_at: new Date().toISOString() })
    .eq('event_type', k);
  if (error) return { ok: false, error: error.message };

  await admin.from('admin_audit_log').insert({
    action: enable ? 'event_types.enable' : 'event_types.disable',
    target_table: 'event_type_vocab',
    target_id: k,
    after_json: { enabled: enable },
    actor_user_id: actorUserId,
  });
  return { ok: true, data: { label: row.label_en } };
}

/**
 * Retire a type: it disappears from every picker + vendor checkbox + filter, but
 * every existing event of that type keeps working (FK stays valid — deliberately
 * no active-status CHECK on events.event_type). Retiring forces enabled=false.
 * Wedding is the platform's V1 anchor and cannot be retired.
 */
export async function retireEventTypeCore(
  admin: SupabaseClient,
  actorUserId: string,
  key: string,
): Promise<MutationResult<{ label: string }>> {
  const k = key.trim();
  if (!EVENT_TYPE_KEY_RE.test(k)) return { ok: false, error: 'Unknown event type.' };
  if (k === 'wedding') {
    return { ok: false, error: 'Wedding is the platform anchor — it can’t be retired.' };
  }

  const { data: row, error } = await admin
    .from('event_type_vocab')
    .update({ status: 'retired', enabled: false, updated_at: new Date().toISOString() })
    .eq('event_type', k)
    .select('label_en')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: 'not_found' };

  await admin.from('admin_audit_log').insert({
    action: 'event_types.retire',
    target_table: 'event_type_vocab',
    target_id: k,
    after_json: { status: 'retired', enabled: false },
    actor_user_id: actorUserId,
  });
  return { ok: true, data: { label: row.label_en } };
}

/**
 * Reverse a retirement — the type returns as active (picker visibility is still
 * a separate "Show in picker" flip / setEventTypeEnabledCore).
 */
export async function unretireEventTypeCore(
  admin: SupabaseClient,
  actorUserId: string,
  key: string,
): Promise<MutationResult<{ label: string }>> {
  const k = key.trim();
  if (!EVENT_TYPE_KEY_RE.test(k)) return { ok: false, error: 'Unknown event type.' };

  const { data: row, error } = await admin
    .from('event_type_vocab')
    .update({ status: 'active', updated_at: new Date().toISOString() })
    .eq('event_type', k)
    .select('label_en')
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!row) return { ok: false, error: 'not_found' };

  await admin.from('admin_audit_log').insert({
    action: 'event_types.unretire',
    target_table: 'event_type_vocab',
    target_id: k,
    after_json: { status: 'active' },
    actor_user_id: actorUserId,
  });
  return { ok: true, data: { label: row.label_en } };
}
