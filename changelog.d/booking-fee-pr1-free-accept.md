## 2026-07-23 · feat(vendor): Booking Fee PR-1 — free inquiry-answer (flag-dark)

Removes the free-vendor inbox wall (`Booking_Fee_Build_Plan §PR-1`). Today a
FREE-tier vendor can't accept an in-app inquiry at all (`TIER_FREE_NO_INAPP`) and a
verified vendor is capped at 10/rolling-week (`VERIFIED_WEEKLY_LIMIT`) — a real
couple can sit in silence. The Booking Fee replaces that wall with "free unlimited
inquiries, pay only to send a proposal." This opens the accept path, flag-dark.

- **Migration `20270917330128`** — `unlock_vendor_event_free`, a VERBATIM copy of
  the live `unlock_vendor_event` with EXACTLY the two tier RAISEs removed
  (`TIER_FREE_NO_INAPP` + `VERIFIED_WEEKLY_LIMIT`). Every other gate/invariant kept
  identically (FORBIDDEN, idempotency, founder comp, the 0-token unlock row).
- **`lib/free-inquiry-accept.ts`** — `freeInquiryAcceptEnabled()` (default off).
- **`lib/chat-actions.ts`** — `acceptInquiry` routes to the free variant only when
  the flag is on; free-answer wins over the dormant HOLD path.

⚠ **The live `unlock_vendor_event` is untouched** — so the default (flag-off) accept
path for every vendor is provably byte-identical to today. Flipping the flag on
begins the "free-for-all window" (build plan §6 #7) — a deliberate owner launch
call, not a silent default. `tsc` clean; migration doctor healthy.

SPEC IMPACT: None new (implements §PR-1). DECISION_LOG 2026-07-23.
