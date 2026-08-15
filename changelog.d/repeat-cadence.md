## 2026-08-15 · feat(events): a repeat is a CADENCE, not a yes/no — and the option that turned it into a death-anniversary tracker is gone

Owner: *"so, I can be like a reminder app. that can repeat monthly, annually, quarterly, weekly, semestral? but only choose events that this can work. Birthday, anniversary can only be annual. and so on."*

**RULE 0 first, and it paid: the repeat spine already ships end to end** — the column, the derivation engine, two creation screens, two render surfaces, a live reminder email and a clone-forward action. **Nothing was rebuilt.** What did not exist was an *interval*: `recurs` is a boolean, so "repeats" could only ever mean "yearly". A repo-wide search for any existing interval (`rrule` · `recur_interval` · `frequency` · `cadence` · `quarterly` · `semestral` · `every_n`) returned **zero** event-related hits, so the column is genuinely required and is the only new storage.

**A monthly cadence was already rendering** (`Every month · first year`, for a new relationship, a new marriage and a newborn), and `addMonths` already clamped day-of-month overflow — the hardest part of monthly/quarterly/semestral stepping. Quarterly is `addMonths(3)`, semestral `addMonths(6)`. **Weekly was the only new date maths in the build.**

### 🔴 THREE PER-TYPE LISTS DISAGREED, AND IT WAS A LIVE BUG

*"Can this repeat?"* had three answers in three files — `RECUR_TOGGLE_TYPES` (6 types), `RECURRENCE_CAPABLE_TYPES` (4), and the create/onboarding actions forcing two more. Only `reunion` and `corporate` were in both lists.

**Birthday was in one and not the other:** a birthday created from the create-event grid landed `recurs = false`, so the Year view's birthday branch never fired and **that person's birthday never appeared on the surface built for it** — while the other creation path set it true for the same type. `recurs` had **no UPDATE path anywhere** (all three writers were INSERTs), so it could never be corrected.

`CADENCES_BY_TYPE` is now the ONE map, `canToggleRecur` is **derived** from it rather than hand-maintained beside it, and `resolveCadence` is the single decider all four write paths call.

**The matrix, decided by what each type IS:** wedding · debut · christening · gender_reveal · graduation **never repeat** (a wedding *produces* an anniversary; offering it a repeat offers a second wedding) · birthday + anniversary **annual only, forced** (owner) · corporate + simple_event the **full ladder** (standup, townhall, kickoff, review, conference — and simple_event is where "reminder app" actually lives) · date + hangout **weekly/monthly** (anything yearly is an anniversary) · celebration monthly+ · reunion semestral+ · tournament quarterly+ · travel + gala annual. **Weekly is offered on four types only** — weekly plus a reminder email is how this becomes spam, and the corpus already carries an anti-nagging ruling.

### 🔴 THE DEATH-ANNIVERSARY DOOR, CLOSED

`anchor_origin = 'matters'` (*"A date that matters to us"*) is the free-form catch-all the 2026-07-12 flow-check council ruled out **in writing** — *"A user can enter a parent's death anniversary; #3176 then fires an annual reminder = a death-anniversary tracker, exactly what 2026-05-16 killed. Winner: the burial-retirement lock… **Label-only guardrails don't hold.**"* The owner accepted it and **it never reached the code**: the DB CHECK still admitted it, the TS constant still carried it, and it was rendered on two screens.

**A per-event cadence is exactly the widening that makes it live.** Removed from the CHECK, the constant and both pickers. ✅ Safe by measurement, not hope: `SELECT anchor_origin, count(*) FROM events GROUP BY 1` in production returned one row — `(NULL, 5)`. Zero rows used it. The migration also **raises rather than silently dropping** if a row appears between the measurement and the run.

🪤 **The existing guardrail test for this had been GREEN the whole time.** It searched origin keys for `/memorial|death|luksa|passing/` — and the value that reopened the territory is spelled `matters`, which matches none of them. **A deny-list of words is not a guard against a catch-all.** It now pins the allow-list and rejects open-ended *labels* too.

### The promise the product was already making

The onboarding wizard says **"You can change this later."** under the yearly question, and nothing could. The repeat is now editable on the Personalization page (Band 1 — governance-free, binds no vendor), which fixes the broken promise and the birthday bug together. An **absent** form key means "leave it alone", so editing a budget can never silently switch off a repeat.

### Verification

- **Migration dry-run against production in a rolled-back transaction** (the PGlite replay runs as superuser, so it cannot be the only proof): all 5 rows survive both new CHECKs and the narrowed origin CHECK, an illegal cadence is **refused**, and a cadence without the switch is **refused**.
- **No backfill, deliberately** — NULL already means annual for a `recurs = true` row, which is the only thing the boolean ever meant.
- 🛡 **8 mutations, every one measured to land, all caught.** Two of my own defects were caught this way, not by reading:
  - 🪤 **I conflated "only annual is allowed" with "always repeats"**, which would have turned **every one-off trip into an annual one**. `FORCED_RECUR_TYPES` is now separate from the allowed set, and the trip case is pinned.
  - 🪤 **A guard asserting `writers.length >= 3` was decoration** — there are FOUR write paths, so deleting the clone's cadence left three and it stayed green while a monthly event silently came back annual. **A threshold cannot localise**; the writer set is pinned by path.
- One test expectation of mine was simply wrong (Aug 15 *is* a monthly occurrence of a Jan 15 anchor) — corrected in favour of the code.

### 🚨 Two more of mine, caught by probing rather than reading

**1 · THE LEGACY TICK-BOX WOULD HAVE MADE CORPORATE EVENTS WEEKLY.** The shipped create form posts `recurs=on` under the words *"Make it a yearly thing"*, and `canToggleRecur('corporate')` is true. Mapping that to `allowed[0]` returns **weekly**, because corporate's ladder starts there — so every corporate event ticked with that box would silently have become a weekly one. Annual is what the person was told they were choosing; a type with no annual rung now falls back to its **coarsest** cadence, not its finest.

**2 · A NEW `events` COLUMN HAS NO WRITE PRIVILEGE AT ALL.** `events` revokes table-level UPDATE/INSERT and re-grants a **computed column allowlist** (20271005100000) fixed at that migration's time. **Probed against production in a rolled-back transaction: a freshly added column returns ZERO update grants for `authenticated`.** Without an explicit grant the new control would post, PostgREST would refuse it, and — a rejection resolving as an error rather than throwing — the person would be told to try again forever. **That is the `location_city` defect of 2026-08-11 exactly.** Both grants added.

🛡 **And the exposure-freeze guard did its job**: the new column privilege widened the public surface, so the suite went red until the baseline recorded it. One line — `col public.events.recur_cadence anon=- authenticated=IU`. **`anon` gains nothing**; the couple gains the ability to set how their own event repeats, which is the feature. Regenerated and committed in this PR so a human sees it in review.

⚠ Migration ordering corrected too: it now checks that no row uses the retired origin **before** dropping the constraint rather than after. `db push` wraps a migration in a transaction so an abort rolled it back either way, but a block that removes a guard and only then asks whether that was safe is one invocation flag away from leaving the table unguarded.

### 🔬 THEN AN ADVERSARIAL PASS OVER THIS BUILD FOUND FIVE MORE — ALL MINE, TWO APP-BREAKING

Three independent lenses converged on the same two, and I re-verified both against production before acting.

**1 · 🚨 EVERY SIGNED-IN PERSON'S YEAR VIEW WOULD HAVE GONE BLANK.** I diagnosed the write-privilege trap, granted UPDATE + INSERT — **and forgot SELECT.** `events` revokes table-level SELECT too and re-grants its own allowlist; measured in prod, `authenticated` holds SELECT on **177 of 191** columns. Both Year surfaces read the new column through the USER client, so Postgres would refuse the whole select, `rows ?? []` would become `[]`, and the wedding countdown, anniversaries, birthdays and monthsaries would all vanish. **Not the new feature failing — the existing one disappearing.**

**2 · 🚨 THE PERSONALIZATION PAGE WOULD HAVE THROWN FOR EVERY HOST.** It reads `.from('events_host')`, a VIEW with an **explicit 191-column projection**, and throws on a query error. A column on the base table is a phantom column there. Names, region, budget, mood, BaZi — gone, on every event type. 🔑 The projection is **computed from `has_column_privilege(…'SELECT')`**, so granting first makes the rebuild pick it up automatically; the rebuild copies 20271025120000 verbatim, private-column list and REVOKE-before-GRANT included, and **refuses to apply if the column is still missing from the computed projection**.

**3 · "Yes — every year" would have stored MONTHLY** on a `date`/`hangout`, whose ladder has no annual rung — 12× what the person was asked. The legacy tick-box now resolves to annual or to **nothing**, and `canToggleRecur` additionally requires an annual rung, so those two types are never asked a yes/no question that cannot be honoured.

**4 · A birthday created before today** would have been shown *"This one returns every year"* over a row saying otherwise, unrepairable. The migration now **repairs those rows** (`recurs = TRUE` for birthday/anniversary — definitional, so it cannot overwrite a real choice), and forced types post their cadence so a save self-heals.

**5 · "Plan next year" silently dropped the cadence** — the source select never read `recur_cadence`, so `?? 'on'` fired every time and a monthly event came back annual. My own comment claimed the opposite, and the guard only checked that the file *called* `resolveCadence`, which it did.

### 🛡 AND THE GUARD THAT SHOULD HAVE CAUGHT #1 IN CI CANNOT FIRE

Three db coverage tests exist for exactly this. Their `before()` **re-applies the lockdown migration** — a deliberate, mutation-checked decision, because the replay harness's blanket `GRANT ALL` would otherwise hide the lockdown entirely. But re-applying **recomputes the allowlist over every column present**, including the brand-new one. So the column looks granted in the test and holds nothing in production. That is why CI was green while this defect sat in the branch.

New `lint-events-column-grants.mjs` reads the **migration text**, which no harness can re-derive, and is wired into CI with all three edits.

🪤 **It was decoration on its first run.** Its "this migration re-grants the whole allowlist" heuristic matched `has_column_privilege(` / `string_agg(` — which a **view projection** also contains, and this very change rebuilds a view that way. Deleting the real `GRANT SELECT (recur_cadence)` left it **GREEN**. Now it matches the ACT: a dynamic `GRANT SELECT (%s) ON public.events`. Mutation-proved 1 → 0 occurrences, guard red, green on restore.

⏭ **AND IT FOUND SIX PRE-EXISTING COLUMNS WITH NO READ PRIVILEGE AT ALL** — `kwento_flash_auto_wall` · `last_kwento_notify_at` · `date_forced_by_lock_of` · `papic_vendor_challenges_enabled` · `panood_manual_on_air_at` · `setnayan_ai_tier_at_purchase` — **verified against production: 0 SELECT grants, and all but one absent from the host view.** Whether each is a live defect depends on whether its feature reads through a user session; that is six separate investigations and **not this change's to make**. They are listed in the guard with the measurements so a NEW column cannot hide among them. **Each line is a promise that somebody will check it.**

🛡 The exposure baseline records exactly one changed fact — `col public.events.recur_cadence anon=- authenticated=SIU` — and **nothing else moved in 6,253 facts**, which is the proof the view rebuild did not widen anything.

SPEC IMPACT: `DECISION_LOG.md` — new row 2026-08-15 recording the cadence ladder, the per-type matrix, the retirement of the `matters` origin, and that the repeat is editable after creation.
