# Shots · supplier onboarding — shared screens + Door B (390 × 844, @2x)

Taken from `/dev/open-shop-lab` on `next dev` with the dummy lab env (no database; nobody real). `b-now-*` is
`origin/main`'s 5-step wizard; `b-proposed-*` is this branch.

| Now (origin/main) | Proposed |
|---|---|
| b-now-1-name · b-now-2-what-you-do | b-proposed-1-open-your-shop — name + main service on ONE screen (PB1) |
| b-now-5-account (last) | b-proposed-2-account — Create account, SECOND |
| b-now-2 (events page) · b-now-3-where · b-now-4-about-you | b-proposed-3-check-your-shop — one list; 3b / 3c a fact opens in place under its line (the map pin stays) |
| — (no card) | b-proposed-4-first-card · 4b Approve with no price is refused under the box |
| — (plan on Continue) | b-proposed-5-all-set — the plan on the last screen, Open my shop |

Not shot: Today's welcome (`?opened=1` / `?claimed=1`) — Today needs a signed-in database, which the dummy env lacks.
Door A's shots are in its PR (#8030), Door C's in #8031.
