FIXER (checker 8): b1–b6 · b1 PR #8322 handed over (+ A-1 per controller ruling; the other 8 A1 guards are #8332, checker 8-1) · b2 PR #8327 handed over · b3 PR #8344 handed over · b4 preflight running · b5 preflight running · b6 built, preflight next · b7–b10 belong to checker 8-1
STATUS: phase B done · 71/71 pages walked (375 light+dark, 768, 1280; dark sample at 768/1280) · 36/36 forwards land · 156/156 links ok · buttons 3,311 · pressed 2,303 · failed 0 confirmed · left 1,008 · phase-B findings 22 (blocker 0 · broken 0 · wrong 7 · look 15) + G-4 confirmed (money-signin) · checker-made changes disclosed and restored

# Final check · Area 8 · Admin (/admin/* and the internal pages)

> CHECKER 8 of 8. Report only, never a fix. Check commit: main @ fb3f72d (frozen). Phase A = code pass (SOURCE: CODE).
> Phase B (browser walk on staging) waits for the controller's address. Kit: `build-sessions/FINAL-CHECK-KIT.md` §§ 3–6.
> Marks per page: OFFLINE = NEEDED / READ-ONLY IS ENOUGH / NOT NEEDED · SHAPE = what it is TODAY → what it SHOULD be (PAGE / FULL-SCREEN POPUP / SMALL POPUP).

## Area 8 lane A split (controller, 25 Nov: checker 8 = b1–b6, checker 8-1 = b7–b10)

So no finding is fixed twice. IDs are the lane A entries in `ALL-FINDINGS.md` § Area 8.

| Batch | Owner | Branch / PR | Findings |
|---|---|---|---|
| b1 | checker 8 | `claude/fc-fix-a8-b1` · #8322 | G-4 · L-1 · L-2 · C-3 · A-1 · B-9 · B-10 · F-22 · G-16 · I-11 · P-B-12 |
| b2 | checker 8 | `claude/fc-fix-a8-b2` · #8327 | F-23 · A-24 · A-21 · F-19 · E-11 · I-7 · I-8 · G-12 · G-9 · F-24 |
| b3 | checker 8 | `claude/fc-fix-a8-b3` · #8344 | F-5 · D-8 · A-23 · A-19 · B-16 · I-10 · I-12 · C-5 |
| b4 | checker 8 | `claude/fc-fix-a8-b4` | Work/Focus/catalogue honest reads: C-1 · C-6 · C-7 · C-8 · C-9 · C-10 · H-14 · B-14 · B-15 · E-10 · F-20 · D-15 |
| b5 | checker 8 | `claude/fc-fix-a8-b5` | Saves that hide a failure: F-6 · D-9 · F-7 · H-6 · H-15 · I-1 · I-2 · B-6 · H-10 · D-10 · A-10 · E-12 |
| b6 | checker 8 | `claude/fc-fix-a8-b6` | Money desks, display only (never an amount): A-3 · A-11 · H-1 · H-3 · E-3 · E-4 · B-1 · B-4 · B-7 · B-8 · A-9 · F-1 · F-3 · D-6 |
| b7–b10 | **checker 8-1** | yours to cut | Everything else in area 8 lane A: the permission guards (D-1 · D-2 · D-3 · D-4 · D-5 · B-2 · L-8), A-2 · A-5 · A-6 · A-7 · A-8 · A-18 · A-20 · A-22 · C-4 · C-11 · D-11 · D-12 · D-13 · D-14 · E-1 · E-2 · E-5 · E-8 · E-9 · E-13 · F-8 · F-13 · F-14 · F-15 · F-16 · F-17 · F-18 · F-21 · F-25 · G-3 · G-5 · G-6 · G-7 · G-8 · G-10 · G-11 · H-7 · H-8 · H-9 · H-11 · H-16 · I-3 · I-6 · L-5 · L-9 · P-B-3 · P-B-14 · P-B-18 · P-B-22 |

Shared files the batches touch (so 8-1 can avoid collisions): `lib/admin/admin-pages.ts` (b3: `notInMenus`), `app/admin/_components/tab-landing.tsx` (b1), `app/admin/_components/admin-tab-rows.tsx` (b3), `app/_components/help-ask/*` (b3), `app/admin/gifts/page.tsx` (b2), `lib/spotlight-awards.ts` + `lib/background-videos.ts` (b2). If b4–b6 must move an ID, this table is edited first.

## Lock proof

Phase B, staging copy at preview commit bd86936 (`/api/health` env preview), signed in as the seeded admin account.

- **(a) Maya, `/admin/integrations`** (forwards to `/admin/business?view=integrations`), 25 Nov 06:47 UTC: the Maya card reads
  **"Sandbox — test payments, no money moves."**, status **"No keys"**, public and secret API key **NOT SET**, and
  "On, but hidden — a Maya key is missing. Payers see the BDO QR." → **closed + sandbox. Lock holds.** The webhook
  button ("Register webhooks") was not pressed.
- **(b) Email, `/admin/email-delivery`** (forwards to `/admin/switches?view=email`), 06:48 UTC: "Email is switched off.
  No Resend key is set, so nothing is being sent." Key source **Not configured**; "No emails were sent in the last 7
  days." Integrations › Resend also reads **Off · Not configured**. With no key, `sendEmail` cannot reach any
  address → **no real send is possible. Lock holds.** Checker 2's chat message: not visible yet at 06:48 (the 7-day
  list is empty).
- **(b) re-check, 07:35 UTC:** the 7-day list now holds 3 rows, all **"Not sent"** with the reason "staging copy: no
  allowlisted test inbox (STAGING_EMAIL_SINK) — email dropped": checker 2's **"New message from Bea & Paolo" (chat
  message, to a masked `su•••@final-check.test`)** and two "You earned SETNAYAN Verified" badge emails. Counters:
  Delivered 0 · Did not arrive 3. → **the chat message went nowhere; logged as dropped. Lock holds.**
  (Note, not a finding: on the copy a lock-dropped email is counted under "Did not arrive", the same bucket as a real
  bounce. Expected on the copy per kit § 5.)

## Phase B summary (browser walk on the staging copy, 25 Nov 2026, 06:45–09:40 UTC)

- **Walked:** all **71 pages** at **375 light · 375 dark · 768 light · 1280 light**, and **768/1280 dark on a 10-page
  sample** (`/admin`, accounts, payments, pricing, catalogue, app-performance, team, work, studio, money). Admin paints
  Light in every dark visit (92 of 92, L-3), so the dark sample is the same pixels; that is why dark was not repeated
  at every width. Plus **Focus and Full** modes (the walk ran in Focus, the default; Full checked on Money at 375/768/1280),
  all **36 forwards**, the **non-admin test** (L-1, L-2) and the **offline test** (Add 10).
- **Every page opens:** 71/71 answer 200 at every width; **0 broken links** (156 unique admin links, each fetched one by one).
  **36/36 forwards land**; 6 land at the approved 17 Nov homes rather than the kit's snapshot (see Forwards).
- **Buttons (Add 6), totals at 1280:** buttons **3,311** · pressed **2,303** · failed **0 confirmed** · left **1,008**.
  At 375: **1,955** controls counted; their links are the same addresses as at 1280 and all resolve; buttons were
  pressed at 1280 only (the copy was too slow for a second press pass). Left = would write data (save, approve, send,
  pay, delete…), dropdown options and form inputs (never chosen), disabled, a 2-minute time cap per page on the slow copy,
  or "walker blocked" (another popover covered the control; every candidate re-tried by hand opened and closed correctly).
- **Phase-A box closed:** `/admin/secrets` was opened in the browser (it renders as `/admin/business?view=secrets`): it
  shows variable NAMES and status only ("Set", "Unknown from here"), never a value. Nothing on it was pressed.
- **Phase B findings: 22** (P-B-1 … P-B-22 below): blocker 0 · broken 0 · wrong 7 · look 15; plus G-4 confirmed (money-signin).
  Phase A findings confirmed in the browser: L-1, L-2 (gates hold), L-3 (no dark), G-4. The rest stay `SOURCE: CODE`.
- **Speed:** the copy served 8 checkers at once, so seconds here are not production's. Nearly every admin page took
  over 2 s to first paint; some took 40–150 s at peak. The steadily slowest, across runs: `/admin/ugat` (~54 s both
  widths), `/admin/work` (~45 s), `/admin/catalogue`, `/admin/approvals`, `/admin/email-delivery` (~30 s).

### Phase B per page (Add 6 counts; DARK per Add 7)

| Page | Lands at | Controls 375 · 768 · 1280 | 1280: pressed · failed · left (why) | DARK | Load 1280 (s) | Errors |
|---|---|---|---|---|---|---|
| `/admin` | `/admin` | 11 · 11 · 28 | 26 · 0 · 2 (writes 2) | no (paints light) | 6.9 | React #418 |
| `/admin/account-deletions` | `/admin/work?view=account-deletions` | 8 · 8 · 25 | 24 · 0 · 1 (writes 1) | no (paints light) | 86.6 | telemetry 500 |
| `/admin/accounts` | `/admin/accounts` | 25 · 27 · 45 | 33 · 0 · 12 (writes 1, walker blocked 11) | no (paints light) | 87.0 | React #418 |
| `/admin/admin-log` | `/admin/admin-log` | 14 · 13 · 28 | 24 · 0 · 4 (writes 2, walker blocked 2) | no (paints light) | 31.4 | React #418 |
| `/admin/app-performance` | `/admin/app-performance` | 39 · 39 · 60 | 49 · 0 · 11 (writes 4, dropdown 1, input 1, walker blocked 5) | no (paints light) | 91.9 | — |
| `/admin/approvals` | `/admin/work?view=approvals` | 11 · 11 · 28 | 25 · 0 · 3 (writes 2, dropdown 1) | no (paints light) | 41.7 | — |
| `/admin/ask` | `/admin/ask` | 9 · 9 · 24 | 22 · 0 · 2 (writes 1, walker blocked 1) | no (paints light) | 18.7 | — |
| `/admin/background-videos` | `/admin/studio?tab=background-videos` | 10 · 10 · 28 | 27 · 0 · 1 (writes 1) | no (paints light) | 2.5 | React #418 |
| `/admin/booking-fees` | `/admin/payments?view=fees` | 22 · 17 · 36 | 34 · 0 · 2 (writes 2) | no (paints light) | 18.8 | JS error, React #418, telemetry 500 |
| `/admin/budget-planner` | `/admin/budget-planner` | 83 · 83 · 101 | 29 · 0 · 72 (writes 37, input 34, walker blocked 1) | no (paints light) | 25.8 | — |
| `/admin/business` | `/admin/business` | 71 · 71 · 86 | 41 · 0 · 45 (writes 21, input 23, walker blocked 1) | no (paints light) | 20.1 | — |
| `/admin/catalogue` | `/admin/catalogue` | 38 · 38 · 56 | 55 · 0 · 1 (writes 1) | no (paints light) | 113.6 | React #418 |
| `/admin/categories` | `/admin/categories` | 36 · 36 · 127 | 32 · 0 · 95 (writes 5, walker blocked 90) | no (paints light) | 48.4 | — |
| `/admin/categories/requests` | `/admin/categories/requests` | 10 · 10 · 28 | 26 · 0 · 2 (writes 2) | no (paints light) | 14.3 | React #418 |
| `/admin/chat-flags` | `/admin/work?view=chat-flags` | 10 · 10 · 27 | 25 · 0 · 2 (writes 2) | no (paints light) | 35.4 | — |
| `/admin/colours` | `/admin/switches?view=colours` | 32 · 32 · 47 | 38 · 0 · 9 (writes 6, walker blocked 3) | no (paints light) | 41.9 | — |
| `/admin/completions` | `/admin/work?view=completions` | 9 · 13 · 30 | 24 · 0 · 6 (writes 6) | no (paints light) | 9.2 | React #418 |
| `/admin/compliance/data-sheet` | `/admin/business?view=data-sheet` | 11 · 11 · 26 | 25 · 0 · 1 (writes 1) | no (paints light) | 16.3 | — |
| `/admin/concierge-abuse` | `/admin/work?view=ai-abuse` | 12 · 12 · 29 | 27 · 0 · 2 (writes 1, walker blocked 1) | no (paints light) | 78.5 | — |
| `/admin/corrections` | `/admin/work?view=corrections` | 13 · 13 · 30 | 28 · 0 · 2 (writes 2) | no (paints light) | 14.5 | React #418 |
| `/admin/data-privacy` | `/admin/business?view=privacy` | 36 · 36 · 51 | 49 · 0 · 2 (writes 2) | no (paints light) | 2.5 | — |
| `/admin/demand` | `/admin/app-performance?tab=demand` | 12 · 12 · 28 | 24 · 0 · 4 (writes 2, walker blocked 2) | no (paints light) | 27.5 | — |
| `/admin/demo-vendors/inquiries` | `/admin/help?view=demo-inquiries` | 10 · 10 · 27 | 26 · 0 · 1 (writes 1) | no (paints light) | 41.7 | — |
| `/admin/directory` | `/admin/directory` | 29 · 31 · 52 | 40 · 0 · 12 (writes 1, walker blocked 11) | no (paints light) | 2.6 | — |
| `/admin/discount-codes/new` | `/admin/discount-codes/new` | 36 · 36 · 55 | 35 · 0 · 20 (writes 4, input 16) | no (paints light) | 1.9 | — |
| `/admin/disputes` | `/admin/work?view=disputes` | 15 · 15 · 32 | 28 · 0 · 4 (writes 2, walker blocked 2) | no (paints light) | 2.0 | — |
| `/admin/editorial-review` | `/admin/work?view=editorial` | 70 · 70 · 87 | 82 · 0 · 5 (writes 1, walker blocked 4) | no (paints light) | 2.1 | — |
| `/admin/email-delivery` | `/admin/switches?view=email` | 15 · 15 · 30 | 25 · 0 · 5 (writes 3, disabled 1, walker blocked 1) | no (paints light) | 28.5 | — |
| `/admin/event-deletions` | `/admin/work?view=event-removals` | 9 · 9 · 26 | 25 · 0 · 1 (writes 1) | no (paints light) | 2.5 | — |
| `/admin/force-majeure` | `/admin/work?view=force-majeure` | 11 · 11 · 28 | 24 · 0 · 4 (writes 2, walker blocked 2) | no (paints light) | 3.1 | — |
| `/admin/founder-seats` | `/admin/offers?view=founder-seats` | 13 · 13 · 32 | 29 · 0 · 3 (writes 3) | no (paints light) | 2.1 | — |
| `/admin/fraud` | `/admin/work?view=fraud` | 8 · 8 · 25 | 24 · 0 · 1 (writes 1) | no (paints light) | 3.2 | — |
| `/admin/gifts` | `/admin/offers?view=gifts` | 46 · 60 · 79 | 49 · 0 · 30 (writes 13, input 15, walker blocked 2) | no (paints light) | 2.6 | — |
| `/admin/help` | `/admin/help` | 10 · 10 · 27 | 26 · 0 · 1 (writes 1) | no (paints light) | 1.3 | — |
| `/admin/help/guides` | `/admin/help/guides` | 19 · 19 · 36 | 34 · 0 · 2 (writes 2) | no (paints light) | 2.3 | — |
| `/admin/hub-music` | `/admin/studio?tab=hub-music` | 11 · 11 · 29 | 27 · 0 · 2 (writes 2) | no (paints light) | 5.0 | — |
| `/admin/integrations` | `/admin/business?view=integrations` | 32 · 32 · 47 | 32 · 0 · 15 (writes 13, dropdown 1, disabled 1) | no (paints light) | 24.7 | — |
| `/admin/integrity-watch` | `/admin/work?view=integrity` | 15 · 15 · 32 | 29 · 0 · 3 (writes 2, walker blocked 1) | no (paints light) | 25.1 | — |
| `/admin/launch-offer` | `/admin/offers` | 11 · 11 · 30 | 26 · 0 · 4 (writes 4) | no (paints light) | 3.0 | — |
| `/admin/live-studio-channels` | `/admin/switches?view=live-watch` | 12 · 12 · 27 | 25 · 0 · 2 (writes 1, walker blocked 1) | no (paints light) | 2.8 | — |
| `/admin/money` | `/admin/money` | 36 · 36 · 55 | 54 · 0 · 1 (writes 1) | no (paints light) | 5.3 | — |
| `/admin/more` | `/admin/work?view=all` | 48 · 48 · 63 | 60 · 0 · 3 (writes 2, walker blocked 1) | no (paints light) | 3.1 | — |
| `/admin/offers` | `/admin/offers` | 11 · 11 · 30 | 26 · 0 · 4 (writes 4) | no (paints light) | 5.6 | — |
| `/admin/pakanta` | `/admin/work?view=music-maker` | 10 · 10 · 27 | 26 · 0 · 1 (writes 1) | no (paints light) | 49.3 | — |
| `/admin/papic-storage` | `/admin/app-performance?tab=papic-storage` | 13 · 13 · 29 | 27 · 0 · 2 (writes 1, walker blocked 1) | no (paints light) | 20.6 | React #418 |
| `/admin/pax-changes` | `/admin/work?view=pax-changes` | 8 · 8 · 25 | 24 · 0 · 1 (writes 1) | no (paints light) | 13.5 | — |
| `/admin/payment-options` | `/admin/payments?view=payment-options` | 9 · 9 · 28 | 26 · 0 · 2 (writes 2) | no (paints light) | 3.4 | — |
| `/admin/payments` | `/admin/payments` | 13 · 13 · 32 | 29 · 0 · 3 (writes 3) | no (paints light) | 2.2 | — |
| `/admin/payments/supplier-refunds` | `/admin/payments?view=refunds` | 11 · 11 · 30 | 27 · 0 · 3 (writes 2, walker blocked 1) | no (paints light) | 2.7 | React #418 |
| `/admin/payouts` | `/admin/payments?view=payouts` | 9 · 9 · 28 | 26 · 0 · 2 (writes 2) | no (paints light) | 3.2 | — |
| `/admin/pricing` | `/admin/pricing` | 40 · 40 · 59 | 34 · 0 · 25 (writes 6, other 19) | no (paints light) | 2.5 | — |
| `/admin/receipts` | `/admin/money?view=receipts` | 10 · 10 · 29 | 28 · 0 · 1 (writes 1) | no (paints light) | 3.9 | — |
| `/admin/repost-watch` | `/admin/work?view=repost` | 79 · 79 · 96 | 32 · 0 · 64 (writes 62, walker blocked 2) | no (paints light) | 2.9 | — |
| `/admin/reviews` | `/admin/work?view=reviews` | 14 · 14 · 31 | 28 · 0 · 3 (writes 1, walker blocked 2) | no (paints light) | 2.8 | React #418 |
| `/admin/search-memory` | `/admin/ugat?tab=search` | 10 · 10 · 28 | 27 · 0 · 1 (writes 1) | no (paints light) | 3.7 | — |
| `/admin/secrets` | `/admin/business?view=secrets` | 67 · 67 · 82 | 74 · 0 · 8 (writes 6, walker blocked 2) | no (paints light) | 12.0 | — |
| `/admin/settings/payment-methods` | `/admin/business?view=accounts` | 31 · 31 · 46 | 24 · 0 · 22 (writes 17, input 3, disabled 2) | no (paints light) | 17.0 | — |
| `/admin/studio` | `/admin/studio` | 30 · 64 · 85 | 48 · 0 · 37 (writes 2, disabled 1, time cap 27, walker blocked 7) | no (paints light) | 1.6 | telemetry 500 |
| `/admin/subscriptions` | `/admin/payments?view=subscriptions` | 10 · 10 · 29 | 27 · 0 · 2 (writes 2) | no (paints light) | 6.3 | React #418 |
| `/admin/switches` | `/admin/switches` | 27 · 27 · 42 | 33 · 0 · 9 (writes 4, walker blocked 5) | no (paints light) | 2.3 | — |
| `/admin/team` | `/admin/team` | 111 · 111 · 126 | 32 · 0 · 94 (writes 1, disabled 25, time cap 57, walker blocked 11) | no (paints light) | 2.1 | — |
| `/admin/ugat` | `/admin/ugat` | 220 · 220 · 238 | 34 · 0 · 204 (writes 77, other 125, walker blocked 2) | no (paints light) | 55.1 | — |
| `/admin/ugat/map` | `/admin/ugat/map` | 18 · 18 · 36 | 32 · 0 · 4 (writes 1, other 3) | no (paints light) | 5.4 | React #418, telemetry 500 |
| `/admin/user-reports` | `/admin/work?view=user-reports` | 14 · 14 · 31 | 28 · 0 · 3 (writes 1, walker blocked 2) | no (paints light) | 10.3 | — |
| `/admin/vendor-partnerships` | `/admin/vendor-partnerships` | 32 · 32 · 50 | 30 · 0 · 20 (writes 3, input 16, walker blocked 1) | no (paints light) | 4.8 | — |
| `/admin/vendor-recommendations` | `/admin/vendor-partnerships?view=recommendations` | 79 · 79 · 97 | 29 · 0 · 68 (writes 34, input 33, walker blocked 1) | no (paints light) | 3.8 | — |
| `/admin/venues/new` | `/admin/venues/new` | 28 · 28 · 46 | 26 · 0 · 20 (writes 2, dropdown 1, input 17) | no (paints light) | 4.6 | — |
| `/admin/verification-docs` | `/admin/verification-docs` | 10 · 10 · 28 | 26 · 0 · 2 (writes 1, walker blocked 1) | no (paints light) | 10.5 | — |
| `/admin/verify` | `/admin/verify` | 17 · 17 · 35 | 34 · 0 · 1 (writes 1) | no (paints light) | 5.1 | — |
| `/admin/website-media` | `/admin/studio?tab=website-media` | 10 · 10 · 28 | 27 · 0 · 1 (writes 1) | no (paints light) | 20.4 | React #418 |
| `/admin/work` | `/admin/work` | 36 · 36 · 53 | 52 · 0 · 1 (writes 1) | no (paints light) | 43.1 | React #418 |

DARK column: every page is `DARK: no` today (L-3, one finding). OFFLINE and SHAPE marks are unchanged from phase A.

## Phase A summary (code pass, 25 Nov 2026)

- **Done:** 70 of 71 pages, the shared admin shell, and all 36 forwards. **Not checked:** `/admin/secrets`. This
  session's permission settings refuse every read of `apps/web/app/admin/secrets/`, so a session that is allowed to
  open it must check it (it now renders as `/admin/business?view=secrets`).
- **Findings: 274, all `SOURCE: CODE`.** blocker 0 · money-signin 61 · broken 18 · wrong 78 · look 117.
- **OFFLINE:** NOT NEEDED 70 · READ-ONLY IS ENOUGH 0 · NEEDED 0.
- **SHAPE:** PAGE → PAGE 68 · PAGE → FULL-SCREEN POPUP 2 (`/admin/venues/new` D-30, `/admin/discount-codes/new` A-29).
  2 pages differ today. 13 more SHAPE findings are about the popups pages open (a popup on a popup, or a long form in
  the wrong place).
- **How it was read:** nine read-only checkers each read one group of pages line by line. The lead re-read the code
  behind L-1…L-9 and spot-checked A-1, B-2, B-11, C-3, D-1, F-9, G-4, G-5, H-4, H-5, I-1 and I-6; all held. Every
  other finding is a checker's reading of the code, to be confirmed or struck in phase B.

**The money-signin themes, for the area's builder:**
1. Admin area powers are not held on the server: L-8 (Catalogue, money desks), B-2 (prices), D-1 and D-3 (deletions),
   D-4 (free plans), C-3 (service-role read before the gate), L-1 (government-ID shelf behind the layout gate only),
   and G-4 (any signed-in account can upload into the homepage video folder).
2. A failed read becomes ₱0, "Free", a default or an empty queue: A-1, A-3, B-1, B-4, B-7, B-8, E-3, E-6, H-1, H-3,
   I-3, G-3, F-1, F-3, D-6, A-9, and others.
3. Pesos are formatted by hand rather than through `lib/php.ts`, and some prices are typed into code: A-5, A-12 to A-17,
   B-3, B-5, C-2, E-7, G-2, H-2, H-4, I-4, I-5, F-2, D-7.
4. Saves that ignore a refused write still say "Saved": I-1, I-2, B-6, D-5, A-10, E-1.

**For phase B:** 43 of the 71 page addresses (and 4 forwards) are moved by the middleware with a 307 to a merged view
(`/admin/payouts` → `/admin/payments?view=payouts` …). That is expected; see L-9. Admin is not on `DARK_READY`
(L-3), so the dark walk will show every admin page in Light. That is one finding, not 71.

## BLOCKERS

None found. (Phase B, so far: the copy is slow under all eight checkers, but every admin page opens.)

## ⚠ Checker 8 changed data on the copy (disclosed; restored)

My automated button walk pressed controls whose labels did not read as writes. The admin log (`/admin/admin-log`,
Person = Admin Staging) shows every change; all were made by this checker, and all are restored except one additive job:

| When (UTC, 25 Nov) | What | Restored? |
|---|---|---|
| ~07:26 | Money › To approve › Fees owed: "One event fewer" → the review count went **2 → 1** (`fee_review_min_edit`) | **Yes**, ~09:25: back to **2** via "One event more", checked after a reload |
| ~08:46–08:47 | Catalogue › Studio › Website (Home page sections): **3 switches turned off** (Browse strip, Hero, What's live today) and **7 up/down moves** among the first six rows (`site_widgets_toggle`, `site_widgets_reorder`) | **Yes**, ~09:25: order back to Announcement bar · Browse strip · Hero · What's live today · The chaos we're fixing · Built for both sides · (rows 7–15 never moved), **all 15 on**, checked after a reload |
| during the 1280 walk | Insights › Papic storage: **"Fill in missing Memory lane copies"** pressed once. It only ADDS small display copies of existing photos (up to 40); nothing deleted or changed. The page now reads "Every photo already has its Memory lane copy." | Not reversible and not harmful: additive derived copies |

**For area 1 and the controller:** between about **08:46 and 09:25 UTC** the copy's **homepage was missing its Browse
strip, Hero and What's live today sections and its first rows were out of order**. Any area-1 finding about those
sections from that window is caused by me, not the product. Checked and unchanged: Close bookings (opened the confirm,
pressed Escape; bookings still open), the demo-mode switch (still "Default — off"), the colours designer and the loader
picker (draft-only until Save; nothing saved), the expense form (never submitted). Inputs, dropdown options and submit
buttons were never pressed.

## Raised at once in phase B (money-signin)

- **G-4 confirmed live:** any signed-in non-admin account gets an upload URL for the homepage background-video
  folder (`/api/upload`, `homepage-bg/…` → 200; `hub-music/…` → 403). See G-4 under Group G.

## Progress

### Pages (71)

- [x] /admin · OFFLINE: NOT NEEDED · SHAPE: today PAGE (Focus list; in Full mode it is the Work landing) → should PAGE
- [x] /admin (shell, every page) · OFFLINE: NOT NEEDED · SHAPE: n/a (chrome) · doors checked: every href in admin-nav-groups.tsx and admin-pages.ts, the ADMIN_ROUTES map, bottom-nav tabs, rail, avatar rows and pinned rows reach an existing page.tsx or route.ts (one exception: C-4)
- [x] /admin/account-deletions · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/accounts · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: users, vendors, events, venues, demo-vendors
- [x] /admin/admin-log · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/app-performance · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: overview (default + bare-address landing), connection-logs, funnels, growth, intelligence, offline, operations, seo, visits, interconnections, browser-blocks, slow-loads
- [x] /admin/approvals · OFFLINE: NOT NEEDED · SHAPE: today PAGE (renders as /admin/work?view=approvals) → should PAGE
- [x] /admin/ask · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE (Setup › Help, prints as A4)
- [x] /admin/background-videos · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/booking-fees · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/budget-planner · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/business · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · views checked: own (identity, brand icon, loader, Sentry, compliance), privacy, data-sheet, integrations (secrets view not readable, see NOTES)
- [x] /admin/catalogue · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/categories · OFFLINE: NOT NEEDED · SHAPE: today PAGE (map + full-screen Sheet drawer) → should PAGE
- [x] /admin/categories/requests · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/chat-flags · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/work?view=chat-flags) → should PAGE
- [x] /admin/colours · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/switches?view=colours; preview inline, sticky save bar, no overlay) → should PAGE
- [x] /admin/completions · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/compliance/data-sheet · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/concierge-abuse · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/work?view=ai-abuse) → should PAGE · tabs checked: queue, enforcement
- [x] /admin/corrections · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/work?view=corrections; inline address form + confirm popups) → should PAGE
- [x] /admin/data-privacy · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: controls, coverage, deletions, checklist, documents (+ documents/[doc] route)
- [x] /admin/demand · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/demo-vendors/inquiries · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/directory · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/discount-codes/new · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should FULL-SCREEN POPUP
- [x] /admin/disputes · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/editorial-review · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/work?view=editorial) + record PAGE /admin/editorial-review/[editorialId] → should PAGE + record PAGE
- [x] /admin/email-delivery · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/event-deletions · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/force-majeure · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE (the [flagId] record: PAGE → PAGE)
- [x] /admin/founder-seats · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/fraud · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/gifts · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/offers?view=gifts; grant forms inline by ?grant_vendor= / ?grant_user=) → should PAGE
- [x] /admin/help · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: help (the demo-inquiries view is its own page)
- [x] /admin/help/guides · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/hub-music · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE (one sub-surface finding below)
- [x] /admin/integrations · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/integrity-watch · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/work?view=integrity) → should PAGE · tabs checked: reviews, listings, inquiries, prices
- [x] /admin/launch-offer · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/live-studio-channels · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/switches?view=live-watch) → should PAGE
- [x] /admin/money · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: landing, everything, receipts
- [x] /admin/more · OFFLINE: NOT NEEDED · SHAPE: today PAGE (the address forwards 307 to `/admin/work?view=all`; its own "All surfaces" body never renders) → should PAGE
- [x] /admin/offers · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: launch-offer, founder-seats, badges (seals/shops/rewards); discount-codes, referrals, gifts (scan only)
- [x] /admin/pakanta · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/papic-storage · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/app-performance?tab=papic-storage) → should PAGE
- [x] /admin/pax-changes · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/payment-options · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/payments · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: To confirm, All payments, Needs a quote, ?open= payment, views refunds · payouts · fees · payment-options · subscriptions
- [x] /admin/payments/supplier-refunds · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/payouts · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: Pending, Paid, On hold, All, ?open= payout
- [x] /admin/pricing · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: pricing, setnayan-ai, papic-shots, price-bands, free-windows, plan-contents
- [x] /admin/receipts · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/repost-watch · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/work?view=repost) → should PAGE
- [x] /admin/reviews · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/work?view=reviews) → should PAGE
- [x] /admin/search-memory · OFFLINE: NOT NEEDED · SHAPE: today PAGE (renders as /admin/ugat?tab=search) → should PAGE
- [x] /admin/secrets · OFFLINE: NOT NEEDED · SHAPE: today PAGE (renders as /admin/business?view=secrets) → should PAGE · checked in the BROWSER in phase B (the code folder is still unreadable to this session): names and status only, no value shown; 82 controls at 1280, nothing that writes was pressed
- [x] /admin/settings/payment-methods · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/studio · OFFLINE: NOT NEEDED · SHAPE: today PAGE (tab host, `?tab=`) → should PAGE · tabs checked: website, reveal-studio, real-stories, storytellers, recaps, patiktok, songs, moodboard-library, social-queue, journal-spotlights, spotlight-awards (forwards to /admin/offers?view=badges, which renders the same `SpotlightAwardsSurface`), discount-codes and referrals (forward to /admin/offers?view=…, which renders the same studio surfaces; links to discount-codes/new and discount-codes/[id]/edit resolve), plus the views it mounts: background-videos, website-media, hub-music
- [x] /admin/subscriptions · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/switches · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · incl. #demo-mode and the /api/admin/demo-mode/toggle route
- [x] /admin/team · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/ugat · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: menus (default), onboarding, brain, screens
- [x] /admin/ugat/map · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/user-reports · OFFLINE: NOT NEEDED · SHAPE: today PAGE (view of /admin/work?view=user-reports) → should PAGE
- [x] /admin/vendor-partnerships · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/vendor-recommendations · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/venues/new · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should FULL-SCREEN POPUP
- [x] /admin/verification-docs · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/verify · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: applications (pending_review, in_review, approved, auto, rejected, demoted, all), visibility (hidden, verified, archived, all), ?shop=
- [x] /admin/website-media · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE
- [x] /admin/work · OFFLINE: NOT NEEDED · SHAPE: today PAGE → should PAGE · tabs checked: landing (TabLanding), all, approvals (the other Kind ▾ views mount their own pages)

### Forwards (36) — each must land where the kit says, with its ?tab=

**Phase B (browser, 375):** 36/36 land on a working page. 6 land at the approved 17 Nov home instead of the kit's
snapshot, all correct by `ADMIN_MERGED_PAGES`: `/admin/discount-codes` → `/admin/offers?view=discount-codes` ·
`/admin/referrals` → `/admin/offers?view=referrals` · `/admin/spotlight-awards` → `/admin/offers?view=badges` ·
`/admin/notifications` → `/admin/switches?view=email` · `/admin/npc-readiness` → `/admin/business?tab=checklist&view=privacy` ·
`/admin/queues` → `/admin/work?view=all`. `/admin/connection-logs` reaches `/admin/app-performance?tab=connection-logs`
through its page's own `redirect()` (slow on the copy, but it lands).

- [x] /admin/addons → /admin/pricing · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/brain → /admin/ugat?tab=brain · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/compliance → /admin/business · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/connection-logs → /admin/app-performance?tab=connection-logs · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/demo-vendors → /admin/accounts?tab=demo-vendors · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/discount-codes → /admin/studio?tab=discount-codes · lands ✗ on `/admin/offers?view=discount-codes`, not the kit's address: the middleware forward runs before the page's own redirect (same surface) · see L-9
- [x] /admin/events → /admin/accounts?tab=events · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/funnels → /admin/app-performance?tab=funnels · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/growth → /admin/app-performance?tab=growth · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/insights → /admin/app-performance · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/intelligence → /admin/app-performance?tab=intelligence · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/journal-spotlights → /admin/studio?tab=journal-spotlights · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/menus → /admin/ugat?tab=menus · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/moodboard-library → /admin/studio?tab=moodboard-library · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/notifications → /admin/email-delivery · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/npc-readiness → /admin/data-privacy?tab=checklist · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/offline → /admin/app-performance?tab=offline · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/onboarding → /admin/ugat?tab=onboarding · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/operations-hiring → /admin/app-performance?tab=operations · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/patiktok → /admin/studio?tab=patiktok · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/price-bands → /admin/pricing?tab=price-bands · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/queues → /admin/work · lands on `/admin/work?view=all` (the Work list, not the Work landing): the middleware forward runs first · see L-9
- [x] /admin/real-stories → /admin/studio?tab=real-stories · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/recaps → /admin/studio?tab=recaps · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/referrals → /admin/studio?tab=referrals · lands ✗ on `/admin/offers?view=referrals`, not the kit's address: the middleware forward runs before the page's own redirect (same surface) · see L-9
- [x] /admin/reveal-studio → /admin/studio?tab=reveal-studio · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/seo → /admin/app-performance?tab=seo · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/settings → /admin/business · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/settings/demo-mode → /admin/switches · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/social-queue → /admin/studio?tab=social-queue · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/songs → /admin/studio?tab=songs · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/spotlight-awards → /admin/studio?tab=spotlight-awards · lands ✗ on `/admin/offers?view=badges`, not the kit's address: the middleware forward runs before the page's own redirect (same surface) · see L-9
- [x] /admin/users → /admin/accounts?tab=users · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/vendors → /admin/accounts?tab=vendors · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/venues → /admin/accounts?tab=venues · lands ✓ (code: target + `?tab=` key read by the host page)
- [x] /admin/website → /admin/studio?tab=website · lands ✓ (code: target + `?tab=` key read by the host page)

## Phase B · the owner's additions (Adds 1–10b)

### Add 1 · Popup, full-screen popup, or page
Admin is a desk of places people come back to, so almost every address is rightly a PAGE. Only these differ (from
phase A, confirmed on the copy):
- `/admin/venues/new` · today PAGE → should FULL-SCREEN POPUP over Accounts › Venues (a long fill-in; the person came from the venues list). D-30.
- `/admin/discount-codes/new` · today PAGE → should FULL-SCREEN POPUP over Money › Offers & gifts › Discount codes. A-29.
- The 13 popup findings in phase A (a popup on a popup, a long form in a half sheet) stand; see the `SHAPE` lines under each group.

### Add 2 · Clean, balanced, effective (main screens, 375 → 1280)
| Screen | CLEAN | BALANCED | EFFECTIVE |
|---|---|---|---|
| Focus `/admin` | fails: two searches at 1280 (P-B-7), public footer in the rail (P-B-9) | fails: the Completions card leaves the column (P-B-8) | ok: "2 things need you" and one black main button |
| Work `/admin/work` | fails: chips repeated as a sentence (P-B-10) | ok | fails: grey "0" cards look off (P-B-11) |
| Money `/admin/payments` | fails: two search boxes in Full (P-B-7) | ok (768 is designed: 3-up stats) | ok |
| People `/admin/accounts` | ok | ok | fails: "anon+…" names (P-B-16) |
| Catalogue `/admin/catalogue` | fails: retired chips (P-B-13), repeated names (P-B-10) | fails: a lone card on its own row at 1280; uneven card heights | fails: missing chips (P-B-12), grey cards (P-B-11) |
| Insights `/admin/app-performance` | fails: two titles (P-B-14) | ok | fails: internal names ("Offline daemon", "Interconnections", "Infra") |
| Setup (avatar) | ok | ok | fails: old names under new (P-B-15) |
Design fixes ship only after a drawing; the approved drawing already exists (`area-8-admin-gap.md`).

### Add 3 · Placeholders
Admin is seen only by the Setnayan team, so none of these reaches a real couple or supplier on setnayan.com. Listed for
the builder, all **polish**:
- `/admin/ugat?tab=brain` (`brain-surface.tsx`, `ComingSoonTab`): grey tabs labelled **"Coming soon"**. They are not pressable (`aria-disabled`), so they pass the rule, but they are clutter (Add 2 CLEAN).
- `/admin/compliance/data-sheet`: empty fields print **"[TO CONFIRM]"** on purpose (a filing sheet that must show its gaps). Honest; keep.
- `/admin/app-performance` intelligence rows print "date TBD" when an event has no date. Honest wording; fine.
- `/admin/categories`: "coming soon" is a real state of a religion (not yet live for couples). Fine.
- Code grep for lorem / John Doe / Juan dela Cruz / "Your name here" / "under construction" over `app/admin`: **none**.
- Seen in the walk: none beyond the above (seeded `stg-…` data and `@final-check.test` people are not findings).

### Add 4 · Places to buy or upgrade
**Admin sells nothing to anyone**: there is no buy, upgrade, plan gate or checkout in area 8. What area 8 owns is where
every price a buyer sees is **set**, so the owner's list of where Setnayan sells points here for its source:
| Admin place (route) | What it sets | Read by |
|---|---|---|
| Money › Prices (`/admin/pricing`, views Prices · AI prices · Papic shots · Bands · Free windows · Plan contents) | the catalogue rows of `platform_retail_catalog_v2` / `vendor_billing_catalog` | Pricing, For Suppliers, every 🔒 gate, checkout |
| Money › Offers & gifts (`/admin/offers`, views Launch offer · Discount codes · Referrals · Gifts & comps · Founder seats · Badges & seals) | promotions and give-aways | checkout totals, supplier plan pages |
| Money › To approve › Fees owed / Payment options / Subscriptions (`/admin/payments?view=…`) | the booking fee switches, the payment rails shown to payers (BDO QR, Maya), plan confirmations | `/pay/[reference]`, the supplier's Subscription page |
| Setup › Business keys & privacy › Integrations (`/admin/business?view=integrations`) | Maya on/off and sandbox, the Setnayan AI paywall switch | the payer's choice of rail; the AI unlock gate |
EVIDENT / CLEAN / HONEST apply to the buyer pages in areas 1, 2, 5 and 6. For the admin side, the HONEST risks are
phase A's money-signin themes 2 and 3 (a failed read shown as ₱0 or "Free"; pesos formatted by hand or typed into code)
and theme 1 (price changes not held to the Escalated level, B-2). No test payment was made; taps to "payment logged"
are not an admin job.

### Add 5 · Easy to handle (main admin jobs, phone, one hand)
| Job | Rating | The one step that makes it hard |
|---|---|---|
| See what needs me (Focus) | EASY | — |
| Confirm a payment (Money › To confirm) | OK | Focus mode has no tab bar on a phone; Money is behind ☰ (P-B-20) |
| Find a person (People › Look up) | OK | rows named "anon+…" (P-B-16) |
| Answer a help message (Work › Messages) | OK | 2 taps from Work, but a typed reply is lost on a dropped signal (Add 10) |
| Change a price (Money › Prices) | HARD | "Change the numbers" opens a long editor; the masthead says "Pricing & Catalog" while the menu says "Prices" (P-B-15) |
| Reorder the homepage (Catalogue › Studio) | HARD | 24 px arrows, and every press saves at once with no undo (P-B-21, P-B-22) |
| Add an admin (Setup › Team) | HARD | 96 small controls on one phone screen; the areas × levels grid is wider than the phone's thumb reach |

### Add 6 · Proof every button was pressed
See the per-page table above: **buttons N · pressed N · failed N · left N (why)** for every page at 1280, controls
counted at 375 and 768. "Failed 0" means no press was CONFIRMED broken. Every walker-reported failure was re-tried by hand:
Tab settings, the "More for …" menus and Close bookings all open and close on Escape and on the backdrop; the Ugat map's
"Entities", "Map" and Pricing's "On sale" were already the selected tab (a no-op press is correct); Studio's arrows
reorder. The "Fields" button on `/admin/ugat/map` did nothing on one hand-press after "Joints" — **not proven**, re-check.

### Add 7 · Three sizes, light and dark, one design across roles
Six home shots are in `build-sessions/final-check/shots/area-8/` (Focus home). 768 is designed, not a stretched phone
(two-column cards on Catalogue, 3-up stats on Money), except the Focus home, which is a phone column with a card that
runs to the edge (P-B-8). Dark: `DARK: no` on every page (L-3, P-B-19); the admin uses the house light colours, card
surfaces and accent, so it matches the other roles in light. In dark it cannot be compared because it never goes dark.

### Add 9 · Admin against the approved drawing
Written to `build-sessions/final-check/area-8-admin-gap.md`. Short version: of 162 approved items, 121 built · 15 partly
· 14 missing · 7 live elsewhere · 5 not verified. The five tabs, Focus | Full, the pinned `Page · View ▾` row, the avatar
Setup rows and the 48 forwards are built. The confusion is mostly names: each place has two or three (P-B-15). Nothing
shipped is lost: all 71 pages have a home in the approved shape. The walk confirmed the tabs, Focus | Full, the bar in
Full mode, the merged views and every forward.

### Add 10 · Offline — beyond the five (admin role)
Admin is not one of the owner's five offline places. Tried on the copy (375 px, browser set offline while on
`/admin/work`): the page already drawn stays readable and a black **"You're offline"** bar appears, but the bar sits
**over** the top bar and hides the mark and the Focus/Full buttons (finding P-B-OFF-1 below). Back, a tab or any new admin
address offline gives the **browser's own "no internet" error page**, not a Setnayan saved copy or offline page
(P-B-OFF-2). Back online, `/admin` loads again normally and nothing was lost (nothing had been typed).

| Part (route · what it does) | When the signal drops | Level | Why |
|---|---|---|---|
| Focus / Work queue (`/admin`, `/admin/work`) · what needs an admin today | on the road, weak data | READ-ONLY | the one admin should still see what is waiting and how old it is |
| BDO screenshot matcher (`/admin` "Add received screenshots") · reads BDO app pictures on the phone | on the road | READ-ONLY (read the pictures now, match when back) | it already reads on the phone; confirming a payment must stay online (money) |
| Messages (`/admin/work?view=messages`, help replies) | on the road | SAVE AND SYNC | a typed reply to a couple should not be lost when the signal drops |
| Money › To approve (confirm payments, payouts, refunds) | any | READ-ONLY | money moves only online; seeing the list offline is enough |
| Everything else (Catalogue, Insights, Setup) | — | NOT NEEDED | desk work |
Add 10b (supplier QR) is areas 5–7; area 8 has no QR maker.

## Findings

### Phase B findings (SOURCE: BROWSER, staging copy)

#### P-B-1 · React hydration error on 16 admin pages
PAGE      /admin · accounts · admin-log · background-videos · booking-fees · budget-planner · catalogue · categories/requests · completions · corrections · papic-storage · payments/supplier-refunds · reviews · subscriptions · website-media · work (+ ugat/map, text variant)
STEPS     Open the page; read the console.
EXPECTED  No console error.
ACTUAL    "Minified React error #418" (server HTML ≠ first client render). The page re-renders on the client, which costs time on a slow phone. A date or time printed differently on server and phone is the usual cause.
RULE      Kit § 5 item 1 (no console error)
SEVERITY  wrong

#### P-B-2 · The error reporter itself fails: `/api/telemetry/client-fault` answers 500
PAGE      /admin/account-deletions · booking-fees · studio · ugat/map
STEPS     Open the page with the network panel; a client fault is posted.
EXPECTED  The fault is stored, so Insights › Problems can count it.
ACTUAL    500 from `/api/telemetry/client-fault`. Insights then reads "Problems, last 24 h: 0 app errors" while faults are being lost: a failed write that looks like a calm zero.
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong (may be the copy's setup; check on production before fixing)

#### P-B-3 · Fees owed: "Nothing waiting" over a list of 9 suppliers with fee owed ₱0
PAGE      /admin/payments?view=fees (from /admin/booking-fees)
STEPS     Open Money › To approve › Fees owed.
EXPECTED  One clear story: who owes what, and why a supplier is listed for review.
ACTUAL    Header "Nothing waiting", "Nobody owes a booking fee right now. The booking fee is on…", then "SUPPLIERS TO REVIEW" lists 9 suppliers, each "N events · couples recorded ₱… · fee owed ₱0". It is not clear whether ₱0 is a true zero (bookings recorded outside chat owe nothing) or a fee that should exist. Not judged here: never guess a money number. The control "List a supplier at [2] events" saves on every −/+ press with no confirm (that is how this checker changed it by accident; see the disclosure above).
RULE      Add 4 HONEST · Add 5 Clear
SEVERITY  wrong (needs the owner's or the fee builder's read)

#### P-B-4 · Payment methods: the pinned title runs off the screen at 375
PAGE      /admin/settings/payment-methods → /admin/business?view=accounts
ACTUAL    "Business, keys & privacy · Receiving accounts (GCash · BDO QR)" is one line 398 px wide in a 375 px screen; the page scrolls sideways.
SHOTS     375 light (checker scratch)
RULE      HOUSE_DESIGN_STANDARD: no sideways scroll at 375
SEVERITY  look

#### P-B-5 · The overdue chip is cut off: "1 ove…" (1280) and "1…" (375)
PAGE      every admin page (top bar)
ACTUAL    The red chip truncates its own words at 1280 and shows only "1…" on a phone. At 768 it reads "1 overdue".
SEVERITY  look

#### P-B-6 · "SETNAYAN TEAM" chip: tiny two-line text in a grey pill
PAGE      every admin page (top bar, 768 and 1280)
ACTUAL    Letter-spaced micro text wraps to two lines inside a pill at 1280; it reads like a disabled control. It is a label, not a button.
SEVERITY  look

#### P-B-7 · Two search boxes on one screen
PAGE      /admin at 1280 (top bar "Search or ask…" + Focus "Ask or go anywhere"); Money in Full mode at 375 and 768 ("Reference code…" box + thumb row "Search payments, references, receipts")
EXPECTED  One search per screen; search is an icon until tapped (Add 5 "Same everywhere").
SEVERITY  look

#### P-B-8 · Focus "Completions" card: a coloured side stripe, and it leaves the content column
PAGE      /admin (Focus)
ACTUAL    A red left stripe (the house never uses a coloured side stripe). At 1280 the card starts 16 px left of everything above it; at 768 it runs to the right screen edge with no gutter.
SHOTS     `shots/area-8/home-1280-light.png`, `home-768-light.png`
RULE      Add 2 BALANCED · HOUSE_DESIGN_STANDARD (no side stripes)
SEVERITY  look

#### P-B-9 · The admin rail carries the public site's footer
PAGE      every admin page at 1280 (rail)
ACTUAL    COMPANY / LEGAL links (About, Pricing, Help, Download, Terms, Privacy, Acceptable use, Cookies, Refunds) and the tagline fill the lower rail. An admin never needs them there.
RULE      Add 2 CLEAN
SEVERITY  look

#### P-B-10 · Tab dashboards repeat each card's buttons as a sentence first
PAGE      /admin/work, /admin/catalogue, /admin/app-performance (Insights)
ACTUAL    Each card prints its chip names as a dotted line ("Approvals · Completions · Pax changes …"), then the same names again as chips, then "Open Queue · Kind ▾ Requests to decide ›".
RULE      Add 2 CLEAN (no label that says what the screen already shows)
SEVERITY  look

#### P-B-11 · A card with nothing waiting is drawn grey, so its working chips look switched off
PAGE      /admin/catalogue ("Services 0", "Stories & social 0"), /admin/app-performance ("App health 0"), /admin/work ("Reports & safety 0")
ACTUAL    The whole card, chips included, is faded. Every chip still opens its page.
RULE      Add 2 EFFECTIVE (a working control must look pressable)
SEVERITY  look

#### P-B-12 · Catalogue › Templates & media names Hub music and Songs but has no chip for them
PAGE      /admin/catalogue (375, 768, 1280)
ACTUAL    The card's line lists "… Website media · Hub music · Songs"; the chips stop at "Website media".
SEVERITY  wrong

#### P-B-13 · Retired things are still offered
PAGE      /admin/catalogue
ACTUAL    Chips "Real Stories (retired)" and "AI brain (old)" sit with the live ones.
RULE      Add 2 CLEAN
SEVERITY  look

#### P-B-14 · Page titles: missing on four views, doubled on two
PAGE      no h1: /admin/payments?view=fees, ?view=payouts, /admin/help/guides, /admin/ugat/map · two h1: /admin/app-performance ("Insights" + "Numbers"), /admin/directory ("People" + "Users")
RULE      CLAUDE.md §3 (every page has one PageMasthead)
SEVERITY  wrong

#### P-B-15 · The old name shows under the new one
PAGE      /admin/pricing (dropdown "Prices · Prices", masthead "Pricing & Catalog"), /admin/directory ("People"/"Users"), /admin/app-performance ("Insights"/"Numbers")
ACTUAL    The pinned row uses the approved name and the page title just below uses the old one. Confirms the gap report's main finding (`area-8-admin-gap.md` § Summary 3).
SEVERITY  wrong

#### P-B-16 · People list shows raw internal addresses as names
PAGE      /admin/accounts, /admin/directory
ACTUAL    Rows titled "anon+6ea63a2c-…@anon.setnayan.local" (anonymised couples). The menu label reads "More for anon+…".
EXPECTED  A plain label such as "Guest-only couple" plus the short ID.
RULE      Add 2 EFFECTIVE (labels are plain words, never internal codes)
SEVERITY  look

#### P-B-17 · The offline bar covers the top bar
PAGE      any admin page with the signal off (375)
ACTUAL    "You're offline" is drawn over the top bar, hiding the mark and the Focus/Full buttons.
SHOTS     checker scratch `off-a.png`
SEVERITY  look

#### P-B-18 · Offline, every new admin address is the browser's own error page
PAGE      any admin address opened or re-opened with no signal
ACTUAL    Chrome's "no internet" page, not a Setnayan saved copy or offline page. (Admin is not one of the five offline places; see Add 10.)
SEVERITY  look

#### P-B-19 · Dark mode: L-3 confirmed in pixels
PAGE      all 71
ACTUAL    With the dark choice set and the phone in dark, every admin page paints Light (body `rgb(245,245,245)`), 92 of 92 dark visits. Home shots committed for Add 7.
SEVERITY  look (one finding; L-3)

#### P-B-20 · Focus on a phone has no tab bar; the five tabs hide behind ☰
PAGE      every admin page, Focus mode, 375 and 768
ACTUAL    Focus (the default) drops the bottom bar (`layout.tsx`: `mode === 'full' ? <AdminBottomNav …/>`). A phone admin reaches Money, People, Catalogue and Insights only through ☰ or search. Full mode shows the bar and works (Money at 375/768).
RULE      Add 5 One hand. May be intended by the 14 Nov Focus | Full ruling: owner's call.
SEVERITY  look

#### P-B-21 · Small tap targets at 375
PAGE      /admin/team (96 controls under 40 px tall), /admin/studio (↑ ↓ arrows 24 px), the ⓘ buttons everywhere
RULE      Add 5 One hand (44 px)
SEVERITY  look

#### P-B-22 · A one-press job with no confirm, labelled like a fix
PAGE      /admin/app-performance?tab=papic-storage, "Fill in missing Memory lane copies"
ACTUAL    One press runs a backfill of up to 40 photos. It is additive and safe, but nothing says it will run straight away. Same pattern: the Studio section switches and ↑/↓ arrows save on press, and so does the fee-review −/+.
RULE      Add 5 Forgiving (undo, not surprise)
SEVERITY  wrong (it works; the risk is surprise)


> IDs: `L-n` = area-wide (checker 8 itself) · `A`–`I` = one id per group of pages (A money · B pricing & catalogue ·
> C home, work & shell · D accounts · E verify & disputes · F watch desks & media · G studio · H app performance & Ugat ·
> I settings & system). Every finding cites code by file + a greppable string, never a line number.

### Area-wide

#### L-1 · Government-ID shelf is read with the service role behind the layout gate only
PAGE      /admin/verification-docs
BUTTON    —
STEPS     1. Open `apps/web/app/admin/verification-docs/page.tsx`. 2. Follow `buildVerificationDocsReport` and `verificationDocSupplierNames`.
EXPECTED  The page calls `requireAdmin()` itself before any service-role read (the rule written in `lib/admin/require-admin.ts`: "a Next.js layout is NOT a safe auth boundary … Every admin PAGE that touches the service-role client must call requireAdmin() itself").
ACTUAL    No `requireAdmin` in the page. `lib/verification-docs-server.ts` (`buildVerificationDocsReport`) and `lib/verification-doc-suppliers.server.ts` both call `createAdminClient()`; only `app/admin/layout.tsx` gates. The shelf lists strangers' government-ID files and supplier names. (The view/delete actions are gated; the listing is not.)
SHOTS     phase B: n/a (access, not layout) — confirm a non-admin sign-in gets 404
RULE      Task check 2 (admin gates, server-side) · `lib/admin/require-admin.ts` contract
SEVERITY  money-signin
SOURCE    CODE
PHASE B   25 Nov 07:20 UTC, signed in as the shared non-admin `messy-one` (session confirmed: `/dashboard` opens their event). `/admin/verification-docs` → **404 "This page doesn't exist on Setnayan."** The layout gate holds today; nothing leaks in the browser. The code finding stands (one layer of defence, not two) → kept, severity lowered to **wrong** for the fix list.

#### L-2 · Three more pages lean on the layout gate alone
PAGE      /admin/demand · /admin/venues/new · /admin/more
BUTTON    —
STEPS     1. Open each `page.tsx`. 2. Look for `requireAdmin`.
EXPECTED  Every /admin page checks for an admin server-side itself.
ACTUAL    None of the three calls `requireAdmin()`. Exposure is small: `/admin/demand` reads through the RLS client (`demand_radar_admin` re-gates in SQL) but its `after(() => maybeRefreshDemandRadar())` runs a service-role rebuild on any request that reaches the page; `/admin/venues/new` draws a form whose `createVenue` action is gated; `/admin/more` is a static menu. Listed for consistency with the rule, not as a leak.
SHOTS     phase B: n/a
RULE      Task check 2 (admin gates)
SEVERITY  wrong
SOURCE    CODE
PHASE B   Same non-admin `messy-one` sign-in: `/admin/demand` → forwarded to `/admin/app-performance?tab=demand` → **404**; `/admin/venues/new` → **404**; `/admin/more` → forwarded to `/admin/work?view=all` → **404**. Also `/admin` and `/admin/catalogue` → **404**. Signed out, `/admin` → `/login?next=%2Fadmin`. **Confirmed: a non-admin cannot open any of the three.** Note: `/admin/demand` itself is never reached by its address (the middleware forwards it first), so the page's own `after(maybeRefreshDemandRadar)` only runs for an admin.

#### L-3 · Admin never goes dark: the console is not on the dark ready-list
PAGE      every /admin page
BUTTON    Preferences › Dark (the appearance switch)
STEPS     1. Pick Dark. 2. Open any /admin page.
EXPECTED  Every signed-in screen works in dark (kit § 5.7; DARK_MODE_STANDARD § 1 gives admin its own monochrome dark family).
ACTUAL    `lib/appearance.ts` `DARK_READY` has no `/admin` entry, so the whole console paints Light. `app/admin/_components/admin-look.css` says so itself: "DARK IS WRITTEN, NOT YET SWITCHED ON … its screens have not been swept for hard-coded colours". The per-page K2 findings below list the light-only colours that block switching it on.
SHOTS     phase B: 1280 px + 375 px with Dark chosen
RULE      HOUSE_DESIGN_STANDARD Part K2 · DARK_MODE_STANDARD § 1 (Admin = monochrome) · kit § 5.7
SEVERITY  look
SOURCE    CODE

#### L-4 · The admin dark set gives static cards a shadow
PAGE      every /admin page (once dark is switched on)
BUTTON    —
STEPS     1. Open `app/admin/_components/admin-look.css`, block `html.dark:has([data-admin-look])`.
EXPECTED  In dark the page is flat, cards are one step lighter, and static cards carry no shadow.
ACTUAL    The dark block sets `--sn-frame-shadow: inset 0 1px 0 rgb(255 255 255 / 0.06), 0 14px 30px -14px …` and `--sn-frame-shadow-tile`, so every `.sn-frame` / `.sn-tile` / `.sn-row` would wear a lift shadow in dark.
SHOTS     phase B: only if dark is switched on for admin by then
RULE      HOUSE_DESIGN_STANDARD Part K2.1 ("no shadows") · Part I.4 (shadows only on floating overlays)
SEVERITY  look
SOURCE    CODE

#### L-5 · Nine pages, behind 39 of the area's 71 addresses, load with the overview's skeleton
PAGE      /admin/work (also reached by 18 queue addresses that 307 to it, e.g. /admin/approvals, /admin/disputes, /admin/fraud, /admin/reviews) · /admin/offers (/admin/founder-seats, /admin/gifts, /admin/launch-offer) · /admin/business (/admin/data-privacy, /admin/compliance/data-sheet, /admin/integrations, /admin/secrets, /admin/settings/payment-methods) · /admin/switches (/admin/colours, /admin/email-delivery, /admin/live-studio-channels) · /admin/vendor-partnerships (/admin/vendor-recommendations) · /admin/admin-log · /admin/ask · /admin/team · /admin/verification-docs
BUTTON    —
STEPS     1. Open any listed page on a slow connection.
EXPECTED  The skeleton draws only what that page draws (HOUSE_DESIGN_STANDARD F1: "Every loading.tsx mirrors its loaded layout").
ACTUAL    None of these nine has a `loading.tsx` of its own, so each shows `app/admin/loading.tsx` — the OVERVIEW's ghost ("Action queues panel — terracotta-tinted card + 4 queue tiles", "Stats — 8 tiles", "Nav tiles — 6 tiles"). That ghost also uses a hand-made terracotta frame (`border-terracotta/20 bg-terracotta/[0.03]`) on the monochrome console. Worse, the overview itself no longer draws those parts: Focus is a date line, "N things need you" and one list; Full is the Work landing (C-13). So the ghost matches no admin page at all.
SHOTS     phase B: 375 px light on a throttled load of /admin/work and /admin/offers (the other old addresses land on hosts with their own skeletons, judged in A-25, C-14, G-21, H-21; and the own `loading.tsx` files of /admin/account-deletions, /admin/completions, /admin/concierge-abuse, /admin/disputes, /admin/force-majeure, /admin/reviews and /admin/more never show, because the middleware moves those addresses first)
RULE      HOUSE_DESIGN_STANDARD F1 · CLAUDE.md §3 Loading ("the skeleton draws only what the page draws") · kit § 5.9
SEVERITY  wrong
SOURCE    CODE

#### L-6 · Every form button spins while it works
PAGE      every /admin page with a form (shared `SubmitButton`; other areas share it too)
BUTTON    any submit, e.g. "Save", "Approve"
STEPS     1. Press a submit button. 2. Watch it while the action runs.
EXPECTED  No spinners; a slow action names its step (HOUSE_DESIGN_STANDARD D1).
ACTUAL    `app/_components/submit-button.tsx` `SubmitButton` draws a spinning icon (`className="h-4 w-4 animate-spin"` inside `sn-m-busy`) while pending.
SHOTS     phase B: 375 px light, mid-press
RULE      CLAUDE.md §3 Loading ("No animate-pulse, no spinners") · HOUSE_DESIGN_STANDARD D1
SEVERITY  look
SOURCE    CODE

#### L-7 · The house confirm is a native dialog with its own scrim
PAGE      every /admin page that confirms (`ConfirmForm`, `ConfirmButton`, `useConfirm()`; shared with other areas)
BUTTON    any confirm, e.g. "Delete account", "Delete ‹category›"
STEPS     1. Press a control that asks "Are you sure?".
EXPECTED  The shared `Sheet` with the ONE shared backdrop token (dim + blur), opening at half on a phone (HOUSE_DESIGN_STANDARD K3.1: "No page builds its own scrim").
ACTUAL    `app/_components/confirm-dialog.tsx` `ConfirmDialog` is a portalled `<dialog>` opened with `showModal()`, with its own scrim `backdrop:bg-black/50 backdrop:backdrop-blur-sm` and a hand-written `shadow-[0_24px_60px_-20px_rgba(0,0,0,.5)]`. It dims and blurs, but not with the shared backdrop, and it is the layer that ends up on top of a Sheet (D-28, B-20). Three checkers found it independently.
SHOTS     phase B: 375 px light, a confirm opened from a list and from inside a sheet
RULE      HOUSE_DESIGN_STANDARD Part K3 · D2 (Sheet is the one floating surface)
SEVERITY  look
SOURCE    CODE

#### L-8 · "Catalogue · Escalated" is never enforced
PAGE      /admin/categories (and every catalogue write)
BUTTON    "Delete ‹category›" · "Combine" · hide for everyone · retire
STEPS     1. Sign in as an admin whose Team grid gives Catalogue = Basic only. 2. Delete, combine or hide a category or service.
EXPECTED  `lib/admin/areas.ts` `ADMIN_AREA_LIST` row `catalogue`: Escalated = "hide for everyone · combine · retire", so these presses are refused without it.
ACTUAL    No `requireAdminCan('catalogue', …)` exists anywhere in `apps/web`; the categories actions check only "is admin" (`requireAdmin`/`requireAdminAction`). Same family as B-2 (prices), D-1 and D-3 (deletions), D-4 (plans): the area grid on /admin/team promises limits the server does not hold. The money desks have the same gap: no action file under `app/admin/payouts`, `subscriptions`, `founder-seats`, `launch-offer`, `booking-fees` or `payment-options` calls `requireAdminCan`, so Mark paid, Hold, confirming a plan, granting a founder seat and the fee switches need only "is admin".
SHOTS     phase B: n/a (server-side)
RULE      Admin areas × levels (DECISION_LOG 2026-11-13) · task check 2
SEVERITY  money-signin
SOURCE    CODE

#### L-9 · Four forwards land somewhere other than the kit says; the kit reads the dead redirect
PAGE      /admin/discount-codes · /admin/referrals · /admin/spotlight-awards · /admin/queues
BUTTON    — (an old address from an email, a bookmark or a notification)
STEPS     1. Open each old address.
EXPECTED  Kit § 4: `/admin/studio?tab=discount-codes`, `/admin/studio?tab=referrals`, `/admin/studio?tab=spotlight-awards`, `/admin/work`.
ACTUAL    `middleware.ts` runs `adminMergedForward` (`lib/admin/admin-pages.ts`, the `olds` lists) before any page, so they go 307 to `/admin/offers?view=discount-codes`, `/admin/offers?view=referrals`, `/admin/offers?view=badges` and `/admin/work?view=all`. The same surfaces render there (G, A), so nobody is stranded, but each page's own `redirect(...)` body is dead code. `scripts/staging/areas.ts` reads those dead bodies, so the kit's list is wrong for these four. The middleware also moves 43 more Area 8 addresses that the kit lists as pages (for example `/admin/payouts` → `/admin/payments?view=payouts`, `/admin/gifts` → `/admin/offers?view=gifts`, `/admin/secrets` → `/admin/business?view=secrets`). Phase B should expect a 307 to the merged view on each of those.
SHOTS     phase B: the address bar after opening each old address
RULE      Kit § 4 ("a forward must land where it says") · design-and-wiring A4 (every way in moves with it)
SEVERITY  wrong
SOURCE    CODE


### Group A · Money desks

#### A-1 · The duplicate-reference check is skipped when the payment's own row can't be read
PAGE      /admin/payments   (tab: ?open= payment)
BUTTON    "Approve · matched" (also "Confirm", "One-click approve · clean match", "Approve N selected clean matches")
STEPS     1. Approve a pending payment. 2. The read of that payment's own row is refused.
EXPECTED  The approval is refused with "couldn't check". The file's own rule: "a money guard that cannot read must not pass".
ACTUAL    actions.ts `approvePaymentCore`: `const { data: me } = await admin.from('payments').select('order_id, reference_number')` ignores `error`. `mine` is then null, `if (mine && …)` skips the whole duplicate check, and the row is flipped to `matched`.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states · brief checklist 3
SEVERITY  money-signin
SOURCE    CODE

#### A-2 · Refund refusals and the two-admin request show up as a crash, with the message hidden
PAGE      /admin/payments   (tab: ?open= payment, paid order)
BUTTON    "Record refund · notify couple" (also Maya "Void"/"Refund", "Reject", "Request resubmit")
STEPS     1. Open a paid payment above the § 9.1 two-admin limit. 2. Record a refund and confirm.
EXPECTED  An inline notice: "needs a second admin, request open in Approvals". This is how `approvePayment` reports its refusals (redirect + `notice`).
ACTUAL    `openLargeRefundApproval` inserts the request, then `throw new Error(...)` ("Thrown, not returned"). The admin lands on app/admin/error.tsx "This surface crashed". A production build of Next.js leaves out a thrown server-action message, so the admin is never told the request was opened. The same throw path is used by "already marked refunded", "Payment already resolved", `throw new Error(out.line)` (Maya refused) and `confirmOrderTotal`.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B6 (a failure renders as a failure) · brief checklist 2/3
SEVERITY  money-signin
SOURCE    CODE

#### A-3 · The shortfall notice says "₱0 received" when the payments read fails
PAGE      /admin/payments
BUTTON    "Approve · matched" ("Also mark order as paid" ticked)
STEPS     1. Approve with "Also mark order as paid" ticked. 2. The read of the order's payments is refused.
EXPECTED  "Couldn't check what was received", with no peso figure.
ACTUAL    `approvePaymentCore`: `const { data: orderPayments }` ignores `error`, so `matchedTotal` = 0. The warn banner then reads "₱0 received vs ₱X owed — ₱X short", a false statement about the buyer.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  money-signin
SOURCE    CODE

#### A-4 · Revenue is summed from the requested total, not what was charged
PAGE      /admin/money   (tab: everything)
BUTTON    —
STEPS     1. Open Money › Everything. 2. Compare "Revenue, all time" / "Software sales" with the ledger amounts below it.
EXPECTED  Revenue uses the shared owed/paid rule (`orderGrossOwed`, as the ledger's `chargedPhp` does).
ACTUAL    revenue-summary.tsx selects only `requested_total_php`, and lib/admin/revenue-statement.ts `splitPaidRevenue` sums it. That is the pre-voucher, pre-quote figure, so voucher and re-quoted orders are wrong. The four reads are also not paged, so past the PostgREST row cap the "all time" total is silently partial.
SHOTS     phase B: 375 px light + desktop
RULE      design-and-wiring C8 (one reader for a shared fact)
SEVERITY  money-signin
SOURCE    CODE

#### A-5 · Prices and peso amounts are typed into the Payment methods copy
PAGE      /admin/settings/payment-methods
BUTTON    —
STEPS     1. Open Receiving accounts. 2. Read "About QR codes" and the limit fields.
EXPECTED  No peso figure typed in code. Prices come from `platform_retail_catalog_v2`.
ACTUAL    The note types "GCash asks for &#8369;100" and "Our own smallest item sells for &#8369;70" (a catalog price). Peso placeholders "1000", "100000" and "500000" sit in the GCash-below, allowance and monthly-limit fields.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money (never write a price) · brand.md claims #1
SEVERITY  money-signin
SOURCE    CODE

#### A-6 · Founder seat grant matches emails with a wildcard; failed reads read as "no account" / "already empty"
PAGE      /admin/founder-seats   (tab: founder-seats of /admin/offers)
BUTTON    "Grant seat" / "Revoke"
STEPS     1. Grant a seat to an email containing "_" (e.g. ann_lee@…). 2. Or grant/revoke while the read is refused.
EXPECTED  An exact email match. A refused read says it couldn't read.
ACTUAL    actions.ts `grantFounderSeat` uses `.ilike('email', email)`. `_` and `%` are wildcards there, so a near-match account can be granted every paid feature, or two matches read as "No Setnayan account found". The `target` read and revoke's `seat` read both ignore `error`, so a refused read says "No Setnayan account found… sign up first" or "Seat N is already empty."
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states · brief checklist 3
SEVERITY  money-signin
SOURCE    CODE

#### A-7 · The receipt month filter uses the server's UTC month, labelled as a Manila month
PAGE      /admin/receipts   (tab: receipts of /admin/money)
BUTTON    "Month ▾"
STEPS     1. Pick a month. 2. Compare against receipts issued between 00:00 and 08:00 Manila on the 1st.
EXPECTED  The Manila calendar month, which BIR reconciliation needs.
ACTUAL    receipts/page.tsx builds the range with `new Date(Number(year), Number(month) - 1, 1).toISOString()` and buckets with `getMonth()`. Both use the server clock (UTC on Vercel), while `monthLabel` names the Manila month, so early-morning receipts on the 1st land in the previous month.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states (the measurement must reach the render)
SEVERITY  money-signin
SOURCE    CODE

#### A-8 · Totals over a 200-row cap are shown as whole totals
PAGE      /admin/money · /admin/receipts
BUTTON    —
STEPS     1. With more than 200 orders/receipts, open Money › Everything on a phone. 2. Read Received / Waiting / Purchases (and Receipts › Gross).
EXPECTED  Totals cover every row, or the tile says "newest 200".
ACTUAL    transactions-ledger.tsx `ROW_LIMIT = 200`: the TemplateNums Received/Waiting/Purchases sum only those rows and do not mention the cap. The phone list (`aria-label="Every transaction"`) has no "Showing the first 200" line; only the desktop ConsoleTable has one. receipts/page.tsx's Receipts/Pre-VAT/VAT/Gross tiles do the same.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  money-signin
SOURCE    CODE

#### A-9 · A failed catalog read shows "No active services in the catalog right now"
PAGE      /admin/discount-codes/new
BUTTON    —
STEPS     1. Open Create discount code while a catalog read is refused.
EXPECTED  "Couldn't read the catalog", and Create is held back.
ACTUAL    `fetchV2CustomerCatalog` / `fetchV2BundleCatalog` / `fetchV2VendorCatalog` (lib/v2-catalog.ts) return `[]` on error, so VoucherForm says "No active services in the catalog right now." One refused read silently drops a whole category. `fetchV2VendorCatalogRead` (it keeps the read outcome) exists but is not used.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  money-signin
SOURCE    CODE

#### A-10 · A failed receipt write is silent on approve
PAGE      /admin/payments
BUTTON    "Approve · matched" / "Confirm" / "Record and confirm"
STEPS     1. Approve a payment that promotes its order to paid. 2. The receipts insert is refused.
EXPECTED  The desk says the receipt didn't issue.
ACTUAL    actions.ts `issueReceiptForOrder`: the result of `await admin.from('receipts').insert({...})` is never read, and the `existing`/`order` reads ignore `error`. The desk shows success, and Receipts and the ledger simply show no receipt.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B6
SEVERITY  money-signin
SOURCE    CODE

#### A-11 · The desk says "Nothing to reconcile." and hides unmatched BDO money
PAGE      /admin/payments   (tab: To confirm)
BUTTON    "Add received screenshots"
STEPS     1. No pending payments, but rows "in your BDO, no order" exist (or the pile read failed).
EXPECTED  The From-your-BDO block, its failure line and the drop tile still show.
ACTUAL    desk.tsx `PaymentsList` returns `<TemplateEmpty>… 'Nothing to reconcile.'` before it renders `ReceivedPile`. The pile, its "Couldn't load" state and the "Add received screenshots" tile all disappear.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  money-signin
SOURCE    CODE

#### A-12 · Payments: pesos formatted by hand, ceilings typed in code
PAGE      /admin/payments
BUTTON    —
STEPS     1. Open a payment with a screenshot read, or match a BDO row at a different amount.
EXPECTED  Amounts go through lib/php.ts `formatPhp`.
ACTUAL    desk.tsx `ReceiptReadCard`: `₱${Number(a).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`. received.ts `matchReceived`: `₱${Math.abs(diff).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`, which prints "₱837.5 short". actions.ts: `₱${REFUND_TWO_ADMIN_THRESHOLD_PHP.toLocaleString()}`, `MAX_REFUND_AMOUNT_PHP = 100_000_000`.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money (format only via lib/php.ts)
SEVERITY  money-signin
SOURCE    CODE

#### A-13 · Subscriptions: hand-rolled peso, and a missing amount prints ₱0
PAGE      /admin/subscriptions   (tab: subscriptions of /admin/payments)
BUTTON    —
STEPS     1. Open the pending queue.
EXPECTED  `formatPhp`. A missing amount shows "—".
ACTUAL    `₱{NUMBER.format(pendingTotal)}` and `{tier} · ₱{NUMBER.format(Number(p.amount_php ?? 0))}` use `Intl.NumberFormat('en-PH')`. `amount_php` is a nullable column, so a null prints ₱0.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money · §5.4
SEVERITY  money-signin
SOURCE    CODE

#### A-14 · Receipts: a second peso spelling
PAGE      /admin/receipts
BUTTON    —
STEPS     1. Open Receipts.
EXPECTED  `formatPhp` (₱1,000 / ₱837.50).
ACTUAL    Every cell and tile uses lib/receipts.ts `formatPhpFromString`, a hand-rolled `₱${n.toLocaleString('en-PH',{minimumFractionDigits:2})}` that prints ₱1,000.00, not the house spelling.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money
SEVERITY  money-signin
SOURCE    CODE

#### A-15 · Legacy "Min fee" column: hand-rolled peso and a typed ₱50 default
PAGE      /admin/settings/payment-methods
BUTTON    —
STEPS     1. Scroll to "Historical · Legacy Setnayan Pay methods" (desktop lg).
EXPECTED  `formatPhp`. A null shows "—".
ACTUAL    `₱${Math.round((m.min_fee_centavos ?? 5000) / 100).toLocaleString('en-PH')}`: hand formatted, rounds off the centavos, and shows a NULL fee as a hard-typed ₱50.
SHOTS     phase B: desktop
RULE      CLAUDE.md §1 Money · §5.4
SEVERITY  money-signin
SOURCE    CODE

#### A-16 · Discount code form: hand-rolled peso and typed ₱ examples
PAGE      /admin/discount-codes/new
BUTTON    —
STEPS     1. Open Create discount code and look at the service prices; open the ⓘ on "Maximum discount (₱)".
EXPECTED  `formatPhp`, and no typed peso figures.
ACTUAL    VoucherForm `formatPeso` + `₱{formatPeso(s.price_centavos)}` on every price and preview. The ⓘ types "₱500 cap on a ₱2,000 service … (not ₱1,000)".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money
SEVERITY  money-signin
SOURCE    CODE

#### A-17 · Referrals: hand-rolled peso
PAGE      /admin/offers   (tab: referrals)
BUTTON    —
STEPS     1. Open Offers & gifts › Referrals.
EXPECTED  `formatPhp`.
ACTUAL    referrals-surface.tsx `₱${rewardPhp.toLocaleString('en-PH')}` in "Reward per side" and in its ⓘ.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money
SEVERITY  money-signin
SOURCE    CODE

#### A-18 · "Read it" throws the admin out of the payment it was reading
PAGE      /admin/payments   (tab: ?open= payment)
BUTTON    "Read it" / "Read it again"
STEPS     1. Open a payment with a screenshot. 2. Press Read it.
EXPECTED  It returns to the same opened payment, where the read card shows the result.
ACTUAL    actions.ts `rereadPaymentReceipt` ends with `redirect('/admin/payments')`. The admin lands on the To-confirm list, and the result is only visible by reopening the payment. A refused payment read is only logged and still redirects as if it worked.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B5 (wrong destination)
SEVERITY  broken
SOURCE    CODE

#### A-19 · "Set aside" with nothing picked does nothing
PAGE      /admin/payments   (tab: To confirm, From your BDO card)
BUTTON    "Set aside"
STEPS     1. On a received BDO card, press Set aside without choosing from "Set aside ▾".
EXPECTED  The button is disabled or says "Pick a reason" (as "Not received" does).
ACTUAL    received.ts `leaveReceived` returns early when `reason` is not later/not_setnayan. `approvePayment` then returns with no notice, and the SubmitButton has no `disabled`.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B5
SEVERITY  broken
SOURCE    CODE

#### A-20 · "Event today 0" and "Nobody has read this picture yet" appear on failed reads
PAGE      /admin/payments
BUTTON    —
STEPS     1. The events read (same-day) or the `payment_receipt_reads` read is refused.
EXPECTED  "Couldn't read" in place of the number or the card text.
ACTUAL    `fetchSameDayOrderIds` falls back to an empty set, so the `DeskNums` tile prints "Event today 0". `const { data: reads }` ignores `error`, so `ReceiptReadCard` says "Nobody has read this picture yet."
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### A-21 · Subscriptions: "Unknown supplier" when the names read fails
PAGE      /admin/subscriptions   (tab: subscriptions of /admin/payments)
BUTTON    —
STEPS     1. The vendor_profiles names read is refused.
EXPECTED  "Couldn't read the supplier".
ACTUAL    `const { data: vendors }` ignores `error`, so every row reads "Unknown supplier" on the queue where the plan is confirmed.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4
SEVERITY  wrong
SOURCE    CODE

#### A-22 · The month picker offers only the months already on screen
PAGE      /admin/receipts
BUTTON    "Month ▾"
STEPS     1. Pick a month. 2. Open Month ▾ again.
EXPECTED  Every month that has receipts.
ACTUAL    `allMonths` is built from `receipts`, which is already month-filtered and capped at the newest 200. After one pick only "All months" and that month remain, and older months are never offered.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B6
SEVERITY  wrong
SOURCE    CODE

#### A-23 · Payout times show in UTC
PAGE      /admin/payouts   (tab: payouts of /admin/payments)
BUTTON    —
STEPS     1. Open a payout; read Scheduled / Paid at / Dispute window.
EXPECTED  Manila time, as Subscriptions and Payment options use.
ACTUAL    `formatTimestamp` calls `toLocaleString('en-PH', {…})` with no `timeZone` inside a server component, so it shows the server's UTC time.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 (the measurement must reach the render)
SEVERITY  wrong
SOURCE    CODE

#### A-24 · Gifts search: a failed read says "No suppliers match"
PAGE      /admin/offers   (tab: gifts)
BUTTON    "Comp this supplier" search
STEPS     1. Search a supplier (or user) while the read is refused.
EXPECTED  "Couldn't search".
ACTUAL    gifts/page.tsx `const { data } = await admin.from('vendor_profiles')…` then `vendorResults = data ?? []` gives "No suppliers match “…”." Same for `userResults` ("No user matches") and `grantVendor`/`grantUser` (the form just does not open).
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4
SEVERITY  wrong
SOURCE    CODE

#### A-25 · The payments loading skeleton draws a table the desk never draws
PAGE      /admin/payments
BUTTON    —
STEPS     1. Navigate to Payments and watch the loading state.
EXPECTED  The skeleton shows the segmented filter, search, three number tiles and one-line rows.
ACTUAL    payments/loading.tsx exports `TablePageSkeleton`, a bordered 5-column table. The desk has no table.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §3 Loading (the skeleton draws only what the page draws)
SEVERITY  look
SOURCE    CODE

#### A-26 · Payments: two or three filled main buttons in one scope, plus filled danger buttons outside a confirm sheet
PAGE      /admin/payments
BUTTON    "Add received screenshots" · "Approve N selected clean matches" · "Record and confirm"
STEPS     1. Open To confirm with clean matches (and a single-order search).
EXPECTED  One filled main per scope.
ACTUAL    received-drop-tile.tsx `ab ab-main` (ink fill), batch-approve-controls.tsx `ab ab-ok ab-main` and RecordPaymentCard `ab ab-ok ab-main` share the desk. On the opened payment, "Reject", "Record refund · notify couple" and Maya "Void"/"Refund" are `ab-danger ab-main` inside folds, not the single action of a confirm sheet.
SHOTS     phase B: 375 px light + desktop
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### A-27 · Payment methods: two filled saves on one screen
PAGE      /admin/settings/payment-methods
BUTTON    "Save limits" · "Save" (Most in one payment)
STEPS     1. Open Receiving accounts.
EXPECTED  One filled main per scope.
ACTUAL    Both are `.button-primary` at screen level, outside any card. "Add account" (in its tile) is a third.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### A-28 · "Preview as couple" opens a hand-made modal on top of the sheet
PAGE      /admin/payment-options   (tab: payment-options of /admin/payments)
BUTTON    "Preview as couple" → "Pay"
STEPS     1. Preview a link or QR method. 2. Press Pay (or open the QR) inside the sheet.
EXPECTED  One shared Sheet; never a popup on a popup.
ACTUAL    app/dashboard/[eventId]/_components/vendor-direct-pay.tsx `ModalShell` uses `fixed inset-0 z-[60]` with its own `aria-modal`, stacked over the `Sheet`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K3 · SHAPE
SEVERITY  look
SOURCE    CODE

#### A-29 · Create discount code is a page, but should be a full-screen popup
PAGE      /admin/discount-codes/new
BUTTON    —
STEPS     1. From Discount codes, open Create.
EXPECTED  FULL-SCREEN POPUP over the list (a long create form nobody bookmarks; ✕ returns).
ACTUAL    Today it is its own PAGE with "All codes" / "Cancel" links: 7 rows plus the services grid.
SHOTS     phase B: 375 px light + desktop
RULE      SHAPE
SEVERITY  look
SOURCE    CODE

#### A-30 · Payments: hard-coded colour and size (K2)
PAGE      /admin/payments
BUTTON    —
STEPS     1. Read the source.
EXPECTED  Tokens and `text-sn-*`.
ACTUAL    About 60 instances. Examples: desk.tsx `bg-terracotta-700` ("Event today"), `bg-success-700` ("Clean match"), `text-[14px]` (21×); batch-approve-controls.tsx `accent-success-700`; desk.tsx `min-h-[72px]`.
SHOTS     phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### A-31 · Money: hard-coded size (K2)
PAGE      /admin/money
BUTTON    —
STEPS     1. Read the source.
EXPECTED  `text-sn-*`, `--m-r-*`.
ACTUAL    10 instances. revenue-summary.tsx `text-[32px]`, `rounded-[var(--m-r-lg)]`; ledger-phone-row.tsx `text-[19px]`; transactions-ledger.tsx `text-[13px]`.
SHOTS     phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3
SEVERITY  look
SOURCE    CODE

#### A-32 · Subscriptions: hard-coded size (K2)
PAGE      /admin/subscriptions
BUTTON    —
STEPS     1. Read the source.
EXPECTED  `text-sn-*`.
ACTUAL    7 instances. subscriptions/page.tsx `text-[14px]` (done/error banners), `text-[15px]` (row title).
SHOTS     phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3
SEVERITY  look
SOURCE    CODE

#### A-33 · Payouts: hard-coded colour and size (K2)
PAGE      /admin/payouts
BUTTON    —
STEPS     1. Read the source.
EXPECTED  Tokens by job.
ACTUAL    7 instances. page.tsx FlashBanner `bg-success-50 border-success-300/50 text-success-900`, `bg-terracotta/10 text-terracotta-700`; PayoutNum `text-[20px]`, `text-[12px]`.
SHOTS     phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3
SEVERITY  look
SOURCE    CODE

#### A-34 · Booking fees: hard-coded size (K2)
PAGE      /admin/booking-fees
BUTTON    —
STEPS     1. Read the source.
EXPECTED  `text-sn-*`.
ACTUAL    15 instances. bookings-open-form.tsx `text-[19px]`, `text-[13px]`; review-min-form.tsx `text-[15px]`; fee-row-more.tsx `h-[22px]`.
SHOTS     phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3
SEVERITY  look
SOURCE    CODE

#### A-35 · Payment options: hard-coded colour and size (K2)
PAGE      /admin/payment-options
BUTTON    —
STEPS     1. Read the source.
EXPECTED  Tokens by job.
ACTUAL    9 instances. page.tsx `bg-white` (QR frame), `border-warn-300/60 bg-warn-50/60 text-warn-900` (moderation note), `text-[12px]`.
SHOTS     phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3
SEVERITY  look
SOURCE    CODE

#### A-36 · Payment methods: hard-coded colour and size (K2)
PAGE      /admin/settings/payment-methods
BUTTON    —
STEPS     1. Read the source.
EXPECTED  Tokens by job.
ACTUAL    34+ instances. `bg-warn-50 border-warn-300 text-warn-900`, `bg-success-100 text-success-800` (Active pill), `bg-white/70`, `text-[10px]`/`text-[11px]`, `bg-[var(--sn-warning,orange)]`.
SHOTS     phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3
SEVERITY  look
SOURCE    CODE

#### A-37 · Launch offer: hard-coded colour and size (K2)
PAGE      /admin/launch-offer
BUTTON    —
STEPS     1. Read the source.
EXPECTED  Tokens by job.
ACTUAL    5 instances. launch-offer-form.tsx `Result` `text-success-800`/`text-danger-700`; page.tsx `text-[14px]` ×3.
SHOTS     phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3
SEVERITY  look
SOURCE    CODE

#### A-38 · Offers & gifts tabs: hard-coded colour and size (K2)
PAGE      /admin/offers   (tabs: gifts, referrals, badges)
BUTTON    —
STEPS     1. Read the source.
EXPECTED  Tokens by job.
ACTUAL    About 66 instances. gifts/page.tsx `bg-success-50 border-success-200 text-success-900`, `text-rose-900`; referrals-surface.tsx `bg-danger-50 text-danger-800`; spotlight-awards-surface.tsx `bg-white`; badges-view.tsx `text-[12px]`.
SHOTS     phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3
SEVERITY  look
SOURCE    CODE

#### A-39 · Create discount code: hard-coded size (K2)
PAGE      /admin/discount-codes/new
BUTTON    —
STEPS     1. Read the source.
EXPECTED  Tokens and `text-sn-*`.
ACTUAL    6 instances. voucher-form.tsx `text-[14px]`, `text-[13px]`, `accent-[var(--m-orange-2)]`, `w-[200px]`.
SHOTS     phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3
SEVERITY  look
SOURCE    CODE

**Group A notes**

- Unverified: the actions of mounted views call `revalidatePath` on their OLD address (`/admin/payouts`, `/admin/subscriptions`, `/admin/booking-fees`, `/admin/payment-options`), but the view renders at `/admin/payments?view=…`. payment-options actions do not redirect at all. Phase B should check the view redraws after Approve/Hold/Save without a reload.
- The areas × levels check (`requireAdminCan`) runs only in payments/actions.ts and settings/actions.ts. Payouts Mark paid/Hold, subscriptions Confirm/Reject, payment-options, founder seats, launch offer and the booking-fees switches check only the admin gate. Is that intended?
- The offers tabs discount-codes, referrals, gifts and Spotlight got a targeted scan (reads, ₱, overlays, words), not a line-by-line read.
- payments/received.ts `matchReceived` ignores the errors on its two reads, so a refused read says "That received payment is gone." It fails closed. payouts `FlashBanner` and settings/payment-methods both call `decodeURIComponent` on an already-decoded param, so a `%` in a message would throw; I did not check whether any message contains one.
- Outside admin: the A-28 `ModalShell` lives in the couple-dashboard file app/dashboard/[eventId]/_components/vendor-direct-pay.tsx, so the couple's own pay sheet has the same popup-on-popup.

### Group B · Pricing & catalogue

#### B-1 · A failed sign-up discount read counts as 0%: it is shown, and saving with it wipes sign-up prices
PAGE      /admin/pricing   (tabs: papic-shots, setnayan-ai)
BUTTON    "Save shot prices" · "Save" (band price)
STEPS     1. The `platform_settings.onboarding_discount_pct` read is refused. 2. Open the tab. 3. Press save.
EXPECTED  A refused discount read says "Couldn't read" and blocks the save.
ACTUAL    `readOnboardingDiscountPct(settings?.onboarding_discount_pct)` returns `DEFAULT_ONBOARDING_DISCOUNT_PCT` (0) and the error is never read: in `price-control-actions.ts` `savePapicLadder` and `saveAiBandPrice` (`const { data: settings }`), and in both surfaces. `storedSignupPriceFor(…, 0)` writes NULL, which erases every Papic rung's sign-up price, or the band's. On screen, the "At set-up" column and "the saving above would make this" show the regular price as the sign-up price.
SHOTS     phase B: 375 px light
RULE      Honest states · CLAUDE.md §5.4
SEVERITY  money-signin
SOURCE    CODE

#### B-2 · Most price writes skip the "Prices & promos · Escalated" check that row saves enforce
PAGE      /admin/pricing   (tabs: pricing, setnayan-ai, papic-shots, free-windows)
BUTTON    "Save booking fee" · "Save" (sign-up discount) · "Save shot prices" · "Move" / "Save" (AI bands) · "Create … free window"
STEPS     1. Sign in as an admin with only Basic in Prices & promos. 2. "Save this price" is refused. 3. Any of the buttons above saves.
EXPECTED  Every price change checks `requireAdminCan('prices_promos','escalated')`. `lib/admin/areas.ts` says Escalated = "change a price · codes · launch offer · free windows".
ACTUAL    `actions.ts` row saves call `requireAdminCan`. `price-control-actions.ts` (`saveBookingFeeSchedule`, `savePapicLadder`, `saveSignupDiscount`, `setEventTypeBand`, `saveAiBandPrice`, `savePapicProductPrice`) and `_surfaces/free-windows-actions.ts` call only `requireAdminAction()`.
SHOTS     —
RULE      Admin gates (area powers)
SEVERITY  money-signin
SOURCE    CODE

#### B-3 · Setnayan AI prices fall back to prices typed in code
PAGE      /admin/pricing   (tab: setnayan-ai)
BUTTON    "Save" (Regular price)
STEPS     1. The catalogue read fails, or a band's SKU row is missing. 2. Open the tab.
EXPECTED  The price comes only from `platform_retail_catalog_v2`. With no row, the tab says "Couldn't read".
ACTUAL    `_surfaces/ai-prices-surface.tsx`: `regularPhp: row ? … : sku ? AI_TIER_FALLBACK_PHP[band] : null` fills "Regular price" with a peso amount typed in code. When a row is just missing (not a failed read), `locked` is false and Save stays live.
SHOTS     phase B: 375 px light
RULE      No typed prices · CLAUDE.md §1 Money
SEVERITY  money-signin
SOURCE    CODE

#### B-4 · Booking fee form fills in code values when the settings read fails, and still offers Save
PAGE      /admin/pricing   (tab: pricing)
BUTTON    "Save booking fee"
STEPS     1. The `platform_settings` read is refused. 2. Open the Supplier booking fee section.
EXPECTED  "Couldn't read" with saving off. The minimum is read, not typed.
ACTUAL    `pricing-surface.tsx` ("Falls back to the locked code schedule") fills the rate, threshold and tail from `BOOKING_FEE`. `booking-fee-form.tsx` then says "save once to store it", which writes the code values over the real ones. `minPhp={BOOKING_FEE.minPhp}` is a peso number typed in `lib/booking-fee.ts`.
SHOTS     phase B: 375 px light
RULE      Honest states · no typed prices
SEVERITY  money-signin
SOURCE    CODE

#### B-5 · Peso amounts are formatted by hand all over the pricing tabs
PAGE      /admin/pricing   (all tabs)
BUTTON    —
STEPS     1. Open any tab and read a price.
EXPECTED  Every peso amount goes through `lib/php.ts` (`formatPhp` / `formatPhpRounded`).
ACTUAL    Examples: `catalog-editor.tsx` `pesoShort` (`₱${n.toLocaleString('en-PH')}`, and "Free" at 0) plus "to sign up". The local `const peso` in `signup-discount-card.tsx`, `ai-bands-editor.tsx`, `papic-ladder-editor.tsx` and `papic-rest-editor.tsx`. `booking-fee-form.tsx` examples. `price-bands-surface.tsx` `function peso`. `free-windows-surface.tsx` `₱{formatPeso(…)}`. `plan-contents-surface.tsx` `Price:`. The `price-control-actions.ts` error message `₱${band.toLocaleString`.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money (format only via `lib/php.ts`)
SEVERITY  money-signin
SOURCE    CODE

#### B-6 · Budget planner saves hide every failure, and a typo clears a price
PAGE      /admin/budget-planner
BUTTON    "Save" (band row, benchmark row) · "Save settings"
STEPS     1. Type "12k" in Benchmark and press Save. 2. Or save while the write is refused. 3. Or save the engine settings before the config row exists.
EXPECTED  A refusal shows a plain reason. Bad input is refused, never stored as "blank".
ACTUAL    The inline `action={async (fd) => { 'use server'; await updateLeafBenchmark(fd); }}` throws away `{ ok:false, error }`, and the same holds for `updateBudgetBand` and `updateAllocationConfig`. `parsePhp` turns non-numeric text into null, which clears the benchmark (a band median becomes 0). `updateAllocationConfig` `.update().eq('config_key','default')` changes 0 rows and still reports nothing.
SHOTS     phase B: 375 px light
RULE      Honest states · every press reaches a real result
SEVERITY  money-signin
SOURCE    CODE

#### B-7 · Free windows says there are no services when the catalogue read fails
PAGE      /admin/pricing   (tab: free-windows)
BUTTON    "Create couple free window"
STEPS     1. The catalogue read fails. 2. Open the tab.
EXPECTED  "Couldn't read the services" with Create turned off.
ACTUAL    `fetchV2CustomerCatalog()` (`lib/v2-catalog.ts`) does `if (error || !data) return []`, so the form says "No live customer SKUs found in the catalog." and Create stays live.
SHOTS     phase B: 375 px light
RULE      Honest states
SEVERITY  money-signin
SOURCE    CODE

#### B-8 · Under a failed catalogue read, empty-state copy still shows beneath the banner
PAGE      /admin/pricing   (tabs: pricing, papic-shots)
BUTTON    —
STEPS     1. The retail or supplier catalogue read is refused. 2. Open the tab.
EXPECTED  Nothing below the banner claims an empty state.
ACTUAL    `pricing-surface.tsx` still mounts `PriceCatalogBrowser` with `retailRes.data ?? []`. The formula card says "No price on sale has a cost yet.", the Off view says "Nothing is switched off.", and the counts leave out the rows that failed. In `papic-ladder-surface.tsx`, `PapicRestEditor` draws an empty frame: the Thank You price disappears and nothing says it couldn't be read.
SHOTS     phase B: 375 px light
RULE      Honest states
SEVERITY  money-signin
SOURCE    CODE

#### B-9 · Supplier free windows print the plan's code key ("Solo" / "Enterprise")
PAGE      /admin/pricing   (tab: free-windows)
BUTTON    —
STEPS     1. Create a supplier free window for Plus or Ultra. 2. Read its row under "Scheduled & past windows".
EXPECTED  "Plus" / "Ultra".
ACTUAL    `free-windows-surface.tsx`: `Suppliers → {row.promoted_vendor_tier ?? '—'} tier, free` with `capitalize` prints "Solo tier" and "Enterprise tier".
SHOTS     phase B: 375 px light
RULE      Words: supplier plans Free · Verified · Plus · Pro · Ultra
SEVERITY  wrong
SOURCE    CODE

#### B-10 · Supplier add-on rows say "(Supplier Ultra)"
PAGE      /admin/pricing   (tab: pricing)
BUTTON    —
STEPS     1. Kind ▾ Supplier. 2. Read the type line under an add-on's price.
EXPECTED  "Ultra". The owner ruled on 14 Nov "NO 'SUPPLIER'" (`TIER_LABEL` comment in `lib/vendor-tier-caps.ts`).
ACTUAL    `pricing-surface.tsx` `VENDOR_OFFERING_LABEL`: 'Add-on · +1 branch (Supplier Ultra)', and the same for seat, category, service card, wait list and booking per date.
SHOTS     phase B: 375 px light
RULE      Words: plan names
SEVERITY  wrong
SOURCE    CODE

#### B-11 · Plan contents has no Event Ultra
PAGE      /admin/pricing   (tab: plan-contents)
BUTTON    "Which plan ▾"
STEPS     1. Open "Which plan ▾" and look at Event plans.
EXPECTED  Free · Event Plus · Event Pro · Event Ultra (`EVENT_PLANS` has four columns; `PLAN_PRICE_CODES.ultra`).
ACTUAL    `plan-contents-surface.tsx` `EVENT_VIEWS = ['ev-free','ev-plus','ev-pro']`, and `plan-contents-actions.ts` `EVENT_PLAN_CODES` leaves out `EVENT_ULTRA`. Event Ultra's Papic credits cannot be seen or changed here.
SHOTS     phase B: 375 px light
RULE      Couple plans: Free · Event Plus · Event Pro · Event Ultra
SEVERITY  wrong
SOURCE    CODE

#### B-12 · Plan contents tells the admin two things that are not true
PAGE      /admin/pricing   (tab: plan-contents)
BUTTON    "edited on Papic shot prices" (on the Free plan)
STEPS     1. Read the "Which plan" ⓘ. 2. Pick Free and follow the link.
EXPECTED  The copy matches what the app does.
ACTUAL    The tip says a change is "confirmed by a second admin in Approvals, the same as a price", but price saves now apply at once (`actions.ts` "A PRICE CHANGE APPLIES AT ONCE"). The link says the free grant is edited on Papic shot prices, but that tab says "Not editable here yet — changing it still needs a migration" (`papic-rest-editor.tsx`).
SHOTS     phase B: 375 px light
RULE      Honest copy
SEVERITY  wrong
SOURCE    CODE

#### B-13 · The Catalogue home shows the word "Journal"
PAGE      /admin/catalogue
BUTTON    "Journal Spotlights" (chip on the Stories & social card)
STEPS     1. Open /admin/catalogue. 2. Read the Stories & social card's chips and its line.
EXPECTED  Articles, never Journal.
ACTUAL    `lib/admin/admin-pages.ts` `v('journal-spotlights', 'Journal Spotlights', …)`, drawn by `_components/tab-landing.tsx` as a chip and in the card's line.
SHOTS     phase B: 375 px light
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### B-14 · Categories counts and lists say "0" and "none waiting" when a read fails
PAGE      /admin/categories
BUTTON    "Show ▾ Requests" · "List ▾ Event types / Religions"
STEPS     1. The supplier-requests, search-words or event-types read is refused. 2. Read the counts line and the list.
EXPECTED  "—", which the page's own banner promises ("anything that reads '—' below is unknown, not zero").
ACTUAL    In `page.tsx` only services is guarded. `${formatCount(cats.requests.length)} requests` and `words waiting` print 0. The event-types and religions counts print "0 event types · 0 in the picker…". `list-pane.tsx` says "No supplier requests waiting." / "No words waiting." on the failure path.
SHOTS     phase B: 375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE

#### B-15 · Service requests state guesses as facts when reads fail
PAGE      /admin/categories/requests   (and the row door /admin/categories/requests/[requestId])
BUTTON    request row › Decision
STEPS     1. `loadRequestTree()` returns null, or the shop-name or card-count read fails. 2. Open the list, then a request.
EXPECTED  "Couldn't read" for each fact that failed.
ACTUAL    `list-view.tsx` `categoryOf` → "A retired category" on every filed row. `nameOf` → "a shop" when the `vendor_profiles` error is set. `request-view.tsx` passes `cards={cards ?? 0}` to `DecisionForm`, which then says "No cards to move — the shop has not made one here yet." (`cardsMoveLine`).
SHOTS     phase B: 375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE

#### B-16 · Picking a kind with no prices says 'Nothing matches "".'
PAGE      /admin/pricing   (tab: pricing)
BUTTON    "Kind ▾"
STEPS     1. Leave search empty. 2. Pick a kind with nothing on sale (e.g. Bundles).
EXPECTED  An empty state that says nothing of that kind is on sale.
ACTUAL    `catalog-editor.tsx` falls to `<EmptyState title={`Nothing matches "${q}".`}` with q = "", which reads "Try part of the name, or the product code."
SHOTS     phase B: 375 px light
RULE      Empty, loading and failure never look alike
SEVERITY  wrong
SOURCE    CODE

#### B-17 · Two accent buttons in one price card and in the formula card
PAGE      /admin/pricing   (tab: pricing)
BUTTON    "Save this price" + "Retire it" · "Save this price" + "Remove for good" · "Save formula" + "Apply to all rows with a cost"
STEPS     1. Open a row, then press Retire this price (or Remove for good). 2. Press "Change the numbers" in the formula card.
EXPECTED  One main button per card. A filled danger only as the single action of a confirm sheet.
ACTUAL    `catalog-editor.tsx` `SaveSection` (`tone="brand" main`) sits beside `CardFooter` (`tone="warn" main` / `tone="danger" main`). `RemoveAllBar` draws a filled danger "Remove all N" inline. `pricing-formula-card.tsx` draws "Save formula" (`brand main`) next to "Apply to all…" (`tone="brand"`, same colour).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### B-18 · The event-type panel has nine filled Save buttons
PAGE      /admin/categories   (List ▾ Event types › a type)
BUTTON    "Save" (×8) + "Save onboarding content"
STEPS     1. Open an event type. 2. Open its sections.
EXPECTED  One main button per panel.
ACTUAL    `event-type-panel.tsx` uses `className={SAVE}` (`bg-ink … text-cream`, `ui.tsx`) 8 times; 5 of them submit the same `form={formId}`. `onboarding-editor.tsx` adds a filled `bg-mulberry` "Save onboarding content".
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### B-19 · "Reset to default content" uses window.confirm
PAGE      /admin/categories   (List ▾ Event types › a type › Onboarding content)
BUTTON    "Reset to default content"
STEPS     1. Press Reset to default content.
EXPECTED  The shared confirm `Sheet`.
ACTUAL    `onboarding-editor.tsx`: `if (!confirm('Reset this type to the built-in default onboarding? …'))`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD K3
SEVERITY  look
SOURCE    CODE

#### B-20 · Delete and Combine confirm with a dialog on top of the drawer Sheet
PAGE      /admin/categories   (map › a category or service drawer)
BUTTON    "Delete ‹category›" · "Combine"
STEPS     1. Open a category in the map (it opens as a full Sheet). 2. Open the red fold and press Delete or Combine.
EXPECTED  No popup on top of a popup.
ACTUAL    `in-place.tsx` `DeleteCategory` / `CombineService` call `useConfirm()`, which renders a `<dialog>` (`app/_components/confirm-dialog.tsx`) inside `MapDrawer`'s `Sheet` (`four-level-map.tsx`).
SHOTS     phase B: 375 px light
RULE      SHAPE
SEVERITY  look
SOURCE    CODE

#### B-21 · Native `<select>` with 3+ options (2 on this page)
PAGE      /admin/categories
BUTTON    faith select · prepared-job pick
STEPS     1. Ask the search box to add a service, or open a prepared job card.
EXPECTED  `PickMenu`.
ACTUAL    `ask-prefill.tsx` `<select name="faith">` (Everyone + every religion); `prepared-job-card.tsx` `<select name={f.field}>` (catalogue options).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD D2 (PickMenu) · K3
SEVERITY  look
SOURCE    CODE

#### B-22 · The budget planner's loading skeleton draws a grid of picture tiles
PAGE      /admin/budget-planner
BUTTON    —
STEPS     1. Navigate to the page and watch it load.
EXPECTED  A skeleton of row lists, a settings form and a table.
ACTUAL    `budget-planner/loading.tsx` exports `GridPageSkeleton` (9 `h-44` tiles with image blocks); the page draws none.
SHOTS     phase B: 375 px light
RULE      Skeleton draws only what the page draws (CLAUDE.md §3 Loading)
SEVERITY  look
SOURCE    CODE

#### B-23 · The Catalogue home's loading skeleton draws a toolbar and list rows
PAGE      /admin/catalogue
BUTTON    —
STEPS     1. Navigate to the page and watch it load.
EXPECTED  The head-numbers card plus the card grid that `TabLanding` draws.
ACTUAL    `catalogue/loading.tsx` uses `ListPageSkeleton` (a `ToolbarSkeleton` plus 8 rows); the page has no toolbar and no list.
SHOTS     phase B: 375 px light
RULE      Skeleton draws only what the page draws
SEVERITY  look
SOURCE    CODE

#### B-24 · Light-only colours and typed sizes on the pricing tabs (107)
PAGE      /admin/pricing   (all tabs)
BUTTON    —
STEPS     1. Grep the tab files.
EXPECTED  Colour and size tokens only.
ACTUAL    107 hits, e.g. `bg-emerald-100 text-emerald-800` / `bg-sky-100` / `bg-amber-100` (`free-windows-surface.tsx` `STATUS_STYLE`), `text-white/80` and `rounded-[var(--sn-frame-radius)]` (`catalog-editor.tsx`), and `text-[15px]` / `text-[11px]` (`ai-bands-editor.tsx`, `pricing-formula-card.tsx`).
SHOTS     phase B: 375 px light (+ desktop)
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### B-25 · Light-only colours and typed sizes in Categories (109)
PAGE      /admin/categories
BUTTON    —
STEPS     1. Grep `app/admin/categories` (outside requests/).
EXPECTED  Colour and size tokens only.
ACTUAL    109 hits, e.g. `bg-white` (`onboarding-editor.tsx`, `request-controls.tsx`, `prepared-job-card.tsx`), `bg-sky-50 text-sky-700` (`what-couples-choose.tsx`), `border-sky-300` (`list-pane.tsx`), `shadow-sm` (the `page.tsx` flash banner), and `text-[13px]` ×20.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### B-26 · Light-only colours and typed sizes in Service requests (24)
PAGE      /admin/categories/requests
BUTTON    —
STEPS     1. Grep `categories/requests`.
EXPECTED  Colour and size tokens only.
ACTUAL    24 hits, e.g. `bg-white` on the "Search services" box and the picked card (`decision-form.tsx`), `bg-success-600 text-white` hand-made buttons (`BUTTON` map), and `text-[11px]` / `text-[12.5px]` (`list-view.tsx`).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### B-27 · Light-only colours and typed sizes in the budget planner (36)
PAGE      /admin/budget-planner
BUTTON    —
STEPS     1. Grep `budget-planner/page.tsx`.
EXPECTED  Colour and size tokens only.
ACTUAL    36 hits, e.g. `bg-white/70` on both column-header strips, `text-[12px]` ×30, and the hand-made `rounded-md bg-terracotta-700 … text-cream` Save buttons.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

**Group B notes**

- Area-wide, for the lead: the `catalogue` admin area (Escalated = "hide for everyone · combine · retire", `lib/admin/areas.ts`) is never enforced; no `requireAdminCan('catalogue', …)` exists anywhere. Delete, combine and hide in `app/admin/categories/*actions*.ts` check only that the caller is an admin.
- App-wide: the shared `app/_components/confirm-dialog.tsx` is a native `<dialog>`, not `Sheet`, so every `useConfirm()` caller inherits a K3 miss.
- `price-bands/actions.ts` and `budget-planner/actions.ts` each hand-roll their own admin check instead of `requireAdminAction`; it matches `isAdminProfile` today. `price-bands/actions.ts` also does `throw new Error(error.message)` when the recompute RPC fails, so the admin gets an error page instead of a plain sentence.
- The Free windows "Delete" removes a window in one press with no confirm. It is not on the checklist, but it cannot be undone.
- I walked `/admin/categories/requests/[requestId]` as the row door of the requests list; its findings are folded into B-15.

### Group C · Home, work & the shell

#### C-1 · Asking "payments to confirm" in Focus answers "0" when the payments count failed, and counts rows instead of payments
PAGE      /admin   (Focus · `?ask=payments`)
BUTTON    "Ask or go anywhere" → "Payments to confirm"
STEPS     1. Open /admin?ask=payments while the payments digest count is null, or while more than 3 payments wait.
EXPECTED  "Couldn't count" when the read failed. Otherwise the real number of payments waiting.
ACTUAL    focus-home.tsx `${formatCount(answerRows.length)} · answered here` counts `rows` (up to PEEK_LIMIT 3 items plus one "N more" row). An unread queue is dropped from `waiting`, so the line says "0 · answered here".
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4) · money read
SEVERITY  money-signin
SOURCE    CODE

#### C-2 · Approval label has a typed price: "Approve refund over ₱25,000 (money)"
PAGE      /admin/approvals
BUTTON    —
STEPS     1. Open an approve_large_refund request (pending row, or the Recently decided "Action" column).
EXPECTED  The threshold read from its one home and formatted with formatPhp.
ACTUAL    lib/admin-approvals.ts `NON_PICKER_ACTION_LABEL` hard-types '₱25,000'. The real number is `REFUND_TWO_ADMIN_THRESHOLD_PHP` in lib/two-admin-promise.ts, so this is a second copy that can drift.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money (never write a price; lib/php.ts) · brand.md claim 1
SEVERITY  money-signin
SOURCE    CODE

#### C-3 · Approve, Reject and Mark handled read with the service-role client before the admin gate
PAGE      /admin/approvals
BUTTON    "✓ Approve & execute" · "Reject" · "Mark handled"
STEPS     1. POST approveRequest, rejectRequest or adminTeamAct op=resolve as a non-admin.
EXPECTED  The admin gate runs before any createAdminClient() read. This matters because these approvals carry refunds, comps and price changes.
ACTUAL    approvals/actions.ts `requireDeciderFor` reads `admin_approval_requests` with `createAdminClient()` before calling `requireAdminCan(area, 'escalated')`. escalation-ops.server.ts `resolveEscalationOp` reads `work_escalations` before `requireAdminCan(row.area, …)`.
SHOTS     n/a (server-side)
RULE      Gate before service role (brief §3c · layout.tsx "AFTER THE ADMIN CHECK, NEVER BEFORE IT")
SEVERITY  money-signin
SOURCE    CODE

#### C-4 · "Answered on Focus" search rows open the Work list in Full mode
PAGE      /admin (shell, every page)   (Full mode)
BUTTON    palette rows "Suppliers’ badge progress" / "Payments to confirm" / "Papers to verify"
STEPS     1. Switch to Full. 2. ⌘K, then pick a row in the "Answered on Focus" group.
EXPECTED  The in-place answer for that question.
ACTUAL    admin-destinations.ts `FOCUS_ASKS` hrefs `/admin?ask=…`. In Full mode, page.tsx `if (mode === 'full') return AdminWorkLanding(props)` sends any query to `WorkAllList`, which ignores `ask`.
SHOTS     phase B: 375 px light + desktop
RULE      design-and-wiring B5 (every press reaches its destination)
SEVERITY  broken
SOURCE    CODE

#### C-5 · "Message us" in the team Help only scrolls the page
PAGE      /admin/help/guides
BUTTON    "Message us"
STEPS     1. Ask something with no answer, or press No on an answer. 2. Press "Message us".
EXPECTED  A real way to message someone, or a label that says what it does.
ACTUAL    guides/page.tsx `messageHref: '#no-answer-yet'`. The shared NoAnswer and AnswerFeedback show `label="Message us"`, but the press only jumps to the "No answer yet" list and sends nothing.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B5
SEVERITY  broken
SOURCE    CODE

#### C-6 · Work › All lane chips add the watch-only trails into "All N"
PAGE      /admin/work   (tab: all)
BUTTON    "All" / "Support" chips
STEPS     1. Have pax changes or supplier refunds in the last 7 days. 2. Open /admin/work?view=all.
EXPECTED  The chip agrees with the Next card's "N need you" (totalOpen leaves the trails out).
ACTUAL    queues-triage-feed.tsx `LaneChips` → `waiting(rows)` sums every `count`, including `watchOnly` rows. This is the same 624-vs-53 drift that `workBadge` fixed (F-A-03).
SHOTS     phase B: 375 px light
RULE      design-and-wiring C8 (one reader for a shared number)
SEVERITY  wrong
SOURCE    CODE

#### C-7 · Work landing's "Waiting · across every queue" counts a watch trail and leaves out queues the Work list counts
PAGE      /admin/work   (tab: landing; also /admin in Full mode)
BUTTON    —
STEPS     1. Open /admin/work. 2. Compare the head number with Focus "N things need you" or Work › All.
EXPECTED  The same total the Work list and Focus show.
ACTUAL    tab-landing.tsx `sum(allViews.map(countOf))` adds `pax-changes` (watchOnly) and leaves out payments, verify, subscriptions, booking-fees and the other non-Work-tab queues. The sub-line still says 'across every queue'. The "Requests to decide" card also counts the pax trail.
SHOTS     phase B: 375 px light
RULE      design-and-wiring C8
SEVERITY  wrong
SOURCE    CODE

#### C-8 · "From suppliers" filter shows "Documents 0" when that read failed
PAGE      /admin/work   (tab: all)
BUTTON    "Filter what suppliers sent" ▾
STEPS     1. Make one supplier-work kind fail (read.failed). 2. Open the dropdown.
EXPECTED  "—" or "couldn't read" beside that kind, and an "All" count that says it is partial.
ACTUAL    supplier-inbox.tsx `kindOptions` uses `countByKind(read.items)`, which gives 0 for a failed kind. "All N" leaves it out silently.
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4)
SEVERITY  wrong
SOURCE    CODE

#### C-9 · Event-type read error is dropped, so the "It is this event type" picker is just empty
PAGE      /admin/work   (tab: all · Event types row)
BUTTON    "Pick the type…" / "Point them to it"
STEPS     1. Fail the `event_type_vocab` read. 2. Open an event-type ask.
EXPECTED  "Couldn't read the event types".
ACTUAL    work/page.tsx `(typesRead.data ?? [])`, and `typesRead.error` is never checked. FormPick opens with no options. A linked row shows the raw type key.
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4)
SEVERITY  wrong
SOURCE    CODE

#### C-10 · Verification checks that fail to run show up as "no checks" on a Documents row
PAGE      /admin/work   (tab: all · Documents row)
BUTTON    "Approve"
STEPS     1. Make buildVerificationChecksForVendors throw. 2. Open a Documents row.
EXPECTED  A line saying the checks could not run, before Approve.
ACTUAL    lib/admin/supplier-work.server.ts `buildVerificationChecksForVendors(...).catch(() => ({}))` leaves `checks: []`. DocsBody draws only the papers and an active "Approve".
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4)
SEVERITY  wrong
SOURCE    CODE

#### C-11 · Admin log prints raw action and table names ("vendor tier set · vendor_profiles")
PAGE      /admin/admin-log
BUTTON    —
STEPS     1. Open the log after any vendor_* action.
EXPECTED  Plain words that say "supplier", and no table names.
ACTUAL    admin-log/page.tsx `actionWords(r.action)` only swaps `_` for spaces, so a person reads "vendor visibility change". It also prints `` ` · ${r.target_table}` `` (vendor_profiles, canonical_service_taxonomy, …).
SHOTS     phase B: 375 px light
RULE      brand.md Word rules (supplier, never vendor)
SEVERITY  wrong
SOURCE    CODE

#### C-12 · "Journal" in admin words a person reads
PAGE      /admin (shell, every page)   (also /admin/approvals)
BUTTON    palette/menu row "Journal Spotlights"
STEPS     1. ⌘K, type "journal". 2. Open an approve_journal_spotlight request on Approvals.
EXPECTED  "Articles".
ACTUAL    admin-nav-groups.tsx `label: 'Journal Spotlights'` (palette and All-surfaces card). lib/admin-approvals.ts `'Publish sponsored journal spotlight'` (approvalActionLabel).
SHOTS     phase B: 375 px light
RULE      brand.md Word rules (Articles, never Blog/Journal)
SEVERITY  wrong
SOURCE    CODE

#### C-13 · The overview skeleton draws a page that no longer exists
PAGE      /admin   (and every admin page that inherits app/admin/loading.tsx)
BUTTON    —
STEPS     1. Open /admin on a slow connection.
EXPECTED  A ghost of what arrives.
ACTUAL    loading.tsx draws a "terracotta card + 4 tiles", "8 tiles in a 2×4 grid" and "6 nav tiles". Focus actually draws a date line, "N things need you", the ask pill, "From your BDO" and one list of rows. Full draws TabLanding: a hello line, a cream head card (Waiting · Oldest) and 5 group cards with chips. Neither has the panel, the stats or the tiles, so the shared skeleton is dishonest.
SHOTS     phase B: 375 px light + desktop
RULE      CLAUDE.md §3 Loading ("draws only what the page draws")
SEVERITY  look
SOURCE    CODE

#### C-14 · The Help inbox's own loading.tsx draws a 5-column table
PAGE      /admin/help
BUTTON    —
STEPS     1. Open /admin/help cold.
EXPECTED  A ghost of the conversation list (avatar · name · preview).
ACTUAL    help/loading.tsx `TablePageSkeleton` draws a toolbar plus a 5-column, 10-row table header grid. The page draws the HelpMessenger list and chat.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §3 Loading
SEVERITY  look
SOURCE    CODE

#### C-15 · The team Help page has no PageMasthead (no page title)
PAGE      /admin/help/guides
BUTTON    —
STEPS     1. Open the account sheet → Help.
EXPECTED  `<PageMasthead title="Help" />`, as every page has.
ACTUAL    guides/page.tsx renders AskBox and then a `<p>` "Answers for the team". There is no PageMasthead and no h1 anywhere.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §3 Page title · design-and-wiring A2
SEVERITY  look
SOURCE    CODE

#### C-16 · The command palette is a hand-built dialog, not the shared Sheet
PAGE      /admin (shell, every page)
BUTTON    top-bar search / "Ask or go anywhere" / ⌘K
STEPS     1. Open the search on a phone and on desktop.
EXPECTED  Sheet / PickMenu / RiseScreen with the shared backdrop, and ActionButton for its buttons.
ACTUAL    admin-command-palette.tsx: its own `role="dialog" aria-modal="true"` panel (`fixed left-1/2 top-[11vh] … shadow-2xl`). It does use the shared OverlayBackdrop and lock. "Prepare the form" / "Back" are raw `<button>`s filled with `var(--sn-mulberry-600, #C24E25)`.
SHOTS     phase B: 375 px light + desktop
RULE      HOUSE_DESIGN_STANDARD Part K3 · D12
SEVERITY  look
SOURCE    CODE

#### C-17 · An open supplier row on tablet and desktop is a fixed side panel with no backdrop
PAGE      /admin/work   (tab: all · From suppliers)
BUTTON    any supplier row (e.g. "Documents · ‹shop›")
STEPS     1. At ≥768 px open a row (`?item=`).
EXPECTED  A RiseScreen (long body) or a Sheet with the shared dim+blur that locks the page.
ACTUAL    supplier-inbox.tsx `md:fixed md:inset-y-0 md:right-0 md:z-40 … md:shadow-2xl`. There is no backdrop and no lock, and the list behind stays live.
SHOTS     phase B: desktop
RULE      HOUSE_DESIGN_STANDARD Part K3 · SHAPE
SEVERITY  look
SOURCE    CODE

#### C-18 · "Delete" on Search memory uses window.confirm
PAGE      /admin/search-memory
BUTTON    "Delete"
STEPS     1. Press Delete on a phrase.
EXPECTED  The house confirm sheet.
ACTUAL    search-memory-table.tsx `window.confirm(`Forget "${phrase}"?…`)`
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE

#### C-19 · The New request "Action" field is a native select
PAGE      /admin/approvals
BUTTON    "Action"
STEPS     1. Open Approvals → New request.
EXPECTED  PickMenu (FieldPick).
ACTUAL    1 native `<select name="action_type">` with 3 options (APPROVAL_ACTIONS). Next to it are raw `<input>`/`<textarea>` with `bg-white` instead of form-row.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD D2 (PickMenu) · K3
SEVERITY  look
SOURCE    CODE

#### C-20 · The 3-field New request form sits open above the queue
PAGE      /admin/approvals
BUTTON    "Submit for two-admin approval"
STEPS     1. Open Approvals on a phone.
EXPECTED  The queue first, and New request as a SMALL POPUP (Sheet, 3 fields).
ACTUAL    approvals/page.tsx `{/* NEW REQUEST */}` is an always-open section that pushes "Pending" below the fold.
SHOTS     phase B: 375 px light
RULE      SHAPE
SEVERITY  look
SOURCE    CODE

#### C-21 · K2: hard-coded colour and size in the shell
PAGE      /admin (shell, every page)
BUTTON    —
STEPS     1. Read the shell files.
EXPECTED  Tokens only.
ACTUAL    83 hits. layout.tsx `bg-red-100 … text-red-800`, `bg-success-100 text-success-800`, `text-[10px]`; admin-command-palette.tsx `var(--sn-paper-2, #F5EEE1)`, `text-[9.5px]`; admin-search-box.tsx `#FBFAF7`, `text-[9px]`; error.tsx `border-danger-200 bg-danger-50/60`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### C-22 · K2: Focus overview
PAGE      /admin
BUTTON    —
STEPS     1. Read the Focus files.
EXPECTED  Tokens and the text-sn-* scale.
ACTUAL    24 hits. focus-home.tsx `text-[26px]`, `text-[13px]`; focus-row.tsx `rounded-[var(--sn-frame-radius)]`, `text-[15px]`; admin-ask-pill.tsx `shadow-lg`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### C-23 · K2: Work list
PAGE      /admin/work
BUTTON    —
STEPS     1. Read the Work files.
EXPECTED  Tokens only.
ACTUAL    45 hits. queues-triage-feed.tsx `'#B42318'`, `'#B54708'`, `'#8A6A2E'`, `color: 'white'`; supplier-inbox.tsx `bg-success-100 text-success-800`, `bg-danger-100`, `md:shadow-2xl`, `text-[17px]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### C-24 · K2: Approvals
PAGE      /admin/approvals
BUTTON    —
STEPS     1. Read approvals/page.tsx.
EXPECTED  Tokens only.
ACTUAL    31 hits. `bg-white` ×5, `bg-success-600 … text-white`, `bg-warn-50/60 text-warn-900`, `to-terracotta-50/30`, `text-[11px]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### C-25 · K2: Search memory
PAGE      /admin/search-memory
BUTTON    —
STEPS     1. Read search-memory-table.tsx.
EXPECTED  Tokens only.
ACTUAL    10 hits. `bg-emerald-50 text-emerald-800 border-emerald-200`, `border-red-200 bg-red-50 … text-red-800`, `text-[12px]`, `text-[13px]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### C-26 · K2: What can I ask? (half-pixel sizes)
PAGE      /admin/ask
BUTTON    —
STEPS     1. Read ask/page.tsx.
EXPECTED  text-sn-* scale, no half pixels.
ACTUAL    8 hits. `text-[14.5px]`, `text-[12.5px]`, `text-[18px]`, `text-[10px]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 Type
SEVERITY  look
SOURCE    CODE

#### C-27 · K2: Help inbox
PAGE      /admin/help
BUTTON    —
STEPS     1. Read help-messenger.tsx.
EXPECTED  text-sn-* scale.
ACTUAL    6 hits. `text-[14px]`, `text-[11px]`, `md:h-[560px]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2
SEVERITY  look
SOURCE    CODE

#### C-28 · K2: Admin log
PAGE      /admin/admin-log
BUTTON    —
STEPS     1. Read admin-log/page.tsx.
EXPECTED  Tokens only.
ACTUAL    2 hits. `text-danger-700`, `text-[11px]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2
SEVERITY  look
SOURCE    CODE

#### C-29 · K2: Team help
PAGE      /admin/help/guides
BUTTON    —
STEPS     1. Read guides/page.tsx.
EXPECTED  Tokens only.
ACTUAL    1 hit. `text-terracotta-700` on the "We couldn’t read the list" line.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2
SEVERITY  look
SOURCE    CODE

**Group C notes**

- /admin/more, /admin/approvals, /admin/search-memory and /admin/queues never render at their own address. The middleware's `adminMergedForward` (lib/admin/admin-pages.ts `olds`) sends them on with a 307 first. So the /admin/more "All surfaces" body, more/loading.tsx and queues/loading.tsx are dead. layout.tsx and admin-bottom-nav.tsx still say "/admin/more still answers". Approvals and search-memory render only as mounted views.
- `ConfirmDialog` (app/_components/confirm-dialog.tsx) is a native `<dialog>`, not a Sheet. It is the confirm behind "Approve all N green" (green-batch.tsx → ConfirmForm) and avatar-confirm.tsx. It is the house confirm, so the lead should decide once, app-wide, whether K3 applies.
- TabLanding is shared. The Money landing (/admin/money, not my page) has the same problem as C-7: its "Refunds · waiting" and "N money items to approve" include the watch-only `supplier-refunds` trail.
- error.tsx's "Back to Overview" goes to /admin, which is now Focus or Work. "Overview" now means Insights › Overview.
- Smaller items: /admin's metadata title is 'Work · Admin' while Focus mode's masthead says "Focus". The Apple secret reminder's "Copy prompt" does nothing, silently, when the clipboard is unavailable; it shows from 8 Dec, so I could not see it live.

### Group D · Accounts & people

#### D-1 · Approving a deletion marks it "approved" before any area, self or internal check runs
PAGE      /admin/account-deletions
BUTTON    "Approve + delete" · "Approve + blacklist" · "Reject (keep account)"
STEPS     1. Sign in as an admin with no Deletions area. 2. Approve a pending request, or Reject one.
EXPECTED  Deletions · Escalated ("approve a deletion", `lib/admin/areas.ts`) is checked before anything is written.
ACTUAL    `approveRequest` (account-deletions/actions.ts) checks only "is admin", then writes `status: 'approved'`. Only after that do `deleteUser`/`blacklistUser` run `requireAdminCan` and the internal and self guards. If any of them refuses, the request reads "approved" and the account stays open. It can no longer be rejected, because `loadPendingRequest` expects `pending`. `rejectRequest` has no area check at all.
SHOTS     phase B: — (server-side)
RULE      Admin areas × levels (DECISION_LOG 2026-11-13) · gate first
SEVERITY  money-signin
SOURCE    CODE

#### D-2 · The internal-account guard on erasure lets the erase run when its read fails
PAGE      /admin/account-deletions   (same action behind /admin/accounts tab: users "Delete account")
BUTTON    "Approve + delete" · "Run erasure again"
STEPS     1. Approve a request for an internal (§ 10a) account while the `users` read is refused.
EXPECTED  An unread target refuses the erase.
ACTUAL    users/actions.ts `deleteUser` reads with `const { data: target } = await admin.from('users').select('is_internal')…` and drops the error. `if (target?.is_internal)` passes when `target` is null, so `eraseUserAccount` runs, and lib/erasure/purge.ts has no internal check. This page still offers both approve buttons on internal rows.
SHOTS     phase B: — (server-side)
RULE      Honest states (CLAUDE.md §5.4) · admin access
SEVERITY  money-signin
SOURCE    CODE

#### D-3 · Removing an event never checks Deletions · Escalated
PAGE      /admin/event-deletions   (and /admin/accounts tab: events)
BUTTON    "Remove it for good" · "Keep it, and tell them why" · tab events "Delete"
STEPS     1. Sign in as an admin with no areas. 2. Remove a money-held event, or press Delete on the Events tab.
EXPECTED  "remove an event" is Deletions · Escalated (`ADMIN_AREA_LIST`), so it should be refused.
ACTUAL    `approveEventDeletion`, `rejectEventDeletion` (event-deletions/actions.ts) and `deleteEvent` (events/actions.ts) each call only a local "is admin" `requireAdmin`. None of these files contains `requireAdminCan`.
SHOTS     phase B: — (server-side)
RULE      Admin areas × levels (DECISION_LOG 2026-11-13)
SEVERITY  money-signin
SOURCE    CODE

#### D-4 · The supplier invite gives a free paid plan without the Plans or Gifts gate
PAGE      /admin/accounts   (tab: vendors)
BUTTON    "Create invite link" (with "Plan they get for free" = Plus/Pro/Ultra)
STEPS     1. Admin with no Plans or Gifts area. 2. Invite a supplier with Pro free until a date up to a year away.
EXPECTED  The same gate as `setVendorTier` (`requireAdminCan('plans','escalated')`) or `issueVendorSkuComp` (gifts_comps).
ACTUAL    `createAdminVendorInvite` (vendors/actions.ts) checks only "is admin". It writes `offer_tier`/`offer_until`, which the claim applies as `tier_source = 'admin_comp'`.
SHOTS     phase B: — (server-side)
RULE      Admin areas × levels · money
SEVERITY  money-signin
SOURCE    CODE

#### D-5 · A failed cancel of unpaid bills is swallowed and the event is removed anyway
PAGE      /admin/event-deletions
BUTTON    "Remove it for good"
STEPS     1. Remove an event while the `orders` update is refused.
EXPECTED  Stop with a failure. Otherwise unpaid bills outlive the event.
ACTUAL    `approveEventDeletion` only logs `strandErr` (`console.error('[event-deletions] could not cancel unpaid bills'`) and goes on to delete. `orders.event_id` is SET NULL, so the stranded-bill case the comment warns about happens silently. The `status: 'approved'` update is also unchecked.
SHOTS     phase B: — (server-side)
RULE      Honest states · money
SEVERITY  money-signin
SOURCE    CODE

#### D-6 · Comp-grant service picker shows a failed catalog read as "No catalog SKUs found."
PAGE      /admin/accounts   (tab: users, comp grants panel; also tab: vendors)
BUTTON    "Comp grants" → "Issue comp grant"
STEPS     1. Open Comp grants while a catalog read is refused.
EXPECTED  "Couldn't read" (the `services === null` path).
ACTUAL    `fetchV2CustomerCatalog`, `fetchV2BundleCatalog` and `fetchV2VendorCatalog` (lib/v2-catalog.ts) return `[]` on error and never throw, so users-surface `catch { compGrantServices = null }` never fires. A whole category drops out, or the panel says "No catalog SKUs found." The vendors tab has the same problem: `readPersonalInvitePlanPrices` lists plans with no price.
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4) · prices from the catalog
SEVERITY  money-signin
SOURCE    CODE

#### D-7 · Peso amounts formatted by hand, and a typed peso example, on the comp-grant form
PAGE      /admin/accounts   (tab: users)
BUTTON    "Issue comp grant"
STEPS     1. Open Comp grants. 2. Read the SKU prices, the value hint, the success banner and the grant cards.
EXPECTED  `formatPhp` / `formatPhpRounded`. No peso number typed into copy.
ACTUAL    users-surface has `₱{(s.price_centavos / 100).toLocaleString()}`, `₱{formatCount(COMP_GRANT_CO_REVIEW_PESOS)}` and `placeholder="2499"`. users/actions.ts banner: `₱${COMP_GRANT_CO_REVIEW_PESOS.toLocaleString('en-PH')}`. `formatRetailValueCentavos` (lib/comp-grants.ts) is hand-rolled. The threshold itself is code (`COMP_GRANT_CO_REVIEW_PESOS = 10_000`).
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 money · lib/php.ts
SEVERITY  money-signin
SOURCE    CODE

#### D-8 · A comma in the Users or Venues search breaks the read and shows "Couldn't read"
PAGE      /admin/accounts   (tab: users, venues)
BUTTON    Search box (Enter) · "Apply filters"
STEPS     1. Users: search `Cruz, Ana`. 2. Venues: search `Marriott, Manila` (the placeholder suggests commas).
EXPECTED  Results. The Events tab already sanitises this (`eventWordFilters`, F-W2-37).
ACTUAL    Raw `q` is put straight into PostgREST `.or()`. users-surface: `` `email.ilike.%${q}%,display_name…` ``. venues-surface: `` `name.ilike.%${q}%,slug.ilike.%${q}%` ``. The comma splits the filter, PostgREST errors, and the tab shows its read failure.
SHOTS     phase B: 375 px light
RULE      Every control does something real (design-and-wiring B5)
SEVERITY  broken
SOURCE    CODE

#### D-9 · "Keep it" can fail to record yet still notifies the couple
PAGE      /admin/event-deletions
BUTTON    "Keep it, and tell them why"
STEPS     1. Reject while the `event_deletion_requests` update is refused.
EXPECTED  A failure is shown and nothing is sent.
ACTUAL    `rejectEventDeletion` runs `await createAdminClient().from('event_deletion_requests').update(…)` with no error check, then calls `emitNotification`. The row stays pending, the couple gets a reply that was never recorded, and the admin sees nothing.
SHOTS     phase B: 375 px light
RULE      A failure must render as a failure (design-and-wiring B6)
SEVERITY  broken
SOURCE    CODE

#### D-10 · The face-tagging switch on the Events tab never says whether it worked
PAGE      /admin/accounts   (tab: events)
BUTTON    "On" / "Auto" / "Off" (Face tagging column)
STEPS     1. Toggle face tagging on a row. The write is refused or does not land.
EXPECTED  "The database refused the face-tagging change", as `/admin/events/[eventId]` shows.
ACTUAL    `setEventFaceMode` redirects to `/admin/accounts?tab=events&error=face_mode_failed` (or `saved=face_mode_on`). accounts/page.tsx never passes `error`/`saved` to `EventsSurface`, so both outcomes are silent.
SHOTS     phase B: 375 px light
RULE      Honest states · Toast rule (CLAUDE.md §3)
SEVERITY  wrong
SOURCE    CODE

#### D-11 · Rollups are silently cut at 1,000 rows on the Events and Demo tabs
PAGE      /admin/accounts   (tab: events, demo-vendors)
BUTTON    —
STEPS     1. Events tab with 200 events whose guests total more than 1,000. 2. Demo tab with more than 1,000 demo shops.
EXPECTED  Paged reads, or a disclosure when a read is capped.
ACTUAL    events-surface reads `guests` and `event_std_views` (one row per day) with `.in('event_id', eventIds)` and no paging, so Guests and STD views undercount while reading as measured. demo-vendors-surface asks for `.limit(BATCH_SCAN_LIMIT)` (2000) and 5000, but the 1,000-row ceiling (noted in lib/vendor-earnings.ts) caps them first. Per-folder, per-city and Empty-categories shrink, and the "floors" note (`>= BATCH_SCAN_LIMIT`) never fires.
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4)
SEVERITY  wrong
SOURCE    CODE

#### D-12 · The Delete and Blacklist confirms promise a hard-delete cascade that no longer happens
PAGE      /admin/accounts   (tab: users)
BUTTON    "Delete account" · "Delete and block this email"
STEPS     1. ⋯ on a person → Delete account. 2. Read the confirm.
EXPECTED  The true erasure words, like account-deletions' `ERASURE_WORDS` ("Orders and payments are kept…").
ACTUAL    The confirm says "Hard-delete … Their auth identity is gone; all related data cascade-deletes" and "The user is hard-deleted". `deleteUser` only anonymises through `eraseUserAccount` ("no auth.users DELETE is issued").
SHOTS     phase B: 375 px light
RULE      Words must be true (brand.md)
SEVERITY  wrong
SOURCE    CODE

#### D-13 · The Demo tab contradicts itself and points to retired addresses
PAGE      /admin/accounts   (tab: demo-vendors)
BUTTON    "/explore?demo=1"
STEPS     1. Open the Demo suppliers tab and read the warning, then "View as a couple".
EXPECTED  One true statement, and links whose labels match where they go.
ACTUAL    The warning says "Demo shops are public … marked (DEMO ONLY)". The next section says "hidden from the public marketplace by default. Append ?demo=1 to any /vendors URL", but `/vendors` now forwards to `/for-suppliers` (next.config.ts). The button is labelled "/explore?demo=1" but its href is `/?browse=1&demo=1`. A footer still reads "PR 1 (this PR) …".
SHOTS     phase B: 375 px light
RULE      Words must be true · no dev text
SEVERITY  wrong
SOURCE    CODE

#### D-14 · Team "Add" and "Save" give no sign anything happened, and a second press opens another request
PAGE      /admin/team
BUTTON    "Add" · "Save" · "Take all away"
STEPS     1. Add an admin. The two-admin request opens. 2. The screen is unchanged and the fields keep their text. 3. Press Add again.
EXPECTED  "Waiting on a second admin in Approvals", and one pending request per person, as `requestTeamMemberGrant` does.
ACTUAL    `addAdminOp`, `saveAdminAreasOp` and `takeAllAreasAwayOp` (team-ops.server.ts) only `revalidatePath`, with no flag or banner. `addAdminOp` and `raiseEscalatedRequest` insert without a pending check, and no unique index on `admin_approval_requests` stops the duplicate.
SHOTS     phase B: 375 px light
RULE      Success is a small toast (CLAUDE.md §3) · design-and-wiring B6
SEVERITY  wrong
SOURCE    CODE

#### D-15 · A failed owner check shows the owner as an ordinary admin with "No areas yet"
PAGE      /admin/team
BUTTON    —
STEPS     1. Load Team while the `is_platform_owner` RPC is refused.
EXPECTED  "Couldn't check the owner", never an unlocked row.
ACTUAL    `readIsPlatformOwner` returns `null` on error. The page only adds ids `=== true` to `ownerIds`, so the owner's row loses "🔒 Owner · everything" and shows the editable grid, and the summary falls to "No areas yet — can open /admin and do nothing". The server refuses a save, so only the display is wrong.
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4)
SEVERITY  wrong
SOURCE    CODE

#### D-16 · Deletion queue prints "vendor" as the account kind
PAGE      /admin/account-deletions
BUTTON    —
STEPS     1. A supplier files a deletion request. 2. Read the pending card line.
EXPECTED  "Supplier".
ACTUAL    page.tsx `u?.account_type === 'customer' ? 'Couple' : (u?.account_type ?? 'unknown')` prints the raw `vendor` (and `admin`, `unknown`).
SHOTS     phase B: 375 px light
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### D-17 · Banned words in placeholders on the Accounts tabs
PAGE      /admin/accounts   (tab: vendors, users)
BUTTON    —
STEPS     1. Vendors: read the invite's Supplier email field. 2. Users: read the comp-grant Rationale field.
EXPECTED  No "vendor", no "Monogram" (say Logo Maker).
ACTUAL    invite-vendor-form.tsx `placeholder="hello@vendorbusiness.ph"`. users-surface rationale `placeholder="… gifting Animated Monogram as remediation."`.
SHOTS     phase B: 375 px light
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### D-18 · Two filled main buttons on one screen in three Accounts tabs
PAGE      /admin/accounts   (tab: venues, vendors, demo-vendors)
BUTTON    "Add venue" + "Apply filters" · "Create invite link" + "Download the card" · "/explore?demo=1" + "Create demo suppliers"
STEPS     1. Open each tab (vendors: after an invite succeeds).
EXPECTED  One accent-filled main per scope.
ACTUAL    venues-surface: masthead link `bg-mulberry` and `button-primary`. invite-vendor-form: `button-primary` and `ActionButton … main` in the same card. demo-vendors-surface: `bg-ink … text-cream` link and `DemoVendorActions` `tone="brand" main`.
SHOTS     phase B: 375 px light + desktop
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### D-19 · Filled danger outside a confirm, with a second danger button beside it
PAGE      /admin/account-deletions
BUTTON    "Approve + delete" + "Approve + blacklist"
STEPS     1. Open a pending request card.
EXPECTED  A filled danger only as the single action of a confirm sheet, and no second button in the main's colour.
ACTUAL    `actionButtonClass('danger', { main: true })` on the card, next to `actionButtonClass('danger')` (outlined in the same danger colour).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### D-20 · Filled danger button on the queue card, outside a confirm sheet
PAGE      /admin/event-deletions
BUTTON    "Remove it for good"
STEPS     1. Open a pending removal.
EXPECTED  A filled danger only as the single action of a confirm sheet.
ACTUAL    page.tsx `className={actionButtonClass('danger', { main: true })}` sits inline on the card.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### D-21 · Hard-coded light-only colours and typed sizes across the Accounts tabs (67)
PAGE      /admin/accounts
BUTTON    —
STEPS     1. Grep the surfaces, `person-more.tsx`, `invite-vendor-form.tsx` and `demo-vendor-actions.tsx`.
EXPECTED  Colour and type tokens only.
ACTUAL    67 hits. Examples: `bg-sky-100 text-sky-800` ("Team & roles", vendors-surface); `bg-white/70` (users-surface grants panel); `border-red-200 bg-red-50 text-red-900` (demo-vendor-actions); half-pixel `text-[11.5px]` and `style={{ color: 'rgb(var(--color-danger))' }}` (users-surface); `text-[9px]` (venues-surface).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### D-22 · Typed pixel sizes on the venue form (12)
PAGE      /admin/venues/new
BUTTON    —
STEPS     1. Open the form.
EXPECTED  The `text-sn-*` scale.
ACTUAL    venue-form.tsx uses `text-[10px]` 12 times, for example the labels "Slug *" and "Venue type *" and the hints "Decimal degrees. PH range…".
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### D-23 · Typed pixel sizes on the event-removals queue (8)
PAGE      /admin/event-deletions
BUTTON    —
STEPS     1. Open the page.
EXPECTED  The `text-sn-*` scale.
ACTUAL    page.tsx has 8 hits: `text-[13px]` ("Asked …", "What you did about the money", "Why people left" lines) and `text-[12px]` ("Removing destroys its photos…").
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### D-24 · Typed pixel sizes on the account-deletions queue (4)
PAGE      /admin/account-deletions
BUTTON    —
STEPS     1. Open the page.
EXPECTED  The `text-sn-*` scale.
ACTUAL    page.tsx has `text-[12px]` (request id, Status pill) and `labelClassName="text-[13px] …"` (internal-account InfoTip).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### D-25 · Typed pixel size on the demo inquiries Status pill (1)
PAGE      /admin/demo-vendors/inquiries
BUTTON    —
STEPS     1. Open the page.
EXPECTED  The `text-sn-*` scale.
ACTUAL    page.tsx Status pill: `rounded-full px-2.5 py-0.5 text-[12px]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### D-26 · Native selects with 3 or more options on the Accounts tabs (2)
PAGE      /admin/accounts   (tab: vendors, venues)
BUTTON    Status · "Filter by type"
STEPS     1. Open either filter.
EXPECTED  `PickMenu`.
ACTUAL    vendors-surface `<select name="status">` (All, Published, Draft, Renewals). venues-surface `<select name="type">` (17 options).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD D2 (PickMenu) · K3
SEVERITY  look
SOURCE    CODE

#### D-27 · Native select for venue type on the create form
PAGE      /admin/venues/new
BUTTON    "Venue type *"
STEPS     1. Open the type field.
EXPECTED  `PickMenu`.
ACTUAL    venue-form.tsx `<select name="venue_type">` over `VENUE_TYPES` (16 options).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD D2 (PickMenu) · K3
SEVERITY  look
SOURCE    CODE

#### D-28 · A confirm dialog opens on top of the ⋯ sheet
PAGE      /admin/accounts   (tab: users)
BUTTON    "Sign out everywhere" · "Delete account" · "Delete and block this email"
STEPS     1. ⋯ on a person (Sheet). 2. Press a danger row.
EXPECTED  Never a popup on top of a popup.
ACTUAL    `PersonMore` renders a `Sheet`, and its children are `ConfirmForm`s whose `ConfirmDialog` (`<dialog>`) opens over the open sheet.
SHOTS     phase B: 375 px light
RULE      SHAPE
SEVERITY  look
SOURCE    CODE

#### D-29 · The long comp-grant form opens at the foot of the list, out of sight
PAGE      /admin/accounts   (tab: users)
BUTTON    "Comp grants" (⋯ sheet)
STEPS     1. With a long list, ⋯ → Comp grants.
EXPECTED  FULL-SCREEN POPUP (RiseScreen, ✕ back to the list) for a 5-part form: scope, service checklist, value, expiry, rationale.
ACTUAL    `buildToggleHref` targets `#u-<id>` (the row), but `CompGrantsPanel` renders after `</TemplateSection>`, below up to 200 rows.
SHOTS     phase B: 375 px light + desktop
RULE      SHAPE
SEVERITY  look
SOURCE    CODE

#### D-30 · The one-off venue create form is its own page
PAGE      /admin/venues/new
BUTTON    "Add venue" (venues tab)
STEPS     1. Venues tab → Add venue.
EXPECTED  FULL-SCREEN POPUP over the Venues tab (long form: 8 fields and 17 ceremony checkboxes; nobody bookmarks it).
ACTUAL    A standalone page (venues/new/page.tsx) that leaves the tab, with Cancel → `/admin/venues`.
SHOTS     phase B: 375 px light + desktop
RULE      SHAPE
SEVERITY  look
SOURCE    CODE

#### D-31 · The Accounts skeleton draws a bordered table, but the default Users tab is a row list
PAGE      /admin/accounts
BUTTON    —
STEPS     1. Load /admin/accounts (Users).
EXPECTED  A skeleton with the page's shape: masthead, chip row, search, avatar rows.
ACTUAL    accounts/loading.tsx re-exports `TablePageSkeleton` (5-column bordered table). Users draws `PeopleFilterChips` and `TemplateRows` with no table.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §3 Loading
SEVERITY  look
SOURCE    CODE

#### D-32 · The People skeleton draws a table but none of the head numbers or group cards
PAGE      /admin/directory
BUTTON    —
STEPS     1. Load /admin/directory.
EXPECTED  The head-number strip, the group cards and the list.
ACTUAL    directory/loading.tsx is `TablePageSkeleton`. The page draws `TabLanding` (head numbers and cards) before the list.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §3 Loading
SEVERITY  look
SOURCE    CODE

**Group D notes**

- D-11 assumes PostgREST's 1,000-row limit, based on the repo's own notes (lib/vendor-earnings.ts, lib/admin/growth-stats.ts). The live max-rows setting was not checked. The Venues tab stats read (`venue_directory.select('venue_type')`, no paging) would cap the same way past 1,000 venues; the directory's current size is unknown.
- /admin/directory shows two page titles: `TabLanding`'s "People" masthead plus the mounted Users tab's "Users" masthead. This is not on the checklist.
- Outside my pages: the shared `ConfirmDialog` (app/_components/confirm-dialog.tsx) is a `<dialog>` used across the whole app (K3). That is the lead's call.
- The Users tab copy says "Reverse via the Blacklisted filter", and account-deletions says "Users → Blacklisted", but the filter chip is labelled "Blocked".
- The checkout is at 653100823, a progress-list commit on top of fb3f72d with no admin code changes, so findings hold for fb3f72d.

### Group E · Verify, fraud & disputes

#### E-1 · A settlement the database refused, or one that succeeded, is never shown to the admin
PAGE      /admin/disputes
BUTTON    "It did not arrive" / "The payment stands" / "Accept — waive the fee"
STEPS     1. Two admins open the same "The downpayment never reached me" row. 2. A settles it. 3. B then presses "It did not arrive".
EXPECTED  B is told it was already settled. A sees a success line.
ACTUAL    settleDepositDispute and settlePaymentDispute redirect to `?settled=already|no_dispute|ok`. page.tsx `Props.searchParams` has no `settled`, so the row just disappears. bookingFeeDispute `decide` redirects `?fee_dispute=already|no_dispute|not_admin|accepted|rejected`, but BookingFeeDisputesSection shows only `result === 'error'`.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B6 (a failure must render as a failure) · CLAUDE.md §5.4
SEVERITY  money-signin
SOURCE    CODE

#### E-2 · A resolved force-majeure flag can be re-resolved, overwriting the refund record
PAGE      /admin/force-majeure/[flagId]
BUTTON    "Apply Dismissed" (any "Resolve as" choice)
STEPS     1. Open a flag already resolved as "Refund issued". 2. The "Resolve as" list still shows. Open "Dismissed" and press Apply.
EXPECTED  A resolved flag is closed to re-resolution, like resolveDispute's `.eq('status', 'open')` guard.
ACTUAL    The `RecordSection label="Actions"` renders whatever `isResolved` is. force-majeure/actions.ts `resolveFlag` updates by `.eq('flag_id', flagId)` only. It overwrites `status` and `resolution_notes` (the refund amount and channel) and notifies the couple again.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 · design-and-wiring B6
SEVERITY  money-signin
SOURCE    CODE

#### E-3 · Booking fee dispute shows "Fee ₱0" and a confident "no chat / no save" when its reads fail
PAGE      /admin/disputes   (Booking fee disputes section)
BUTTON    "Accept — waive the fee" / "Reject — the fee stands"
STEPS     1. A dispute is under_review. 2. The booking_fee_charges, chat_threads or event_vendors read fails.
EXPECTED  "Couldn't read" for each failed read. The evidence does not lean toward a waiver.
ACTUAL    booking-fee-disputes-section.tsx only logs `chargesRes.error`. `peso(c?.amount_charged_centavos ?? null)` turns null into Number(null) = 0, so the row reads "Fee ₱0 · bill unknown". `threads`/`saves` errors are never read, so it says "No chat was started from Setnayan." and "No save from Find.". `shopsRes` error is unchecked, so names read "Unnamed shop".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 Honest states
SEVERITY  money-signin
SOURCE    CODE

#### E-4 · Dispute evidence silently disappears on a failed read
PAGE      /admin/disputes
BUTTON    "Reservation policy evidence" / "Delivery handover" / "receipt"
STEPS     1. Open the queue while the event_vendor_policy_acknowledgements or booking_handovers read is refused, or a receipt presign throws.
EXPECTED  "Couldn't read" on the row, as QuoteVersionsEvidence already says ("Couldn't read this supplier's quote versions").
ACTUAL    `fetchPolicyAcknowledgementsByVendor` and `fetchHandoversByVendor` use `const { data } =` and drop the error, so the forfeit evidence is just missing. payment-disputes-section.tsx has `catch { receiptByPayment.set(r.payment_id, null) }`, so the row says " · no receipt on file". page.tsx `[{ data: vendorData }, { data: openerData }]` drops errors, so rows read "Unnamed supplier" with TierChip "Free".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 Honest states
SEVERITY  money-signin
SOURCE    CODE

#### E-5 · A failed booking lookup makes a flag read "Whole event" and hides the deposit
PAGE      /admin/force-majeure/[flagId]
BUTTON    —
STEPS     1. Open a flag tied to a booking while the event_vendors, events or users lookup fails.
EXPECTED  Say the booking and deposit could not be read.
ACTUAL    `eventRes`, `vendorRes`, `coupleRes` and `handlerRes` errors are never read. With vendor null the page shows "Scope: Whole event" and drops the "Deposit" row (state and proof). Handler reads "Unassigned"; event and filed-by read "—". `depositProofDisplayUrl(...).catch(() => null)` also hides the receipt without saying so.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 Honest states
SEVERITY  money-signin
SOURCE    CODE

#### E-6 · Re-verification fee shows "Free" when the price read fails, and the fee chip uses a hand-made ₱ formatter
PAGE      /admin/verify   (tab: demoted; fee chip on every application card)
BUTTON    —
STEPS     1. Open ?status=demoted with a demoted shop listed. 2. The service_catalog read fails.
EXPECTED  "Couldn't read". Money formatted through lib/php.ts.
ACTUAL    lib/vendor-verification.ts `resolveApplicationFeeCentavos` returns 0 on error ("charging 0"), so DemotedVendorCard reads "Re-verification fee: Free". `feeLabelForCentavos` formats with `formatPhpCentavos`, a hand-made `₱${(centavos / 100).toLocaleString('en-PH'…)}`.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money · §5.4
SEVERITY  money-signin
SOURCE    CODE

#### E-7 · Peso amounts formatted by hand instead of lib/php.ts
PAGE      /admin/disputes · /admin/force-majeure/[flagId] · /admin/pax-changes
BUTTON    —
STEPS     1. Open any row that shows an amount.
EXPECTED  formatPhp / formatPhpRounded only.
ACTUAL    `peso` helpers in payment-, deposit- and booking-fee-disputes-section.tsx; page.tsx PolicyEvidence `₱${Math.round(p.downpayment_amount_php).toLocaleString('en-PH')}`; actions.ts settlePaymentDispute title `₱${Number(pay.amount_php ?? 0)…}`, which tells both parties "₱0" when the amount is missing; [flagId] change orders `toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })`; pax-changes/page.tsx `peso`.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money (lib/php.ts)
SEVERITY  money-signin
SOURCE    CODE

#### E-8 · "Download" sends a team-member admin to the public home page with no reason
PAGE      /admin/verification-docs
BUTTON    "Download" (and "Delete")
STEPS     1. Sign in as is_team_member (not is_internal). The admin layout lets them in through `isAdminProfile`. 2. Press Download.
EXPECTED  The page is hidden from people who can't use it, or the press says why it is refused.
ACTUAL    The local `requireAdmin` in verification-docs/actions.ts checks only `is_internal` and does `redirect('/')`. The signed-URL path is otherwise sound: gated first, minted server-side, 120 s, attachment.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B5 (a press reaches a real action or destination)
SEVERITY  broken
SOURCE    CODE

#### E-9 · Verify actions land on the wrong surface or tab
PAGE      /admin/verify   (tabs: visibility, in_review, ?shop=)
BUTTON    "Approve → Verified", "Archive", "Run deep search", "Read it again"
STEPS     1. Listing visibility, then Approve → Verified, then confirm. 2. Or: In review tab, then Run deep search.
EXPECTED  Come back to the same surface, tab or shop with the result.
ACTUAL    approveVendor and archiveVendor redirect to `/admin/verify?approved=1` / `?archived=1` (Applications › Pending). runVendorDeepSearchAction (`?deep_search=1`) and openApplicationDocument with intent=read (`?reread=1`) drop `status` and `shop`, so "the dossier is on the application card" points at a card not on screen. verifyVendorExperience sends `?exp_verified=1`, which FlashBanner never reads.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B6
SEVERITY  broken
SOURCE    CODE

#### E-10 · Three verify queues show "empty" copy when the read failed
PAGE      /admin/verify   (tabs: visibility, auto, demoted)
BUTTON    —
STEPS     1. Make the visibility read, the admin_audit_log auto-check read, or the demoted read fail.
EXPECTED  Only the "couldn't load" line.
ACTUAL    VisibilitySurface shows its FormFlash and then, because `vendors.length === 0`, "Queue is empty for this filter. Try widening the status.". The auto tab shows the `autoReadFailed` banner plus "No shop has been verified automatically yet.". The demoted tab's `const { data: demotedVendors }` drops the error and shows "No suppliers currently demoted."
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 Honest states
SEVERITY  wrong
SOURCE    CODE

#### E-11 · A storage failure still draws "Nothing here." on both shelves
PAGE      /admin/verification-docs
BUTTON    —
STEPS     1. The R2 listing fails.
EXPECTED  Only the TemplateFail.
ACTUAL    `buildVerificationDocsReportWith` leaves `objects = []`, so `verificationDocShelves` draws "Left over 0" and "In use 0", each with `TemplateEmpty` "Nothing here.". This sits under the fail line that says the page is "showing nothing rather than an empty list".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 Honest states
SEVERITY  wrong
SOURCE    CODE

#### E-12 · Wipe + ban request gives no sign it was opened; a second press crashes
PAGE      /admin/fraud
BUTTON    "Open two-admin wipe + ban request"
STEPS     1. Confirm fraud → wipe + ban, type the reason and the name, press. 2. Press again.
EXPECTED  The dialog closes with "sent — waiting for a second admin", and the card shows the request is pending.
ACTUAL    wipe-ban-dialog.tsx never calls `setOpen(false)` on success, and page.tsx never reads admin_approval_requests. The second press throws "A wipe + ban request for this supplier is already pending…", which lands on the admin crash page.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §3 Toast (success is a small toast)
SEVERITY  wrong
SOURCE    CODE

#### E-13 · Refusals arrive as the crash page instead of a plain reason
PAGE      /admin/disputes   (also /admin/fraud, /admin/force-majeure/[flagId], /admin/completions)
BUTTON    "Apply resolution" · "Un-suspend (keep watching)" · "Apply Refund issued" · "Keep review closed"
STEPS     1. Two admins resolve the same dispute. 2. The second one presses Apply resolution.
EXPECTED  A plain reason plus Try again, on the same screen.
ACTUAL    `resolveDispute` throws "Dispute already resolved (status: …). Refresh the page."; unsuspendVendor, resolveFlag and forceCompleteVendor/upholdNonDelivery throw the same way. Plain `<form action>` → app/admin/error.tsx "This surface crashed". A production build replaces the thrown message with a generic one.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §3 Toast (failure gives a plain reason + Try again)
SEVERITY  wrong
SOURCE    CODE

#### E-14 · Banned words on the dispute and fraud desks
PAGE      /admin/disputes · /admin/fraud · /admin/force-majeure/[flagId]
BUTTON    —
STEPS     1. Open each page with rows present.
EXPECTED  "reservation fee"; "supplier".
ACTUAL    deposit-disputes-section.tsx "“The downpayment never reached me”" and "No downpayment is in dispute."; page.tsx PolicyEvidence "• Downpayment … non-refundable" and "No-show forfeits the downpayment"; lib/fraud-detection.ts `FRAUD_SIGNAL_LABEL` "reviewed this vendor" and "this vendor is the only thing they touched"; [flagId] "Raised by {co.raised_by}" prints "Raised by vendor".
SHOTS     phase B: 375 px light
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### E-15 · Reject, Demote and Founders verification open as hand-made floating `<details>` popovers
PAGE      /admin/verify
BUTTON    "Reject…" · "Demote…" · "Founders verification…"
STEPS     1. Press Reject… on a pending card.
EXPECTED  The shared Sheet: half height on a phone, dimmed page behind.
ACTUAL    `<details className="relative">` with a form `absolute right-0 z-10 … shadow-lg`. Reject holds checkboxes plus a textarea; Founders holds a long paragraph plus a textarea in `w-80`.
SHOTS     phase B: 375 px light + desktop
RULE      HOUSE_DESIGN_STANDARD Part K3 · SHAPE
SEVERITY  look
SOURCE    CODE

#### E-16 · Wipe + ban is a hand-made modal
PAGE      /admin/fraud
BUTTON    "Confirm fraud → wipe + ban"
STEPS     1. Press it.
EXPECTED  The shared Sheet.
ACTUAL    wipe-ban-dialog.tsx builds its own `role="dialog" aria-modal="true"` inside `fixed inset-0 z-50` with OverlayBackdrop.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE

#### E-17 · Resolve forms open inline inside a wide table's last column
PAGE      /admin/disputes   (also /admin/completions)
BUTTON    "Resolve" · "Force-complete" · "Uphold non-delivery"
STEPS     1. On a phone, scroll the table sideways to the last column and open Resolve.
EXPECTED  SMALL POPUP (Sheet, 1–2 fields) opened from the row.
ACTUAL    `<details className="min-w-[12rem]">` / `min-w-[13rem]` with a pick or textarea plus a button, inside ConsoleTable `minWidth="72rem"` / `"60rem"`.
SHOTS     phase B: 375 px light
RULE      SHAPE
SEVERITY  look
SOURCE    CODE

#### E-18 · Loading skeletons draw shapes these pages never draw
PAGE      /admin/verify   (also /admin/completions, /admin/force-majeure/[flagId])
BUTTON    —
STEPS     1. Load each page on a slow connection.
EXPECTED  The skeleton draws only what the page draws.
ACTUAL    verify/loading.tsx uses `TablePageSkeleton` (search + sort toolbar and a 5-column table); the page draws pill tabs and cards. completions/loading.tsx draws that toolbar; the page has none. [flagId]/loading.tsx uses `DetailPageSkeleton`, a 2-column layout with a 320 px aside; the page is one 760 px column.
SHOTS     phase B: 375 px light + desktop
RULE      CLAUDE.md §3 Loading
SEVERITY  look
SOURCE    CODE

#### E-19 · Light-only colours and typed pixel sizes (58)
PAGE      /admin/verify
BUTTON    —
STEPS     1. Grep page.tsx and _components.
EXPECTED  Tokens and the `text-sn-*` scale.
ACTUAL    `text-[10px]` ×17, `text-[11px]` ×15 (incl. free-booking-match-note.tsx), `bg-white` ×8 (e.g. `bg-white/50` empty state), `shadow-lg` ×3, `bg-amber-50 … text-amber-700` "Duplicate reg #", `bg-rose-50 … text-rose-700` "linked acct".
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### E-20 · Light-only colours and typed pixel sizes (28)
PAGE      /admin/disputes
BUTTON    —
STEPS     1. Grep page.tsx and _components.
EXPECTED  Tokens and the `text-sn-*` scale.
ACTUAL    `text-[12px]` ×22 (page.tsx, quote-versions-evidence.tsx), `text-[13px]` ×4, `bg-ink … text-white` on "The payment stands" in payment- and deposit-disputes-section.tsx.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### E-21 · Light-only colours and typed pixel sizes (15)
PAGE      /admin/force-majeure   (and [flagId])
BUTTON    —
STEPS     1. Grep page.tsx, [flagId]/page.tsx and lib/force-majeure.ts.
EXPECTED  Tokens and the `text-sn-*` scale.
ACTUAL    `text-[12px]` ×9, `text-[14px]` ×2, `text-[24px]` (the record name), `text-[13px]`, `bg-violet-100 text-violet-800` (`FLAG_STATUS_TONE.mediation`).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### E-22 · Light-only colours and typed pixel sizes (8)
PAGE      /admin/fraud
BUTTON    —
STEPS     1. Grep page.tsx and wipe-ban-dialog.tsx.
EXPECTED  Tokens and the `text-sn-*` scale.
ACTUAL    `text-[11px]` ×4 (StateBadge, EvidenceChips), `text-[13px]` ×2, `bg-white` ×2 (wipe-ban-dialog.tsx textarea and input).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### E-23 · Light-only colours and typed pixel sizes (4)
PAGE      /admin/completions
BUTTON    —
STEPS     1. Grep page.tsx.
EXPECTED  Tokens and the `text-sn-*` scale.
ACTUAL    `bg-sky-100 text-sky-800` (`STATUS_TONE.vendor_marked`), `text-[12px]` "Off-platform", `text-[13px]` InfoTip label.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

**Group E notes**

- completions/actions.ts `openUpheldDispute`: a booking with no order (couple-to-supplier money is off-platform) fails the vendor_disputes `CHECK (payout_id OR order_id)`. The insert is only logged, so an upheld non-delivery may never count toward demotion, and the admin is not told. This is outside the checklist and not checked against prod.
- fraud/page.tsx: the banned card says "Appeal routed to the help center.", but `executeFraudWipeBan` opens the help ticket only `if (appealEmail)`.
- deposit-disputes-section.tsx signs receipts inside an uncaught `Promise.all`. If the presigner throws, the whole /admin/disputes page goes to the error boundary. Unsure whether the presigner can throw.
- Gate order is correct in every action on these pages, including `bookingFeeDispute` (app/_actions), which is the one action imported from outside app/admin: the admin check runs before any `createAdminClient()` use. Verify's `openApplicationDocument` re-derives the document key from the application and signs it server-side after the check.
- HEAD is 653100823, which is fb3f72d plus one commit that touches only build-sessions/final-check/area-8.md. App code is identical to fb3f72d.

### Group F · Watch desks & media

#### F-1 · Gift limit shows the built-in default as the live setting when its read fails
PAGE      /admin/gifts
BUTTON    "Save gift limit"
STEPS     1. The platform_settings read of gift_limit_pct is refused. 2. Open Gifts & comps.
EXPECTED  "Couldn't read" where the % sits, and no Save over a value nobody read.
ACTUAL    lib/gift-limit-settings.server.ts `getGiftLimitPct` catch → `GIFT_LIMIT_PCT_DEFAULT`. gifts/page.tsx prefills `GiftLimitForm` with it, and `ShopGiftsLedger`'s ⓘ states "capped at {giftLimitPct}%" as fact.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states (a default setting stated as fact)
SEVERITY  money-signin
SOURCE    CODE

#### F-2 · Peso amounts are formatted by hand on Gifts
PAGE      /admin/gifts
BUTTON    — (the "What's free" and "Services to make free" checkboxes, and the Active comp grants "Value" column)
STEPS     1. Open Gifts & comps. 2. Read the tier and service prices and the Value column.
EXPECTED  Every amount formatted through lib/php.ts `formatPhp` / `formatPhpRounded`.
ACTUAL    gifts/page.tsx has `₱{formatPeso(sku.price_php)}` and `₱{formatPeso(s.retail_price_php)}` (`formatPeso` = toLocaleString). The Value column uses lib/comp-grants.ts `formatRetailValueCentavos`, which returns `₱${pesos.toLocaleString(…)}`. badge-rewards-ledger.tsx `stateWords` types a literal "→ ₱0".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 money · brief §4
SEVERITY  money-signin
SOURCE    CODE

#### F-3 · A refused catalogue read empties the deal and free-window price pickers without saying so
PAGE      /admin/gifts   (Supplier cohort deals · Couple free windows)
BUTTON    "Create deal" / "Create free window"
STEPS     1. The vendor_billing_catalog or platform_retail_catalog_v2 read is refused. 2. Open Gifts & comps.
EXPECTED  "Couldn't read the catalogue" in the What's free / Services rows, and Create held back.
ACTUAL    lib/v2-catalog.ts `fetchV2VendorCatalog` and `fetchV2CustomerCatalog` return `[]` on error (`if (error || !data) return [];`). `tierSkus.map` and `customerCatalog.map` then draw no checkboxes and no notice. The Services column falls back to raw codes (`coupleTitleFor.get(code) ?? code`).
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  money-signin
SOURCE    CODE

#### F-4 · The price evidence chips format pesos by hand
PAGE      /admin/integrity-watch   (tab: prices)
BUTTON    —
STEPS     1. With the plausibility scanner on, open the Prices tab. 2. Read the evidence chips on a flag.
EXPECTED  Amounts via lib/php.ts `formatPhp` / `formatPhpRounded`.
ACTUAL    page.tsx `evidenceChips` has `const peso = (n) => \`₱${Math.round(n).toLocaleString('en-PH')}\``, used for "lock ₱…" and "below own median (₱…)".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 money · brief §4
SEVERITY  money-signin
SOURCE    CODE

#### F-5 · The "Live Watch channels" menu item opens a 404 while the Live Watch flag is off
PAGE      /admin/live-studio-channels
BUTTON    "Live Watch channels" (Switches & delivery › What ▾)
STEPS     1. Run with NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED off. 2. Open Switches & delivery and pick Live Watch channels.
EXPECTED  The view is hidden while the flag is off (the page's own comment says the nav entry is conditional).
ACTUAL    lib/admin/admin-pages.ts lists `v('live-watch', 'Live Watch channels', …)` unconditionally. The page calls `if (!liveStudioRoamEnabled()) notFound();`, so the whole /admin/switches?view=live-watch answers 404.
SHOTS     phase B: 375 px light
RULE      design-and-wiring A3 / B5 (every press reaches a real destination)
SEVERITY  broken
SOURCE    CODE

#### F-6 · Editorial unlock, resolve and re-scan ignore write failures, and a failed unlock still tells the couple "approved"
PAGE      /admin/editorial-review   (record page /admin/editorial-review/[editorialId])
BUTTON    "Unlock for couple — all red flags resolved" · "Mark OK — no change" · "Save rewrite" · "Re-scan editorial"
STEPS     1. Open a flagged editorial. 2. Press Unlock (or Mark OK) while the event_editorial update is refused.
EXPECTED  The failure is shown, and nothing is sent to the couple.
ACTUAL    [editorialId]/actions.ts: `unlockForCouple`, `resolveFlag` and `triggerRescan` run `await admin.from('event_editorial').update(…)` without reading `error`. `unlockForCouple` then sends `notifyCoupleEditorialDecision` "Your editorial is approved" anyway.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B6 (a failure must render as a failure) · brief: moderation actions show failures
SEVERITY  broken
SOURCE    CODE

#### F-7 · "Block uploader" can block nobody and still record "Uploader blocked"
PAGE      /admin/user-reports
BUTTON    "Block uploader"
STEPS     1. On an open photo or user report, press Block uploader. 2. The event_blocked_users upsert fails, or the photo is a seat photo with no guest_id.
EXPECTED  The failure is shown and the report stays open.
ACTUAL    actions.ts `resolveReport`: `await admin.from('event_blocked_users').upsert(…)` drops `error`, and a null `guestId` skips the block silently. The report is still stamped `ACTION_NOTE.block` "Uploader blocked (event-scoped)…" and status `actioned`.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B6 · brief: moderation actions show failures
SEVERITY  broken
SOURCE    CODE

#### F-8 · The Liveliness switches and Icon tile colours save but change nothing ("applies in the next update")
PAGE      /admin/colours
BUTTON    "Curved edge on the band" · "First frame overlaps the band" · "Press ring" · the Icon tiles colour fields
STEPS     1. Toggle a Liveliness switch or change a tile colour. 2. Press Save. 3. Look at any app screen.
EXPECTED  No pressable "not yet" control. (Band and Frames are not "next update": `.sn-band` and `.sn-frame` in globals.css already read their tokens.)
ACTUAL    lib/app-colours.ts `appColourTokens` emits no `touches`, and nothing in app/ reads `--sn-cat-*`. colours-editor.tsx tags them `NEXT_UPDATE` / "· applies in the next update", and gives Band and Frames the same stale tag.
SHOTS     phase B: 375 px light + desktop
RULE      design-and-wiring B5 (no pressable "coming soon")
SEVERITY  broken
SOURCE    CODE

#### F-9 · The Corrections page crashes when a shop name or error message contains "%"
PAGE      /admin/corrections
BUTTON    "Move the address"
STEPS     1. Move the address of a shop named e.g. "100% Events" (or hit a DB error whose text has %). 2. The action redirects with `?address_moved=` / `?error=`.
EXPECTED  A success or error notice.
ACTUAL    page.tsx runs `decodeURIComponent(search.address_moved)` and `decodeURIComponent(search.error)` on searchParams Next has already decoded. A bare "%" throws URIError, so the page fails right after a successful move.
SHOTS     phase B: 375 px light
RULE      brief severity: error on valid input
SEVERITY  broken
SOURCE    CODE

#### F-10 · A failed users read turns into "0 strikes", on screen and in the strike count it writes
PAGE      /admin/concierge-abuse   (tabs: queue, enforcement)
BUTTON    "Confirm abuse (+1 strike)" · "Lift enforcement (−1 strike)"
STEPS     1. The users read is refused. 2. Confirm abuse on a user who already has 3 strikes (full banned).
EXPECTED  The read error is shown; nothing is written from an unread count.
ACTUAL    actions.ts drops the error on `select('concierge_abuse_strike_count')` and uses `?? 0`, so Confirm writes 1 strike / 'warning' over a full ban and Lift writes 0 / 'none'. page.tsx `usersById` also drops its error: the queue shows "0 strikes · No enforcement" and "No matched accounts resolved."
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### F-11 · A raw enforcement code reaches the user's notification and the admin's notice
PAGE      /admin/concierge-abuse
BUTTON    "Confirm abuse (+1 strike)" · "Lift enforcement (−1 strike)"
STEPS     1. Confirm abuse on a flag. 2. Read the user's notification and the page notice.
EXPECTED  The worded level, e.g. "Trial banned" (`ENFORCEMENT_LEVEL_LABEL`).
ACTUAL    actions.ts sends the title `Account flagged for review (${newLevel})`, e.g. "(trial_banned)". page.tsx prints `Account enforcement level is now <strong>{search.confirmed}</strong>` and "New level: {search.lifted}" as raw keys.
SHOTS     phase B: 375 px light
RULE      brief §4 (words a person reads)
SEVERITY  wrong
SOURCE    CODE

#### F-12 · The enforcement desk calls itself read-only and retired, but its strike buttons are live, under three different names
PAGE      /admin/concierge-abuse
BUTTON    "Clear (false positive)" · "Confirm abuse (+1 strike)" · "Lift enforcement (−1 strike)"
STEPS     1. Open the page. 2. Read the masthead, the tab title and the ⓘ.
EXPECTED  One name, and a status line that matches what the buttons do.
ACTUAL    The masthead says "Today's Focus enforcement" (a retired SKU), metadata says "Setnayan AI enforcement · Admin", and the ⓘ "About the Concierge rule" says "Read-only — retired as a separate concept." Meanwhile all three forms write strikes and send notifications.
SHOTS     phase B: 375 px light
RULE      brief §4 · docs/brand.md (one word per thing)
SEVERITY  wrong
SOURCE    CODE

#### F-13 · Escalating an appeal closes it; no "two-admin queue" exists to receive it
PAGE      /admin/reviews
BUTTON    "Escalate"
STEPS     1. Escalate a pending self-review appeal. 2. Look for it in any queue.
EXPECTED  The appeal lands in a queue someone works, as the notice promises.
ACTUAL    actions.ts `escalateAppeal` sets `decided_at` + `decision: 'escalated'`. The page notice says "Appeal escalated to the two-admin queue." Nothing reads escalated appeals: lib/admin/queue-counts.ts counts `decided_at IS NULL` only, and the fake-flag ⓘ promises the same missing queue.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B6 (trace to the page that shows the result)
SEVERITY  wrong
SOURCE    CODE

#### F-14 · Reject or Escalate from a stale page overwrites an appeal that was already decided
PAGE      /admin/reviews
BUTTON    "Reject appeal" · "Escalate"
STEPS     1. Admin A override-publishes an appeal. 2. Admin B, on an older copy of the page, presses Reject.
EXPECTED  "Already decided", nothing changed.
ACTUAL    actions.ts `rejectAppeal` and `escalateAppeal` update with `.eq('appeal_id', appealId)` only (no `decided_at IS NULL` guard). The decision flips to rejected while the review stays live, and the reviewer is emailed "The original review will not be published."
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### F-15 · An escalated user report shows as "Resolved" and drops out of every view
PAGE      /admin/user-reports
BUTTON    "Escalate"
STEPS     1. Escalate an open report (including an RA 10173 "take my photo down"). 2. Look for it.
EXPECTED  It stays visible as escalated until a person settles it.
ACTUAL    actions.ts maps `escalate: 'actioned'`. The page shows "✓ Resolved" for every non-open row, and `STATUS_FILTERS` has no escalated view.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B6
SEVERITY  wrong
SOURCE    CODE

#### F-16 · A refused grants read shows every channel as "Not connected"
PAGE      /admin/live-studio-channels
BUTTON    "Connect"
STEPS     1. The live_studio_channel_grants read is refused. 2. Open the pool.
EXPECTED  "Couldn't read the connections".
ACTUAL    lib/live-studio-channel-grants.ts `fetchPoolChannelGrants` returns an empty Map on error. Every row then shows `grantSummary` "Not connected", the count line says "0 ready to claim", and each row offers a filled "Connect".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### F-17 · The "don't disconnect a checked-out channel" guard is skipped when its read fails
PAGE      /admin/live-studio-channels
BUTTON    "Disconnect"
STEPS     1. The status read fails. 2. Press Disconnect on a channel an event is holding.
EXPECTED  Refuse (fail closed).
ACTUAL    actions.ts `disconnectChannel`: `const { data: current } = await admin…select('status')` drops `error`. A null `current` skips the refusal, and `revokePoolChannelGrant` runs mid-event.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B6
SEVERITY  wrong
SOURCE    CODE

#### F-18 · OAuth error codes and raw status values are shown to the admin
PAGE      /admin/live-studio-channels
BUTTON    "Connect a Setnayan channel" / "Re-connect"
STEPS     1. Start a channel connect that fails (state expired, exchange failed, not configured). 2. Read the red notice and a channel's status line.
EXPECTED  Plain words.
ACTUAL    app/api/oauth/youtube/pool/start and the callback redirect with `error=exchange_failed`, `no_refresh_token`, `not_configured:…`, `state_failed:<db text>`. page.tsx prints `{flashError}` verbatim. `statusLine` prints `${row.status}`, e.g. "checked_out".
SHOTS     phase B: 375 px light
RULE      brief §4
SEVERITY  wrong
SOURCE    CODE

#### F-19 · Failed reads show "No QR flags" and "No shop holds an allowance"
PAGE      /admin/repost-watch
BUTTON    "Scan QR codes" · "Allow"
STEPS     1. The vendor_qr_media_flags or card_claim_word_allowances read is refused. 2. Open the page.
EXPECTED  "Couldn't read" in place of the empty line.
ACTUAL    page.tsx shows the `qrError` FormFlash and then still renders `qrRows.length === 0 ? <TemplateEmpty>No QR flags…`. card-checks-admin.tsx logs `allowRes.error` and renders "No shop holds an allowance." A `shopsRes` error hides the Allow form silently.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### F-20 · A refused editorial read shows as "not found"
PAGE      /admin/editorial-review   (record page /admin/editorial-review/[editorialId])
BUTTON    a queue row (TemplateRow href)
STEPS     1. Open a record while the event_editorial read is refused.
EXPECTED  "Couldn't read this editorial".
ACTUAL    [editorialId]/page.tsx: `const { data: row } = await admin…maybeSingle(); if (!row) notFound();` drops `error`.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### F-21 · Storage totals can be quietly cut off at the database's row limit and still shown as measured
PAGE      /admin/papic-storage
BUTTON    —
STEPS     1. Let papic_photos or papic_guest_captures hold more than 1,000 rows. 2. Open the page.
EXPECTED  The totals are paged to the end or marked as a lower bound.
ACTUAL    page.tsx reads each table once with `.limit(ROW_CAP)` (200,000) and no paging. The server's row cap (1,000 per lib/vendor-earnings.ts) returns `error: null`, and the `capped` warning fires only at `ROW_CAP * 2`. The ratio, GB and per-event numbers then show as fact. unsure: the cap is a project setting, not in the repo.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 (the measurement must reach the render)
SEVERITY  wrong
SOURCE    CODE

#### F-22 · "Made 2 copys"
PAGE      /admin/papic-storage
BUTTON    "Fill in missing Memory lane copies"
STEPS     1. Press it with 2+ photos to fill.
EXPECTED  "Made 2 copies".
ACTUAL    backfill-tiles-button.tsx renders `copy{result.filled === 1 ? '' : 's'}`.
SHOTS     phase B: 375 px light
RULE      brief §4
SEVERITY  wrong
SOURCE    CODE

#### F-23 · A failed supplier or user search says "No suppliers match"
PAGE      /admin/gifts
BUTTON    "Search"
STEPS     1. Search suppliers or users while the read is refused.
EXPECTED  "Couldn't search".
ACTUAL    page.tsx: `const { data } = await admin.from('vendor_profiles')…ilike(…)` and the matching users `.or(…)` read drop `error`, then render "No suppliers match “x”." / "No user matches “x”." A refused `grant_vendor` / `grant_user` read leaves the grant panel missing with no notice.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### F-24 · A refused open-count read hides the tab badge, which looks the same as "none open"
PAGE      /admin/integrity-watch   (tabs: reviews, listings, inquiries, prices)
BUTTON    the Reviews / Listings / Inquiries / Prices tabs
STEPS     1. A count read is refused. 2. Look at the tabs.
EXPECTED  "—" on that tab.
ACTUAL    page.tsx `const { count: openReviews } = await admin…` (and `openListings`, `openInquiries`, `openPrices`) drops `error`, and `{openReviews ? \` · ${openReviews}\` : ''}` hides the badge.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### F-25 · "Reset to current" replaces the live colour set at once, though it reads like "discard my draft"
PAGE      /admin/colours
BUTTON    "Reset to current"
STEPS     1. With a custom set saved, change a colour. 2. Press Reset to current to undo the change.
EXPECTED  A discard of the draft, or a clear label and confirm for an app-wide revert.
ACTUAL    colours-editor.tsx posts `op=reset`. actions.ts `saveAppColours` → `writeColours(userId, null, …)` saves NULL straight away, so every screen goes back to the code defaults and the saved custom set is gone.
SHOTS     phase B: 375 px light
RULE      brief §4 (words match the action)
SEVERITY  wrong
SOURCE    CODE

#### F-26 · Two brand buttons in the supplier grant frame
PAGE      /admin/gifts
BUTTON    "Set tier" + "Comp Papic Challenges"
STEPS     1. Search a supplier and press Comp this supplier.
EXPECTED  One main button per frame; others neutral.
ACTUAL    page.tsx: "Set tier" is `actionButtonClass('brand', { main: true })`, and "Comp Papic Challenges" is `actionButtonClass('brand')` (accent-outlined) in the same `FRAME`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### F-27 · Two filled accent buttons on one screen
PAGE      /admin/papic-storage
BUTTON    "Fill in missing Memory lane copies" + "Make small copies of old photos"
STEPS     1. Open the page while there are oversized covers.
EXPECTED  At most one main button.
ACTUAL    backfill-tiles-button.tsx and old-photos-button.tsx both draw raw `<button>`s with `bg-[var(--sn-accent)] … text-[var(--sn-on-accent)]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### F-28 · A second green button next to the green main button
PAGE      /admin/editorial-review   (record page)
BUTTON    "Unlock for couple — all red flags resolved" + "Mark OK — no change"
STEPS     1. Open an editorial whose red flags are resolved but grammar flags are still pending.
EXPECTED  The second button is neutral.
ACTUAL    [editorialId]/page.tsx: Unlock is `actionButtonClass('ok', { main: true })`, and each pending `FlagCard`'s Mark OK is `actionButtonClass('ok')`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### F-29 · The "Use #…" fix buttons share Save's green
PAGE      /admin/colours
BUTTON    "Save" + "Use #xxxxxx"
STEPS     1. Pick an unreadable colour so a fix button appears.
EXPECTED  The fix buttons are neutral.
ACTUAL    colours-editor.tsx: Save is `ActionButton tone="ok" main`, and `CheckLine`'s fix is `ActionButton tone="ok"`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### F-30 · The "● Vulgar" chip is white text on a pale pink background
PAGE      /admin/editorial-review   (record page)
BUTTON    —
STEPS     1. Open an editorial with a red flag.
EXPECTED  A readable chip.
ACTUAL    [editorialId]/page.tsx `FlagCard`: `bg-[var(--sn-danger-soft)] text-white`, where `--sn-danger-soft` is #F3E1DC in light mode.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-31 · Hard-coded light-only sizes and colours
PAGE      /admin/integrity-watch
BUTTON    —
STEPS     1. Open the page.
EXPECTED  Tokens only.
ACTUAL    7 lines in page.tsx: `text-[12px]`×5, `text-[13px]`, `text-[14px]`, and `bg-white/70` + `rounded-[var(--m-r-md)]` on the note input.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-32 · Hard-coded light-only sizes and colours
PAGE      /admin/repost-watch
BUTTON    —
STEPS     1. Open the page.
EXPECTED  Tokens only.
ACTUAL    16 lines in page.tsx: `text-[12px]`×10, `text-[13px]`×4, and `bg-white/70` on both note inputs.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-33 · Hard-coded type sizes
PAGE      /admin/chat-flags
BUTTON    —
STEPS     1. Open the page.
EXPECTED  `text-sn-*`.
ACTUAL    5 lines in page.tsx: `text-[12px]`×3 (status, category and id chips) and `text-[13px]`×2 (InfoTip labels).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-34 · Hard-coded light-only sizes and colours
PAGE      /admin/concierge-abuse
BUTTON    —
STEPS     1. Open the page.
EXPECTED  Tokens only.
ACTUAL    12 lines in page.tsx: `bg-white/70` on 3 textareas, `text-[24px]` and `style={{ color: \`rgb(var(--color-${tone}))\` }}` in `Metric`, `text-[15px]`, `text-[12px]`, and hand-made banners `border-success-300/60 bg-success-50`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-35 · Hard-coded light-only colours and hand-rolled buttons
PAGE      /admin/user-reports
BUTTON    "Hide content" · "Block uploader" · "Escalate" · "Dismiss"
STEPS     1. Open the page.
EXPECTED  Tokens and `ActionButton`.
ACTUAL    15 lines in page.tsx: `bg-white/70`×5 (hand-rolled SubmitButton classes and the empty state), `text-[12px]`×8, `text-[13px]`×2, and `bg-warn-50` on Escalate.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-36 · Hard-coded light-only sizes and colours
PAGE      /admin/reviews
BUTTON    —
STEPS     1. Open the page.
EXPECTED  Tokens only.
ACTUAL    7 lines in page.tsx: `bg-white/60` (Supplier reason box), `text-[12px]`×4, `text-[13px]`×2, `min-h-[60px]`, and hand-made `rounded-lg border border-warn-200 bg-warn-50/60` frames.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-37 · Hard-coded sizes and colours
PAGE      /admin/corrections
BUTTON    —
STEPS     1. Open the page.
EXPECTED  Tokens only.
ACTUAL    4 lines in page.tsx: `style={{ color: 'rgb(var(--color-warn))' }}` (held name), `text-[13px]`×2, `text-[15px]`, and `text-[12px]` on the status chip.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-38 · Tailwind palette colours in place of tokens
PAGE      /admin/editorial-review   (queue + record page)
BUTTON    —
STEPS     1. Open the queue and a record.
EXPECTED  Tokens only.
ACTUAL    13 lines. page.tsx `statusMap`: `text-green-600`, `text-yellow-600`. [editorialId]/page.tsx `StatusBadge`: `bg-gray-100 text-gray-600`, `bg-green-100 text-green-700`, `bg-yellow-100`. `FlagCard`: `bg-yellow-500 text-white`, `text-green-900`, `text-[24px]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-39 · Hard-coded type sizes and hand-rolled buttons
PAGE      /admin/live-studio-channels
BUTTON    "Connect" · "Release" · "Disconnect" · "Save"
STEPS     1. Open the page.
EXPECTED  `text-sn-*` and `ActionButton`.
ACTUAL    7 lines in page.tsx: `text-[14px]`×3, `text-[15px]`×2, `text-[13px]`×2. Buttons are local `PRESS`/`BTN_*` class strings (e.g. `BTN_BRAND = … bg-[var(--sn-accent)]`), not `ActionButton`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-40 · Hard-coded type sizes
PAGE      /admin/papic-storage
BUTTON    —
STEPS     1. Open the page.
EXPECTED  `text-sn-*`.
ACTUAL    9 lines: `text-[13px]` (old-photos-button.tsx ×3, backfill-tiles-button.tsx ×3, page.tsx) and `text-[15px]` (page.tsx, backfill-tiles-button.tsx).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-41 · Tailwind palette colours and hard-coded sizes
PAGE      /admin/gifts
BUTTON    —
STEPS     1. Open the page with `?createError=` or `?error=`.
EXPECTED  Tokens only.
ACTUAL    17 lines: `border-rose-200 bg-rose-50 … text-rose-900` (error banners), `style={{ color: 'rgb(var(--color-warn))' }}` / `rgb(var(--color-success))`, `text-[11px]`×4, `text-[14px]`×4, and `w-[200px]` (page.tsx); `text-[13px]` in shop-gifts-ledger.tsx and gift-limit-form.tsx.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### F-42 · Hard-coded colours and sizes in the editor chrome (not counting the preview swatches)
PAGE      /admin/colours
BUTTON    the mood cards
STEPS     1. Open the page.
EXPECTED  Tokens only, outside the swatches that show the draft.
ACTUAL    17 lines in colours-editor.tsx: mood card `bg-white shadow-[0_-4px_12px_-6px_rgba(0,0,0,0.3)]`, `border-black/5`, `border-black/10`, `text-[12px]`×10, `text-[13px]`×4. Plus `text-[26px]` and `text-[12px]` in colours-sample.tsx.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

**Group F notes**

- The own loading files `app/admin/concierge-abuse/loading.tsx` (`TablePageSkeleton`: a search toolbar and a bordered 5-column table the page never draws) and `app/admin/reviews/loading.tsx` never show. Middleware `adminMergedForward` sends both addresses to /admin/work?view=… (307) before they render, so they are dead files.
- The Apply / Decline confirm on /admin/corrections (`ConfirmForm` → `app/_components/confirm-dialog.tsx`) is a native `<dialog>`, not the shared `Sheet`. It is a shared component, so I did not judge it per page.
- Outside my pages: `lib/v2-catalog.ts` `fetchV2VendorCatalog` / `fetchV2CustomerCatalog` turn a refused read into `[]` for every caller, and `lib/comp-grants.ts` `formatRetailValueCentavos` hand-formats ₱ on the per-user comp pages too.
- F-21 depends on the project's PostgREST max-rows, which is not in the repo. `lib/vendor-earnings.ts` says it is 1,000.
- F-4 and the Prices tab only render while `plausibilityScannerEnabled()` is on. Checked in code only.

### Group G · Studio & media

#### G-1 · The referral reward has no setter, but the copy says "set the reward below"
PAGE      /admin/studio   (tab: referrals → /admin/offers?view=referrals)
BUTTON    —
STEPS     1. Open the Referrals view. 2. Read the switch's help line, then look under "Reward per side".
EXPECTED  A control that sets the reward amount, or a door to the page that sets it.
ACTUAL    `referrals-surface.tsx` says "Turn it on to run the program — then set the reward below", but "Reward per side" only displays it. Nothing in app/ writes `referral_reward_php`; only `app/admin/switches/page.tsx` and `lib/referrals.ts` read it.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B5/B6 (every press reaches a real action) · money read from platform_settings
SEVERITY  money-signin
SOURCE    CODE

#### G-2 · Pesos are formatted by hand on Discount codes and Referrals
PAGE      /admin/studio   (tab: discount-codes, referrals)
BUTTON    —
STEPS     1. Open Discount codes and look at a capped code ("50% up to …"). 2. Open Referrals and look at "Reward per side".
EXPECTED  Money formatted through `lib/php.ts` (`formatCentavosPhp` / `formatPhp`).
ACTUAL    `discount-codes-surface.tsx` `formatPesos` uses its own `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' … })`. `referrals-surface.tsx` uses `` `₱${rewardPhp.toLocaleString('en-PH')}` `` in two places (the tile and the InfoTip).
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money · checklist 4 (money format)
SEVERITY  money-signin
SOURCE    CODE

#### G-3 · On Journal Spotlights, failed reads show as empty, "not for sale" or "no approval pending"
PAGE      /admin/studio   (tab: journal-spotlights)
BUTTON    "Start 2-admin approval"
STEPS     1. Make the spotlights, `service_catalog` or `admin_approval_requests` read fail. 2. Open the tab.
EXPECTED  "Couldn't read" for each read that failed.
ACTUAL    `fetchAllSpotlightsForAdmin` returns `[]` on error, which shows "No drafts…" and "Nothing published yet." `fetchSponsoredSlotPrice` returns null, so the banner states the SKU "is inactive in the pricing catalog". `pendingRes.data ?? []` drops the error, so a sponsored draft waiting for a second admin offers "Start 2-admin approval" again.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 Honest states
SEVERITY  money-signin
SOURCE    CODE

#### G-4 · Any signed-in account can upload into the homepage background-video folder
PAGE      /admin/background-videos
BUTTON    "Upload video"
STEPS     1. Signed in as any couple or supplier, POST /api/upload with `{ bucket: 'media', pathPrefix: 'homepage-bg/slot-0', … }`.
EXPECTED  An admin check on the server for the site's own `homepage-bg/` folder, the same way `hub-music/` gets one.
ACTUAL    `app/api/upload/route.ts` runs an admin test (`hubMusicUploadRule` + `isAdminProfile`) only for `hub-music/`. `homepage-bg/…` has no id segment, so `tenancyForPathPrefix` returns null and the presign is granted. Publishing a slot is still gated in `saveBackgroundVideo`; the stray files then show up as left-over files on /admin/website-media.
SHOTS     —
RULE      checklist 2(b): API routes an admin page calls must check admin on the server
SEVERITY  money-signin
SOURCE    CODE
PHASE B   **CONFIRMED on the copy, 25 Nov ~07:50 UTC.** Signed in as the shared non-admin `messy-one`, from an ordinary page, `POST /api/upload` with `{ bucket: 'media', pathPrefix: 'homepage-bg/slot-0', contentType: 'video/mp4' }` → **200** with an `uploadUrl` and an object key under `homepage-bg/slot-0/`. The same call for `hub-music/x` → **403** "That upload location isn't allowed." So the admin test exists for hub music and is missing for the homepage videos. Only the presign was asked for: **no bytes were PUT, nothing was created.**

#### G-5 · "Open couple page ↗" goes to /{public_id}, which is not an Event Hub address
PAGE      /admin/studio   (tab: reveal-studio)
BUTTON    "Open couple page ↗"
STEPS     1. With a Save-the-Date video waiting for review, press "Open couple page ↗".
EXPECTED  The couple's Event Hub (`publicEventPath(slug)`).
ACTUAL    `std-video-moderation.tsx` builds `` href={`/${row.publicId}`} ``. `/[slug]` finds events by `slug` (`theOneEventRead` `.ilike('slug', …)`, `event_public_stamp`), and slugs come from the display name (`generateUniqueSlug`). The link therefore 404s.
SHOTS     phase B: 375 px light
RULE      checklist 1 (dead link)
SEVERITY  broken
SOURCE    CODE

#### G-6 · The "Show the reveal on couple sites" switch saves a value nothing reads
PAGE      /admin/studio   (tab: reveal-studio)
BUTTON    "Show the reveal on couple sites"
STEPS     1. Flip the switch. 2. Press "Save — make it live". 3. Open any Event Hub.
EXPECTED  The switch changes something, or it is removed.
ACTUAL    `studio.tsx` writes `draft.enabled`. Its own hint says it "No longer switches the reveal on", and `lib/reveal-access.ts` / `reveal-overlay.tsx` say `config.enabled` "is NOT an input". No reader of `fetchRevealConfig()` uses `.enabled`.
SHOTS     phase B: 375 px light
RULE      design-and-wiring B5 (no control that does nothing)
SEVERITY  broken
SOURCE    CODE

#### G-7 · On a phone, homepage widgets cannot be reordered
PAGE      /admin/studio   (tab: website)
BUTTON    "↑" / "↓" (aria "Move … up/down")
STEPS     1. At 375 px, open the Website editor. 2. Try to reorder a widget.
EXPECTED  The Move buttons, which the file's own docblock promises for touch users.
ACTUAL    `app/admin/website/widget-list.tsx` wraps the Move pair in `hidden flex-col gap-1 sm:flex`, so below 640 px only HTML5 `draggable` is left. Phase B should confirm that touch drag does nothing.
SHOTS     phase B: 375 px light
RULE      checklist 1
SEVERITY  broken
SOURCE    CODE

#### G-8 · When the Reveal Studio read fails, the locked defaults are shown as the live house settings
PAGE      /admin/studio   (tab: reveal-studio)
BUTTON    "Save — make it live"
STEPS     1. Make the `reveal_studio_config` read fail. 2. Open the tab.
EXPECTED  "Couldn't read", with the editor withheld.
ACTUAL    `fetchRevealConfig` (`lib/reveal-config.ts`) has `catch { return DEFAULT_REVEAL_CONFIG; }`, and `RevealStudio initial={config}` draws those defaults as fact. Pressing "Save — make it live" would overwrite the real house config.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 Honest states (a default stated as fact)
SEVERITY  wrong
SOURCE    CODE

#### G-9 · When the Spotlight Awards read fails, it shows "No awards for this month yet" and zeroes
PAGE      /admin/studio   (tab: spotlight-awards → /admin/offers?view=badges)
BUTTON    —
STEPS     1. Make the `vendor_spotlight_awards` read fail. 2. Open the view.
EXPECTED  "Couldn't read".
ACTUAL    `fetchSpotlightAwards` (`lib/spotlight-awards.ts`) does `console.error` then `return []`. The surface then shows "Total awards 0 · Auto-picked 0 · Featured 0" (its local `Stat value: number`) and the empty state.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4
SEVERITY  wrong
SOURCE    CODE

#### G-10 · Moodboard colour tags look empty when their read fails, and "Save tags" then deletes them
PAGE      /admin/studio   (tab: moodboard-library)
BUTTON    "Save tags"
STEPS     1. Make the `moodboard_asset_color_ranges` read fail. 2. Open an asset. 3. Press "Save tags".
EXPECTED  "Couldn't read" for the tags, and no save over an unread state.
ACTUAL    `moodboard-library-surface.tsx` does `const { data: ranges } = await admin.from('moodboard_asset_color_ranges')` and drops the error, so every asset shows no tags. `saveColorRanges` deletes all existing ranges and inserts the current ones, so saving wipes the real tags.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4
SEVERITY  wrong
SOURCE    CODE

#### G-11 · Social queue: a failed evergreen read says "No evergreen items yet", and the autopilot form saves defaults
PAGE      /admin/studio   (tab: social-queue)
BUTTON    "Save" (Autopilot)
STEPS     1. Make the `social_evergreen_items` read fail, or the `social_publish_settings` read fail. 2. Open the tab.
EXPECTED  "Couldn't read", and the settings form withheld (as on Referrals).
ACTUAL    `evergreenErr` is only logged. "Evergreen library · 0" and "No evergreen items yet — add a few…" render, and it is the only section not wrapped in `QueueSection loadFailed`. When settings fail to load, `AutopilotStrip` still draws the checkbox form over the hard-coded defaults ("(defaults shown)"), and "Save" would write them.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4
SEVERITY  wrong
SOURCE    CODE

#### G-12 · When the background-videos read fails, the page shows an empty editor with no message
PAGE      /admin/background-videos   (also studio tab: background-videos)
BUTTON    —
STEPS     1. Make the `homepage_background_videos` read fail. 2. Open the page.
EXPECTED  "Couldn't read".
ACTUAL    `fetchRows` in `lib/background-videos.ts` does `const { data } = …; return (data …) ?? []` and drops the error. `BackgroundVideosManager` then draws no main card and an empty "Bottom pillar icons (5)" grid.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4
SEVERITY  wrong
SOURCE    CODE

#### G-13 · "Journal" is used where people should read "Articles"
PAGE      /admin/studio   (tab: journal-spotlights)
BUTTON    "Journal Spotlights" (rail tab)
STEPS     1. Open the Studio rail or picker. 2. Open the tab.
EXPECTED  Articles (e.g. "Article spotlights", "Article").
ACTUAL    The rail label `'Journal Spotlights'` in `studio/page.tsx` `RAIL`. The picker label `v('journal-spotlights', 'Journal Spotlights', …)` in `lib/admin/admin-pages.ts`. The masthead `title="Journal Spotlights"`, the field label "Journal article" and the InfoTip "Pick a Journal article", all in `journal-spotlights-surface.tsx`.
SHOTS     phase B: 375 px light
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### G-14 · Reveal Studio calls the couple's Event Hub a "couple site"
PAGE      /admin/studio   (tab: reveal-studio)
BUTTON    "Show the reveal on couple sites"
STEPS     1. Open the tab and read the InfoTip, the switch and the save message.
EXPECTED  Event Hub.
ACTUAL    `reveal-studio-surface.tsx` InfoTip: "every Save-the-Date couple site… go live on couple sites". `studio.tsx`: the switch "Show the reveal on couple sites" and the save message "Saved — live on couple sites."
SHOTS     phase B: 375 px light
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### G-15 · The social queue shows "Monogram" and can show "vendor"
PAGE      /admin/studio   (tab: social-queue)
BUTTON    —
STEPS     1. Look at a monogram consent under Take-downs or "Couple creations — ready to post". 2. Look at a verified supplier with no services under "New verified suppliers".
EXPECTED  Logo Maker / logo, and supplier.
ACTUAL    `SHARE_ARTIFACT_LABEL.monogram = 'Monogram'` (`lib/social-sharing.ts`) is rendered in card headers, and the image has `alt="Couple monogram"`. The fallback `: 'vendor'` in `social-queue-surface.tsx` renders "A new vendor in …" and goes into the public `vendorFeatureCaption`.
SHOTS     phase B: 375 px light
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### G-16 · The Music Maker delivery copy says "couple's site"
PAGE      /admin/pakanta
BUTTON    "Finished song file"
STEPS     1. On an active row, read the upload help line. 2. Deliver a song.
EXPECTED  Event Hub, as the next line of the same file already says.
ACTUAL    In `pakanta-deliver.tsx`, the help text says "It auto-plays on the couple's site once delivered…", and the success line says "Delivered and now playing on the couple’s site."
SHOTS     phase B: 375 px light
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### G-17 · Several Studio tabs have more than one main (filled) button on one screen
PAGE      /admin/studio   (tabs: moodboard-library, songs, spotlight-awards, social-queue, reveal-studio)
BUTTON    see ACTUAL
STEPS     1. Open each tab.
EXPECTED  One main button per screen, sheet or card.
ACTUAL    Moodboard: "Generate random prompt", "Upload + tag", "Save tags", "Save sample to slot N" (all `tone="brand" main`) and "Reject with this reason" (`danger main`, not in a confirm sheet). Songs: "Merge" and "Search" (both `.button-primary`). Spotlight: "Run now" and "Add award" (both brand `main`). Social queue `ScheduledPostCard`: "Save copy" and "Post now" in one card. Reveal: "Save — make it live", plus the selected speed and preview pills filled in the same `ACCENT`.
SHOTS     phase B: 375 px light + desktop
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### G-18 · Studio tabs use browser confirm and alert boxes
PAGE      /admin/studio   (tabs: songs, spotlight-awards)
BUTTON    "Delete {song}" (trash) · "Merge" · "Remove award"
STEPS     1. Delete a song, merge two songs, or remove an award.
EXPECTED  The shared Sheet / ConfirmForm.
ACTUAL    `songs-danger-controls.tsx` uses `window.confirm(` (DeleteSongButton, MergeSongsFields) and `window.alert('Those are the same song…')`. `spotlight-awards/_components/spotlight-actions.tsx` uses `window.confirm('Remove this award?')`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE

#### G-19 · Reveal Studio uses a native select with 10 options
PAGE      /admin/studio   (tab: reveal-studio)
BUTTON    "Default template"
STEPS     1. Open the Default template dropdown.
EXPECTED  PickMenu (FieldPick).
ACTUAL    1 native `<select>` in `reveal-studio/studio.tsx`, one option per `REVEAL_TEMPLATE_IDS` (10).
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD D2 (PickMenu) · K3
SEVERITY  look
SOURCE    CODE

#### G-20 · Studio tabs have about 183 hard-coded colour, size and shadow values
PAGE      /admin/studio
BUTTON    —
STEPS     1. Switch the theme to dark (once admin is on DARK_READY).
EXPECTED  Colour tokens by job and the `text-sn-*` sizes.
ACTUAL    About 183 hits outside comments, including:
          - `reveal-studio/studio.tsx`: `background: '#0e0e10'`, `from-[#1c1c20] to-[#0b0b0c]`, `rounded-[2rem] … shadow-xl`, `color: '#b23b3b'`
          - `real-stories-surface.tsx` INPUT/BTN_SECONDARY `bg-white`; `social-queue-surface.tsx` `bg-sky-100 text-sky-800` and `bg-white/70`
          - about 130 `text-[11–13px]`
SHOTS     phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### G-21 · Studio's own loading.tsx draws a form the page never draws
PAGE      /admin/studio
BUTTON    —
STEPS     1. Open /admin/studio (or any `?tab=`) on a slow connection.
EXPECTED  A skeleton of the rail plus a list, matching the page.
ACTUAL    `studio/loading.tsx` re-exports `FormPageSkeleton`: a max-w-2xl framed card with 6 label/input pairs and a button. It has no nav rail. The default Website tab is a list of widget rows.
SHOTS     phase B: 375 px light + desktop
RULE      CLAUDE.md §3 Loading (the skeleton draws only what the page draws)
SEVERITY  look
SOURCE    CODE

#### G-22 · Deleting a single file asks with a browser confirm box
PAGE      /admin/website-media   (also studio tab: website-media)
BUTTON    "Delete" (row)
STEPS     1. Press Delete on a left-over file.
EXPECTED  The shared Sheet / ConfirmForm.
ACTUAL    `media-table.tsx` `handleDelete` calls `window.confirm(\`Delete this file permanently?…`)`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE

#### G-23 · Website media has about 73 Tailwind palette classes and typed sizes
PAGE      /admin/website-media
BUTTON    —
STEPS     1. View the page in dark.
EXPECTED  Tokens by job.
ACTUAL    About 73 hits: `page.tsx` `border-amber-200 bg-amber-50 … text-amber-900` and `border-slate-200 bg-slate-50 … text-slate-700`; `clear-folder-button.tsx` `bg-red-600 … text-white` and `bg-white … text-slate-900`; `media-table.tsx` `bg-red-50 text-red-800`; plus `text-[12–16px]`.
SHOTS     phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### G-24 · Removing a track opens a browser confirm on top of the Edit sheet
PAGE      /admin/hub-music   (also studio tab: hub-music)
BUTTON    Remove (in the track sheet)
STEPS     1. Tap a track title to open its Sheet. 2. Press Remove.
EXPECTED  One layer: a confirm inside the sheet, or the shared confirm.
ACTUAL    `hub-music-manager.tsx` `remove()` calls `window.confirm(\`Remove “…” from Event Hub music?…`)` while the `Sheet` (`EditTrack`) is open, so one popup sits on top of another.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K3 · SHAPE (no popup on a popup)
SEVERITY  look
SOURCE    CODE

#### G-25 · Background videos uses 12 typed pixel sizes
PAGE      /admin/background-videos
BUTTON    —
STEPS     1. View the page.
EXPECTED  The `text-sn-*` scale.
ACTUAL    In `background-videos-manager.tsx`, 8 `text-[12px]` and 4 `text-[13px]` (e.g. the "Upload video" label and "Main · slot 1"), plus `bg-black`/`text-white/50` on the video frame.
SHOTS     phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 type
SEVERITY  look
SOURCE    CODE

#### G-26 · Music Maker queue uses typed pixel sizes
PAGE      /admin/pakanta
BUTTON    —
STEPS     1. View the page.
EXPECTED  The `text-sn-*` scale.
ACTUAL    5 hits: `page.tsx` has `text-[15px]` (couple names) and `text-[13px]` (InfoTip labels); `pakanta-deliver.tsx` has `text-[13px]` ("Deliver finished song").
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 type
SEVERITY  look
SOURCE    CODE

**Group G notes**

- Outside my pages: `app/admin/discount-codes/_components/voucher-form.tsx` (behind discount-codes/new and [id]/edit) formats pesos by hand (`₱{formatPeso(...)}` via `toLocaleString`) and types peso example amounts in its "Maximum discount (₱)" help ("₱500 cap on a ₱2,000 service"). /admin/discount-codes/new is also a candidate for a FULL-SCREEN POPUP.
- Outside my pages: `app/admin/switches/page.tsx` also builds `` `₱${s.referral_reward_php.toLocaleString('en-PH')}` `` by hand.
- On Real Stories and Storytellers, the "migration missing" panel tells an admin to run `supabase db push --db-url "$SUPABASE_DB_URL"` by hand, which CLAUDE.md §5.5 forbids. It only shows when that migration is missing.
- Unsure, not reported: the Referrals KPI tiles (cap 500) and the Patiktok status chips (cap 60) count only the most recent rows but read as totals. I did not test G-7's touch drag on a real phone.
- The checkout is on 653100823, which is fb3f72d plus one progress-list commit; there is no diff under `apps/web/app/admin`.

### Group H · App performance & Ugat

#### H-1 · A failed sales read shows ₱0 and flat bars under a "Live" pill
PAGE      /admin/app-performance   (tab: overview, also the bare address)
BUTTON    —
STEPS     1. Open Insights › Overview. 2. The monetization read is refused.
EXPECTED  The sales card says "Couldn't read" or "—" where the peso figures would be.
ACTUAL    `fetchAppPerformanceStats` falls back to `fallback.monetization` (`totalPhp: 0`), and `CockpitSurface` still prints `php.format(perf.monetization.totalPhp)` as ₱0, each stream as ₱0 and flat `StackedBars`, under `pill="live"`. The only sign of the failure is the top banner "Some metrics couldn't load".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states · brief checklist 3
SEVERITY  money-signin
SOURCE    CODE

#### H-2 · Peso amounts are formatted by hand, not through lib/php.ts
PAGE      /admin/app-performance   (tabs: overview, intelligence, operations)
BUTTON    —
STEPS     1. Open Overview (Sales card, Expenses & Receipts), Intelligence (Market pulse) and Operations (Hiring roadmap).
EXPECTED  Every peso figure goes through `formatPhp` or `formatPhpRounded`.
ACTUAL    There are four hand-rolled formatters. overview-surface.tsx `const php = new Intl.NumberFormat('en-PH', { style: 'currency'`. expenses.tsx has the same `php`. intelligence-surface.tsx has `phpFmt`. operations-surface.tsx has a local `function formatPhp` that returns `` `₱${n.toLocaleString('en-PH')}` ``, so it shadows the real helper's name.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money · brief checklist 4
SEVERITY  money-signin
SOURCE    CODE

#### H-3 · On the entity map, every failed count reads 0 and "live", orders and billing included
PAGE      /admin/ugat/map
BUTTON    the Orders and Billing nodes; Tables › any table
STEPS     1. Open the Entity map. 2. Any head count is refused. 3. Open the Orders or Billing node, or a table.
EXPECTED  "Couldn't read" or "—", never 0.
ACTUAL    In lib/ugat/data.ts, `headCount` does `if (error) { logQueryError(...); return 0; }`, and the wallets sum also returns 0. The console prints 0 with "live" for "Pending payment" and "Active subscriptions". A failed table load sets `total: 0`, which reads "0 rows · live".
SHOTS     phase B: desktop
RULE      CLAUDE.md §5.4 honest states
SEVERITY  money-signin
SOURCE    CODE

#### H-4 · The Billing node shows a typed "Commission 0%"
PAGE      /admin/ugat/map
BUTTON    the Billing node
STEPS     1. Open the Entity map. 2. Click the Billing node.
EXPECTED  A fee or commission rate is read from where it lives (`platform_settings` booking-fee columns) and names who it applies to.
ACTUAL    ugat-console.tsx has `kv.push(['Commission', '0%'])`: a constant typed into the code, shown in the supplier-billing card even though suppliers pay the booking fee read by `getBookingFeeSchedule`.
SHOTS     phase B: desktop
RULE      CLAUDE.md §1 "Never write a price into code" · brief checklist 4
SEVERITY  money-signin
SOURCE    CODE

#### H-5 · Every AI-brain chunk shows a dead "Edit" button, next to "Coming soon" chips
PAGE      /admin/ugat   (tab: brain)
BUTTON    "Edit" · "Unanswered questions · Coming soon" · "Cost Watch · Coming soon"
STEPS     1. Open Root map › AI brain. 2. Open any topic.
EXPECTED  No placeholder controls. A control either works or is not there.
ACTUAL    brain-surface.tsx `ChunkRowView` renders `<button ... disabled title="Edit coming with the next refresh.">Edit</button>` on every row. The tab strip renders `ComingSoonTab` twice.
SHOTS     phase B: 375 px light
RULE      design-and-wiring §B5
SEVERITY  broken
SOURCE    CODE

#### H-6 · A refused Resolve, Ignore or Archive save says "Saved ✓"; Archive also leaves the faults in the archive
PAGE      /admin/app-performance   (tab: connection-logs)
BUTTON    "Archive all active" · "Resolve" · "Ignore"
STEPS     1. Open Problems › Every trace. 2. Press "Archive all active" and have `resolveAllActive` return `{ ok:false }`.
EXPECTED  A plain failure reason plus Try again, and the rows go back to Active.
ACTUAL    `save.run` only treats a throw as failure, so `{ ok:false }` gets the "Saved" beat. `archiveAll` ignores the result, so the rows stay under "Resolved archive". `resolveOne` reverts silently after showing "Saved".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 · design-and-wiring §B6
SEVERITY  wrong
SOURCE    CODE

#### H-7 · Overview prints zeros and "nothing yet" copy when non-money reads fail
PAGE      /admin/app-performance   (tab: overview; also slow-loads)
BUTTON    —
STEPS     1. Open Overview. 2. The population, breakdowns, reports or load-times read fails.
EXPECTED  "—" or "Couldn't read" in each affected card.
ACTUAL    In `CockpitSurface`, `ContextTile` "Users", "Suppliers" and "Services" print `nf.format(...)` as 0, "Events by type" says "No events yet.", "Abuse reports" says "0 … open right now", and "Page loads" says "Not enough loads measured yet (0 of N needed)". Only the top banner admits the failure. The slow-loads footer also reads "0 measured" via `formatCount(data.overall.n)`.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### H-8 · "Fastest movers" says "not enough data" for every entity row, and its footnote is false
PAGE      /admin/app-performance   (tab: overview)
BUTTON    —
STEPS     1. Open Overview › Growth › Fastest movers.
EXPECTED  An entity row is either measured, or says it is not computed.
ACTUAL    `leaders` hard-codes `pct: null` for New users, New suppliers, New services and New events, so `LeaderRow` always prints "not enough data" whatever the volume. The footnote says "Entity rows show net-new counts; their prior-window % lands with the Action Center PR", but no count is drawn and the Action Center is already live.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### H-9 · Operations says it is "Live" over a view that never refreshes; failed reads read as "not calculated yet"
PAGE      /admin/app-performance   (tab: operations)
BUTTON    —
STEPS     1. Open Operations & Hiring.
EXPECTED  Stale numbers are labelled stale, and a failed read says "Couldn't read".
ACTUAL    The Sec about text says "Live — refreshed when stale, each time this page opens", and Facts shows "Signups (last 7d)". But `refreshBottleneckSignalsIfStale` calls `refresh_bottleneck_signals`, which no migration creates (the matview is from 2026-05-20). If `getBottleneckSignals` errors, it returns null and the page says "These numbers haven't been calculated yet". If `getRecentAlerts` errors, it returns `[]` and the alerts section is silently hidden.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### H-10 · The Sentry smoke test reports success on a network failure
PAGE      /admin/app-performance   (tab: operations)
BUTTON    "Trigger Sentry test error"
STEPS     1. Press it while the fetch fails (offline, or a proxy drop).
EXPECTED  It says the test did not reach the server.
ACTUAL    smoke-test-panel.tsx `runSentryTest` has `catch (err) { setLastResult({ ok: true, ... via: 'network-error-from-throw' }) }`, so it shows "sentry test fired ✓".
SHOTS     phase B: 375 px light
RULE      design-and-wiring §B6 · CLAUDE.md §5.4
SEVERITY  wrong
SOURCE    CODE

#### H-11 · Growth "Export CSV" writes 0 where a read failed
PAGE      /admin/app-performance   (tab: growth)
BUTTON    "Export CSV"
STEPS     1. Open Growth while the population or conversion read fails (the page shows "—"). 2. Press Export CSV.
EXPECTED  The CSV marks unread values, or carries an errors row.
ACTUAL    app/admin/growth/export/route.ts `toCsv` writes `p.accountHolders`, `c.rate` and the rest straight from the zero fallbacks and never writes `stats.errors`.
SHOTS     phase B: desktop
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### H-12 · Lead-score signals say "Website" and "Monogram"
PAGE      /admin/app-performance   (tab: intelligence)
BUTTON    —
STEPS     1. Open Intelligence › Lead scores. 2. Read the Signals column (lg and up).
EXPECTED  "Event Hub" and "Logo Maker".
ACTUAL    intelligence-surface.tsx `leadSignals` has `r.websiteConfigured ? 'Website'` and `r.monogramConfigured ? 'Monogram'`.
SHOTS     phase B: desktop
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### H-13 · The entity map says "Vendors" and "vendor" in node names and blurbs
PAGE      /admin/ugat/map
BUTTON    the Vendors node (and others)
STEPS     1. Open the Entity map. 2. Open the Vendors, Threads or Package node.
EXPECTED  "Suppliers" or "supplier".
ACTUAL    lib/ugat/graph.ts: `name: 'Vendors'`, `blurb: 'vendor orgs · free-during-launch profiles'`, `'couple ↔ vendor — answering is free'`, `'what a vendor sells …'`. These render in the node card (`ug-nm` and the status line).
SHOTS     phase B: desktop
RULE      docs/brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### H-14 · A failed brain-chunk read shows 0 counts and "No chunks authored yet" in all eight topics
PAGE      /admin/ugat   (tab: brain)
BUTTON    —
STEPS     1. Open AI brain while the `concierge_brain_chunks` read fails.
EXPECTED  "—" in the KPI cards and no empty-state copy.
ACTUAL    brain-surface.tsx does `const chunks = ((rows ?? [])`. The page passes numbers (0) to `KpiStatCard` (which would print "—" for `null`), and every topic says "No chunks authored yet — content authoring is a parallel workstream." The error banner shows underneath.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §5.4 honest states
SEVERITY  wrong
SOURCE    CODE

#### H-15 · Menu edits report success when the database refuses them
PAGE      /admin/ugat   (tab: menus)
BUTTON    "Save" (rename) · icon pick · "No icon" · "Hide from menu" · "Reset to default" · "Upload"
STEPS     1. Rename a slot and press Save. 2. The upsert is refused.
EXPECTED  A failure with its reason, and no audit row.
ACTUAL    menus/actions.ts `setSlotLabel`, `setSlotLucideIcon`, `setSlotHidden`, `resetSlot` and `uploadSlotIcon` `await admin.from('nav_slot_override').upsert(...)` (or `.delete()`) without reading `error`. They still call `audit(...)`, and the editor's `save.run` shows "Saved". Hide and Reset give no feedback at all.
SHOTS     phase B: 375 px light
RULE      design-and-wiring §B6 · CLAUDE.md §5.4
SEVERITY  wrong
SOURCE    CODE

#### H-16 · Comparisons don't name their period
PAGE      /admin/app-performance   (tabs: overview › Expenses, funnels)
BUTTON    —
STEPS     1. Read the delta beside "this month" under Monthly digital spend. 2. Read the Funnels "vs previous" column.
EXPECTED  Each comparison says what it compares against ("vs last month", "of previous step").
ACTUAL    charts.tsx `DeltaPct` prints "vs prev period" for a month-on-month delta. funnels-surface.tsx `header: 'vs previous'` is step-to-step conversion but reads like a period comparison.
SHOTS     phase B: desktop
RULE      brief checklist (charts name their exact period)
SEVERITY  wrong
SOURCE    CODE

#### H-17 · Two gold-filled controls on the Problems screen
PAGE      /admin/app-performance   (tab: connection-logs)
BUTTON    "Archive all active" + the selected type pill ("All")
STEPS     1. Open Problems with active faults.
EXPECTED  One accent-filled main verb per screen.
ACTUAL    connection-logs-client.tsx: the Archive button is `bg-[#A9834B] … text-white`, and the selected filter pill is `border-[#A9834B] bg-[#A9834B] text-white`, the same filled gold.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### H-18 · The fault-detail popup is hand-rolled
PAGE      /admin/app-performance   (tab: connection-logs)
BUTTON    "Inspect fault" (row)
STEPS     1. Press any trace row.
EXPECTED  The shared layer: `RiseScreen` for this long JSON detail (or `Sheet`).
ACTUAL    `InspectModal` is `<div className="fixed inset-0 z-50 …">` holding its own `role="dialog" aria-modal="true"`, with a `bg-white` panel.
SHOTS     phase B: 375 px light + desktop
RULE      HOUSE_DESIGN_STANDARD K3 · SHAPE
SEVERITY  look
SOURCE    CODE

#### H-19 · The entity-map side card and scrim are hand-rolled
PAGE      /admin/ugat/map
BUTTON    any node, edge or finding
STEPS     1. Click a node on the map.
EXPECTED  The shared `Sheet` or `RiseScreen` (the node card is long, so a full-screen popup on a phone).
ACTUAL    ugat-console.css: `.ug-card { position: fixed; … width: 460px; transform: translateX(100%) }` plus its own `.ug-scrim`. The console renders `<aside className="ug-card…" aria-hidden={!panelOpen}>` with no shared layer or page lock.
SHOTS     phase B: 375 px light + desktop
RULE      HOUSE_DESIGN_STANDARD K3 · SHAPE
SEVERITY  look
SOURCE    CODE

#### H-20 · The Overview Range picker is a native select with an Apply button
PAGE      /admin/app-performance   (tab: overview, also the bare address)
BUTTON    "Apply"
STEPS     1. Open Overview and look at Range.
EXPECTED  `PickMenu` via `InsightsParamPick`, as Growth, Visits and Funnels already use.
ACTUAL    1 native select with 3 options: overview-surface.tsx `<select id="range" name="range">` (GROWTH_RANGE_OPTIONS) plus `button-secondary` "Apply".
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD D2 (PickMenu) · K3
SEVERITY  look
SOURCE    CODE

#### H-21 · The loading skeleton draws a tile grid the tabs don't have
PAGE      /admin/app-performance   (tabs: growth, intelligence, seo, visits)
BUTTON    —
STEPS     1. Navigate to ?tab=growth (or intelligence, seo, visits).
EXPECTED  A skeleton of the tab's single column of hairline rows.
ACTUAL    app-performance/loading.tsx is `GridPageSkeleton` (9 bordered `h-44` tiles in 3 columns), and `tabSkeleton` falls back to it for these tabs. Since 14 Nov the tabs draw single-column rows with "no tiles (T18)".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §3 Loading ("draws only what the page draws")
SEVERITY  look
SOURCE    CODE

#### H-22 · About 225 hard-coded light-only styles across the app-performance tabs
PAGE      /admin/app-performance   (all tabs)
BUTTON    —
STEPS     1. Grep the tab files.
EXPECTED  Colour tokens by job, the `text-sn-*` type scale, no spinners or pulses.
ACTUAL    64 hex, 127 `text-[Npx]`, 7 default-palette classes, 17 numbered token classes, 4 `bg-white`, 2 `rounded-[..]`, 1 `hover:shadow-md`, 3 `animate-pulse` and 1 `animate-spin`. Examples: connection-logs-client.tsx `text-[#1B1A17]` and `bg-slate-200 text-slate-800`; charts.tsx `color: '#2E4A2A'`; overview-surface.tsx `bg-warn-50 … text-[11px]` and `animate-pulse`; seo-rerun-button.tsx `animate-spin`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### H-23 · 58 hard-coded light-only styles across the Root map tabs
PAGE      /admin/ugat   (tabs: menus, onboarding, brain, screens)
BUTTON    —
STEPS     1. Grep the tab files.
EXPECTED  Tokens and the type scale only.
ACTUAL    26 `text-[Npx]`, 27 numbered token classes, 2 default-palette classes and 3 `bg-white`. Examples: brain-surface.tsx `bg-sky-100 … text-sky-800` and `bg-warn-50/80`; onboarding-surface.tsx `bg-success-50/60 … text-success-800`; menu-registry-editor.tsx `bg-white`; page.tsx tab strip `text-terracotta-700`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### H-24 · The entity map has its own light-only colour set
PAGE      /admin/ugat/map
BUTTON    —
STEPS     1. Grep ugat-console.css.
EXPECTED  House tokens, with a paired dark set.
ACTUAL    78 lines with hex and 16 with `rgba(`, and no dark variant. Examples: `--ug-ok: #3e8b59`, `--ug-e-vendor: #8a5fb0; --ug-e-vendor-bg: #f1eaf8`, `color: #fff`, `border-bottom: 1px solid #000`.
SHOTS     phase B: desktop
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

**Group H notes**

- Not checked: the `demand` and `papic-storage` tabs of /admin/app-performance and the `search` tab of /admin/ugat. They mount other pages (/admin/demand, /admin/papic-storage, /admin/search-memory).
- Operations tab: loading it runs `runHiringAlertSweep`, which can fire alerts and send emails on a plain GET. Its ⓘ also prints the owner's personal email address.
- Unsure: on the SEO tab, "Our true answer" uses `getBookingFeeSchedule`, which falls back to a locked default rate when its read is refused, so a default could be shown as fact.
- Unsure: the Funnels "First booking thread" step reads `chat_threads` with no `.limit`, so a server row cap could undercount it without saying so.
- Not verified in a browser: `addExpense`, `attachReceipt` and `uploadSlotIcon` throw on bad input or missing R2. A `<form action>` should then land on `app/admin/error.tsx` rather than an inline message.

### Group I · Settings & system

#### I-1 · Config saves ignore a failed platform_settings write and still say "Saved." (Maya endpoint, AI paywall)
PAGE      /admin/integrations   (also /admin/switches for the paywall)
BUTTON    "Save" (Maya card, Resend card, OAuth cards) · the "Setnayan AI paywall" pick on Switches
STEPS     1. Change the Maya Checkout endpoint or the paywall mode. 2. Press Save or Confirm while the platform_settings update is refused.
EXPECTED  A failed write shows a failure, like `saveOAuthField` / `savePayersSeeMaya` already do (`?error=save_failed`).
ACTUAL    integrations/actions.ts `saveMayaConfig`, `setAiPaywall`, `saveResendConfig` and `saveOAuthConfig` all run `await admin.from('platform_settings').update(...)` and never read `error`, then redirect `?saved=1` (or `/admin/switches?saved=paywall`).
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4) · design-and-wiring B6
SEVERITY  money-signin
SOURCE    CODE

#### I-2 · "Clear saved key(s)" always reports cleared, and the message always talks about email
PAGE      /admin/integrations
BUTTON    "Clear saved keys" (Maya) · "Clear saved secret" (OAuth) · "Clear saved key" (Resend, OpenAI)
STEPS     1. Press Clear on the Maya card. 2. The clear fails, or it succeeds.
EXPECTED  A failure says so. On success the notice names the integration that was cleared.
ACTUAL    `clearMayaSecrets`, `clearOAuthSecret`, `clearIntegrationSecret` and `clearResendKey` drop the `SecretWriteResult` from `clearIntegrationSecretColumns` and always redirect `?cleared=1`. page.tsx then renders "Key cleared — email now falls back to the Vercel env (if set)." for every card, including the Maya payment keys.
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4)
SEVERITY  money-signin
SOURCE    CODE

#### I-3 · A failed settings read prints a VAT of 0, a 1970 "Last updated" and the default brand icon as facts, and leaves the loader Save armed
PAGE      /admin/business
BUTTON    "Save loading animation" · "Upload brand icon"
STEPS     1. Open /admin/business while the platform_settings read is refused.
EXPECTED  Every field says "Couldn't read" and every save is off, as the banner promises ("Saving is off until they load").
ACTUAL    `fetchPlatformSettingsMeasured` returns FALLBACK, and the page still shows "Default VAT rate (%)" 0, `Last updated ${new Date(settings.updated_at)…}` (epoch) and "Using the default gold Setnayan mark." `getLoaderSettings()` falls back to `DEFAULT_LOADER_CONFIG` on its own failed read, and `LoaderAppearanceCard` still posts `saveLoaderAppearance` with those defaults.
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4)
SEVERITY  money-signin
SOURCE    CODE

#### I-4 · Referral reward formatted by hand with "₱" + toLocaleString
PAGE      /admin/switches
BUTTON    — (the "Referral program" row line)
STEPS     1. Open /admin/switches and read the Referral program row.
EXPECTED  The amount is formatted through lib/php.ts `formatPhp`.
ACTUAL    switches/page.tsx: `` `₱${s.referral_reward_php.toLocaleString('en-PH')}` ``.
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money (lib/php.ts only)
SEVERITY  money-signin
SOURCE    CODE

#### I-5 · Partnership fees formatted by hand, and a peso amount typed into a placeholder
PAGE      /admin/vendor-partnerships
BUTTON    — (Open proposals line, the Fee / Discount column, the "Additional fee (centavos)" field)
STEPS     1. Open the page and read a proposal's fee or the fee input.
EXPECTED  Fees go through `formatPhp`, and no peso amount is typed in copy.
ACTUAL    page.tsx `formatFee`: `` `₱${(cents / 100).toLocaleString('en-PH')}` ``, `'₱0'`, `'Included (₱0)'`. The placeholder reads "e.g. 100000 = ₱1,000 · leave blank = unknown".
SHOTS     phase B: 375 px light
RULE      CLAUDE.md §1 Money · brand.md claim 1
SEVERITY  money-signin
SOURCE    CODE

#### I-6 · The owner's numbers lost their only editor in the Settings → Business move
PAGE      /admin/business   (/admin/settings forwards here)
BUTTON    —
STEPS     1. Open /admin/settings. 2. Look for "Deep Search searches" per month, the trust step, the real-guests minimum and the Today numbers.
EXPECTED  They stay editable: `saveBusinessIdentity` still writes them when posted (`formData.has('deep_search_runs_per_month')`, `trust_search_step`, `proof_real_guests_min`, `grow_few_inquiries_28d`, `today_soon_ask_hours`…).
ACTUAL    Only settings/_surfaces/settings-surface.tsx (`SettingsSurface`) renders those inputs, and only tests import it. `BusinessIdentityForm` posts none of them, so no page can change them, although the page doc says "nothing dropped".
SHOTS     phase B: 375 px light
RULE      design-and-wiring A4 (every way in moves with it) · B5
SEVERITY  broken
SOURCE    CODE

#### I-7 · Recommendation map and supplier-flag queue show 0 and "nothing pending" when the reads fail
PAGE      /admin/vendor-recommendations
BUTTON    —
STEPS     1. Open the page while `vendor_service_recommendations` or `vendor_recommendation_feedback` is refused.
EXPECTED  "Couldn't read", never zero or empty.
ACTUAL    Errors are only logged (`logQueryError('AdminVendorRecommendations (map)'…)`), then `recRes.data ?? []` and `feedbackRes.data ?? []` feed TemplateNums ("Total recs 0", "Pending flags 0") and "No recommendations yet — add one below." / "No pending flags." The leaf/SKU pickers and the name lookups (`const { data: vendors }`, `const { data: extra }`) fail silently too.
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4)
SEVERITY  wrong
SOURCE    CODE

#### I-8 · Open proposals header says "(0)" and "No proposals awaiting" on a failed read
PAGE      /admin/vendor-partnerships
BUTTON    — (the Open proposals heading and its ⓘ)
STEPS     1. Open the page while the proposals read is refused.
EXPECTED  The heading says "not measured", as the Live partnerships heading does.
ACTUAL    page.tsx: `right={`(${proposed.length})`}` and tip `'No proposals awaiting a recipient response.'` both come from `proposedRowsRaw ?? []`, so they claim zero above the ErrorState "Couldn't read the open proposals".
SHOTS     phase B: 375 px light
RULE      Honest states (CLAUDE.md §5.4)
SEVERITY  wrong
SOURCE    CODE

#### I-9 · Error notice says "vendor"
PAGE      /admin/vendor-partnerships
BUTTON    "Propose partnership (lands in supplier inbox)"
STEPS     1. Pick the same shop as Recommending and Recommended. 2. Press Propose.
EXPECTED  "A supplier cannot partner with themselves."
ACTUAL    actions.ts `createPartnershipHq`: `?error=A+vendor+cannot+partner+with+themselves.`, shown through `FormFlash`.
SHOTS     phase B: 375 px light
RULE      brand.md Word rules (supplier, never vendor)
SEVERITY  wrong
SOURCE    CODE

#### I-10 · Sample switch states "Default — off" as fact while the default follows an env flag
PAGE      /admin/switches
BUTTON    "The sample at /sample" pick
STEPS     1. Leave sample_event_enabled NULL with SAMPLE_EVENT_ENABLED on. 2. Open Switches.
EXPECTED  The default row says what the env says, as the AI paywall row does ("env says ON/OFF").
ACTUAL    settings/_components/sample-event-switch.tsx `OPTIONS`: `{ key: 'default', label: 'Default — off' }`, but lib/sample-event/switch.server.ts resolves NULL from `envFlagEnabled(process.env.SAMPLE_EVENT_ENABLED)`.
SHOTS     phase B: 375 px light
RULE      Honest states (default stated as fact)
SEVERITY  wrong
SOURCE    CODE

#### I-11 · Demo-mode row is labelled "View /vendors"
PAGE      /admin/switches   (#demo-mode)
BUTTON    "View /vendors (demo suppliers visible)" / "View /vendors (without demo)"
STEPS     1. Open Switches › Admins and read the demo rows.
EXPECTED  Supplier wording, naming the real destination (the marketplace on Discover).
ACTUAL    settings/_surfaces/demo-mode-surface.tsx: `` title={`View /vendors ${isOn ? …}`} `` with `href="/?browse=1"`. There is no app/vendors/page.tsx.
SHOTS     phase B: 375 px light
RULE      brand.md Word rules
SEVERITY  wrong
SOURCE    CODE

#### I-12 · Admin radar copy promises a floor control that does not exist
PAGE      /admin/demand
BUTTON    — (the ⓘ on "Not enough demand data yet")
STEPS     1. Open /admin/demand with no cell above the floor.
EXPECTED  The copy matches the page: no control writes radar_min_n_floor.
ACTUAL    vendor-dashboard/demand/_components/demand-radar-card.tsx (admin branch): "You can lower the floor in platform settings…". The page's own row says "no control in the app writes it today".
SHOTS     phase B: 375 px light
RULE      design-and-wiring B5 (no promise of a control that isn't there)
SEVERITY  wrong
SOURCE    CODE

#### I-13 · Five filled buttons on one screen
PAGE      /admin/business
BUTTON    "Save business identity" · "Upload brand icon" · "Save loading animation" · "Fire Sentry smoke test (admin only)" · "Save compliance facts"
STEPS     1. Open /admin/business and scroll.
EXPECTED  At most one main (filled) button per screen.
ACTUAL    `ActionButton … main` (business-identity-form.tsx), `bg-mulberry` (brand-icon-form.tsx), `button-primary` (loader-appearance-card.tsx), `bg-ink … text-cream` (sentry-smoke-test-button.tsx), `tone="brand" main` (compliance-form.tsx).
SHOTS     phase B: 375 px light + desktop
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### I-14 · Two filled Saves in one card (Google Drive)
PAGE      /admin/integrations
BUTTON    "Save" + "Save this key"
STEPS     1. Open the Google Drive OAuth card (it has an `ownForm` field).
EXPECTED  One filled button per card.
ACTUAL    oauth-card.tsx: both SubmitButtons are `bg-mulberry … text-cream`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### I-15 · Row "Save" buttons share the main button's colour
PAGE      /admin/vendor-recommendations
BUTTON    "Add recommendation" (brand, filled) + every map row's "Save" (brand, outlined)
STEPS     1. Open the page with map rows.
EXPECTED  Secondary buttons do not wear the main button's colour.
ACTUAL    _editor.tsx `RecommendationRow`: `actionButtonClass('brand')`. `AddRecommendation`: `actionButtonClass('brand', { main: true })`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### I-16 · Native select for the 3-way paywall choice
PAGE      /admin/integrations
BUTTON    "Paywall" select (Use environment default · On · Off)
STEPS     1. Open the Setnayan AI paywall card.
EXPECTED  PickMenu (Switches already draws this choice with `ConfirmPick`).
ACTUAL    1 native `<select name="mode">` with 3 options in integrations/page.tsx.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD D2 (PickMenu) · K3
SEVERITY  look
SOURCE    CODE

#### I-17 · Hard-coded palette, sizes and white (integrations)
PAGE      /admin/integrations
BUTTON    —
STEPS     1. Switch to dark once admin is on DARK_READY.
EXPECTED  Tokens by job only.
ACTUAL    ≈58 lines. page.tsx `bg-emerald-50 … text-emerald-900`, `bg-rose-50 … text-rose-900`, `bg-white px-3 py-2`. known-hash-card.tsx `bg-amber-200/80 text-amber-950`. secret-card / oauth-card / maya-card `bg-emerald-100 text-emerald-900`, `text-[10px]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### I-18 · Hard-coded palette, sizes and white (business)
PAGE      /admin/business
BUTTON    —
STEPS     1. As I-17.
EXPECTED  Tokens by job only.
ACTUAL    ≈24 lines. page.tsx `bg-white px-2` (tab icon preview), `text-[14px]`. compliance-form.tsx `border-amber-200/70 bg-amber-50/60 text-amber-900/90`, INPUT `bg-white`, `text-rose-800`. brand-icon-form.tsx `bg-white px-2 shadow-sm`, and a class that does not exist: `file:text-terracotta-700-700`. loader-appearance-card.tsx `bg-white`, `text-[10px]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### I-19 · Hard-coded palette and half-pixel sizes (email delivery)
PAGE      /admin/email-delivery
BUTTON    —
STEPS     1. As I-17.
EXPECTED  Tokens and the text-sn scale.
ACTUAL    ≈23 lines. email-delivery-section.tsx TONE `bg-emerald-50 text-emerald-800`, `bg-amber-50 text-amber-800`, `text-[11.5px]` (half pixel), `mt-[18px]`. morning-digest-card.tsx `text-[11.5px]`. notifications-surface.tsx `text-[12px]`. test-resend-button.tsx `text-emerald-800`, `text-rose-700`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 colour
SEVERITY  look
SOURCE    CODE

#### I-20 · Typed and half-pixel sizes (demand)
PAGE      /admin/demand
BUTTON    —
STEPS     1. As I-17.
EXPECTED  The text-sn scale only.
ACTUAL    page.tsx `text-[15px] font-semibold` ×2. The shared demand-radar-card.tsx draws `text-[11.5px]` ×4 (half pixel), `text-[24px]`, `text-[13px]` ×~9, `text-[12px]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 type
SEVERITY  look
SOURCE    CODE

#### I-21 · Typed sizes (data privacy)
PAGE      /admin/data-privacy
BUTTON    —
STEPS     1. As I-17.
EXPECTED  The text-sn scale only.
ACTUAL    11 × `text-[Npx]`. page.tsx `text-[13px] text-ink/60`, `text-[15px] font-semibold leading-tight`. control-actions.tsx `text-[15px] font-medium`. task-actions.tsx `text-[13px] text-[var(--sn-danger)]`. coverage-panel.tsx `text-[13px] text-[var(--sn-success-deep)]`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 type
SEVERITY  look
SOURCE    CODE

#### I-22 · Typed sizes (supplier recommendations)
PAGE      /admin/vendor-recommendations
BUTTON    —
STEPS     1. As I-17.
EXPECTED  The text-sn scale only.
ACTUAL    ≈8 lines. _editor.tsx `labelCls` `text-[13px]`, `text-[12px] text-ink/50`. page.tsx `text-[15px] font-semibold`.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 type
SEVERITY  look
SOURCE    CODE

#### I-23 · Typed sizes (NPC data sheet)
PAGE      /admin/compliance/data-sheet
BUTTON    —
STEPS     1. As I-17.
EXPECTED  The text-sn scale only.
ACTUAL    3 × `text-[11px]`: `SEC_HEAD`, the "Holds a Setnayan account" line, the `[TO CONFIRM]` retention note.
SHOTS     phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K2 · CLAUDE.md §3 type
SEVERITY  look
SOURCE    CODE

**Group I notes**

- /admin/secrets was not checked. Read and Grep on apps/web/app/admin/secrets/ are refused by this session's permission settings, so its serialisation into client components and its write gates still need a checker who can open it. The `?view=secrets` mount inside /admin/business is the same file.
- /admin/demand `after()`: `maybeRefreshDemandRadar` runs a service-role `refresh_demand_radar_rollups` from a page with no gate of its own. It is throttled to once an hour, rebuilds the same data each time, and the supplier `one-analytics-section.tsx` already fires it, so I did not report it. "Run now" (`runDemandRadarRefresh`) checks admin before any service-role call.
- Server-side admin checks verified: `/api/admin/demo-mode/toggle` (`isAdminProfile` → 403), `/api/admin/sentry-smoke-test` (403), `/api/admin/smoke-test` (404), `/admin/data-privacy/documents/[doc]` (404). /admin/integrations and /admin/email-delivery pass only booleans and non-secret config to the page. No ciphertext or env secret reaches the browser.
- Cosmetic: `TestResendButton` reads `body.id`, but `/api/admin/smoke-test` returns `messageId`, so "Sent — message id …" never shows.
- `ConfirmDialog`, the house confirm behind `ConfirmButton` and `ConfirmForm`, is a portalled native `<dialog>`, not `Sheet`. That is area-wide, so I did not report it per page.

## Second pass (25 Nov)

Checked on the admin pages batch 1 and 2 touch, against Adds 11, 11b, 12, 13, 15, 17 and 18. Lane A ones are fixed in
the batches; the rest wait.

- [B] Add 11.3 · every admin list (Work, Money › To confirm, People, Integrity watch, Repost watch) · no pull to refresh
  on a phone; the only refresh is a reload. Should: pull to refresh on 375/768 lists. Reference: iOS Mail list.
- [B] Add 11.7 · `/admin/team` areas × levels grid, `/admin/pricing` catalogue table · a table that scrolls sideways on
  375. Should: one row per person or price with a details sheet. Reference: iOS Settings list → detail.
- [B] Add 11b · admin shell · the 44 px house press is applied to every control at 1280 too (chips, ⓘ, ↑/↓); desktop
  rows could be denser. Reference: Gmail desktop vs phone.
- [B] Add 11b · `/admin/studio` (Website widgets) · the ↑/↓ reorder arrows draw 24 px on a phone (P-B-21) while the
  file's own docblock promises touch Move buttons (G-7). Fix waits for a drawing.
- [B] Add 12.1 · admin landing cards and the Focus "Completions" row expand with a snap (no motion 9 "Open").
- [B] Add 13 · Icons: `/admin` Focus/Full switch is two unlabeled glyphs on 375 (should mean "Focus list" / "Full
  console"); the Ugat map's Map · Entities · Joints · Fields buttons carry no icon (should mean graph · box · link · column).
- [R] Add 17 · `/admin/studio?tab=real-stories` ("Real Stories (retired)", its own label says retired, still in the
  Studio menu and the Catalogue card) · product folded; nothing for couples links to it. Delete with a forward.
- [R] Add 17 · `/admin/ugat?tab=brain` ("AI brain (old)", the concierge brain; three tabs inside say "Coming soon") ·
  the concierge is retired (R7). Delete with a forward.
- [C/R] Add 17 · `/admin/studio?tab=patiktok` · Patiktok is a retired name (SW-RETNAME) but the Studio menu still offers
  it. Owner to rule: retire or rename.
- [B] Add 15 · every admin page's top bar · the mark is `LogoMark` from `app/_components/brand-marks.tsx`
  (`front-door-shell.tsx` draws it), which Add 15 lists as a bypass of the one source. Covered by the Add 15 lane B batch;
  nothing inside `app/admin` draws its own mark.
- Add 18 · the admin Reveal Studio edits the house reveal settings (not a couple's pick); it shows no per-event picker. ✓
