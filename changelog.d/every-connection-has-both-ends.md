## 2026-09-18 · test(ugat): every connection has both ends — five orphan detectors with a ranked baseline (S26)

**The disease, measured five times in one day.** Both ends of a connection were built and
the join between them was missing or silent: `guest_submit_song_request` (July) and the
band's inbox both existed and no app code called the function (#5601); the supplier
payment-methods table, its editor and the couple-facing pay sheet all existed and were not
mounted at the deposit step (#5599, 0 rows); `booking_fee_open_lock_charge` exists, the
acknowledge completed, and the branch that skipped the fee discarded its reason (#5615);
the chat box was converted on two thread pages and not the one suppliers land on (S18);
the delivery log had 0 writers for months (#5588). Nothing in the repo could see the class.

**What ships.** An executable guard, not an audit — the third half of the Ugat guards.
`ugat-schema-claims` proves the map never lies; `ugat-concept-coverage` proves it never
falls behind; `tests/db/ugat-both-ends.db.test.ts` proves each thing on one side of a
connection has a live counterpart on the other. Five classes, in `lib/ugat/both-ends.ts`:

| class | the question | the other side is read from |
|---|---|---|
| `rpc-no-caller` | does anything call this public function? | `.rpc()`/URL literals in the app **and** `pg_proc` bodies, `pg_policies`, `pg_trigger`, views, column defaults, CHECKs |
| `table-no-writer` | does anything write this table? | `.from(t).insert/upsert/update/delete` in the app, SQL bodies, rows seeded by a migration |
| `notice-no-emitter` | does anything emit this `NotificationType`? | type literals outside the two registry files; plus `pg_enum` labels with no union member |
| `component-no-mount` | can a Next.js entry reach this `_components/*.tsx`? | runtime import edges (type-only imports erased), inert imports, mounts behind a constant `false`/`true` |
| `result-dropped-silently` | is a read error only used to pick a branch that records nothing? | S16's scanner (#5596), extended behind `silentDrops: true` |

The baseline `tests/db/ugat-both-ends.baseline.txt` is **ranked by user impact** — money >
booking lifecycle > couple-facing > supplier-facing > admin — a keyword sort, not a verdict,
so the controller can turn the top of it into build sessions. Green on day one; red on any
NEW orphan or a raised count; a fixed one prints "paid down" so the line can be deleted.
Every count is printed and floored, so a sweep that found nothing fails instead of passing.

**What was measured (2026-09-18, `origin/main` + this branch, from `apps/web`).**
Replayed 1,436 migrations → 572 public functions · 418 tables · 88 `notification_type` labels; indexed
3,846 of 3,868 source files under `app/`, `lib/`, `components/` (test files and the map's own
registries excluded) · 971 component candidates · 803 Next.js entries · 5,960 Supabase calls.

| class | candidates | with the other end | orphans inherited |
|---|---|---|---|
| `rpc-no-caller` | 571 | 272 called from the app, 293 from SQL | **42** |
| `table-no-writer` | 418 | 312 app-written, 135 SQL-written, 63 seeded | **34** |
| `notice-no-emitter` | 87 union + 88 labels | 82 emitted | **4** |
| `component-no-mount` | 971 | 3,747 files reachable from an entry | **25** |
| `result-dropped-silently` | 5,960 calls | — | **104** sites |

By tier: money 20 · booking 13 · couple 123 · supplier 16 · admin 6 · unclassified 31 — **209 lines**.

⚠ The first freeze on 2026-09-18 held 534 lines. The controller turned its top into build sessions the same
day, and by the time this PR cleared the CI queue peers had paid down 326 of them on `main` — the guard
reported each as "paid down" on every trial merge without failing. The file was re-frozen against the
`main` it actually lands on, so the day-one debt is the debt that is still real.

**The money-tier top of the list, excluding drops** (the controller's next build candidates):
- `rpc-no-caller` · `approve_vendor_token_purchase`
- `rpc-no-caller` · `confirm_vendor_subscription_by_reference`
- `rpc-no-caller` · `confirm_vendor_token_purchase_by_reference`
- `rpc-no-caller` · `consume_lead_token_hold_for`
- `rpc-no-caller` · `create_vendor_token_purchase`
- `rpc-no-caller` · `grant_member_purchased_tokens`
- `rpc-no-caller` · `grant_vendor_lifetime_tokens`
- `rpc-no-caller` · `redeem_vendor_token_voucher`
- `rpc-no-caller` · `reject_vendor_token_purchase`
- `rpc-no-caller` · `verify_and_activate_manual_payment`
- `table-no-writer` · `concierge_plan_templates`
- `table-no-writer` · `event_vendor_3d_plan_unlocks`
- `table-no-writer` · `supplier_vendor_sku_pricing`
- `table-no-writer` · `supplier_vendor_skus`
- `table-no-writer` · `supplies_order_line_items`
- `table-no-writer` · `supplies_orders`
- `table-no-writer` · `vendor_ad_subscriptions`
- `table-no-writer` · `vendor_token_boosters`
- `notice-no-emitter` · `gift`
- `notice-no-emitter` · `vendor_token_purchase_pending`
- `notice-no-emitter` · `vendor_tokens_credited`
- `component-no-mount` · `app/admin/pricing/_components/fee-form.tsx`
- `component-no-mount` · `app/vendor-dashboard/subscription/_components/price-position-card.tsx`
- `component-no-mount` · `components/billing/ManualCheckoutModal.tsx`


⚠ Read the money tier with the decision log open: ten of its RPCs and four of its tables are
the **retired token wallet** (2026-05-11 / 2026-07-21) and the **deferred supplies vertical**
(iteration 0018). Those are orphans by retirement — the honest fix is to delete the end that
remains, not to build a caller for it. The live-money rows the first freeze named — `event_vendor_3d_plan_unlocks`,
`verify_and_activate_manual_payment`, the pricing `fee-form` and `price-position-card`, and the three
`booking_fee_*` results in `lib/booking-fee-charge.ts` — were all paid down by peers before this merged.
Still live: `vendor_ad_subscriptions` with no writer and `ManualCheckoutModal` with no mount.

**Hand-verified by a second route** (git grep of `origin/main`, the migration corpus, and
read-only SQL against production): 3+ random hits per class, all confirmed. Four detector gaps
were found by that verification and closed before the baseline was frozen, each one a caller
the replay alone could not see: a policy on `realtime.messages` (PGlite has no such table, so
it is read from the migration text); an EVENT trigger (`pg_event_trigger`); a function used
only as another function's argument DEFAULT (`proargdefaults`, not `prosrc`); and the repo's
honest-read sentinel (`return unreadable`, `return { status: 'unreadable' }`), which is a distinct
failure state, not a dropped reason — the object form was caught by a trial merge against `main`,
where a peer's freshly merged PR (#5626) would otherwise have turned the guard red the moment
both landed. Production agreed with the replay on every checked row.

**Sabotage-proven.** Each rule is RUN over fixtures in `lib/ugat/both-ends.test.ts` and fed
its cheapest off-switch — a `{false ? <X/> : null}` mount, an `import type`, a bare
`if (error) return null`, a function named only in a comment — never a deletion. The db
test injects a canary function, trigger function and table and asserts each surfaces, and
that a function an RLS policy calls does NOT (the TS-grep blind spot that revoked a live
grant in August).

**Stated blind spots, all in the safe direction (a missed orphan, never an invented one):**
a name built at runtime (`.rpc(fn)`, `EXECUTE format(…)`) is invisible; a caller outside
`apps/web` is invisible (no Edge Function or desktop code calls PostgREST today); a
reference in a comment counts for nothing. The `component-no-mount` importer check is
file-level plus two mutation-shaped refinements; it cannot prove a mounted component is
*reachable by a user*, only by the bundler.

**Two orphans arrived on `main` while this PR sat in the CI queue, both caught by a trial merge**
(`git merge --no-commit origin/main`, guard, `git merge --abort`) because branch protection is
non-strict and neither PR's own CI can see the combination. One was a false positive in this
guard's rule (#5626's `{ status: 'unreadable' }`, fixed above). The other is real and is frozen
into the baseline as inherited debt: `app/_components/thread-call-launcher-lazy.tsx` lost its last
importer when #5614 (S18) stopped the client page embedding its own call tab. The lazy loader
lives on with no mount — the residue shape this guard exists for; delete it or re-mount it.
A third arrived later from #5680 (`lib/vendor-earnings.ts`, event names read after
`if (!eventsError)` with no else and no record). Its own comment calls a missing name cosmetic,
which is precisely what the `// supabase-error-ignored: <reason>` marker is for — inherited here,
and the honest fix in that file is the marker, not a baseline line.

**Not done in this PR, by instruction:** none of the orphans are fixed. The baseline is
the deliverable; its top is the next build list.

SPEC IMPACT: None — no product behaviour changes; a guard and its inherited debt list.
