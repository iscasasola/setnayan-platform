## 2026-09-10 · feat(chat): each side answers the other's request from Decisions

Owner: *"the vendor and customer will either approve the request of the
other one."* Plus: *"ok build it"* — making the chosen view stick.

### Each card that is waiting on you now carries the answer to it

On the Decisions view, an entry that is waiting on the reader shows its reply
right there — and an entry the reader is waiting ON shows none. That rule is the
owner's sentence, and it holds by construction: `withReply()` attaches a reply
from the SAME boolean the "Now" line was built with, and a test asserts
`reply ⇔ needsYou` over every kind × status × reader × proposer.

**Every reply is an action that already existed.** Nothing new behind a button:

| Card | Who answers | Action (unchanged) |
|---|---|---|
| Meeting | whoever did not propose the time | `respondAppointment` — Confirm · Decline |
| Adjustment | whoever did not raise it | `respondAmendmentFromChat` — Accept · Decline |
| Payment | supplier | `confirmVendorPayment` — Confirm received |
| Guest count | supplier | `acceptPaxSurcharge` / `declinePaxSurcharge` — Apply · Hold the price |
| Quote | couple | a LINK to `/proposals/<id>` — Review & accept → |

Each action still re-checks server-side that the caller may answer.

- **A quote gets a link, not an Accept button.** Accepting books the supplier;
  the product has no inline accept anywhere, and the chat's own card already
  sends the couple to review the whole proposal first.
- **A payment has no "Not received".** The design drew one; the product has no
  such action. A button with nothing behind it would be worse than none.
- Buttons are 44px (the chat cards' are 36px) — Decisions is the phone surface.

### The view lives in the URL — and that was a prerequisite, not a nicety

`?view=decisions|files` (All = no param), read on the server so a link paints
the right view first time. Every reply action ends in `redirect(return_path)`;
with the view in `useState`, answering the other side dropped you into the full
chat after every tap. Switching uses `replaceState`, so Back leaves the thread.

### Found by measuring

1. **`revalidatePath` purges nothing if the path has a query.** Next 15.5 tags
   the path verbatim, so `…?view=decisions` matched no route — the reply would
   succeed and the card would stay stale. New `lib/return-path.ts`; all 13
   revalidate sites in the two chat action files now revalidate the bare route
   and redirect to the full URL. Identical behaviour for every existing caller.
2. **The two reply actions read different field names** — `return_path` for a
   meeting, `return_to` for an adjustment. "Tidying" one to match sends every
   couple who accepts an adjustment to `/dashboard`. New guard
   `a-decision-reply-posts-what-the-action-reads.test.ts` compares each form
   against the `formData.get()` calls in its ACTION, both directions.
3. **A meeting with no recorded proposer was answerable by nobody** on
   Decisions, while `respondAppointment` (and the chat's card) let either side
   answer it. Aligned with the server. (`initiated_by` is nullable; every
   current writer sets it.) The adjustment equivalent is unreachable —
   `raised_by` is NOT NULL.
4. **"Payment logged by the couple" on the couple's own phone.** Kind labels
   were one static string; they now turn around with the reader like the Now
   lines do. Found by rendering the phone, not by reading the code.

5. **The guest-count card struck through a number that was still true.** It
   showed ~~150 guests~~ beside "the quote still reads 150 guests" — a
   strike-through claims "no longer so", and the quoted count stays true until
   the supplier answers. Introduced in #5372; found by rendering the supplier's
   phone. Removed, with a guard that no card strikes through a value its own
   Now line still asserts.

### Correction to the previous PR

#5372's comments named the appointment action `respondToAppointment`; it is
`respondAppointment`. Fixed in code and in `changelog.d/decisions-filter.md`.
⚠ It is also wrong in the header of migration
`20271215830712_appointment_previous_scheduled_at.sql`, which is applied in
production and therefore NOT edited — do not treat that comment as evidence.

SPEC IMPACT: None. No new actions, no schema change; every reply reuses a
shipped server action with its existing authorization.
