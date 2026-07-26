/**
 * SEC-6 — SEALING, as a pure, dependency-injected module.
 *
 * Sealing is the mechanism that stops the bytes we examined and the bytes a
 * guest receives from drifting apart: the screen copies each object,
 * server-side and conditioned on its ETag, into `events/{id}/std-screened/…` —
 * a prefix `/api/upload` refuses to presign — and the public page is served only
 * those copies. The couple's upload key stays writable (they hold a 5-minute
 * presigned PUT); the sealed copy has no writer at all, so a post-examination
 * re-PUT lands somewhere nothing reads.
 *
 * ── WHY THIS IS ITS OWN FILE ────────────────────────────────────────────────
 * `lib/std-video-gate.ts` starts with `import 'server-only'`, so the Node test
 * runner (`pnpm test:unit` → `tsx --test`) cannot import a single line of it.
 * Round two's entire seal mechanism therefore shipped with ZERO test coverage —
 * a reviewer demonstrated that reverting the public serve path to the couple's
 * mutable key left all 3,876 unit tests and the whole DB suite green.
 *
 * So the logic lives here — no `server-only`, no SDK, no `node:` imports, no
 * ambient I/O — and R2 arrives as two injected functions. `lib/std-video-gate.ts`
 * binds the real ones; `lib/std-seal.test.ts` binds fakes and drives the paths
 * a live bucket will not reproduce on demand (a source that moves mid-copy, a
 * backend that ignores the conditional header, a 412).
 *
 * Same house pattern as `lib/r2-client-ref.ts` (pure) / `.server.ts` (presign).
 */

/** `<etag>:<bytes>` — an object's content identity as this system records it. */
export type Fingerprint = string;

/** Split a `<etag>:<bytes>` fingerprint back into its parts. */
export function splitFingerprint(fp: string): { etag: string; size: number } | null {
  if (typeof fp !== 'string') return null;
  const cut = fp.lastIndexOf(':');
  if (cut <= 0) return null;
  const etag = fp.slice(0, cut);
  const raw = fp.slice(cut + 1);
  // `Number('')` is 0, not NaN — so an EMPTY size would parse as a real
  // zero-byte object. A parser this system leans on must not invent a value out
  // of an absent one; that leniency is the whole bug class SEC-6 is about.
  if (!etag || raw.length === 0) return null;
  const size = Number(raw);
  if (!Number.isFinite(size)) return null;
  return { etag, size };
}

/**
 * Where a sealed copy goes.
 *
 * Two independent properties, and the design leans on both:
 *
 *  • **UNWRITABLE** — the `std-screened` segment is refused by
 *    `pathPrefixIsAcceptable` on every branch of `/api/upload`, the only
 *    client-driven presigner for this bucket. This is the load-bearing one.
 *  • **UNGUESSABLE** — `nonce` is a fresh `randomUUID()` supplied by the caller,
 *    so the key cannot be pre-created by someone who knows their own ETag.
 *
 * The nonce is also why a re-seal never overwrites an earlier one: a fresh
 * examination of new bytes gets a fresh object, and the superseded pair is
 * deleted explicitly (`retireSupersededSeals`) rather than being silently
 * replaced. Overwriting in place would mean an approval recorded against a key
 * could, in principle, later describe different bytes at that same key — which
 * is the entire class of bug this file exists to prevent.
 *
 * The digest is in the leaf name so a sealed object is self-describing in a
 * bucket listing and a mismatch is visible without a database.
 */
export function sealTargetKey(args: {
  eventId: string;
  role: 'video' | 'poster';
  fingerprint: Fingerprint;
  nonce: string;
}): string | null {
  const parts = splitFingerprint(args.fingerprint);
  if (!parts) return null;
  if (!args.eventId || !args.nonce) return null;
  // Nonce and event id go into a path SEGMENT, so anything that could add a
  // segment, escape the prefix, or make the key URL-shaped is refused rather
  // than sanitised — every legitimate value here is a UUID or a canonical id.
  if (!/^[A-Za-z0-9_-]+$/.test(args.nonce)) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(args.eventId)) return null;
  const digest = `${parts.etag}-${parts.size}`.replace(/[^A-Za-z0-9._-]/g, '-');
  return `events/${args.eventId}/${SEALED_SEGMENT}/${args.nonce}/${args.role}-${digest}`;
}

/**
 * Restated here rather than imported from `lib/r2-client-ref.ts` to keep this
 * module free of every dependency; the two are asserted equal in
 * `lib/std-seal.test.ts`, so a rename in either file fails a test instead of
 * silently opening the reserved-segment ban.
 */
export const SEALED_SEGMENT = 'std-screened';

/** The R2 operations sealing needs, injected so they can be faked in tests. */
export type SealDeps = {
  /**
   * Server-side copy within one bucket, conditioned on the source ETag. MUST
   * reject (throw) when the source no longer carries `sourceIfMatch`.
   */
  copy: (args: {
    bucket: string;
    fromKey: string;
    toKey: string;
    sourceIfMatch: string;
  }) => Promise<void>;
  /** `<etag>:<bytes>` of an object, or null if it cannot be identified. */
  fingerprint: (args: { bucket: string; key: string }) => Promise<Fingerprint | null>;
  /** Structured warning sink (Sentry + console in production, a spy in tests). */
  warn: (message: string, context: Record<string, unknown>) => void;
};

export type SealRequest = {
  eventId: string;
  role: 'video' | 'poster';
  bucket: string;
  /** The couple's own object — the source of the copy. */
  sourceKey: string;
  /** The fingerprint of the bytes that were examined. The copy is pinned to it. */
  fingerprint: Fingerprint;
  /** Fresh `randomUUID()`. Injected so tests get deterministic keys. */
  nonce: string;
};

/**
 * Seal one object and PROVE the copy holds the bytes we examined.
 *
 * Three refusals, each covering a different way the copy could end up holding
 * something other than what was judged:
 *
 *   • `CopySourceIfMatch` — R2 refuses the copy outright if the source changed
 *     since we fingerprinted it, closing the window between examine and copy.
 *   • a post-copy fingerprint — if a backend ever ignored the condition, or a
 *     multipart path produced a different ETag shape, we refuse rather than
 *     seal bytes we did not check. The seal is never taken on trust.
 *   • a malformed target key — refuse rather than write to a key the serve path
 *     would not accept back.
 *
 * Returns the sealed key, or null. Null means NO APPROVAL: the caller must
 * leave the verdict undecided rather than record an examination it cannot bind.
 */
export async function sealObject(
  deps: SealDeps,
  req: SealRequest,
): Promise<string | null> {
  const toKey = sealTargetKey({
    eventId: req.eventId,
    role: req.role,
    fingerprint: req.fingerprint,
    nonce: req.nonce,
  });
  if (!toKey) return null;
  const parts = splitFingerprint(req.fingerprint);
  if (!parts) return null;

  try {
    await deps.copy({
      bucket: req.bucket,
      fromKey: req.sourceKey,
      toKey,
      sourceIfMatch: parts.etag,
    });
  } catch (err) {
    // A 412 means the source moved under us — exactly what the condition is
    // for. Anything else (R2 unconfigured, a backend that rejects the
    // conditional header outright, a permission drift) fails the same way.
    //
    // LOGGED LOUDLY, not silently. This path fails CLOSED, so a systemic
    // failure here looks identical to "nobody uploaded a video" — every
    // couple's film would quietly close on the photo gallery with no signal
    // anywhere. `r2Copy` had no caller in this codebase before SEC-6, so
    // `CopySourceIfMatch` is being exercised against R2 for the first time and
    // this is the alarm that says so.
    deps.warn('[std-seal] conditional copy refused — video stays unexamined', {
      eventId: req.eventId,
      role: req.role,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  const sealedFingerprint = await deps.fingerprint({ bucket: req.bucket, key: toKey });
  if (sealedFingerprint !== req.fingerprint) {
    deps.warn('[std-seal] sealed copy does not hold the bytes we examined', {
      eventId: req.eventId,
      role: req.role,
      expected: req.fingerprint,
      got: sealedFingerprint,
    });
    return null;
  }
  return toKey;
}
