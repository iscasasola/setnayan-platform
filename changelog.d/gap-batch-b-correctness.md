## 2026-07-24 · fix: audit Batch B correctness gaps (email joins, dead links, points)

Gap audit 2026-07-23 · Batch B (B1/B5/B6). Six verified live/latent bugs:

**B1 — email silent-non-send (wrong join column: users.id is BIGSERIAL, the
auth UUID is users.user_id):**
- `daily-email-jobs.ts` — the mandatory 14-day "we're about to compress your
  full-res originals" warning joined on `.eq('id', <uuid>)` → 0 rows → never
  sent. (The drop sweep already fail-closes no-Drive-unwarned events, so this
  held originals rather than deleting them — storage, not data-loss.)
- `patiktok-reel-emails.ts` — "your reel is ready" email, same wrong join.
- `daily-email-jobs.ts` renewal reminder — `sendEmail` RETURNS `{ok:false}`
  (never throws), but the code kept the idempotency lock and counted it sent,
  permanently suppressing the reminder. Now releases the lock on failure to retry.

**B5 — dead links:**
- Day-of Video Guestbook "Manage" → `/gallery` (404) → `/galleries` (the worst
  possible moment: on the wedding day).
- Paperwork empty-state "Set wedding date" → `/settings` (never existed) →
  `/date-selection` (the canonical date-set route, per 6 other call sites).

**B6 — capture-points leaks (money logic):**
- `papic/actions.ts` — points reserved before the `papic_photos` insert were
  never released when the insert failed → couple charged for a photo that never
  landed. Now released on insert abort (mirrors the refusal unwind).
- `vendor-papic-grants.ts` — the vendor points-spent meter FAILED OPEN (a read
  error returned 0 spent → full fresh budget). Now fails closed (assume-exhausted
  → blocked), per the module's own "must never open on error" invariant.

Deferred (need more care / a page build): B5 vendor `/vendors/[vendorId]`
routing (service-scoped, 3 emitters) + Live-Studio `cameras/print` page; B2
sweeps; B3 llms.txt; B4 help/privacy copy (some DPO-gated).

SPEC IMPACT: None — correctness fixes to shipped behavior.
