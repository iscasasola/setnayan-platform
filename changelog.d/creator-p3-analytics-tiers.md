## 2026-07-17 · feat(creator): vendor ROI + admin influencer analytics + tier bands (P3, volume-gated)

The three deferred, usage-gated P3 creator-economy analytics surfaces, all
rendering clean/nothing below their volume gate so they ship dark and
self-activate on real usage.

- **Vendor per-creator ROI** on `/vendor-dashboard/creators` — a "Your collab
  ROI" table: per collab'd creator, the creator's public **inquiries driven**
  (reused `fetchInquiriesDrivenForCreators`, guards untouched), the **reach
  tokens** this vendor debited reaching them (`token_redemptions_log`,
  `spend_source='creator_offer'`, keyed by `offer_id` in metadata), and the
  collab status. Ledger facts only — NO "discount given" column (settles
  off-platform → unknowable). Renders only after the vendor's first offer.
- **Admin influencer analytics** — a read-only platform aggregate folded into the
  existing `/admin/studio?tab=storytellers` surface (keeps admin footprint to the
  two surfaces the verdict prescribes). Gated: a plain "not enough activity yet"
  state with progress until ≥25 attributed unlocked inquiries platform-wide;
  above the gate, influencer token spend split reach vs lead-unlock, top
  storytellers by inquiries driven, vendor participation. Service-role aggregate;
  never names who booked.
- **Creator tier bands** — pure `tierForInquiriesDriven(n)` helper (Nano 1–9 ·
  Micro 10–49 · Macro 50–149 · Mega 150+ · 0 = no tier). New `CreatorTierChip`
  (ink-toned, distinct from the gold Storyteller `CreatorBadge`) rendered next to
  the "inquiries driven" line on `/u` and the vendor Creators browse cards + ROI
  table. A rendering of the existing number, not a second metric — hides at 0.

New: `lib/creator-tiers.ts`, `app/_components/creator-tier-chip.tsx`,
`lib/creator-analytics.ts` (`fetchVendorCreatorRoi` + `fetchInfluencerAnalyticsForAdmin`).
No new migration — pure reads over the P1/PR-C spend-tag + attribution columns;
reuses the existing `token_redemptions_log_spend_source_idx`.

SPEC IMPACT: Aligns with `Creator_Economy_Simplest_Approach_Council_Verdict_2026-07-16.md`
§2 items 1 (tier bands as a rendering of the raw count, owner-gated), 8 (P3
analytics behind the ≥25-attributed-unlock gate), 9 (admin analytics as a
read-only aggregate on an existing surface). Tier ladder per
`Creator_Economy_Discount_Collab_Build_Plan_2026-07-16.md` § "Creator tiers".
DECISION_LOG.md row added in the corpus.
