## 2026-07-26 · fix(security): tenant-scope R2 presigned URLs (SEC-1)

Closes the **R2 presign oracle** — the highest-severity finding from the
2026-07-26 `events` privilege audit (PR #3715), deferred there because grants
can't fix it.

### The hole

`lib/uploads.ts` (`presignDisplayUrl` / `displayUrlForStoredAsset`) signs **any**
`r2://` ref across **all 5 buckets** with no tenancy check. That is correct for
the ~200 render call sites, which read the ref out of a DB row the caller was
already allowed to SELECT — RLS is the tenancy check there.

It was **not** correct at 11 call sites where the ref arrived as a server-action
argument / JSON body / form field. Those authorised the caller against *some
other id* (an `eventId`, a `jobId`, a `chapterId`) and then signed a completely
unrelated caller-chosen key — a cross-tenant read oracle reaching the private
buckets (vendor verification IDs, signed contracts, payment screenshots, chat
attachments).

### The fix

New `apps/web/lib/r2-client-ref.ts` (pure, unit-tested) + `.server.ts` (presign
half): the single sanctioned gate for a client-supplied ref. A ref must name the
bucket the flow legitimately uses **and** sit under a prefix the caller is
entitled to, or it is refused. Fail-closed on unknown bucket, unrecognised key
shape, `..`/control chars/absolute keys, and on any non-`r2://` value.

Per-flow policy builders keep the expected prefix next to the authorised id.
Two call sites needed no policy at all — the key was fully derivable
server-side, so the client's value is now ignored outright.

Also closes an **SSRF**: `displayUrlForStoredAsset` passes non-`r2://` values
through verbatim and `decodeQrFromR2()` then `fetch()`es them, so a
client-supplied `http://169.254.169.254/…` was a server-side fetch primitive.

**Secured (11):** `presignStdBackground` · `saveAllStdContent`
(background/video/poster/music) · `finalizeChapterTeaser` (+ a 0-row PostgREST
UPDATE that never errored, so the presign ran for chapters the caller didn't
own) · `finalizePatiktokRenderJob` (key derived; TTL 7d → 1h; the *stored*
pointer was also being poisoned) · `recordPatiktokClip` ·
`saveWalkthroughZoneVideo` (delivered via the **anonymous** `/api/seat-lookup`)
· `enrollGuestFace` (delivered via the **anonymous** `/api/venue-scene`) ·
`submitVendorEditorialMedia` · `addPaymentMethod` · `updateDocUploadInline` ·
`savePabuyaMethod`. Plus `/api/patiktok/upload`, where an unvalidated `jobId`
was interpolated into the object key and could escape its prefix via `/`.

Grandfather clause on the four edit-paths that echo a stored ref back, so a row
written before this policy can still be re-saved.

**Deferred (reported, not fixed):** `/api/upload`'s generic branch still lets
any signed-in user presign a PUT under any prefix in any bucket (write
pollution, not disclosure — the UUID in every key prevents overwrite);
`/papic/media/[...key]` streams any `setnayan-media` key unauthenticated (that
bucket is public-by-design via `R2_PUBLIC_URL`, so no confidentiality delta);
`editorial-vendor/` is a flat untenanted prefix so its policy is containment,
not ownership.

Tests: 22 new cases in `lib/r2-client-ref.test.ts`. **Mutation-checked** —
deleting the two tenancy checks fails 11 of the 22, so the suite is not vacuous.

SPEC IMPACT: None. No schema, pricing, SKU or product-surface change — this is
an authorization fix behind existing flows.
