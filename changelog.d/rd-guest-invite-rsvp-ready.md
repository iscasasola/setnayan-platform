## 2026-10-04 · fix(guest): an unreplied guest is asked to reply first · empty Love Story hidden · "event" on the guest path · one stage vocabulary · one countdown

Five defects the controller found live on maria-and-jose at 375 px (2026-10-05 walk):

1. **Me leads with the reply for a guest who has not replied.** The invite says
   "Please reply below — your ticket is ready once you do", yet an unreplied
   guest's Me showed the ticket, "Show this at the door" and "Save my ticket".
   `meLeadsWithReply` (lib/arrival-action.ts) — true only when the page's one
   action is the ask (before the day) and the reply sheet is on the page — now
   makes `GuestTicket` draw the one "Reply to the invitation" button (the
   page's existing reply sheet, `#your-details`) in the ticket's place; the
   ticket appears after a Yes. On the day, and for a plus-one, the ticket stays.
   SiteBody asks the rule from its own plan and hands it to page.tsx's Me (real
   guest and See as sample) through a function-form `meSection`.
   Guard: `app/[slug]/an-unreplied-guest-is-asked-to-reply-first.test.ts`.
2. **"Our Love Story" tab hidden until it has a chapter.** maria-and-jose's
   `love_story` is `{}`, and the menu asked `Boolean(event.love_story)` (and,
   under open-browse, nothing at all). Both menus now ask `storyTabHasChapter`
   (our-story.tsx) — the same predicates the tab's page draws with.
   Guard: `app/[slug]/an-empty-love-story-has-no-tab.test.ts`.
3. **"event", never "celebration", on the invitation / RSVP / ticket path:**
   "RSVP for the event" (Welcome), "…your own event" (host's Me), "Planning your
   own event?" (reply card pitch), "That invite is for a different event", Me's
   fallback event name, and the invite message's fallback noun. The
   `EventWords.occasion` noun itself, watch-live strings and stored words are
   untouched. Guard: `app/[slug]/the-guest-path-says-event.test.ts`.
4. **The host's Preview ▾ speaks the Maker's stages:** Save the Date · RSVP ·
   Invitation · The Day · Post Event (was "… The Day · After", no RSVP). The RSVP
   stage opens the reply page for a sample unreplied guest
   (`/[slug]/invite/reply?preview=draft`, the Maker's host-only canvas door).
   Guard: `lib/owner-ribbon-speaks-the-makers-stages.test.ts`.
5. **One countdown rule, never false.** Details' countdown read 67 days while Home
   read "68 days to go". Ruling (controller, 2026-10-05): ONE rule — whole days of
   real time left to the start of the day in the event's zone (Manila when it has
   none). `countdownReading` (lib/countdown-target.ts) keeps the four tiles exact
   (67 d 12 h 42 m); `daysToGo` gives Home the same number ("67 days to go"), then
   "Tomorrow" and "Today" at the end. It also drives Home's focal number and chip,
   the guest page's checklist ("N days to <date>"), the hub's big-number scene
   template and the events-list card. Home's sentences still branch on the calendar
   day (`daysOut`). Guard: `lib/one-countdown-rule.test.ts`.
6. **A page without tabs** (Me drawn by `GuestHubBar`) asks the same reply-first
   rule, through `rsvpReplyOpen` (lib/site-body-plan.ts) — now the one rule both
   branches of `plan.rsvpShouldRender` use.

SPEC IMPACT: None — implements the 2026-10-04 "ONE WORD: EVENT" row, the
"Post Event" stage vocabulary, and the setup's own promise that the Love Story
page "opens with the first chapter you fill". Not changed (a Maker
file): the Maker's own preview count (`website/editor/page.tsx`, `Math.ceil`).
