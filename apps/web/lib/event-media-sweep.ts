import { createAdminClient } from '@/lib/supabase/admin';
import { r2Delete, R2_BUCKETS, type R2BucketName } from '@/lib/r2';

/**
 * event-media-sweep.ts — when a celebration is removed, its files go too.
 *
 * ─── THE OWNER'S RULING, AND WHAT IT DOES AND DOES NOT CHANGE ──────────────
 * Owner, 2026-08-20, asked directly what should happen to the photographs when
 * a couple deletes their own celebration: **delete them too.**
 *
 * 🔑 THIS EXTENDS THE PHOTO LOCK, IT DOES NOT REVERSE IT. "again. not delete.
 * just compress" and "we keep it for life" both govern RETENTION — what happens
 * as time passes to photographs nobody asked us to remove. They are the promise
 * that a couple's memories do not quietly expire. They were never a ruling about
 * a couple deliberately deleting their own event, which is the one case that
 * rule did not cover. `papic-fullres-drop.ts` is untouched.
 *
 * ─── WHY THE DATABASE CANNOT DO THIS ───────────────────────────────────────
 * The `sever_event_connections()` trigger handles every in-database connection,
 * and it covers paths no server action can reach. But Postgres cannot call an
 * HTTP API, so the files themselves must be swept from the application — which
 * means this half is PATH-INCOMPLETE BY CONSTRUCTION: a delete issued straight
 * through PostgREST (prod still grants `authenticated` DELETE on events) skips
 * it entirely and orphans the objects. Named debt, not an oversight.
 *
 * ─── COLLECT BEFORE, DELETE AFTER ──────────────────────────────────────────
 * 🪤 The keys live in the rows, and the rows cascade. `lib/erasure/purge.ts`
 * already states the rule: "Collect attachment refs BEFORE the delete —
 * afterwards there is no row to tell us which objects were theirs." So the
 * caller collects first, deletes the event, then sweeps.
 *
 * ─── BY KEY, NEVER BY PREFIX ───────────────────────────────────────────────
 * Every object is named from a key stored on a row, never from a listing under
 * an event-shaped prefix. An eventId-keyed prefix sweep would also reach dispute
 * evidence, paperwork and payment proofs, which live under the same event id in
 * other buckets and are NOT the couple's to destroy on this action.
 *
 * ⛔ CHAT ATTACHMENTS ARE DELIBERATELY NOT SWEPT — owner ruled KEEP on
 * 2026-08-20: a supplier who was genuinely booked keeps their side of the
 * paperwork. Do not add `thread-files` here without a new ruling.
 */

/** Parse a stored `r2://<bucket>/<key>` ref. Mirrors lib/face-blur.ts. */
function parseR2Ref(ref: string): { bucket: string | null; key: string } {
  const match = /^r2:\/\/([^/]+)\/(.+)$/.exec(ref);
  if (!match) return { bucket: null, key: ref };
  return { bucket: match[1] ?? null, key: match[2] ?? ref };
}

export type MediaRef = { bucket: R2BucketName; key: string };

/**
 * Every R2 key a papic capture can carry. SEVEN per row, not one — the original
 * plus six derivatives. Deleting only `r2_object_key` would leave the display,
 * thumbnail, poster, tile, wall-safe and web-clip copies fetchable at plain
 * URLs, which is the same defect one layer down: the photograph is still there,
 * just at a different address.
 */
const PAPIC_KEY_COLUMNS = [
  'r2_object_key',
  'display_r2_key',
  'thumb_r2_key',
  'poster_r2_key',
  'tile_r2_key',
  'wall_safe_r2_key',
  'clip_web_r2_key',
] as const;

/** The event's own website media — hero, film, music, gallery. */
const EVENT_KEY_COLUMNS = [
  'landing_page_hero_image_url',
  'landing_page_hero_video_r2_key',
  'site_bg_music_r2_key',
  'pakanta_song_r2_key',
] as const;

/** JSONB columns holding arrays of refs (or of objects carrying one). */
const EVENT_JSON_COLUMNS = ['our_photos', 'photo_wall_photos'] as const;

function pushRef(out: MediaRef[], raw: unknown): void {
  if (typeof raw !== 'string' || raw.trim().length === 0) return;
  const { bucket, key } = parseR2Ref(raw.trim());
  // A bare key with no r2:// prefix cannot be placed in a bucket with any
  // confidence, and guessing is how a sweep deletes somebody else's object.
  if (!bucket) return;
  /*
    🔒 PINNED TO THE MEDIA BUCKET, AND THIS IS A SAFETY BOUNDARY, NOT A FILTER.
    The other four buckets hold things this action has no ruling to destroy:
    `thread-files` holds the chat attachments the owner ruled KEEP,
    `vendor-contracts` holds signed supplier contracts AND the couple's
    paperwork scans, `vendor-verification` holds suppliers' government IDs.
    A stored ref is just a string; if one ever pointed outside `media`, this
    sweep must decline rather than obey it.
  */
  if (bucket !== R2_BUCKETS.media) return;
  out.push({ bucket, key });
}

function pushFromJson(out: MediaRef[], value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const entry of value) {
    if (typeof entry === 'string') pushRef(out, entry);
    else if (entry && typeof entry === 'object') {
      const o = entry as Record<string, unknown>;
      pushRef(out, o.r2_key ?? o.key ?? o.url ?? o.src);
    }
  }
}

/**
 * Collect every file this celebration owns. MUST be called BEFORE the delete.
 *
 * Returns `null` when a read FAILED — distinct from an empty array, which means
 * "we looked and there is nothing". A caller must not report "no files to
 * remove" from a refused read; it swept nothing and should say so.
 */
export async function collectEventMediaRefs(
  eventId: string,
): Promise<MediaRef[] | null> {
  const admin = createAdminClient();
  const refs: MediaRef[] = [];

  const { data: photos, error: photoErr } = await admin
    .from('papic_photos')
    .select(PAPIC_KEY_COLUMNS.join(','))
    .eq('event_id', eventId);
  if (photoErr) return null;
  for (const row of (photos ?? []) as unknown as Record<string, unknown>[]) {
    for (const col of PAPIC_KEY_COLUMNS) pushRef(refs, row[col]);
  }

  const { data: ev, error: evErr } = await admin
    .from('events')
    .select([...EVENT_KEY_COLUMNS, ...EVENT_JSON_COLUMNS].join(','))
    .eq('event_id', eventId)
    .maybeSingle();
  if (evErr) return null;
  if (ev) {
    const row = ev as unknown as Record<string, unknown>;
    for (const col of EVENT_KEY_COLUMNS) pushRef(refs, row[col]);
    for (const col of EVENT_JSON_COLUMNS) pushFromJson(refs, row[col]);
  }

  // One key can appear twice (a hero photo also listed in our_photos), and
  // deleting an already-deleted object is a wasted round trip, not an error.
  const seen = new Set<string>();
  return refs.filter((r) => {
    const id = `${r.bucket}/${r.key}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export type SweepResult = { deleted: number; failed: number };

/**
 * Delete the collected objects. BEST-EFFORT BY CONTRACT, and deliberately so:
 * `r2Delete`'s own docblock says a failed delete leaves an orphan, never lost
 * data, and must not break the calling flow. The event row is already gone by
 * the time this runs — throwing here would report a failed deletion for one
 * that actually succeeded, which is worse than a leftover file.
 */
export async function sweepEventMedia(refs: MediaRef[]): Promise<SweepResult> {
  let deleted = 0;
  let failed = 0;
  for (const ref of refs) {
    try {
      await r2Delete({ bucket: ref.bucket, key: ref.key });
      deleted += 1;
    } catch (err) {
      failed += 1;
      console.error('[event-media-sweep] could not delete', ref.key, err);
    }
  }
  return { deleted, failed };
}
