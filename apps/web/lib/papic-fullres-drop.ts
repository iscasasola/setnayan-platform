import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { r2Delete, r2Head } from '@/lib/r2';
import { eventSkuActive } from '@/lib/entitlements';
import {
  CLIP_WEB_DROP_GRACE_DAYS,
  DEFAULT_FULL_RES_RETENTION_DAYS,
  clipEligibleForDrop,
  clipWebCopyCustodyOk,
  confirmedDriveKeys,
  guestClipItem,
  guestPhotoItem,
  isDriveDeferred,
  isEligibleForDrop,
  resolveOriginalRef,
  sameResolvedObject,
  seatClipItem,
  seatPhotoItem,
  type ClipDropCandidate,
  type DriveArtifactRow,
  type DriveCopyState,
  type PapicDropItem,
} from '@/lib/papic-fullres-drop-core';
import { claimPeriodicJob, WEEKLY_GAP_MS } from '@/lib/periodic-jobs';

// ============================================================================
// 3-month full-res drop (owner 2026-07-11 · Pricing.md § 2.1 retention model).
//
// After the free full-res window (default 90d), delete OUR R2 copy of the
// full-res ORIGINAL and stamp full_res_dropped_at. NEVER touches the couple's
// Google Drive copy (core invariant); the forever web copy (display/thumb AVIF)
// is kept, so the gallery — which serves the web copy — is unaffected.
//
// ⚠ DESTRUCTIVE. Ships DRY-RUN by default: it deletes NOTHING unless
// PAPIC_FULLRES_DROP_ENABLED='true'. Guards (belt + suspenders):
//   • PHOTOS: display_r2_key MUST exist — never drop a photo with no web copy.
//   • CLIPS (Papic storage PR-2 · GATED OFF by default — only swept when
//     PAPIC_CLIP_DROP_ENABLED='true'): a clip's r2_object_key is the raw video
//     and its display_r2_key is only a POSTER STILL, so a clip is droppable ONLY
//     once a DISTINCT, HEAD-verified, byte-matched, grace-aged web copy
//     (clip_web_r2_key) exists. The drop deletes ONLY the raw — the poster
//     (display_r2_key) and the web copy (clip_web_r2_key) are kept forever.
//   • never a `sample/...` seed key.
//   • Keep-Full-Res (HIGH_RES_ARCHIVE) events keep their originals on us.
//   • DRIVE-AWARE DEFER (Papic_Build_Brief_2026-07-17.md ruling #4): if the
//     couple pointed a Google Drive at this event, a photo OR clip is only
//     droppable once its high-res Drive copy is CONFIRMED. Queued / retrying /
//     failed / missing → defer. Drive state unreadable → defer. (A read failure
//     must never authorize a deletion.)
//   • only after captured_at < now - retentionDays.
//   • the R2 delete resolves a known bucket or declines.
// ============================================================================

const KEEP_FULL_RES_SKU = 'HIGH_RES_ARCHIVE';

/**
 * Every oauth_grants.provider that means "this couple pointed a Google Drive at
 * this event": the canonical connect ('drive'), the 2nd-Drive overflow
 * ('drive_overflow'), and the legacy 0009 Photo-Delivery pilot
 * ('drive_photo_delivery'). `revoked_at` is deliberately NOT filtered — a couple
 * who connected and later disconnected may have left copies mid-flight, and the
 * safe reading of "they intended a Drive copy" is the widest one.
 */
const DRIVE_INTENT_PROVIDERS = ['drive', 'drive_overflow', 'drive_photo_delivery'];

/** Keep `.in()` lists bounded (the sweep can carry up to 1000 candidate keys). */
const DRIVE_KEY_CHUNK = 200;

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Read one event's Drive-copy state for a known set of candidate r2 keys.
 *
 * ⚠ FAIL SAFE by construction: EVERY error path returns `{kind:'unknown'}`,
 * which makes isDriveDeferred() defer every photo for the event. A read failure
 * must never authorize a deletion — we would rather pay another week of R2
 * storage than delete the only full-res copy of someone's wedding.
 */
async function loadEventDriveCopyState(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  candidateKeys: readonly string[],
): Promise<DriveCopyState> {
  try {
    // 1. Did this couple ever point a Drive at this event?
    const grants = await admin
      .from('oauth_grants')
      .select('grant_id')
      .eq('event_id', eventId)
      .in('provider', DRIVE_INTENT_PROVIDERS)
      .limit(1);
    if (grants.error) {
      return { kind: 'unknown', reason: `oauth_grants:${grants.error.message.slice(0, 120)}` };
    }
    let driveIntended = (grants.data ?? []).length > 0;

    if (!driveIntended) {
      // Legacy 0009 pilot events carry the Drive on the event row itself.
      const ev = await admin
        .from('events')
        .select('photo_delivery_folder_id, photo_delivery_status')
        .eq('event_id', eventId)
        .maybeSingle();
      if (ev.error) {
        return { kind: 'unknown', reason: `events:${ev.error.message.slice(0, 120)}` };
      }
      if (!ev.data) {
        // The photo's event row is unreadable → we cannot prove Drive is absent.
        return { kind: 'unknown', reason: 'events:row_missing' };
      }
      const status = (ev.data.photo_delivery_status as string | null) ?? 'idle';
      driveIntended = Boolean(ev.data.photo_delivery_folder_id) || status !== 'idle';
    }

    if (!driveIntended) return { kind: 'not_connected' };

    // 2. Which of these keys are CONFIRMED on the couple's Drive? Both copy
    //    tables count — the universal drive_copy_artifacts layer and the 0009
    //    photo_delivery_artifacts release path (which uploads the original
    //    r2_object_key bytes, i.e. the full-res original).
    const confirmed = new Set<string>();
    for (const keys of chunk(candidateKeys, DRIVE_KEY_CHUNK)) {
      if (keys.length === 0) continue;
      const [copyRows, deliveryRows] = await Promise.all([
        admin
          .from('drive_copy_artifacts')
          .select('r2_object_key, drive_file_id, copied_high_res')
          .eq('event_id', eventId)
          .in('r2_object_key', keys),
        admin
          .from('photo_delivery_artifacts')
          .select('r2_object_key, drive_file_id')
          .eq('event_id', eventId)
          .in('r2_object_key', keys),
      ]);
      if (copyRows.error) {
        return {
          kind: 'unknown',
          reason: `drive_copy_artifacts:${copyRows.error.message.slice(0, 120)}`,
        };
      }
      if (deliveryRows.error) {
        return {
          kind: 'unknown',
          reason: `photo_delivery_artifacts:${deliveryRows.error.message.slice(0, 120)}`,
        };
      }
      for (const k of confirmedDriveKeys((copyRows.data ?? []) as DriveArtifactRow[])) {
        confirmed.add(k);
      }
      for (const k of confirmedDriveKeys((deliveryRows.data ?? []) as DriveArtifactRow[])) {
        confirmed.add(k);
      }
    }

    return { kind: 'connected', confirmedKeys: confirmed };
  } catch (e) {
    return { kind: 'unknown', reason: `threw:${(e as Error)?.message?.slice(0, 120) ?? 'unknown'}` };
  }
}

function dropEnabled(): boolean {
  // Owner 2026-07-11 "enable the drop" — ON by default now that the model is
  // live (downloads fall back to the web copy, Keep Full-Res is the opt-out, and
  // the couple's Drive holds full-res). KILL-SWITCH: set PAPIC_FULLRES_DROP_ENABLED
  // ='false' on Vercel to instantly turn all deletion back OFF. (Note: prod has
  // only the excluded sample photos today, so nothing is drop-eligible yet — real
  // couple photos only age into the 90-day window over time.)
  return process.env.PAPIC_FULLRES_DROP_ENABLED !== 'false';
}

function clipDropEnabled(): boolean {
  // Papic storage PR-2 — extend the drop to CLIPS. OFF by default (opt-in): clips
  // are NOT even queried unless PAPIC_CLIP_DROP_ENABLED='true' is deliberately set
  // on Vercel. This is the go-live gate. Migrations auto-apply on merge, so the
  // gate can NOT be "hold the migration" — merging this PR is data-safe by
  // construction: with the flag unset, the sweep behaves EXACTLY as today (photos
  // only, not one clip touched). Deleting clip data begins only when an operator
  // flips this env var. The master kill-switch (PAPIC_FULLRES_DROP_ENABLED='false')
  // still turns ALL deletion off, clips included (it forces dry-run).
  return process.env.PAPIC_CLIP_DROP_ENABLED === 'true';
}

function retentionDays(): number {
  const n = Number(process.env.PAPIC_FULLRES_RETENTION_DAYS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_FULL_RES_RETENTION_DAYS;
}

export type FullResDropSummary = {
  dryRun: boolean;
  retentionDays: number;
  /** Whether clip candidates were swept this run (PAPIC_CLIP_DROP_ENABLED). */
  clipDropEnabled: boolean;
  scanned: number;
  eligible: number;
  dropped: number;
  /** Of `dropped`, how many were clips (the rest are photos). */
  clipsDropped: number;
  skippedKeepFullRes: number;
  /** Kept because the couple's high-res Drive copy isn't confirmed yet. */
  deferredDriveCopy: number;
  /** Events whose Drive state couldn't be read → all their photos deferred. */
  driveStateUnknownEvents: number;
  /**
   * Clips kept because the web-copy OBJECT custody check failed — missing /
   * size-mismatch / non-video / within the fresh-grace window. A destructive-
   * safety signal: these clips have a web-copy KEY but the object isn't a proven
   * durable playable derivative yet, so the raw is (correctly) never deleted.
   */
  clipWebUnverified: number;
  failed: number;
  bytesReclaimed: number;
};

// The candidate shape + its row→Item builders live in the pure core module so the
// sweep and its regression test materialise Items through the SAME code (a
// hand-built fixture masked the clip-wiring bug). `photo_type`/`media_type` are
// carried on clip Items so isClipRow() is genuinely true for a real sweep clip.
type Item = PapicDropItem;

export async function runFullResDropSweep(
  opts: { limit?: number; dryRun?: boolean; retentionDaysOverride?: number } = {},
): Promise<FullResDropSummary> {
  const days = opts.retentionDaysOverride ?? retentionDays();
  const limit = Math.min(Math.max(1, opts.limit ?? 500), 2000);
  const dryRun = opts.dryRun ?? !dropEnabled();
  const clipsEnabled = clipDropEnabled();
  const graceMs = CLIP_WEB_DROP_GRACE_DAYS * 86_400_000;
  const nowMs = Date.now();
  const cutoffIso = new Date(nowMs - days * 86_400_000).toISOString();
  const admin = createAdminClient();

  // PHOTOS. Guest media_type NULL = photo (include null + 'photo', drop 'clip').
  const [seat, guest] = await Promise.all([
    admin
      .from('papic_photos')
      .select('photo_id, event_id, r2_object_key, display_r2_key, orig_bytes, captured_at, full_res_dropped_at')
      .eq('photo_type', 'photo')
      .is('full_res_dropped_at', null)
      .not('display_r2_key', 'is', null)
      .lt('captured_at', cutoffIso)
      .order('captured_at', { ascending: true })
      .limit(limit),
    admin
      .from('papic_guest_captures')
      .select('capture_id, event_id, r2_object_key, display_r2_key, orig_bytes, captured_at, full_res_dropped_at')
      .or('media_type.is.null,media_type.eq.photo')
      .is('full_res_dropped_at', null)
      .not('display_r2_key', 'is', null)
      .lt('captured_at', cutoffIso)
      .order('captured_at', { ascending: true })
      .limit(limit),
  ]);

  // CLIPS (Papic storage PR-2) — queried ONLY when the go-live gate is on. Each
  // row must already have a web copy (clip_web_r2_key NOT NULL) to be a candidate;
  // clipEligibleForDrop + the HEAD custody check re-verify before any delete. When
  // clipsEnabled is false these reads never run and no clip can be dropped.
  const [seatClips, guestClips] = clipsEnabled
    ? await Promise.all([
        admin
          .from('papic_photos')
          .select(
            'photo_id, event_id, photo_type, r2_object_key, display_r2_key, poster_r2_key, clip_web_r2_key, clip_web_bytes, orig_bytes, captured_at, full_res_dropped_at',
          )
          .eq('photo_type', 'clip')
          .is('full_res_dropped_at', null)
          .not('clip_web_r2_key', 'is', null)
          .lt('captured_at', cutoffIso)
          .order('captured_at', { ascending: true })
          .limit(limit),
        admin
          .from('papic_guest_captures')
          .select(
            'capture_id, event_id, media_type, r2_object_key, display_r2_key, poster_r2_key, clip_web_r2_key, clip_web_bytes, orig_bytes, captured_at, full_res_dropped_at',
          )
          .eq('media_type', 'clip')
          .is('full_res_dropped_at', null)
          .not('clip_web_r2_key', 'is', null)
          .lt('captured_at', cutoffIso)
          .order('captured_at', { ascending: true })
          .limit(limit),
      ])
    : [{ data: [] as Record<string, unknown>[] }, { data: [] as Record<string, unknown>[] }];

  const items: Item[] = [
    ...((seat.data ?? []) as Record<string, unknown>[]).map(seatPhotoItem),
    ...((guest.data ?? []) as Record<string, unknown>[]).map(guestPhotoItem),
    ...((seatClips.data ?? []) as Record<string, unknown>[]).map(seatClipItem),
    ...((guestClips.data ?? []) as Record<string, unknown>[]).map(guestClipItem),
  ];

  let eligible = 0;
  let dropped = 0;
  let clipsDropped = 0;
  let skippedKeepFullRes = 0;
  let deferredDriveCopy = 0;
  let driveStateUnknownEvents = 0;
  let clipWebUnverified = 0;
  let failed = 0;
  let bytesReclaimed = 0;
  const keepCache = new Map<string, boolean>();
  const driveCache = new Map<string, DriveCopyState>();
  const deferredByEvent = new Map<string, number>();

  // COLUMN-LEVEL eligibility, dispatched by kind. Photos use the photo predicate;
  // clips use the clip predicate (poster-trap guarded, distinct + byte-floored web
  // copy). NEITHER touches R2 — the clip's OBJECT custody HEAD is a later gate.
  const columnEligible = (it: Item): boolean =>
    it.kind === 'clip'
      ? clipEligibleForDrop(it as ClipDropCandidate, { retentionDays: days, nowMs })
      : isEligibleForDrop(it, { retentionDays: days, nowMs });

  // Pre-pass: every age-eligible candidate key (photos AND clips), grouped by
  // event, so the Drive lookup for an event is ONE batched read. Clip keys MUST be
  // included so Guard B (isDriveDeferred) can defer a clip whose Drive copy isn't
  // confirmed — drive_copy_artifacts already holds clip rows.
  const candidateKeysByEvent = new Map<string, string[]>();
  for (const it of items) {
    if (!columnEligible(it)) continue;
    const bucket = candidateKeysByEvent.get(it.event_id);
    if (bucket) bucket.push(it.r2_object_key);
    else candidateKeysByEvent.set(it.event_id, [it.r2_object_key]);
  }

  for (const it of items) {
    if (!columnEligible(it)) continue;

    // Keep-Full-Res owners keep their originals on us.
    let keep = keepCache.get(it.event_id);
    if (keep === undefined) {
      keep = await eventSkuActive(admin, it.event_id, KEEP_FULL_RES_SKU).catch(() => false);
      keepCache.set(it.event_id, keep);
    }
    if (keep) {
      skippedKeepFullRes += 1;
      continue;
    }

    // DRIVE-AWARE DEFER. The retention model only works because the couple's
    // Drive holds the full-res — so never drop ours until that copy is
    // CONFIRMED. Unknown Drive state defers too: a read failure must never
    // authorize a deletion.
    let drive = driveCache.get(it.event_id);
    if (drive === undefined) {
      drive = await loadEventDriveCopyState(
        admin,
        it.event_id,
        candidateKeysByEvent.get(it.event_id) ?? [it.r2_object_key],
      );
      driveCache.set(it.event_id, drive);
      if (drive.kind === 'unknown') {
        driveStateUnknownEvents += 1;
        console.warn(
          `[papic-fullres-drop] Drive state unreadable for event ${it.event_id} ` +
            `(${drive.reason}) — DEFERRING every full-res drop for it. ` +
            'A read failure must never authorize a deletion.',
        );
      }
    }
    if (isDriveDeferred(it.r2_object_key, drive)) {
      deferredDriveCopy += 1;
      deferredByEvent.set(it.event_id, (deferredByEvent.get(it.event_id) ?? 0) + 1);
      continue;
    }

    const ref = resolveOriginalRef(it.r2_object_key);
    if (!ref) continue; // unresolvable bucket → never delete blindly

    // CLIP CUSTODY GATE (Papic storage PR-2). A clip's raw is the ONLY playable
    // copy until its web copy is proven durable — never trust the column alone (a
    // client-produced web copy can be truncated / missing). HEAD the WEB COPY and
    // require: exists, size EXACTLY == persisted clip_web_bytes, content-type
    // video/*, and written ≥ grace ago. Any miss → keep the raw, retry later.
    // Note we HEAD `clip_web_r2_key` but only ever DELETE `r2_object_key` (the raw)
    // — clipEligibleForDrop already proved they are DISTINCT objects.
    if (it.kind === 'clip') {
      // DEFENSE-IN-DEPTH (resolved-level distinctness): refuse if the web copy and
      // the raw resolve to the SAME R2 object. clipEligibleForDrop proved the key
      // STRINGS differ, but two forms (legacy `key` vs `r2://setnayan-media/key`)
      // can resolve to one object — in which case the HEAD below would verify, and
      // this delete would destroy, the very object that is the only playable web
      // copy. Assert distinctness at the resolved level before deleting. Fail
      // closed (sameResolvedObject also returns true when either ref is
      // unresolvable, subsuming the null-web-ref case).
      if (sameResolvedObject(it.clip_web_r2_key ?? '', it.r2_object_key)) {
        clipWebUnverified += 1;
        continue;
      }
      const webRef = resolveOriginalRef(it.clip_web_r2_key ?? '');
      if (!webRef) {
        clipWebUnverified += 1;
        continue; // web-copy key unresolvable → cannot verify → never delete
      }
      const head = await r2Head({ bucket: webRef.bucket, key: webRef.key }).catch(() => null);
      if (!clipWebCopyCustodyOk(head, Number(it.clip_web_bytes), { graceMs, nowMs })) {
        clipWebUnverified += 1;
        continue; // missing / size-mismatch / non-video / within fresh-grace
      }
    }

    eligible += 1;
    if (dryRun) continue; // preview only — no delete, no stamp

    try {
      await r2Delete({ bucket: ref.bucket, key: ref.key });
      await admin
        .from(it.table)
        .update({ full_res_dropped_at: new Date().toISOString() })
        .eq(it.idCol, it.id);
      dropped += 1;
      if (it.kind === 'clip') clipsDropped += 1;
      bytesReclaimed += Number(it.orig_bytes ?? 0) || 0;
    } catch {
      // Best-effort: leave it unstamped so the next sweep retries.
      failed += 1;
    }
  }

  // Observability: a clip with a web-copy KEY whose OBJECT custody didn't clear
  // is a destructive-safety near-miss made visible — the raw was (correctly) NOT
  // deleted. A number that never falls for a fleet means backfilled web copies are
  // truncated / non-video / stuck inside the fresh-grace window.
  if (clipWebUnverified > 0) {
    console.warn(
      `[papic-fullres-drop] Kept ${clipWebUnverified} clip raw(s) — web-copy object ` +
        'custody not proven (missing / size-mismatch / non-video / within the ' +
        `${CLIP_WEB_DROP_GRACE_DAYS}-day fresh-grace window). The raw is retained as ` +
        'the only playable copy; these retry next sweep.',
    );
  }

  // Observability: a stuck Drive copy must be visible, not a silent skip. Each
  // deferred photo is one whose full-res second copy hasn't landed — if this
  // number never falls for an event, that event's Drive sync is broken.
  if (deferredDriveCopy > 0) {
    const worst = [...deferredByEvent.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, n]) => `${id}=${n}`)
      .join(', ');
    console.warn(
      `[papic-fullres-drop] Deferred ${deferredDriveCopy} full-res original(s) ` +
        `across ${deferredByEvent.size} event(s) — high-res Drive copy not confirmed ` +
        `(${driveStateUnknownEvents} event(s) had an unreadable Drive state). ` +
        `Top: ${worst}. These retry next sweep; a number that never falls means ` +
        'that event’s Drive sync is stuck.',
    );
  }

  return {
    dryRun,
    retentionDays: days,
    clipDropEnabled: clipsEnabled,
    scanned: items.length,
    eligible,
    dropped,
    clipsDropped,
    skippedKeepFullRes,
    deferredDriveCopy,
    driveStateUnknownEvents,
    clipWebUnverified,
    failed,
    bytesReclaimed,
  };
}

/**
 * CRON-FREE weekly full-res drop — replaces the Vercel Cron schedule (the route
 * stays as a manual/curl trigger, incl. its `?dry=1` preview). Fired from
 * admin-layout after(); a WEEKLY DB claim guarantees ~once/week across the fleet
 * and survives deploys. runFullResDropSweep keeps its own kill-switch
 * (PAPIC_FULLRES_DROP_ENABLED) + per-run limit (default 500), so this is bounded
 * and safe-by-default. Best-effort, never throws.
 */
export async function maybeRunPapicFullResDrop(): Promise<void> {
  try {
    if (await claimPeriodicJob('papic-fullres-drop', WEEKLY_GAP_MS)) {
      await runFullResDropSweep();
    }
  } catch {
    /* best-effort — a missed week retries on the next eligible admin request */
  }
}
