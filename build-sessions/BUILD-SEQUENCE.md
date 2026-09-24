# BUILD SEQUENCE: the controller's living file

> Owner's goal: **launch-ready and usable, and above all "make everything connect properly."**
> The controller dispatches only; it builds nothing. It updates this file on **every** merge, failure and release.
> The owner opens sessions. The controller announces each one as **🟢 OPEN A NEW SESSION** with its file, model and effort.
> Last updated: 2026-09-21 (Event Hub session added the 🔝 PRIORITY block). Previous: 2026-09-18 16:58 UTC. Owner asked: **"make sure event hub, chatbox and papic, and the vendor's and user's page are properly fixed."** Four AREA owners dispatched (agents), each doing map → walk every journey → fix → owner click-test checklist in `build-sessions/AREA-CHECKLISTS-2026-09-18.md`.

## Rules the controller follows
1. **The queue is never empty.** The next wave is written before the current one finishes.
2. **Capacity:** at most 6 sessions actively building (16 GB Mac), heavy jobs one at a time through `heavy-lock.sh`, and hold new starts if memory is below 40% free.
3. **Order:** anything that turns `main` red goes first → money → the booking lifecycle → connections → couple-facing → supplier-facing → admin → tidy-ups.
4. **Collisions:** two sessions never edit the same area at once (see "Blocked by" below).
5. **Every merge:** re-run any CI that failed only because `main` was red, update this file, and release the next session if there's a slot.
6. **Never** prune a worktree belonging to a live session. Sessions clean up their own.
7. **An idle session can't receive my messages.** When one needs a correction, the controller writes the exact paste for the owner.

## 🔝 PRIORITY — THE EVENT HUB (owner, 2026-09-21: *"add them to the next plan of overall controller. and prioritize it there."*)

Goes into the **first free build slot, ahead of every bundle below** except anything turning `main` red.

| Item | What | Who | State |
|---|---|---|---|
| **EH-1+2** | **ONE merge, built in the Event Hub session** (owner: *"build all 3 in 1 merge. start now"*): the pass looks like the design · the whole hub moves (`ARRIVAL-S7-motion.md`). | **Event Hub session** | ✅ **PR #5844 MERGED** 2026-09-21 ~15:20 UTC |
| **EH-3** | ✅ **DECIDED — KEEP the bottom tab bar** (owner 2026-09-21: *"for 3 keep it. do not remove the bottom tab bar."*). The canvas note "NO TAB BAR before the day" is superseded. Nothing to build. | owner | closed |
| **EH-4** | **The canvas LOOK** (owner: *"doesn't look like the event hub we planned"*): the invitation card #5847 + the hub as cards #5848 — built in the Event Hub session. | Event Hub session | ✅ **BOTH MERGED + SERVED** 2026-09-22. Verified live on `/cale-ice`: eyebrow "TOGETHER WITH THEIR FAMILIES", italic "and", date between gold rules, countdown below the first screen; hub = 6 card sections, computed `border-radius: 14px` from `var(--m-r-md)`. |
| **EH-5** | ✅ Arrival time on the pass was 8h late (converted to Manila twice) — fixed #5845. | Event Hub session | ✅ **MERGED + SERVED** 2026-09-22. Card reads **1:30 PM** and the programme's first moment is **1:30 PM – 2:00 PM · Guests arrive** — they AGREE. ⚠ the per-guest *pass* (personal link) still needs an owner check. |
| ~~B5~~ | ~~`CTRL-B5.md`~~ — **absorbed into EH-1+2+3 above. Do NOT open.** | — | cancelled |

Already live today (do not rebuild): the pass's facts #5796 · one QR #5802 · one seat link #5806 · no NFC on guest surfaces #5799 · face step on first camera tap #5800 · Share/Report footer #5808 · music top-right #5815/#5823/#5840 · the monogram without a ring #5817. Decision-log rows appended 2026-09-21 (not committed; the corpus holds other sessions' edits).

Owner-only checks still open: one guest's personal link (pass facts, no NFC, face pop-up) · install on iPhone + Android · does the mirrored livestream autoplay on a TV · a ninong sees "Suit, in the wedding colours" · one guest's unsplit principal-sponsor role has no outfit.

## ✅ DONE today: 24 PRs merged (+ #5616)
#5585 Papic retired · #5586 one chat box (thread pages) · #5587 accept ≠ booked · #5588 email delivery log · #5589 payment off-switch on supplier surfaces · #5590 register sweep (456 rows) · #5591 LAU-20 approval fix · #5592/5593/5595/5597 four small LAU fixes · #5594 offline page allowlist · #5596 unread-DB-error guard · #5598 admin taxonomy search · #5599 pay methods at the deposit step · #5600 deleting a supplier keeps its payments · #5601 guest song requests · #5602 venue throttle (OFF) · #5603–5606 four small truth fixes · #5607 update-this-quote
Also: S4 refunds (already built, nothing to do) · the **first complete end-to-end booking** (rosa-ben, deposit confirmed 13:51, first delivery-log email).

## 🔴 NOW: blocking
- ✅ **`main` GREEN again: #5711 merged ~10:15 UTC 2026-09-19.** First batch refreshed onto it: #5697 #5637 #5709 #5710 #5702 #5651 #5667 #5669 #5625 #5712.
- **#5709** (not from the controller): deploy-prod and supabase-migrations shared one concurrency group, so **38 prod deploys were cancelled on 09-18**. It retires the duplicate trigger. Its CI failure is main-red only. **Owner should glance: it changes the deploy pipeline.**
| # | What | PR | State |
|---|---|---|---|
| ~~S25~~ | ✅ `main` fixed, #5616 merged 15:31. 30+ PRs updated onto it | #5616 | done |
| **S24** | **#5613 conflicts with main** and needs the session to resolve it | #5613 | owner paste |

## ⚠ MERGE QUEUES (generated-baseline PRs land one at a time)
- **Exposure/FK baseline:** bundle **#5697** (auto ON; replaces #5642 #5643 #5644 #5646 #5647 #5655, FK count 231) → then **#5649** (S39 function drops) → then **#5639** (emcee), each refreshed, regenerated and re-armed.
- **Port-control baseline:** **#5645** (auto ON) → then **#5637** → then **#5679**, each refreshed, regenerated and re-armed after the previous merges.
- The watcher wakes on each of these merges. Never hand-merge a generated baseline; regenerate it.

## 🔨 RUNNING
| # | What | Model | PR |
|---|---|---|---|
| S6 | ✅ booking-fee ledger fixed + money-path DB test (5 waived → paid 6th → admin approve, idempotent) | Fable 5.1 · high | #5615 MERGED 21:05 |
| FEE-HONEST | booking-fee lock path keeps failure reasons; a failed 'order exists?' check now SKIPS instead of risking a 2nd bill | Opus (agent) | #5708 (+ S34 #5707 for booking-fee-charge.ts) |
| S26 | every connection has both ends: orphan guard + ranked list (45 RPCs, 35 tables, 6 notices, 32 components, 420 dropped results) | Fable 5.1 · high | #5625 |
| S18 | one chat box on every page (client page etc.) | Fable 5.1 · high | #5614 (CI) |
| S21 | the shot list reaches the couple | Opus 5 · medium | #5612 (CI) |
| S23 | guest login extends on activity | Sonnet 5 · medium | #5611 (red: `main`) |
| S24 | unstyled page recovers, and reports its cause | Opus 5 · high | #5613 (CI) |
| S8 | DAY-14 · LR-21 · dead legacy path | Sonnet 5 · low | #5608 · #5609 (red: `main`) · #5610 |

## 🔨 WAVE 3: opened 14:30, running
| # | What | Model |
|---|---|---|
| S27 | service cards reach the marketplace | Opus 5 · high | #5620 |
| S28 | 8 small supplier-side fixes | Sonnet 5 · medium | #5617 |
| S29 | supplier data integrity and verification | Opus 5 · medium | #5618 |
| S30 | the budget connects to decisions | Opus 5 · medium | — |

## 🟢 WAVE 4+5: released 15:08
| # | What | Model | Blocked by |
|---|---|---|---|
| S31 | the guest site on the day: RSVP override, Usapan photos, filling meter | Opus 5 · medium | a slot |
| S32 | emcee pronunciation guide, venue screen | Opus 5 · medium | a slot |
| S33 | relationship states only (the quote launcher was done by AREA-CHAT #5682) | Opus 5 · medium | **S18 merging** |
| S34 | MONEY orphans: fee-form mount, manual-payment activation, unsold products, gift notice | Opus 5 · high | now (item 6 waits #5615) |
| S35 | delete the retired wallet, supplies and dead checkout ends | Sonnet 5 · medium | now |
| S36 | BOOKING orphans: contract signatures, inquiry/thread RPCs | Fable 5.1 · high | now |
| S37 | COUPLE orphans: Papic camera, guest deliveries, delegates, dead home pieces | Opus 5 · high | now |
| S38 | SIMPLE EVENT end-to-end run (owner drives) | Fable 5.1 · high | **owner back** |
| S39 | SUPPLIER orphans: done (2 joined, 6 fns + 3 tables + 4 components deleted) | Opus (agent) | #5648 #5649 #5651 #5655 |
| S40 | ADMIN + unclassified orphans: dropped 3 fns + 2 tables, deleted 8 components, wired 2 notices, left 4 staged tables (documented) | Sonnet (agent) | #5673 #5679 #5685 #5688 |
| S41 | silent failures: MONEY 64/69 (5 left = booking-fee, S6/S34) · BOOKING 80/80 | Opus (agent) | #5650 #5652–#5654 #5656–#5660 |
| S41b | silent failures: COUPLE 176/182 (5 wait on #5652, 1 goes with #5646) | Opus (agent) | #5661–#5667 #5669 |
| S41c | silent failures: SUPPLIER 68/68 · ADMIN 14/14 · unclassified 30/30 (the agent fanned out 7 sub-agents) | Sonnet (agent) | #5692–#5696 #5698 #5699 |
| — | **SWEEP COMPLETE:** every tier of result-dropped-silently addressed; ~9 sites left, each waiting on another PR | | |
| S42 | 2nd full wedding run, with a PAID fee (option C) | Fable 5.1 · high | **READY: owner said YES to option C (2026-09-19); open it and drive** |
| S43 | supplier pages second pass: done (item 7 was already in #5638; item 8 report was wrong, guard added) | Opus (agent) | #5700–#5706 |
| S35+ | whatever S6's final run report finds | set per item | **S6's report** |

## 🎯 AREA OWNERS (owner priority, 16:58)
| Area | Agent | Covers |
|---|---|---|
| Chat box + Event Hub | AREA-CHAT ✅ #5677 #5682 #5686 (on top of #5614) | every place a conversation renders; verifies #5614; SUP-H; Event Hub / Go live |
| Papic | AREA-PAPIC ✅ #5668 #5675 #5678 | guest capture NOT broken: 0 allotments = never used (0 captures, 0 guests accepted terms). Fixed: the guest camera said "cameras off" when its check failed and had dead-end screens; the couple's credit settings showed wrong numbers on a failed read. **First real guest photo = owner checklist step 5** |
| Supplier pages | AREA-VENDOR ✅ #5672 #5674 #5680 #5684 #5687 → second pass **S43** after #5634 | Today, Customers, client page (not its chat), Shop, cards, Performance, payments, fees, `/v/[slug]`, `/explore` |
| Couple/user pages | AREA-COUPLE ✅ #5670 #5671 #5676 #5681 #5683 → **DEPOSIT-TRUTH ✅ #5690**: every deposit is read from the payment log through one rule (`lib/paid-to-vendor.ts`), guarded against new readers; the admin dispute card no longer shows "—"; lock pop-up says "deposit" | home, create-event, Overview, Your Team, workspace (not its chat), Guests, Schedule, Seat plan, Budget, guest site; non-wedding wording |

## 🧊 LATER: large or needing a design check first
- Convert the exact per-file `[supabase-error]` counts in the `s41c-*-reads-are-honest` tests to per-site anchors + floors. Exact counts broke `main` once and PRs three times on 2026-09-19 whenever a legitimate distinct site was added.
- Teach the shared SQL comment stripper (`lib/security/events-column-privileges.ts`) to strip `/* … */` blocks safely, so the both-ends checker cannot miss an orphan named inside a block comment (trade-off accepted in #5625).
DAY-11 offline sync for the day-of app (L) · DAY-16 broadcast screen (L) · SUP-B/C F1→F2 page rewrite (L) · SUP-83 yearly add-on billing · SUP-107 Setnayan owing a shop credit · SUP-55/56/57 removal requests + partner re-quote · SUP-59 source mis-tag dispute · SUP-76 report/fraud queue · SUP-71 boost-knob admin UI · SUP-70/74 paid boost (dormant) · SUP-78/79 supplier search tools · SUP-16 guaranteed "new here" slot

## ⚖ WAITING ON THE OWNER (engineering blocked, not lazy)
- **Booking lifecycle:** what makes a booking final when the fee is waived (free-5)? · keep the 7 effects at agree, or move them to fee approval? · finalize location? · tell the shortlist when a slot is taken?
- **In-chat lock** for an accepted quote, or keep the workspace pointer (S5)?
- **Booking fee live test:** option C (seed 5 test rows for Saysay, do one real paid booking, then clean up)? Also: should "first 5 free" become an `/admin/pricing` setting?
- **Decision 2** (the venue throttle switch) · **DATA-01** suppliers lose records on couple delete · **DAY-26** QR email policy · **DAY-19** two guest previews disagree · delete the `encoder-actually-runs` branch? · refund receipt: void or credit memo (BIR)?
- **Before launch:** captcha on · Supabase Pro · R2 versioning · clickwrap/browsewrap · FIXTURE `is_demo` · `dpo@` inbox · uptime and Sentry alerts
- **Wordmark (to confirm):** in the app, the Setnayan wordmark goes back to the public front door `/`, still signed in (your 2026-08-13 "the WORDMARK is the way out of the app"). An unrecorded 2026-08-14 change had pointed it at `/dashboard`. Restored in #5679; a one-line revert if you prefer the 07-16 "Wordmark-as-Home".
- **From FEE-HONEST (money):** confirm the change so a failed 'does an order already exist?' check SKIPS (the fee is retried later) instead of risking a second bill for the same charge · add a UNIQUE index on `orders.service_key` so the database itself prevents a double bill?
- ✅ **CLOSED 2026-09-20 (AREA-CHAT phone tab):** the owner keeps "Event Hub Controller" on the phone bottom bar. No change.
- ✅ **DAY-12 decided 2026-09-20:** venue screens are INCLUDED WITH paid Live Studio (no separate charge; none without it), cap 6. Gap found: the screen actions never checked the unlock → fix running (wt-screens-gate). Prod check still owed: pair a TV at /live and switch the 3 modes.
- **From S40:** `execute_manpower_telemetry_reward` (crew-rate marketplace) is still pending your decision since 2026-06-15; `token_rewards_log` holds 5 live rows · S40 also left 2 follow-up chips for you: the wordmark link (`/` vs `/dashboard`), and mounting `BroadcastReadiness` in the live control screen (needs a visual check)
- **From S39:** keep or drop `vendor_2307_filings` (BIR 2307, 0 rows)? · Booth Studio when its flag goes on: free, bundled or priced, and should it freeze 24h before the event like the poster? · off-platform suppliers have nowhere to log a meeting now, OK? · press **Recompute** on admin price bands (the table is empty in prod)
- **Dependencies:** GitHub reports **13 vulnerabilities on main (5 high, 7 moderate, 1 low)**. Worth a Dependabot session after the queue drains.
- ✅ **Fixed 2026-09-19 (#5713):** "Events" opens the picker whenever the board has 2+ cards (owner correction; only testnayan4 was ever affected).
- ✅ **Decided 2026-09-19:** removed guests are NOT told (`guest_claim_rejected`: no notice). **Pending:** guest deliveries A (QR scan, recommended) vs B (checklist, counsel-gated) · season numbers (recommend: leave empty for launch, fix the region-key mismatch now)
- **Not engineering:** supplier recruitment. Suppliers also need to add payment methods (0 in prod).

## 2026-09-19 — owner-reported chat/quote defects (from the S42 live run)
- ✅ PR #5714 (auto-merge armed): chat no longer paints over any open tool panel, on both sides. Owner should re-check Tools → Send a quote after deploy. Prune wt-quote-overlap after merge.
- ⏭ NEXT, after the S42 run finishes: before any quote exists, the composer's 🧾 "Send a deal" (an amendment tool) is the most visible option, and suppliers pick it instead of Tools → "Send a quote". Until a quote exists, that entry must read "Send a quote" and open #build-quote.
  - Same fix, couple side too: amendment-suggest-chip.tsx renders a "🧾 Send a deal" chip under the couple's opening inquiry before any quote exists (seen live 2026-09-19 as testnayan4). There is no deal to amend yet, so it must not show.
- ⏭ WATCH at step 7: the proposal's payment_method_ids = [] (S89J-EK6NWM69T1). If the couple sees no way to pay the deposit, that's the owner's earlier "payment modes of the vendor must show" defect.
- 🔧 RUNNING (owner-requested 2026-09-19): the lock works INSIDE the chat. The accepted-quote card mounts the SAME lock component and action as the bench (one mechanism), then shows "lock requested" or a visible error. Built on top of #5677; worktree wt-chat-lock.
- 🔧 RUNNING: the same wt-chat-lock PR now also mounts the supplier's Agree/Decline (vendorAgreeToLock/vendorDeclineLock) on the accepted card in the chat. Both ends.
- 🔧 RUNNING: the customers roster shows "Customer" instead of "Ana & Miguel" for a booking_ask row (wt-roster-name).
- ✅ PR #5715 (auto armed, stacked on #5677): the lock works in the chat on BOTH ends (couple: AccordionLockButton→finalizeVendor; supplier: vendorAgreeToLock/Decline). Also fixed a silent "lock requested" result on the button. 🔑 OWNER CALL: four lock writers exist (finalizeVendor, package lock, wizard, the chat amendment's lockDeal). The guard pins those four; merging them into one is the owner's decision.
- ✅ PR #5716 (auto armed): the couple's name shows on the Customers list, the Today booking-ask cards and the Clients "in conversation" list (the waiting-row mask had outlived the 2026-09-08 "hide nothing" ruling). 🔑 OWNER CALL: the client detail page still says "This couple" before the supplier answers. get_vendor_event_brief returns nothing at that stage, so fixing it is a migration that would also expose the budget band and guest count.
- ✅ PR #5717 (auto armed): the deposit follows the quote (₱3,350 shown, prefilled, minimum enforced in recordDeposit); the quote schedule and lines are shown; Costing is hidden and updateVendorCosts is blocked for quote-settled bookings; the supplier sees the request and its status. Prune wt-deposit-min after merge.
- ⏭ NEXT AFTER #5717 MERGES (same files): (a) "+ Log a payment" writes to event_vendor_payments without deposit semantics. A first payment through it doesn't hold the date, and paying through both doors counts the money twice. Make it one door. (b) The lock-step downpayment in finalizeVendor has no quote minimum. (c) The /budget supplier card can still say "hasn't shared pricing" for a quote-locked supplier.
- ✅ MERGED: #5677, #5714, #5715, #5716. #5679 refreshed (e3dd6da3d6), auto armed, the last PR in the port-control queue. Prune wt-q5679 after merge. #5649 is BLOCKED awaiting the owner's yes on dropping release_lead_token_hold.
- #5717 dup-rule fixed (baseline regenerated, 16 narrow reads documented), pushed 2cfa5aa9d3. Add to the follow-up batch: (d) the supplier's "Update this quote" prefill doesn't read payment_schedule, so a revised quote may drop the supplier's schedule.
- ✅ PR #5718 (auto armed): the My Shop crash when a shop has ≥1 payment method (server onClick → ConfirmForm), plus an app-wide guard rsc-function-props; the verification identity fields read vendor_profiles_self; the payment-options link opens the section; nudges on Today and on the accepted quote in chat.
- ✅ PR #5720 (auto armed): pages + name search on Customers, Bookings, Messages, Clients (3 lists) and Proposals. Fixed silent truncation: Proposals capped at 50; the 1000-row PostgREST cap on thread, pool and booking reads; an .in() URL with 700+ ids 400s and blanks every name, now chunked by 100. ⏭ STILL SINGLE READS: the installments read (Payday), calendar blocks, the unread-notifications read, one booking read in the booked-events lookup.
- ✅ PR #5719 (auto armed): "Send a deal" waits for a quote. Supplier 🧾 → "Send a quote"; couple gets no deal chip before a quote exists; one helper, dealEntryFor. Prune wt-deal-waits after merge.

## 2026-09-20 — NFC Writer for QR codes (owner-requested; session "NFC Writer for QR Codes")
- 🔨 PR #5721 (auto armed): every link-QR carries Download · Write to NFC · Copy link; flag `NEXT_PUBLIC_NFC_WRITE_ENABLED` OFF until the owner confirms one real Android tap. Full report: `build-sessions/REPORT-NFC-2026-09-20.md`. Holds 9 QR files until merge (listed there). Two owner calls: crew-pairing QR → https? · PR 2 iOS in-app write (plugin + entitlement + re-review).
- ✅ PR #5722 (auto armed): one couple "Amount to pay" (₱3,350 minimum via recordDeposit, then ₱13,400 via logPayment); two-door double-count blocked on the server; lock-step minimum (flag off in prod); /budget quote lines; a revised quote keeps its schedule; booked chat card shows the money step on both ends; the booked proposal page says Booked. Prune wt-deposit-followups after merge. → Then the owner resumes S42 step 7.
- ✅ PR #5724 (auto armed, stacked on #5720): all four capped reads now read to the end (Payday installments, calendar blocks, unread threads, room booking candidates), plus the Earnings YTD (1,000-row cap, a .in() of every id, .limit(1000)), the Overview earned tile (₱0 on failure) and the payout totals (.limit(100)). A short read shows "couldn't load". ⏭ SWEEP (not fixed): (1) three pending-only vendor-overview reads; fetchLockAgreementRequests ignores its error. (2) clients/[eventId] open payment requests capped at 20. (3) manpower booked-events read unpaged. (5) disputes capped at 200. Prune wt-uncap-four after merge.
- 🔧 RUNNING 2026-09-20: (1) Dependabot 13 alerts (wt-deps, sonnet). (2) Sweep leftovers: overview lock/deposit reads, payment requests capped at 20, manpower, disputes pager (wt-sweep-left, opus). (3) s41c exact counts → per-site anchors + floors (wt-s41c-anchors, sonnet).

## 2026-09-20 — owner decisions
1. #5649: drop release_lead_token_hold → YES (agent refreshing #5649, auto armed).
2. Client detail brief: "they already see everything from the starts" → get_vendor_event_brief opens at first contact (wt-brief-early, PR WITHOUT auto; DB queue after #5649).
3. Merge the four lock writers into one → YES, after launch (LATER).
4. UNIQUE orders.service_key + skip on a failed existence check → YES (wt-service-key, PR WITHOUT auto; DB queue after the brief).
5. Launch list (captcha, Supabase Pro, R2 versioning, clickwrap, dpo@, alerts) → LATER, "not yet working properly".
DB QUEUE ORDER: #5649 → brief → service_key. Arm each after the previous merges.
⚠ INCIDENT: #5719's commit 59f87075a2 silently REVERTED all of #5717 on main (restored the pre-#5717 files, deleted accepted-quote-terms.ts). Only #5717's files were affected (#5718's nudge survived). #5722 restores #5717 underneath its follow-ups. Likely cause: a sabotage/restore loop replaying pre-merge file copies after `merge origin/main`. Guard idea: CI check that a PR deletes no file it didn't add (or a "reverts a merged PR" diff check).
- 🔨 PR #5726 (auto armed, stacked on #5721): Write to NFC inside the iOS/Android app — Capgo NFC plugin, iOS entitlement TAG + usage string, one success point behind read-back (second tap on the app). Unsigned iPhone build compiled clean. Owner steps: App ID "NFC Tag Reading" in the Apple portal → bump build → archive → upload → App Review; rebuild Android. Holds apps/mobile (package.json, lockfile, entitlements, Info.plist, SPM Package.swift, Gradle settings) + nfc-write-button.tsx until merge.
- ✅ PR #5727 (NO auto; DB queue after #5649 → brief): partial UNIQUE on orders(service_key) WHERE 'vendor_booking_fee__%'; booking_fee_upsert_vendor_order ON CONFLICT DO NOTHING; 23505 → already_billed. ⏭ FOLLOW-UP: widen maybeCatchUpAcknowledgedDeposits so a pending charge with no fee order is retried (today it's stuck until the next acknowledgement).

## 2026-09-20 — folded in from HANDOFF-EVENT-HUB-SESSION-2026-09-20.md
- ✅ **DAY-7 emcee questions:** PR #5639 MERGED 2026-09-19T16:29:51Z (built by S32; wt-S32 and wt-q5639 belong to that session).
- ✅ **DAY-12 Live Studio venue screens:** PR #5723 MERGED 2026-09-19T17:31:59Z (516dbf7ecc), 18/18 checks passed, `setnayan.com/live` served since 17:38Z. No migration.
  - Owner rulings: screens live in the unified Live Studio controller; they show only live background / mirror / off, never the photo wall; mirroring is OK with a visible "delayed" label.
  - Open owner calls (free vs paid, cap 6) are under ⚖ WAITING ON THE OWNER.
- ✅ **Phone tab label:** CLOSED, the owner keeps "Event Hub Controller".
- ⚠ Corpus: the DAY-12 row is appended to DECISION_LOG.md but NOT committed; the file also holds uncommitted NFC and service-key rows from other sessions. One commit of the corpus is owed.
- Process note: that session's messages to the controller were held for approval and expired. Sessions should hand off via a file in build-sessions/, as this one did.
- ✅ PR #5729 (auto armed): Dependabot fixes, 8 alerts closed via pnpm.overrides (js-yaml, fflate ×3, browserslist ×2, baseline-browser-mapping, postcss-selector-parser). 🔑 OWNER: dismiss on GitHub as dev-only: #92 #47 sharp (mobile icon tooling), #16 uuid (mobile). Leave open, documented: #32 @opentelemetry/core (a bump breaks Sentry), #2 glib (Linux-only Tauri backend; no stable fix).
- ✅ PR #5730 (NO auto; DB queue: #5649 → #5730 → #5727): suppliers see the full brief from first contact (thread, ask or shortlist row), now including venue, meal counts, timeline and seat-plan status. Closed a coordinator-unreleased-timeline leak. ✅ OWNER 2026-09-20: keep other booked shops' names HIDDEN before agreement (as built). Prune wt-brief-early after merge.
- 🔨 PR #5731 (auto armed, stacked on #5726): NFC check-in — the door desk reads a guest tag through the QR parser; migration 20271234853164 adds guest_checkins.method nfc_tap; per-phone `?nfc-test=1` switch (owner has only an iPhone). Holds checkin-desk.tsx, checkin/actions.ts, app/layout.tsx (one mount), nfc-* files until merge. Owner guide: build-sessions/NFC-OWNER-STEPS.md.
- ✅ OWNER 2026-09-20: dismissed Dependabot #92 #47 #16 (dev-only). Secret-scanning alert #1 ("Azure Event Grid key" in a vercel[bot] comment on #4614) → owner to close as false positive.
- ✅ NFC: #5721 #5726 #5731 all MERGED; worktrees pruned. Next is the owner (NFC-OWNER-STEPS.md, iPhone-only). Migration 20271234853164 rides this deploy.
- ⚠ FINDING (from the #5649 repair): `ugat-both-ends.baseline.txt` can no longer be regenerated wholesale — an honest regen yields ~44 rows and trips its own >100 anti-truncation floor, because 82 of the inherited 132 rows are ALREADY PAID DOWN by merged retirement/reads-honest PRs and a paid-down row only prints a note. Hand-edit one line per orphan actually retired. ⏭ Separate job: sweep the 82 stale rows and re-think the floor (the file would land at 44).

## 2026-09-20 — MONEY PATH is the priority (owner: "this is where we get money")
- 🔴 RUNNING (wt-fee-visible): disclose the fee BEFORE the supplier commits (sign-up, the quote builder, the Agree button), then make the bill findable (Today, the booking, the money pages) + notification and email on open. Owner: "as a vendor i do not know i have to pay" / "i never saw the payment screen to pay us". `/vendor-dashboard/booking-fees` was linked from ONE surface (the Subscription page).
- 🔴 RUNNING (wt-fee-unlocks): OWNER RULING — paying the fee unlocks the event for that supplier (7 items: full details + live updates, feature requests, Papic, Event Hub, portfolio, the couple's story, and the rest). Waived free-5 counts as settled; per event-vendor; the chat, that booking's money page and the fee payment screen stay open; the couple is never blocked; an unreadable fee fails OPEN. Ships behind an OFF flag for the owner to review the locked list and flip.

## 2026-09-20 — guest list + entourage (owner-reported live, session "guestlist pairing")

- 🔴 **OPEN — THE GUEST LIST GOES BLANK, AND IT IS THE ONLY THING BLOCKING THE OWNER.** Reported as
  "something happened when i tried to pair the bride's parents", then "it went blank and did not
  return to the guest list", then "the assigning roles works, but always goes to blank". Screenshot:
  app shell intact, content pane entirely empty.
  - **Measured:** all 8 pairs SAVED (`select … from guests where pair_with_guest_id is not null` on
    event `044f7e64-95aa-4dcb-84c1-7263bf494eaa` — incl. bride's parents Milagros ↔ Peregrino
    Buanhog and groom_immediate_family Maxima ↔ Juanita Sacdalan). The POST returns **303** and the
    follow-up GET **200**; zero `/dashboard/[eventId]/guests` entries in 24h of runtime errors.
    Neither error boundary can be it — `app/error.tsx` renders a large visible message.
  - **Best explanation, NOT confirmed:** `PartnerLine` (guest-list-multiselect.tsx) renders ONLY when
    `guest.pair_with_guest_id` is set, and it puts a `<form>` + submit `<button>` **inside the row's
    `<a href>`** (`InspectorTrigger` renders an anchor when given `href`, and it is). Interactive
    content inside an anchor. That also explains why assigning a role blanks too — once the first
    pair existed, EVERY render of the list carries it.
  - **Blocked on one 10-second test by the owner** (Chrome extension not connected to the session, so
    the console is unreadable from here): open
    `…/guests?view=guest`. None of the 16 paired people are plain guests, so `PartnerLine` renders
    zero times on that view. Loads fine while the normal list stays blank → confirmed; fix is to move
    the unpair control out of the anchor. Also blank → the theory is wrong, start again.
  - ⚠ An earlier reading in this session blamed **deployment skew** (the tab was served by three
    prod builds — 05:17 / 05:42 / 05:58Z — and a POST on the 05:17 build redirected onto the 05:58
    one). That is real and `next.config.ts` has **no `skewProtection`**, which is still worth doing,
    but it is NOT the explanation for "blank every time".
  - 🪤 **A false zero cost the first 20 minutes.** `grep -rni "pair" "app/dashboard/[eventId]/guests"`
    returned 4 hits and none was `pair-actions.ts`, so the session told the owner "no Pair control
    exists". This machine's `grep` is a ugrep shim that silently drops **bracketed paths** — already
    in memory as `grep-is-ugrep-and-brackets-defeat-it`, and hit anyway. The owner's own URL
    (`?paired=2`) is what surfaced the feature.

- ✅ **PR #5755** (auto armed): role chips take the mood-board colour instead of the fixed
  per-group Tailwind class — the couple and their parents both rendered red (`bg-danger-100` /
  `bg-danger-200/70`) on events whose mood board already named a colour for each. New
  `lib/role-chip-style.ts` is one rule imported by BOTH chip call sites (they disagreed: the primary
  resolved the specific palette key, the `+Role` extras only the group). Colour comes from
  `resolveAttirePaletteColor`, so a chip and a gown can never differ. Closed a gap: `roleGroupOf('groomsman')`
  returns `groomsmen` (its own group since the wedding-party split), so the old lookup could NEVER
  reach the shared `wedding_party` key. New `tintedChipFromAccent` in `site-palette.ts` — 16% wash,
  label carries the hue via the existing `ensureContrast`. Unfilled key ⇒ byte-identical to today.
  Prune wt-role-chips after all three merge.

- ✅ **PR #5758** (auto armed): a finished pair confirms itself and releases the SelectionBar. Owner:
  *"after applying the selected, this should already reset and be gone since the task is complete."*
  `pairSelectedGuests` redirects `?paired=2` and `page.tsx` had never heard of `paired` — missing
  from the searchParams type, from `pickFlash` (so a completed pair said NOTHING) and from
  `recentlyApplied` (so the bar never retracted). Apply/group/side were already fine. `unpaired` gets
  the type + flash but deliberately NOT the retraction (it fires from one row's control). Guard
  DERIVES the flag names from `pair-actions.ts`.
  - 🪤 The guard's first `pickFlash` window sliced to the first `\n}` — the end of the *parameter
    type*, where `search.<flag>` is never written — and passed on a page that read the flag nowhere.
    Windows must face the sabotage.

- ✅ **PR #5759** (auto armed) — now carries **#5762** too (opened stacked, auto-merged into its
  branch at once because protection only guards `main`; PR retitled and its body annotated).
  - ⚖ Owner's printing order: Maid of Honour & Best Man move to FIRST of the entourage proper (they
    sat under both sponsor groups), Bearers and Flower Girls split into two headings, "Bridesmaids &
    Groomsmen" → "Bride's Crew & Groom's Crew" (heading only).
  - 🔴 **VISIBILITY CHANGE AWAITING THE OWNER'S CONFIRMATION.** `bride_immediate_family` /
    `groom_immediate_family` were in NO group and so on NO page. They now publish. `ENTOURAGE_ROLES`
    is derived from the group list AND is the query's `role.in.(…)` filter, and the entourage section
    is **not** behind the recognised-viewer gate that hides the plain guest list — so on a public
    invitation, siblings' real names become readable by anyone with the link.
    `landing_page_visibility` is the only control that closes it. Owner was told; **if he says pull
    it, remove that one group — the rest of the reorder stands alone.**
  - The printed order was never stable: neither entourage query carries an `ORDER BY`. Now surname
    then given name, sorted **per role** (the role order inside a group is meaningful).
  - ⚖ "Both, and I want to drag them" → `guests.entourage_order` (migration `20271236109974`,
    nullable, no DEFAULT — a default would be a placement nobody made) + a Move ↑ / Move ↓ panel on
    the guest list's per-role view (owner chose that location). Buttons not HTML5 drag (no touch
    support; couples arrange on a phone), a panel not an 8th column (that table's widths are budgeted
    to the percent). Panel and invitation share ONE ordering function — otherwise "move her up" swaps
    her with whoever the DASHBOARD showed above her. NULL is never read as 0. Per-role Reset.
  - 28 tests; three sabotages confirmed red. No Ugat change (a new column, not a subsystem).

- ⏭ **NEXT, in order:** (1) the owner's `?view=guest` test → then the blank-screen fix. (2) `skewProtection`
  in `next.config.ts` — a tab open across a deploy is a whole class of "the site is down" reports, and
  `lib/stale-bundle.ts` only catches the ChunkLoadError-shaped half. (3) The bulk/pair actions still
  `redirect()` 20× (`groups-actions.ts` 16, `pair-actions.ts` 4), forcing a full SSR re-render per
  action — owner: *"it feels troublesome to update and everything is reloaded."* The optimistic
  overlay already exists (`guest-optimistic-store.ts`; `inline-actions.ts` has ZERO redirects) and
  pairing's docblock claim that there is "nothing useful to do optimistically" is no longer true now
  that a pair is visible in the row.

### 2026-09-20 later — the blank guest list RESOLVED ITSELF, and the second theory was wrong
- Owner: *"pairing now works and returns to guestlist"*. **Measured at that moment: NONE of #5755 /
  #5758 / #5759 had merged, and `PartnerLine` on `origin/main` still nests `<form>` + submit
  `<button>` inside the row's `<a href>` — byte-identical to when it was blanking.** So the
  form-in-anchor explanation is **NOT the cause**. It is still invalid HTML worth tidying, but it is
  demoted to a nit, not a defect.
- What DID change: five PRs merged to main in the interval (#5745 → #5753), each firing a deploy;
  only #5752 touched the guests area at all (an additive NFC guest card). The owner's tab picked up a
  current build.
- ⇒ **DEPLOYMENT SKEW was right all along** — the FIRST reading, which had the log evidence (one tab
  served by the 05:17 / 05:42 / 05:58Z builds; a POST on the old build redirecting onto the new one;
  a burst of status-`0` aborted requests at the moment it died). The session abandoned it when the
  owner's `?paired=2` URL surfaced a real pairing feature, and chased a vivid code-level story
  instead. 🔑 **A compelling mechanism found in source is not evidence against a measurement.**
- 🔴 **THEREFORE THE REAL FIX IS STILL UNSHIPPED AND IS NOW TOP OF THE LIST:** `skewProtection` is
  absent from `apps/web/next.config.ts` (`grep -c "skewProtection\|useDeploymentId"` → 0). Deploys
  land every ~15–25 min, so any couple or supplier with a tab open hits this, and it renders as "the
  site is down". `lib/stale-bundle.ts` only catches the ChunkLoadError-shaped half — this half throws
  nothing at all, so neither the boundary nor the one-shot reload fires. Needs the Vercel project
  toggle as well as the config; the toggle's state was NOT readable from the session.
- ⏭ Owner also reports the **selection toolbar still stays** after a pair — expected: **#5758 is the
  fix and has not merged yet** (0 failing, CI running).
- 🔴 **SKEW PROTECTION IS BLOCKED — NOT A CODE CHANGE, AND NOT AVAILABLE ON THIS ACCOUNT.** Measured
  2026-09-20: `skewProtection: true` in `next.config` is the **Astro adapter's** API, not Next.js —
  Next.js reads `VERCEL_SKEW_PROTECTION_ENABLED`, which only the Vercel project setting sets. The
  REST API exposes `skewProtectionMaxAge` (seconds; there is no boolean, the window IS the switch),
  and `PATCH /projects` with `{"skewProtectionMaxAge": 43200}` returned
  **404 `Skew Protection not found`** — i.e. the feature is not available/enabled for
  `team_dHILOMWD1LWoDGDT5udD8JV5`. The team's PLAN was not readable from the API (`get_team` and
  `list_teams` return only name/slug/id), so "Hobby" is an inference, not a measurement.
  ⇒ Enabling it is an **owner action with a cost** (a paid plan), not something a session can do.
- ⏭ The no-cost alternative, unbuilt and awaiting the owner's pick: inline the build's deployment id
  into the client bundle, expose the server's current one, and show a "a new version is ready —
  reload" bar when they differ. That is DIY skew DETECTION (it cannot pin a tab to its own
  deployment the way the paid feature does), but it converts the silent blank into something the
  couple can act on — which is the whole complaint.
- ✅ **PR #5767** (auto armed) — the no-cost half, owner picked it: `lib/build-version.ts` (pure
  decision: reload only for two DIFFERENT, REAL, KNOWN versions; missing/blank/`dev`/unparseable is
  silence) + `StaleTabNotice` mounted ONCE at the root (visibility + focus, never an interval; never
  auto-reloads — a couple may be mid-name; dismissal remembered per VERSION).
  `next.config.ts` inlines `NEXT_PUBLIC_BUILD_VERSION` from `VERCEL_GIT_COMMIT_SHA` — deliberately
  NOT `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`, which needs a dashboard toggle nobody checks.
  **No new route:** `/api/health` has returned the serving commit sha since iteration 0035.
  🪤 One assertion was WEAK and only found because the sabotage was verified to land: checking that
  `VERCEL_GIT_COMMIT_SHA` is merely PRESENT in `next.config.ts` passed a real sabotage, because that
  name also sits in the Sentry release config. Anchored on the binding instead.
- 🪤 **#5759 went red on `entourage-covers-the-cast`: "nothing is both published and baselined".**
  `lib/entourage-unpublished.baseline.txt` held a row for each immediate-family role reading
  *"⚠ OWNER CALL, NOT SETTLED … Publish these two if the owner wants a 'Family' section on the
  page"*. The owner answered exactly that question on 2026-09-20, so the note was spent — dropped
  both rows, 33/33 green, pushed. 🔑 **The guard had the open question written down and the answer
  arrived from the owner; publishing a role has TWO halves and CI knew the second one.**
- ✅ **PR #5768** (auto armed): one colour per roster row. Side → a 2px row edge (reusing
  `SIDE_CONTROL_BORDER`, not a twelfth side map) **plus a plain word** — the edge is for scanning,
  the word is what a colour-blind reader and a screen reader get. Role stays coloured (it is the
  identity and carries the mood-board colour); groups/seat/RSVP become text, RSVP keeping a tone
  dot. 🔑 **Mobile deliberately untouched:** `SidePill`/`RoleChips`/`RsvpPill`/`SeatChip`/
  `GroupChipList` are SHARED with `GuestCard` + `MobileListRow`, so the roster got text variants and
  the two shared components a `plain` prop. The first edit script asserted "exactly one occurrence"
  and **found two** — that assertion is the only reason mobile was not silently redesigned; every
  edit was then scoped to `DesktopRow`'s line range. Guard counts filled capsules rather than naming
  them, because the failure mode is creep one pill at a time.
- ✅ **PR #5769** (auto armed): a linked guest wears their own account photo when the couple has
  uploaded none. Owner's registration was FINE — `event_members.guest_id` linked his row (role
  `groom`); the roster just never read the account. Couple's upload always wins (an RSVP selfie was
  chosen for THIS wedding). One `faceFor` helper now answers all six row surfaces + drawer +
  inspector; each used to spell the lookup out, which is how five gain a fallback and the sixth does
  not. 🔒 Needs an ADMIN read (another account's `users` row is RLS-invisible by design) so it gates
  itself: the membership read runs as the CALLER, a non-member gets zero rows and the admin client is
  never asked; the select carries `user_id, profile_photo_url` and a test compares that list exactly.
  ⚖ **OWNER DECIDED, SAME DAY: "keep it opt-in, add the preference column".** Folded into the SAME
  branch rather than shipped as a follow-up, so the photo is never shared by default for even one
  deploy. `users.share_profile_photo_with_hosts` (migration `20271236036451`) is nullable with NO
  DEFAULT and the read filters `.eq(true)`, which excludes NULL — silence means no. A
  `NOT NULL DEFAULT TRUE` would have performed the declined disclosure once, silently, on every
  account; a `DEFAULT FALSE` would be a decision nobody made recorded as though they had. Sibling
  `discoverable_by_name` reads `?? true`; this reads `?? false`. The preference is FILTERED on,
  never SELECTED, so the admin read still carries only `user_id, profile_photo_url`. Toggle sits in
  Privacy beside "Can people find you by name?". 11 guards, 6 sabotages confirmed red.

---

## LATER / PARKED — not open, do not start

### 🎨 Mood board outfit library — `MOODBOARD-OUTFIT-LIBRARY.md`
Parked by the Mood board session [0d96e1] on 2026-09-21. **Owner: "we will do it next time."**
Recolourable sample outfits so "In your colors" can draw a real Barong / Filipiniana / gown instead
of a swatch. **Tier when it opens: Opus · high** for generation + owner review, **Sonnet · medium**
for the build PR that follows.
- 🔒 **Blocked on an owner action:** `RECRAFT_API_KEY` is not set on this machine. The recraft
  skill's claim that it is loaded is stale. Owner runs it himself — the key is never pasted into chat.
- ✅ Shipped alongside it: **PR #5826** (`claude/guest-colors-are-options`) — every attire palette key
  is Main + Accent; only plain guests are "options". Re-checked 2026-09-21: 0 failing, 2 pending,
  auto-merge armed. Prune `~/Documents/Claude/Projects/wt-attire-meaning` once it merges.
- 📐 Measured, and the reason the plan exists: **all 75 live `figure_attire` rows carry exactly ONE
  colour range**, so a couple's Accent is a label today and is painted nowhere.

## 🔑 ON THE OWNER'S DESK — from the Mood board session

1. **Does the event-level dress code (White Tie … Other) REPLACE the per-role style picker?** That
   picker shipped 2026-09-20 (`lib/role-dress-code.ts`) and feeds the guest invitation's "what YOU
   wear" panel. ⚠ Load-bearing — read the scope back as "this retires X; the invitation will then
   say Y" and get a yes **before** anything is removed.
2. **Bridesmaids / Groomsmen / Wedding Party still require 3 colours** (a soft editor warning, left
   from the old "coordinated palette" meaning). Relax to 1? Lowering `max` is NOT safe — the
   sanitizer clamps already-saved palettes.
3. **The 75 existing figures:** add accent colour areas to them, or retire them when the new library
   lands?

---

## 🧱 BUNDLED WAVE — 2026-09-21 · **4 merges, not 15**

Owner: *"create a prompt to combine different builds so we have to merge a smaller number — since we
are charged per merge."* So these are bundles: **one branch, one PR, one commit per build.**
Shared rules in `BUNDLE-COMMON.md` (hardest first, drop-don't-nurse, `--stat` before push).

| Bundle | Carries | Model · effort | File |
|---|---|---|---|
| **B1 — Money that must not be wrong** | refund reverses the fee · payment-approval status precondition (both doors) · duplicate-transfer check gets a bound · fee bill stops saying "nothing due" on a refused read · `no_payer` re-run on profile claim · unverified shop charged on an import booking · **free-5 disclosure + waived receipt (owner ruled, code does not follow)** | **Opus · high** | `CTRL-B1.md` |
| **B2 — The loop that never closes** | `mark_complete` desk item · couple's confirm reachable · review door + `auto_confirmed` settled · **going live notifies the supplier** · `is_published` leak · Earnings drops the dead payout section | **Opus · high** | `CTRL-B2.md` |
| **B3 — Say the true thing** | the RA 10173 claim on `/signup` · clickwrap checkbox · `/website/stories` gets a door · `shortlisted` made reachable or stopped being read · price bands refill without a button | **Opus · high** | `CTRL-B3.md` |
| **B4 — The invitation reaches a guest** | bulk mark-as-given · send by email · say who cannot be reached | **Opus · high** | `CTRL-B4.md` |

**Dispatch order:** B1 → B2 → B3 in the three build slots; **B4 waits** on the live guest-list and
people sessions (overlap on `lib/guests.ts` and the roster). 13 PRs are already open; do not add a
fourth slot.

⚠ **B2 build 3 and B3 build 6 are the same item** (`auto_confirmed`). Whichever starts first takes
it; the other skips and says so.

**Deliberately NOT in this wave, and why:** video rendering and Maya automation (L, and neither is a
day's work) · bank statement import (L) · partial refunds and receipt void/credit memo (**blocked on
an owner decision**) · the subscription paywall flip (**owner decision**) · dunning on an expired fee
(**blocked** — it depends on whether an unpaid fee removes anything, which is undecided) · the 73
unread couple-dashboard errors (L, whole-file) · marketplace supply (not a code item).

🔑 **Three owner answers each unblock a build:** does an unpaid fee remove anything (A bill / B access
waits / C overdue pauses new inquiries) · void vs credit memo for a refunded receipt · flip the
subscription paywall on.

---

## 🪡 RIDE-ALONG — fold into the NEXT Papic PR, do not open one for it

Owner, 2026-09-22: *"fold the "on on" fix into the next papic PR."* Cosmetic, so it is not worth a
round trip of its own (~1 h of CI here), but it is **not optional** — take it with the next change
that touches Papic at all.

**`apps/web/app/dashboard/[eventId]/studio/papic/_components/guest-cameras-choice.tsx`** — the
switch-OFF sentence renders **"Your guests' cameras switch on on 2026-09-11"**, a doubled "on".
Verified live as `testnayan1` on 2026-09-22. Grep the string `cameras switch on`, not a line number.

```
  Your guests&rsquo; cameras switch on
  {day ? ` on ${day}` : ' on your event day'} and stay on
```

**The fix: `switch on` → `open`.** "Your guests' cameras **open on** 2026-09-11 and stay on until
Sep 12, 11:59 AM…" — and `'on your event day'` in the null branch is already correct once the verb
changes. 🔑 **Do not fix it by deleting one `on` from the interpolation** ("cameras switch on
2026-09-11") — the date then reads as the object of "switch on" rather than a day, and the null
branch would need a second, different edit. `open` / `close` is also already the picker's own
vocabulary ("When your cameras open and close"), so the two surfaces end up saying it the same way.

⚠ **Pre-existing, not introduced by the capture-tail build** (#5861) — the old copy read "switch on
on \<date\> and stay on until the end of that day". That PR rewrote the sentence's TAIL and left the
head alone, which is why it is being carried here rather than filed as a regression.

---

## 🟢 DISPATCHED 2026-09-22 — `CTRL-PAPIC-REDESIGN.md` · **Opus 5 · high**

The Papic controller redesign, **one branch / one PR / one commit per build**. Prototype approved at
`claude.ai/artifact/MbAsqYqonaUYRaPMbZtnvG`; every decision is in `DECISION_LOG.md` under 2026-09-22.

Order (deviates from BUNDLE-COMMON rule 2 on purpose — the cut line should drop the *least
valuable*, and blur is it: **146 live guests, ZERO have ever used `faceblock_enabled`**):

1. **P1 spine** — Credits → Coverage → Allotment → Filter/Challenges/Live wall → Gallery/Kwento/Made for you → More, both phases; switch-only rows keep their switch; nothing jumps.
2. **P2 allotment** — a per-guest FLOOR (payable, ≤ the ceiling) + retire `PapicCamerasCard` and `papic_dedicate_shots`. ⚠ removes shipped functionality.
3. **P3 reachability** — 631 challenges + 12 categories + pick counts · guest search (reuse `orderAllotmentPickerRows`) · the recommendation on the page · 17 per-type config rows with the confirmed seed values.
4. **P3b the learning loop** — dormant. Only averages events that did NOT exhaust their pool.
5. **P4 blur per person** — the cut line.

⛔ **Step 0: #5866 must be MERGED first** — it touches nine of the same files.
🚫 **Out of bounds:** `lib/papic-window.ts` and `papic-window-picker.tsx` — `CTRL-PAPIC-WINDOW.md`
owns them in its own session (capture runs until lunch the next day).

🔑 **Owner-held, not blocking the start:** the per-type **floor/ceiling** values (the confirmed
table is `points_per_guest` only). Recommendation is in the brief; ask in the PR body.

---

## 🟢 DISPATCHED 2026-09-22 — `CTRL-W8-invite-themes.md` · **Opus 5 · high** · **needs the Browser pane**

A **looking** session, not a building one. The four invite themes (Capiz · Velvet · Galeriya ·
Abaca) are all SHIPPED and Pro-tier — `ONE_REGISTER.md` rows I-3/I-4/I-5/I-6 say otherwise and are
wrong; the brief carries the re-measurement. What is left is whether they RENDER right on a phone:
the reveal + three doors in the theme over the couple's photo (I-1), the House fallback for a couple
without Event Hub Pro (I-2, and `is_internal` accounts hide exactly that difference), then Q2 colour
fallback · Q3 the Pro inclusion lists · Q6 reveal-shown-once across doors · Q7 whether availability
really keys on event type · S5-1 the picker pointing at the colour setting.

🪤 Branch `pf/…`, never `claude/…` — `apps/web/vercel.json`'s `ignoreCommand` exits 0 on `claude/*`
and the session needs a Vercel preview. Test as `testnayan1..5@test.com` by email + password.
🔒 If more than one theme changes: Velvet → Galeriya → Abaca, strictly serial (one skin switch, one
font loader, one `lib/invite-themes.test.ts`).
