## 2026-09-16 · fix(invitation): the printed card says the whole name

### 🔴 What was shipping

`dashboard/<eventId>/invitation/print/page.tsx` prints one card per guest — QR,
name, role — and it printed **`guestDisplayName`**, the COMPACT name.

Measured against a real event the same day: **73 of 77 guests carry a title or a
suffix** (Atty., Comm., Associate Dean, II). So the sheet dropped a title for
**95% of the people about to be handed a physical card**, and principal sponsors
— whose titles carry the most weight at a Filipino wedding — are exactly who
receives one.

⚠ **A printed card is the one surface that cannot be corrected afterwards.** A
wrong name on a screen is an edit; a wrong name on 77 cards is a reprint.

### What ships

- **`printedCardName(guest)`** in `lib/guests.ts` — the formal name, falling back
  to the compact one. 🔑 **It is a function, not an inline `??`,** because which
  name a surface wants is a *judgement about that surface*, and the judgement is
  the part that can be got wrong — so it lives where a test can **execute** it
  rather than in a server component a test can only grep.
- ⚠ **The fallback is not decoration.** `guestFullName` returns `null` when every
  part is empty; without it a nameless row prints **blank beside a QR code** — a
  card nobody can hand to anybody, which is worse than the compact name.

### ⚖ The narrowing is part of the decision, and it is asserted

The dashboard table at `../invitation/page.tsx` **keeps the compact name in all
of its call sites** — it is a management row, not a card, and a title there is
noise on every line. The plan was to change both; reading them changed it.

🔑 **Widening the compact name would move every name in the product at once,
which is the whole reason the two functions exist apart.** A future sweep that
"fixes" the table now **fails a test and has to argue**, rather than quietly
putting *Atty.* on every row.

### Guarded

**Four tests**, sabotage-checked three ways — print sheet reverted to compact
→ **3/1**; helper made to return the compact name → **3/1**; the table swept to
formal → **3/1**; restored → **4/4**. Also held: a `display_name` the couple
typed wins over the assembled parts, so *"Tita Baby"* never acquires a title she
never asked for.

⚠ `stripComments` pads with spaces — the source guard collapses whitespace
first, and the prose deliberately names both functions, which is exactly why the
source must be stripped before it is matched.

SPEC IMPACT: applies the 2026-09-15 compact/formal split to the first surface
that needed it; no new decision. Row in `DECISION_LOG.md`.
