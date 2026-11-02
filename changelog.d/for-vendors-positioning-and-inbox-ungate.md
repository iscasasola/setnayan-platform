## 2026-07-24 · feat(marketing): new /for-vendors positioning + ungate the vendor inbox

Two related changes, grounded on `Vendor_Value_Proposition_2026-07-24.md` (spec
corpus) and its as-built SSOT `apps/web/VENDOR_TIERS_AND_BENEFITS.md §6`.

**1 · `/for-vendors` (= `/vendors`) copy reconciliation.** Retired the
"0% commission, always / forever" claim in favour of the honest two-phase line:
**free to join · 0% commission while we launch · first 5 Setnayan-sourced
bookings on us · then a flat 5%, only on couples Setnayan brings you · your own
and repeat clients always free.** Applied across the thesis strip, the
"fair by design" section, Get-Paid, the closing CTA footnote, the hero subhead,
the tier-matrix footnote, page `<metadata>` + JSON-LD, and the shared
`vendor-benefits.ts` matrix row (`0% commission, forever` → `0% commission at
launch`; this row also renders on the home page). Removed forbidden claims:
the "Booster subscriptions"/"boosts" reach card + the hero's "extra reach you
choose" (no boost/promote/sponsored-placement SKU exists — merit-only ranking is
owner-locked), and softened an anti-fraud line that over-implied a live
fraud-hunting engine (the reverse-image / device-fingerprint stack is flag-dark)
down to the real merit-only lock + ban policy. Added two genuinely-live,
greenlit features to the Tools grid: **fixed / per-guest / per-hour service
pricing** (never called "tiered") and **in-app video & audio calls** (peer-to-
peer, never recorded). No dark-flag feature (verified-median, Booth Studio,
Photo Challenge, chatbot, negotiation cards, the fee rail itself) is presented
as live. Front-end copy only — no checkout / entitlement / schema change.

**2 · Ungate the vendor inbox (live behaviour change).** "Your inbox is never
locked" is now true: every vendor — free, verified, or paid — can receive AND
answer couple inquiries with no tier wall and no weekly cap. `acceptInquiry`
(`lib/chat-actions.ts`) now routes **unconditionally** to the existing
no-tier-gate RPC `unlock_vendor_event_free` (drops the `TIER_FREE_NO_INAPP` +
`VERIFIED_WEEKLY_LIMIT` raises, keeps FORBIDDEN ownership + idempotency + 0-token
unlock); removed the launch flag `freeInquiryAcceptEnabled` (+ its module) that
gated this. Removed the mirrored FREE-tier messaging gate
(`tierCaps(...).chat === 'none'` → `tier_free`) from `lib/chat-send.ts` and
`lib/proposal-send.ts`. **Anti-spam preserved:** the couple-side inquiry velocity
caps + Turnstile (`lib/inquiry-gate.ts`, `app/v/[slug]/inquiry-actions.ts`) are
untouched — ungating the vendor's answer path adds no inbound volume. New
static-scan test in `lib/free-inquiry-answer.test.ts` locks all of this in
(ungated RPC, unconditional routing, no send/proposal tier block, spam caps
still present). The gated `unlock_vendor_event` RPC is left intact (referenced
only by history); the dead `tier_free` error-map entries in the API routes are
harmless and left for a follow-up cleanup.

SPEC IMPACT: Implements `Vendor_Value_Proposition_2026-07-24.md` (fee reprice =
DECISION_LOG 2026-07-24; inbox-ungate = doc §4 recommendation). The inbox-ungate
is a PROPOSED live behaviour change pending owner sign-off (DRAFT PR) — not yet
an owner-locked decision, so no DECISION_LOG row is written until confirmed.
Reconciles the retired "0% commission forever" public copy on `/vendors` (and
the shared home-page matrix row).
