# Walk round 1 — 390 px, before (left) beside after (right)

Shot on `next dev` with the dummy lab env (the live site is not reachable from the build container), on the
repo's own dev labs that mount the REAL screens: `/dev/open-shop-lab` and `/dev/supplier-lab`.
"Before" = origin/main 0d2b9718 (live 0dc2f67 + a schema snapshot); "after" = this branch.

| file | finding | screen |
|---|---|---|
| F-W1-03.png | 2 categories → 1 category | `/dev/supplier-lab?s=details&who=studio` › What you do |
| F-W1-04.png | Continue: before, nothing drawn on the press; after, pressed + spinner (the step change held to photograph the first frame) | `/dev/open-shop-lab?step=1` |
| F-W1-06.png | Celebration → Other events | `/dev/open-shop-lab?step=2` › Events you serve |
| F-W1-07.png | hint clears the map credit | `/dev/open-shop-lab?step=3` |
| F-W1-08.png | logo screen in the wizard shell | `/dev/open-shop-lab?screen=logo&framed=1` |
| F-W1-11.png | Get verified points to the papers instead of asking again | `/dev/supplier-lab?easy=setup&docs=none` |
| F-W1-12.png | signed-in "Your account" line + full stop | `/dev/open-shop-lab?step=5&guest=0` |

No shot: F-W1-02 / F-W1-13 / F-W1-10 are behaviour (an account change; a sheet across page loads) — held by
`app/open-shop/the-walk-round-1.test.ts`. F-W1-05 changed nothing.
