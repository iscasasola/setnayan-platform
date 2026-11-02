## 2026-08-25 · fix(access): a grant is not a withdrawal

Found by an adversarial audit of the same day's own merged work — CI was green
through all of it.

Yesterday's narrowing (*a delegate's grant means only what the host named*) made
an area missing from an `areas` map resolve to nothing. **Four write paths edit
one area by spreading `{ ...(perms.areas ?? {}) }` and setting a single key** —
and on a row that has no `areas` map at all, that writes a map naming exactly
one area.

So the couple press **"Allow event photos"** on their ninong's row, meaning to
give him one more thing, and silently take away the guest list, the seat plan,
the schedule, the suppliers, the invitations and the mood board. The button says
"Allow event photos". Nothing anywhere says what else happened. Before yesterday
that write was harmless, which is exactly why nobody re-read it.

🛑 **AND THE MIGRATION'S OWN HEADER SAID THIS COULD NOT HAPPEN.** It called a
row with no `areas` map *"the legacy shape, written before `areas` existed"*.
**The couple's own host-invite door mints one today** — it writes a bare
`PERMISSION_TEMPLATES[role]` for every role except the coordinator, and not one
of those eighteen templates carries an `areas` key. That sentence is corrected
where it can still be edited; the applied migration keeps the wrong one, which
is its own reason not to trust a migration comment.

**The fix is to materialise, not to exempt.** Widening the resolver back would
undo the owner's ruling. Instead `withArea()` writes down what the row already
resolves to for *every* area — identical to what it holds today, so nothing
changes hands — then changes the one line. An implicit grant becomes an explicit
one and the map stops being a cliff. It also freezes the row against areas added
later, which is the safe direction: `photos` shipped deliberately fail-closed
for the same reason.

🔑 **The call sites were enumerated from the COLUMN, not remembered** — every
writer of `permissions_json` — and the guard walks that same set rather than a
list I typed. It found a **fifth** site on its first run.

🪤 And that guard went red on **the comment I had just written explaining the
fix**, which quotes the broken pattern verbatim. It strips comments now.

⚠ One existing guard pinned the *spelling* of the line this replaces
(`areas.photos = grant === ...`). Its rule — withdrawal writes an explicit null,
never a deleted key — is unchanged and still holds; the assertion was moved onto
the new shape and a second one added that fails if the direct-edit shape returns.
Nothing was weakened to go green.

6 mutations, each measured by occurrence count before → after, all red —
including three that restore the shipped defect exactly. Unit suite 9923/9923.

SPEC IMPACT: DECISION_LOG.md — the 2026-08-25 W8 row's claim that no-`areas`
rows are a legacy shape is wrong; they are minted today by the host-invite door.
