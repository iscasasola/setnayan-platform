## 2026-07-01 · feat(vendors): on-platform reverse-image repost detection (pHash)

Detect-and-flag-for-admin-review-only theft watch over vendor marketing imagery.
A vendor's newly-uploaded portfolio / service-cover image is perceptually hashed
server-side; if it matches an OLDER image owned by a DIFFERENT, non-demo vendor,
a flag lands in a new admin queue. It NEVER auto-blocks, auto-takes-down, or
auto-deletes — the founder-only pilot (~1 real vendor + a seeded demo set) makes
auto-punishment unsafe.

**Schema** (migration `20270330665855_vendor_image_repost_watch.sql`)

- `public.hamming_distance(a bigint, b bigint) RETURNS int` IMMUTABLE STRICT —
  popcount of the 64-bit XOR via `bit(64)` cast + set-bit count. Deliberately
  version-agnostic: NO PG14 `bit_count()` (prod PG version is unverified in-repo)
  and NO integer Brian-Kernighan loop (its `x & (x-1)` overflows for INT64_MIN,
  which a sign-bit-set pHash can legitimately be). The review's must-fix was that
  `bytea # bytea` is not valid Postgres; we store `phash BIGINT` and XOR bit
  strings instead.
- `vendor_image_hashes` (phash **BIGINT**, is_demo denormalized, unique on
  `(vendor_profile_id, r2_ref)`) + `vendor_image_flags` (admin review queue,
  `public_id` type letter **'N'** — 'W' is taken by ugc_moderation +
  vendor_spotlight_awards). RLS at CREATE TABLE time: admin-read on both,
  admin-update on flags. Writes go via the service-role admin client (RLS
  deny-by-default protects vendors; the real guard is "only the after() task +
  admin actions construct that client").
- `platform_settings.repost_watch_hamming_threshold INTEGER DEFAULT 10` —
  admin-managed match threshold (never hardcoded).

**Hashing** — `lib/perceptual-hash.ts` (64-bit DCT-II pHash via `sharp`, no new
dep) + `lib/vendor-image-repost-watch.ts` (fetch authoritative R2 bytes via
`presignDisplayUrl` + plain fetch for `r2://`; `safeFetchImageBytes` reserved for
legacy external http refs → hash → upsert → match → flag). Fired in a Next 15
`after()` task post-save in `commitVendorService` + `saveVendorProfile`
(cron-free), self-swallowing so it never breaks a vendor's save.

**Admin** — `/admin/repost-watch` queue (side-by-side image compare, Hamming
distance, both vendors' names + first-seen times; confirm-theft / escalate /
dismiss — verdict-only, no takedown) + a **Rescan all** backfill button
(in-scope and required: hashing otherwise only fires on new saves, so the static
vendor set is inert without it). Registered in the admin sidebar.

Unit test (`lib/perceptual-hash.test.ts`): a JPEG re-encode of the same image
stays ≤6 bits; distinct images stay >20 bits apart.

SPEC IMPACT: New tables `vendor_image_hashes` + `vendor_image_flags`, new
`public.hamming_distance` SQL fn, new `platform_settings.repost_watch_hamming_threshold`
column, new `/admin/repost-watch` surface (admin queue + sidebar nav). Flag-and-
review only — no auto-takedown/block/delete. Scope: vendor service cover photos +
portfolio galleries only (logos + couple-created event_manual_vendors excluded).
Only non-demo↔non-demo cross-vendor matches flag; self-matches excluded. RA 10173:
a pHash is a non-reversible 64-bit fingerprint of vendor-supplied MARKETING
imagery (not guest/face/event data); admin-read-only RLS mirrors the existing
user_reports queue; no new consent gate (legitimate-interest processing of
business data). (Corpus DECISION_LOG append deferred — this worktree is isolated
from the shared spec corpus and parallel sessions are editing it concurrently;
this fragment carries the full record.)
