## 2026-09-27 · feat(maker): the Love Story panel lists the page's five chapters; "Pick from our events" shows every event you were both at

**Panel = page.** Owner, on Maker → Love Story: *"align this to what I see on the
editing part."* The panel beside the scrapbook used its own headings (The
beginning · The spark · The almost · The yes · The little things · Your timeline)
and a "Written" chip while the page said "0 moments". It now lists the page's
chapters — Before us · How we met · Falling · The yes · Toward the day
(`groupByChapter`) — and under each: that chapter's moments (a tap opens that
moment's own sheet ON THE PAGE, `love-story-open.ts`), the chapter's own "Add a
moment" (opens the page's add sheet, with How we met / The yes pre-marked), and
the questions that belong there (`StoryChapterFields`). No data change: same
`love_story` field names, same `updateOurStory` save, still drafted. The chip
counts what the page counts (`loveStoryRowStatus`). Tapping a chapter on the page
scrolls the panel to it. Milestones' button now reads "Add a milestone".

**Pick from our events.** Owner: *"this should show all events that they are both
there."* Lists every other event where BOTH partners (this event's couple members)
are members in any role, newest first. Photos only from events the pair hosts
(either is the COUPLE there; an event a partner only coordinated is another couple's, so it is listed with none); someone else's event is listed with none — the pair's
own Papic captures there live in a private bucket an Event Hub may never name.
Read through the admin client with every scope applied in code
(`our-events-read.ts`, the `resolveMutualStoryDays` pattern), fail-closed; the
pick action accepts refs from the same read.

Guarded by `the-love-story-panel-matches-the-page.test.ts` and
`pick-shows-every-event-we-were-both-at.test.ts`. +0 server actions.

SPEC IMPACT: None — extends the shipped Phase 7 scrapbook; no locked decision moved.
