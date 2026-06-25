/**
 * Papic sampler → permanent PREFIX RELOCATION (pure core).
 *
 * Free-sampler captures are written under the EPHEMERAL `papic-sampler/` object
 * prefix (api/upload, seat branch); their display/thumb derivatives mirror that
 * path under `derivatives/papic-sampler/…` (papic-derivatives.ts). The cron-free
 * cleanup of abandoned sampler bytes is meant to be an R2 LIFECYCLE RULE on that
 * ephemeral prefix — but a lifecycle rule is prefix+age only (it can't consult the
 * DB), so it would also delete the photos of couples who CONVERTED (connected
 * Drive / bought paid Papic) if their bytes still live under `papic-sampler/`.
 *
 * The fix: at convert time, RELOCATE a kept couple's bytes off the ephemeral
 * prefix onto the permanent `papic/` prefix (the same prefix paid Papic uses), so
 * the lifecycle rule's prefix only ever contains genuinely-ephemeral bytes.
 *
 * The relocation rule is a single path-segment substitution — replace the
 * `papic-sampler/` segment with `papic/` — which uniformly covers BOTH the direct
 * tree (`papic-sampler/…`) and the derivative tree (`derivatives/papic-sampler/…`).
 * It is idempotent: a ref already on the permanent prefix (or a non-`r2://` legacy
 * value, or null) returns null = "nothing to move".
 *
 * Pure + dependency-free so the substitution is unit-testable without R2/DB.
 */

/** The ephemeral object-prefix segment free-sampler captures are born under. */
export const EPHEMERAL_SEGMENT = 'papic-sampler/';
/** The permanent object-prefix segment (the same one paid Papic uses). */
export const PERMANENT_SEGMENT = 'papic/';

/** Match `papic-sampler/` only as a whole path segment (start-of-key or after `/`). */
const SEGMENT_RE = /(^|\/)papic-sampler\//;

export type RelocatedRef = {
  /** Bucket parsed out of the `r2://bucket/key` ref. */
  bucket: string;
  /** The current (ephemeral) object key. */
  fromKey: string;
  /** The relocated (permanent) object key. */
  toKey: string;
  /** The relocated ref to persist (`r2://bucket/toKey`). */
  toRef: string;
};

/**
 * Relocate one stored ref off the ephemeral prefix. Returns the move, or null
 * when there is nothing to do: a null/empty value, a non-`r2://` legacy value, or
 * a key that does not sit under the `papic-sampler/` segment (already permanent).
 */
export function relocateRef(ref: string | null | undefined): RelocatedRef | null {
  if (!ref || !ref.startsWith('r2://')) return null;
  const rest = ref.slice('r2://'.length);
  const slash = rest.indexOf('/');
  if (slash <= 0) return null; // malformed ref — leave untouched
  const bucket = rest.slice(0, slash);
  const fromKey = rest.slice(slash + 1);
  if (!SEGMENT_RE.test(fromKey)) return null; // already permanent / not a sampler key
  const toKey = fromKey.replace(SEGMENT_RE, `$1${PERMANENT_SEGMENT}`);
  return { bucket, fromKey, toKey, toRef: `r2://${bucket}/${toKey}` };
}

/** True when this key sits under the ephemeral sampler prefix segment. */
export function isEphemeralKey(key: string | null | undefined): boolean {
  return Boolean(key) && SEGMENT_RE.test(key as string);
}
