'use server';

/**
 * THE WRITE PATH for `guests.avatar_config` — the guest's own chibi (C5).
 *
 * The column has existed since migration 20270918210897 with **no writer at
 * all**; this is it. Everything it needs already shipped in `lib/chibi-config.ts`
 * (the catalog, the strict `validateChibiConfig` gate, the never-throwing
 * `resolveChibiConfig` read repair) — this module adds no vocabulary of its own.
 * Values not in that catalog do not exist anywhere in the system, and this is
 * the door they are turned away at.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔒 TRUST MODEL — the SAME one `submitRsvp`, `withdrawFaceConsent` and
 * `setGuestFaceBlock` use, deliberately not a new one: the sealed guest session
 * cookie (`readGuestSession`) must match BOTH the event and the guest. A guest
 * can only ever move their own avatar. There is no admin/couple write path here
 * — the couple does not dress their guests.
 *
 * 🛡 CONSENT POSTURE (reused, never invented — C5's standing instruction):
 *   · PER-EVENT SCOPE. `avatar_config` lives on `guests`, which is per-event.
 *     There is no account-level avatar column, so there is nothing to reuse
 *     across events even by accident.
 *   · NEVER REQUIRED. NULL is the default and the anonymous mannequin is the
 *     default render. Nothing in the product gates on having one.
 *   · REVOCABLE, by the subject, in one action — `resetMyAvatarAction` writes
 *     NULL, which is exactly what the migration's own comment nominates as the
 *     guest-initiated reset.
 *   · NOT BIOMETRIC, and not derived from anything that is. A config is a set
 *     of catalog ids. This module never reads `guest_face_enrollments`,
 *     `user_face_profiles`, `photo_url` or `users.sex` (chibi-config's privacy
 *     fence: `bodyType` is a cosmetic and may never be joined to sex).
 */

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';
import {
  validateChibiConfig,
  CHIBI_CONFIG_KEYS,
  CHIBI_CONFIG_MAX_BYTES,
  type ChibiAvatarConfig,
} from '@/lib/chibi-config';

export type SaveAvatarResult =
  | { ok: true }
  | { ok: false; reason: 'signed_out' | 'invalid'; problems?: string[] };

/**
 * Re-emit the config with keys in `CHIBI_CONFIG_KEYS` order and NOTHING else.
 *
 * Belt AND braces: `validateChibiConfig` already rejects unknown keys, so this
 * cannot normally drop anything. It exists because the value goes to JSONB —
 * whatever reaches `.update()` is what gets stored — and a rebuilt object is a
 * structural guarantee that no extra property can ride along, rather than a
 * guarantee that depends on the validator having been called first.
 */
function canonicalize(config: ChibiAvatarConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of CHIBI_CONFIG_KEYS) out[key] = config[key];
  return out;
}

/** The guest-facing surfaces an avatar change can show on. A blank/odd slug is
 *  skipped rather than revalidating '/' — a bad cache bust is not worth a
 *  wrong one. */
function revalidateAvatarSurfaces(slug: string): void {
  const s = (slug ?? '').trim();
  if (!s || s.includes('/')) return;
  revalidatePath(`/${s}/venue`);
  revalidatePath(`/${s}/avatar`);
}

/**
 * Save the signed-in guest's avatar. Fail-closed: an unrecognised session, or
 * ANY field outside the catalog, writes nothing and says why.
 *
 * Returns a result rather than redirecting — the maker is a live 3D preview and
 * stays put on save, the way the face-block toggle does rather than the way the
 * RSVP form does.
 */
export async function saveMyAvatarAction(
  eventId: string,
  slug: string,
  config: unknown,
): Promise<SaveAvatarResult> {
  const session = await readGuestSession();
  if (!session || session.event_id !== eventId) return { ok: false, reason: 'signed_out' };

  // Size is checked BEFORE the field walk: a multi-megabyte blob should be
  // refused as a payload, not crawled key by key. The DB CHECK
  // (`guests_avatar_config_size_check`, ≤ 2048 bytes) is the backstop behind
  // this, not the first line of defence — a constraint violation reaching the
  // guest as a 500 would be a worse answer than "that isn't a valid avatar".
  let serialized: string;
  try {
    serialized = JSON.stringify(config);
  } catch {
    return { ok: false, reason: 'invalid', problems: ['config is not serializable'] };
  }
  if (typeof serialized !== 'string' || serialized.length > CHIBI_CONFIG_MAX_BYTES) {
    return { ok: false, reason: 'invalid', problems: ['config too large'] };
  }

  const problems = validateChibiConfig(config);
  if (problems.length > 0) return { ok: false, reason: 'invalid', problems };

  const admin = createAdminClient();
  const { error } = await admin
    .from('guests')
    .update({ avatar_config: canonicalize(config as ChibiAvatarConfig) })
    .eq('event_id', eventId)
    .eq('guest_id', session.guest_id)
    .is('deleted_at', null);

  if (error) {
    // A failed write must NOT read as a save. The maker keeps the guest's
    // unsaved edits on screen and says the save did not land.
    console.warn('[saveMyAvatarAction] write failed', {
      eventId,
      error: error.message,
    });
    return { ok: false, reason: 'invalid', problems: ['could not save right now'] };
  }

  // The room is `force-dynamic`, so this is belt-and-braces rather than the
  // mechanism — but the maker links straight back to the walk and a guest who
  // saves then taps through should not meet a cached stranger of themselves.
  revalidateAvatarSurfaces(slug);
  return { ok: true };
}

/**
 * THE REVOCATION. Writes NULL — the migration comment's own nominated
 * "guest-initiated reset" — after which the guest renders exactly as a guest who
 * never made one: the anonymous mannequin in the instanced crowd. Idempotent.
 */
export async function resetMyAvatarAction(
  eventId: string,
  slug: string,
): Promise<SaveAvatarResult> {
  const session = await readGuestSession();
  if (!session || session.event_id !== eventId) return { ok: false, reason: 'signed_out' };

  const admin = createAdminClient();
  const { error } = await admin
    .from('guests')
    .update({ avatar_config: null })
    .eq('event_id', eventId)
    .eq('guest_id', session.guest_id)
    .is('deleted_at', null);

  if (error) {
    console.warn('[resetMyAvatarAction] reset failed', { eventId, error: error.message });
    return { ok: false, reason: 'invalid', problems: ['could not reset right now'] };
  }
  revalidateAvatarSurfaces(slug);
  return { ok: true };
}
