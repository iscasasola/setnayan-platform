## 2026-07-03 · feat(marketing): hero prices → "See how much it helps" button; the pop-up comparator is the destination

Owner 2026-07-03: "instead of showing these prices, we would have a button instead — See how much
it helps to have Setnayan AI." The Suri hero now shows NO prices: the jobs + restraint line + ONE
glass button that opens the INTERACTIVE COMPARATOR POP-UP (reviving the #2665 overlay that went
dormant when the nav item was removed — this button is its new entry point).

The pop-up's math is synced to the house cycle (owner: "1 year is 13-28 days"): slider 1–26 with
"· 1 year"/"· 2 years" notes at 13/26, default 13; the per-calendar-month alternatives (team
₱50k/mo · apps ₱2,900/mo · DIY 25–50 hrs/mo) prorated to the 28-day window (× 28⁄30) so they're
never overstated; "a month = 28 days" on the track. Verified live: hero price-free, button opens
the pop-up, default reads "13 months · 1 year · you save ₱596,580."

Supersedes (same PR): the in-hero static bars + slider + savings line from the earlier commits.

SPEC IMPACT: None new — final shape of the 2026-07-03 hero/comparator decisions.
