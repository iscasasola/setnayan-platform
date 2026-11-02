## 2027-04-12 · feat(admin): review-fraud screener + ghost-listing detector

No fake reviews, no ghost listings — a deterministic integrity queue built ON
the shipped self-review gate, receipt-backed reviews, and the pHash repost-watch
substrate (no LLM anywhere).

- **Migration `20270412000042_review_fraud_and_ghost_listing.sql`** — one queue
  table `integrity_flags` (RLS admin-only read + update, mirroring
  `vendor_image_flags`; all writes via the service-role admin client). Holds two
  flag kinds with a CHECK-enforced shape + partial-unique dedup indexes:
  `review_fraud` (points at a suspected `vendor_reviews` row) and
  `ghost_listing` (points at a suspected `vendor_profiles` row). `public_id`
  uses the next-free type letter `Y`. `detail` JSONB is RA-10173-safe: only
  non-PII counts / booleans / component scores — no device hashes, IPs, review
  bodies, or names.
- **`lib/review-fraud-screener.ts`** — pure deterministic scorer
  (`scoreReviewFraud`) over three signals beyond the 5-signal self-review gate:
  velocity/burst (other reviews for the vendor in a 48h window), rating anomaly
  (distance from the vendor's established mean, min-N gated), and reviewer
  linkage (distinct OTHER reviewers of the same vendor sharing a `user_devices`
  fingerprint — a sockpuppet cluster). Fires in a Next `after()` task on review
  submit (NO cron), fail-soft, idempotent. `rescanAllReviewsForFraud` backfills.
- **`lib/ghost-listing-detector.ts`** — pure deterministic scorer
  (`scoreGhostListing`) over: no logo, no active services, never-answered
  (inbound couple messages with zero vendor replies), long dormancy, and
  duplicate business identity (normalized business_name / contact_email collision
  across distinct non-demo vendors). `scanForGhostListings` is an on-demand admin
  sweep (NO cron) of published, non-demo listings; auto-clears an open flag whose
  listing has recovered.
- **New admin surface `/admin/integrity-watch`** (page + actions) — two-tab
  (Reviews / Listings) queue with status filters, non-PII evidence chips, and
  per-rescan buttons. Actions: dismiss / confirm-fraud (review) / hide-listing
  (un-publishes a confirmed ghost — the ONLY action that touches a subject, always
  an explicit click). Every mutation logs to `admin_audit_log`. Detect-and-review
  only — a review flag never auto-deletes the review.
- **Wiring** — `submitCoupleReview` now captures the new review_id and screens it
  via `after()`; one Work-group nav entry ("Integrity watch", ShieldCheck) in
  `admin-sidebar.tsx`; a badge/count QUEUE_DEF + META entry in
  `lib/admin/queue-counts.ts`.

- **Unit tests** (`lib/review-fraud-screener.test.ts`, in the `test:unit` CI
  step) lock the scoring contract for both pure scorers. They caught + fixed two
  calibration bugs pre-merge: a single shared-device peer (the minimal 2-account
  sockpuppet ring) and a duplicate business identity now each flag on their own
  rather than needing a second signal.

Pure scorers live in `lib/review-fraud-scoring.ts` + `lib/ghost-listing-scoring.ts`
(NOT server-only, so the Node test runner imports them directly — mirrors the
perceptual-hash.ts / vendor-image-repost-watch.ts split); the server-only I/O
orchestration re-exports them.

Thresholds are first-pass module constants documented as owner-tunable (integrity
knobs, not prices — deliberately NOT in the admin price catalog).

SPEC IMPACT: None. Additive integrity tooling on the existing reviews +
marketplace + self-review-gate substrate; no pricing, SKU, or public-surface
change. (Owner follow-up: sign off on the default score thresholds after pilot
data; optionally lift them onto `platform_settings` for live tuning.)
