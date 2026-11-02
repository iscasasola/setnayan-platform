# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-13 · feat(vendor): settle-on-view — a couple opening a quote settles the held lead-token

Implements §2.1 of `Vendor_Token_Settlement_and_Lifecycle_2026-07-13.md` (corpus): a couple **opening a delivered quotation is value consumed**, so it settles the vendor's held lead-token — reply or not, off-app comparison or not. Closes the free-quote-extraction hole (take the price, comparison-shop, ghost, cost the vendor nothing). Extends the existing hold model; **rides the same `NEXT_PUBLIC_LEAD_TOKEN_HOLD_ENABLED` flag** (settle-on-view only matters when holds exist) — **default OFF, so live behavior is byte-identical** until the owner flips the hold model on.

- **Migration `20270806244623_proposal_viewed_settle_on_view.sql`** — adds `vendor_proposals.viewed_at`, and `mark_proposal_viewed(public_id, viewer_user_id)`: a SECURITY DEFINER, service-role transition `sent → viewed` gated to a **customer-side** member of the event (`member_type IN ('couple','coordinator')` — never the vendor previewing their own quote). Idempotent (only `sent → viewed`); returns `{transitioned, vendor_profile_id, event_id}`. The `'viewed'` status already existed in the enum since `20261208006000` but nothing ever set it — this is the emit.
- **`lib/lead-token-holds.ts`** — new `markProposalViewedAndSettle(publicId, viewerUserId)`: on the admin client (so it runs from `after()` off the request path), calls `mark_proposal_viewed`; if it actually transitioned **and** `leadTokenHoldEnabled()`, consumes the outstanding hold via the existing `consume_lead_token_hold_for(..., 'proposal_viewed')`. Marking always runs (legit status); only the token consume is flag-gated, mirroring settle-on-reply's app-side gate. Best-effort, idempotent, never throws.
- **`app/proposals/[publicId]/page.tsx`** — when the customer side opens a still-`sent` proposal, `after(() => markProposalViewedAndSettle(...))`. No-op for the vendor's own preview or an already-viewed proposal.

No new flag. No behavior change while the hold flag is off (no holds exist to consume; the only visible effect is a proposal flipping to "Viewed" for the vendor, which is a correct, already-modeled status).

SPEC IMPACT: implements a spec already in the corpus (`Vendor_Token_Settlement_and_Lifecycle_2026-07-13.md` §2.1); no new product surface, pricing, or branding. The broader settlement deltas (prior-events trust signal, cold-vs-fake sweep policy, deletion reconciliation) are separate follow-ups per that spec's §10.
