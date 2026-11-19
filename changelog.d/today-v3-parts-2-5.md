## 2026-11-19 · feat(supplier-today): Today v3 parts 2–5 — drag both ways and "Do it tomorrow"

Owner, 19 Nov, on the drawing `Today, tap opens a card` v3.5 (artifact F4vQbaCwFtu2iawYd2r6q2): *"drag the card right
jump to that part on the page. drag it to the left do it tomorrow"* · *"yes. except urgent"* · *"Yes, all your picks"*.
Stacked on part 1 (#8032).

**Part 2 — the two drags and "Do it tomorrow".**
- Every Today task row drags both ways with the shipped swipe gesture (`swipe-to-delete.tsx`, 84 px, snap back 220 ms):
  right past halfway opens the task's own page; left past halfway puts it off to tomorrow, with "Moved to tomorrow ·
  Undo". A red (Overdue · Today) row dragged left moves a third as far and springs back with "Urgent · can't go to
  tomorrow". Only a closed row drags.
- The open card ends with "Open in page ›" and, beside it, "Do it tomorrow" — never on a red card.
- What was put off is listed under "Tomorrow N" ("Back on Today tomorrow") and is not counted today.
- A credit or gifted-plan row's "Not now" reads "Do it tomorrow" (it already lapsed at Manila midnight).
- New record `supplier_today_put_offs` (migration `20271352477387`, RLS on at CREATE TABLE): shop, task, until which
  day. One server action `todayPutOff` (op put | undo) under the caller's own session. A red row ignores any record,
  and an unread record holds nothing off.
- Guard re-aimed on purpose: `today-is-focus-shaped.test.ts` test 5 failed if "Do it tomorrow" or a drag appeared
  before part 2; it now asserts part 2 exists. New: `today-rows-drag-both-ways.test.ts`, `lib/today-put-off.test.ts`.

SPEC IMPACT: None — builds the ruled drawing (DECISION_LOG 2026-11-19 "TODAY v3 RULED AS A WHOLE"); nothing re-decided.

**Part 3 — the finished-event wrap-up card.**
- A finished event with photos or reviews opens its row as ONE card with three steps: Photos (every filed photo ✓,
  ★ = also Inspiration, none by default) · Reviews (this event's guest reviews, the shipped reply; the hosts' review
  "Not yet") · Confirm ("Confirm and share" — one tap). An event with neither keeps v2's quick "I delivered".
- Confirm is a new op `wrapup` on the shipped files dispatcher (no new route): photos to the couple's story, ★ to
  Inspiration (the shipped tag path), the event recorded as wrapped up, then the shipped `vendorMarkServiceComplete`.
- Every plan shares and the share is kept; only Supplier Ultra photos show in the story (re-read at render). Below
  Ultra the card says the 🔒 Problem → Solution.
- The couple's side: "<Shop> shared N photos · For your story" with Approve all · Hide some ▾ on the supplier's Files
  tab. Hide leaves their story only. Op `storydecide` → `couple_decide_story_photos` (SECURITY DEFINER).
- Silence = accepted after `platform_settings.story_photo_silence_days`, worked out at read time (no job). Not set →
  nothing is accepted by silence.
- Migration `20271353451673` (RLS at CREATE TABLE): `event_supplier_story_shares`, `supplier_event_wrap_ups`, the
  silence column. New guards: `today-wrap-up-is-one-card.test.ts`, `lib/today-wrap-up.test.ts`.
