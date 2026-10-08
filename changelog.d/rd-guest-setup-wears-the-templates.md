## 2026-10-09 · refactor(guests): Guests › Setup's writes come through the lab's stand-ins

Step 3A. Guests › Setup's three writes — the asks and how guests get in (`hubDraftAction`, the Maker's draft door), Reply by (`updatePaxSettings`) and Finalize / Reopen (`setGuestListFinalized`) — are taken from `GuestActionsContext` like the rest of the list's writes, so the dev lab's `?part=setup` can be pressed without reaching the database (`?refuse=1` makes them refuse in the database's own words, on purpose). The app never provides the context: production calls the shipped actions. No request, no server action, no migration added.

SPEC IMPACT: None

## 2026-10-09 · refactor(guests): Guests › Setup is drawn by the app's Form rows, the same frames the Maker hands the shared parts

Step 3B. Setup's rows leave their own grid (`SETUP_ROW`) for one `FormRows` list: How guests get in (`ChosenRow`), RSVP asks (`FormRow` + the part's chips) and Reply by (`DateRow`, the calendar pill, written live) are handed the SAME frames the Maker hands the same shared parts (`setup-frames.tsx`, held equal to the Maker's by `setup-wears-the-form-rows.test.ts`); Invitations, Your one link and Finalize are `FormRow` with their buttons at the right, their sentences behind an ⓘ, and one filled forward step each (Send to N and Copy are the brand colour; Finalize now stays the confirming OK tone). "Send to N" and "Pick who" are taken from the lab's context so nothing on the lab's Setup page leaves for a real route. The shared parts and every Maker file are unchanged apart from `ReplyBy`'s frame marks (live vs drafted) and the removal of its now-unused `row` layout. No request, no server action, no migration added.

SPEC IMPACT: None

## 2026-10-09 · fix(guests): Setup's Finalize pop-up follows the pop-up rule; every refusal in Setup is one plain sentence; two lab warnings

Step 3C. "Finalize guest list" opens a `GuestPopup` (on <body>, above the bottom bar, dark and blurred behind, nothing behind works) instead of the shared `Sheet` in a hand portal; "Not now" is the neutral button and "Finalize" the OK-toned filled one. A refused save of the asks / how guests get in, a refused Finalize or Reopen, and a refused Reply by date are each told in a plain sentence of the page's own — never the database's words. The lab's `?part=setup` no longer draws the Digital Pass from the production address (the page's own CSP refused it three times; the lab draws a small inline picture, the real Setup view hands a same-origin path), and the screen's two server-handed slots (`setup`, `empty`) are single children, which silences React's dev "unique key" warning. No request, no server action, no migration added.

SPEC IMPACT: None
