## 2026-08-21 · revert(join): the email was already being written down — I added a second writer

**Reverts #4703, which fixed a bug that did not exist.**

The invite door asks for "Email (optional)". I followed that value as far as the
CALL to `sendEventAccountMagicLink`, read the words "magic link", concluded the
address was mailed and thrown away, and wrote a second copy into the self-join
insert — with tests locking the duplicate in place.

**Opening the callee would have taken ten seconds.** `lib/event-account-link.ts`
step 1 stamps the address onto the guest row **before** it generates any mail,
with the identical `.is('email', null)` fill-a-blank rule, and **all three** join
endings already call it. The feature worked.

🔑 This is the failure this repo already writes down — *a sentence is not a
mechanism; grep the WRITER* — and I quoted that rule in the PR body while
committing it.

⚠ **It was not harmless.** A second writer is two places to keep in step, and mine
wrote at INSERT time while the real one writes on UPDATE — and production carries
a trigger firing `BEFORE INSERT OR UPDATE OF email` that binds the guest to a
person identity. So the duplicate quietly moved WHEN that binding happens.
**A redundant write is not a no-op when something is listening.**

What replaces it is a guard that would have caught me: the join door must contain
**zero** direct writes of a guest email, all three endings must reach the one
writer, and that writer must keep both its write and its fill-a-blank rule.

5 sabotages, all landed by occurrence count, all RED — including both shapes of
the duplicate I shipped.

SPEC IMPACT: None.
