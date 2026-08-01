// CSAM known-hash matching — THE INTEGRATION, NOT THE DATABASE.
//
// ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
// Papic Phase 3 (corporate · tournament) was gated on "a CSAM known-hash
// matcher + an NPC Circular 16-02 processor agreement". On 2026-08-01 the owner
// widened Papic to all 16 event types and waived that gate
// (lib/papic-event-access.ts, PAPIC_ACCESS_PHASE_3_TYPES). Reading the code
// then established something the gate language had hidden: THE MATCHER WAS
// NEVER BUILT FOR ANY PHASE. The only occurrence of "CSAM" in apps/web was the
// comment describing the gate. So the gap was never Phase-3-specific — it
// applied to weddings, and had done since Papic shipped.
//
// ── WHAT THIS FILE IS AND IS NOT ───────────────────────────────────────────
// Known-hash matching (PhotoDNA · NCMEC · IWF) cannot be implemented from
// inside a pull request. The hash list is not public and not obtainable: the
// ORGANISATION enrols with a provider and receives it under agreement. Any
// "sample hashes" or "test vectors" purporting to be the real list would be
// both unlawful to hold and worse than nothing, because they would make an
// inert control look live.
//
// So this module builds the SEAM:
//   • a real perceptual hash (dHash) over the same still the NSFW classifier
//     reads, on the same upload path, so no capture route can miss it;
//   • a provider-agnostic `KnownHashProvider` interface with NO PROVIDER WIRED;
//   • an explicit NOT_ENROLLED state that is recorded, queryable, and surfaced
//     in the admin console.
//
// ── THE RULE THIS MODULE ENFORCES ABOVE ALL OTHERS ─────────────────────────
// A stub that looks like protection and isn't is the single worst outcome
// available here — worse than no stub, because it converts a known gap into an
// assumed control. Therefore:
//
//   THERE IS NO VALUE IN `KnownHashStatus` THAT MEANS "clean" OR "pass".
//
// `no_match` is the ONLY affirmative outcome, and it is reachable only after a
// real provider returned it. `not_enrolled`, `unavailable` and `unsupported`
// are all non-affirmative and are exported behind `isAffirmativeHashCheck` so a
// caller cannot get this wrong by writing `status !== 'match'`.
//
// ── THE FAIL POLICY, STATED EXPLICITLY ─────────────────────────────────────
// When the matcher is unenrolled (today, always) or unavailable, the upload
// PROCEEDS under today's behaviour: the always-on NSFW classifier
// (lib/nsfw-screen.ts) and nothing more. It is not blocked.
//
// That is a deliberate trade, not an oversight. Blocking every upload on a
// control the organisation has not procured would take a live, selling product
// offline for a protection that would still not exist. What this module adds
// instead is that the absence is now RECORDED PER OBJECT in
// `public.media_hash_checks` and COUNTED in the admin console — so "how much
// media went through with no hash check?" has an answer, which it did not
// before this PR.
//
// ⚠ THIS DOES NOT CLOSE THE COMPLIANCE GAP. It closes the plumbing. The
// control is inert until the owner enrols with a provider and signs the NPC
// Circular 16-02 processor agreement. Both are owner/DPO acts, not code.

// NO `import 'server-only'`, and no static heavy imports — deliberately the
// same shape as lib/nsfw-screen.ts, which this module sits beside on the upload
// path. sharp / supabase are DYNAMIC imports so the pure decision functions
// below (dHashFromGrayscale, tallyHashCheckRows, knownHashHeadline, the status
// predicates) stay importable from node:test under tsx without a server
// context. Nothing here is imported by a client component.

import { knownHashMatchEnabled } from '@/lib/known-hash-match-flag';

// ─────────────────────────────────────────────────────────────────────────
// The status vocabulary.
// ─────────────────────────────────────────────────────────────────────────

/**
 * What happened to one object. Mirrors the CHECK constraint on
 * `media_hash_checks.status` (migration 20271029279897).
 *
 * Deliberately has no "clean"/"pass" member — see the module header.
 */
export type KnownHashStatus =
  /** No provider is wired. NOTHING was checked. The value every row carries today. */
  | 'not_enrolled'
  /** A provider RAN and returned no match. The ONLY affirmative outcome. */
  | 'no_match'
  /** A provider RAN and returned a match. */
  | 'match'
  /** A provider IS configured, but the lookup failed (network, auth, timeout). */
  | 'unavailable'
  /** The media had no hashable still — e.g. a clip whose poster extraction failed. */
  | 'unsupported';

/**
 * TRUE only when a provider actually examined this object and cleared it.
 *
 * Exported as a predicate rather than left to callers precisely so that nobody
 * writes `status !== 'match'` and silently treats `not_enrolled` — the value
 * every row carries today — as a pass.
 */
export function isAffirmativeHashCheck(status: KnownHashStatus): boolean {
  return status === 'no_match';
}

/** TRUE only on a positive provider match. Never true for an absent check. */
export function hashCheckBlocksMedia(status: KnownHashStatus): boolean {
  return status === 'match';
}

/**
 * TRUE when the status ASSERTS a provider outcome — i.e. a provider was
 * actually reached, whether it answered or errored.
 *
 * `unsupported` is deliberately NOT in this set: it means the media had no
 * hashable still, so nothing was ever sent anywhere. Getting that wrong is not
 * cosmetic — it is what decides whether `provider_id` may be null, and the
 * table's coherence CHECK rejects the mismatched combination outright. A
 * mismatch would therefore make the row unwritable and the check UNRECORDED,
 * which is the one outcome this feature cannot afford.
 */
export function hashCheckReachedProvider(status: KnownHashStatus): boolean {
  return status === 'no_match' || status === 'match' || status === 'unavailable';
}

/**
 * PURE. The `provider_id` a row must carry for a given status, mirroring
 * `media_hash_checks_provider_coherent`. Returns undefined when the pair is
 * incoherent (a provider outcome with no provider), which the caller treats as
 * "do not write" rather than letting Postgres reject it on a capture path.
 */
export function hashCheckProviderId(
  status: KnownHashStatus,
  providerId: string | null,
): string | null | undefined {
  if (!hashCheckReachedProvider(status)) return null;
  return providerId ? providerId : undefined;
}

/** Human-readable line for the admin console. Never says "clean". */
export function describeHashCheckStatus(status: KnownHashStatus): string {
  switch (status) {
    case 'not_enrolled':
      return 'Not checked — no hash provider is enrolled';
    case 'no_match':
      return 'Checked by the provider — no match';
    case 'match':
      return 'Checked by the provider — MATCH';
    case 'unavailable':
      return 'Not checked — the provider was unreachable';
    case 'unsupported':
      return 'Not checked — no hashable still for this media';
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Perceptual hash — dHash (difference hash), 64-bit.
//
// dHash over a 9×8 greyscale downscale: each of the 8 rows contributes 8 bits,
// one per adjacent-pixel comparison. Robust to rescaling and re-encoding, which
// is the whole point of a PERCEPTUAL hash — a cryptographic digest of the bytes
// would miss a re-saved JPEG, and that is the case known-hash matching exists
// to catch.
//
// This is NOT PhotoDNA. PhotoDNA's algorithm is proprietary and licensed; a
// provider adapter will send whatever ITS contract specifies (often the raw
// image over a vetted channel, or a provider-computed hash). The dHash here is
// the transport-independent fingerprint we can compute ourselves and store, so
// that when enrolment happens the BACKLOG — the media captured while no control
// existed — can be swept without re-downloading every object.
// ─────────────────────────────────────────────────────────────────────────

/** Downscale width for the dHash grid (one extra column for the differences). */
export const DHASH_WIDTH = 9;
/** Downscale height for the dHash grid. */
export const DHASH_HEIGHT = 8;

/**
 * PURE. Compute a dHash from a greyscale pixel grid, MSB-first, as lowercase
 * hex. Bit i is 1 when a pixel is strictly brighter than its right-hand
 * neighbour.
 *
 * `pixels` must hold exactly `width * height` samples in row-major order.
 * Throws on a malformed grid — the caller (recordKnownHashCheck) turns that
 * into an honest `unsupported`, never into a pass.
 *
 * Bit count is `(width - 1) * height`; with the 9×8 defaults that is 64 bits /
 * 16 hex chars. A grid whose bit count is not a multiple of 4 is rejected
 * rather than silently zero-padded, because two different grids must never
 * render to the same hex string by accident.
 */
export function dHashFromGrayscale(
  pixels: ArrayLike<number>,
  width: number = DHASH_WIDTH,
  height: number = DHASH_HEIGHT,
): string {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 2 || height < 1) {
    throw new Error(`dHashFromGrayscale: bad grid ${width}×${height}`);
  }
  if (pixels.length !== width * height) {
    throw new Error(
      `dHashFromGrayscale: expected ${width * height} samples, got ${pixels.length}`,
    );
  }
  const bitCount = (width - 1) * height;
  if (bitCount % 4 !== 0) {
    throw new Error(`dHashFromGrayscale: ${bitCount} bits is not hex-aligned`);
  }

  let out = '';
  let nibble = 0;
  let bitsInNibble = 0;
  for (let row = 0; row < height; row += 1) {
    const base = row * width;
    for (let col = 0; col < width - 1; col += 1) {
      const bit = pixels[base + col]! > pixels[base + col + 1]! ? 1 : 0;
      nibble = (nibble << 1) | bit;
      bitsInNibble += 1;
      if (bitsInNibble === 4) {
        out += nibble.toString(16);
        nibble = 0;
        bitsInNibble = 0;
      }
    }
  }
  return out;
}

/**
 * PURE. Hamming distance between two equal-length hex hashes — the standard
 * near-duplicate measure for perceptual hashes.
 *
 * Provider adapters and any future backlog sweep need this; it lives here so
 * there is one implementation with one test, rather than one per adapter.
 * Returns null for malformed or mismatched input (never a misleading 0, which
 * would read as "identical").
 */
export function hammingDistanceHex(a: string, b: string): number | null {
  if (a.length === 0 || a.length !== b.length) return null;
  let distance = 0;
  for (let i = 0; i < a.length; i += 1) {
    const x = Number.parseInt(a[i]!, 16);
    const y = Number.parseInt(b[i]!, 16);
    if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
    let diff = x ^ y;
    while (diff) {
      distance += diff & 1;
      diff >>= 1;
    }
  }
  return distance;
}

/**
 * Decode image bytes and compute the dHash. Uses sharp (already a dependency,
 * already in serverExternalPackages, already how nsfw-screen decodes) so this
 * adds no new runtime surface.
 *
 * Throws on undecodable input — the caller converts that to `unsupported`.
 */
export async function perceptualHashImageBytes(bytes: Uint8Array): Promise<string> {
  const { default: sharp } = await import('sharp');
  const raw = await sharp(Buffer.from(bytes))
    .greyscale()
    .resize(DHASH_WIDTH, DHASH_HEIGHT, { fit: 'fill' })
    .raw()
    .toBuffer();
  return dHashFromGrayscale(raw, DHASH_WIDTH, DHASH_HEIGHT);
}

// ─────────────────────────────────────────────────────────────────────────
// The provider seam.
// ─────────────────────────────────────────────────────────────────────────

export interface KnownHashLookupInput {
  /** dHash of the still, as returned by perceptualHashImageBytes. */
  perceptualHash: string;
  /** Raw still bytes. Some contracts require the image, not our hash. */
  bytes: Uint8Array;
}

/**
 * A known-hash matching provider. Implemented by an adapter AFTER the
 * organisation enrols — never before.
 *
 * `lookup` returns only the two things a provider can truthfully say. It must
 * THROW on any failure rather than return a negative, so an outage can never be
 * mistaken for "no match": the caller maps a throw to `unavailable`, which
 * `isAffirmativeHashCheck` treats as non-affirmative.
 */
export interface KnownHashProvider {
  /** Stable id recorded on every row this provider decides (e.g. 'photodna'). */
  readonly id: string;
  lookup(input: KnownHashLookupInput): Promise<'match' | 'no_match'>;
}

/**
 * Resolve the configured provider. RETURNS NULL — there is no provider, on
 * purpose.
 *
 * ⚠ DO NOT make this return a stub that answers 'no_match'. That single edit
 * would convert every recorded `not_enrolled` into a recorded pass and make the
 * admin console report a control that does not exist. The honest null is the
 * feature.
 *
 * TO ENROL (all of this is prerequisite to any code here):
 *   1. The organisation enrols with a hash provider — Microsoft PhotoDNA Cloud
 *      Service, NCMEC, or the Internet Watch Foundation — and executes their
 *      agreement. Setnayan is a Philippine entity; NCMEC reporting obligations
 *      and PH RA 9775 / RA 11930 duties both attach and are legal questions,
 *      not engineering ones.
 *   2. The NPC Circular 16-02 processor agreement is signed with whichever
 *      provider processes guest media on our behalf, and the ROPA gains the
 *      corresponding row.
 *   3. ONLY THEN: add the adapter here, keyed off its own secret, and return it.
 *      The recorded status vocabulary needs no change — `no_match` and `match`
 *      already exist and are already read correctly by every caller.
 */
export function resolveKnownHashProvider(): KnownHashProvider | null {
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// The hook.
// ─────────────────────────────────────────────────────────────────────────

/** Tables whose objects this hook records against. */
export type HashCheckSubjectTable =
  | 'papic_photos'
  | 'papic_guest_captures'
  | 'editorial_vendor_media'
  | 'event_std_video';

export type KnownHashOutcome = {
  /** The honest outcome. Never "clean". */
  status: KnownHashStatus;
  /** Whether a row was actually written to media_hash_checks. */
  recorded: boolean;
};

/**
 * THE HOOK. Run the known-hash check for one object and record what happened.
 *
 * Called from lib/nsfw-screen.ts at the point where the still's bytes are
 * already in hand — the same still the NSFW classifier reads, on the same
 * upload path — so every capture route inherits it without its own call site
 * and none can be added that skips it.
 *
 * NEVER THROWS. Safe to fire from after(). The return value is the honest
 * status; the caller decides what to do with `match` (today: block, reusing the
 * shipped `nsfw_blocked` terminal state).
 *
 * FLAG-DARK: with CSAM_HASH_MATCH_ENABLED unset this returns
 * `{ status: 'not_enrolled', recorded: false }` and writes nothing — behaviour
 * identical to before this PR, and the console still reports the honest
 * "not enrolled", because the console derives enrolment from the provider and
 * the flag, NOT from the presence of rows.
 */
export async function recordKnownHashCheck(opts: {
  subjectTable: HashCheckSubjectTable;
  r2ObjectKey: string;
  eventId?: string | null;
  /** Still bytes. Omitted/empty ⇒ `unsupported` (e.g. a posterless clip). */
  bytes?: Uint8Array;
}): Promise<KnownHashOutcome> {
  if (!knownHashMatchEnabled()) {
    return { status: 'not_enrolled', recorded: false };
  }

  const provider = resolveKnownHashProvider();
  let status: KnownHashStatus;
  let perceptualHash: string | null = null;

  try {
    if (!opts.bytes || opts.bytes.length === 0) {
      // No still to hash. NOT a pass — the object goes through unchecked and
      // says so.
      status = 'unsupported';
    } else {
      perceptualHash = await perceptualHashImageBytes(opts.bytes);
      if (!provider) {
        // The hash is computed and stored anyway: it is what lets the backlog
        // captured before enrolment be swept afterwards, without re-downloading
        // every object. The status stays honest.
        status = 'not_enrolled';
      } else {
        try {
          status = await provider.lookup({ perceptualHash, bytes: opts.bytes });
        } catch {
          // A provider outage must NEVER read as "no match".
          status = 'unavailable';
        }
      }
    }
  } catch {
    // Decode failure — the still could not be hashed at all.
    status = 'unsupported';
    perceptualHash = null;
  }

  // Derive provider_id from the status, per the table's coherence CHECK.
  // `undefined` means the pair is incoherent — persistHashCheck declines rather
  // than issuing a write Postgres would reject.
  const providerId = hashCheckProviderId(status, provider?.id ?? null);

  const recorded = await persistHashCheck({
    subjectTable: opts.subjectTable,
    r2ObjectKey: opts.r2ObjectKey,
    eventId: opts.eventId ?? null,
    status,
    providerId,
    perceptualHash,
  });

  return { status, recorded };
}

/**
 * Write (upsert) one row. Isolated so recordKnownHashCheck's DECISION logic
 * stays free of I/O, and so a pre-migration environment degrades to
 * `recorded: false` instead of throwing on a capture path.
 */
async function persistHashCheck(row: {
  subjectTable: HashCheckSubjectTable;
  r2ObjectKey: string;
  eventId: string | null;
  status: KnownHashStatus;
  /** undefined ⇒ incoherent with the status; do not write. */
  providerId: string | null | undefined;
  perceptualHash: string | null;
}): Promise<boolean> {
  try {
    // Incoherent pair — unreachable from recordKnownHashCheck, but issuing a
    // write the CHECK would reject is not worth the risk on a capture path.
    if (row.providerId === undefined) return false;

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { error } = await admin.from('media_hash_checks').upsert(
      {
        subject_table: row.subjectTable,
        r2_object_key: row.r2ObjectKey,
        event_id: row.eventId,
        status: row.status,
        provider_id: row.providerId,
        perceptual_hash: row.perceptualHash,
        checked_at: new Date().toISOString(),
      },
      { onConflict: 'subject_table,r2_object_key' },
    );
    if (error) {
      console.warn(
        `[known-hash-match] could not record check for ${row.subjectTable}/${row.r2ObjectKey}: ${error.message}`,
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn(
      `[known-hash-match] could not record check (fail-open, upload proceeds unchecked): ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// The admin-console read.
// ─────────────────────────────────────────────────────────────────────────

export type KnownHashIntegrationStatus = {
  /** TRUE only when a real provider is wired. False today, by construction. */
  enrolled: boolean;
  /** Provider id, or null when not enrolled. */
  providerId: string | null;
  /** Whether the per-upload hook runs at all. */
  hookEnabled: boolean;
  /**
   * One-line honest summary for the console. Never claims protection.
   */
  headline: string;
  /** Recorded outcomes by status. Empty when the table is absent/unwritten. */
  counts: Record<KnownHashStatus, number>;
  /** Objects recorded as NOT affirmatively checked (everything but no_match). */
  uncheckedCount: number;
  /** TRUE when the counts could not be read (pre-migration / DB error). */
  countsUnavailable: boolean;
};

/**
 * PURE. Derive the headline from enrolment + hook state, so the console's claim
 * is a function of configuration rather than of whether rows happen to exist.
 *
 * This is the guard against the worst failure mode available to this feature:
 * an empty `media_hash_checks` table must never render as "nothing flagged".
 * Nothing flagged and nothing checked are the same empty read.
 */
export function knownHashHeadline(args: {
  enrolled: boolean;
  hookEnabled: boolean;
}): string {
  if (!args.enrolled) {
    return args.hookEnabled
      ? 'NOT ENROLLED — the hook runs and records every upload as unchecked. No known-hash matching is happening.'
      : 'NOT ENROLLED — no known-hash matching is happening, and the recording hook is off.';
  }
  return args.hookEnabled
    ? 'Enrolled — uploads are checked against the provider hash list.'
    : 'Enrolled, but the hook is OFF — uploads are NOT being checked.';
}

const EMPTY_COUNTS: Record<KnownHashStatus, number> = {
  not_enrolled: 0,
  no_match: 0,
  match: 0,
  unavailable: 0,
  unsupported: 0,
};

/**
 * PURE. Fold raw `{status}` rows into per-status counts + the unchecked total.
 * Unknown statuses are ignored rather than silently bucketed as affirmative.
 */
export function tallyHashCheckRows(
  rows: ReadonlyArray<{ status?: string | null }>,
): { counts: Record<KnownHashStatus, number>; uncheckedCount: number } {
  const counts: Record<KnownHashStatus, number> = { ...EMPTY_COUNTS };
  let uncheckedCount = 0;
  for (const row of rows) {
    const status = row.status;
    if (!status || !(status in counts)) continue;
    const known = status as KnownHashStatus;
    counts[known] += 1;
    if (!isAffirmativeHashCheck(known)) uncheckedCount += 1;
  }
  return { counts, uncheckedCount };
}

/** Cap on rows pulled for the console tally — this is a status card, not a report. */
const STATUS_SCAN_LIMIT = 5000;

/**
 * Read the integration's honest state for the admin console. Never throws.
 *
 * `countsUnavailable` is deliberately distinct from "all zero": a failed read
 * and an empty table are the same value from PostgREST, and rendering an
 * unreadable table as "0 unchecked" would be the exact lie this feature exists
 * to prevent.
 */
export async function getKnownHashIntegrationStatus(): Promise<KnownHashIntegrationStatus> {
  const provider = resolveKnownHashProvider();
  const enrolled = provider !== null;
  const hookEnabled = knownHashMatchEnabled();

  let counts = { ...EMPTY_COUNTS };
  let uncheckedCount = 0;
  let countsUnavailable = true;

  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('media_hash_checks')
      .select('status')
      .limit(STATUS_SCAN_LIMIT);
    if (!error && data) {
      const tally = tallyHashCheckRows(data as Array<{ status?: string | null }>);
      counts = tally.counts;
      uncheckedCount = tally.uncheckedCount;
      countsUnavailable = false;
    }
  } catch {
    // countsUnavailable stays true — the card says so rather than showing zeros.
  }

  return {
    enrolled,
    providerId: provider?.id ?? null,
    hookEnabled,
    headline: knownHashHeadline({ enrolled, hookEnabled }),
    counts,
    uncheckedCount,
    countsUnavailable,
  };
}
