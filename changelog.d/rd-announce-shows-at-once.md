## 2026-09-28 · feat(announcements): a sent announcement shows to guests at once — before the day, on it, and down once the event is over

Owner ruling 2026-09-28 (DECISION_LOG "OWNER ANSWERS — ANNOUNCEMENTS, PRINT COLUMNS…", item 1):
*"an announcement shows to guests as soon as it is sent."* Until now the Schedule's Announce
(PR #6061) could be sent a week early, but the guest-side reader (`loadDayOfBroadcast`) returned
nothing outside the day-of window, so the words were saved and shown to nobody until the day.

What a guest of the event now sees (strangers with the link still see nothing — the audience
rule is unchanged, and who may send is unchanged: hosts, or a coordinator holding
`schedule: 'edit'`; suppliers never):

- **Before the day** — the latest announcement at the top of their Invitation, on every page of
  the guest tree, in a calm ink-toned card labelled "Announcement", in flow (not sticky).
- **On the day** — exactly as before: the terracotta "From the coordinator" card, sticky.
- **After the event is over** — hidden. The conservative reading: "dinner is moving up 15
  minutes" has no meaning the month after, and the Post Event page keeps its own words. "Over"
  is `isFinishedEvent`'s verdict (the last day has passed in the venue's calendar), not a
  second definition; the live window outranks it so the day-of look holds through the night.

Mechanism: `announcementStage(phase, ended)` in `lib/coordinator-broadcasts.ts` resolves
`'before' | 'live' | 'after'`; the layout passes it to the loader (which refuses only `'after'`)
and to `DayOfAnnouncement` (new `stage` prop; default `'live'`, so no caller regresses). The
composer's helper line and success line, and the Schedule tour slide, now say "right away"
instead of "on the day". `day-of-announcement.test.ts` pins the new rule behaviourally (a sent
announcement renders before the day; it comes down after); `event-people-roster.test.ts` and
`the-day-is-a-rail.test.ts` re-anchored from the old gate/copy.

SPEC IMPACT: None beyond the DECISION_LOG row already recorded by the controller on 2026-09-28.
