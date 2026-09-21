## 2026-09-22 · feat(overview): one decision list, not a preview of itself

**PR 2 of the Overview redesign** (owner-approved 2026-09-22, off
`prototypes/event_overview_redesign_2026-09-22/`).

The bento's "Needs you this week" tile printed `flatDecisions.slice(0, 3)` — the first three rows of
the Decisions board that sits a few hundred pixels below it — and then **"All N decisions ↗"**, an
anchor to a list already on the same screen.

Measured live 2026-09-22 on event `044f7e64`: **"Lock your coordinator" rendered three times** on one
page (digest, Today's one thing, board) and **"Papic Guest 500" three times** (digest, board, and
inside *Your services* when expanded). The council's own de-dup rule already said the bento is
**STATUS** and the board is **ACT** — a preview of the board is the board, in the status slot.

**The tile keeps the number and loses the rows.** It now reads
`4 open decisions · ranked · 6 dates coming` with one way in — *"Open the list ↗"*. The board is
unchanged. `flatDecisions` is deleted, binding and all: with one rendered list there is nothing left
to keep in sync and no second flattening of the same data to drift.

🔑 **The RSVP chase stayed, and it was in the wrong branch.** *"77 guests haven't replied yet"* is
deliberately **not** a cockpit decision and **not** in `openDecisionCount` — so the board never
carried it, and deleting the preview would have deleted its only home. Worse, it was nested inside
`flatDecisions.length > 0`: an event with **no open decisions and seventy-seven unanswered
invitations** rendered *"Nothing needs a decision right now"* and said nothing about the RSVPs. It is
now a sibling of that branch, and its gate moved into a pure module
(`lib/one-decision-list-not-two.ts` · `shouldChaseRsvps`) **that does not take the decision count as
an input** — so the bug is no longer expressible.

**Guarded and probed.** `lib/a-date-is-not-a-decision.test.ts` gains two tests: the gate is executed
across all four arms (party over · nobody outstanding · nobody has replied yet · the live case), and
the source is asserted to hold exactly **one** `decisionGroups.map(` call site and **zero**
`flatDecisions` bindings, with both counts printed. Sabotage: re-introducing the flattening goes
🔴 red.

**No route lost a way out.** `lint-port-no-lost-controls` passes — its rule is that every
*destination* a route offered must still be offered, and all three preview links pointed at rooms the
board still links to on the same route.

SPEC IMPACT: None beyond the 2026-09-22 `DECISION_LOG.md` rows already applied for PR 1.
