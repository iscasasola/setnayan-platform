## 2026-11-12 · fix(chat): a supplier's (+) Meeting reaches the Schedule before the booking; nothing sent from the chat reloads the screen

Owner, 12 Nov 2026, testing the supplier side of "TEST SetnaProd walk": *"Tried testing the decision and other (+) tools cannot add schedule, decision feels stuck. Send messages resets the whole screen"* · *"It is not synching properly with schedules"*. Asked whether a supplier may set a meeting before the couple books: *"Yes, before booking"*.

What was measured:

- **The database refused the meeting.** The supplier's (+) offers Meeting on every open (accepted) chat, but `event_appointments_vendor_insert` only admitted events the supplier is BOOKED on. On an open, unbooked chat the insert was refused. The supplier also could not answer a meeting the couple proposed there, because `event_appointments_vendor_update` had the same booked-only gate.
- **The card hid it.** `MeetingStepCard` closed itself (`onSent`) BEFORE the server answered, and every refusal in `createScheduleRequestFromChat` was a bare `redirect(back)` (or `?error=1`, which the thread page never reads). The meeting vanished and the page reloaded with nothing said.
- **The Schedule tab hid it.** The picked client's Schedule read and drew appointments only `if (isBooked)`, and behind the booking-fee lock the whole tab was the lock panel.
- **The quick replies navigated away.** "Let me check and reply today" and its siblings were plain forms posting `return_to=/vendor-dashboard/messages/<id>`. A tap inside the picked client's Chat page redirected to the full-screen messages route: a different screen, scrolled to the top.

What changed:

- Migration `20271340846228`: the supplier side may insert or update a meeting on an event it is booked on (unchanged) OR on a row whose `thread_id` names an `accepted` chat between this event and this supplier profile. No chat, a pending chat or another supplier's chat admits nothing new. Guard: `tests/db/a-supplier-sets-a-meeting-on-an-open-chat.db.test.ts` (6 cases; with the migration removed, the two positive cases fail).
- `negotiation-actions.ts`: the meeting request is a core (`requestMeeting`) that returns `{ ok, message }`. `createScheduleRequestFromChat` stays the one export (the server-action budget is a ceiling). Posted with `in_place=1` (the (+) card), it returns that result with no redirect and revalidates in place. As a plain form (the suggest chip, the composer menu) it redirects as before, now carrying every refusal as `?error=1&msg=`.
- `meeting-step-card.tsx`: awaits the answer, closes only on a saved meeting, and otherwise keeps the day and time with the reason (`Problem`).
- Client page: appointments read and draw on an open chat too (`meetingsOpen`). The appointments section sits OUTSIDE the fee gate (`scheduleGated`): they are the shop's own rows, like the shop's calendar. Two guards that anchored on `gated(scheduleNode)` now anchor on `{scheduleGated}`. One of them had turned vacuous (`indexOf` returned -1), so it now asserts the anchor exists.
- Quick replies (`thread-answer-line.tsx`): the chips post the shipped send with no `return_to` (the composer's own rule), so the action does not redirect, nothing navigates, and the live stream paints the reply.

Not changed: the Decision. Its filing (double-tap a message), Edit topic and Close · settled were read end to end and nothing measurable was found broken. The owner was asked what "stuck" looked like.

SPEC IMPACT: Appointments are open to the supplier on an open chat before booking (owner ruling 12 Nov 2026). Corpus DECISION_LOG row to add: "Meetings before booking: a supplier may propose and answer a meeting on an open (accepted) chat; Schedule shows it pre-booking, outside the fee gate." Not applied from this cloud session: the corpus folder is not in this container.
