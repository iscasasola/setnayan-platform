## 2026-11-19 · feat(plans): event plan re-cut part 2 — Pro themes and the Cinematic Reveal openings on Event Plus; Pro 3,000 credits + 6 months; Ultra 6,000

Owner rulings 34 · 36 · 38 (specs `PLAN_RULINGS_2026-11-18.md`). SKU codes and display names unchanged; no price written.

- **Gate 13 (a ready-made Pro theme) and gate 1 (a Cinematic Reveal opening) pass on Event Plus** — and nothing else of the
  Style or Reveal part. `HUB_PRO_GATES` marks them `plan: 'plus'`; `HUB_PLAN_GATES`, `ownsHubGate` and
  `HUB_EVENT_COLUMN_GATE` (lib/hub-parts.ts) are the one rule. `eventHubOwnership` fills `HubOwnership.gates` from Event
  Plus (any path: order, basket, comp, supplier gift) and the openings' own unlock. Consumers moved onto the one helper:
  `resolveHubTheme`, `coverOwnershipFrom`, the details page, the invite share panel, the Maker theme picker, the Maker's
  ✓ Apply (`planHubDraftApply`), its change lines and effects, the toolbar after a save (`hubSummaryFor`, hub-draft-bar),
  `eventStdOpeningsActive` / `eventOwnsStdOpenings`, and the editor page's Reveal panel ◆.
- `SKU_OWNERSHIP_ALIASES.STD_PREMIUM_OPENINGS` gains `EVENT_PLUS`.
- Migration `20271350979842_event_plans_recut_part2_credits_and_keep.sql` (data only): Event Pro
  `included_papic_credits` 3,000 and `fullres_extra_keep_days` 92 (≈ 6 months); Event Ultra 6,000. Three stale
  descriptions fixed (Pro's "The cinematic reveal comes only with this", Ultra's typed "3,500 Papic credits", Plus's
  "Setnayan AI"), each only when the stored text is exactly the stale one.
- Copy: Event Plus now lists the ready-made Pro themes and a cinematic Save the Date (/features, /pricing, front door,
  llms.txt, help).
- Not built (owner/HARD STOP): the 11 Hub parts + Editorial moving to Event Ultra, the cap aimed at Ultra's price, and
  "Unlock Ultra and Apply" — see the PR's STATUS.

SPEC IMPACT: None in this PR — the rulings already live in the specs repo (`PLAN_RULINGS_2026-11-18.md` 34 · 36 · 38).
