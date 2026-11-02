## 2026-08-12 · fix(routing,vendors): the hold moves into the database, and My Shop stops reading other shops' requests

An adversarial pass over PR #4375 raised 26 candidates; **18 survived refutation**
and collapse to 7 distinct defects. All were re-verified by hand against
`origin/main` and prod before acting. **Two are mine, from that PR.**

### 🔴 The hold covered ONE delete path; the database permits another

`deleteEvent` wrote the hold — the ADMIN path. But prod carries a live RLS
policy **`couple_can_delete_event`**, so a couple can delete their own wedding
straight through PostgREST with no server action and **no hold written**. The
word would be free the same second — the exact defect that migration closed,
reachable by the one person whose links break.

**A promise the database does not keep is not a promise.** Removing the button
closes the button, not the door — the lesson the shop-address trigger already
cost. The hold is now a **BEFORE DELETE trigger**, so every path, present and
future, holds the word. The app-side write is deleted rather than duplicated.

One deliberate opt-out: the abandoned-draft sweep, via
`sweep_delete_abandoned_events` (runtime `set_config`, prior value restored on
every exit path including an exception). Those drafts were never published,
printed or shared; holding them would burn a real couple's natural address.

### 🔴 My Shop read EVERY shop's correction requests

The new card's fetch had **no vendor filter** and leaned on RLS — but the read
policy is `owns the profile **OR is_admin()**`, deliberately widened so the same
helper can back `/admin/corrections`. Production has a vendor who **is** an
admin (the owner's own shop), so his My Shop would render another shop's request
as his own *"waiting on Setnayan"* and remove that field from the ones he can
ask about. Enough foreign requests and the ask button disappears — restoring the
exact unreachable-doorway defect the card was built to fix. Now scoped
explicitly, and the comment claiming "RLS-scoped to this vendor" is gone.

### Also fixed

- **A verified shop could not change its logo anywhere.** The inline editor
  refuses it with *"Request a correction instead"* — and the card did not offer
  Logo. The error named a remedy that was not on the screen. (`services` stays
  out: the Coverage page owns that writer.)
- **A deleted wedding's held address was refused with the FORWARDING message** —
  *"still sends visitors to its old page"* — which is untrue by construction; a
  closure forwards nobody. The closure probe matched the shop type only. Both
  types now matched, with the reason taken from the row.
- **`slug-forwarding-window.ts` — the file whose entire purpose is "the ONE
  number" — made three false claims in one paragraph:** that the hold was one
  year, that it "never reads this", and it named a constant this work deleted.
- The live column comment on `redirect_until` still said closed-shop holds are
  one year.

### 🛡 Guards

- The intake guard proved the card was **imported**, not **mounted** — deleting
  the JSX while keeping the import left it green. Now asserts the element.
- The event-delete guard matched a **file-level substring**, so an import line
  or a comment exempted the whole file. Rewritten for the trigger design:
  comments stripped, and it now polices **opt-outs** (which must be named with a
  reason) since every path is safe by default.
- 🪤 **And one new assertion could not fail.** The opt-out leak check ran two
  separate statements — a transaction-local setting dies at COMMIT, so it stayed
  green however the function was written. Wrapped in ONE explicit transaction,
  which is both how a real caller would hit it and what makes the leak
  observable. Mutation-proved: removing the restore now turns it red.

Migration dry-run **against production** inside a transaction and rolled back —
`DDL ACCEPTED BY PROD`, trigger created, prod left untouched.

SPEC IMPACT: DECISION_LOG.md — the deleted-event hold is enforced by the
database, not the app.
