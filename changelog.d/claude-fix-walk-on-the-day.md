## 2026-11-13 · fix(on-the-day): the supplier's on-the-day round (F-W1-75…82)

- **F-W1-82 (privacy)** After an account switch the day-of cache still held other logins' Event Hub pages
  (wanda-indigo, maria-and-jose, rosa-ben, w3-barkada-hangout). The worker now records the viewer on EVERY signed-in
  load (not only when a copy is saved), and a different viewer — or an unknown one — erases the saved copies AND the
  day-of guest pages (`DAYOF_CACHE`, `forgetGuestPages(null)`). A signed-out page's wipe (`OFFLINE_FORGET`) erases the
  day-of pages too. Pinned by an executing test of the real worker (`app/sw-offline-copies.test.ts`).
- **F-W1-77** "Update now" before the day did nothing and kept saying "Not saved on this phone yet". Before saving can
  start (3 days before the event) the strip now says so — "Nothing to save yet · saving for offline starts Dec 15, 3 days
  before the event" — and Update now is not offered. Before the booked day the live console (which redirects until
  then) is no longer asked for, so the Hub's own copy can land; the strip says the console is saved on the day.
- **F-W1-76** "Launch Hub" before the day bounced to a bare Hub with no event and no word. The live page now sends you
  back to the Hub on THAT event, and the Hub says "The live page opens on Fri, Dec 18, the booked day."
- **F-W1-81** The Hub ▾ no longer says "Tick as many as apply" — it ticks one view and one event.
- Guard: `lib/the-walk-on-the-day.test.ts`.

SPEC IMPACT: None.
