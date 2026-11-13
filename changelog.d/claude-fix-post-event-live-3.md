## 2026-11-13 · fix(post-event): the re-walk of /rosa-ben/recap after #7628 (F-W2-48 · 49 · 52 · 53)

The controller's 390 px re-walk of the live story after #7628 found four rows only partly fixed.

- **F-W2-48 · the road still ended on an empty "0 · THE DAY" step.** That last stop is no longer drawn; the road
  ends on its last real step (`post-event-scene-views-3.tsx`).
- **F-W2-49 · the photo count disagreed.** Captures correctly said nothing was shot on the day (the 7 photos are
  dated 26 Oct, the day is 30 Oct), while the cover ("7 photos"), By the numbers, Memory lane and "Powered by
  Setnayan · 7 photos captured live" all counted 7. `metrics.photos` is now the ONE day-window count
  (`galleryDayTotal`) wherever the event has a date, so every figure that reads it agrees; Memory lane's tiles are
  kept to the same window (`capturedOnTheDay`).
- **F-W2-52 · a bare "thank you" under The Team.** The credits roll's script sign-off from nobody is gone; the
  couple's own thanks is the Thank You scene.
- **F-W2-53 · the page went on after the story.** A stranger's page and the host's own now END at the story: no
  "No program was published…", no "You're the host — You don't need an invitation…", none of the pre-day body.
  Two things deliberately stay: the stranger's DOOR (a guest on a new phone needs it to reach their own photos
  after the day) and the after-day "Were you a guest? Claim your photos" card. A GUEST's page keeps its body under
  the story, because that is where their "Photos of you" and "Your shots" live and the story does not carry them.
- Recorded stage pages: only the three stranger Post Event pages moved (re-recorded with `UPDATE_GOLDEN=1` after
  a dump diff against `origin/main`).
- Guard: `lib/the-post-event-walk-is-fixed.test.ts` (four new blocks; three proven red on their own regression).

**Not changed, on purpose:** "See you soon." (the Closing). It is its own Maker scene with the couple's words
(owner 2026-10-17, DECISION_LOG "THE CLOSING ('SEE YOU SOON') IS ITS OWN SCENE IN THE MAKER" and "THE CLOSING
TAKES THE COUPLE'S WORDS AND STYLE"), and it ends every page of all four stages, so removing it from Post Event is
an owner call. The Camera tab's accent colour after the day is the shipped bar rule (`site-menu-bar.tsx`: "the
camera keeps its own chrome — the CTA colour… because the design makes it the destination"), so it is unchanged.

SPEC IMPACT: None — each fix follows "POST EVENT = A STORY (ONE SCENE PER SCREEN) — SIX CALLS SETTLED" and
"NEVER AN EMPTY SCENE".
