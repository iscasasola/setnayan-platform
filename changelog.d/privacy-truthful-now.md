## 2026-07-30 · fix(privacy): disclose the two live flows, and stop over-claiming on calls

**Owner standing rule, 2026-07-30:** *"we will do everything on january 2027 but let this run
truthfully until then."* The NPC **filing** work is deferred to January 2027 — the five DPO
lawful-basis rulings, adopting drafted ROPA rows 21/22/23, the Cloudflare-TURN subprocessor line,
the `same_date_demand` opt-out decision. What is **not** deferred is the product telling the
truth about processing that is live today. This PR is that half.

**Three corrections, all description-of-existing-behaviour — no judgment calls, no new gates:**

1. **The shared pool was undisclosed.** `papic_pool_gallery` has been ACTIVE in prod since
   2026-07-27: a guest's captures become visible to the *other signed-in guests of the same
   event*, not just the couple. `/privacy` said nothing. (Its existing "pool" mentions are the
   Live Studio **channel** pool — an unrelated thing.) Added to the "Photos and videos" section,
   including the limits that make it accurate: web copies only, after screening, never across
   events, and how to keep it off.

2. **Guest-written columns were undisclosed.** `guest_columns` has also been ACTIVE since
   2026-07-27, and it publishes a guest's words **to the open web** under a byline drawn from the
   event's guest list. New section stating the audience plainly, plus the two real mitigations
   (nothing publishes without couple approval and screening; the guest can withdraw at any time,
   and the row is purged with the guest or event record).

3. **The calls section contradicted itself.** It accurately described relaying media through a
   **Cloudflare** relay, then three paragraphs later claimed *"the media never reaches our servers
   at all."* On a relayed call it does traverse that relay. Rewritten to distinguish the direct
   case from the relayed one. "Calls are never recorded" stays — it is true, and the schema backs
   it: `thread_calls` holds only kind/status/starter/timestamps, with no media column.

**Also corrected two untrue engineering notes** in `lib/privacy-coverage.ts`: both controls' notes
claimed *"held fail-closed (control inactive AND env flag off)"* while both controls have been
**active in prod since 2026-07-27**. The notes now say which half of the gate actually remains
and record that the /privacy disclosure landed while the ROPA row waits for January.

**`declaredIn` stays `[]` on purpose.** Shipping a public disclosure is not the same as declaring
an activity to the NPC. The admin Coverage & drift tab must keep showing these two as undeclared
until the January filing carries them — a one-line edit would have turned it green without the
filing changing, and that was explicitly rejected.

Policy header date moved to 2026-07-30; a policy that changes without moving its date
misrepresents its own currency.

**Tests** — `lib/privacy-live-flow-disclosure.test.ts`, 5 cases: the pool disclosure names *who*
can see (not merely that a pool exists) and keeps its scope limits; the columns disclosure says
"open web" and "byline" and keeps both mitigations; the removed over-claim cannot return and the
accurate replacement is present; the last-updated date matches; and the coverage map still reports
the filing gap. Mutation-proved: deleting the pool paragraph → 1 fail; weakening "open web" → 1;
restoring the old calls clause → 1; reverting the date → 1; marking `papic_pool_gallery` as
declared → 1; restored 5/5.

SPEC IMPACT: `DECISION_LOG.md` row added 2026-07-30 recording the January-2027 split and what
verified as already-truthful (the Papic clip cap reads 10 s in all user-facing copy; the remaining
"5-second" strings are Pabati, a different SKU with a real 5-second limit).
