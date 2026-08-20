## 2026-08-20 · feat(frontdoor): the "Your people" chip — stories by people you already know

Owner 2026-08-20, having rejected his own word for it (*"connected seems like a
wrong terminology"*), then: **"your people - yes"**. Same message: **"keep
marketplace now"** — the Marketplace destination is confirmed and untouched.

A fifth chip over the one shelf, second in the row because it is the only chip
about the *viewer* rather than about a kind of piece.

### The one property that makes it safe

**It NARROWS an already-public shelf. It never fetches a story.** The page has
already loaded the pieces every stranger sees; `lib/your-people.ts` only answers
*"which of those were written by one of your people?"* A bug can hide a public
story from a friend. It cannot surface a private one, because no query in that
module reads content at all — pinned by a test that fails if it ever does.

### 🚨 RLS would have been the bug, not the fence

Both policies the membership reads sit behind end in `OR is_admin()`:

- `member_reads_membership` — `user_id = auth.uid() OR event_id IN current_couple_event_ids() OR is_admin()`
- `community_roster_member_read` — `community_id IN current_community_ids() OR is_admin()`

**Production has an admin who is also an ordinary user — the owner's own
account, the one he tests with.** A read that leaned on RLS would have handed
him every event membership and every samahan roster in the database, so "Your
people" would silently have meant *everybody*, for exactly the person who asked
for it. Same shape as the 2026-08-12 defect where My Shop read every other
shop's correction requests. Every read now scopes itself explicitly from ids
derived from a `user_id = me` read; a guard walks each query chain and fails if
one is unscoped.

### Who counts — and the group deliberately left out

Only people the viewer **can already see**: co-members of events they
**organise**, co-members of their samahans, and confirmed person-connections
(still behind `peopleConnectionsEnabled()`, Phase 2).

⛔ **NOT the other guests at an event they merely attend.** A guest cannot read
that member list, so counting those people would let them infer from a chip that
a stranger is also attending — a disclosure the product makes nowhere else.
**The omission is the decision; do not "fix" it with the admin client.**

### Failing closed, and three empty states

`fromYourPeople` is optional and compared `=== true`: a caller that has not
computed it, or whose read failed, yields an empty shelf — never a stranger
mislabelled as a friend. The chip is signed-in only, though a hand-typed `?c=`
still answers.

🔑 **The empty shelf is the NORMAL answer today, and it needed its own words.**
Measured in production: 9 accounts, 9 events holding exactly **one** person
each, **zero** samahans, **zero** connections. So every account lands in the
empty state, and the generic "try another chip" would read as a broken filter.
Three states, three sentences: sign in · we couldn't check (never "you have
nobody") · nobody you know has shared one yet.

SPEC IMPACT: None (front-door composition; no SKU, price or schema change).
