## 2026-09-15 · feat(invitation): the entourage prints in pairs

Owner 2026-09-14: *"two columns, paired across. but if the other side is left
blank, then keep that line blank."* Then, 2026-09-15: *"already have some people
paired."*

🔴 **He had paired them, and the invitation showed nothing.** The pairing TOOL
shipped in #5489 — a migration, `pair_guests` / `unpair_guest`, a bulk control,
11 db tests — and the entourage section **never read `pair_with_guest_id`**. Five
real pairs sat in the database, invisible: a Ninong with his Ninang, three
sponsor couples, and a bridesmaid with her groomsman. The couple's work, silently
undone by a column nobody read.

### What now prints

- A pair shares one line, each in the column their role says: **Ninong left,
  Ninang right** — the order a Filipino invitation prints them.
- ⚖ **An unpartnered name keeps its line and leaves the other side blank.** An
  unpaired groomsman stays in the RIGHT cell rather than sliding left and
  appearing to be paired with the next bridesmaid.
- A group nobody paired prints as **one column**. Two columns with every
  right-hand cell empty is a table pretending to be a pairing.

### ⚖ Bridesmaids and Groomsmen are now ONE group

They were two. A bridesmaid pairs with a **groomsman** — two different roles —
so while they sat under separate headings, a pair could never share a line and
nothing said why. They walk in pairs on the day; they print in pairs here.

### The legacy sponsors sit left, unpaired, and that is honest

`principal_sponsor` (47 live rows) holds no gender — `side` is which family, not
who — so those rows take the left cell with the right one empty. Putting them on
a side would be **a guess printed on an invitation**. A couple who wants them
paired re-types the role; nothing here invents it.

### Guarded on both halves

`pair_with_guest_id` and `guest_id` join the read's column guard, because pairing
is resolved entirely from them: **a query that stops naming them makes every pair
vanish while the page stays perfectly formed** — the same shape as the five name
parts before them.

| Sabotage | Result |
|---|---|
| The query stops naming the pair columns | 🔴 red |
| The two columns lose their sides | 🔴 red |

Nine new tests use the **real pairs from a live wedding**, not invented ones —
including a **half-pair** (A points at B, B at nobody), which prints both people
once each rather than dropping one, and a pointer at somebody in another group,
which does not steal them.

⚠ Writes still go **only** through `pair_guests` / `unpair_guest`: mutuality is
not expressible as a row constraint, so two round trips leave a half-pair.

SPEC IMPACT: None beyond the owner's layout ruling, logged in `DECISION_LOG.md`.
