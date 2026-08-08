## 2026-08-08 · feat(vendor): the enquiry lands on the vendor's own calendar

Owner, stopping a build mid-flight: *"was this already discussed before? we
always check their schedule before they show. it needs to be available on their
schedules."*

**He was right on both halves, and both were verified in code.**

### ⛔ What was cancelled

A per-enquiry **"is my date free?"** chip was specified and about to be built.
It isn't needed. `getBatchVendorAvailableDays` is the **one shared availability
path**, consumed by **nine** surfaces — Explore, the couple's vendor list, date
selection, the plan builder, compatibility scoring, candidate dates, the build
date window, the schedule matrix, wizard recommendations. A couple never sees a
vendor without that vendor's schedule being consulted, and it already fails the
safe way: *"a calendar flake reads free, never a false booked."*

🔑 **A SECOND ANSWER TO A SETTLED QUESTION IS A DEFECT, NOT A FEATURE.** The chip
would have re-derived availability per card from a different pair of reads. Two
derivations of one fact can disagree — and the newer, less-tested one would have
sat in front of the vendor while the couple saw the other. Cancelled, and
recorded in `DECISION_LOG.md` and the spec so it cannot be re-added.

### ✅ What shipped instead — the owner's second clause

The vendor's calendar could say six things about a day: **blocked · held ·
approve-first · full · booked · waitlisted**. Every one describes what the day
**is**. **None of them said "a couple is asking about this date."** Enquiries
lived only in a list, so a vendor answering one had the answer sitting on another
screen, in a calendar that did not know the question had been asked.

Now the day carries `2 asking`, with a legend entry.

🔑 **AN ENQUIRY ANNOTATES A DAY — IT NEVER BECOMES THE DAY'S STATE.** Folding it
into the six-state precedence would do harm in *both* directions: an enquiry on an
open day would make it look taken, and an enquiry on a booked day would hide that
it is booked. `inquiryCount` rides alongside, and two tests hold that line — an
open day with an enquiry stays `null`, and a waitlisted day with an enquiry stays
`waitlist`.

⚠ **COUNT ONLY, NEVER IDENTITY.** A pending enquiry is **pre-accept**: the
couple's identity is withheld until the vendor accepts, and `buildInquiryCard`
enforces that *by construction* — it has no name/venue parameter at all.
`pendingInquiryDates` takes the same posture: it accepts only a status and a date
and emits only a number, so the calendar cannot become a way around the mask.

**Zero new queries** — the customers page already loads these threads.

### Also shipped (neither re-derives anything)

- **How long a couple has been waiting**, on enquiry cards only. Lock requests,
  reviews and disputes carry timestamps too, but none is a clock the vendor is
  answerable to; an age on those would invent an SLA nobody agreed to. Tinted
  past a day.
- **Longest-waiting first.** The shipped order was newest-first and carried no
  recorded rationale. A missed enquiry is lost income, so the one waiting longest
  is the one most at risk. One line, trivially revertible.

### 🪤 Traps

- **Elapsed milliseconds, never a calendar difference.** "Waiting 2 days" across
  a timezone boundary must not become 1 or 3 because two civil dates were
  subtracted. Tested at a 25-hour gap that spans two calendar days.
- **A future timestamp is clock skew, not negative waiting** — it clamps to "just
  now" rather than rendering `waiting -3 h`.
- **A thread with no date is dropped, never bucketed.** Defaulting it to today
  would put a marker on a day nobody asked about.
- **A timestamp is truncated to its civil day, never re-parsed** — `new
  Date('2026-12-12')` is the 11th west of Greenwich.
- The new calendar input is an **optional trailing parameter**, so every existing
  caller keeps working and an omitted list simply means no markers.

### Verification

- **7,106 unit tests pass**, 0 fail (14 new)
- green under **UTC · Asia/Manila · America/New_York**
- **all 21 lint guards green**, including the port guard — nothing lost
- `tsc` clean

SPEC IMPACT: `FABLE_Vendor_Dashboard_Spec_2026-08-08.md` § 2.4 EXTEND 2 marked
CANCELLED with the reasoning; `DECISION_LOG.md` row added. Both applied.
