/**
 * Connection Logs · PII redaction for app_telemetry_logs.payload_snapshot.
 *
 * The ingest route caps payload SIZE + same-origin, but stores whatever keys
 * the client sends. payload_snapshot is, by design, "the local variables at the
 * moment of failure" — which can easily include a guest email, a couple's
 * names, a contact phone, an auth token. Under the RA 10173 "no PII in logs"
 * posture, that must not be persisted verbatim.
 *
 * This is the storage-side chokepoint: insertFaultLog() runs every fault row
 * through redactPayload() before the row hits the table, so EVERY write path
 * (the client-fault ingest route today, any future caller) is covered without
 * trusting each call site to pre-scrub.
 *
 * It is a PII denylist + size cap, not a perfect scrubber. Keys whose names
 * look like email / name / phone / token / secret / address / auth etc. have
 * their values replaced with '[redacted]'; strings, depth, array length, and
 * key count are bounded. Call sites should still pass diagnostic context (ids,
 * counts, status codes, flags) rather than raw records.
 *
 * Pure module (no imports) so it is safe to use from server or client.
 */

const REDACT_KEY =
  /(e[-_]?mail|name|phone|mobile|contact|token|secret|pass(word|wd)?|pwd|auth|session|cookie|jwt|bearer|address|street|barangay|city|province|zip|postal|dob|birth|ssn|tin|gov|passport|licen[sc]e|card|iban|account[-_]?no|otp|\bpin\b|latitude|longitude|\blat\b|\blng\b|\blon\b|geo|coord)/i;

const MAX_STRING = 500;
const MAX_DEPTH = 4;
const MAX_ARRAY = 20;
const MAX_KEYS = 40;

const REDACTED = '[redacted]';

function redactValue(value: unknown, depth: number): unknown {
  if (value == null) return value;

  const t = typeof value;
  if (t === 'string') {
    const s = value as string;
    return s.length > MAX_STRING ? `${s.slice(0, MAX_STRING)}…[truncated]` : s;
  }
  if (t === 'number' || t === 'boolean') return value;
  if (t === 'bigint') return `${value}`;
  if (t === 'function' || t === 'symbol') return `[${t}]`;

  if (depth >= MAX_DEPTH) return '[depth-capped]';

  if (Array.isArray(value)) {
    const out = value.slice(0, MAX_ARRAY).map((v) => redactValue(v, depth + 1));
    if (value.length > MAX_ARRAY) out.push(`…[+${value.length - MAX_ARRAY} more]`);
    return out;
  }

  if (value instanceof Error) {
    return { name: value.name, message: redactValue(value.message, depth + 1) };
  }

  if (t === 'object') {
    return redactObject(value as Record<string, unknown>, depth + 1);
  }

  return '[unserializable]';
}

function redactObject(src: Record<string, unknown>, depth: number): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const key of Object.keys(src)) {
    if (n >= MAX_KEYS) {
      out['…'] = '[keys-capped]';
      break;
    }
    n += 1;
    out[key] = REDACT_KEY.test(key) ? REDACTED : redactValue(src[key], depth);
  }
  return out;
}

/**
 * Redact a fault payload. Always returns a plain object (the table column is
 * `payload_snapshot jsonb NOT NULL DEFAULT '{}'`-shaped from the caller's
 * perspective). Non-object / unserializable input collapses to `{}`.
 */
export function redactPayload(
  payload: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  try {
    return redactObject(payload, 1);
  } catch {
    return { _redaction_failed: true };
  }
}
