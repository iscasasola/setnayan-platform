## 2026-08-04 · fix(admin): search the job, not just the page name

The owner opened ⌘K, typed **"pending"**, and got *"Nothing called pending."* — with 80 destinations indexed, three of which are queues of pending things.

**People search for the job, not the menu word.** Matching on the label alone means you have to already know what the page is called, which is the exact problem the palette exists to remove.

Each destination now carries a haystack: its **name**, its **menu**, its own **description** (already written, in `ADMIN_NAV_DESCRIPTIONS` — free), and a short list of **words people actually type**.

**The name still wins.** Scoring is unchanged at the top — starts-with, then contains, then description/alias, then letters-in-order. Typing `pay` lands on **Payments** before every page whose description merely mentions paying.

Measured against the real tables:

| typed | before | now |
|---|---|---|
| `pending` | nothing | Verify · Payments · Approvals |
| `refund` | nothing | Disputes |
| `reconcile` | nothing | Payments |
| `keys` | nothing | Secrets & Rotation |
| `pay` | Payments · Payouts · Payment options | unchanged — name still wins |

### The alias list is deliberately small

A synonym table that tries to be complete becomes a **second vocabulary to maintain** — and this project already has one pair of vocabularies that drifted apart and made a whole surface unreachable for weeks. **Add a word only after someone typed it and found nothing.** That is how this entry got written.

The empty state now also says everything is browsable under **All surfaces**, so a miss points somewhere instead of dead-ending.

Verified: unit suite **6,529 pass / 4 fail** — the same four pre-existing `@electric-sql/pglite` module failures on unmodified `origin/main` · lint clean · zero typecheck errors · a11y adoption guard green.

SPEC IMPACT: None.
