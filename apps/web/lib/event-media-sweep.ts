import { createAdminClient } from '@/lib/supabase/admin';
import { executeCleanupDelete } from '@/lib/cleanup-delete';
import type { PlannedDelete } from '@/lib/cleanup-delete-scope';
import {
  EVENT_JSON_COLUMNS,
  EVENT_KEY_COLUMNS,
  PAPIC_KEY_COLUMNS,
  VENDOR_CAPTURE_KEY_COLUMNS,
  planEventMediaDeletes,
} from '@/lib/event-media-sweep-core';

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
 *
 * ─── EVERY OBJECT MUST BE THE CELEBRATION'S OWN (2026-09-10) ──────────────
 * 🔒 The decision lives in `lib/event-media-sweep-core.ts` and is held to the
 * row's own folder, not merely the media bucket — the media bucket holds every
 * couple's photographs, and the rows read here are ones their owners can write.
 * The delete goes through `executeCleanupDelete`, which refuses anything that
 * planner did not prove. Refusals are counted and logged.
 */

/** One object this celebration is proven to own — see planEventMediaDeletes. */
export type MediaRef = PlannedDelete;

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

  const { data: photos, error: photoErr } = await admin
    .from('papic_photos')
    .select(PAPIC_KEY_COLUMNS.join(','))
    .eq('event_id', eventId);
  if (photoErr) return null;

  // A supplier's own captures at this celebration — the FK cascade takes the
  // rows, so their keys must be read now. `vendor_profile_id` is half the
  // tenant the planner pins them to.
  const { data: captures, error: captureErr } = await admin
    .from('vendor_papic_captures')
    .select(['vendor_profile_id', ...VENDOR_CAPTURE_KEY_COLUMNS].join(','))
    .eq('event_id', eventId);
  if (captureErr) return null;

  const { data: ev, error: evErr } = await admin
    .from('events')
    .select([...EVENT_KEY_COLUMNS, ...EVENT_JSON_COLUMNS].join(','))
    .eq('event_id', eventId)
    .maybeSingle();
  if (evErr) return null;

  const plan = planEventMediaDeletes({
    eventId,
    photos: (photos ?? []) as unknown as Record<string, unknown>[],
    captures: (captures ?? []) as unknown as Record<string, unknown>[],
    event: (ev as unknown as Record<string, unknown> | null) ?? null,
  });

  // A refusal nobody can see is indistinguishable from a delete that happened.
  if (plan.refused > 0) {
    console.error(
      `[event-media-sweep] REFUSED ${plan.refused} ref(s) on event ${eventId} that are not under ` +
        'the celebration’s own folders — those objects are kept.',
    );
  }
  return plan.deletes;
}

export type SweepResult = { deleted: number; failed: number };

/**
 * Delete the collected objects. BEST-EFFORT BY CONTRACT, and deliberately so:
 * `r2Delete`'s own docblock says a failed delete leaves an orphan, never lost
 * data, and must not break the calling flow. The event row is already gone by
 * the time this runs — throwing here would report a failed deletion for one
 * that actually succeeded, which is worse than a leftover file.
 *
 * `executeCleanupDelete` refuses (throws, counted as failed) anything that did
 * not come out of the planner — a hand-built `{ bucket, key }` is not a proof.
 */
export async function sweepEventMedia(refs: MediaRef[]): Promise<SweepResult> {
  let deleted = 0;
  let failed = 0;
  for (const ref of refs) {
    try {
      await executeCleanupDelete(ref);
      deleted += 1;
    } catch (err) {
      failed += 1;
      console.error('[event-media-sweep] could not delete', ref.key, err);
    }
  }
  return { deleted, failed };
}
