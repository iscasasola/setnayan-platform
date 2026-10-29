## 2026-10-29 · fix(groups): ‹ from a group returns in place

Owner, live in the iPhone app: *"back from a group. it returns but not from the previous screen where we were on people
and scrolled down to groups. it returned to people with just the groups."* The group page's ‹ was a plain link to People
› Groups (`/dashboard/people?view=samahan`), so a person who scrolled the People list down to Groups and opened one was
thrown onto the Groups-only view, at the top.

- The group's ‹ (and a one-tap view's ‹ to its group) is now `GroupBack`
  (`samahan/[communityId]/_components/group-back.tsx`), wrapped in the chat's `ReturnInPlace` — one mechanism, not two:
  opened from a list in the app → the browser's back, the same screen, view and scroll; a deep link, a push
  notification, a fresh open → the link, the map's home (`lib/page-home.ts`, People › Groups). Leave is unchanged
  (People › Groups + "You left the group.").
- People (every view) and Notifications mount `ChatOriginMark`.
- `ChatOriginMark` now belongs to ONE document (`performance.timeOrigin`), and the page a document landed on never
  goes back — so a push notification (`location.assign`) or a reload falls back to the home instead of leaving the app.
  The chat ‹ gets the same tightening.
- Labs: `/dev/people-lab` group rows open `/dev/group-lab?g=<id>`, which draws the real `GroupBack`.
- Guard: `lib/groups-return-to-people.test.ts` re-aimed (tests 4–6), sabotaged three ways.

SPEC IMPACT: None — implements the owner's report; the back map (`lib/page-home.ts`) is unchanged.
