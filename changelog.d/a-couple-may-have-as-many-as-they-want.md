## 2026-09-14 · test(guests): the honour attendants are not one-per-event — owner ruling, recorded

Owner, asked whether Best Man / Maid of Honour / Matron of Honour should be
limited to one each: *"no need to make them 1 each. they can do as much as they
want."*

**No behaviour changes.** The roles were never in `SINGLETON_GUEST_ROLES` and
still are not. What changes is that the absence is now a **decision** rather than
something indistinguishable from an oversight.

🔑 **Why this is worth a guard.** `SINGLETON_GUEST_ROLES` had **no test of its
contents at all**, so a role could be added to it with nothing going red. And the
obvious "fix" on seeing two Best Men listed on one invitation is to make it
one-per-event — **I proposed exactly that, twice, before the owner ruled against
it.** A future session would have had every reason to do it and no signal not to.

- `lib/guests.ts` — the ruling recorded at the definition, in the owner's words.
- `lib/role-sets.test.ts` — two tests: the three honour roles must NOT be
  singletons, and the singleton list must be **exactly** `bride · groom · imam ·
  wakil · wali`. Asserted as a whole set, so a new singleton cannot be slipped in
  unnoticed either. (`witness` stays out on purpose — a nikah needs at least two.)

The failure message quotes the ruling and its date, and says how to reverse it
honestly: with a newer ruling, updating the test in the same change.

Sabotage-checked: adding `best_man` to the list turns the suite red.

SPEC IMPACT: Owner ruling logged in `DECISION_LOG.md`.
