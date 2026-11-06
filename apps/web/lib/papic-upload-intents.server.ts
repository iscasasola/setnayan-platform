import 'server-only';
import { randomBytes } from 'node:crypto';
import { mvhdDurationMs } from '@/lib/papic-upload/mp4';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getR2Client, r2Copy, r2Head, r2Upload, R2_BUCKETS } from '@/lib/r2';
import { cleanupDelete } from '@/lib/cleanup-delete';
import {
  papicGuestCaptureScope,
  papicVendorCaptureScope,
  type CleanupScope,
} from '@/lib/cleanup-delete-scope';
import { presignUploadUrl, encodeR2Ref } from '@/lib/uploads';
import {
  CAPTURE_PUT_TTL_SECONDS,
  captureTierKey,
  attemptKeyFor,
  finalKeyFor,
  stagingKeyFor,
  contentTypeAllowed,
  baseContentType,
  sniffMatches,
  SNIFF_BYTES,
  TIER_RULES,
  validateTierRequest,
  type CaptureLane,
  type CaptureTier,
} from '@/lib/papic-upload/tiers';

// lib/papic-upload-intents.server.ts — the server half of "the bytes go straight
// to storage" (Papic save-first, strategy B, 2026-10-23).
//
// THREE JOBS, and nothing on this path ever reads a file out of a request body:
//
//   signCaptureTierPut   — mint ONE presigned PUT for ONE tier of ONE capture,
//                          after the route has checked who is asking. Bound to
//                          a key derived from the clientCaptureId + tier, signed
//                          for that exact Content-Type and Content-Length, for
//                          CAPTURE_PUT_TTL_SECONDS. The key is written down in
//                          papic_upload_intents so an object nobody records is
//                          found and swept later.
//   loadUploadedTier     — before a row may point at an object: it exists, its
//                          size is the size we signed and inside the tier's cap,
//                          and its first bytes are the type it claims.
//   promoteTier          — write the checked bytes to the FINAL key (one no
//                          presigned URL ever targets) and drop the upload.
//   settleCaptureIntents — a row now points at the promoted copy; the sweep
//                          leaves the intent alone.
//
// Service-role only (the intents table has no policy and no grant).

/** The media bucket every capture tier lives in. Private: read only through
 *  short-lived signed GETs, exactly as before. */
const BUCKET = R2_BUCKETS.media;

export interface SignTierInput {
  lane: CaptureLane;
  eventId: string;
  /** guest_id or vendor_profile_id — the folder owner. */
  ownerId: string;
  clientCaptureId: string;
  tier: CaptureTier;
  contentType: string;
  sizeBytes: number;
}

export type SignTierResult =
  | { ok: true; uploadUrl: string; ref: string; expiresInSeconds: number }
  | { ok: false; error: 'bad_tier' | 'bad_type' | 'too_large' | 'too_small' | 'sign_failed' };

export async function signCaptureTierPut(
  admin: SupabaseClient,
  input: SignTierInput,
): Promise<SignTierResult> {
  const valid = validateTierRequest(input);
  if (!valid.ok) return valid;
  const key = captureTierKey({
    lane: input.lane,
    ownerId: input.ownerId,
    eventId: input.eventId,
    clientCaptureId: input.clientCaptureId,
    tier: input.tier,
    contentType: input.contentType,
  });
  const stagingKey = key ? stagingKeyFor(key) : null;
  if (!stagingKey) return { ok: false, error: 'bad_tier' };
  const ref = encodeR2Ref(BUCKET, stagingKey);
  const contentType = baseContentType(input.contentType);

  // Written BEFORE the URL leaves the server: an object can only exist at a key
  // the sweep already knows about.
  const { error: intentErr } = await admin.from('papic_upload_intents').upsert(
    {
      lane: input.lane,
      event_id: input.eventId,
      owner_id: input.ownerId,
      client_capture_id: input.clientCaptureId,
      tier: input.tier,
      r2_ref: ref,
      size_bytes: input.sizeBytes,
      content_type: contentType,
      signed_at: new Date().toISOString(),
      // A fresh signature is a fresh, OPEN upload (the route only signs a tier
      // the row does not already hold — refHoldsTier).
      settled_at: null,
      sweep_refused_at: null,
    },
    { onConflict: 'r2_ref' },
  );
  if (intentErr) {
    console.error('[supabase-error] lib/papic-upload-intents.server.ts · from:papic_upload_intents.upsert', intentErr);
    return { ok: false, error: 'sign_failed' };
  }

  try {
    const uploadUrl = await presignUploadUrl({
      bucket: BUCKET,
      key: stagingKey,
      contentType,
      sizeBytes: input.sizeBytes,
      ttlSeconds: CAPTURE_PUT_TTL_SECONDS,
    });
    return { ok: true, uploadUrl, ref, expiresInSeconds: CAPTURE_PUT_TTL_SECONDS };
  } catch (err) {
    console.error('[papic-upload] presign failed', err instanceof Error ? err.message : err);
    return { ok: false, error: 'sign_failed' };
  }
}

export interface IntentRow {
  lane: CaptureLane;
  event_id: string;
  owner_id: string;
  tier: CaptureTier;
  /** The STAGING ref the phone PUT to (`…/incoming/cap-…`). */
  r2_ref: string;
  size_bytes: number;
  content_type: string;
  settled_at: string | null;
  /** The FINAL copy the last attempt promoted, until it is settled or removed. */
  final_ref?: string | null;
}

/** Every tier this owner signed for this shot. */
export async function readCaptureIntents(
  admin: SupabaseClient,
  ownerId: string,
  clientCaptureId: string,
): Promise<IntentRow[] | null> {
  const { data, error } = await admin
    .from('papic_upload_intents')
    .select('lane, event_id, owner_id, tier, r2_ref, size_bytes, content_type, settled_at, final_ref')
    .eq('owner_id', ownerId)
    .eq('client_capture_id', clientCaptureId);
  if (error) {
    console.error('[supabase-error] lib/papic-upload-intents.server.ts · from:papic_upload_intents.select', error);
    return null;
  }
  return (data ?? []).map((r) => ({
    lane: r.lane as CaptureLane,
    event_id: r.event_id as string,
    owner_id: r.owner_id as string,
    tier: r.tier as CaptureTier,
    r2_ref: r.r2_ref as string,
    size_bytes: Number(r.size_bytes),
    content_type: r.content_type as string,
    settled_at: (r.settled_at as string | null) ?? null,
    final_ref: (r.final_ref as string | null) ?? null,
  }));
}

/**
 * The cleanup scope that owns this intent's folder. Every delete here goes
 * through the pinned executor (lib/cleanup-delete.ts), and only ever names a
 * STAGING key (`…/incoming/…`) — never a key a row points at.
 */
export function intentScope(intent: Pick<IntentRow, 'lane' | 'owner_id' | 'event_id'>): CleanupScope {
  return intent.lane === 'vendor'
    ? papicVendorCaptureScope(intent.owner_id, intent.event_id)
    : papicGuestCaptureScope(intent.owner_id);
}

/** Delete an intent's STAGING object (refuses anything that is not one). */
export async function deleteStagingObject(intent: Pick<IntentRow, 'lane' | 'owner_id' | 'event_id' | 'r2_ref'>): Promise<'deleted' | 'refused'> {
  if (!finalKeyFor(keyOf(intent.r2_ref))) return 'refused';
  return cleanupDelete(intent.r2_ref, intentScope(intent));
}

function keyOf(ref: string): string {
  return ref.replace(/^r2:\/\/[^/]+\//, '');
}

/** The ref a row may point at for this intent (never the staging key). */
export function finalRefOf(intent: Pick<IntentRow, 'r2_ref'>): string | null {
  const finalKey = finalKeyFor(keyOf(intent.r2_ref));
  return finalKey ? encodeR2Ref(BUCKET, finalKey) : null;
}

async function getObject(key: string, range?: string): Promise<Uint8Array | null> {
  const client = getR2Client();
  if (!client) return null;
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key, Range: range }));
    const body = res.Body as unknown as { transformToByteArray?: () => Promise<Uint8Array> } | null;
    if (!body?.transformToByteArray) return null;
    return await body.transformToByteArray();
  } catch {
    return null;
  }
}

/** Pure: do these facts about an uploaded object match what we signed? */
export function uploadedObjectAcceptable(
  intent: Pick<IntentRow, 'tier' | 'size_bytes' | 'content_type'>,
  facts: { size: number; contentType: string | null; head: Uint8Array },
): boolean {
  const rule = TIER_RULES[intent.tier];
  if (!rule) return false;
  if (!Number.isFinite(facts.size) || facts.size !== intent.size_bytes) return false;
  if (facts.size > rule.maxBytes || facts.size < rule.minBytes) return false;
  if (facts.contentType !== null && baseContentType(facts.contentType) !== baseContentType(intent.content_type)) {
    return false;
  }
  return sniffMatches(facts.head, intent.content_type);
}

export type LoadedTier =
  | { ok: true; intent: IntentRow; size: number; bytes: Uint8Array | null; etag: string | null }
  | { ok: false; intent: IntentRow; reason: 'missing' | 'rejected' };

/**
 * Read what the phone uploaded and check it is the file we signed for: the
 * size we signed, inside the tier's cap, the type we signed, and first bytes
 * that ARE that type (JPEG/WebP/MP4/WebM).
 *
 * A still is read whole — the same bytes are then screened and written to the
 * final key, so what was checked is exactly what is kept. A video is checked by
 * HEAD + its first bytes and later copied pinned to that ETag.
 */
export async function loadUploadedTier(intent: IntentRow): Promise<LoadedTier> {
  const key = keyOf(intent.r2_ref);
  if (TIER_RULES[intent.tier].kind === 'image') {
    const bytes = await getObject(key);
    if (!bytes) return { ok: false, intent, reason: 'missing' };
    const ok = uploadedObjectAcceptable(intent, {
      size: bytes.length,
      contentType: null,
      head: bytes.subarray(0, SNIFF_BYTES),
    });
    return ok
      ? { ok: true, intent, size: bytes.length, bytes, etag: null }
      : { ok: false, intent, reason: 'rejected' };
  }
  const head = await r2Head({ bucket: BUCKET, key });
  if (!head) return { ok: false, intent, reason: 'missing' };
  const first = await getObject(key, `bytes=0-${SNIFF_BYTES - 1}`);
  if (!first) return { ok: false, intent, reason: 'missing' };
  const ok = uploadedObjectAcceptable(intent, { size: head.size, contentType: head.contentType, head: first });
  return ok
    ? { ok: true, intent, size: head.size, bytes: null, etag: head.etag }
    : { ok: false, intent, reason: 'rejected' };
}

/**
 * Write a checked tier to its FINAL key (the one a row may point at, which no
 * presigned URL ever targets) and drop the staging copy. Returns the final ref.
 */
export async function promoteTier(
  admin: SupabaseClient,
  loaded: Extract<LoadedTier, { ok: true }>,
  attempt: string,
): Promise<string> {
  const stagingKey = keyOf(loaded.intent.r2_ref);
  const base = finalKeyFor(stagingKey);
  const finalKey = base ? attemptKeyFor(base, attempt) : null;
  if (!finalKey) throw new Error('not_a_staging_key');
  const finalRef = encodeR2Ref(BUCKET, finalKey);
  // A PRIOR attempt of this piece whose answer was unclear (a lost reply, a
  // 5xx) left its final copy behind on purpose (review 2026-10-24, major 3).
  // Before this attempt takes over the intent's memory of it: remove it if no
  // row points at it — and keep it if one does.
  const prior = loaded.intent.final_ref;
  if (prior && prior !== finalRef) {
    await deleteFinalIfUnreferenced(admin, loaded.intent, prior);
  }
  // Written down BEFORE the copy: a crash between the copy and the row leaves a
  // final the sweep can find (and keeps, if a row came to point at it).
  const { error: trackErr } = await admin
    .from('papic_upload_intents')
    .update({ final_ref: finalRef })
    .eq('r2_ref', loaded.intent.r2_ref);
  if (trackErr) throw new Error(`track final: ${trackErr.message}`);
  if (loaded.bytes) {
    await r2Upload({
      bucket: BUCKET,
      key: finalKey,
      body: loaded.bytes,
      contentType: baseContentType(loaded.intent.content_type),
    });
  } else {
    await r2Copy({
      bucket: BUCKET,
      fromKey: stagingKey,
      toKey: finalKey,
      sourceIfMatch: loaded.etag ?? undefined,
    });
  }
  // The staging copy stays until the row is written (`dropStagingObjects`): a
  // refused record can then be retried without the phone sending it again.
  return finalRef;
}

/** A fresh attempt tag (8 hex). */
export function newAttemptTag(): string {
  return randomBytes(4).toString('hex');
}

/** After the row points at the final copies: the uploads are no longer needed. */
export async function dropStagingObjects(intents: readonly IntentRow[]): Promise<void> {
  for (const i of intents) await deleteStagingObject(i).catch(() => 'refused');
}

/** Every capture column that can hold a stored key — a reference in any of them keeps the object. */
const VENDOR_KEY_COLUMNS = ['r2_object_key', 'display_r2_key', 'thumb_r2_key', 'tile_r2_key', 'poster_r2_key'] as const;
const GUEST_KEY_COLUMNS = [
  ...VENDOR_KEY_COLUMNS,
  'clip_web_r2_key',
  'safe_display_r2_key',
  'safe_thumb_r2_key',
  'safe_tile_r2_key',
  'wall_safe_r2_key',
] as const;

/**
 * Does any capture row point at this ref? Fails CLOSED — a read that errors
 * answers true, and the object stays.
 */
export async function refIsReferenced(admin: SupabaseClient, lane: CaptureLane, ref: string): Promise<boolean> {
  const quoted = `"${ref.replace(/"/g, '')}"`;
  const any = (cols: readonly string[]) => cols.map((c) => `${c}.eq.${quoted}`).join(',');
  // Two literal tables, not `.from(table)`: the select-column scan must be able
  // to read every select (lib/security/select-column-scan.test.ts, T23).
  const { count, error } =
    lane === 'vendor'
      ? await admin
          .from('vendor_papic_captures')
          .select('capture_id', { count: 'exact', head: true })
          .or(any(VENDOR_KEY_COLUMNS))
      : await admin
          .from('papic_guest_captures')
          .select('capture_id', { count: 'exact', head: true })
          .or(any(GUEST_KEY_COLUMNS));
  if (error) {
    console.error('[supabase-error] lib/papic-upload-intents.server.ts · reference check', error);
    return true;
  }
  return (count ?? 0) > 0;
}

/**
 * 🛡 THE ONLY WAY A PROMOTED (FINAL) CAPTURE COPY IS DELETED — and it refuses a
 * key any capture row points at (review 2026-10-24, major 3: the database can
 * commit the row while its reply is lost; deleting "this attempt's" copy then
 * erases the shot the row now names, and the phone's retry hears "duplicate ok"
 * and lets go of its own copy). Used by a refused record, a lost race, a prior
 * unclear attempt, and the sweep. `'kept'` = a row points at it.
 */
export async function deleteFinalIfUnreferenced(
  admin: SupabaseClient,
  intent: Pick<IntentRow, 'lane' | 'owner_id' | 'event_id' | 'r2_ref'>,
  ref: string,
): Promise<'deleted' | 'kept' | 'refused'> {
  if (await refIsReferenced(admin, intent.lane, ref)) return 'kept';
  const outcome = await cleanupDelete(ref, intentScope(intent)).catch(() => 'refused' as const);
  if (outcome === 'deleted') {
    const { error } = await admin
      .from('papic_upload_intents')
      .update({ final_ref: null })
      .eq('r2_ref', intent.r2_ref)
      .eq('final_ref', ref);
    if (error) console.error('[supabase-error] lib/papic-upload-intents.server.ts · from:papic_upload_intents.update(final_ref null)', error);
  }
  return outcome === 'deleted' ? 'deleted' : 'refused';
}

/**
 * A DEFINITE "no" after this attempt promoted its pieces — the record function
 * ANSWERED with a refusal (credits, quota), the insert was refused by policy,
 * or another attempt won the race. Never called on an unclear failure (a
 * transport error, a 5xx, an error with no answer): then the copies stay, the
 * intent remembers them (final_ref), and the next attempt or the sweep decides
 * — each through deleteFinalIfUnreferenced, which keeps anything a row names.
 */
export async function discardPromoted(
  admin: SupabaseClient,
  intents: readonly IntentRow[],
  finals: ReadonlyMap<CaptureTier, string>,
): Promise<void> {
  for (const i of intents) {
    const ref = finals.get(i.tier);
    if (ref) await deleteFinalIfUnreferenced(admin, i, ref);
  }
}

/**
 * How long a clip's MP4 runs, read from its own `mvhd` box (a range read of the
 * top-level boxes, then the `moov` box) — so the phone keeps its raw clip until
 * the server has a web copy that is a real, playable video (review 2026-10-23,
 * major 5 · Guard A). Null when it cannot be read.
 */
export async function probeMp4DurationMs(ref: string, sizeBytes: number): Promise<number | null> {
  const key = keyOf(ref);
  let offset = 0;
  for (let n = 0; n < 32 && offset + 8 <= sizeBytes; n++) {
    const head = await getObject(key, `bytes=${offset}-${offset + 15}`);
    if (!head || head.length < 8) return null;
    const dv = new DataView(head.buffer, head.byteOffset, head.byteLength);
    let boxSize = dv.getUint32(0);
    const type = String.fromCharCode(head[4]!, head[5]!, head[6]!, head[7]!);
    let headerLen = 8;
    if (boxSize === 1 && head.length >= 16) {
      boxSize = Number(dv.getBigUint64(8));
      headerLen = 16;
    } else if (boxSize === 0) {
      boxSize = sizeBytes - offset;
    }
    if (boxSize < headerLen) return null;
    if (type === 'moov') {
      const len = Math.min(boxSize, 4_000_000);
      const moov = await getObject(key, `bytes=${offset}-${offset + len - 1}`);
      return moov ? mvhdDurationMs(moov) : null;
    }
    offset += boxSize;
  }
  return null;
}


/**
 * Load several tiers. A missing or rejected one is answered to the phone as
 * "PUT it again"; a rejected object is deleted first so the re-PUT is clean.
 */
export async function loadUploadedTiers(
  intents: readonly IntentRow[],
): Promise<{ loaded: Extract<LoadedTier, { ok: true }>[]; redo: CaptureTier[] }> {
  const results = await Promise.all(intents.map((i) => loadUploadedTier(i)));
  const loaded: Extract<LoadedTier, { ok: true }>[] = [];
  const redo: CaptureTier[] = [];
  for (const r of results) {
    if (r.ok) {
      loaded.push(r);
    } else {
      redo.push(r.intent.tier);
      if (r.reason === 'rejected') {
        await deleteStagingObject(r.intent).catch(() => 'refused');
      }
    }
  }
  return { loaded, redo };
}

/** Read a stored object's bytes by its ref (for a re-screen). Null when unreadable. */
export async function readCaptureObject(ref: string): Promise<Uint8Array | null> {
  return getObject(keyOf(ref));
}

export async function settleCaptureIntents(
  admin: SupabaseClient,
  stagingRefs: readonly string[],
): Promise<void> {
  if (stagingRefs.length === 0) return;
  const { error } = await admin
    .from('papic_upload_intents')
    .update({ settled_at: new Date().toISOString() })
    .in('r2_ref', stagingRefs as string[])
    .is('settled_at', null);
  // An unsettled intent costs nothing but a later sweep check — and the sweep
  // refuses to delete anything a row points at — so this is logged, not fatal.
  if (error) console.error('[supabase-error] lib/papic-upload-intents.server.ts · from:papic_upload_intents.update(settle)', error);
}

export type TierScreen = 'clean' | 'nsfw_blocked' | 'error';

/**
 * Screen one still BEFORE its key is written onto a row (relay "clean and safe":
 * nothing reaches another person before the screen passed). Same two checks the
 * capture screen runs — the known-hash hook, then the classifier.
 */
export async function screenTierBytes(input: {
  subjectTable: 'papic_guest_captures' | 'vendor_papic_captures';
  ref: string;
  eventId: string;
  bytes: Uint8Array;
}): Promise<TierScreen> {
  try {
    // The known-hash hook knows the guest table only (the supplier lane never
    // ran it — its route classified directly), so the supplier keeps exactly
    // the screen it had.
    if (input.subjectTable === 'papic_guest_captures') {
      try {
        const { recordKnownHashCheck, hashCheckBlocksMedia } = await import('@/lib/known-hash-match');
        const outcome = await recordKnownHashCheck({
          subjectTable: 'papic_guest_captures',
          r2ObjectKey: input.ref,
          eventId: input.eventId,
          bytes: input.bytes,
        });
        if (hashCheckBlocksMedia(outcome.status)) return 'nsfw_blocked';
      } catch {
        // the hook never costs a capture (same posture as screenCapture)
      }
    }
    const { classifyImageBytes, decideNsfw } = await import('@/lib/nsfw-screen');
    return decideNsfw(await classifyImageBytes(input.bytes));
  } catch (err) {
    console.warn('[papic-upload] tier screen failed', err instanceof Error ? err.message : err);
    return 'error';
  }
}

/**
 * Does this event keep the full-resolution original? (owner relay 2026-10-23:
 * "ORIGINAL only when the event's Keep full-res is on".)
 *
 * ⚖ READ OF THE RULING, FLAGGED FOR THE OWNER (PR body + HANDOVER). There is no
 * single "Keep full-res" switch in the product today; three existing settings
 * speak to it, and this keeps the original whenever one of them PROMISES more
 * than the 1280px display copy the phone always sends:
 *   · the couple's photo-quality pick `events.papic_quality_tier`:
 *     'full_res' ("Keep every photo exactly as the camera uploaded it") and
 *     'optimal' ("prints beautifully up to A3") both promise more pixels than
 *     1280 — dropping the original there would make the picker's own words
 *     false. 'high_efficiency' ("light files for screens and social") does not
 *     keep it;
 *   · the Keep Full-Res archive SKU (`HIGH_RES_ARCHIVE`) being active.
 * Either way the original is the LAST thing a phone sends (Wi-Fi preferred,
 * after every thumbnail and display copy), so keeping it never slows a shot
 * appearing. Narrowing it is a one-line change here.
 * An unreadable tier reads as KEEP — never lose resolution to an error
 * (lib/papic-fidelity.ts FIDELITY_READ_FAILSAFE is 'full_res' for the same reason).
 */
export async function eventKeepsFullRes(admin: SupabaseClient, eventId: string): Promise<boolean> {
  const { data, error } = await admin
    .from('events')
    .select('papic_quality_tier')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] lib/papic-upload-intents.server.ts · from:events.select(papic_quality_tier)', error);
    return true;
  }
  if (!data) return true;
  if ((data as { papic_quality_tier?: string | null }).papic_quality_tier !== 'high_efficiency') {
    return true;
  }
  try {
    const { eventSkuActive } = await import('@/lib/entitlements');
    return await eventSkuActive(admin, eventId, 'HIGH_RES_ARCHIVE');
  } catch {
    return false;
  }
}
