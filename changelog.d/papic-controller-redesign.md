## 2026-09-22 · feat(papic): the credit recommendation knows the kind of celebration

`papic_event_pool_config` stops being a singleton. Migration
`20271239794268_papic_pool_sizing_knows_the_event_type.sql` seeds one SIZING row per
`event_type_vocab` type (17), so a christening is no longer quoted a wedding's 150
credits a head. Owner-confirmed per-head figures, 2026-09-22 — engineering invented
none of them (CLAUDE.md rule 9).

- **The clamp travels with the per-head figure.** `points_per_guest` alone would have
  shipped broken: with the global floor of 5,000 a 2-guest `date` at 50/head computes
  100 and is clamped **up to 5,000** (~₱3,360 of credits recommended for a dinner for
  two). A sizing row carries `floor_points` and `ceiling_points` too.
- **Nothing moves on merge.** `wedding` is seeded byte-identical to the live global row,
  and 9 of the 11 live events are weddings. The migration REFUSES TO APPLY if that is
  not true, and `papic-pool-sizing.test.ts` + the db test pin it.
- **One resolver, two languages.** `public.papic_event_pool_sizing(text)` and
  `pickPoolSizing()` in `lib/papic-pool-sizing.ts` resolve identically, and
  `papic_event_pool_status` now sizes the DB fence through the SQL one — so the figure
  the app shows and the figure the fence enforces cannot drift.
- **New blocking guard** `scripts/lint-pool-config-global-columns.mjs`: `soft_stop_pct`,
  `free_grant_points` and the four other global columns may only be read off
  `config_key = 'default'`. Every existing reader already pinned it, which is the only
  reason 17 new rows changed no behaviour; the next one is the one that would silently
  answer off a sizing row with a plausible number.

⚠ **OPEN FOR THE OWNER — the per-type FLOOR and CEILING are not accepted yet.** He
confirmed `points_per_guest` only. Seeded: wedding keeps floor 5,000 / ceiling 30,000;
every other type gets floor 0 and the same ceiling. One admin edit each if he wants
different.

SPEC IMPACT: `DECISION_LOG.md` 2026-09-22 rows (the per-type table and the two traps)
are now BUILT rather than recorded; the floor/ceiling recommendation is carried into the
corpus with this build.

## 2026-09-22 · feat(papic): the credit recommendation learns — and the naive loop is wrong twice

Owner: *"we will set the initial value. then create an average depending on the total
credits used on actual events."* Migration
`20271240727195_papic_pool_recommendation_learns_from_closed_events.sql` builds the
mechanism. **It starts dormant** and changes no number on merge — the migration refuses
to apply if any row already carries a learned figure.

- **Trap 1 — there is no data.** Nine weddings hold 100,362 credits granted and ONE used
  (measured 2026-09-22). A mean over that recommends ~0 a head, i.e. *"your wedding needs
  no credits"*. A type needs `learning_min_sample` uncensored observations before anything
  overrides the owner's figure; the initial stays as the fallback and is never overwritten.
- **Trap 2 — usage measures supply, not demand.** An event that spent its whole pool may
  have wanted twice as much, so averaging raw usage spirals downward. Exhausted
  celebrations are excluded from the mean and enter as a **lower bound only** — they can
  raise the figure, never lower it. Only closed capture windows count.
- **The admin can see which figure is in force** (`/admin/pricing` → Papic), with the
  sample behind it and what a recompute would do. Nothing recomputes on its own — this
  repo has no scheduler, deliberately, and a number that tells couples how much to spend
  should not move while nobody is looking. The 17 rows are editable there, all three
  numbers together.
- 🪤 **A fixture caught a real defect.** `papic_event_pool_status.guest_count` is a
  literal 0 on every non-flat-pass event — which is every live celebration — so the first
  cut of the sample query returned nothing and would have been permanently, silently
  dormant. The denominator is `papic_event_guest_headcount` now.

SPEC IMPACT: builds the 2026-09-22 ruling on learned recommendations, including both
traps as recorded.

## 2026-09-22 · feat(papic): every guest is promised a minimum, and the promise is payable

`papic_guest_spend_ceilings.ceiling_points` is a CEILING, and the shipped `splitTheRest`
docblock records what that means (measured 2026-09-16): nothing is held back for anybody,
every credit is first come first served, so **nothing in the product guaranteed any guest
anything**. A couple could cap a loud uncle at 40 and still have their mother arrive at
10pm to an empty pot. Migration
`20271241532112_papic_every_guest_is_promised_a_minimum.sql` adds the other half.

- **A floor is a promise, so it is checked.** `minimum × guests` against what the
  celebration holds, with the **shortfall named** — "add 4,000 credits" is actionable,
  "that will not work" is not. It cannot be a CHECK constraint: the pot and the head count
  both move without the column being touched, so it is re-derived every render
  (`guestMinimumVerdict`).
- **A floor can never exceed the ceiling** — a CHECK, not a rule in one action, because
  there are already three writers of these two columns.
- **A named guest is raised to the minimum too.** Ruling 7c protects a named allotment
  from the RELEASE; it is not a licence to promise everybody 25 and hand one named guest 5.
- **Inert on merge.** Every celebration has a NULL minimum, and the db test asserts the
  resolver — including the shipped floor-of-one — is unchanged without one.

SPEC IMPACT: the per-guest allotment model gains a floor; `splitTheRest`'s
"suggestion engine, not an allocation" note still stands for the ceiling half.

## 2026-09-22 · refactor(papic): no camera holds credits of its own

⚖ **This REMOVES shipped functionality**, on the owner's own ruling. Two of his rulings
were in direct conflict and the code followed the older one: 2026-08-11 *"the host can
dedicated a specific number of shots for a specific QR code"* (why `PapicCamerasCard`
existed) against 2026-09-16 *"no dedicated shots individually."* Asked which stands, he
chose 2026-09-16.

- **Removed:** `PapicCamerasCard` (deleted, unmounted) and the `setCameraShots` action.
  🔑 The page was saying both things at once — the Crew-cameras sheet reads *"Every shot
  draws from your shared credits"* while that card, four blocks below, handed credits to a
  single QR.
- **`paparazzi_seats` STAYS** — 24 live rows. A seat is the camera CLAIM, not an
  allowance, and `app/api/upload/route.ts` resolves a seatGate per seat.
- **The RPC `papic_dedicate_shots` is deliberately NOT dropped in this PR.** Five db tests
  exercise it and it shares machinery with the per-seat GRANT layer that stays — measured
  2026-09-22, `papic_seat_allocations` 0 rows but `papic_event_point_grants` 4 rows with a
  `seat_id`, all `source = 'camera_grant'` (the free Papic One camera), which is not the
  couple dedicating anything. Dropping it is its own change with its own baseline
  regeneration. **Instead the retirement is enforced at the app boundary**:
  `no-camera-holds-its-own-credits.test.ts` fails if any surface under `app/` reaches it.
- The removal is recorded with its reason in the controls bill
  (`nothing-was-lost-with-the-tabs.test.ts`) and `port-control-baseline.json` is
  regenerated in the same commit, per the `VendorNavFab` precedent.

SPEC IMPACT: the 2026-09-22 ⚖ ruling row is now built on the app side; the SQL half is
named as still open.

## 2026-09-22 · feat(papic): the controller re-orders itself by phase

⚖ Owner, on the live page: *"it doesn't feel inquitive and easy to manage."* The approved
prototype (`prototypes/papic_controller_redesign_2026-09-21/`) puts ten blocks in one DOM
and re-orders them with CSS `order`. This is that, in the real page.

- **Before the day** — money leads the setup: Credits → Coverage → Allotment → Filter →
  Challenges → Live wall → Gallery → Kwento → Made for you → More.
- **On the day and after** — the photographs lead: Gallery → Kwento → Made for you → Live
  wall → Credits → Allotment → Filter → Challenges → Coverage → More.
- **Two renames**: the capture-window block is **Coverage**; "Guests' shots" is
  **Allotment**.
- **Live wall moved UP, above the gallery** in both phases — it is a setup job (pick a
  style, get the screen code) that was sitting below the results it helps produce.
- **The recommendation is on the credits block** and shows its own arithmetic
  ("146 guests × 150 for a wedding = 21,900 · you hold 5,050"). ⚠ Money now sits ABOVE the
  two blocks that size it; that inversion is only honest while the number recomputes, so
  the guard requires the recommendation to be on the page.
- **A row whose sheet held one switch now carries the switch** (owner: *"set the toggles
  here if it only needs toggle switches"*) — Finding people. Blurred faces and Google Drive
  keep their panels: one is a report the couple cannot set, the other is an OAuth connect.
- **The allotment panel says the couple does not add guests here** and carries the door to
  the guest list (owner asked *"how to add guests?"* on that screen).

🪤 **Two silent failure modes are guarded**, because neither is visible to typecheck, to a
snapshot, or to the controls bill: an interpolated `order-${n}` is a class Tailwind never
generates, and CSS `order` is inert on a block container. Either one leaves the page in
source order looking exactly as it did.

SPEC IMPACT: builds RULING 2 of the 2026-09-22 redesign row.

## 2026-09-22 · fix(papic): a switched-off control goes quiet, it does not jump

⚖ Owner: *"don't make it jump."* The allotment block was `{enabled ? … : null}` — turning
the per-guest limits off DELETED every control below the switch and pulled every block
after it up the page, under the couple's thumb, then rearranged again on the way back on.

🔑 **Hidden is a layout event.** The controls now stay mounted and go quiet: `inert` takes
them out of the tab order and stops every press without threading a `disabled` prop
through each field, the opacity says so, and the number boxes read **"No limit" /
"No minimum"** where the figures were — which is also the honest answer to what is in
force. A stale "40" in a greyed box says the limit is 40; it is not.

⚠ **This is not a ban on rendering nothing.** `GuestAllotmentsChoice` still returns null
when guests cannot shoot at all — a control that governs nothing is worse than an absent
one. The rule is about a control collapsing as the couple OPERATES it, and the guard
asserts that shape rather than banning `null`.

🚨 **The guard's first cut faced the wrong way** and is worth recording: it sliced FORWARD
from the quiet wrapper, so a sabotage that put `{enabled ? (` immediately BEFORE the
wrapper restored the exact defect and the guard stayed green. It now checks the region
between the switch's own form and the wrapper as well.

SPEC IMPACT: builds the second of the two interaction rules in the 2026-09-22 redesign row.

### 2026-09-22 · CI follow-up — four fixes and two guards re-pointed

Six unit tests were failing on this branch. Four were real defects in this build; **two were
guards that had stopped describing the page**, and they are fixed as guards, not by bending
the code to satisfy a stale assertion.

- **Two `admin_audit_log.insert` calls discarded their error** (`savePapicTypeSizing`,
  `recomputePapicPoolLearning`). Both now read `auditErr` and log without rolling back — the
  edit already succeeded and a missing audit row is a known degradation, matching
  `createDiscountCode`. Isolated, not a pattern: 6 inherited unread inserts already sit in
  that same file on `main`, so this build copied a local convention.
- **`admin-jobs.generated.ts` was stale** — the two new admin actions were never regenerated.
  `pnpm --filter @setnayan/web admin:jobs` (319 → 321 jobs, 208 → 209 form-driven).
- **`papic-cameras-card.tsx` left `KNOWN_DISCARDED`** now that the card is retired.
- **The pool-sizing select is spelled out inline**, owner-ruled: *"inline the columns, don't
  raise the ceiling."* `lib/security/select-column-scan.ts` (GUARD 2 of `pnpm lint:dup-rule`)
  resolves column lists statically and cannot see a constant-built string; admitting this one
  call into that ratchet is how a ratchet stops meaning anything. New
  `lib/papic-pool-sizing-columns-match.test.ts` keeps the inlined literal and
  `POOL_CONFIG_SIZING_COLUMNS` from drifting — inlining buys visibility and costs a second
  source of truth, and that file is the price.

**The two guards.** Both asserted SOURCE order against a page that now reorders with CSS
`order`, and both had already been re-anchored once before.

- `the-required-act-is-first.test.ts` sliced from the heading `"Four ways into your library"`
  and looked forward for the picker's gate. The redesign moved the edit picker up into
  Coverage, putting **both** mounts above that heading. Measured: the old rule returned FAIL on
  the correct page **and** FAIL with the gate deleted — it answered the same thing to every
  input. It now pairs each `<PapicWindowPicker` with the nearest *preceding*
  `{(!?)windowIsSet ?` (the gate wraps the mount, so only a backward look sees it) and asserts
  two mounts, each gated, gates distinct, exactly one negated. Nothing positional left to rot.
- `an-unread-count-is-not-zero.test.ts` pinned `<PapicStage>` above the next step by
  `indexOf`. The ten blocks are children of one `flex flex-col` carrying `order-1..10`, so DOM
  order is not visual order. The rule was never about the stage: *a person is told where they
  stand before anything asks them to decide*. Before the event the leading block is now the
  credit balance, by the owner's ordering instruction — **the property holds; the block
  carrying it changed.** It now reads `BLOCK_ORDER[phase]` and asserts the leader of each phase
  is a standing block, that no phase assigns the same `order-N` twice, and that the two phase
  maps are not identical (a merge collapsing them would leave the page silently not
  rearranging).

Every change above was sabotage-proved: each guard was watched going RED against a mutation of
the property it protects, then restored from a backup copy (never `git checkout`, which
no-ops on an untracked file and destroys edits to a tracked one).

SPEC IMPACT: None. No product behaviour changes — four defect fixes and two guards re-pointed
at rules the corpus already records.

### 2026-09-22 · two more generated artefacts this PR owed

Found by asking whether the generator-tree-drift that nearly bit `admin-jobs.generated.ts` applied
to anything else this build touched. It did, twice — and neither was blocking CI, which is why
they were missed.

- **`supabase/security/exposure-surface.baseline.txt`** — this branch's migration
  `20271241532112_papic_every_guest_is_promised_a_minimum.sql` adds `events.papic_guest_spend_floor_points`,
  and `gen-exposure-baseline.ts` says in its own docblock to commit the result *in the same pull
  request as the migration that caused it — the diff is the review*. The new fact reads
  `anon=- authenticated=SU`: anon reaches nothing, which is what a per-guest floor on an event
  should be. Shipping without it would have put a security-surface change through unreviewed.
- **`apps/web/scripts/port-control-baseline.json`** — was generated from `860872d04` and had gone
  stale for `credit-recommendation.tsx` (this branch) *and* `revenue-summary.tsx` (from `main`).
  Regenerating from the merged tree necessarily picks up both; 924 → 925 destinations,
  4606 → 4610 blocks.

Both regenerated on the MERGED tree, and both guards re-run green against the result
(`lint-exposure-baseline.mjs` EXIT=0, `lint-port-no-lost-controls.mjs` EXIT=0 — 430 routes /
1581 controls / 4610 blocks).

SPEC IMPACT: None.

## 2026-09-22 · fix(papic): the pot rises again when a guest gives credits back — and floor_points stops doing two jobs

Two defects in the per-event-type sizing build, both mine, both caught by CI.

**1 · A `CREATE OR REPLACE` silently reverted a shipped behaviour.**
`20271239794268` restates `papic_event_pool_status`, and it was rebuilt from
`20271184624871`'s body — the **second**-newest definition. That dropped the newest one's
change: `+ COALESCE(v_released, 0)`, the credits guests have handed back out of their own
purchases. The pot stopped rising when a guest gave credits back —
`papic-a-guest-can-give-her-credits-back.db.test.ts`, `0 !== 96`, five assertions red.

🔑 **Copying a function body is a MERGE, and `git diff --stat` cannot see it.** The
migration file was new, so the diff showed additions only. Before re-stating a function:
`git grep -l 'FUNCTION public.<name>' -- supabase/migrations | sort | tail -1`.
A new source guard asserts the pot's total still sums every term the shipped body had.

**2 · `floor_points` was doing two jobs** — sizing a RECOMMENDATION and setting the
ENTITLEMENT the capture fence meters against. Seeding sixteen types at 0 fixed the
recommendation and, in the same stroke, quietly cut what a christening or a hangout is
entitled to from 5,000 to nothing. The PR body said nothing moved; for those types it
would have.

⇒ Two columns now: `floor_points` is seeded **5,000 for every type** (exactly today's
global value, so no celebration of any type gains or loses a credit), and a new
`recommend_floor_points` carries the per-type figure — wedding 5,000, everything else 0.
The migration **refuses to apply** if any per-type row changes the entitlement, or if a
row recommends a floor above the pool it is entitled to.

⇒ **This also closes the open owner question** in the safest direction: the entitlement is
the status quo and the recommendation floor is only ever lower, so nothing anybody is
entitled to or already quoted can move. Still admin-editable per type.

SPEC IMPACT: supersedes this PR's earlier "floor 0 for non-wedding types" — that changed
an entitlement, which was never the intent.
