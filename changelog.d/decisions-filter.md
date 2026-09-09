## 2026-09-09 · feat(chat): a conversation can be filtered to just the decisions

Owner: *"anyway to filter what their current cards are for easier tracking? like
meetings, schedules, payments, quotes, adjustments? so it can eliminate other
conversation and just show what is the current verdict for those?"*

A three-way switch — **All · Decisions · Files** — above the conversation, on
BOTH sides and at every width. On Decisions every text bubble, system line and
day divider falls away and only the cards remain, oldest to newest, under one
standing line.

**Every entry says where it stands NOW, not what it said when it was sent.** A
quote sent in August and accepted on 1 September reads "Booked · Accepted ·
1 Sep", not "₱187,500 — quoted". Without that the filter is a tidy list of
stale announcements and is worse than scrolling, because it is trusted.

### The merge is the hard part, and it is one pure function

Two of the five kinds are **not messages**: the couple's logged payments and the
guest-count change are page sections rendered around the stream. `lib/thread-
decisions.ts` merges three sources into one dated timeline — no React, no I/O —
so the ordering, the attribution and every "now" line are testable, and the
couple's copy of the view cannot drift from the supplier's.

### Reused, not rebuilt

- The standing sentence is `standingSentence(buildSupplierStanding(…))` (S6),
  unchanged. One derivation, drawn on the bench card and here.
- The ladder is `resolveThreadStage` / `THREAD_STAGE_LABEL`. Only a **quote**
  may wear a stage pill — enforced by a per-kind capability table, not by call
  sites remembering. "Needs you" is an outline and a count, never a sixth word.
- The Files third is `buildSharedFiles` + `chatAttachmentHref` from PR #5362.

### Three measured findings that changed the build

1. **A reschedule destroyed the old time.** `respondToAppointment`'s
   `propose_new` overwrote `scheduled_at` in place, posted no message, and
   `event_appointments` had no history — so "shows the old time struck through"
   was undrawable from the database. New nullable column
   `previous_scheduled_at`, written in the same UPDATE that replaces the value.
2. **`fetchPendingVendorPayments` filters `vendor_confirmed_at IS NULL`.**
   Feeding Decisions from it would have deleted every settled payment from the
   record of what was settled. Decisions reads the table with no status filter.
3. **`/api/chat/attachment/<message_id>` does not exist.** It is PR #5339,
   still OPEN with typecheck failing. Files therefore links through
   `chatAttachmentHref` — the single migration point that PR will change — so
   this surface inherits the private route without being touched, rather than
   shipping dead links today.

### Two kinds deliberately absent

- **Offered services** (`offered_service_id`): the card resolves a
  `vendor_services` row and NOTHING closes, spends or accepts it. It has no
  state, so it has no current verdict — an entry for it would be a replayed
  announcement by construction.
- **`change_order_id`**: retired (`d3350b8e2`), nothing can create one.
  Decisions must not imply it exists.

### Open for the owner

The supplier's side shows **no standing sentence**. `buildSupplierStanding`
speaks in the couple's second person — "waiting on you" means the couple owes
the answer — so rendering it to the supplier would be backwards on the one rung
that asks anyone to act. Writing a supplier-voiced standing is a copy decision,
not a build one. The supplier still gets every per-entry "Now" line and the
"N need you" count, both viewer-correct.

SPEC IMPACT: None. No locked decision changes: the ladder, the standing
derivation and the retired change-order marker are all consumed as they stand.
