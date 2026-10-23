import 'server-only';
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
}

/** Every tier this owner signed for this shot. */
export async function readCaptureIntents(
  admin: SupabaseClient,
  ownerId: string,
  clientCaptureId: string,
): Promise<IntentRow[] | null> {
  const { data, error } = await admin
    .from('papic_upload_intents')
    .select('lane, event_id, owner_id, tier, r2_ref, size_bytes, content_type, settled_at')
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
export async function promoteTier(loaded: Extract<LoadedTier, { ok: true }>): Promise<string> {
  const stagingKey = keyOf(loaded.intent.r2_ref);
  const finalKey = finalKeyFor(stagingKey);
  if (!finalKey) throw new Error('not_a_staging_key');
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
  // The staging copy is no longer needed; the sweep removes it if this fails.
  await deleteStagingObject(loaded.intent).catch(() => 'refused');
  return encodeR2Ref(BUCKET, finalKey);
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
  if (error || !data) return true;
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
