// lib/papic-upload/tiers.ts — WHAT one Papic shot uploads, and in which order.
//
// Pure (no I/O, no React, no `server-only`): the phone, the capture routes and
// the unit tests all import this one vocabulary, so the key the server signs is
// by construction the key the phone PUTs and the key the record call verifies.
//
// ── WHY TIERS (owner 2026-10-23, relayed: "as realtime as possible") ────────
// A shot used to travel as ONE multipart POST of the full frame through a
// Vercel function. Vercel refuses a request body over 4.5 MB before our code
// runs (measured in production: 6 MB → 413 FUNCTION_PAYLOAD_TOO_LARGE), so every
// normal guest clip failed. Now the bytes go DIRECT to R2 on presigned PUTs, and
// each shot goes up in small pieces, smallest first across the WHOLE queue:
//
//   phase 'record'  — photo: thumb (~30 KB)        · clip: poster + first playable
//   phase 'display' — photo: tile + display         · (clips have none)
//   phase 'full'    — photo: original (keep full-res only) · clip: raw (ditto)
//
// Every 'record' in the queue goes before any 'display', and every 'display'
// before any 'full' — so after a dead hour at the venue, every shot appears as
// a thumbnail first instead of one shot arriving whole while forty wait.
//
// ── CLEAN AND SAFE (same relay) ──────────────────────────────────────────────
// A key is bound to ONE capture and ONE tier (`captureTierKey`), signed for one
// Content-Type and one Content-Length, for minutes. The record/attach calls
// re-check what landed against `TIER_RULES` (size cap + magic bytes) before a
// row points at it — a URL can never be reused for another file or another size.

export type CaptureLane = 'guest' | 'vendor';

export type PhotoTier = 'thumb' | 'tile' | 'display' | 'original';
export type ClipTier = 'poster' | 'clip_web' | 'clip_raw';
export type CaptureTier = PhotoTier | ClipTier;

export type CapturePhase = 'record' | 'display' | 'full';

/** Phase order — the replayer drains every capture's earlier phase first. */
export const PHASE_ORDER: readonly CapturePhase[] = ['record', 'display', 'full'];

export type MediaKind = 'image' | 'video';

export interface TierRule {
  kind: MediaKind;
  /** Largest object this tier may be — the sign call refuses above it, the
   *  record call re-checks what actually landed. */
  maxBytes: number;
  /** Below this it is a truncated / empty encode, not a picture. */
  minBytes: number;
}

// 🔢 The caps are ceilings for a FAULT, not targets: the phone makes thumb ~30
// KB, display ~300–500 KB, a clip web copy ~0.5 MB. Original and raw keep the
// ceilings the old route enforced (12 MB still · 40 MB clip — a 10 s 1440p clip
// is designed at ~12.5 MB, 3× headroom for VBR overshoot).
export const TIER_RULES: Readonly<Record<CaptureTier, TierRule>> = {
  thumb: { kind: 'image', maxBytes: 200_000, minBytes: 200 },
  tile: { kind: 'image', maxBytes: 600_000, minBytes: 200 },
  display: { kind: 'image', maxBytes: 2_500_000, minBytes: 500 },
  original: { kind: 'image', maxBytes: 12_000_000, minBytes: 500 },
  poster: { kind: 'image', maxBytes: 2_500_000, minBytes: 500 },
  clip_web: { kind: 'video', maxBytes: 15_000_000, minBytes: 1025 },
  clip_raw: { kind: 'video', maxBytes: 40_000_000, minBytes: 1025 },
};

export const PHOTO_TIERS: readonly PhotoTier[] = ['thumb', 'tile', 'display', 'original'];
export const CLIP_TIERS: readonly ClipTier[] = ['poster', 'clip_web', 'clip_raw'];

export function isCaptureTier(v: unknown): v is CaptureTier {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(TIER_RULES, v);
}

export function tiersFor(media: 'photo' | 'clip'): readonly CaptureTier[] {
  return media === 'clip' ? CLIP_TIERS : PHOTO_TIERS;
}

/** The content types a tier may be signed for. Anything else is refused at sign. */
const IMAGE_TYPES = ['image/jpeg', 'image/webp'] as const;
const VIDEO_TYPES = ['video/mp4', 'video/webm'] as const;

/** Normalise a browser type (`video/webm;codecs=vp9,opus` → `video/webm`). */
export function baseContentType(raw: string | null | undefined): string {
  return (raw ?? '').split(';')[0]!.trim().toLowerCase();
}

export function contentTypeAllowed(tier: CaptureTier, contentType: string): boolean {
  const t = baseContentType(contentType);
  const allowed: readonly string[] = TIER_RULES[tier].kind === 'image' ? IMAGE_TYPES : VIDEO_TYPES;
  return allowed.includes(t);
}

function extFor(contentType: string): string {
  switch (baseContentType(contentType)) {
    case 'image/webp':
      return 'webp';
    case 'video/webm':
      return 'webm';
    case 'video/mp4':
      return 'mp4';
    default:
      return 'jpg';
  }
}

/**
 * May this piece be signed at all? Its type must be one the tier allows and its
 * size inside the tier's cap. Pure — the sign path and its unit test share it.
 */
export function validateTierRequest(input: {
  tier: CaptureTier;
  contentType: string;
  sizeBytes: number;
}): { ok: true } | { ok: false; error: 'bad_tier' | 'bad_type' | 'too_large' | 'too_small' } {
  const rule = TIER_RULES[input.tier];
  if (!rule) return { ok: false, error: 'bad_tier' };
  if (!contentTypeAllowed(input.tier, input.contentType)) return { ok: false, error: 'bad_type' };
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < rule.minBytes) {
    return { ok: false, error: 'too_small' };
  }
  if (input.sizeBytes > rule.maxBytes) return { ok: false, error: 'too_large' };
  return { ok: true };
}

const SAFE_ID = /^[0-9a-zA-Z-]{1,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The ONE object key a capture tier may be written to.
 *
 * Folders are the ones the existing cleanup scopes already own
 * (`lib/cleanup-delete-scope.ts`): `papic/guest/<guest_id>/…` and
 * `papic/vendor-<vendor_profile_id>/event-<event_id>/…`, so "Remove for good"
 * and the account erasure reach these objects with no new rule.
 *
 * Deterministic on purpose: a retry of the same shot's same tier re-signs the
 * same key, so a replay overwrites one object instead of leaving a second.
 * Returns null on any id that is not the shape we mint (never guess a path).
 */
export function captureTierKey(input: {
  lane: CaptureLane;
  /** guest_id (guest lane) or vendor_profile_id (vendor lane). */
  ownerId: string;
  /** Required for the vendor lane (its folder is per event). */
  eventId?: string | null;
  clientCaptureId: string;
  tier: CaptureTier;
  contentType: string;
}): string | null {
  const { lane, ownerId, eventId, clientCaptureId, tier, contentType } = input;
  if (!SAFE_ID.test(ownerId)) return null;
  if (!UUID.test(clientCaptureId)) return null;
  if (!isCaptureTier(tier)) return null;
  if (!contentTypeAllowed(tier, contentType)) return null;
  const file = `cap-${clientCaptureId}-${tier}.${extFor(contentType)}`;
  if (lane === 'guest') return `papic/guest/${ownerId}/${file}`;
  if (!eventId || !SAFE_ID.test(eventId)) return null;
  return `papic/vendor-${ownerId}/event-${eventId}/${file}`;
}

/**
 * Where the PHONE puts a tier: the same folder, under `incoming/`.
 *
 * 🔒 A ROW NEVER POINTS AT A KEY A PRESIGNED URL CAN REACH. A presigned PUT is
 * reusable until it expires, so if the row pointed at the uploaded object, a
 * phone could re-PUT different bytes (same signed size) AFTER the screen passed
 * them. The server instead reads the uploaded bytes, screens THOSE, and writes
 * them itself to the final key (`captureTierKey`) — which no URL ever targets.
 */
export function stagingKeyFor(finalKey: string): string | null {
  const m = /^(.*)\/(cap-[^/]+)$/.exec(finalKey);
  return m ? `${m[1]}/incoming/${m[2]}` : null;
}

/** The final key a staging key promotes to (inverse of `stagingKeyFor`). */
export function finalKeyFor(stagingKey: string): string | null {
  const m = /^(.*)\/incoming\/(cap-[^/]+)$/.exec(stagingKey);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** How long a signed PUT stays usable. Minutes, never hours (relay "clean and safe"). */
export const CAPTURE_PUT_TTL_SECONDS = 5 * 60;

/**
 * Do the first bytes of an object look like the type it claims? JPEG `FF D8 FF`,
 * WebP `RIFF....WEBP`, MP4 `....ftyp`, WebM/Matroska `1A 45 DF A3`. A file whose
 * header disagrees with its signed type is refused before any row points at it.
 */
export function sniffMatches(head: Uint8Array, contentType: string): boolean {
  const t = baseContentType(contentType);
  const at = (i: number) => head[i] ?? -1;
  const ascii = (from: number, s: string) =>
    [...s].every((ch, i) => at(from + i) === ch.charCodeAt(0));
  switch (t) {
    case 'image/jpeg':
      return at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff;
    case 'image/webp':
      return ascii(0, 'RIFF') && ascii(8, 'WEBP');
    case 'video/mp4':
      return ascii(4, 'ftyp');
    case 'video/webm':
      return at(0) === 0x1a && at(1) === 0x45 && at(2) === 0xdf && at(3) === 0xa3;
    default:
      return false;
  }
}

/** Bytes the verifier reads from the front of an object to sniff it. */
export const SNIFF_BYTES = 16;

// ── The per-capture plan ────────────────────────────────────────────────────

/**
 * Which phase a tier belongs to, given what the shot has.
 *
 * A clip's raw is a 'record' tier when there is NO web copy (it is then the only
 * playable file and must arrive with the record), and a 'full' tier when a web
 * copy exists (then it is the keep-full-res original).
 *
 * A photo whose phone could not make a thumbnail (no canvas resize — an old
 * browser, a decode failure) records with its ORIGINAL, and the server makes
 * the three copies from it exactly as it always did (the fallback the relay
 * asked to keep: `generatePhotoDerivatives`).
 */
export function phaseOf(
  tier: CaptureTier,
  opts: { hasClipWeb: boolean; hasThumb?: boolean },
): CapturePhase {
  switch (tier) {
    case 'thumb':
    case 'poster':
    case 'clip_web':
      return 'record';
    case 'clip_raw':
      return opts.hasClipWeb ? 'full' : 'record';
    case 'tile':
    case 'display':
      return 'display';
    case 'original':
      return opts.hasThumb === false ? 'record' : 'full';
  }
}

/** The tier whose key a freshly recorded row carries as `r2_object_key`. */
export function recordObjectTier(
  media: 'photo' | 'clip',
  opts: { hasClipWeb: boolean; hasThumb?: boolean },
): CaptureTier {
  if (media === 'photo') return opts.hasThumb === false ? 'original' : 'thumb';
  return opts.hasClipWeb ? 'clip_web' : 'clip_raw';
}
