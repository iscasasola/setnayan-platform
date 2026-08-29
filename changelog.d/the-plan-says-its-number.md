## 2026-08-29 · feat(vendor): the plan says its number, and a supplier keeps what they already chose

**SPEC IMPACT:** `apps/web/VENDOR_TIERS_AND_BENEFITS.md` § pipeline limits updated in this PR
(verified 2 / 1 · grandfathering · the reader). Corpus: `DECISION_LOG.md` row 2026-08-29 +
`prototypes/vendor_plan_ceilings_2026-08-29.html`.

### 🔴 RULE 0 PAID, AND THE BRIEF WAS WRONG

The session brief said `platform_settings.vendor_tier_pipeline_caps_enabled` *"exists in prod and
NOTHING in the entire repo references it — searched including migrations. So the grid was either
never finished or removed."* **False.** The whole engine ships and has since 2026-08-09
(`20271121655918`): the grid as a SQL function, a `BEFORE` trigger that refuses an over-ceiling
accept, a clamp trigger, the TypeScript twin in `lib/vendor-tier-caps.ts`, and a db test that
derives from it. It is simply **switched off**. That search was run against a checkout ~700 commits
behind `origin/main` — the first trap the same brief warns about, on its own first page. **Nothing
was rebuilt.**

### What was actually missing

1. **The number was never said.** `vendorWhitelistPerDate()` had **zero callers in the whole
   application** — the only way a supplier could learn how many customers they may chase for one
   date was to be refused by it.
2. **No grandfathering** (owner ruled it 2026-08-28).
3. **`verified` had no numbers of its own** — the 2026-08-09 grid gave four numbers for five tiers,
   so it cloned `free`.

### What ships

- **Verified is 2 chasing / 1 waiting** (was 1 / 0). Owner 2026-08-29, asked directly: *"we already
  had a table for this"*. Both moves WIDEN; the ladder stays monotonic. Migration + `TIER_CAPS`
  move together, which the parity test already forces.
- **Grandfathering, with no new column.** `clamp_vendor_waitlist_to_tier` now binds on INSERT and
  on an UPDATE that actually **changes** the number. An unrelated profile save no longer takes a 3
  down to a 1 silently. `updateWaitlistSettings` mirrors the same rule, because the form posts every
  field — without it, flicking the on/off switch would re-post the number, the action would clamp
  it, and the value would then differ from stored, so the database clamp would bind too. **Two
  clamps, and a supplier loses a number they never touched by pressing Save on a different control.**
  🔑 *"Keep what you already chose" is exactly "do not touch a value nobody is touching"* — a stored
  grandfathered ceiling would be a second copy of a fact the row already holds.
  ⛔ It protects a **number**, never a **feature**: a plan with no waiting list at all still has none.
- **The whitelist half needs no grandfather clause and the reason is structural** — its trigger fires
  only on the transition INTO `accepted`, so customers already being chased are never re-counted and
  switching the ceilings on cannot disturb work in flight.
- **ONE PREDICATE, TWO CALLERS.** The count moved into `vendor_whitelist_used_for_date()`, called by
  the trigger that refuses AND by the reader the screen calls, so the sentence on screen and the
  sentence in the refusal cannot drift. The obvious build — a Supabase count in TypeScript — would
  have been a second copy of the rule.
- **The ceiling moment reads as a ladder.** `PipelinePressureLine` on the inquiry thread and the
  customer desk: *"You're chasing 1 of 3 customers for 14 Feb"* → *"Your last slot"* → at the wall, a
  block naming the two ways out (sign one, let one go) and one way up. **The inbox is never locked**
  (2026-07-24) — the message, the couple and Decline all stay; only Accept is held.
- **Fails toward silence.** Caps off, no date yet, an unreadable answer, a thread the caller does not
  own ⇒ nothing is drawn. *A missing warning costs a warning; an invented one tells a supplier they
  are full when they are not.*
- **A clone inherited its twin's bug, third accept path.** `chat-actions.ts` has translated
  `WHITELIST_DATE_LIMIT` into a sentence since it shipped; the admin demo-vendor accept threw the raw
  database string, and the auto-reply swallowed the refusal indistinguishably from a race. Both fixed.

### 🔒 Security

`vendor_whitelist_pressure(p_thread_id)` is **caller-scoped through `current_vendor_profile_ids()`**
and returns NO ROWS for a thread the caller's shops do not own. A `p_vendor_profile_id` argument
would have let any signed-in vendor read **any other shop's pipeline depth for any date** out of a
helper that exists to draw a progress line. The unscoped counter it calls is granted to
`service_role` only — asserted in both directions. Exposure baseline regenerated and **read line by
line**: exactly **one** added fact (`exec=authenticated`, not anon), zero removals absorbed.

### Measured

Prod `njrupjnvkjkitfctetvi` 2026-08-29 by the object (`pg_get_functiondef`, not a migration): the
switch is **false**; both shops are `solo`, `verified`, holding **1** with the waiting list **off**.
So **nobody is grandfathered today and the flip changes nothing for either shop** — this matters from
the first supplier who sets a 3.

### Verification

`test:unit` **11,355 pass / 0 fail** · `test:db:ci` **1,869 pass / 0 fail** · `tsc --noEmit` exit **0**,
0 errors · all **30** CI guard scripts run individually, all pass (the radius guard caught an ad-hoc
`rounded-[3px]` — advisory locally, strict in CI).
**Three mutations, occurrence-counted before → after, all RED, restored from an explicit `cp`
backup:** remove the grandfather guard → *"an unrelated save"* fails · remove the caller scope →
*"tells a DIFFERENT shop nothing"* fails · remove the booked-booking filter → *"a signed booking stops
counting"* fails.

⚠ **One existing assertion was deliberately changed, not weakened.** The 2026-08-09 suite asserted
*"ANY subsequent save clamps"* and proved it with an **unrelated** write. That is the exact behaviour
the owner struck. The test keeps its real subject — the clamp must CLAMP and never RAISE, so a
downgraded supplier can still save their settings page — with a write that touches the number, and the
change is written out in full in its own comment.

⏭ **The switch is still OFF and the flip is a separate act.** The owner asked for it on (2026-08-29);
it is flipped after this is served, never inside a migration and never before a supplier can see the
number that is about to bind them. Custom's "buy past 10" dials are **named, not built** — Custom is
hidden from every public page, so that purchase would be a door onto nothing.
