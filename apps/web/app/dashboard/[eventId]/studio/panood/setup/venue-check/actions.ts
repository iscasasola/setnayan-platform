'use server';

/**
 * Live Watch › venue connection check — the three server steps, behind ONE exported action (`venueCheck`, an
 * `op` per step) because every export is a Vercel route and the route budget is tight
 * (scripts/lint-server-action-budget.mjs).
 *
 *   start   → writes the check's row (RLS decides who may: couple, co-host/helper, delegated or booked
 *             coordinator — never a guest) and signs ONE presigned PUT for its test upload, through the
 *             same `presignUploadUrl` every upload in the app uses. The phone re-uses that one URL for
 *             each second's PUT, so the run leaves exactly one object behind.
 *   finish  → re-judges the phone's measurements with lib/venue-check.ts (the saved verdict is the
 *             server's, never the browser's), completes the row, deletes the test upload.
 *   discard → deletes the test upload of a check that was stopped or failed. Nothing is saved.
 *
 * Every path that can leave a test upload behind ends in a delete; a phone that leaves mid-run is the
 * sweep's (lib/venue-check-sweep.ts). The key is always derived here from ids the caller could read —
 * never taken from the browser — so these actions can only ever delete a venue-check test upload.
 */
import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { limitedHelperRefusal } from '@/lib/host-gate';
import { isUuid } from '@/lib/is-uuid';
import { isR2Configured } from '@/lib/r2';
import { cleanupDelete } from '@/lib/cleanup-delete';
import { venueCheckProbeScope } from '@/lib/cleanup-delete-scope';
import { presignUploadUrl } from '@/lib/uploads';
import { PROBE_BUCKET, maybeRunVenueProbeSweep } from '@/lib/venue-check-sweep';
import {
  PROBE_CHUNK_BYTES,
  PROBE_URL_TTL_SECONDS,
  cleanPlaceName,
  judgeVenue,
  probeKey,
  type VenueJudgement,
} from '@/lib/venue-check';

/** The type every test PUT carries — bound into the signature, so the phone must send the same. */
const PROBE_CONTENT_TYPE = 'application/octet-stream';

export type StartVenueCheckResult =
  | { ok: true; checkId: string; uploadUrl: string; contentType: string }
  | { ok: false; error: string };

export type FinishVenueCheckResult =
  | { ok: true; judgement: VenueJudgement; checkedAt: string }
  | { ok: false; error: string };

export type VenueCheckInput =
  | { op: 'start'; eventId: string }
  | { op: 'finish'; eventId: string; checkId: string; samples: unknown; delayMs: unknown; placeName: unknown }
  | { op: 'discard'; eventId: string; checkId: string };

/** What each op answers. */
export type VenueCheckResult<Op extends VenueCheckInput['op']> = Op extends 'start'
  ? StartVenueCheckResult
  : Op extends 'finish'
    ? FinishVenueCheckResult
    : { ok: boolean };

/** THE one door. The limited-helper gate first, then the step. */
export async function venueCheck<I extends VenueCheckInput>(input: I): Promise<VenueCheckResult<I['op']>> {
  const eventId = input.eventId;
  const helperRefusal = await limitedHelperRefusal(eventId, null);
  if (helperRefusal) return { ok: false, error: helperRefusal } as VenueCheckResult<I['op']>;
  if (input.op === 'start') return (await startCheck(eventId)) as VenueCheckResult<I['op']>;
  if (input.op === 'finish') return (await finishCheck(input)) as VenueCheckResult<I['op']>;
  return (await discardCheck(input)) as VenueCheckResult<I['op']>;
}

const setupPath = (eventId: string) => `/dashboard/${eventId}/studio/panood/setup`;

/** Best-effort by contract (r2Delete's own): a failed delete is the sweep's to finish, and is logged. */
async function removeProbe(eventId: string, checkId: string): Promise<void> {
  if (!isR2Configured()) return;
  try {
    // The pinned executor, held to this event's venue-check folder (lib/cleanup-delete-scope.ts).
    await cleanupDelete(`r2://${PROBE_BUCKET}/${probeKey(eventId, checkId)}`, venueCheckProbeScope(eventId));
  } catch (error) {
    logQueryError('venueCheck.removeProbe', error, { event_id: eventId, check_id: checkId }, 'graceful_degrade');
  }
}

/** The check's row, read through RLS — the caller may only touch a check they could read. */
async function readableCheck(eventId: string, checkId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('live_watch_venue_checks')
    .select('check_id, finished_at')
    .eq('check_id', checkId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) logQueryError('venueCheck.readableCheck', error, { event_id: eventId, check_id: checkId }, 'graceful_degrade');
  return { row: (data ?? null) as { check_id: string; finished_at: string | null } | null, error };
}

async function startCheck(eventId: string): Promise<StartVenueCheckResult> {
  if (!isUuid(eventId)) return { ok: false, error: 'This link isn’t right. Open the check from Live Watch setup.' };
  if (!isR2Configured()) return { ok: false, error: 'The check can’t run right now. Try again later.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in again, then start the check.' };

  const { data, error } = await supabase
    .from('live_watch_venue_checks')
    .insert({ event_id: eventId })
    .select('check_id')
    .single();
  if (error || !data) {
    logQueryError('venueCheck.start', error, { event_id: eventId }, 'graceful_degrade');
    // 42501 is RLS saying no — this person is not on the event's team. Anything else is a failed write.
    return error?.code === '42501'
      ? { ok: false, error: 'Only the couple, their co-hosts and their coordinator can run this check.' }
      : { ok: false, error: 'We couldn’t start the check. Try again.' };
  }
  const checkId = (data as { check_id: string }).check_id;

  let uploadUrl: string;
  try {
    uploadUrl = await presignUploadUrl({
      bucket: PROBE_BUCKET,
      key: probeKey(eventId, checkId),
      contentType: PROBE_CONTENT_TYPE,
      sizeBytes: PROBE_CHUNK_BYTES,
      ttlSeconds: PROBE_URL_TTL_SECONDS,
    });
  } catch (err) {
    logQueryError('venueCheck.presign', err, { event_id: eventId, check_id: checkId }, 'graceful_degrade');
    return { ok: false, error: 'We couldn’t start the check. Try again.' };
  }

  // Each check that starts also gives the sweep its chance (claimed, so at most once an hour).
  after(() => maybeRunVenueProbeSweep().catch(() => {}));
  return { ok: true, checkId, uploadUrl, contentType: PROBE_CONTENT_TYPE };
}

async function finishCheck(
  input: Extract<VenueCheckInput, { op: 'finish' }>,
): Promise<FinishVenueCheckResult> {
  const { eventId, checkId } = input;
  if (!isUuid(eventId) || !isUuid(checkId)) return { ok: false, error: 'This check isn’t right. Start it again.' };

  const { row, error: readError } = await readableCheck(eventId, checkId);
  if (readError) return { ok: false, error: 'We couldn’t save the result. Try again.' };
  if (!row) return { ok: false, error: 'This check isn’t yours to save.' };

  // The test upload goes whatever happens next — the result is in the numbers, not the file.
  await removeProbe(eventId, checkId);
  if (row.finished_at) return { ok: false, error: 'This check was already saved.' };

  const judgement = judgeVenue(Array.isArray(input.samples) ? input.samples : []);
  if (judgement.verdict === null) {
    return { ok: false, error: 'Nothing reached Setnayan from here, so there is no result to save. Check the connection and try again.' };
  }
  const delay = Number(input.delayMs);
  const checkedAt = new Date().toISOString();
  // 🔑 The SERVICE ROLE writes the result: signed-in users hold no UPDATE on this table (migration
  // 20271308955287, GRANTS), so a verdict can only ever be the one judgeVenue just computed. Access was
  // proved above by reading the row through the caller's own RLS.
  const { error } = await createAdminClient()
    .from('live_watch_venue_checks')
    .update({
      finished_at: checkedAt,
      verdict: judgement.verdict,
      place_name: cleanPlaceName(input.placeName),
      average_kbps: Math.round(judgement.averageBps / 1_000),
      slowest_kbps: Math.round(judgement.slowestBps / 1_000),
      worst_rung: judgement.worstRung,
      delay_ms: Number.isFinite(delay) && delay >= 0 ? Math.round(delay) : null,
    })
    .eq('check_id', checkId)
    .eq('event_id', eventId)
    .is('finished_at', null);
  if (error) {
    logQueryError('venueCheck.finish', error, { event_id: eventId, check_id: checkId }, 'graceful_degrade');
    return { ok: false, error: 'We measured it but couldn’t save the result. Try again.' };
  }
  revalidatePath(setupPath(eventId));
  return { ok: true, judgement, checkedAt };
}

async function discardCheck(input: Extract<VenueCheckInput, { op: 'discard' }>): Promise<{ ok: boolean }> {
  const { eventId, checkId } = input;
  if (!isUuid(eventId) || !isUuid(checkId)) return { ok: false };
  const { row } = await readableCheck(eventId, checkId);
  if (!row) return { ok: false };
  await removeProbe(eventId, checkId);
  return { ok: true };
}
