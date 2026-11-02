## 2026-07-02 · feat(vendor-dashboard): My Shop interaction rework — inline panels + animated QR card (PR1)

Recompose `/vendor-dashboard/shop` to the owner-approved interaction model
(2026-07): the surface now acts on itself instead of being a link farm.

- **Only Profile navigates.** Website / Team / Branch expand their function
  INLINE below the Manage grid via a new shared `Collapsible` primitive
  (`shop/_components/collapsible.tsx`) — Web Animations API height easing, one
  panel open at a time, honors `prefers-reduced-motion`.
- **QR row card** (`shop/_components/qr-card.tsx`): one card, a `Shortlist ↔
  Locked` segmented toggle, both modes render a real QR; switching animates the
  resize through the same `Collapsible`. Shortlist is fully inline (QR + scope
  filters + copy + SVG download); Locked embeds the existing `LockedQrGenerator`.
- **Hero** gains an inline copy-link (`CopyButton`) on the public `/v/` URL.
- **Metrics** ("How you're doing") are now a read-only pulse — each of the 6
  numbers appears exactly once (the old top-strip duplicates of Stories /
  Reviews / Saved are gone); detail pages remain reachable from the sidebar.
- **Team invite** (`team/actions.ts`) takes an optional `returnTo=shop` so the
  inline panel stays on My Shop instead of bouncing to the Team page (a local
  `err` shadow keeps every early-return on the same destination).

Every number stays LIVE (owner rule — never fabricate); the loader is fail-soft
and now also enriches the team with names via the admin client. Branch-add stays
on its own page — it's a payment flow with its own reference/confirmation.

SPEC IMPACT: Vendor dashboard § My Shop — behavior change (inline-first; no
link-outs except Profile; QR consolidated to one toggled row). Logged at the
bottom of the corpus `DECISION_LOG.md` (2026-07-02). Follow-ups queued: PR2
Locked-QR enrichment (schema `service_description` + `event_date`, leaf-service
picker, "what the couple availed" description, agreed wedding date); PR3 claim
date-resolution (finalize-on-match / confirm-on-mismatch + shortlist
compatibility warning); PR4 QR fast-lane onboarding bypass (scan → minimal auth
→ QR-seeded event, skip persona quiz + event-type step); PR5 leaf-level service
scoping end-to-end.
