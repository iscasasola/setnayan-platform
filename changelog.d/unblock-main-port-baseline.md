## 2026-08-06 · fix(ci): unblock main — regenerate the port-control baseline

**main was RED and every open PR was blocked behind it.** The `lint port keeps every control` guard
failed on `a0fde579`, and because PR #4167 had just made that guard *blocking*, nothing could merge.

**The guard was right, and the change it flagged was right too.** PR #4172 repointed two admin links
from `/admin/vendors/<id>` to `/admin/vendors/<id>/edit`. Verified: the old path has **no
`page.tsx`** — those links 404'd — and `[vendorProfileId]/edit/page.tsx` exists. A real fix. It
simply did not regenerate the baseline, which is the one step that records a removal as reviewed.

That is the guard behaving exactly as designed: a changed destination is not assumed to be a
mistake, it is put in a diff as one readable line and someone has to look. So I looked.

**Every line of the diff traces to a merged PR — nothing unexplained:**

| change | from |
|---|---|
| `/admin/vendors/[seg]` → `/admin/vendors/[seg]/edit` ×2 | #4172, fixes a 404 |
| `[slug]/…/gallery-anchor.ts` + `/wall/[seg]` | #4168, the Gallery tab returning after the day |
| `releaseAction` | #4164, the couple's "Take this seat back" |
| `/api/oauth/youtube/start` + `/privacy` on a route that previously had **zero** destinations | #4170, the Google-disconnect control rehomed |
| `dashboard/[eventId]/studio/panood/reviews` removed | #4170, the retired Cast page |

Counts move 404→403 routes, 677→679 destinations, 513→514 actions — consistent with one route
deleted and two controls added.

🔑 **Worth keeping:** the fourth row is the guard earning its place twice over. That route's
destinations were `[]` before, so the only host-facing Google-disconnect control in the product was
invisible to the check that exists to protect controls. It is recorded now, so losing it again
turns CI red.

⚠ **This is the cost of making a guard blocking**, and it is the right cost: the guard had been
running and being ignored for long enough that the baseline had drifted across four PRs. The first
red was not a false alarm — it was the backlog arriving all at once.

SPEC IMPACT: None — a generated baseline refresh.
