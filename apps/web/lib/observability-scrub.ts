// Biometric face-vector scrubber for Sentry (One-Pool spec §3.4 step 5).
//
// A face descriptor is a 128-d array of floats — sensitive PI under RA 10173.
// It must NEVER land in an error report, a captured request body, or a captured
// server-action argument. This runs in every Sentry `beforeSend` (browser +
// Node + edge) as a fail-closed denylist:
//
//   - KEY-based: any object key that names a face/selfie vector/descriptor/
//     embedding has its value redacted (covers structured payloads such as the
//     `/api/papic/guest-capture` body `{ faceVectors: [...] }`).
//   - SHAPE-based: any array that looks like a descriptor (or an array of them)
//     is redacted wholesale — the Papic matcher action passes vectors
//     POSITIONALLY (`autoTagSeatCapture(token, photoId, number[][])`), so key
//     redaction alone can't reach them if Sentry captures the action args.
//
// Pure + isomorphic (no imports), so it is unit-testable and safe in the browser
// bundle, the Node server, and the edge runtime.

const FACE_VECTOR_KEY_RE =
  /(face_?vectors?|selfie_?vectors?|face_?descriptors?|face_?embeddings?)/i;

const REDACTED = '[redacted:face_vector]';

// A dlib face descriptor is 128-d. Require a generous floor (64) so incidental
// short numeric arrays aren't touched, while any real descriptor is caught.
const MIN_VECTOR_LEN = 64;

function isDescriptor(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.length >= MIN_VECTOR_LEN &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}

/** A single descriptor (number[]) OR an array of descriptors (number[][]). */
function looksLikeFaceVector(v: unknown): boolean {
  if (isDescriptor(v)) return true;
  return Array.isArray(v) && v.length > 0 && v.every((el) => isDescriptor(el));
}

function scrub(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (depth > 8) return value;
  if (value === null || typeof value !== 'object') return value;
  if (looksLikeFaceVector(value)) return REDACTED;
  if (seen.has(value as object)) return value;
  seen.add(value as object);
  if (Array.isArray(value)) {
    return value.map((v) => scrub(v, seen, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = FACE_VECTOR_KEY_RE.test(k) ? REDACTED : scrub(v, seen, depth + 1);
  }
  return out;
}

/**
 * Redact every biometric face vector from a Sentry event (or any object).
 * Returns a scrubbed copy. If scrubbing itself throws, returns `null` so Sentry
 * DROPS the event rather than risk shipping an unscrubbed descriptor.
 */
export function scrubFaceVectorsFromEvent<T>(event: T): T {
  try {
    return scrub(event, new WeakSet<object>(), 0) as T;
  } catch {
    return null as unknown as T;
  }
}
