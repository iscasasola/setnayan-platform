## 2026-08-13 · feat(launcher): two shelves on the events board, and a card that says which side of the event you are on

Redesign Session 7 — *"the menu says which level you are on, and finished events
have their own place."* Mostly a reconcile: the two nav levels were already
correct and were **not** redrawn.

### Verified already shipped — nothing rebuilt (RULE 0)

- **ACCOUNT level** = the launcher's four areas (Events · Alaala · People ·
  Spaces) — `app/dashboard/(launcher)/page.tsx`.
- **EVENT level** = `customer-nav-config.ts`: Overview · Guests · Marketplace
  (key `explore`, href `{base}/vendors`) · Studio · Launch, plus the group headed
  *"Also in this event"* (Schedule · Seat plan · Budget).
- **Budget has no top-level PLAN row** (owner 2026-07-10) — untouched, and now
  guarded so a future "tidy-up" cannot promote it.
- **Studio → "Suite"** under `NEXT_PUBLIC_SUITE` in all three places that name it
  (rail · mobile SSOT · nav-registry defaults) — untouched.
- **The create grid already hides debut + christening** unless the account's
  People data says they concern it, with a permanent *"show all event types"*
  expander (`create-event/page.tsx` → `hiddenMeasuredTypes` →
  `event-type-picker.tsx`). Hidden, never locked. It is a no-op in prod because
  `NEXT_PUBLIC_DEPENDENT_PEOPLE` is off — the module's documented fail-open
  direction. **Nothing was built for this; a regression guard was added.**

### The delta

**1 · The board is two ALWAYS-PRESENT shelves.** *Coming up* and *Finished*
replace one Events block with a `?show=all` toggle. A thing you have to switch on
reads as a thing that might not be there — and prod holds exactly one finished
event: a wedding whose day has passed, i.e. somebody's memories, behind a link.
Ordering is unchanged (date DESCENDING, newest first, undated at the tail of
*Coming up* reading "Date to be set"). `ShowAllToggle` is deleted; a bookmarked
`/dashboard?show=all` still renders the board because the param is simply unread.

🔑 **The empty Finished shelf makes NO zero-claim.** `fetchUserEvents`
graceful-degrades to `[]` on *every* error including an RLS denial (6th-pass
hotfix 2026-05-23), so an empty shelf cannot be distinguished from a refused
read. The line therefore says what the shelf is FOR, and the old *"N finished
events hidden"* measured count is gone. Same rule the Alaala wall learned on
2026-08-12.

**2 · Every card names its stance, and goes somewhere that admits it.**
`/dashboard/[eventId]` admits `member_type = 'couple'` ONLY. Until now the board
asked for `'couple'` rows alone, so an event somebody had joined by scanning an
invitation QR was **invisible to them there** — the only surface that read guest
rows sits behind an off-by-default flag. Invited memberships now reach the board,
each card reads *"You organise this"* / *"You're invited"*, and the destination
comes from one helper:

- organiser → `/dashboard/<id>`
- invited → `/<slug>`, the event's own public page, where their photos, their
  table and their RSVP already live and the money + plan surfaces are **absent**
  rather than present-and-refused. Nothing new was built for the invited case.
- invited with **no slug yet** → *no link at all*. One prod event is in exactly
  that state (and it is the finished one), so a hardcoded path would have built
  `/null`.

An invited card also drops the `% planned` ring and "Planning underway" — those
describe somebody else's work.

🚨 **Two live 404 traps closed, same shape.** The ⌘K search index hardcoded
`/dashboard/${event_id}` for every row, and `autosurfaced-events.tsx` — whose
rows are *all* `member_type='guest'` — did the same, so *"a couple added you to
their event"* opened onto a not-found page. Identical to the harm Session 8 found
on an Alaala card on 2026-08-12 and deliberately did not propagate. The
auto-surface path is flag-dark, so nothing visible changes there today; the trap
is removed rather than left armed for whoever flips the flag.

⚠ **`vendor` and `coordinator` rows are deliberately NOT on this board.** Both
have their own doorways, and a coordinator reaches the event shell through an
accepted `event_moderators` row rather than through `member_type` — putting one
here would be guessing which door works. Named, not built.

⚠ **The landing auto-jump still reads organiser events only.** Folding invited
rows into `active` would have silently reversed the owner's single-event
auto-jump the moment somebody scanned an invitation.

### Guard

`app/dashboard/(launcher)/two-levels-and-the-board.test.ts` — 25 assertions, half
real function calls over `lib/event-board.ts` and half source-anchored on the
launcher, because **testing the primitive is not testing the caller**: a page that
stops *calling* a pure helper fails nothing.

🛡 **20 sabotages, every one occurrence-counted before → after, all 20 caught,
baseline green before and after.** Two of them were caught only because the count
was printed:

- 🪤 **One assertion was decoration.** `count(stanceLabel(stance)) >= 2` over the
  whole file — there are **three** call sites, because `StanceChip` uses the
  helper too, so deleting the stance line out of the phone chip left two and the
  guard stayed GREEN. Re-anchored to per-component slices. *A file-level count
  cannot say WHICH component still renders a thing.*
- 🪤 **One sabotage did not land** and would have been read as a pass: flipping a
  single undated branch in the sort changes **no observable order**, because the
  descending compare already sorts an empty date key last. Replaced with the
  regression that is real — flipping the sort direction — and the redundancy is
  now written down in `event-board.ts` so nobody "fixes" it into an inconsistency.

Also guarded, both previously unguarded and both already correct: every event-rail
destination stays under `/dashboard/<eventId>` (a tab press cannot drop which
event you are in), and **creating a trip is never refused** — with the
counterpart assertion that a second debut for the same honoree still *is*, so the
first cannot pass by gutting the gate.

`scripts/port-control-baseline.json` regenerated in this PR — the deliberate
removal of `ShowAllToggle` reads as one line in the diff, which is the mechanism.

Verified: typecheck clean · 7900/7900 unit tests · all 22 lint scripts · the exact
`fetchUserEvents` column list (now including `slug`) accepted as `authenticated`
in **both** the migration replay and live prod, so the new column is not a
phantom.

SPEC IMPACT: `DECISION_LOG.md` 2026-08-13 — the events board is two
always-present shelves, and a board card names whether you organise the event or
were invited to it (which decides where it may send you).
