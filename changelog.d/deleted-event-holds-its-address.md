## 2026-08-12 · fix(routing): a deleted wedding's address was free the same second

Owner, 2026-08-12: *"a retired website address will only be usable again after
1 year."*

**Measured in production before writing this:** `bbgh` — the final address of a
wedding that has since been deleted — was **claimable right now**. Not held, not
reserved, not live anywhere. Anyone signing up could take it, and every
invitation, save-the-date and printed QR carrying it would land a guest on a
**stranger's page**.

Every *other* retirement already satisfied the rule:

| retired how | held |
|---|---|
| wedding or handle renamed | 24 months (the forwarding window) |
| shop address corrected | 24 months |
| shop closed | 12 months (owner-locked 2026-08-10) |
| **wedding deleted** | **0 — the hole** |

And deletion is the case with the *least* warning: a rename at least tells the
couple something is happening.

`event_closed` mirrors `vendor_closed` exactly, for the same reason: it
**forwards nobody** — the wedding is gone, there is nothing to forward to — it
only stops the word being reissued. The forwarding resolver filters to the three
bare types, so a hold is inert there by construction, while `findSlugConflict`
and `business_slug_is_available` match on `old_slug` with **no entity_type
filter**. Holds nobody, blocks everybody.

⚠ **The anonymous-draft sweep is exempt, with a written reason.** Those
addresses were never published, never printed, never shared — holding them for a
year would burn a real couple's natural address to protect a link that never
left the browser it was made in.

🛡 Two guards, both mutation-proved with the sabotage confirmed applied:
- The hold **blocks reuse** and **releases after a year** — including the
  counterweight (an expired hold must free the word, or the ledger is a one-way
  ratchet and no address ever returns).
- Every path that deletes an event must hold first **or appear in `EXEMPT` with
  a reason** — the guard is on the SHAPE, not the one call site I found, because
  *a forward primitive with no inverse* is a failure this repo already has a
  name for. Plus a precondition asserting the pattern still matches the known
  path, so it cannot go quietly blind.

SPEC IMPACT: DECISION_LOG.md — a retired address is unusable for at least a year,
now including deletion.
