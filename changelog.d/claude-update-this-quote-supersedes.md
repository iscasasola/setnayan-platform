## 2026-09-18 · feat(quotes): a supplier can update a quote; the couple must accept it again (S5)

Owner, verbatim: *"they can do updates and must be reaccepted. so they can
negotiate of the benefits."* And, testing live: *"vendor cannot edit the
proposal."* He chose option (a): a new quote **supersedes** the old one, the old
one stays in the thread as history, and the couple's acceptance resets to
pending. One thread, one live quote.

Also fixes the owner-observed defect after #5586 served: the quote card read
"₱10,170 · Accepted" and still offered **Review & accept**.

- `supabase/migrations/…_a_revised_quote_must_be_accepted_again.sql`:
  `supersede_prior_vendor_proposals` now also retires an **accepted** quote,
  reverts the `event_vendors` shortlist the accept wrote (`shortlisted` →
  `considering`) and re-prices that row at the new quote's total, so a Lock can
  never book at a withdrawn price. It **refuses** (`deal_locked` /
  `lock_requested`) once the booking is confirmed or the couple has an open lock
  request at the accepted price. New `vendor_may_requote` asks the same rule
  before anything is inserted; both share `vendor_requote_blocker`.
- `apps/web/lib/quote-card-state.ts` (new, pure): what a quote card may offer,
  from status × latest × viewer × handshake. Pending → Review & accept (couple)
  / Update this quote (supplier). Accepted → no accept; the couple is pointed at
  "Ask them to lock" (the workspace page, which owns the lock gate — the thread
  does not book; in shipped code the couple asks and the supplier agrees).
  Superseded or any earlier quote → history, view only.
- `apps/web/app/_components/chat-message-stream.tsx`: renders the card from that
  rule; refetches every quote id on each message change so a superseded card
  repaints over realtime; new `reviseHref` / `lockHref` props.
- `apps/web/app/vendor-dashboard/messages/[threadId]/page.tsx`: `?compose=quote`
  opens Build-a-quote on the server, seeded from the live quote
  (`lib/quote-revision-seed.ts`: negative lines fold into the Discount field —
  a fixed line clamps at zero and would silently re-price the quote). Two new
  notices name the door that is open when a re-quote is refused.
- `apps/web/app/_components/proposal-maker.tsx`: `revision` prop — opens
  expanded, seeded, with a banner saying sending replaces the named quote and
  the couple must accept again.
- `apps/web/app/dashboard/[eventId]/messages/[threadId]/page.tsx`: resolves the
  workspace Lock link from `event_vendors` the way accept wrote it.
- `apps/web/lib/proposal-send.ts` · `vendor-dashboard/proposals/actions.ts`:
  pre-check before any write; the supersede error is read, not swallowed; an
  updated quote's card/notification says the earlier acceptance no longer stands.
- `apps/web/lib/thread-decisions.ts`: a `superseded` quote reads "Replaced by a
  newer quote" and asks nobody — it used to fall through to "Waiting on you".
- Guards: `lib/a-revised-quote-must-be-accepted-again.test.ts` (executes the
  card rule over 196 combinations and the seed; counts the wiring) and
  `tests/db/a-revised-quote-must-be-accepted-again.db.test.ts` (accept → re-quote
  → superseded/considering/re-accept; both refusals; own-profile only; a manual
  shortlist is never reverted).

SPEC IMPACT: `DECISION_LOG.md` — 2026-09-18 owner ruling recorded: a supplier
may update a sent or accepted quote; the update supersedes it and must be
re-accepted; a confirmed booking or an open lock request blocks the update
(changes then go through amendments / change orders).
