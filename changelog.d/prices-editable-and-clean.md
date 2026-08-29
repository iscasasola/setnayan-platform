## 2026-08-29 · fix(admin): the price screen was silently uneditable, the ladder ate its own inputs, and eleven dead supplier prices are gone

Owner, live on the merged redesign: *"why can't i edit the prices?"* Every row on
`/admin/pricing?tab=pricing` opens its editor on click — it always has — and the
row carried **no affordance at all**: no chevron, no hover state, and a `<button>`
takes the browser default cursor unless told otherwise, so not even a pointer. It
read as a report, not a control.

Fixed: a chevron that turns when a row opens, a hover state, and the word *Edit*
appearing under the price on hover.

### The credit ladder ate its own inputs

Owner: *"also when a number box becomes 0, that row disappears. that should not
happen."* Five of the ladder's sixteen rows are typed; the rest compute. Which
rows OWNED an input was being decided by what was CURRENTLY typed in it — so
clearing a box removed that rung from the editable set, the input vanished, and
the row re-rendered locked with **no way to type the value back short of
reloading**. Every rung below it went blank with it, because the rate that
carried downward had gone too.

Fixed: which rows are editable is a fixed property of the ladder, not of what is
presently typed. An empty box now says plainly which rungs are waiting on it and
that nothing saves until it has a number.

### The Papic tab held the ladder and nothing else

Owner: *"free credits should be here. with the rest of papic services and the
thank you video."* The 50 free credits every celebration starts with had no
screen anywhere — `papic_event_pool_config.free_grant_points` had zero readers
under `app/`. It is shown now, read from the database. The Thank You video and
the four camera rates join it, so the whole Papic picture sits in one place.

⚠ **The four camera rates are switched off and still charge.** `fetchCameraRates`
reads them past `is_active`, and two price a purchase a couple can make today —
a dedicated camera for a friend or hired second shooter. They stay editable here
on purpose, flagged as still-wired, rather than being buried on the "switched
off" shelf where a live number stops being looked at. Removing that whole
purchase path — it reaches 26 files, including checkout and onboarding — is
scoped as its own follow-up, not folded into this change.

### Eleven dead supplier prices removed, dry-run against production twice

Six bidding-token packs, booth poster/banner, and three Custom-plan dials
(reach step, photo pack, included token), plus the custom subdomain. Every one:
never subscribed, never in an active ad, never bundled, never verified against,
never ordered. Re-measured immediately before writing the migration and again
before shipping it, because `main` moved dozens of times in between.

**The AI Chatbot Advanced row is deliberately kept** — a db test asserts it
exists, off, at ₱3,000, so a future fallback cannot under-charge if it ever
ships. The migration raises if a future sweep ever takes it.

**The duplicate branch price is retired, not deleted.** `vendor_branch_28day`
and `vendor_additional_branch` were both active at ₱1,000 — but only
`vendor_additional_branch` is the row every branch PURCHASE actually charges.
The public price page and llms.txt quoted the other. Repointed to the charging
row in the same change the duplicate is retired in, so nothing is taken off
sale before its readers have moved; a guard refuses the migration if the
charging row would stop being on sale.

### The two dead controls are gone, and what replaced one of them had no guard

**Platform fee** removed — measured, nothing charges it; its two functions have
zero callers, and the flow it describes (a customer paying a supplier through
Setnayan) does not exist.

**Set-up discount box** removed — the set-up step sells exactly two families
(Papic, Setnayan AI) and both carry their own sign-up price, so the general
percentage governed nothing. `platform_settings.onboarding_discount_pct` and its
READERS are deliberately kept; a test says not to tidy those up.

🪤 **Deleting the old control's test found a live bug in the one that replaced
it.** Rather than delete the retiring test with its subject, it was pointed at
the per-family discount box the owner used the same morning — which turned out
to lack the guard: a blank box there read as **0%** and would have stripped the
sign-up saving from all sixteen Papic prices at once, reporting success. Fixed.

### Verification

`tsc` exit 0 · `test:unit` **11,452 pass / 0 fail** · `lint-port-no-lost-controls`
**410 routes / 1,494 controls / 4,144 blocks — nothing lost**, baseline
regenerated with exactly the two deliberate removals in the diff · admin job
checklist regenerated — one job removed, one added with its fields correctly
detected · the deletion migration dry-run against production **twice**, both
inside a transaction that rolled itself back, both times reaching the
deliberate abort with every assertion held.

SPEC IMPACT: None — no price moves for any customer or supplier today.
