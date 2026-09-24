# INDEX — nothing left behind

Every known item has a destination. If it is not in this table, it does not exist
in anything handed over. **Built 2026-09-18.**

## What is in this zip

```
00_START_HERE.md          the ordered sequence — READ FIRST
01_STATE_MEASURED.md      what is true, with the command that re-measures it
02_THE_CHAT_BOX.md        the brief, what shipped, what is left
03_END_TO_END.md          the booking lifecycle + the owner's ruling verbatim
04_TRAPS.md               every trap that has cost real time — not optional
05_OWNER_DECISIONS.md     settled (do not re-ask) + open (blocked on him)
INDEX.md                  this file

PROTOTYPE/
  the-chat-box.html       the Messenger-shaped prototype he approved: "do it"
  the-chat-box.md         its written brief

PROMPTS/                  paste one into a new session; each is self-contained
  P0_FIRST_PROMPT.md      ▸ start here — re-measure, report, then take the next step
  P1_update-this-quote.md ▸ supplier revises, couple re-accepts
  P2_end-to-end-run.md    ▸ drive the booking to completion
  P3_payment-surfaces.md  ▸ 5 supplier surfaces ignore the payment kill switch
  P4_email-delivery-log.md▸ 0 writers; nobody knows if any email arrived
  P5_refunds-remeasure.md ▸ MEASURE FIRST — 12 files already carry refund actions
  P6_venue-throttle.md    ▸ the reception trips the bot check (OFF flag)
  P7_small-and-honest.md  ▸ SUP-52 song request · DAY-14 · LR-21 · the FIXTURE shop
  P8_register-sweep.md    ▸ 456 rows, never re-measured — measurement, not builds

REFERENCE/                source material, kept whole
  BUILD_REGISTER_steps_1-4.md    the four-step thread sequence
  OWNER_DESK_rulings.md          his rulings in full
  ONE_REGISTER.md                456 rows (SUP 131 · LAU 66 · DAY 35 · DSK 19)
  SESSION_CLOSE_2026-09-18.md    the peer session's close — 20 PRs, its NOT-BUILT list
  FRIDAY_BUILD_2026-09-18.md     the Friday plan
```

## Coverage — every item, and where it went

### ✅ Done and served — do not rebuild

| item | evidence |
|---|---|
| 20 PRs merged 2026-09-18 | listed in `01_STATE_MEASURED.md`; served sha `2c3b0dd` |
| the quote lives in the conversation | **#5584 MERGED** |
| custom SMTP (Resend, 100/hr) | owner did it by hand |
| Turnstile configured, both hostnames | configured; **currently switched OFF** → owner decision 1 |
| `booth-addon-card` honours the payment kill switch | re-measured 2026-09-18 — **already done**, excluded from P3 |

### ⏳ In flight at handoff — confirm, do not rebuild

| item | state | where |
|---|---|---|
| **#5586** one chat box | fixed, CI green-so-far, auto-merge armed | P0 step 1 |
| **#5585** retired Papic denylist | history rewritten to clear the secret scan, auto-merge armed | P0 step 1 |

### 🔨 Open builds — each has a prompt

| item | prompt |
|---|---|
| "Update this quote" — supplier revises, couple re-accepts | **P1** |
| The end-to-end booking run (stuck at step 4 of 6) | **P2** |
| 5 supplier payment surfaces ignoring the kill switch | **P3** |
| Email delivery log (0 writers) | **P4** |
| Refunds — re-measure before building | **P5** |
| Venue-NAT throttle (behind an OFF flag) | **P6** |
| Guest song request SUP-52 | **P7a** |
| DAY-14 dead branch | **P7b** |
| LR-21 comment nit (5 files) | **P7c** |
| The FIXTURE shop counted as a real supplier | **P7d** — ask him first |
| 456 untriaged register rows | **P8** |

### ⚖ Owner's desk — engineering is blocked, not lazy

All ten live in `05_OWNER_DECISIONS.md`. The two that block a prompt:

| decision | blocks |
|---|---|
| **`BOOKING_FEE_RAIL_LIVE` absent from Vercel Production** | **P2 step 6** — the fee cannot charge at all |
| **The seat-claim trade** (decision 2) | **P6** — build behind an OFF flag meanwhile |

The other eight — captcha back on · legacy Papic seat tokens · browsewrap vs
clickwrap · DPO wording · the token repaint · R2 bucket versioning · Supabase Pro
· Live Studio pool-channel reuse — block nothing today but two of them are
data-loss shaped (**R2 versioning** and **Supabase Pro backups**) and should not
sit indefinitely.

### 🚫 Deliberately out of scope — not forgotten, excluded

| item | why |
|---|---|
| `actions.ts` files | an absence there **denies**; failing closed is correct |
| `ManualCheckoutModal` and 6 other payment surfaces | dead code, or a written decision in `changelog.d/` to leave them |
| Live Studio broadcast-day model | **deleted** by LS6, not hidden — do not rebuild |
| The fourth chat marker | **deleted** by a council verdict — `git log --diff-filter=D` before rebuilding anything that looks missing |
| Native iOS/Android Papic, DSLR pairing | Phase 2, locked |
| Manual video editor · SMS · public API endpoints | locked out of V1 |

## 🔑 The thing no prompt in here fixes

```
real users 8 · published shops 1 (and it is the FIXTURE) · active services 2
orders 6 · refunds 0 · per-guest Papic allotments ever created: 0
```

**Engineering is not the bottleneck. Supplier recruitment is, it has weeks of
lead time, and no amount of building shortens it.** Every prompt in `PROMPTS/`
is real work. None of them puts a second supplier on the marketplace.

## ⚠ Read this before trusting any line above

**A handoff is not evidence.** This file will start rotting today — and it rots
**fastest exactly where it is read most**. The previous handoff's "what is left"
section, at the very top where every session reads first, pointed at two jobs
that were already finished and fenced by guards.

Every row above carries its command. **Run it.**
