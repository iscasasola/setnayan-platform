## 2026-09-22 · fix(event-hub): the coordinator's announcement follows the reader

`DayOfAnnouncement` had exactly one mount — inside `_components/site-body.tsx`,
which exactly one page renders (`[slug]/page.tsx`). The guest tree has **twelve**
pages: `/`, `/avatar`, `/find-my-table`, `/find-seat`, `/hub`, `/invite`,
`/pabuya`, `/print`, `/recap`, `/seat`, `/venue`, `/welcome`.

So a guest reading their seat card, the floor plan, the gallery or the recap when
the coordinator sent "phones down, the ceremony is starting" saw **nothing** — and
the coordinator had no way to know, because from their side the message was sent.
The component's own docblock already condemned this: it is deliberately not
dismissible because "an announcement a guest can swipe away is worse than none,
since the coordinator has no way to know it was dismissed." A message that never
renders is the same failure with a quieter cause.

- The mount moves to `[slug]/layout.tsx`, the only node that wraps all twelve, and
  is `sticky` so it follows the reader down a long page.
- **The guests-only ruling is preserved, and it is the reason this is not a
  one-liner.** In `site-body.tsx` the gate was STRUCTURAL: the mount sat inside the
  guest tree, so an anonymous visitor could not reach it. A layout wraps everyone,
  so the gate is now asked for explicitly — `readGuestSession()` plus
  `session?.event_id === event.event_id`, so one wedding's guest cannot read
  another couple's announcements.
- `day-of-announcement.test.ts` is **re-anchored, not weakened**: it now reads the
  layout and asserts the session read, the this-event comparison, that the gate
  precedes the render, that a non-guest gets `null` (not CSS-hidden), and that the
  old mount was not left behind. Proven by sabotage — removing the gate and
  re-adding the site-body mount each turn it red.
- Costs no extra reads: `loadEventShell` and `loadDayOfBroadcast` are both
  `cache()`-wrapped, so the landing page still makes one `events` read and one
  `coordinator_broadcasts` read.
- `page.tsx` no longer loads or passes `dayOfBroadcast`, and the prop is gone from
  `SiteBody`.

SPEC IMPACT: None. The announcement's rules are unchanged — live window only, one
message not a feed, not dismissible, guests only. Only its reach changed.
