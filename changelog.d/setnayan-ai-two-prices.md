## 2026-08-12 · feat(pricing): Setnayan AI costs less when bought at sign-up

Owner ruling 2026-08-12. Buying Setnayan AI while creating the event is cheaper
than switching it on afterwards, per event type:

| tier | event types | at sign-up | regular |
|---|---|---|---|
| A | wedding | ₱1,499 | **₱2,499** |
| B | debut · corporate · gala night | ₱899 | **₱1,499** |
| C | christening · birthday · celebration · travel · anniversary · graduation · reunion · *and any unknown type* | ₱499 | **₱899** |
| D | tournament · gender reveal · date · hangout | ₱99 | **₱199** |
| E | simple event | not offered — no vendors, nothing to plan | — |

**Nobody pays more at sign-up than before.** The sign-up ladder is the previous
one unchanged; only the later price is new. Prod: 0 events have ever had Setnayan
AI and 0 orders exist, so nothing re-prices under anyone.

### `retail_price_php` becomes the REGULAR price, and that is deliberate

The alternative — leave retail at the cheap number, add a dearer "regular" column
— points the whole app at the discount by default. The public pricing page, the
homepage, the services suite and the add-on list all read `retail_price_php`, so
each would advertise ₱1,499 for something that costs ₱2,499 outside the sign-up
flow. That is the misleading direction: quote low, charge high. Storing the
regular price as the headline means an un-updated reader **over**-quotes and the
customer is pleasantly surprised at sign-up instead of ambushed later.

### The discount is server-decided and cannot be requested

`priceContext` defaults to `'regular'` everywhere. Exactly one module may pass
`'onboarding'` — `lib/onboarding-services-orders.ts`, reachable only from the
server-side event commit, with nothing in a request body mapped onto it. A guard
greps the tree and fails if any other file asks for it. A new call site that
forgets the context charges full price: the safe direction.

### 🔴 Found on the way: the sign-up card had the bug its guard was written for

`setnayan-ai-price-display-matches-charge.test.ts` exists because the studio page
resolved the price **ungated** while checkout gated on a flag — showing ₱99 and
charging ₱1,499 on a `date` event. The onboarding card was doing exactly the same
thing, and the guard never looked at it: it named the studio page only. Both
surfaces now go through the one shared resolver, and the guard covers both.

🔑 **A guard is only as wide as the surfaces it names.**

### Guards added, all mutation-tested

- the sign-up card must use the shared resolver, in onboarding context;
- what the card SHOWS is the context checkout CHARGES;
- only the event-commit module may request the discount;
- the two ladders may never cross — a sign-up price above its regular twin would
  punish buying early — and both must descend A→D with E at zero.

⚠ One guard failed on its **own assertion string** first time round: it grepped
for the discount request and found itself. Test files are excluded now. Same
family as a check satisfied by the comment explaining it.

### ⚠ A correction to this PR's own migration comment

The first draft asserted that a new column inherits no column-level grant, so the
`GRANT SELECT` was load-bearing and INSERT/UPDATE were "deliberately not granted".
**Both halves were wrong here.** `relacl` on this table reads `anon=arwdDxtm` —
grants are TABLE-level `ALL`, so the new column is covered the moment it exists,
and it inherits INSERT/UPDATE whether or not we want them. They cannot be
subtracted per column, and revoking at table level would strip all 17 columns at
once. The exposure baseline therefore records `anon=SIU`, matching the 16 columns
beside it; the writes are refused by RLS, which has no write policy at all on this
table. The grant is kept as insurance for the in-flight anon-grant cleanup, and
the comment now says so.

🔑 **Read the actual grant LEVEL before reasoning about inheritance** —
`information_schema.column_privileges` renders both cases identically.

Migration `20271139128584`, dry-run against production in a rolled-back
transaction before pushing: DDL accepted, ladder correct, prod untouched.

Verified: 7707 unit · 1185 db · `tsc --noEmit` clean · eslint 0 errors · migration
guard + 6 lint scripts pass · exposure baseline regenerated in this PR, delta is
one line.

SPEC IMPACT: Prices live in the catalog, never in a doc — nothing to mirror. The
owner ruling is recorded in `DECISION_LOG.md` 2026-08-12.
