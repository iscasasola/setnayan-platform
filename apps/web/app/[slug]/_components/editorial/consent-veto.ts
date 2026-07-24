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
export async function loadConsentVetoedPapicIds(
  admin: AdminClient,
  eventId: string,
): Promise<{ ids: Set<string>; failed: boolean }> {
  const ids = new Set<string>();

  // Guests who opted OUT of photos for this event.
  let optedOutGuestIds: string[] = [];
  try {
    const { data, error } = await admin
      .from('guests')
      .select('guest_id')
      .eq('event_id', eventId)
      .eq('photo_consent', false)
      .is('deleted_at', null);
    if (error) return { ids, failed: true };
    optedOutGuestIds = ((data ?? []) as Array<Record<string, unknown>>)
      .map((r) => asString(r.guest_id))
      .filter((v): v is string => Boolean(v));
  } catch {
    return { ids, failed: true };
  }

  // Nobody opted out → nothing vetoed (the common case; no second query needed).
  if (optedOutGuestIds.length === 0) return { ids, failed: false };

  // Every papic_photos capture that TAGS one of those guests is withheld. (A
  // 'photo' and a 'clip' both live in papic_photos, so this covers clips too.)
  try {
    const { data, error } = await admin
      .from('photo_tags')
      .select('source_id')
      .eq('event_id', eventId)
      .eq('source_table', 'papic_photos')
      .in('guest_id', optedOutGuestIds);
    if (error) return { ids, failed: true };
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const id = asString(r.source_id);
      if (id) ids.add(id);
    }
  } catch {
    return { ids, failed: true };
  }

  return { ids, failed: false };
}
