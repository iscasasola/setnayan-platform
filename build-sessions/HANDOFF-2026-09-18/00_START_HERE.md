# SETNAYAN — the build sequence · handed off 2026-09-18

> **You are the next session. Read this file top to bottom before running anything.**
> Everything here was measured on 2026-09-18 against `origin/main` and the live
> database. Every row carries the command that re-measures it. **This file starts
> rotting the moment it is written — re-measure, do not trust.**

---

## ⚠ FIRST: the account is at 98% of its weekly all-model limit

Measured 2026-09-18 10:30 UTC. Resets **2026-09-19 18:00 UTC**. Extra usage is OFF.

- **Weekly · all models: 98%** — Opus/Sonnet work will 429 mid-task.
- **Weekly · Fable: 34%** — this is where the headroom is.

🔑 **A session killed at 429 dies AFTER committing and BEFORE `gh pr create`.**
If you are starting before the reset, run on **Fable**, and after every commit
push the branch immediately so a kill cannot strand the work.

---

## 🛑 RULE 0 — FIND IT BEFORE YOU BUILD IT

This project is ~2 years of code. Almost nothing asked for is new. Before writing
anything, run all four:

```bash
git grep -l "<feature noun>" origin/main -- apps/web/app apps/web/lib | head
gh pr list --state open --limit 40 --json number,title,headRefName
git worktree list
git log origin/main --oneline -15
```

Then state, one line each: **what exists · what is missing · the delta you will build.**
If you cannot name the existing component, you have not searched enough.

**Measured twice in one session (2026-08-31):** a feature was rebuilt from scratch
while another session already had a better version open as a PR; and a migration
was one step from being written when a shipped table already expressed exactly
that fact. Both were caught by *looking*, and **neither would have been caught by
a test** — two mechanisms that disagree about one fact each pass their own suite.

---

## THE SEQUENCE

The order is not arbitrary. **Each step unblocks the next.** Steps 1–2 are in
flight and need no new work. Step 3 is the end-to-end run, which is the only
thing that can tell you whether steps 4+ are real.

### ✅ STEP 0 — IN FLIGHT, DO NOT REBUILD

| PR | what | state at handoff |
|---|---|---|
| **#5586** | **the chat box — both thread pages become a single Messenger-style frame** | fixed, CI running, auto-merge armed |
| **#5585** | a retired Papic model cannot come back through the catalogue | history rewritten to clear the secret scan, auto-merge armed |

```bash
gh pr view 5586 --json state,mergedAt,statusCheckRollup \
  -q 'if .mergedAt then "MERGED" else "\(.state) fail=\([.statusCheckRollup[]|select(.conclusion=="FAILURE")]|length)" end'
```

**If either is red, read `01_STATE.md` § "the two PRs" before touching it** — both
have already been misdiagnosed once, and in both cases the failing thing was *not*
what the summary line said it was.

---

### 1️⃣ THE CHAT BOX — first, because everything else is seen through it

**Status: BUILT (#5584 merged, #5586 in flight). Your job is to confirm it served,
not to build it.**

The owner's words: *"we want to have a single chat box with everything inside it.
when we were planning the chat box, this was the original plan. but somehow you
made it all over."*

What shipped:
- **#5584** — the quote lives *in* the conversation as a message, with line items,
  a Counter-offer link, and two jump pills when the quote is off-screen. The
  conversation keeps its height (a `min-h` floor, not a fixed `calc`).
- **#5586** — the couple's thread page and the supplier's thread page become **one
  frame**: one header, one scrolling column, one composer, tools in a tray.

**Verify it served before moving on:**
```bash
curl -s https://www.setnayan.com/api/health           # note the sha
# then open a real thread as testnayan1 (email+password, NEVER the Google button)
```

⚠ **Fable's published height table is a TRAY-CLOSED table.** With a tool panel
open the list sits at its **224px floor at every width** (320/360/390/1440), the
panel body caps at 55dvh and scrolls inside itself. That is by design, but do not
quote the wider numbers as if they hold with a tool open.

**The design reference is `06_THE_CHAT_BOX_PROTOTYPE.html` in this zip** — the
Messenger-shaped prototype the owner approved with the single word *"do it"*.

---

### 2️⃣ "UPDATE THIS QUOTE" — the supplier can revise, the couple must re-accept

**Status: NOT BUILT. This is the first real build.**

Owner ruling, verbatim: **"they can do updates and must be reaccepted. so they can
negotiate of the benefits."**

And separately: **"vendor cannot edit the proposal."** — that is the defect this
closes.

**Shape (owner chose option (a) on 2026-09-18):** a new proposal *supersedes* the
old one. The superseded quote stays visible in the thread as history — it is not
deleted — and the couple's acceptance resets to pending. One thread, one live
quote, a visible trail of what changed.

Why it is second: it rides *inside* the chat box. Building it before #5586 lands
means building it twice.

---

### 3️⃣ THE END-TO-END RUN — the whole point

**Status: STUCK AT STEP 4 OF 6.** This is not a build. It is the owner and a
session driving a real booking through the live platform, with SQL confirming each
step. Everything in §4 below is scoped by what this run exposes.

The six steps, and where it stopped:

| # | step | state 2026-09-18 |
|---|---|---|
| 1 | couple sends an inquiry | ✅ done |
| 2 | supplier sends a quote | ✅ done |
| 3 | couple accepts | ✅ done — proposal `S89J-474WCSEJN5` = `accepted` |
| 4 | **supplier requests Lock** | ❌ `lock_requested_at` IS NULL |
| 5 | couple agrees to Lock | ❌ `lock_agreed_at` IS NULL |
| 6 | supplier pays the booking fee · admin acknowledges | ❌ `booking_fee_charges` = 0 rows |

Re-measure:
```sql
select status, total_cost_php, lock_requested_at, lock_agreed_at,
       deposit_amount_php, contract_signed_at
from event_vendors where event_id = (select id from events where slug = 'rosa-ben');
select count(*) from vendor_lock_proposals;
select count(*) from vendor_contracts;
select count(*) from booking_fee_charges;
```

🔑 **THE OWNER'S LIFECYCLE RULING — this is the load-bearing decision and it is
NOT fully built. Read `03_END_TO_END.md` for the full text.** In one line:
**nothing fires at accept; everything fires when the admin acknowledges the
supplier's booking-fee payment.**

⚠ **Test as `testnayan1` by email + password, NEVER the Google button.** The
owner's own account has `is_internal = TRUE` and **passes every paid gate**, so
testing on it is a false green.

---

### 4️⃣ THE BUILDS THAT RIDE WITH THE END-TO-END RUN

These are ordered by whether the run can proceed without them.

#### 4a · BLOCKS THE RUN — the booking fee cannot charge at all

`BOOKING_FEE_RAIL_LIVE` is **absent from Vercel Production**. The gate is
two-key — `isBookingFeeEnforced() = isBookingFeeEnabled() && isBookingFeeRailLive()`
— so with one key missing the fee can never charge, and `booking_fee_charges` has
0 rows for that reason and not because nobody tried.

```bash
vercel env ls production | grep BOOKING_FEE
```
🔑 **`vercel env ls` says set / not-set, and absence is decisive.** Do NOT try to
read it out of the production bundle: Next inlines the *value* and drops the name,
so grepping the bundle for the name returns a confident, wrong zero.

**This is an owner action (setting an env var), not a build.** Step 6 of the run
cannot complete until it is set.

#### 4b · MONEY IS VISIBLY WRONG — the surfaces that ignore the payment kill switch

Re-measured 2026-09-18. The session-close doc said "4 surfaces"; the true picture
is finer, and one of the four is **already fixed**:

| file | honours the switch? |
|---|---|
| `vendor-dashboard/subscription/_components/booth-addon-card.tsx` | ✅ **yes — already done** |
| `vendor-dashboard/booking-fees/[orderId]/page.tsx` | ❌ no |
| `vendor-dashboard/shop/page.tsx` | ❌ no |
| `vendor-dashboard/subscription/_components/ai-addon-card.tsx` | ❌ no |
| `vendor-dashboard/subscription/_components/papic-challenge-card.tsx` | ❌ no |
| `vendor-dashboard/subscription/custom/` | ❌ no |

**Reachability confirmed** — each of the three components has exactly 1 importer,
so none of them is dead code. Command used:
```bash
git grep -l "<ComponentName>" origin/main -- apps/web/app | grep -v "_components/"
```

🔑 **Run that second command before building.** A previous sweep correctly
enumerated 10 payment surfaces and reached a **wrong verdict on 7** of them,
because an enumeration finds what *exists*, never what is *reachable*. Also check
`changelog.d/` for a recorded decision to leave a surface alone — one such
decision already exists (`a-closed-rail-hands-out-no-account-number.md`).

#### 4c · YOU CANNOT TELL IF THE EMAILS ARRIVED — the delivery log

**0 writers. Confirmed still 0 on 2026-09-18.** `emitNotification` records that a
notification was *created*, never whether it was *delivered*. 76 notifications
exist; how many reached a human is unanswerable.

**Newly urgent** because SMTP now actually works (Resend via `smtp.resend.com:587`,
rate limit raised 2/hr → 100/hr). Before that, the answer was "none" and the log
would have been pointless. Now it is the only way to know.

```bash
git grep -c "notification_deliveries\|recordDelivery" origin/main -- apps/web   # empty = still 0
```

⚠ Both the payment notification and the daily digest send **nothing, silently**,
if `RESEND_API_KEY` is unset in Vercel. The digest is the net underneath, not a
substitute.

#### 4d · RE-MEASURE BEFORE BUILDING — refunds

`order_refunds` = **0 rows**, so the path has never been exercised. **But 12 files
carry refund or re-issue references**, including `app/admin/payments/actions.ts`
and `app/admin/users/actions.ts` — real admin actions, not just prose. The
register's claim that "no path exists" is **wrong**.

🔑 **The honest next step is measuring what those 12 files actually do, not
building a refund path that may already be there.**

#### 4e · THE RECEPTION WILL TRIP THE BOT CHECK — the venue-NAT throttle

Cloudflare demands an interactive solve when one IP makes many requests quickly.
That is exactly what a wedding reception is: 150 guests on one venue WiFi. Proved
by accident during this session's own probing, which made Cloudflare treat the
owner's IP as a bot.

The pattern to copy is already in the tree: `lib/join-door-throttle.ts`, whose own
comment says it is *"sized for a VENUE, not a laptop."*

⚠ This is entangled with **owner decision 2** (the seat-claim trade) in
`05_OWNER_DECISIONS.md`. Build it **behind an OFF flag** until he rules.

---

### 5️⃣ SMALL AND HONEST — do these when a bigger item is blocked

| item | measurement | size |
|---|---|---|
| **Guest song request (SUP-52)** | **0** references under `app/[slug]` or `app/papic`. The band's inbox and the DB half are both built. **Every stage exists except the join.** | small, high value |
| **DAY-14 dead branch** | the "broadcast day has ended" fork renders in **0 of 12** measured combinations — 1 file, `app/panood/control/[eventId]/page.tsx` | tidy-up |
| **LR-21 comment nit** | 5 error boundaries name `instrumentation.ts` as the Sentry path; for the browser it is `_components/deferred-observability.tsx` | comment only |
| **The FIXTURE shop** | the one published shop is named *"Saysay Live Band & Hosting (FIXTURE)"* and its `is_demo` flag is **FALSE**, so every "verified suppliers" count includes it | 1 flag |

---

### 6️⃣ ~170 UNTRIAGED ROWS — measure, do not build

The `LAU-*` and `SUP-*` registers have never been re-measured against the served
build. **~40% of such rows turn out already done** — 6 of 7 re-measured on
2026-09-16 were already finished.

🔑 **A register's status rots in BOTH directions, and a register's stated
*mechanism* is a hypothesis** — the packs read code, so a row can name a real
problem and describe entirely the wrong cause.

---

## 🔑 THE ONE THING THAT IS NOT AN ENGINEERING PROBLEM

**Engineering is not the bottleneck.** Every item above is real, and none of them
is what stands between a couple and a booking.

```
real users 8 · published shops 1 (and it is the FIXTURE) · active services 2
orders 6 · refunds 0 · per-guest Papic allotments ever created: 0
```

**That is supplier recruitment. It has weeks of lead time, and no amount of
building shortens it.** Say so to the owner rather than quietly building around it.
