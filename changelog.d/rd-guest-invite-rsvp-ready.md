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
5. **One countdown rule.** Details' countdown read 67 days while Home read "68
   days to go". `countdownReading` (lib/countdown-target.ts) counts Days the way
   Home and the scene template do — calendar days in the event's zone, today
   included — and Hours · Mins · Secs count down what is left of today; Home
   falls back to Manila (never the server's UTC) when an event has no zone.
   Guard: `lib/one-countdown-rule.test.ts`.

SPEC IMPACT: None — implements the 2026-10-04 "ONE WORD: EVENT" row, the
"Post Event" stage vocabulary, and the setup's own promise that the Love Story
page "opens with the first chapter you fill". Build call for the owner: the
countdown's Days tile now counts calendar days (today included), so on the eve
it reads "1 day" beside the hours left in that day.
