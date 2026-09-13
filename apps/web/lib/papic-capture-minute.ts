/**
 * The shutter minute — the client half of `public.papic_capture_minute`.
 *
 * A Papic capture is filed under `captured_at`, and until this shipped that
 * column fell to its default of now() on both write paths: the minute the BYTES
 * FINISHED ARRIVING. At a venue with patchy signal a 2 PM photograph landed at
 * 8 PM, so every surface built on that column — the day timeline, the story's
 * per-minute dial, the recap selection — measured where the reception had
 * signal rather than what happened.
 *
 * ⚠ THIS FILE VALIDATES NOTHING THAT MATTERS. It is a shape check on the way
 * out: a number the browser produced, turned into a string the RPC can accept.
 * The rule lives in `papic_capture_minute` in Postgres, where a caller cannot
 * skip it — both writers are anon- or service-role-reachable and neither trusts
 * its arguments. Everything here is convenience; nothing here is a gate.
 *
 * 👤 Owner ruling 2026-09-07: "when we get the photos and snippets, we know.
 * but the guest does not need to know." The value is read at the shutter and
 * carried silently. There is no UI for it and there must never be one — no
 * field, no confirmation, no "taken at" the guest can see or correct.
 */

/** Loosest possible sanity bound — an epoch-zero or absurd-future clock never
 *  leaves the device. The server clamps for real (and never refuses the shot). */
const MIN_PLAUSIBLE_MS = Date.UTC(2020, 0, 1);
const MAX_PLAUSIBLE_MS = Date.UTC(2100, 0, 1);

/**
 * A capture's shutter time as an ISO string for the `p_captured_at` argument,
 * or null when there is nothing believable to send (null = "you decide", and
 * the RPC's own answer to that is now(), exactly as before this shipped).
 */
export function capturedAtIso(ms: number | null | undefined): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms)) return null;
  if (ms < MIN_PLAUSIBLE_MS || ms > MAX_PLAUSIBLE_MS) return null;
  return new Date(ms).toISOString();
}

/**
 * Read a `captured_at_ms` form field (the guest camera posts multipart, and the
 * offline drain replays the same form). Anything unparseable is null — a
 * malformed field costs the capture its exact minute, never the capture.
 */
export function parseCapturedAtMs(raw: unknown): number | null {
  const n =
    typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isFinite(n)) return null;
  if (n < MIN_PLAUSIBLE_MS || n > MAX_PLAUSIBLE_MS) return null;
  return n;
}
