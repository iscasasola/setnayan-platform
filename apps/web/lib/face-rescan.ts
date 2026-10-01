import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { FACE_RESCAN_GAP_MS } from '@/lib/periodic-job-registry';
import { faceRescanWindowOpen } from '@/lib/face-selfie-lifetime';
import { resolveFaceTagging } from '@/lib/face-tagging-gate';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import { autoTagCapture } from '@/lib/face-match';
import { embedPhotoFacesOnServer, serverFaceApi } from '@/lib/face-embed-server';
import { R2_BUCKETS, r2GetBytes, type R2BucketName } from '@/lib/r2';

/**
 * face-rescan.ts — THE ONE END-OF-EVENT RESCAN. A LATE SELFIE LOOKS BACK.
 *
 * ⚖ Owner 2026-09-30 — DECISION_LOG "A LATE SELFIE LOOKS BACK OVER THE EVENT'S
 * EARLIER PHOTOS", "FACE DATA: THREE OWNER ANSWERS" (3) *"we do a rescan once
 * the event ends to all guests"*, and his answer to PR #6195: *"2. a"* (the
 * server runs `@vladmandic/face-api`).
 *
 * The phones already match each photo as it is taken (lib/face-match.ts), but
 * only against the selfies registered AT THAT MOMENT. So once the event has
 * ENDED, and before Papic CLOSES twelve hours later (when every selfie is
 * erased — lib/face-selfie-erase.ts), this walks every photo of the event once,
 * computes each face's descriptor on the server (lib/face-embed-server.ts) and
 * hands them to the SAME matcher the phones use. A guest who registered late is
 * found in the photos taken before they did.
 *
 * 🔒 NOTHING ABOUT AN UNREGISTERED FACE IS STORED. The descriptors of every face
 * in a photo exist in memory for one call and are dropped. The matcher compares
 * them only with REGISTERED selfies — mode_a, the guest's own "Yes, tag me",
 * not erased — and writes one thing: a `photo_tags` row for a registered guest
 * it matched. The only other write is the progress row
 * (`papic_face_rescan_progress`: two cursors, two counters, two times). No
 * vector, box or face count is written or logged, anywhere.
 * `face-tagging-rules.test.ts` holds that as source AND as behaviour.
 *
 * ⏱ BOUNDED, RESUMABLE. This repo has no scheduler, so the pass rides request
 * traffic: a registered job (`face-rescan-after-event`) claimed at most once per
 * {@link FACE_RESCAN_GAP_MS} across the fleet, each run stopping at a photo cap
 * AND a time budget and saving its cursors, the next run picking up where it
 * stopped. Tags are idempotent (unique per photo × guest), so a run killed
 * mid-slice only repeats a few photos.
 *
 * 🔁 A selfie registered AFTER the pass finished (Papic still open) restarts it
 * once more for that event — "late registrants are covered by this rescan".
 */

/** How long one run may spend on photos (well inside an `after()` budget). */
export const FACE_RESCAN_TIME_BUDGET_MS = 40_000;
/** At most this many photos per run, whatever the clock says. */
export const FACE_RESCAN_MAX_PHOTOS = 120;
/** Photos fetched per read. */
const PAGE = 20;

type Admin = ReturnType<typeof createAdminClient>;
type Source = 'papic_photos' | 'papic_guest_captures';

type Progress = {
  event_id: string;
  last_photo_id: number;
  last_capture_id: number;
  photos_scanned: number;
  tags_written: number;
  started_at: string;
  finished_at: string | null;
};

/** The object to look at: a clip's poster frame, else the display copy, else the original. */
function objectRef(row: Record<string, unknown>, source: Source): string | null {
  const isClip = source === 'papic_photos' ? row.photo_type === 'clip' : row.media_type === 'video';
  const pick = isClip
    ? row.poster_r2_key
    : (row.display_r2_key ?? row.r2_object_key);
  return typeof pick === 'string' && pick.trim() ? pick.trim() : null;
}

function parseRef(ref: string): { bucket: R2BucketName; key: string } {
  const m = /^r2:\/\/([^/]+)\/(.+)$/.exec(ref);
  const known = new Set<string>(Object.values(R2_BUCKETS));
  if (m && m[1] && m[2] && known.has(m[1])) return { bucket: m[1] as R2BucketName, key: m[2] };
  return { bucket: R2_BUCKETS.media, key: m?.[2] ?? ref };
}

/** Events whose rescan window is open and which hold at least one registered selfie. */
async function dueEvents(admin: Admin, nowMs: number): Promise<string[]> {
  const { data, error } = await admin
    .from('guest_face_enrollments')
    .select('event_id, events!inner(event_date, event_end_date, papic_window_end)')
    .is('revoked_at', null)
    .not('face_vector', 'is', null)
    .limit(2000);
  if (error) throw new Error(`face-rescan: candidate read failed: ${error.message}`);
  const due = new Set<string>();
  for (const r of (data ?? []) as unknown as Array<{
    event_id: string | null;
    events: { event_date: string | null; event_end_date: string | null; papic_window_end: string | null } | null;
  }>) {
    if (!r.event_id || !r.events || due.has(r.event_id)) continue;
    if (faceRescanWindowOpen({ eventDate: r.events.event_date, eventEndDate: r.events.event_end_date, windowEnd: r.events.papic_window_end }, nowMs)) {
      due.add(r.event_id);
    }
  }
  return [...due];
}

/** A row as read back, with the database's defaults made explicit. */
function asProgress(row: Record<string, unknown>, eventId: string): Progress {
  return {
    event_id: eventId,
    last_photo_id: Number(row.last_photo_id ?? 0) || 0,
    last_capture_id: Number(row.last_capture_id ?? 0) || 0,
    photos_scanned: Number(row.photos_scanned ?? 0) || 0,
    tags_written: Number(row.tags_written ?? 0) || 0,
    started_at: typeof row.started_at === 'string' ? row.started_at : new Date().toISOString(),
    finished_at: typeof row.finished_at === 'string' ? row.finished_at : null,
  };
}

/** The event's progress row, created at the start; restarted once when a later selfie arrived after a finished pass. */
async function progressFor(admin: Admin, eventId: string): Promise<Progress | null> {
  const { data, error } = await admin.from('papic_face_rescan_progress').select('*').eq('event_id', eventId).maybeSingle();
  if (error) {
    console.error('[supabase-error] lib/face-rescan.ts · from:papic_face_rescan_progress.select', error);
    return null;
  }
  if (!data) {
    const { data: made, error: insErr } = await admin
      .from('papic_face_rescan_progress')
      .insert({ event_id: eventId })
      .select('*')
      .maybeSingle();
    if (insErr) console.error('[supabase-error] lib/face-rescan.ts · from:papic_face_rescan_progress.insert', insErr);
    return made ? asProgress(made as Record<string, unknown>, eventId) : null;
  }
  const p = asProgress(data as Record<string, unknown>, eventId);
  if (!p.finished_at) return p;
  // Finished — unless a selfie was registered after this pass began.
  const { count, error: lateErr } = await admin
    .from('guest_face_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .is('revoked_at', null)
    .not('face_vector', 'is', null)
    .gt('created_at', p.started_at);
  if (lateErr) console.error('[supabase-error] lib/face-rescan.ts · from:guest_face_enrollments.count(late)', lateErr);
  if (lateErr || !count) return null;
  const restart = {
    last_photo_id: 0,
    last_capture_id: 0,
    started_at: new Date().toISOString(),
    finished_at: null,
    updated_at: new Date().toISOString(),
  };
  const { error: upErr } = await admin.from('papic_face_rescan_progress').update(restart).eq('event_id', eventId);
  if (upErr) {
    console.error('[supabase-error] lib/face-rescan.ts · from:papic_face_rescan_progress.update(restart)', upErr);
    return null;
  }
  return { ...p, ...restart };
}

async function saveProgress(admin: Admin, p: Progress): Promise<void> {
  const { error } = await admin
    .from('papic_face_rescan_progress')
    .update({
      last_photo_id: p.last_photo_id,
      last_capture_id: p.last_capture_id,
      photos_scanned: p.photos_scanned,
      tags_written: p.tags_written,
      finished_at: p.finished_at,
      updated_at: new Date().toISOString(),
    })
    .eq('event_id', p.event_id);
  if (error) console.error('[supabase-error] lib/face-rescan.ts · from:papic_face_rescan_progress.update', error);
}

const SOURCE_COLS: Record<Source, string> = {
  papic_photos: 'id, photo_id, photo_type, poster_r2_key, display_r2_key, r2_object_key',
  papic_guest_captures: 'id, capture_id, media_type, poster_r2_key, display_r2_key, r2_object_key',
};

/**
 * One slice of the rescan. Returns the number of photos looked at this run.
 * `deps` exists for the test: the embedder and the byte reader are injected so
 * the behaviour can be proved without a model or R2.
 */
export async function runFaceRescan(
  opts: {
    nowMs?: number;
    budgetMs?: number;
    maxPhotos?: number;
    admin?: Admin;
    deps?: {
      embed?: (bytes: Uint8Array) => Promise<number[][]>;
      readBytes?: (ref: string) => Promise<Uint8Array>;
      match?: typeof autoTagCapture;
      gate?: typeof resolveFaceTagging;
      ready?: () => Promise<boolean>;
      privacyOn?: () => Promise<boolean>;
    };
  } = {},
): Promise<number> {
  const started = Date.now();
  const nowMs = opts.nowMs ?? started;
  const budgetMs = opts.budgetMs ?? FACE_RESCAN_TIME_BUDGET_MS;
  const maxPhotos = opts.maxPhotos ?? FACE_RESCAN_MAX_PHOTOS;
  const admin = opts.admin ?? createAdminClient();
  const embed = opts.deps?.embed ?? embedPhotoFacesOnServer;
  const readBytes = opts.deps?.readBytes ?? (async (ref: string) => (await r2GetBytes(parseRef(ref))).bytes);
  const match = opts.deps?.match ?? autoTagCapture;
  const gate = opts.deps?.gate ?? resolveFaceTagging;
  const ready = opts.deps?.ready ?? (async () => (await serverFaceApi()) !== null);
  const privacyOn = opts.deps?.privacyOn ?? (() => isDataPrivacyControlActive('face_enrollment'));

  // The DPO's control over face matching — the matcher checks it too.
  if (!(await privacyOn())) return 0;
  const events = await dueEvents(admin, nowMs);
  if (events.length === 0) return 0;
  // Dormant without the hosted model — the same switch the phones use.
  if (!(await ready())) return 0;

  let looked = 0;
  const outOfTime = () => Date.now() - started >= budgetMs || looked >= maxPhotos;

  for (const eventId of events) {
    if (outOfTime()) break;
    // Face tagging must RUN here now (automatic with Papic; the couple's "off" wins).
    if ((await gate(admin as never, eventId)).mode !== 'mode_a') continue;
    const p = await progressFor(admin, eventId);
    if (!p || p.finished_at) continue;

    let drained = true;
    for (const source of ['papic_photos', 'papic_guest_captures'] as const) {
      const cursorKey = source === 'papic_photos' ? 'last_photo_id' : 'last_capture_id';
      const idKey = source === 'papic_photos' ? 'photo_id' : 'capture_id';
      for (;;) {
        if (outOfTime()) {
          drained = false;
          break;
        }
        let q = admin
          .from(source)
          .select(SOURCE_COLS[source])
          .eq('event_id', eventId)
          .is('hidden_at', null)
          .gt('id', p[cursorKey])
          .order('id', { ascending: true })
          .limit(PAGE);
        if (source === 'papic_photos') q = q.is('superseded_at', null);
        const { data, error } = await q;
        if (error) {
          console.error(`[supabase-error] lib/face-rescan.ts · from:${source}.select`, error);
          drained = false;
          break;
        }
        const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
        if (rows.length === 0) break;
        for (const row of rows) {
          if (outOfTime()) {
            drained = false;
            break;
          }
          const ref = objectRef(row, source);
          const photoId = row[idKey];
          if (ref && typeof photoId === 'string') {
            try {
              const vectors = await embed(await readBytes(ref));
              if (vectors.length > 0) {
                const { autoTagged } = await match({ eventId, sourceTable: source, photoId, faceVectors: vectors });
                p.tags_written += autoTagged;
              }
            } catch (err) {
              // One unreadable photo never stops the pass. No detail about its content.
              console.warn('[face-rescan] photo skipped', { eventId, error: err instanceof Error ? err.message : String(err) });
            }
          }
          p[cursorKey] = Number(row.id) || p[cursorKey];
          p.photos_scanned += 1;
          looked += 1;
        }
        await saveProgress(admin, p);
        if (!drained || rows.length < PAGE) break;
      }
      if (!drained) break;
    }
    if (drained) {
      p.finished_at = new Date().toISOString();
      await saveProgress(admin, p);
      console.info(`[face-rescan] event finished: ${p.photos_scanned} photo(s) scanned, ${p.tags_written} tag(s) written.`);
    } else {
      await saveProgress(admin, p);
    }
  }
  return looked;
}

/** CRON-FREE, like every periodic job here: a DB claim on request traffic. */
export async function maybeRunFaceRescan(): Promise<void> {
  await runClaimedJob('face-rescan-after-event', FACE_RESCAN_GAP_MS, () => runFaceRescan());
}
