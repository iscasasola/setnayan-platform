## 2026-10-12 · release: Event Hub batch 2 — wish list + three fixes

One release branch on today's main carrying seven drafts, each merged as it was (their own fragments come with them):
#6435 Studio › Wish list · #6440 the guest's wish list + send sheet · #6444 "I sent it" · #6463 "Gifts sent to you" ·
#6464 the Reveal panel's default opening · #6467 the guests' Story keeps the schedule's audience fence · #6445 a reload
returns the Maker to the same place.

- **Refit to today's main.** The wish list's one write now reaches the page through `useStudioActions()` (main's lab-safe
  seam, 2026-10-09) instead of importing `saveEgiftMethod` directly — so a press in the details lab meets the lab's
  stand-in and never the database; production still gets the shipped action. The Studio door's wish-list part sits
  beside main's Prints parts; the gift page keeps main's `guestRead` boundary and adds `style_preferences` to its one
  event read; the Welcome gift doors keep main's `giftsBlockMark` and gain `giftWishes`.
- No migration (the two tables are #6432's, already on main). +0 server actions, +0 routes.
- Generated baselines regenerated on the joined tree (port-control, Ugat screens).

SPEC IMPACT: None beyond the members' own (each fragment says its own).
