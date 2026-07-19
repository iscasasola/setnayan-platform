## 2026-07-01 · feat(vendor-benefits): hybrid tier gating — re-tag the homepage overlay

Reconciled the full §2 vendor-benefits catalog (~93 benefits, not the 60-dedup)
against the §6 as-built audit and confirmed the headline: the paid tiers barely
gate anything — most Solo/Pro benefits are built but sit at `verified`, so a free
vendor already gets them. Owner picked HYBRID (gate the premium few, keep the ops
spine free). The homepage "For vendors" overlay is re-tagged to match so the
ladder finally reads Free → Solo → Pro on the surface couples/vendors see:

- `app/_components/home/vendor-benefits.ts` — 6 benefits move off Free:
  **Reverse-Image Theft Watch + Demand Radar → Pro** (premium market intel),
  **Quote-to-Booking Funnel, Won & Lost Reasons, Peso-Per-Lead Scorecard,
  Your Own Funnel Metrics → Solo** (your-own-performance analytics/trends). Now
  44 Free · 4 Solo · 12 Pro. Ops spine (dashboard, calendar, proposals, contracts,
  CRM, earnings, pipeline, payments, discovery, trust) stays Free. Docstring notes
  the hybrid rule + points at the SSOT doc.
- `app/_components/home/HomeOverlays.tsx` — legend rewritten to the hybrid story
  (Free ops spine · Solo adds analytics + unlimited answering + day-1 name · Pro
  adds team/reach/premium intel/editorial · Enterprise lifts caps); live-count
  banner corrected 41 → 42 (theft-watch shipped live in #2489).
- `VENDOR_TIERS_AND_BENEFITS.md` §5 — appended the dated hybrid decision + the
  **code-owed gate list** for the dashboard session (gate Demand Radar +
  theft-watch + benchmarks to Pro; funnel time-series to Solo; scope boost/
  boosters/token-packs to plan; split the Bid Button; pull the unbuilt file-share
  copy; align portfolio caps). Explicitly locks the free ops spine as do-NOT-gate.

No feature code is gated in this PR — the overlay is presentation; the actual
entitlement gating is dashboard-session work per the two-session protocol (the
doc is the seam).

SPEC IMPACT: In-repo SSOT `apps/web/VENDOR_TIERS_AND_BENEFITS.md` updated (§5
handoff). Corpus decision-log row warranted for the hybrid gating decision
(added separately via authorized corpus direct-edit). No DB schema/SKU/price
change in this PR.
