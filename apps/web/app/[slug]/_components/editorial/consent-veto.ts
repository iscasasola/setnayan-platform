// RA 10173 consent veto for the PUBLIC recap (gap audit 2026-07-23 · B3).
//
// Isolated in its own module (no `server-only` import — the admin client is a
// TYPE-only import) so the editorial data layer can reuse it AND a unit test can
// exercise it with a stub client. See editorial/data.ts for the read sites.

import type { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

/** Local, dependency-free string coercion (mirrors data.ts `asString`). */
function asString(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : null;
  }
  return null;
}

/**
 * Returns the set of `papic_photos` photo_ids that carry AT LEAST ONE tagged
 * guest who opted OUT of photos (`guests.photo_consent = FALSE`) — the SAME G2
 * consent veto the Live Photo Wall enforces (migration 20261112000545
 * `wall_visible_photos`). Any such capture must be WITHHELD from every public
 * image read on the editorial recap, regardless of the couple's curation:
 * consent WINS over curation.
 *
 * `failed` is true when the veto could not be resolved (a transient DB error).
 * Callers then fail CLOSED — withholding ALL papic captures (the recap degrades
 * to the couple's own manual `our_photos` uploads, which carry no guest tags)
 * rather than risk showing an opted-out guest. The `guests` table, its
 * `photo_consent` column, and `photo_tags` have existed since the first
 * migrations, so a "table missing" case is not expected for a real event; an
 * empty result simply means nobody opted out (the common case).
 */
export type ConsentVeto = {
  /** Captures tagging a guest who opted out — the ORIGINAL must never be shown. */
  ids: Set<string>;
  /** Vetoed capture → its baked all-faces-blurred stand-in, where one exists. */
  safeKeyById: Map<string, string>;
  /** True when the veto itself could not be resolved ⇒ withhold everything. */
  failed: boolean;
};

/**
 * THE ONE PLACE THAT DECIDES WHAT A PUBLIC SURFACE MAY SHOW for a capture.
 *
 * Returns the object key to render, or `null` to show nothing at all.
 *
 * 🔑 A GATE, NOT A CHECK REPEATED TEN TIMES. `data.ts` consults the veto in ten
 * places; before the 2026-08-17 ruling each one independently dropped the row.
 * Teaching ten sites the new "…unless a blurred copy exists" rule is ten
 * chances to forget, and the eleventh surface makes eleven. Same reasoning as
 * the guest photo-wall mirror, which was fused into one gate for this reason.
 *
 * ⚖ MONOTONE BY CONSTRUCTION — this can only ever show LESS than the original,
 * never more:
 *   • not vetoed        → the original, exactly as before
 *   • vetoed + a bake   → the blurred stand-in (previously: nothing)
 *   • vetoed, no bake   → null (previously: nothing)
 *   • veto unresolved   → null (previously: nothing)
 * So no face that is hidden today becomes visible tomorrow. The softening only
 * ever turns "nothing" into "blurred".
 *
 * ⚠ THE BLUR IS ALL FACES, NOT ONE. `lib/face-blur.ts` blurs EVERY detected
 * face into the pixels; there is no per-person targeting and none is possible
 * until face recognition runs and guests enrol. A table of ten with one
 * opt-out renders as ten blurred faces. **The owner chose this knowingly on
 * 2026-08-18**, over keeping the photo hidden, because a hidden photo serves
 * nobody. Do not "improve" it into a partial blur without re-asking.
 */
export function publicKeyForCapture(
  veto: ConsentVeto,
  photoId: string | null | undefined,
  originalKey: string | null | undefined,
): string | null {
  if (!photoId || !originalKey) return null;
  if (veto.failed) return null;
  if (!veto.ids.has(photoId)) return originalKey;
  return veto.safeKeyById.get(photoId) ?? null;
}

export async function loadConsentVetoedPapicIds(
  admin: AdminClient,
  eventId: string,
): Promise<ConsentVeto> {
  const ids = new Set<string>();
  const safeKeyById = new Map<string, string>();

  // Guests who opted OUT of photos for this event.
  let optedOutGuestIds: string[] = [];
  try {
    const { data, error } = await admin
      .from('guests')
      .select('guest_id')
      .eq('event_id', eventId)
      .eq('photo_consent', false)
      .is('deleted_at', null);
    if (error) return { ids, safeKeyById, failed: true };
    optedOutGuestIds = ((data ?? []) as Array<Record<string, unknown>>)
      .map((r) => asString(r.guest_id))
      .filter((v): v is string => Boolean(v));
  } catch {
    return { ids, safeKeyById, failed: true };
  }

  // Nobody opted out → nothing vetoed (the common case; no second query needed).
  if (optedOutGuestIds.length === 0) return { ids, safeKeyById, failed: false };

  // Every papic_photos capture that TAGS one of those guests is withheld. (A
  // 'photo' and a 'clip' both live in papic_photos, so this covers clips too.)
  try {
    const { data, error } = await admin
      .from('photo_tags')
      .select('source_id')
      .eq('event_id', eventId)
      .eq('source_table', 'papic_photos')
      .in('guest_id', optedOutGuestIds);
    if (error) return { ids, safeKeyById, failed: true };
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const id = asString(r.source_id);
      if (id) ids.add(id);
    }
  } catch {
    return { ids, safeKeyById, failed: true };
  }

  // ── The blurred stand-ins (owner ruling 2026-08-17) ──────────────────────
  // A vetoed capture is no longer simply dropped: where a BAKED blurred
  // derivative exists it is shown INSTEAD of the original. Read here, once,
  // for the same reason the veto itself is — ten call sites downstream must
  // not each learn this rule.
  //
  // A read failure here is NOT `failed: true`. `failed` means "the veto could
  // not be resolved, withhold everything"; this query only ever ADDS a
  // softer option. If it errors, the map stays empty and every vetoed capture
  // is withheld — exactly the pre-ruling behaviour. Fail closed, quietly.
  try {
    const { data, error } = await admin
      .from('papic_photos')
      .select('photo_id, wall_safe_r2_key')
      .eq('event_id', eventId)
      .in('photo_id', [...ids])
      .not('wall_safe_r2_key', 'is', null);
    if (!error) {
      for (const r of (data ?? []) as Array<Record<string, unknown>>) {
        const id = asString(r.photo_id);
        const safe = asString(r.wall_safe_r2_key);
        if (id && safe) safeKeyById.set(id, safe);
      }
    }
  } catch {
    /* keep the map empty — every vetoed capture stays withheld */
  }

  return { ids, safeKeyById, failed: false };
}
