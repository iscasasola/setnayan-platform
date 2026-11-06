## 2026-11-06 · feat(shop): the one badge tracker lives in Analytics › Your badges; Page keeps the pills

Owner, 6 Nov: *"Use fable to decide. Find the best location for each. Make the pages live there and not jump to
another menu."* — DECISION_LOG 2026-11-06 "ONE HOME FOR EVERY PROMOTE TOOL": **Analytics › Your badges** = the one
badge tracker; Page keeps the badge pills only.

- RULE 0: both halves existed — the tracker (`website/_components/badge-tracker.tsx`, owner 2026-10-28) inside Shop ›
  Page's "Awards and badges" fold, and Analytics' `YourBadges` (pills + next step, owner 2026-10-29). Delta: the
  tracker's rows (circle · line · bar · ladder · the action that moves it · state chip) and its Save to print move
  into `performance/_components/your-badges.tsx`; `badge-tracker.tsx` is deleted.
- Analytics reads `readShopTrackerFacts` (badge facts + couples not yet asked for a review) once, in the same batch
  as before, and draws `badgeTracker(facts)`; a refused read draws no rows and says "Couldn’t load", never "none".
  The upsell (gated tiers) shows the tracker too.
- Shop › Page's fold keeps the pills couples see and its summary line; `page-data.ts` now reads `readShopBadgeFacts`
  (no unreviewed count — that was the tracker's).
- Labs: `?s=coord-badges` draws the tracker; the page lab draws pills only.
- Port baseline regenerated (the tracker's controls left `/vendor-dashboard/website` on purpose); the raw-hex
  baseline entry moved with the file (3 → 3). `lib/ugat/screens.generated.json` regenerated (it was already stale on
  the base branch for `/vendor-dashboard/shop/promote`).
- Not in this slice: "rewards given · next badge + reward" on each row — those rows come with badge rewards (#7298,
  a migration, not merged).

SPEC IMPACT: None — implements DECISION_LOG 2026-11-06 "ONE HOME FOR EVERY PROMOTE TOOL" (badges row); no corpus edit.
