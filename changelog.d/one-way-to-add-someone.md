## 2026-08-21 · fix(people): adding someone now actually reaches them, and a single person is never asked to name a spouse

Owner, looking at the People page: *"how can we add other users?"* and then
*"Adding people, connecting them as family, no spouse (if status is single),
they become married after wedding event or manually change it. friends,
dependents (alaga)"*.

**Three defects, none visible from the screen.**

1. **"Send request" told nobody.** It wrote a row in `person_connections` and
   stopped — no email, no notification — and the launcher counts only
   *confirmed* connections, so a request landed where nobody would ever meet it.
   The alaga rows on that same page have shipped a copy-link + email-it pair
   since 2026-07-17; the connection half never got one. Every add now ends in a
   branded invitation, and the screen reports whether the send actually left
   (`sendEmail` returning `{ok:false, reason}` is surfaced, never swallowed).

2. **You could only add somebody who already had an account, and were not told
   so.** `kin_pilot_mutual_accounts` (the owner-as-DPO pilot boundary, migration
   `20271026100000`) refuses a connection where either endpoint is an unclaimed
   person — deliberately. But the old action called the find-or-create resolver
   FIRST, so typing a stranger's address **minted a person node holding their
   email** and only then hit the refusal, which surfaced as *"Couldn't send the
   request."* The one thing that survived was exactly the record the pilot
   boundary exists to prevent. The order is now: **look up, never create** →
   they have an account? store the claim and tell them : store **nothing** and
   invite them to join.
   🔒 **Both branches return the same shape and the same sentence** — otherwise
   the box answers *"is this address registered?"* for anyone who types one in.
   `addConfirmation()` takes no branch argument at all, and a unit test pins its
   arity so a future edit cannot make it an oracle.

3. **The person being asked could not see who was asking.** `Someone added you
   as their spouse` with Confirm/Decline under it — because
   `visible_connection_names` resolves names across CONFIRMED edges only, and
   the edge being answered is by definition not confirmed. Migration
   `20271151915662` adds ONE case, strictly one-directional: the person a
   *pending* claim is about may see the name of whoever made it. **Not the
   reverse** — that would turn the add box into a name lookup for any email on
   earth. Drafts and declined edges resolve nothing, either way.

**The spouse rule** (`lib/people-add.ts` · `lib/people-spouse-context.ts`): the
Spouse chip appears only when the account's civil status says `married` **or** a
wedding they are a partner in has already happened. `null` reads as not-married
(every account today), and a failed read lands in the same place — a denial can
hide the chip, never invent one. The UI gate is courtesy; `addPersonConnection`
recomputes the same rule from the same helper and refuses a posted value.
`civil_status` is sensitive PI under RA 10173 §3(l), so this READS it and never
writes it; the wedding path is derived per request, never stored.

**Also:** relationship chips instead of a dropdown (one tap on a phone, every
option visible, each with a line saying what it means); a name field, so the
person is more than an address; a real success/failure message where the input
used to just clear; **Send again** and **Withdraw** on a waiting request (a
forward primitive with no inverse is how a person ends up unable to un-ask); and
Remove on a confirmed one.

Tests: 13 unit (`lib/people-add.test.ts`), 10 db
(`tests/db/connection-name-visibility.db.test.ts`). Both migration mutations
measured by occurrence count — reversing the pending leg (2→1) turns 4 tests
red including both directional ones; deleting it (1→0) turns 3 red.

⚠ **Named, not built:** during the pilot you still cannot write down a relative
who is not on Setnayan — the guardrail's cost, stated in its own migration
("for a pilot that is the right trade; for the full product it is probably
not"). Ending it is one `DROP TRIGGER` **plus a recorded owner decision**, so it
is deliberately not in this PR. The `draft` status — private to its author, in
the schema and in `kinship-derive.ts` since day one, still with **zero writers**
— is what that decision would unlock.

SPEC IMPACT: `DECISION_LOG.md` — the spouse rule (no spouse while single;
married by the wedding day or by the profile), and the one-directional amendment
to the 2026-07-05 name-visibility rule.
