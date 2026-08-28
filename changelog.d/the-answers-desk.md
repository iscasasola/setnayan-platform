## 2026-08-27 · feat(vendor): the Answers Desk — every answer a shop owes, in one place, answered on the row

S6 of the Supplier's Room stream (`WHATS_NEXT_Suppliers_Room_SESSIONS_2026-08-27.md`),
built against § 9 of `WHATS_NEXT_Vendor_Hub_And_Answers_2026-08-26.md`.

### RULE 0 first — the desk already ships, and nothing was redrawn

`/vendor-dashboard`'s "What's new" feed IS the desk: one list across all of a
shop's celebrations, oldest waiting first, assembled in `lib/vendor-overview.ts`.
Six kinds reached it. What was missing was never the list — it was what reaches
it, and whether the answer can be given ON it.

### 🚨 A ONE-STAR REVIEW COULD NEVER REACH THE DESK

The filter was `rating_overall !== 5 || vendor_reply`. **The review that most
needs an answer was excluded by construction**, and no count anywhere reported
that it had been. Every unanswered review now joins, at every rating, and the
rating rides on the card because it decides both the words and the colour: praise
keeps the decorative gold, criticism wears the warm semantic. A card can no
longer be amber and congratulatory at once (one resolver, `cardTone`).

### 🔴 AND THE REPLY BOX IS ON THE ROW

The card said a review was unanswered and then **linked away** — the one thing a
list of answers you owe must not do with the answer it is asking for. The
textarea is on the card, posting through the shipped `postVendorReply` (one
final public reply, unchanged), and the action now revalidates the desk as well
as the Reviews page, so an answered review stops asking to be answered.

### 🪤 A LAPSED BOOKING ASK KEPT SAYING "LAST DAY TO ANSWER" — FOREVER

Measured out of the migration body, not assumed: `vendor_agree_to_lock` expires
**LAZILY** — flipped only on the answer path, there is no sweeper — so a lapsed
ask keeps `lock_request_state = 'pending'`, the query cannot tell it from a live
one, and `lockRequestDaysLeft` floors at 0. A supplier was being told it was
their last day to answer something that answers `expired` when pressed. It is now
its own card kind: **one grey line, in the same place, no control at all** (a
button that refuses the person it is shown to is worse than no button), clearing
itself after a week. 🔑 **A row that simply vanishes reads as one you answered.**

### Four kinds of answer joined

* **A reply owed in an accepted conversation** — probably the commonest row of
  all, and it appeared nowhere: the enquiry lane is pre-accept only. Asked of the
  last message's AUTHOR, not of an unread marker — reading is not answering.
  🔑 This is the exact thing we measure and publish as that shop's reply speed.
* **A meeting time the couple proposed** (`event_appointments`, real rows the
  couple's own screen inserts). Confirm is a fact, so it is on the row; declining
  is behind a fold; offering another time needs a calendar, so it is a way in.
  Deadlined by the MEETING — a passed proposal becomes a closed line, sorted by
  the time that passed so a tasting that already happened cannot claim the top of
  a list ordered by who has waited longest.
* **A quote written and never sent** — and **no Send button, deliberately**:
  sending retires every other live quote out with that couple. ⚠ It is a DRAFTS
  list and says so: a quote created-and-sent in one step from a chat thread is
  invisible to this lane.
* **A contract drafted and never sent** — moved OFF the separate open-task list
  rather than added to the feed beside it. One thing, one list, one clock.

### 🚨 `--sn-warn` IS NOT A TOKEN AND NEVER WAS

Found by deriving the guard's token list from the file instead of checking the
one colour I was editing. The booking-ask card named `var(--sn-warn)` for both
its accent bar and its eyebrow; no stylesheet defines it. An undefined `var()` is
rejected, not thrown — **the amber accent bar drew nothing and the eyebrow
inherited the body ink**, so a card whose own comment explains at length why it
is deliberately amber has never once rendered amber. Repointed at `--sn-warning`
(the fill) and `--sn-warning-deep` (the text weight, because the fill is 2.92:1
as text). Same family as the undefined `--font-serif` that had a whole overlay
rendering in the phone's default serif.

### ⛔ Four answers deliberately DO NOT join

Recorded once, as data, in `ANSWERS_THAT_DO_NOT_JOIN` — the waitlist pick (does
nothing and reports success) · a paid crew shift (the database refuses posting,
seeing and accepting it for anyone who is not an admin) · a guest's song request
(nobody can ask — both routines have zero callers) · "somebody says they paid
you" (the only possible answer is yes, and it cannot be taken back). A row would
be a door onto nothing. The guard reads that list, so removing one is a
deliberate edit.

### Guard · `lib/answers-desk.test.ts`

13 tests. **13 mutations, occurrence count printed before → after, all RED** —
and **the mutation run caught one of my own guards as decoration**: "every card
kind is drawn" matched the kind name anywhere in the file, which the card body's
own `Extract<…{ kind: 'meeting' }>` signature satisfies, so unmounting the branch
left the count at 1 → 0 and the test green. It asks about the DISPATCH now, and
pins that exactly one kind (`dispute`) may be the trailing else. A 14th
"mutation" reported nothing because its anchor matched three times — *a red
result is not evidence the sabotage applied, and neither is a green one.*

The card kinds are DERIVED FROM THE UNION IN THE SOURCE, across both files that
declare one (the pre-accept enquiry card lives in its own module — reading only
the union block finds ten of eleven kinds and reports a complete survey).

✅ `tsc` errors=0 **EXIT=0** · the new suite 13/13 · unit suite green.

### ⏭ Named, not built (owner's, or gated)

* Whether "somebody says they paid you" gets a second button — his call.
* A partnership offer stays a sentence and a way in, never a fast button: saying
  yes publishes a claim about the other shop's prices and then freezes the terms.
* A pax-change re-price stays in that couple's thread — the number is recomputed
  on press, and nothing records when it began waiting, so it cannot honestly sit
  in a list ordered by who has waited longest.
* Floor items and song requests belong in the room at the event, not here.

SPEC IMPACT: `WHATS_NEXT_Suppliers_Room_SESSIONS_2026-08-27.md` (S6 row → built)
and `WHATS_NEXT_Vendor_Hub_And_Answers_2026-08-26.md` § 9 (the six/ten/two table
→ what shipped, and the lazy-expiry finding). Both applied in the spec corpus.
