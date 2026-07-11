import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { r2Delete } from '@/lib/r2';
import { eventSkuActive } from '@/lib/entitlements';
import {
  DEFAULT_FULL_RES_RETENTION_DAYS,
  isEligibleForDrop,
  resolveOriginalRef,
  type DropCandidate,
} from '@/lib/papic-fullres-drop-core';

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
//   • PHOTOS ONLY — a clip's r2_object_key IS the playable video (no web-copy
//     video fallback); clips are excluded in the query AND would fail the
//     has-web-copy guard anyway.
//   • display_r2_key MUST exist — never drop a photo with no web copy.
//   • never a `sample/...` seed key.
//   • Keep-Full-Res (HIGH_RES_ARCHIVE) events keep their originals on us.
//   • only after captured_at < now - retentionDays.
//   • the R2 delete resolves a known bucket or declines.
// ============================================================================

const KEEP_FULL_RES_SKU = 'HIGH_RES_ARCHIVE';

function dropEnabled(): boolean {
  // Owner 2026-07-11 "enable the drop" — ON by default now that the model is
  // live (downloads fall back to the web copy, Keep Full-Res is the opt-out, and
  // the couple's Drive holds full-res). KILL-SWITCH: set PAPIC_FULLRES_DROP_ENABLED
  // ='false' on Vercel to instantly turn all deletion back OFF. (Note: prod has
  // only the excluded sample photos today, so nothing is drop-eligible yet — real
  // couple photos only age into the 90-day window over time.)
  return process.env.PAPIC_FULLRES_DROP_ENABLED !== 'false';
}

function retentionDays(): number {
  const n = Number(process.env.PAPIC_FULLRES_RETENTION_DAYS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_FULL_RES_RETENTION_DAYS;
}

export type FullResDropSummary = {
  dryRun: boolean;
  retentionDays: number;
  scanned: number;
  eligible: number;
  dropped: number;
  skippedKeepFullRes: number;
  failed: number;
  bytesReclaimed: number;
};

type Item = DropCandidate & {
  table: 'papic_photos' | 'papic_guest_captures';
  idCol: 'photo_id' | 'capture_id';
  id: string;
  event_id: string;
  orig_bytes: number | null;
};

export async function runFullResDropSweep(
  opts: { limit?: number; dryRun?: boolean; retentionDaysOverride?: number } = {},
): Promise<FullResDropSummary> {
  const days = opts.retentionDaysOverride ?? retentionDays();
  const limit = Math.min(Math.max(1, opts.limit ?? 500), 2000);
  const dryRun = opts.dryRun ?? !dropEnabled();
  const nowMs = Date.now();
  const cutoffIso = new Date(nowMs - days * 86_400_000).toISOString();
  const admin = createAdminClient();

  // PHOTOS ONLY. Guest media_type NULL = photo (include null + 'photo', drop 'clip').
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

  const items: Item[] = [
    ...((seat.data ?? []) as Record<string, unknown>[]).map((r) => ({
      table: 'papic_photos' as const,
      idCol: 'photo_id' as const,
      id: r.photo_id as string,
      event_id: r.event_id as string,
      r2_object_key: r.r2_object_key as string,
      display_r2_key: (r.display_r2_key as string | null) ?? null,
      captured_at: r.captured_at as string,
      full_res_dropped_at: (r.full_res_dropped_at as string | null) ?? null,
      orig_bytes: (r.orig_bytes as number | null) ?? null,
    })),
    ...((guest.data ?? []) as Record<string, unknown>[]).map((r) => ({
      table: 'papic_guest_captures' as const,
      idCol: 'capture_id' as const,
      id: r.capture_id as string,
      event_id: r.event_id as string,
      r2_object_key: r.r2_object_key as string,
      display_r2_key: (r.display_r2_key as string | null) ?? null,
      captured_at: r.captured_at as string,
      full_res_dropped_at: (r.full_res_dropped_at as string | null) ?? null,
      orig_bytes: (r.orig_bytes as number | null) ?? null,
    })),
  ];

  let eligible = 0;
  let dropped = 0;
  let skippedKeepFullRes = 0;
  let failed = 0;
  let bytesReclaimed = 0;
  const keepCache = new Map<string, boolean>();

  for (const it of items) {
    if (!isEligibleForDrop(it, { retentionDays: days, nowMs })) continue;

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

    const ref = resolveOriginalRef(it.r2_object_key);
    if (!ref) continue; // unresolvable bucket → never delete blindly
    eligible += 1;
    if (dryRun) continue; // preview only — no delete, no stamp

    try {
      await r2Delete({ bucket: ref.bucket, key: ref.key });
      await admin
        .from(it.table)
        .update({ full_res_dropped_at: new Date().toISOString() })
        .eq(it.idCol, it.id);
      dropped += 1;
      bytesReclaimed += Number(it.orig_bytes ?? 0) || 0;
    } catch {
      // Best-effort: leave it unstamped so the next sweep retries.
      failed += 1;
    }
  }

  return {
    dryRun,
    retentionDays: days,
    scanned: items.length,
    eligible,
    dropped,
    skippedKeepFullRes,
    failed,
    bytesReclaimed,
  };
}
