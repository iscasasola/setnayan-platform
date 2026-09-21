# CTRL-B2 — THE LOOP THAT NEVER CLOSES, AND THE SUPPLIER NOBODY TELLS

**Model · effort: Opus · high.** This bundle decides whether a supplier ever gets a second booking.

```
cd ~/Documents/Claude/Projects/setnayan-platform && claude --model claude-opus-5
```

**Read first:** `build-sessions/BUNDLE-COMMON.md`, then `build-sessions/AREA-AUDIT-TEMPLATE.md`.

**One branch, one PR, five commits.** Branch from `origin/main`.

---

## The context you need

**No wedding has ever happened.** All 9 weddings on the platform are in the future. So nothing here
is a reported bug — it is a chain that has never been walked, and you are building the parts that are
missing from it. Measure before you assume any link is absent.

The chain: supplier marks the service complete → the couple confirms they received it → that unlocks
the review → the review is the supplier's track record → the track record is what wins the next
booking. **`service_marked_complete_at` is set on 0 of 51 `event_vendors` rows.** The chain has never
closed once, so `vendor_reviews` is empty, so the marketplace has no trust signal at all.

---

---

## ✅ RE-MEASURED 2026-09-22 against `origin/main` + prod — **all 7 builds survive; build 7's MECHANISM was wrong**

Nothing here is already built. Live counts confirming the premises:
`event_vendors` **51**, of which `service_marked_complete_at` is set on **0** · `vendor_reviews` **0**
· `completion_status='auto_confirmed'` **0 rows, and no writer in TypeScript OR SQL** (checked both —
a TS grep cannot see a SQL writer) · `vendor_calendar_blocks` **0** · `vendor_schedule_pool_bookings` **3**.

🛑 **Build 7's diagnosis below is WRONG in its mechanism, though right in its conclusion.** Read the
correction attached to that build before starting it.

---

## Build in THIS order. The order is the cut line.

### 1 — Nothing ever tells a supplier their event is over
The answers desk has kinds `lock_request · delete_request · lock · lock_request_lapsed · review ·
dispute · message · meeting · quote_draft · contract_draft`. **There is no `mark_complete`.** The
starter motor for the entire after-the-event flywheel is missing.

- Anchor: `git grep -n "kind: '" origin/main -- apps/web/lib/vendor-overview.ts`
- Build the desk item: after the event date passes on a contracted booking that has no
  `service_marked_complete_at`, the supplier is told, on the surface they already open.
- **Property:** a past-dated contracted booking with no completion mark produces exactly one desk
  item, and it disappears once marked. Assert the count, not merely the presence — a guard that only
  asks "is something there" cannot see two.

### 2 — Make the couple's confirm reachable and honest
`coupleConfirmReceived` requires `.not('service_marked_complete_at','is',null)`. Once build 1 exists,
walk the couple's half: can they actually reach the confirm, and does a refused read say so?

- Anchor: `git grep -n "coupleConfirmReceived" origin/main -- apps/web`
- ⚠ **RULE 0 applies.** This control may already exist and simply be unreachable. **Find it before
  you build it** — name the existing component, then state the delta. Recreating a working screen is
  a defect, not a deliverable.
- **Property:** with the mark set, the couple has a reachable confirm; without it, they are told what
  is waiting on whom — never a blank.

### 3 — The review door
`reviewState` in `lib/completion-handshake.ts` is **correct and cron-free** — it computes M=7d/N=30d
against `now()`, so "auto-confirms after 7 days" is a true promise with no scheduler behind it. **Do
not rebuild it.** The doors exist in three places: `plan-budget-accordion.tsx`, `build-locked.tsx`,
and the couple's vendor workspace.

Your job is only to confirm the door opens once confirmation lands, and to close the one real gap:
`completion_status = 'auto_confirmed'` has **readers in 8 files and no writer anywhere**, so anything
filtering on that literal string under-counts forever — including `lib/admin/app-performance-stats.ts`.

- Anchor: `git grep -n auto_confirmed origin/main -- apps/web/app apps/web/lib`
- Either write the status or stop reading it. Pick one and say why. **Do not leave both.**
- **Property:** the set of bookings the app treats as complete is the same set every reader sees.

### 4 — Going live is silent
`transitionVendorVisibility` writes an audit row and a tier-history row and calls **no notifier**.
`notifyVendorStatusChange` is wired to the applications path only. The best news the product ever has
for a supplier — *couples can now find you* — reaches them only if they happen to log in.

- Anchor: `awk '/async function transitionVendorVisibility/,/^}/' <(git show origin/main:apps/web/app/admin/verify/actions.ts) | grep -c notify` → **0**
- ⚠ **The notification and the email allowlist are two halves of one mechanism.** Emitting a
  notification whose type is missing from `EMAIL_ENABLED_TYPES` in `lib/notification-emit.ts` is a
  tray badge reaching nobody away from the console. **Having one half is indistinguishable from
  having neither.** `vendor_status_change` is already on the allowlist — check before adding a type.
- **Property:** the transition that makes a shop findable emits a notification AND that type is on
  the allowlist. Assert both in one guard.

### 5 — Two small lies on the supplier's own pages
Cheapest, last, and safe to drop if the bundle must shrink.

- **`is_published` is vestigial but still leaks.** `isShopLive` reads `public_visibility` +
  `verification_state` only, yet `/api/v1/vendor/profile` still returns the legacy boolean —
  so a supplier reading their own API is told "not published" about a live shop. SetnaProd is live
  with `is_published=false`. Anchor: `git grep -n "is_published" origin/main -- apps/web/app/api/v1/vendor/profile/route.ts`
- **Earnings still renders a payout section that can only ever be empty.** The 3-stage payout model
  was retired at the 2026-05-28 V2 cutover — the page's own docblock says so — and `vendor_payouts`
  is 0. A permanently empty money section trains the supplier to distrust the page.
  Anchor: `git grep -n "Retired 2026-05-28 V2 cutover" origin/main -- apps/web/app/vendor-dashboard/earnings/surface.tsx`
- ⚠ **Do not touch the rest of Earnings.** PR #5680 fixed the ledger read and PR #5818 made an
  unreadable ledger say so instead of rendering ₱0. Both are live. Saysay correctly reads
  **₱5,350 · 2 payments**. Re-measure before you change anything there.

---

## Files this bundle may touch

`apps/web/lib/vendor-overview.ts` · `apps/web/lib/completion-handshake.ts` (read only unless you can
show a defect) · the couple's vendor workspace + `build-locked.tsx` · `apps/web/app/admin/verify/actions.ts`
· `apps/web/lib/notification-emit.ts` · `apps/web/app/api/v1/vendor/profile/route.ts` ·
`apps/web/app/vendor-dashboard/earnings/surface.tsx` · `apps/web/lib/admin/app-performance-stats.ts`
· new guards + one changelog fragment.

⚠ **A live session is working on the guest list and another on the Event Hub.** Do not touch
`apps/web/lib/guests.ts`, the roster components, or the event-hub nav.

## Before you push

`git diff --stat origin/main...HEAD` and read every file. An unintended deletion — especially of a
helper a recent PR added — means a restore loop wrote over your merge. CI cannot see it.

## Report

Per build: done or dropped · the property the guard holds · the sabotage you watched go red.
If something in this brief turns out to be already built, **say so first and skip it** — the owner
has paid more than once to have a page recreated that already existed.

---

## ➕ ADDED 2026-09-21 — build 6 (last; safe to drop)

### A shop's agent gets a one-tab phone
`VENDOR_SCOPED_BOTTOM_NAV_KEYS` in `apps/web/lib/vendor-role.ts` contains exactly one key,
`'profile'`. The sibling list `VENDOR_SCOPED_NAV_ITEM_KEYS` **does** include `'customers'` — the two
disagree, and the phone is the stricter one. So an agent or viewer on a phone has no route to My
Customers or to the day they were granted.

- Anchor: `git grep -n -A4 "VENDOR_SCOPED_BOTTOM_NAV_KEYS" origin/main -- apps/web/lib/vendor-role.ts`
- `vendor-bottom-nav.tsx`'s comment still says agents get "Home + More", while the same file says
  twice that there is no More tab now. **Fix the stale comment too** — this repo has been burned
  repeatedly by a comment read as a measurement.
- **Property:** the two scoped-nav lists agree, and the phone offers every destination the desktop
  grants that role. Assert the lists against each other so they cannot drift apart again — that
  disagreement IS the defect.

---

## ➕ ADDED 2026-09-21 — build 7. **Do this one FIRST, ahead of build 1.**

### Paying the booking fee does not hold the date
The owner's ruling, 2026-09-18: a **lock on the vendor's schedule … upon the vendor paying their
booking fee.** Today a supplier completes the whole handshake, the couple's deposit is acknowledged,
the supplier pays Setnayan ₱837.50 to hold the date — **and every other couple searching that date is
still told he is free, as is his own calendar.**

Two live bookings sit in exactly this state right now: `rosa-ben` (2026-10-30) and `ana-miguel`
(2027-03-13).

- `select count(*) from vendor_calendar_blocks;` → **0**
- `pg_get_functiondef('vendors_blocked_on_date')` reads **only** `vendor_calendar_blocks`;
  `lib/vendor-availability.ts` and `vendors/_actions/category-search.ts` are its only availability
  sources.
- The one automatic writer is trigger `event_vendor_autoblock_on_booking`, whose body **returns early
  unless `NEW.status = 'deposit_paid'`** — and the lock/fee path never sets it. `recordDeposit`'s own
  docblock says: *"Does NOT flip status … The host advances status (→ deposit_paid) separately when
  ready."* Both locked rows sit at `contracted`.

🔑 **Do not over-claim what is missing — capacity IS already held.** `acquireSchedulePools` writes
`vendor_schedule_pool_bookings` (3 rows covering both locked events, `daily_booking_capacity = 1`),
so a second booking would eventually be refused *at the door*. **The missing half is
availability/calendar: the supplier looks free while couples are choosing.** Build that half only.

- ⚠ **The trigger's `deposit_paid` condition is not obviously wrong — it may be a deliberate split.**
  Read `20271121865976`'s header first (it complains that releasing a pool left the block standing:
  the two are treated as halves of one mechanism). If after reading you believe the owner's ruling
  and the trigger genuinely disagree, **say so and propose the change — do not quietly re-point the
  trigger at a different status.** Advancing a booking to `deposit_paid` as a side effect would move
  a status the host is documented to own.
- ⚠ `vendors_blocked_on_date` returning empty for those dates is **not** evidence — with the table at
  0 rows it cannot return anything. The finding rests on the trigger body and the writer inventory.
- **Property:** once a supplier's booking fee is settled, that date is blocked on their calendar and
  excluded from availability search — and releasing the booking releases both the block and the pool.
  Assert both ends; a block without a release is the mirror defect.

---

## 🛑 CORRECTION TO BUILD 7 — re-measured 2026-09-22, against prod

**The brief says the blocker is the trigger's `deposit_paid` condition. That is not what is stopping
it.** `event_vendor_autoblock_on_booking` has **three** guards, in this order:

1. `IF NEW.marketplace_vendor_id IS NULL THEN RETURN NEW;` — manual vendors have no calendar.
2. `IF NEW.status <> 'deposit_paid' THEN RETURN NEW;`
3. on UPDATE, `IF OLD.status = 'deposit_paid' THEN RETURN NEW;`

**Prod has 3 rows at `deposit_paid` — and all three carry `marketplace_vendor_id IS NULL`.** They are
manual, host-added suppliers, and the trigger skips them at guard **1**, entirely correctly. The two
marketplace bookings that matter (`rosa-ben` 2026-10-30, `ana-miguel` 2027-03-13) sit at `contracted`
and are stopped at guard 2.

🔑 **So the honest statement is stronger than the brief's: the trigger's happy path has NEVER ONCE RUN
in production.** No row has ever satisfied guards 1 and 2 together. A reader of the original brief
would assume the 3 `deposit_paid` rows prove guard 2 is the only obstacle — they prove nothing of the
kind, and relaxing guard 2 alone would still block nothing for those three.

⚠ **And the trigger cannot tell you when it fails.** Its block call is wrapped in
`EXCEPTION WHEN OTHERS THEN RAISE WARNING` — deliberately, so a failed auto-block never rolls back a
booking. A `RAISE WARNING` reaches no table and no screen. **So "0 calendar blocks" is consistent with
three different worlds: never fired · fired and skipped · fired and threw silently.** Whatever you
build must make the outcome observable, or the next session re-measures the same ambiguous zero.

Re-measure:
```sql
select ev.status, (ev.marketplace_vendor_id is not null) as has_link, e.event_date
from event_vendors ev join events e using (event_id) where ev.status = 'deposit_paid';
select count(*) from vendor_calendar_blocks;
```
```bash
git grep -n -A28 "FUNCTION public.event_vendor_autoblock_on_booking" origin/main -- supabase/migrations
```
