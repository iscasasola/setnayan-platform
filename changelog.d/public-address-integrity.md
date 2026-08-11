## 2026-08-11 · fix(routing): a renamed address forwards — for the first time, and for two years

**The promise was printed on two screens and had never once been kept.**

Changing a wedding's web address, or a person's handle, writes a forwarding row
and tells the owner the old link keeps working. The only reader returned `null`
on its first line unless `NEXT_PUBLIC_U_NESTING_CUTOVER` was on — and that flag
has never been on in production. So every renamed address 404'd, while the word
itself was retired out of the pool to protect a redirect that did not exist.
Person handles were worse: same rows written, **no reader at any flag setting**.

- `lib/slug-forwarding.ts` (new) — `resolveRenamedPath`, ungated, covering
  **events, shops and people**. Resolves through the ledger's `entity_id` to the
  entity's CURRENT address, so a chain of renames lands on the live page rather
  than on a second dead word. Runs only on the miss path, so it adds no query to
  any page that renders.
- **A forward can never shadow a live page.** The resolver refuses if the word
  is still somebody's live address, and fails CLOSED on an unreadable probe.
  This matters because the database's own auto-mint does not consult the
  forwarding ledger at all (fixed separately).
- `app/[slug]/page.tsx` + `app/u/[userSlug]/page.tsx` — both miss paths now
  forward before they 404.
- Closed-shop holds (`entity_type='vendor_closed'`) are deliberately NOT
  forwarded: a closure sends nobody anywhere, it only holds the word.

**Window raised 90 days → 24 months** (`20271132344178`). Save-the-dates go out
6–12 months ahead, so a 90-day window could not cover the printed QR it exists
to protect: a wedding invited in January and renamed in March went dark months
before the guests travelled. Renames already made are extended to the same
window — the promise applies to whoever it was made to.

🔒 The owner-locked **one-year closed-shop hold is untouched** and verified
independent: those rows set their expiry explicitly and never read this default.
A db test pins that the two numbers cannot converge unnoticed.

🛡 Guards, all mutation-tested (sabotage applied and confirmed red, then
restored): `lib/slug-forwarding-window.test.ts` fails if either promise screen
hard-types a duration instead of deriving it, and
`tests/db/slug-forwarding-window.db.test.ts` **measures what the column default
DOES** — inserts a row and asks Postgres how far out it landed — rather than
string-matching the default's text.

⚠ Verified against prod, and one brief-claim corrected: the single forwarding
row in production points at an event that has since been **deleted**, so no live
visitor is currently stranded. The mechanism was dead regardless; the next
rename is what it would have cost.

SPEC IMPACT: DECISION_LOG.md — retired-address forwarding window is 24 months
(was 90 days, never enforced).
