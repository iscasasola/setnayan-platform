/**
 * SEC-1 — the single sanctioned gate for an R2 ref that came from the CLIENT.
 *
 * Pure, client-safe (NO `server-only`, NO SDK, NO I/O) so it can be unit-tested
 * under the Node test runner (`pnpm test:unit` → `tsx --test`), mirroring the
 * `lib/bucket-routing.ts` house pattern. The presigning half lives in
 * `lib/r2-client-ref.server.ts`.
 *
 * # The hole this closes
 *
 * `presignDisplayUrl` / `displayUrlForStoredAsset` sign **any** `r2://` ref for
 * **any** of the five buckets with no tenancy check whatsoever. That is correct
 * and safe for the ~200 render call sites, because those read the ref out of a
 * DB row the caller was already allowed to SELECT — RLS is the tenancy check.
 *
 * It is NOT safe when the ref arrives as a server-action argument, a JSON body
 * field, or a form field. A handful of call sites did exactly that: they
 * authorised the caller against *some other id* (an eventId, a jobId, a
 * chapterId) and then signed a completely unrelated, caller-chosen key. That is
 * a cross-tenant read oracle — hand it the key of another couple's payment
 * screenshot or another vendor's DTI permit and it hands back a signed URL.
 *
 * # The invariant
 *
 * A client-supplied ref may name ONLY:
 *   1. the bucket this specific flow legitimately writes to, and
 *   2. a key prefix the caller is provably entitled to.
 *
 * Anything else — an unknown bucket, an unrecognised key shape, a legacy
 * `https://` URL, a prefix belonging to someone else — is REFUSED, never
 * signed. Fail closed: when in doubt we return null / throw, we do not sign.
 *
 * # Why the bucket half matters so much
 *
 * `setnayan-media` is the ONLY bucket bound to the public R2 host
 * (`R2_PUBLIC_URL` → `media.setnayan.com`); `publicUrlFor()` / `r2PublicUrl()`
 * serve it unsigned to anonymous visitors by design (vendor photos, booth art,
 * hero frames). Presigning a media key therefore discloses nothing the public
 * host does not already disclose to anyone holding the key.
 *
 * The other four buckets are private and hold the actual secrets:
 *   • setnayan-thread-files        — payment screenshots, chat attachments,
 *                                    force-majeure dispute evidence
 *   • setnayan-vendor-contracts    — signed contracts, platform receipts
 *   • setnayan-vendor-verification — DTI / BIR 2303 / Mayor's Permit / IDs
 *   • setnayan-samples             — catalogue art
 *
 * So the default policy bucket is `media`, and reaching a private bucket from
 * client input requires the call site to name it explicitly.
 *
 * # Bonus: this also closes an SSRF
 *
 * `displayUrlForStoredAsset` passes any value NOT starting with `r2://` through
 * **verbatim** as a "legacy URL". `decodeQrFromR2()` then `fetch()`es whatever
 * comes back — so a client-supplied ref of `http://169.254.169.254/…` was a
 * server-side request forgery primitive. Requiring the `r2://` scheme here
 * removes it.
 */
import { type R2BucketName } from '@/lib/r2';

/**
 * Bucket-name literals, restated here because `R2_BUCKETS` is a *value* export
 * from the `server-only` `lib/r2.ts` and importing it would break the Node test
 * runner. The `R2BucketName` annotations are type-only (erased at compile time)
 * and are checked against the union of `R2_BUCKETS`'s literal values — so
 * renaming a bucket in `lib/r2.ts` fails THIS file's typecheck rather than
 * silently drifting.
 */

/** The one bucket served unsigned over the public R2 host. */
export const PUBLIC_R2_BUCKET: R2BucketName = 'setnayan-media';

/** The four buckets that are never publicly readable. */
export const PRIVATE_R2_BUCKETS: ReadonlySet<R2BucketName> = new Set<R2BucketName>([
  'setnayan-thread-files',
  'setnayan-vendor-contracts',
  'setnayan-vendor-verification',
  'setnayan-samples',
]);

/** Every bucket the `r2://` scheme may legally name. */
const KNOWN_BUCKETS: ReadonlySet<string> = new Set<R2BucketName>([
  PUBLIC_R2_BUCKET,
  ...PRIVATE_R2_BUCKETS,
]);

const R2_SCHEME = 'r2://';

/**
 * What a given call site will accept from its client.
 *
 * `prefixes` entries MUST end with `/`. That is the prefix-confusion defense:
 * with a trailing slash, `events/123/` can never match a key under
 * `events/1234/`. A policy prefix without one is a programming error and is
 * rejected at call time rather than silently widening the gate.
 */
export type ClientRefPolicy = {
  /** Defaults to the public media bucket. Name a private bucket explicitly. */
  readonly bucket?: R2BucketName;
  /** Allowed key prefixes, each ending in `/`. At least one required. */
  readonly prefixes: readonly string[];
};

/** Thrown by `requireClientRef` when a ref fails the policy. */
export class R2RefRefused extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'R2RefRefused';
  }
}

/** S3/R2 hard limit on key length. */
const MAX_KEY_LENGTH = 1024;

/**
 * Rejects keys that are structurally hostile regardless of prefix:
 *   • absolute (`/…`) or backslash-bearing — normalisation ambiguity
 *   • any `.` or `..` path segment — prefix escape via traversal
 *   • control characters / NUL — header and log injection
 *   • over the S3 key-length limit
 *
 * NOTE R2, like S3, treats keys as opaque byte strings and does NOT collapse
 * `a/../b` into `b`. So `..` is not traversal *at the storage layer*. We reject
 * it anyway because intermediaries (CDNs, proxies, the SDK's own URL encoder,
 * anything that later feeds the key into a path) may normalise, and a key that
 * needs normalising has no legitimate producer here — every key in this system
 * is minted server-side from `randomUUID()` plus a sanitised prefix.
 */
function keyIsStructurallySafe(key: string): boolean {
  if (key.length === 0 || key.length > MAX_KEY_LENGTH) return false;
  if (key.startsWith('/') || key.includes('\\')) return false;
  for (let i = 0; i < key.length; i += 1) {
    const code = key.charCodeAt(i);
    // C0 controls + DEL: header / log injection, and no legitimate producer.
    if (code <= 0x1f || code === 0x7f) return false;
  }
  for (const segment of key.split('/')) {
    if (segment === '.' || segment === '..') return false;
  }
  return true;
}

function assertPolicy(policy: ClientRefPolicy): void {
  if (policy.prefixes.length === 0) {
    throw new Error('ClientRefPolicy needs at least one prefix.');
  }
  for (const p of policy.prefixes) {
    if (typeof p !== 'string' || p.length === 0 || !p.endsWith('/')) {
      throw new Error(
        `ClientRefPolicy prefix ${JSON.stringify(p)} must be a non-empty string ending in "/" ` +
          '(a bare prefix would let events/123 match events/1234).',
      );
    }
  }
}

/**
 * Validates a client-supplied `r2://bucket/key` against a policy.
 *
 * Returns the parsed `{ bucket, key }` when it passes, or `null` when it does
 * not. Never throws for bad *input* — only for a malformed *policy*, which is a
 * programming error.
 *
 * The `r2://` parse is deliberately reimplemented here rather than delegated to
 * `parseStoredAsset` (lib/uploads.ts): that helper's contract is to be
 * FORGIVING — it downgrades a malformed or unknown-bucket ref to
 * `{ kind: 'legacy_url' }` so one bad DB row can't crash a render. Forgiving is
 * exactly wrong on the untrusted path, so this one is strict and total.
 */
export function parseClientRef(
  value: unknown,
  policy: ClientRefPolicy,
): { bucket: R2BucketName; key: string } | null {
  assertPolicy(policy);
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  // A client ref MUST be an r2:// ref. Anything else — notably a bare
  // http(s):// URL — would sail through displayUrlForStoredAsset's legacy
  // passthrough and become an SSRF / open-redirect primitive downstream.
  if (!trimmed.startsWith(R2_SCHEME)) return null;

  const rest = trimmed.slice(R2_SCHEME.length);
  const slash = rest.indexOf('/');
  if (slash <= 0 || slash === rest.length - 1) return null;

  const bucket = rest.slice(0, slash);
  const key = rest.slice(slash + 1);
  if (!KNOWN_BUCKETS.has(bucket)) return null;

  const expectedBucket = policy.bucket ?? PUBLIC_R2_BUCKET;
  if (bucket !== expectedBucket) return null;

  if (!keyIsStructurallySafe(key)) return null;

  // Prefix must match AND leave at least one character of object name behind
  // it, so a bare `events/{id}/` can't be signed as an object.
  const matched = policy.prefixes.some(
    (p) => key.startsWith(p) && key.length > p.length,
  );
  if (!matched) return null;

  return { bucket: bucket as R2BucketName, key };
}

/** `parseClientRef`, but throws `R2RefRefused` instead of returning null. */
export function requireClientRef(
  value: unknown,
  policy: ClientRefPolicy,
): { bucket: R2BucketName; key: string } {
  const parsed = parseClientRef(value, policy);
  if (!parsed) {
    // Deliberately non-specific: the caller does not learn whether the object
    // exists, which bucket it is in, or why it was refused.
    throw new R2RefRefused('That file reference isn’t valid for this upload.');
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Policy builders — one per flow, so the expected prefix lives next to the
// tenancy id it is derived from rather than being retyped at each call site.
//
// EVERY id passed to these MUST already be authorised (event membership,
// vendor ownership, guest session). These builders scope a key to an id; they
// do not establish that the caller owns that id.
// ---------------------------------------------------------------------------

/** Save-the-Date builder media: background photo, hero video, video poster. */
export function stdMediaPolicy(eventId: string): ClientRefPolicy {
  return {
    prefixes: [
      `events/${eventId}/std-background/`,
      `events/${eventId}/std-video/`,
      `events/${eventId}/std-video-poster/`,
    ],
  };
}

// ---------------------------------------------------------------------------
// SEC-6 · the Save-the-Date video's THREE roles, each pinned to its OWN prefix.
//
// `stdMediaPolicy` above is the union used by the WRITE action. It is too wide
// for the read/serve path: under it a `videoKey` could name a poster object (or
// a background), which is exactly the "screen object A, serve object B" shape
// this whole fix exists to remove. So the gate uses one policy per role.
//
// The trailing slash is doing real work here: `events/1/std-video/` can never
// match `events/1/std-video-poster/x` (the character after `std-video` is `-`,
// not `/`), so the two roles are disjoint by construction.
// ---------------------------------------------------------------------------

/** The couple's uploaded Save-the-Date video — the SOURCE object they PUT. */
export function stdVideoSourcePolicy(eventId: string): ClientRefPolicy {
  return { prefixes: [`events/${eventId}/std-video/`] };
}

/** The client-extracted poster frame — the object the NSFW screen classifies. */
export function stdVideoPosterPolicy(eventId: string): ClientRefPolicy {
  return { prefixes: [`events/${eventId}/std-video-poster/`] };
}

/**
 * The key segment that marks a SEALED, screened object.
 *
 * Everything under `events/{id}/std-screened/` is written by the service-role
 * screen ONLY, as a server-side copy of bytes that were just classified. It is
 * what the public guest page is served, and it is the reason a post-approval
 * byte swap of the couple's upload cannot reach a guest: the swap lands on the
 * SOURCE object, which nothing public reads any more.
 *
 * That guarantee is only as good as the promise that no client can write here,
 * which is why the segment is RESERVED — `/api/upload` refuses any key
 * containing it, for every bucket and every branch (see
 * `pathPrefixIsAcceptable`). If you add another presigning route, it must call
 * that helper too.
 */
export const R2_SEALED_SEGMENT = 'std-screened';

/** Sealed, screened Save-the-Date objects. Service-role written; never client. */
export function stdSealedPolicy(eventId: string): ClientRefPolicy {
  return { prefixes: [`events/${eventId}/${R2_SEALED_SEGMENT}/`] };
}

/** Every key segment no client-driven upload may ever produce. */
export const R2_RESERVED_KEY_SEGMENTS: ReadonlySet<string> = new Set([R2_SEALED_SEGMENT]);

/**
 * Is this server-sanitised object-key path safe to presign a client PUT for?
 *
 * Two refusals, both structural:
 *
 *  1. **A reserved segment** — `std-screened` holds the sealed copies the guest
 *     page serves. A client that could PUT there would overwrite screened bytes
 *     at a key that already carries an `approved` verdict, which is the entire
 *     bypass in a different costume.
 *
 *  2. **A `:` anywhere in the path** — an object key is not a URL, and no
 *     legitimate producer in this system emits one (every key is
 *     `randomUUID()` + a sanitised filename under a sanitised prefix). A colon
 *     is how a key becomes URL-SHAPED, and a URL-shaped key is what let an
 *     attacker create a real R2 object at `http:/evil.example/v/x.mp4`, get a
 *     genuine fingerprint for it, and have the browser resolve the same string
 *     to a foreign origin. The read path no longer accepts such a ref at all —
 *     this removes the ability to mint the decoy in the first place.
 *
 * Takes the ALREADY-SANITISED path (post `sanitizePathPrefix`), because that is
 * what actually becomes the key.
 */
export function pathPrefixIsAcceptable(sanitisedPath: string): boolean {
  if (typeof sanitisedPath !== 'string' || sanitisedPath.length === 0) return false;
  for (const segment of sanitisedPath.split('/')) {
    if (R2_RESERVED_KEY_SEGMENTS.has(segment)) return false;
    if (segment.includes(':')) return false;
  }
  return true;
}

/** Anything the couple uploads under their own event folder in media. */
export function eventMediaPolicy(eventId: string): ClientRefPolicy {
  return { prefixes: [`events/${eventId}/`] };
}

/** Pabuya / e-gift QR images the couple uploads for their guests. */
export function pabuyaQrPolicy(eventId: string): ClientRefPolicy {
  return { prefixes: [`events/${eventId}/pabuya/`] };
}

/** Seating walkthrough zone videos. */
export function walkthroughVideoPolicy(eventId: string, zoneId: string): ClientRefPolicy {
  return { prefixes: [`zone-walkthroughs/${eventId}/${zoneId}/`] };
}

/** Patiktok source clips captured for one event. */
export function patiktokClipPolicy(eventId: string): ClientRefPolicy {
  return { prefixes: [`patiktok/clips/${eventId}/`] };
}

/** A guest's own day-of selfie, scoped to their event + guest row. */
export function guestSelfiePolicy(eventId: string, guestId: string): ClientRefPolicy {
  return { prefixes: [`events/${eventId}/guest-selfies/${guestId}/`] };
}

/** A vendor's payment QR image. */
export function vendorPaymentQrPolicy(vendorProfileId: string): ClientRefPolicy {
  return { prefixes: [`vendors/${vendorProfileId}/payment-qr/`] };
}

/**
 * Anything a vendor uploads under their OWN folder in the public media bucket —
 * logo, portfolio, services, showcase, booth posters. Broader than the
 * per-surface policies above, but still hard-pinned to one vendor id.
 */
export function vendorOwnedMediaPolicy(vendorProfileId: string): ClientRefPolicy {
  return { prefixes: [`vendors/${vendorProfileId}/`] };
}

/**
 * A vendor's verification documents. The ONE client-ref flow that legitimately
 * targets a private bucket, so it names it explicitly — and is pinned hard to
 * the vendor's own folder.
 */
export function vendorVerificationDocPolicy(vendorProfileId: string): ClientRefPolicy {
  return {
    bucket: 'setnayan-vendor-verification',
    prefixes: [`vendors/${vendorProfileId}/verification/`],
  };
}

/**
 * SEC-1 lane #1 — which ROOT SEGMENT may be written to which PRIVATE bucket.
 *
 * `/api/upload`'s generic branch lets any authenticated caller name the bucket
 * AND the pathPrefix. Keys are minted server-side (`randomUUID()`), so nothing
 * can be overwritten — the exposure is WRITE POLLUTION: putting arbitrary bytes
 * into a private bucket under a prefix belonging to a different flow. That
 * matters because humans and jobs read those prefixes: an admin reviews
 * `vendors/…/verification/` to approve a business, and dispute evidence is read
 * out of `thread-files`. Junk landing there is not a disclosure, it is an
 * integrity and review-queue problem.
 *
 * ⚠ SCOPED TO THE FOUR PRIVATE BUCKETS ON PURPOSE. `setnayan-media` is public by
 * design (`R2_PUBLIC_URL` serves it unsigned) and carries the overwhelming
 * majority of call sites with a genuinely long tail of prefixes — `events/`,
 * `vendors/`, `editorial/`, `hero-videos/`, `hero-frames/`, `living-heroes/`,
 * `editorial-vendor/`, `locked-qr-proof/`, `papic/`, `profile-photo/`,
 * `onboarding/`, `zone-walkthroughs/`, `taxonomy/`… A fail-closed allowlist over
 * THAT set would be a production risk out of proportion to the benefit, because
 * one missed prefix silently breaks a real upload. Media pollution is a cost and
 * abuse-rate concern, tracked separately; the private buckets are the security
 * boundary, and their call sites are few enough to enumerate exhaustively (they
 * were, by grepping every `bucket="…"` / `bucket: '…'` occurrence).
 *
 * ⚠ THIS IS CONTAINMENT, NOT TENANCY. It proves the prefix FAMILY belongs to the
 * bucket; it does NOT prove the caller owns the id inside it — `paperwork/{other
 * event}/…` still satisfies this map. Per-flow tenancy binding is the remaining
 * half of lane #1 and needs each call site to authorise its own id (the
 * `paperworkScanPolicy` treatment, applied at ~40 sites). What this closes is
 * the cross-BUCKET jump, which is the part no call site can defend against.
 */
const PRIVATE_BUCKET_ROOTS: ReadonlyMap<R2BucketName, ReadonlySet<string>> = new Map([
  // Payment screenshots · dispute evidence · chat attachments.
  ['setnayan-thread-files', new Set(['events', 'payments', 'payment-screenshots'])],
  // Scanned legal paperwork (shares the bucket with contracts + receipts).
  ['setnayan-vendor-contracts', new Set(['paperwork'])],
  // DTI / BIR 2303 / Mayor's Permit / IDs, per vendor.
  ['setnayan-vendor-verification', new Set(['vendors'])],
  // Admin-authored catalogue art.
  ['setnayan-samples', new Set(['refinements', 'taxonomy'])],
]);

/**
 * Fail-closed for the private buckets, permissive for public media.
 *
 * `sanitisedPrefix` must already have been through `sanitizePathPrefix` +
 * `pathPrefixIsAcceptable`; this only judges the ROOT segment against the bucket.
 */
export function privateBucketRootIsAllowed(
  bucket: R2BucketName,
  sanitisedPrefix: string,
): boolean {
  const allowed = PRIVATE_BUCKET_ROOTS.get(bucket);
  if (!allowed) return true; // public media — not this function's business
  const root = sanitisedPrefix.split('/')[0] ?? '';
  return allowed.has(root);
}

/**
 * A couple's scanned legal paperwork — PSA / CENOMAR / marriage licence.
 *
 * ⚠ TARGETS A PRIVATE BUCKET, so it names it explicitly. The uploader writes to
 * `paperwork/{eventId}/{documentType}/…` in `setnayan-vendor-contracts`
 * (`paperwork/page.tsx` → `<FileUpload bucket="vendor-contracts">`), which shares
 * a bucket with signed contracts and platform receipts. Scoping to the EVENT
 * segment is what stops one host naming another event's paperwork — or any
 * contract key — and having it signed back to them.
 *
 * Deliberately scoped to the event and NOT to the document type: the host may
 * legitimately re-file a scan under a corrected type, and the tenancy that
 * matters is the event.
 */
export function paperworkScanPolicy(eventId: string): ClientRefPolicy {
  return {
    bucket: 'setnayan-vendor-contracts',
    prefixes: [`paperwork/${eventId}/`],
  };
}

/**
 * A host's own off-platform payment receipt on the budget ledger.
 *
 * Public media bucket, so there is no confidentiality delta (see the bucket note
 * at the top of this file) — this is containment and attribution: it stops a
 * payment row pointing at an object that has nothing to do with this event.
 */
export function budgetPaymentProofPolicy(eventId: string): ClientRefPolicy {
  return { prefixes: [`budget/${eventId}/`, `payments/${eventId}/`] };
}

/**
 * A buyer's payment-proof screenshot on their OWN order.
 *
 * ⚠ Unlike `budgetPaymentProofPolicy` above, this one IS a confidentiality
 * boundary: the uploader (`orders/[orderId]/page.tsx`,
 * `booking-fees/[orderId]/page.tsx`) writes to the PRIVATE thread-files bucket,
 * and the stored ref is later presigned and rendered **to an admin** on the
 * reconciliation screen. `displayUrlForStoredAsset` signs whatever bucket the
 * ref names, so an unchecked ref here is a read oracle over every private
 * bucket, with an admin's eyeballs as the output device.
 *
 * `orderId` is safe to key on: both call sites load the order with
 * `.eq('user_id', user.id)` before this runs, so the caller has already been
 * proven to own it.
 */
export function orderPaymentProofPolicy(orderId: string): ClientRefPolicy {
  return {
    bucket: 'setnayan-thread-files',
    prefixes: [`payments/${orderId}/`],
  };
}

/**
 * The same screenshot, but posted from the inline checkout drawer BEFORE the
 * order row exists — so it cannot be keyed on `order_id`. The drawer uploads
 * under the event; accept the buyer's own user id too, since that is the other
 * server-known key the historical uploader used.
 */
export function inlineCheckoutProofPolicy(
  eventId: string | null,
  userId: string,
): ClientRefPolicy {
  // The AI subscription is the one eventless SKU, so `eventId` is legitimately
  // null there. Emit only the prefixes that are real — a `${null}` interpolated
  // into a prefix would be a degenerate rule that silently matches nothing.
  const prefixes = [`payment-screenshots/inline-checkout/${userId}/`];
  if (eventId) prefixes.unshift(`payment-screenshots/inline-checkout/${eventId}/`);
  return { bucket: 'setnayan-thread-files', prefixes };
}

/**
 * A vendor's proof-of-downpayment / remembrance photo on a locked-QR invite.
 *
 * ⚠ The uploader writes to a FLAT, untenanted `locked-qr-proof/` prefix
 * (`locked-qr-generator.tsx`), so this contains the ref to the public media bucket
 * under that prefix — it cannot prove the object belongs to this vendor.
 * Containment, not ownership, exactly like `editorialVendorMediaPolicy`. Tightening
 * it needs the uploader to move to `locked-qr-proof/{vendorProfileId}/`.
 */
export function lockedQrProofPolicy(): ClientRefPolicy {
  return { prefixes: ['locked-qr-proof/'] };
}

/**
 * Vendor-submitted editorial media for a couple's site.
 *
 * ✅ NOW TENANTED (SEC-1 lane #3, 2026-07-30). This used to read: *"the uploader
 * writes to a FLAT, untenanted `editorial-vendor/` prefix, so this policy can only
 * CONTAIN the ref — it cannot prove the object belongs to this vendor. Containment,
 * not ownership."* That was the last SEC-1 item a guard alone could not fix, because
 * the weakness was in the KEY LAYOUT rather than in the check.
 *
 * `editorial-media-studio.tsx` now uploads to
 * `editorial-vendor/{vendorProfileId}/{eventId}/`, so this proves **ownership**: a
 * vendor cannot name another vendor's editorial media — nor their own media from a
 * DIFFERENT couple's event — and have it accepted onto this event's editorial page.
 * That second half matters as much as the first: these refs are presigned onto the
 * couple's PUBLIC editorial site.
 *
 * Migration-free by luck of timing: `editorial_vendor_media` had **0 rows** in prod
 * when this landed, so there were no flat-prefix objects to move. Had there been,
 * this needed a backfill first — a reader of an old flat key would now be refused.
 */
export function editorialVendorMediaPolicy(
  vendorProfileId: string,
  eventId: string,
): ClientRefPolicy {
  return { prefixes: [`editorial-vendor/${vendorProfileId}/${eventId}/`] };
}
