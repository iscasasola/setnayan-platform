## 2026-07-08 · fix(plan3d): collision pass — the crowd finally sits, solid entrance + booth staff

Owner report: "characters and elements still collide." Three residual classes found and fixed:

- **The ambient crowd stood THROUGH its chairs** on the demo scene (a slice-1 comment promised a "room-wide seated default" that never flipped). GuestToken now renders every seated guest in the sit pose, matching the lab's SeatedAvatar; the per-guest seatedIds ledger became unnecessary and was removed.
- **The entrance doorway frame had no obstacle discs** — the roam step-in could leave the walker standing through a post. Both posts now register r 0.2 discs (the 1.1 m doorway gap stays a legal walk channel); dedicated unit test added.
- **Booth staff outside their chassis footprint were walkable-through** (e.g. the buffet's two servers). `templateBoothObstacles` now emits one r 0.3 disc per rendered staff anchor.

SPEC IMPACT: 0008_seating_chart_editor/0008_3DPlan_Fable_Design_2026-07-08.md (collision addendum)
