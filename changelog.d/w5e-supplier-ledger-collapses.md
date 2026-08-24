## 2026-08-25 · fix(budget): a supplier is a ledger row — summary first, history on demand

Every supplier card on the budget screen held its full line-item table and its
dated payment log open at once. A couple with eight suppliers scrolled past
eight open ledgers to reach the eighth, and the running figures at the top of
the screen were long gone by the second one.

Each supplier card is now a disclosure. Collapsed it still carries everything
the Ledger archetype puts on a row — who, what kind of supplier, where the
booking stands, and **Budget / Paid / Remaining** — and the line items and
payment log open on a tap. The archetype's own words (designer's note 3):

> Summary first, history on demand. Each row expands to its dated payments and
> receipts; collapsed, the ledger stays one screen of truth.

**Not a client component.** `<details>` is the browser's own disclosure, so the
card stays a server component, keeps working with no JavaScript, and announces
its expanded state without an ARIA attribute. The forms inside are the same
server actions, unmoved.

**The workspace embed does not collapse** — it already renders inside that
page's own Payments disclosure, and a second one is a door behind a door. The
guard asserts that direction too.

New guard `app/dashboard/[eventId]/budget/the-supplier-ledger-collapses.test.ts`
pins ORDERING, not presence: the money must sit ABOVE the fold and the history
below it. Collapsing cannot rot silently — the screen visibly changes — but
which side of the fold the money is on can, and a collapsed row with no amounts
is a ledger with nothing to scan.

⚠ Evidence grade: source-derived. This card sits behind a login, so nothing here
was observed in a browser.

SPEC IMPACT: None — this closes a delta against an already-approved archetype.
