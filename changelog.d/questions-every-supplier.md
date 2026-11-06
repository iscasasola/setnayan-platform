## 2026-11-04 · feat(questions): Questions for the couple opens to every supplier — not hosts only

Owner ruling 2026-11-04, verbatim "Yes, every supplier" (corpus `DECISION_LOG.md`, "QUESTIONS FOR THE COUPLE — EVERY
SUPPLIER, NOT HOSTS ONLY"). The feature shipped (DAY-7) for the host/MC; the schema was never host-only — the gate was
in the app. Widened:

- **Supplier writes their set** where they always did (`/vendor-dashboard/activities#questions`), now with its own
  doorway for every shop (Shop tools · Settings › More tools: "Questions for the couple"). Starting suggestions follow
  the shop's TRADE: the shop's services → tiles through the LIVE taxonomy (`getTaxonomy()`, Admin › Categories),
  `STARTERS_BY_TILE` in `lib/emcee-questions.ts` — the emcee set for `host_mc`, short sets for coordinator ·
  stylist_decorator · catering · photo_video, a generic fallback. None asks venue, date, headcount or names. Saves land
  in place (no redirect back to the page).
- **Chat ＋ › "Their event · for your service" › Questions for the couple** ("Your question set · they answer in their
  event") — the ONE approved row of that prototype group, shut with "Opens once they book you" until a booking
  (DECISION_LOG: sent "into a booked event"). Its panel shows the set and where it stands (not sent · sent
  on … · N of M answered) and sends it into the event: records the ask (`event_question_requests`), posts one line in
  the conversation as the supplier, and tells each host IN THE APP (`supplier_questions_sent`, not on the email
  allowlist).
- **The couple answers in that supplier's room** (`/dashboard/[eventId]/vendors/[vendorId]/workspace`, Details tab,
  "{Shop} asks") — shown when the supplier asks something AND is booked (settled) or sent their set. Two hosts never
  overwrite each other (`base:` boxes); only that supplier's questions are written from that form. The host's own copy
  on the Schedule's Host / MC sheet is unchanged.
- **The supplier reads the answers on that customer's card** — the host in the Script tab as before; every other trade
  on Details (flag-on) / the overview (flag-off). One shared renderer (`couple-answers.tsx`).
- Migrations: `20271311927322_notification_type_supplier_questions_sent` (enum value, own file) and
  `20271312612416_questions_every_supplier` (`event_question_requests`, RLS at create: own row only, only into an event
  with a conversation, no DELETE; plus `event_question_answers_asked_vendor_select` — asked AND own question).
- Guards: `lib/questions-for-every-supplier.test.ts` (the gate is not host-only, the row exists and is open before a
  booking, in-app only), `tests/db/questions-every-supplier.db.test.ts`. Lab: `/dev/questions-lab`, and the panel in
  `/dev/supplier-chat-lab`.

SPEC IMPACT: `Emcee_Script_System_BUILD_SPEC_2026-07-29.md` § 8 (the questionnaire) now applies to every supplier: the
couple answers non-host suppliers in that supplier's workspace (Details), and a supplier may send the set from the chat
before a booking. Decision already recorded in `DECISION_LOG.md` (2026-11-04).

**CI fixes (2026-11-04):** the route budget — `reissuePapicSeat` (dead since the per-seat cards left /crew) is removed
and the server-action CEILING moves 1227 → 1228 for the two new in-place actions, citing the measured production route
count (1830 of 2000); the new notice `supplier_questions_sent` is declared `app_only` in `lib/couple-supplier-notices.ts`;
the PR's test uses the shared `stripComments`; `/dev/questions-lab` joins the no-door baseline like every other lab;
the exposure baseline is regenerated after merging `main`. SPEC IMPACT: None.

**Fix (2026-11-06, from this PR's check card): an open tool no longer lets the chat paint over the quick replies.**
On a phone the thread is a fixed-height takeover, so with any tool panel open (Questions for the couple, Answer their
booking ask, …) the stream slot (`min-h-0`) collapsed to 0px and its messages and day labels ("Oct 26, 6:05 PM") drew
over the quick-reply chips and the panel. `chat-box.tsx`: the slot keeps its automatic minimum (the 14rem floor of the
view scrollers reaches it) and every other child of the box holds its height, so the takeover scrolls instead. Already
present on main with the booking-ask panel. Guarded by `an-open-tool-cannot-flatten-the-stream.test.ts` (3), sabotaged
both ways. Two older guards pinned the defect itself — `one-chat-box-like-messenger.test.ts` and
`an-open-tool-does-not-bury-the-conversation.test.ts` required `min-h-0` on the slot ("the list cannot scroll inside
it"). Measured: the list still scrolls inside the slot without it, because every view scroller is `basis-0` with a
14rem floor. Both now require the opposite (no zeroed minimum), each sabotaged red.
