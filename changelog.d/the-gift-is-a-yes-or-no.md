## 2026-09-09 · feat(exclusive): the Setnayan gift is a yes or a no, and the card says the true thing

The supplier's control over the Setnayan Exclusive was a 500-character free-text
box written in four places and rendered in three. It is now a boolean.

**Why a boolean and not a better box.** The owner settled the whole shape on
2026-09-09: the Exclusive is ONE thing — Papic credits (*"ok then only offer
papic credits. so it is simple and useful"*), sized at 40% of the booking fee
with 40% a ceiling and not a starting point (*"no. just max to 40%. nothing
more."*), capped at the 50,000-credit rung, and computed from what the supplier
actually pays (*"papic credits will be auto computed based on what they pay …
(so it is either a yes or a no)"*). There is no amount to type, no product to
pick and no top-up, so there is nothing for a text box to hold.

**The card promises no number, deliberately.** A card advertises before a price
is agreed, so any figure printed on it could be broken by a lower quote and
honouring it would breach the 40% ceiling. The card says *"Includes a Setnayan
gift — free Papic photos for your celebration, sized to the booking"*; the exact
count appears on the QUOTE. A guard asserts there is no digit in that line.

**The free text is retired as the CONTROL, not as DATA.** Production holds
exactly two service cards, both active, both carrying perk text, and NEITHER
offers Papic credits — `S89S-GZ6GJB1K5N` says *"Free 1-hour extension for
Setnayan couples"* and `S89S-811M6SWNPK` says *"FREE"*. So:

* the column stays, is still read, and is still revealed in chat unchanged;
* the new flag is `NOT NULL DEFAULT FALSE` and is **never backfilled** from it —
  a backfill would bill two suppliers 40% of their booking fee for a gift
  neither of them chose;
* the card face keeps a second branch, so both live cards keep the badge they
  have today;
* the manager shows a supplier their own retired wording, read-only, because a
  promise you cannot see is one you cannot know you are still bound to.

**Two defects found and fixed on the way.**

1. `save_vendor_service` still raised *"A Setnayan Exclusive perk is required to
   publish this service."* PR #5373 moved the publish TRIGGER and the TypeScript
   but not this function, and `commitVendorService` publishes THROUGH it — so
   the "gift is optional" ruling was unreachable on the main save path. This is
   the exact "app says yes, database says no" failure 20271215941485's own
   docblock warns about.
2. That RPC's UPDATE assigned `exclusive_perk_text = v_perk` unconditionally, so
   a payload **without** the key wrote NULL. The moment the editors stopped
   sending the field, the next save of either live card would have erased its
   promise silently. An absent key now means UNCHANGED; a present key still sets
   or clears.

**Verification.** 9 unit guards + 4 DB guards that run the real RPC against
replayed migrations. All 13 mutation-tested — each guarded thing was broken and
each guard proved to go red (occurrence counts recorded in the PR). One guard
was decoration when first written: it searched the migration for an `UPDATE` and
went red on correct code, twice; it now asserts on parsed statements.

`vendor_services` holds a **table-level** SELECT grant for `anon` and
`authenticated` — verified against production, unlike `events`, which holds a
per-column allowlist (174/194 columns) where a missing `GRANT SELECT (col)`
makes PostgREST refuse the whole query. So no per-column grant is needed here.
The exposure baseline widens by **exactly one** line:
`col public.vendor_services.includes_setnayan_gift anon=SIU authenticated=SIU`.

The port-control baseline records one deliberate removal, `ExclusivePerkField`.

SPEC IMPACT: `DECISION_LOG.md` gains the build row for the yes/no control;
`BUILD_PLAN_Chat_And_Exclusive_2026-09-09.md` § C1 is superseded (it still says
the Exclusive is a pick from five and mandatory, both overturned the same day).

## 2026-09-10 · fix(vendor-services): the yes/no migration keeps the save function's "Service not found" refusal

Landing check before merge found that the copied save function had dropped the
refusal every definition since 20270208451790 carries: a save naming a card the
shop does not own (or one deleted mid-edit) would have written child rows
against a NULL id and returned NULL as if it had saved. Restored in the
not-yet-applied migration and pinned by a db test (mutation: removing the
RAISE, count 1 → 0, turns the test red). Rehearsed against production inside a
rolled-back transaction: the gate keeps the price rule and drops the gift rule;
the save drops the gift rule, keeps the not-found refusal, keeps its
service_role-only grant, and preserves both live cards' gift wording on a save
that does not mention it. The only lines of the live body that change are the
gift rule, the perk assignment, and the new column.

SPEC IMPACT: None (restores existing behaviour; no product change).
