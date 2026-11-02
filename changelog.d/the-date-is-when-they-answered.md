## 2026-08-21 · fix(guests): four regressions from my own batch, found by auditing it

An adversarial pass over the four invitation-flow PRs merged earlier today
(#4675 · #4679 · #4683 · #4684) produced 12 candidates; 6 skeptic verdicts upheld
4 distinct defects, two of them user-facing. All four were introduced by that
batch. Every fix is mutation-proved (7 sabotages, all landed by occurrence count,
all RED).

**A · The reply date was rewritten by every save.** `guests/[guestId]/actions.ts`
wrote `now()` into `rsvp_responded_at` on a form that saves fifteen unrelated
fields, with no comparison against the prior value. A host opening a guest in
December to fix a phone number moved a March reply to December. The flaw is
older than #4684 — but #4684 put the date on screen, and a stamp nothing reads
cannot be caught lying, so shipping it made a silent wrong value into a visible
one. Now derived from the `prevGuest` snapshot the function ALREADY takes one
field away (it exists so seats are only re-placed when role/group actually
changed — the same question, one column over). Three cases: not
attending/declined → null · answer changed → stamp · answer unchanged → keep what
was there, **including null**, because stamping an untouched answer invents a
date. ⚖ On a read error it stamps, deliberately: a stale date is wrong, a
deleted one is gone.

**B · Deleting a note announced a note.** `if (changed.includes('note'))` pushed
"They left you a note." unconditionally — one line below a sibling that already
branched set-vs-cleared for dietary. The couple opened an empty page. Now
"They removed their note."

**C · #4679's guards were decoration, and the mutation proves it.** Deleting the
single line that hands `firstVisit` from the loader to the card (count 1 → 0)
left **all eight tests green** while every guest went back to "Hi again". The
three source tests slice a region that ends 18 lines ABOVE the wire; the five
render tests pass the prop explicitly and never load the loader. Testing the
primitive is not testing the caller. A structural guard now reads the hub-data
object itself, and a second asserts the card still accepts the prop.

**D · The blank-name arm said "Hello — welcome.", three lines below the comment
forbidding it.** "Welcome" already means *checked in at the door* — the same file
says `Welcome, {firstName} — you're checked in.` 75 lines down. The guard written
to enforce the rule only ever rendered a NAMED guest, so the one arm that broke
it was the one arm never constructed. All four arms are now rendered AND the
ternary is read as source, with a vacuity check on the slice.

SPEC IMPACT: None.

**E · The couple's own page contradicted itself, live in production.** #4684's
line was appended OUTSIDE the `isCouple` ternary, so on the bride's and the
groom's page the host read two consecutive sentences: *"The couple is the
foundation of the event — always attending"* and *"Answer recorded 20 Jun 2026."*
There is no answer to record — the action COERCES bride/groom to attending, so
their stamp only ever says when a host last pressed Save. **Verified in prod: both
carry a value byte-identical to their row's `created_at`** — the instant the row
was written. Fix A stops it moving; this stops it being shown at all.

**F · A notification with a heading and nothing under it.** The meal sentence was
gated on the VALUE (`&& meal !== 'no_preference'`), so a guest CLEARING their meal
produced `changed=['meal']` and `parts=[]` — an email whose entire content was
"Ana updated their details", about a change they could only find by opening the
app and hunting. The same missing set/clear branch as B, on a third field. Every
member of `changed` now produces a sentence, and a guard walks all three.

Found by the completeness critic, which asked what a seventh lens would cover and
then ran it: the three PRs meet on ONE screen and nobody had audited the branches
of the section #4683 reorganised while #4684 appended to it.
