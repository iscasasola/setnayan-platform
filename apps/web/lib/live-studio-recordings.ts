import type { SupabaseClient } from '@supabase/supabase-js';
import { isYouTubeVideoId } from '@/lib/panood-watch';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import {
  getHeldChannelAccessToken,
  mirrorRoamManifest,
} from '@/lib/live-studio-roam-provision';
import type { YoutubeVideoArchive } from '@/lib/panood-youtube-types';

/**
 * apps/web/lib/live-studio-recordings.ts
 *
 * ⭐ THE RECORDING HANDOFF — the last unbuilt item of the Wave 9 channel-pool
 * model. Two halves, and the first one is a live defect rather than a feature:
 *
 *   1. TEARDOWN. `endPanoodBroadcast` completes the event's single directed
 *      broadcast (`panood_broadcasts`) but has never touched
 *      `live_studio_roam_streams` — **nothing in the codebase has ever written a
 *      status update to that table**, only the provisioning INSERT. Two
 *      consequences, both live once the flag flips:
 *        · `releasePoolChannelIfIdle` refuses forever, because it refuses while
 *          any stream is not complete/errored. A channel could never be freed by
 *          any path that consults it.
 *        · `events.live_studio_roam_manifest` is never rewritten, so the guest
 *          picker keeps advertising every camera channel after the wedding ends
 *          — and since End DOES clear `panood_watch_url`, the stale picker
 *          becomes the *only* "watch live" block on a finished event.
 *      `completeRoamBroadcasts` closes both: complete the rows, complete them on
 *      YouTube, then re-mirror (which now yields an empty manifest → the picker
 *      disappears on its own, through the § 4d publish gate, with no second rule).
 *
 *   2. DELIVERY, exactly as specified. `09_Panood_Feature_Specification.md` § 6
 *      ("Recording Archive — YouTube auto-archive only in V1"): every broadcast
 *      is auto-archived by YouTube on the Setnayan channel as an unlisted video,
 *      indefinite retention, free, and *"couples download from their Setnayan
 *      dashboard via a link that resolves the YouTube watch URL through the Data
 *      API."* That is `fetchEventRecordings` + `fetchYoutubeVideoArchives`.
 *      § 6 also RULED OUT the parallel R2 archive for V1 — "to avoid paying for
 *      storage of content that's already free on YouTube" — so this module
 *      deliberately moves no bytes and writes nothing to R2.
 *
 * 🚨 WHAT THIS MODULE DELIBERATELY DOES **NOT** DO — TWO DOCS DISAGREE, AND THE
 * DIFFERENCE IS DESTRUCTIVE. `Live_Studio_Cast_and_Roam_2026-07-23.md` § 4 and
 * `Live_Studio_Unified_Spec_2026-07-25.md` § 4h both end the handoff with "the
 * channel is then **wiped** + returned to the pool", while § 6 above says the
 * archive stays on the Setnayan channel at **indefinite retention** — which is
 * also what makes a resolved watch link a durable deliverable rather than a link
 * that rots. Wiping is irreversible and would delete a wedding, so it is NOT
 * built here and no release behaviour is changed: release stays the explicit
 * admin act Wave 9 made it. Owner settles which doc wins.
 *
 * TESTABILITY / `server-only`: this module takes its `SupabaseClient` as a
 * parameter and imports `@/lib/panood-youtube` **dynamically**, for the reason
 * `live-studio-roam-provision.ts` documents at its own top — that module carries
 * `import 'server-only'`, and a static edge would make everything here
 * unrunnable under `tsx --test`. The archive TYPE comes from
 * `panood-youtube-types.ts` (type-only, no `server-only`) so the pure builder
 * can be typed without dragging the runtime module in.
 */

/** Postgres "undefined table" / "undefined column" — migration not yet applied. */
const UNDEFINED_TABLE = '42P01';

/** What a recording is OF. The program feed is the ceremony; cameras are the angles. */
export type RecordingKind = 'program' | 'camera';

/** The rows this module reads out of `live_studio_roam_streams`. */
export type RecordingStreamRow = {
  zone_id: number | null;
  broadcast_id: string;
  status: string;
  ended_at: string | null;
};

/** The zone fields a recording needs for its human label. */
export type RecordingZoneRow = {
  id: number;
  zone_index: number;
  label: string;
  venue_label: string | null;
};

export type RoamRecording = {
  kind: RecordingKind;
  /** Null for the program feed and for a camera whose zone row was deleted. */
  zoneIndex: number | null;
  label: string;
  venueLabel: string | null;
  videoId: string;
  watchUrl: string;
  endedAt: string | null;
  /**
   * TRI-STATE, and the null matters. `true` = YouTube confirmed an archive;
   * `false` = YouTube was asked and has none (never carried video, or the
   * stream ran past the 12-hour archive ceiling — unified spec § 4f ③);
   * `null` = we could not ask (no token, flag off, API error). A null must
   * render as "we cannot confirm", never as either answer.
   */
  archived: boolean | null;
  durationSeconds: number | null;
};

/** The label a camera recording falls back to when its zone row is gone. */
export const ORPHANED_CAMERA_LABEL = 'Camera channel';
/** The label the directed program feed carries in the couple's list. */
export const PROGRAM_RECORDING_LABEL = 'Main broadcast';

function watchUrlFor(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * PURE. Join completed broadcast rows to their zone labels and to whatever
 * YouTube said about their archives.
 *
 * `archives` is `null` when YouTube could not be asked at all — every row then
 * carries `archived: null` rather than `false`, because "we don't know" and "there
 * is no recording" are different sentences to show a couple who just got married.
 *
 * Rows without a real 11-character video id are dropped: the same WRITE-side
 * injection barrier `buildRoamManifest` applies, for the same reason (a
 * malformed id must never reach an href).
 */
export function buildRecordingList(
  input: {
    program: readonly RecordingStreamRow[];
    cameras: readonly RecordingStreamRow[];
    zones: readonly RecordingZoneRow[];
  },
  archives: readonly YoutubeVideoArchive[] | null,
): RoamRecording[] {
  const zoneById = new Map<number, RecordingZoneRow>();
  for (const z of input.zones) zoneById.set(z.id, z);

  const archiveById = new Map<string, YoutubeVideoArchive>();
  for (const a of archives ?? []) archiveById.set(a.videoId, a);
  const asked = archives !== null;

  const rowToRecording = (row: RecordingStreamRow, kind: RecordingKind): RoamRecording | null => {
    if (!isYouTubeVideoId(row.broadcast_id)) return null;
    const zone = row.zone_id != null ? zoneById.get(row.zone_id) : undefined;
    const archive = archiveById.get(row.broadcast_id);
    return {
      kind,
      zoneIndex: kind === 'camera' ? (zone?.zone_index ?? null) : null,
      label:
        kind === 'program'
          ? PROGRAM_RECORDING_LABEL
          : (zone?.label ?? ORPHANED_CAMERA_LABEL),
      venueLabel: kind === 'camera' ? (zone?.venue_label ?? null) : null,
      videoId: row.broadcast_id,
      watchUrl: watchUrlFor(row.broadcast_id),
      endedAt: row.ended_at,
      // `asked && !archive` is the only path to a hard false: YouTube answered
      // and this id was not in the answer.
      archived: asked ? archive !== undefined : null,
      durationSeconds: archive?.durationSeconds ?? null,
    };
  };

  const out: RoamRecording[] = [];
  // The program feed leads — it is the ceremony, and the one a couple opens first.
  for (const row of input.program) {
    const rec = rowToRecording(row, 'program');
    if (rec) out.push(rec);
  }
  const cameras: RoamRecording[] = [];
  for (const row of input.cameras) {
    const rec = rowToRecording(row, 'camera');
    if (rec) cameras.push(rec);
  }
  cameras.sort((a, b) => (a.zoneIndex ?? Number.MAX_SAFE_INTEGER) - (b.zoneIndex ?? Number.MAX_SAFE_INTEGER));
  return [...out, ...cameras];
}

export type RoamTeardownResult = {
  /** Rows flipped to 'complete' by this call. */
  completed: number;
  /** Broadcasts YouTube confirmed complete (transitioned, or already complete). */
  transitioned: number;
  /** Manifest entries remaining after the re-mirror — 0 tears the picker down. */
  published: number;
};

/**
 * ⭐ END MEANS ENDED. Complete every still-open per-camera broadcast for an
 * event, then re-mirror the public manifest.
 *
 * ORDER IS DELIBERATE — YouTube first, then the DB, then the mirror:
 *   1. transition each broadcast to `complete` on YouTube (best-effort). A
 *      `redundantTransition` error means YouTube's own autoStop already
 *      completed it, which is success; a broadcast that never carried video
 *      refuses the transition, which is also fine — there was nothing to stop.
 *   2. flip the rows to `complete` + stamp `ended_at`. This is what frees the
 *      zone (the `one_active_per_zone` partial unique index excludes
 *      complete/errored) and what lets `releasePoolChannelIfIdle` ever succeed.
 *   3. re-mirror. With no live-able streams left, `buildRoamManifest` returns []
 *      and the guest picker disappears — through the existing publish gate, not
 *      around it.
 *
 * 🔒 THE LOCAL ROW IS THE SOURCE OF TRUTH, matching the precedent
 * `endPanoodBroadcast` set for CAST ("close it in the DB so the couple can
 * always stop even if YouTube errors"). So step 2 runs even when step 1 fails
 * wholesale — quota exhaustion, a revoked token, a network blip. The host pressed
 * End; the one thing they must never get is a wedding that cannot be stopped.
 * The failure that remains is benign in the right direction: a YouTube broadcast
 * may linger while our picker stops advertising it. The reverse — a dead camera
 * advertised to guests forever — is what exists today.
 *
 * ⚠ DELETES NOTHING. A completed broadcast is the couple's recording (§ 6:
 * unlisted, indefinite retention). `liveBroadcasts.delete` is deliberately absent
 * from this file and from `panood-youtube.ts`: nothing in the schema records
 * whether a given broadcast carried video (`went_live_at` has no writer), so no
 * code here can distinguish an empty container from a ceremony. Under that
 * uncertainty the only safe operation is to keep it.
 *
 * Pass a SERVICE-ROLE client — `live_studio_roam_streams` has RLS on with no policy.
 */
export async function completeRoamBroadcasts(
  admin: SupabaseClient,
  eventId: string,
  accessToken: string | null,
): Promise<RoamTeardownResult> {
  const nothing: RoamTeardownResult = { completed: 0, transitioned: 0, published: 0 };
  if (!eventId || !liveStudioRoamEnabled()) return nothing;

  let open: RecordingStreamRow[] = [];
  try {
    const { data, error } = await admin
      .from('live_studio_roam_streams')
      .select('zone_id, broadcast_id, status, ended_at')
      .eq('event_id', eventId)
      .not('status', 'in', '("complete","errored")');
    if (error?.code === UNDEFINED_TABLE) return nothing;
    if (error) return nothing;
    open = (data ?? []) as RecordingStreamRow[];
  } catch {
    return nothing;
  }
  if (open.length === 0) {
    // Nothing open, but still re-mirror: this is also the idempotent second press
    // of End, and re-asking the publish gate costs one query and can only correct
    // a stale manifest.
    return { ...nothing, published: await mirrorRoamManifest(admin, eventId) };
  }

  // ── 1. YouTube, best-effort, one broadcast at a time ──────────────────────
  let transitioned = 0;
  if (accessToken) {
    try {
      const { transitionYoutubeBroadcast } = await import('@/lib/panood-youtube');
      for (const row of open) {
        if (!isYouTubeVideoId(row.broadcast_id)) continue;
        try {
          await transitionYoutubeBroadcast(accessToken, row.broadcast_id, 'complete');
          transitioned += 1;
        } catch (e) {
          // `redundantTransition` = YouTube's autoStop got there first, which is
          // exactly the state we wanted. Anything else (never went live, quota,
          // network) leaves the count alone and does not stop the loop: one
          // stubborn camera must not keep the other three open.
          if (/redundantTransition/.test(e instanceof Error ? e.message : '')) transitioned += 1;
        }
      }
    } catch {
      // The dynamic import itself failed — fall through to the DB write.
    }
  }

  // ── 2. The DB is the truth. Runs regardless of step 1. ────────────────────
  const now = new Date().toISOString();
  let completed = 0;
  try {
    const { data, error } = await admin
      .from('live_studio_roam_streams')
      .update({ status: 'complete', ended_at: now, updated_at: now })
      .eq('event_id', eventId)
      .not('status', 'in', '("complete","errored")')
      .select('zone_id');
    if (!error) completed = (data ?? []).length;
  } catch {
    // Leave completed at 0; the mirror below still runs and reports reality.
  }

  // ── 3. Re-mirror → the picker tears itself down. ──────────────────────────
  const published = await mirrorRoamManifest(admin, eventId);
  return { completed, transitioned, published };
}

/**
 * The couple's recordings for an event — the § 6 deliverable.
 *
 * Reads the COMPLETED broadcasts (program feed + camera channels), then resolves
 * their archives through the Data API so the list can say whether a replay
 * actually exists rather than just linking hopefully.
 *
 * FAIL-SOFT BY CONSTRUCTION. Every step that can fail degrades to less
 * information, never to an error and never to a wrong claim: no token / flag off
 * / YouTube error → `archives = null` → every row reports `archived: null`, and
 * the links still work. A missing table returns an empty list.
 *
 * TOKEN PRECEDENCE mirrors `endPanoodBroadcast`: the pool channel's own grant
 * first (Wave 9 — the broadcast lives on a Setnayan channel, so only that
 * channel's token can read it), then the couple's BYO grant. Neither is required.
 *
 * Pass a SERVICE-ROLE client (`live_studio_roam_streams` + `panood_broadcasts`
 * are service-role only — they carry stream keys).
 */
export async function fetchEventRecordings(
  admin: SupabaseClient,
  eventId: string,
): Promise<RoamRecording[]> {
  if (!eventId) return [];

  // `rowsOf` collapses both failure modes to "no rows": a PostgREST error (a
  // missing table on a pre-migration DB resolves with { data: null, error }) and a
  // thrown rejection. Nothing here inspects the error — an unreadable table and an
  // empty one produce the same, correct outcome: no recordings claimed.
  const rowsOf = <T,>(q: PromiseLike<{ data: unknown }>): Promise<T[]> =>
    Promise.resolve(q).then(
      (r) => ((r.data ?? []) as T[]),
      () => [] as T[],
    );

  const [programRows, cameras, zones] = await Promise.all([
    rowsOf<{ broadcast_id: string; status: string; ended_at: string | null }>(
      admin
        .from('panood_broadcasts')
        .select('broadcast_id, status, ended_at')
        .eq('event_id', eventId)
        .eq('status', 'complete')
        .order('ended_at', { ascending: false }),
    ),
    rowsOf<RecordingStreamRow>(
      admin
        .from('live_studio_roam_streams')
        .select('zone_id, broadcast_id, status, ended_at')
        .eq('event_id', eventId)
        .eq('status', 'complete'),
    ),
    rowsOf<RecordingZoneRow>(
      admin
        .from('live_studio_roam_zones')
        .select('id, zone_index, label, venue_label')
        .eq('event_id', eventId),
    ),
  ]);

  const program = programRows.map((r) => ({ ...r, zone_id: null }));

  if (program.length === 0 && cameras.length === 0) return [];

  const videoIds = [...program, ...cameras]
    .map((r) => r.broadcast_id)
    .filter((id) => isYouTubeVideoId(id));

  const archives = await resolveArchives(admin, eventId, videoIds);
  return buildRecordingList({ program, cameras, zones }, archives);
}

/**
 * Ask YouTube about a set of video ids, or return null if we cannot ask.
 *
 * Null is a first-class answer here — see `RoamRecording.archived`. One batched
 * videos.list call (1 quota unit for up to 50 ids) covers a whole event.
 */
async function resolveArchives(
  admin: SupabaseClient,
  eventId: string,
  videoIds: readonly string[],
): Promise<YoutubeVideoArchive[] | null> {
  if (videoIds.length === 0) return null;
  try {
    // Only `panood-youtube` needs the dynamic import (it carries `server-only`);
    // `getHeldChannelAccessToken` comes from the statically-imported provisioning
    // module, which has no such guard.
    const { fetchYoutubeVideoArchives } = await import('@/lib/panood-youtube');
    // Pool first (the broadcast is on a Setnayan channel), BYO second. Both are
    // read-only lookups — getHeldChannelAccessToken never claims a channel.
    let token = await getHeldChannelAccessToken(admin, eventId);
    if (!token) {
      const { getEventYoutubeAccessToken } = await import('@/lib/panood-broadcast');
      token = await getEventYoutubeAccessToken(eventId);
    }
    if (!token) return null;
    return await fetchYoutubeVideoArchives(token, videoIds);
  } catch {
    return null;
  }
}
