## 2026-08-30 · feat(papic): the couple names guests and sets the numbers

Session **S3** of the shots-per-guest program (`WHATS_NEXT_Shots_Per_Guest_SESSIONS_2026-08-28.md`,
spec § 6a). S1 merged as PR #5002; **S2 — the storage and the gate — is being built in parallel.**

⛔ **THIS MUST NOT MERGE BEFORE S2.** Gate the write, not the button. A control that saves a number
nothing enforces is the `papic_uploads_open` defect this tree has already paid for once. Auto-merge
is deliberately NOT armed on this PR.

### What landed so far

- **`lib/papic-guest-allotments.ts`** — the split, written once: named guests first, everyone else
  divides the remainder equally, the indivisible remainder is spare. No imports, so the guard can
  EXECUTE the rule rather than match its text (same discipline as `papic-guest-cap.ts`).
- **`ALLOTMENT_STORAGE`** — every column name this feature writes, collected in one object, so
  adopting S2's real names is an edit to one file instead of a half-landed rename.
- **Sponsors default to a bigger share** — a role MULTIPLIER (principal 3×, cord/veil/coin/candle
  2×) over the ordinary share, never a hard-coded amount: "give a ninong 60" is extravagant at a
  40-guest civil ceremony and insulting at a 400-guest reception. It is a suggestion the couple
  edits, and a saved number always wins.

### Three findings that changed the work

1. **The vocabulary moved under the spec.** `32df56e81` (2026-08-29) made the currency unit a
   **credit** everywhere a customer reads it. The spec says "shots" throughout. Currency copy now
   reads credits — but a **photograph is still a shot** ("take the shot", "Next shot", the vendor's
   shot list were deliberately untouched), so this is not a sweep.
2. **`points` on the wire, `credits` on the screen** — an existing deliberate convention (212
   `points` occurrences in the migrations against their own "credit" comments), not drift. The
   contract module is where the translation lives, and it says so.
3. 🚨 **Three numbers call themselves "per guest", and two of them are 150.**
   `papic_event_pool_config.points_per_guest` (default 150) SIZES the pot —
   `pool = clamp(guest_count × points_per_guest, floor_points, ceiling_points)`.
   `GUEST_CAPTURE_CREDITS = 150` is what one guest may SPEND. They are different quantities holding
   the same value, so they have never visibly disagreed, and the pool migration's own comment
   conflates them outright (`20270826385580:20`). This control adds a **third** per-guest number,
   and the moment a couple sets it to anything but 150 all three diverge. The copy therefore never
   says a bare "per guest", and a guard asserts it.

### Proof

- **TESTS:** `lib/papic-guest-allotments.test.ts` — 8 tests, 8 passed, 0 failed (non-zero).
- **MUTATION:** 9 sabotages, every one RED, occurrence counts before → after:
  `Math.floor→Math.ceil` 1→0 (4 tests red) · blank-box-collapses-to-zero 1→0 · over-commitment
  clamped 1→0 · explicit number uncapped 1→0 · `principal: 3→1` 1→0 · `credits each`→`shots each`
  2→0 · storage borrows `points_per_guest` 1→0 · unnamed=0 early return deleted 1→0.
  ⚠ Two sabotages first reported GREEN and **both were broken sabotages, not surviving guards** —
  one perl escape never landed (before=1 after=1) and one replaced a docblock instead of the code
  (before=2 after=1). Re-run properly, both are RED. This is why the count is printed.

### Corrections to the corpus

- `WHATS_NEXT_Papic_Build_Order_2026-08-29.md:154` says nothing acts on `lib/event-sponsors.ts`.
  **Measured on origin/main: four non-test importers** — `sponsors/page.tsx`, its `actions.ts`,
  `add-sponsor-modal.tsx`, `pair-target-picker.tsx`. There is a shipped sponsors dashboard and the
  roles are real, user-authored data. Routed to the corpus owner.

SPEC IMPACT: The build order's "Nothing acts on it" claim for `lib/event-sponsors.ts` is false and
is being corrected by the session that owns that document. The shots→credits vocabulary shift needs
applying to both `WHATS_NEXT_Shots_Per_Guest_*` files, whose copy examples still read "shots".

### The sheet

A `SettingRow` in "Set once, change any time", beside the three choices it is a sibling of: the
switch, the number for everyone else, the guest picker with a per-guest amount, the live summary
line, and the "open the rest to everyone" button. No picker is redrawn — a row is another door to
the same control.

**The row is absent when there is nothing to decide, two ways.** No guest cameras on the event →
null, exactly as `GuestCamerasChoice` does. And until the ceiling migration is applied its columns
do not exist, PostgREST refuses the SELECT, and no row is drawn — the merge gate enforced by the
code rather than by a promise. If this reached production early a couple would see **nothing**,
rather than a control saving a number the database ignores.

**Outcomes:** `allotment_set` / `allotment_error` — `shots_set`/`shots_error` are taken by
`setCameraShots`, and sharing them would show one control's confirmation after another control's
save. Wired three ways; `outcomes-are-shown.test.ts`'s floor raised **19 → 21** deliberately.

### Proof, second pass

- **TESTS:** 1077 passed, 1077 total (`app/dashboard/**/*.test.ts` + `lib/papic*.test.ts`), and
  `outcomes-are-shown.test.ts` 7/7 on its own. All non-zero.
- **TSC_EXIT=0 · ERROR_LINES=0**, taken under a shared typecheck mutex because the ceiling session
  builds in parallel — two concurrent `tsc` runs abort at 144 with an empty log, which is
  byte-identical to a clean pass.
- **MUTATION (the wiring):** each of the three ways sabotaged independently, all RED —
  searchParams type 1→0 · page render 1→0 · banner bail-out 1→0.
- ⚠ One trap hit and worth recording: `npx tsx --test` on the bracketed path
  `app/dashboard/[eventId]/...` matched **nothing** and reported `# tests 0 / # fail 0`, which
  exits 0 and reads exactly like a pass. Caught by requiring a non-zero test count. Use the repo's
  own glob form.

### Adopting the ceiling migration's real contract

S2's names are now stable and are adopted verbatim from `20271184624871` — verified by reading the
migration, not the handoff. `ALLOTMENT_STORAGE` + `ALLOTMENT_RPC` carry them, and a guard pins each
one so a rename there fails here rather than writing into columns that do not exist.

Three things the real contract changed, each of which had made this session's first cut wrong:

1. 🪤 **`papic_event_pool_status.guest_count` is a literal 0 on every event we will ever draw this
   row on.** `v_guests := 0` in the non-flat-pass branch, and the free grant is armed on render, so
   the flat branch is the rare one. The head count now comes from `papic_event_guest_headcount`,
   which is the same function the database divides by. The first cut fell back to `guests.length`,
   which never crashed and would have quietly disagreed with the ledger — the exact "screen and
   ledger derive the same money twice" defect this module exists to prevent.
2. **The share has a floor of 1** — `GREATEST(1, FLOOR(…))`. A 200-guest celebration holding only
   the free grant divides to 0, and a ceiling of 0 refuses every guest their *first* photograph.
   The pot is the money gate; this is a fairness rule. Mirrored exactly, and guarded.
3. 🚨 **A copy line promised something the database forbids.** The sheet said *"Set it to 0 and only
   the guests you name can shoot"* — but `events.papic_guest_spend_ceiling_points` is
   `CHECK (IS NULL OR > 0)`, so 0 can never be stored. Meanwhile a **named** guest's
   `ceiling_points >= 0` **does** allow 0. Muting one person is a choice about her; muting every
   un-named guest at once is not offered. The input floor is 1, the copy says so, and a new
   `bad_everyone` outcome explains it in words rather than surfacing a constraint violation as
   "save failed".

Writes now go through the RPCs rather than the tables: `papic_set_guest_spend_ceiling` (a TARGET,
not a delta — NULL un-names, so naming and un-naming are one code path) and
`papic_set_guest_spend_ceiling_release` (idempotent; re-pressing returns the ORIGINAL stamp, so the
button cannot lie about when the celebration opened).

**One judgment call, flagged for the ceiling session:** the sheet reads `papic_guest_spend_ceilings`
through the server-side admin client. The migration REVOKEs it from `PUBLIC, anon, authenticated`
only, and `service_role` retains access — so it is unreachable from a browser, which is the point of
the REVOKE. The resolver answers *"what does this guest get"*, not *"did somebody choose it"*, so it
cannot tell the sheet which guests are named. If that read is unwanted, the alternative is an
event-scoped read RPC.

### The server-side read, pinned — and a claim of mine that was wrong

Oversight upheld the server-side admin read of `papic_guest_spend_ceilings` (the REVOKE targets
browser reachability, which `service_role` access does not breach; and the resolver answers *what a
guest gets*, not *who was named*, so it cannot drive the picker) on one condition: pin it so a
refactor cannot drag it into a client component.

⚠ **In doing so I claimed `lib/supabase/admin.ts` was unprotected — 672 importers held together by
a comment. That was wrong.** `lint-server-only-boundary.mjs` already names it in
`EXTRA_BOUNDARY_MODULES`, and that script's own comment says the entry *"is what makes that a
mechanism instead of a sentence"*. Measured both ways: a `'use client'` file importing this sheet
fails the guard **with or without** my new line. The property was already enforced; I had read the
absence of an `import 'server-only'` line as the absence of enforcement.

The `import 'server-only'` stays anyway, for a narrower and honest reason: the guard's chain runs
through the *admin import*. If this component ever stops importing the admin client directly — a
helper, a split, a refactor — that edge disappears and the boundary goes with it. The line is local
and survives that, and does not depend on another file's allowlist staying correct.

**MUTATION:** a `'use client'` file value-importing the sheet fails the guard — with the pin, named
on the pin (`← import 'server-only'`); without it, named on `lib/supabase/admin.ts ← declared a
boundary`. Both `GUARD_EXIT=1`; restored, `GUARD_EXIT=0` across 670 client files and 222 server-only
modules.

### Settled by Oversight — do not re-open

- **The constraint asymmetry is deliberate.** The CHECK does not change; the copy stands. The
  decisive argument is the `GREATEST(1, …)` floor: the *derived* share is never allowed to reach 0,
  so permitting an explicit 0 would contradict the same fairness rule from the other side.
- **The automatic late release is BUILT**, in the ceiling PR, and is better than either spec: no
  scheduler at all. It is **lazy** — derived inside the resolver when the question is asked — so
  there is nothing that can fail to run. `release_at = COALESCE(papic window end, end of the event
  day in its own timezone) − 2 hours`. An event with no window and no date gets no automatic
  release rather than a guess. No longer this session's to track.

### Rebased onto the merged ceiling — and the applied migration was NOT the branch

⚠ **The migration changed between the branch I read and the commit that merged**, which is the
entire reason for re-proving against the applied file rather than the proposal. `20271184624871`
gained a JOIN: the named-ceiling sum and count now include **only guests who are still coming**
(`deleted_at IS NULL AND rsvp_status <> 'declined'`), matching `papic_event_guest_headcount`.

That exposed **two real defects in this sheet**, both silent:

1. 🚨 **The sheet selected `points`. The column is `ceiling_points`.** PostgREST refuses the *whole*
   query for one unknown column, so the result came back empty, every named guest read as un-named,
   and the couple would have been shown the entire pot divided among everyone. No error anywhere.
   Nothing in the local loop could see it — the admin client is untyped so `tsc` has no opinion, and
   the unit tests exercise a pure function that never touches a table.
2. 🚨 **The sheet counted named guests who had declined or been removed.** The database no longer
   does. Counting them subtracts an absent person's credits from the pot *and* shrinks the divisor —
   quietly making everybody else's share smaller than the arithmetic on screen.

New guard `lib/papic-allotment-columns-exist.test.ts` derives the real columns from the migration's
own `CREATE TABLE` and checks every `.select()` in the sheet against them, and pins the
still-coming predicate. **MUTATION:** 3 sabotages — re-select `points` 1→0 RED · drop the
still-coming filter 1→0 RED · drop `rsvp_status` from the select 1→0 **GREEN, SURVIVED**.

⚠ **That third survivor was a weak guard, not a safe change.** The first cut asserted
`/rsvp_status/` matched *anywhere in the file*, and the word still appeared in the type annotation
and the filter — so removing it from the `.select()` passed. The real failure is total and silent:
PostgREST omits the field, `g.rsvp_status` is `undefined`, `?? ''` makes it `!== 'declined'`, and
every decliner counts as still coming. The assertion now checks the **guest select's own column
list**, and the sabotage is RED.

### 🚨 The phantom-column scanner does NOT cover this sheet's ceilings read

Verified by execution, not by reading: reintroducing `.select('guest_id, points')` leaves
`lib/security/select-column-scan.test.ts` at **21 passed, 0 failed**. T1 is green on a live phantom
column.

The cause is `FROM_RE = /\.from\(\s*'([a-z0-9_]+)'\s*\)/gi` (`select-column-scan.ts:100`) — a
**single-quoted literal only**. This sheet calls `.from(ALLOTMENT_STORAGE.table)`, so the site is not
enumerated-then-skipped; **no site is ever created**. And `KNOWN_UNRESOLVED_TABLES` is for relations
that *are* enumerated but unresolvable (views, matviews), so this cannot be baselined there either.
The gap is invisible rather than recorded, and a ratchet cannot count what it never saw.

🔑 **The contract-module pattern is what blinds the scanner.** Collecting table and column names in
one object — adopted here so a rename lands in one file — is precisely what makes `.from()`
unresolvable to T1. The rename-safe pattern is the phantom-unguarded pattern, and anyone adopting a
`*_STORAGE` object inherits both halves. Sized honestly: 5,332 literal `.from('x')` sites against
162 non-literal, most of which are `Array.from`/`Buffer.from`/storage buckets rather than table
reads. Small hole — but a real database read sits in it.

`FROM_RE` belongs to the guard's owner and is being fixed there; **this file's guard stays either
way**, because it resolves `ALLOTMENT_STORAGE.table` by importing it, which a source-text scanner
cannot do.

### T0 — a positive control, because implausibility is not a detector

Twice today a wrong answer was caught only because it was *absurd*: a probe reporting zero select
sites in a file known to contain them (the arguments were swapped — `extractSelectSites` is
`(source, file)`), and a sabotage reporting GREEN because it had never landed. That works only when
the false answer is obviously false; a parser quietly dropping the last column of every list would
return a plausible one.

So the guard's parser is now asserted against a fixture with a written-down expected value — and
**that control immediately found a bug in it**: filtering only `(` left the closing half of an
embedded list, yielding a column literally named `c)`. Fixed to drop both brackets.

**MUTATION (the control itself):** drop the last column of every list — anchor 1→1 (an *append*
mutation, so the anchor cannot move; the proof it landed is the result going RED) · stop resolving
aliases 1→0 RED · revert the bracket filter to one half 1→0 RED.

### Still open

- **The automatic late release.** The button half ships here; the automatic stamp late in the
  celebration belongs with the ceiling migration's own release path, since it must fire from the
  database rather than from a page nobody has open.
- **Column names are provisional** — `ALLOTMENT_STORAGE` adopts the ceiling migration's real names
  in one edit.
