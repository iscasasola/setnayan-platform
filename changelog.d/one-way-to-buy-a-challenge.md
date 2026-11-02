## 2026-08-29 · refactor(vendor): one way to buy Papic Challenges — the retired per-event door is closed

**SPEC IMPACT:** `DECISION_LOG.md` row 2026-08-29 (owner ruling). No price moves.

**Owner 2026-08-29, verbatim:** *"vendors only purchase papic challenges for a 4-week subscription."*

The BUY path already matched — nothing has been able to buy a per-event sponsorship since
`20271181420277`. What did not match was the **entitlement**: that migration deliberately kept a
second arm honouring a legacy ₱400 `papic_photo_challenge_sponsorships` row, reasoning that a
repricing must never retroactively unsell something somebody had already bought.

That reasoning was right, and the arm was provably dead:
- **zero rows in production, ever** — nobody bought one;
- **zero writers left anywhere** — activation stamps the 28-day window on `vendor_profiles` now,
  the free-cycle path does the same, and no other caller exists.

🔑 **A read arm whose only writer is gone can never be true.** Keeping it left the gate saying there
were TWO ways to be entitled when the owner's rule says one.

🔑 **THE SHAPE, because this repo usually meets it from the other side:** this is a *gate with no
handle*, inverted. The familiar instance is a COLUMN nothing writes, so a feature is permanently off
and looks unused. This is a PERMISSION nothing can grant — same absent writer, but it reads as a
deliberate second door rather than as debt. **Both are found by grepping for the WRITER, never for
the column.**

### Details

- The signature of `vendor_papic_challenge_entitled(uuid, uuid)` is **deliberately unchanged**.
  Narrowing it means DROP + CREATE, which drops the grants with it, and both callers are
  `SECURITY DEFINER` RPCs. `p_event_id` is accepted and documented as ignored, so entitlement can
  become per-celebration again without a drop/recreate.
- ⛔ **The table is NOT dropped.** Its policies, grants and indexes are inert with nothing reading
  them, and dropping a table is a one-way act this change does not need. It carries a
  `COMMENT ON TABLE` saying it is retired, empty, and must not be written — **named as debt in the
  place a reader actually queries**, since applied migrations are never edited.
- A stale comment in `sku-activation.ts` still described the hook as writing a per-(vendor, event)
  row. Corrected: it stamps the window.

### Verification

`tsc --noEmit` exit **0**, 0 errors · `test:unit` · `test:db:ci` · all **30** CI guard scripts.
**Mutation, occurrence-counted:** re-adding the second door (0 → 1) turns *"THERE IS ONE WAY IN"*
RED.

⚠ **One existing assertion was INVERTED, by an owner ruling, and kept rather than deleted** — it read
*"a legacy ₱400 per-event sponsorship is still honoured"*. It is now the guard that the rule is
EXACT: reintroduce a second door and it goes red.

⚠ **And one of my own new assertions was wrong, and the suite said so.** It demanded ZERO write
policies on the retired table; the table carries an ordinary `FOR ALL TO authenticated` policy gated
on `is_admin()`. The claim worth pinning is narrower — *no policy lets a vendor or a stranger write a
row* — and the corrected test enumerates every write policy and requires `is_admin` in its
predicate, so a future vendor-writable policy goes red.
