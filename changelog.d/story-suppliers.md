## 2026-11-13 · feat(post-event): the story lists every supplier by plan — rich card, one scene per Supplier Ultra, album share

Owner rulings 13 Nov 2026 (specs DECISION_LOG "every booked supplier is tappable", "order by supplier plan",
"story with many suppliers", "Supplier Ultra scenes", "Supplier Ultra shares its album", "album share — default"),
drawn in `prototypes/approved_2026-11-13/story-suppliers-fable.html` v6 and approved "yes to all".

- `lib/story-suppliers.ts` (pure, tested): the order Ultra → Pro → Plus → Verified → Free → added by the couple; top 8
  + "See all N"; the full sheet grouped by plan with counts (Free folded); search over 20; at most 3 tags a moment;
  the tap — rich card (Supplier Pro / Ultra), the shop (Plus / Verified / Free), or a plain name (no shop).

SPEC IMPACT: None — builds the approved 13 Nov rows as drawn.
