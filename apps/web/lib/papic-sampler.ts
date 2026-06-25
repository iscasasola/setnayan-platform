import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventOwnsPapicSeats } from '@/lib/papic-seats';
import { r2Copy, r2Delete, type R2BucketName } from '@/lib/r2';
import { relocateRef } from '@/lib/papic-relocation-core';

// Free Papic sampler — the locked "connect Drive OR upgrade = permanent" rule
// (owner 2026-06-16; migration 20270103000000 lines 6-8). Sampler captures carry
// a 30-day papic_photos.expires_at; converting — connecting Google Drive or
// buying paid Papic — is meant to make them permanent. Nothing used to clear the
// stamp, so the retention sweep deleted the photos of the very couples who DID
// convert, and the gallery hid them at day 30. These two helpers are the single
// place that promise lives.

type SamplerKeyRow = {
  photo_id: string;
  r2_object_key: string | null;
  poster_r2_key: string | null;
  display_r2_key: string | null;
  thumb_r2_key: string | null;
  wall_safe_r2_key: string | null;
};

// Every R2 key a sampler photo can carry — original, clip poster, the two display
// derivatives, and the face-blurred live-wall variant. All five can sit under the
// ephemeral `papic-sampler/` prefix, so all five must move on convert.
const RELOCATABLE_KEY_COLUMNS = [
  'r2_object_key',
  'poster_r2_key',
  'display_r2_key',
  'thumb_r2_key',
  'wall_safe_r2_key',
] as const;

/**
 * Move ONE row's sampler bytes off the ephemeral `papic-sampler/` prefix onto the
 * permanent `papic/` prefix, then flip the row permanent. Per-row FAIL-SAFE: the
 * row's refs + expiry are updated only once EVERY object copy succeeds, so a
 * partial R2 failure leaves the row exactly as it was (still under the ephemeral
 * prefix, still inside its retention window) to be retried on the next convert.
 * Never throws.
 */
async function relocateRowToPermanent(
  admin: ReturnType<typeof createAdminClient>,
  row: SamplerKeyRow,
): Promise<void> {
  try {
    const moves = RELOCATABLE_KEY_COLUMNS.map((col) => {
      const moved = relocateRef(row[col]);
      return moved ? { col, ...moved } : null;
    }).filter((m): m is NonNullable<typeof m> => m !== null);

    if (moves.length === 0) {
      // Nothing under the ephemeral prefix (legacy / already permanent) — just
      // honour the keep promise.
      await admin.from('papic_photos').update({ expires_at: null }).eq('photo_id', row.photo_id);
      return;
    }

    // Copy every object FIRST. Abort the whole row on any failure (no DB change).
    const copies = await Promise.allSettled(
      moves.map((m) => r2Copy({ bucket: m.bucket as R2BucketName, fromKey: m.fromKey, toKey: m.toKey })),
    );
    if (copies.some((c) => c.status === 'rejected')) return;

    // All bytes safely on the permanent prefix → repoint the refs + flip permanent.
    const patch: Record<string, string | null> = { expires_at: null };
    for (const m of moves) patch[m.col] = m.toRef;
    const { error } = await admin.from('papic_photos').update(patch).eq('photo_id', row.photo_id);
    if (error) return; // keep the old objects; the lifecycle rule is the backstop, retried next run

    // DB now points at the permanent copies → best-effort delete the ephemeral
    // originals (the R2 lifecycle rule cleans any we miss).
    await Promise.allSettled(
      moves.map((m) => r2Delete({ bucket: m.bucket as R2BucketName, key: m.fromKey })),
    );
  } catch {
    /* never throw — a relocation failure must not roll back a convert */
  }
}

/**
 * Make an event's free-sampler photos PERMANENT on convert (connect Drive / buy):
 *  (1) RELOCATE any bytes still under the ephemeral `papic-sampler/` prefix onto
 *      the permanent `papic/` prefix, so a future R2 lifecycle rule on the
 *      ephemeral prefix can NEVER delete this kept couple's photos; then
 *  (2) clear the 30-day `expires_at` on every still-ephemeral row (the original
 *      keep promise; also covers legacy / already-permanent-prefix rows).
 * Idempotent, service-role (bypasses RLS), best-effort — it NEVER throws, because
 * a failure here must not roll back a payment activation or a Drive connect.
 * Returns the rows whose expiry was cleared in step (2).
 */
export async function makeSamplerPermanent(eventId: string): Promise<number> {
  if (!eventId) return 0;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return 0;
  }

  // (1) Relocate this event's ephemeral-prefixed bytes off `papic-sampler/`.
  try {
    const { data: rows } = await admin
      .from('papic_photos')
      .select('photo_id, r2_object_key, poster_r2_key, display_r2_key, thumb_r2_key, wall_safe_r2_key')
      .eq('event_id', eventId)
      .like('r2_object_key', '%papic-sampler/%');
    for (const row of (rows ?? []) as SamplerKeyRow[]) {
      await relocateRowToPermanent(admin, row);
    }
  } catch {
    /* best-effort — fall through to the expiry clear */
  }

  // (2) Clear the 30-day expiry on the remaining ephemeral rows.
  try {
    const { data, error } = await admin
      .from('papic_photos')
      .update({ expires_at: null })
      .eq('event_id', eventId)
      .not('expires_at', 'is', null)
      .select('photo_id');
    if (error) return 0;
    return data?.length ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Has this event already "converted" at sampler-capture time — i.e. should new
 * sampler shots be born PERMANENT instead of carrying the 30-day stamp? True
 * when the event has converted by EITHER path: an active Google Drive grant
 * (the couple has their own copy) OR paid Papic ownership (the upgrade). Both are
 * checked here — not just the Drive grant — because this is also the keep-check
 * the retention sweep uses as its backstop, so it must self-heal a paid event
 * even if the PAPIC_SEATS activation hook's best-effort clear was missed. Uses
 * the service-role client (the paparazzo-claimer's own session can't read
 * oauth_grants / orders under RLS). Best-effort: any error → false, so the photo
 * just gets the safe 30-day stamp (which makeSamplerPermanent flips the moment
 * the couple converts anyway).
 */
export async function eventSamplerIsKept(eventId: string): Promise<boolean> {
  if (!eventId) return false;
  try {
    const admin = createAdminClient();
    // (1) Active Google Drive grant — the couple has their own permanent copy.
    const { data: grant } = await admin
      .from('oauth_grants')
      .select('grant_id')
      .eq('event_id', eventId)
      .eq('provider', 'drive')
      .is('revoked_at', null)
      .maybeSingle();
    if (grant) return true;
    // (2) Owns paid Papic — the upgrade path. Checked HERE (not only at the
    // PAPIC_SEATS activation hook) so the sweep self-heals a paid event even if
    // that hook's best-effort expires_at clear was missed.
    return await eventOwnsPapicSeats(admin, eventId);
  } catch {
    return false;
  }
}
