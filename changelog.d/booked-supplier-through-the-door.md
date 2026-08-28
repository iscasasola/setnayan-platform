## 2026-08-27 · fix(slug): a booked supplier gets through the door on a private celebration

A supplier the couple has BOOKED could open the couple's private event page —
and was then refused every sub-page of it. No venue address, no recap, no seat
finder, no live hub, no money-gift page, no keepsake. **Measured in production
today: 3 of the 5 events are private** (the corpus's "4 of 6" is stale).

### One rule, written twice, and the copies drifted

"May this person read this celebration?" was answered in two files from the same
five facts: inline in `app/[slug]/page.tsx` for its own lock screen, and in
`canViewSlugEvent` (`lib/slug-access.ts`) for the seven sub-routes. On 2026-08-17
the page grew a fifth way in — the booked supplier — and the shared gate never
did.

🔑 **NOTHING REPORTED IT AND NOTHING COULD.** Every one of those refusals is
byte-identical to what a stranger gets, deliberately: a refusal that explains
itself is how the existence of somebody's private celebration leaks. A gate that
is wrong in this direction is **silent by design**.

The rule now lives once, in a pure `lib/closed-event-admission.ts`, and both
sides ask it. Each side still resolves its own FACTS — lazily, stopping at the
first true, because the rule is an OR.

⛔ **The obvious guard could not be written.** "Feed one fixture to both gates
and assert they agree" is impossible here: `slug-access.ts` is `server-only`,
which in this repo **cannot be imported by a `node:test` file at all**, and the
page's copy sits inside a 1,000-line server component. So agreement is
structural instead of asserted, and the guard pins that both sides still call
the rule and still resolve **every fact it takes — derived from `NO_CLAIM`, not
hand-typed**, so a sixth fact fails the test until both sides establish it.

### The same shape one level down — and this half was a live disclosure

"Is this viewer a booked supplier?" was answered in **three** places, and two of
them asked whether a **LINK** existed rather than whether the couple had booked
anybody. `lib/reusable-bookings.server.ts` mints a linked row at
**`'shortlisted'`** for a reuse offer the couple has still to lock. So on those
two copies a supplier the couple was merely **considering**:

- was shown the doorway strip that says, in words, **"You are booked here"**; and
- counted as one of "the people of this celebration" through
  `belongsToThisEvent` — **the single boolean that gates a keepsake story the
  couple restricted to exactly those people**, on the screen and at
  `/{slug}/print`.

The strict copy, one file away, had asked the status all along.
🔑 *A rule written three times had two copies laxer — and the lax ones were the
two deciding a disclosure.*

There is one read and one predicate now (`lib/booked-supplier.ts`,
`viewerIsBookedSupplier`). It moved out of `app/[slug]/_lib/loaders.ts`, whose
own header forbids cross-route imports, and it is React.cache'd on
**(eventId, userId)** rather than on a client instance, so sharing no longer
depends on two callers holding the same admin client — a `/{slug}/print` request
now asks once where its visibility gate and its audience gate used to ask twice.

### 🪤 The guard found a fourth surface the hand list had missed

The scan started as three files named by hand. Walking the tree for the fact
turned up `_components/site-body.tsx` — the one feeding it straight into
`belongsToThisEvent` — which nobody had thought of. The check is derived now: it
reads every ASSIGNMENT of the fact anywhere under `app/` + `lib/` and allows
exactly two ways to establish it (ask the shared question, or take it from a
`VendorCapability`, which is itself gated on the status). *A hand-typed list is
a list of the surfaces somebody thought of.*

### A comment that had become false

`page.tsx` justified a shortcut on the money-gift door with *"the gate at the top
of this function has ALREADY proved the answer is yes"* — true when written, and
untrue from the moment this page grew an arm `canViewSlugEvent` did not have. A
booked supplier passed the gate, took the shortcut, and was drawn a **"Send a
blessing"** card leading to a page that redirected them straight back out. The
shortcut is sound again only because both gates now decide through one rule; the
comment says so, and says when it would become a lie again. (The hub's
identically-worded shortcut was checked and is genuinely sound — it asks
`canViewSlugEvent` itself.)

### What did not change

🔒 **The return is a plain boolean.** A refused supplier gets byte-identically
what a stranger gets. A reason object would travel to a surface, and the surface
would say something a stranger would never be told.
🔒 **'private' still does not admit somebody merely for being on the guest list.**
That arm is still 'invited_accounts' only — the visibility has to allow it, not
only the fact, and that condition moved INTO the shared rule so the two surfaces
cannot disagree about it.
🔒 **Being on the list no longer shares a variable with holding a seat.** The page
used to write `isInvitedAccount` back into `isSeatHolder`; two different claims
in one flag is how a later edit hands the weaker one the stronger one's surface.
🔒 **No schema change, no migration, no RPC.** The SQL facts this decision is made
from are already pinned by `tests/db/booked-supplier-reads-private-event.db.test.ts`
— including the shortlisted-reuse row and the two-rows-one-supplier case — so no
db test was added rather than duplicating them.

### 🔢 Safe by arithmetic, measured in production today

**45 `event_vendors` rows · ZERO carrying a `linked_vendor_profile_id` · zero
linked-and-committed.** 44 of those rows are names a couple typed into a list and
the 45th is a seeded test row, so the booking read returns null for every account
that exists and **this change admits nobody new today**. It is right for the
first real booking, not a repair to a live admission. Events: 5 total, 3 private,
none `'invited_accounts'`.

⚠ **The narrowings are the half that CAN bite today, and they bite nothing
either** — with zero linked rows, no capability and no `belongsToEvent` supplier
arm has ever been true in production.

### Verified

`tsc` **errors=0, EXIT=0** — and the first run of it exited **134 with a
completely empty log**, which reads exactly like a clean pass. Ten typechecks
were running on this machine at once. *An empty tsc log is not a clean tsc log.*

**8 mutations, occurrence count printed 1 → 0 on every one, all RED:** the rule's
supplier arm · the rule's invited-account visibility condition · the gate's fact
resolution · the page's fact resolution · the shared predicate's status test ·
the capability's status test · the print sheet reverted to the link · the page
reverted to a hand-written OR chain.

SPEC IMPACT: None (access gate; no SKU, price, schema or owner decision).
