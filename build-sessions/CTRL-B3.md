# CTRL-B3 — SAY THE TRUE THING, AND OPEN THE DEAD ENDS

**Model · effort: Opus · high.** Builds 1 and 2 are legal wording on a live page with real traffic —
they need judgement, not speed. The rest are small and mechanical.

```
cd ~/Documents/Claude/Projects/setnayan-platform && claude --model claude-opus-5
```

**Read first:** `build-sessions/BUNDLE-COMMON.md`, then `build-sessions/AREA-AUDIT-TEMPLATE.md`.

**One branch, one PR, six commits.** Branch from `origin/main`.

---

## Build in THIS order. The order is the cut line.

### 1 — `/signup` makes a compliance claim the company has not earned
The footer states, verbatim: **"We never sell your data — RA 10173 compliant."** on a live page with
real traffic. The repo's own compliance catalogue (`apps/web/lib/npc-filing-tasks.ts`, 15 tasks)
shows the claim is premature: counsel not engaged (`t0-1`), DPO designation + Privacy Manual + Breach
Policy unsigned (`t3-12`), the DPS unfiled with the NPC (`t3-13`), sub-processor DPAs unexecuted
(`t2-8`), faith/minors/biometric disclosures unpublished (`t1-5`/`t1-6`).

An unqualified compliance claim sitting next to an unfiled DPS is **evidence against the company** if
a data-subject complaint reaches the NPC.

- Anchor: `git grep -n "RA 10173" origin/main -- apps/web/app`
- **Write what is TRUE and keep the reassurance.** "We never sell your data" is a true promise about
  conduct and should stay. The compliance *status* claim is what must go or be qualified. Do not
  replace one overclaim with a vaguer one.
- 🔑 **This is a judgement call about words on a live legal surface. If you are unsure of the
  wording, propose two options in your report and STOP — do not ship a guess.** The owner decides
  the sentence; you find every place it appears.
- **Property:** the guard bans the *claim of certified/complete compliance status*, not a noun. A
  phrasing ban fails in both directions — it misses a reword and convicts innocent code. Assert the
  property. `features-page-says-what-ships.test.ts` is the shape to copy.

### 2 — Terms is a footnote, not an agreement
The only checkboxes on `/signup` are "Include my wedding in Stories" (opt-in) and "Stay signed in"
(defaulted). Terms/Privacy sits below the submit button with no checkbox and no `required`.
Browsewrap is materially weaker in PH courts and under the NPC's consent standard than a real
clickwrap.

- Anchor: `git show origin/main:apps/web/app/signup/page.tsx | grep -n "type=\"checkbox\""`
- Add a required, **affirmative** "I agree to the Terms and Privacy Policy" checkbox, unchecked by
  default, and record the agreement (version + timestamp) so it can be produced later.
- ⚠ **Never post consent as a hidden field.** `onboarding-shell.tsx` carries a `🔒 NO HIDDEN CONSENT`
  marker held by `app/signup/consent-is-affirmative.test.ts` for exactly this reason. Read that test
  first and extend it rather than writing a second one beside it.
- **Property:** signup cannot complete without an affirmative act, and the act is recorded.

### 3 — A shipped host control nobody can open
`/dashboard/[eventId]/website/stories` — the host choosing which supplier-authored stories appear on
their celebration (owner decision, 2026-08-15) — **has no link from anywhere in the app.** Only its
own `actions.ts` and two test files name the path.

- Anchor: `git grep -n "website/stories" origin/main -- apps/web/app apps/web/lib`
- Every other apparent orphan route in this app turned out to be a deliberate redirect
  (`lib/routes.ts` + `scripts/lint-routes.mjs` are doing their job). **This is the single real
  exception** — confirm that is still true before adding a door.
- ⚠ A door off a thread or section page must carry its `?tab=` — a fragment link to an id that does
  not exist fails silently. Assert the href against the page **and its children**.
- **Property:** the route is reachable from a mounted control, and the control's href resolves.

### 4 — `shortlisted` is a state nothing can enter
`vendor_status` defines `shortlisted · delivered · complete`; prod holds only `considering ·
contracted · deposit_paid`. Its only writer is `lib/reusable-bookings.server.ts`, whose flag is
**absent from production** — so the state is unreachable, while several readers still filter on it.
`checklist-state.ts`'s `one_option` and `searching` states can therefore never be entered.

- Anchor: `select status, count(*) from event_vendors group by 1;` · `git grep -n "shortlisted" origin/main -- apps/web/lib`
- Two honest answers: make it reachable, or stop reading it. **Pick one and say why.** Leaving both
  is what created the defect.
- **Property:** every state a reader filters on is a state a writer can produce.

### 5 — The price meter is empty until someone remembers to press a button
`market_price_bands` is **0 rows** in prod. `recompute_market_price_bands()` fires only from a human
pressing Recompute on `/admin/pricing?tab=price-bands`, so the Price-Position Meter is empty now and
stale a second after any refill.

- Anchor: `select count(*) from market_price_bands;` → **0** · `git grep -n "recomputePriceBands" origin/main -- apps/web`
- 🔑 **This repo has no scheduler, deliberately.** Do NOT add one. The established pattern is a
  cron-free periodic job claimed through `claim_periodic_job` and fired from `after()` on a page
  staff already load — `PERIODIC_JOBS` plus PR #5820's `booking-fee-unbilled-repair` is the worked
  example. Read it before writing.
- ⚠ `cron_job_runs.last_run_at` records the **claim**, not the outcome — a job that claims and then
  throws looks identical to one that succeeded. Do not build a "did it run" check on that column.
- **Property:** the meter's input refills without a human, and an empty meter says it is empty rather
  than implying a price position of zero.

### 6 — Admin metrics under-count silently
Only if build 3 of **CTRL-B2** did not already take it: `completion_status = 'auto_confirmed'` has
readers in 8 files and no writer. **Coordinate — do not both do it.** If B2 is in flight, skip this
and say so.

---

## Files this bundle may touch

`apps/web/app/signup/page.tsx` + its actions and consent test · `apps/web/lib/npc-filing-tasks.ts`
(read only) · the couple's website nav + `website/stories` · `apps/web/lib/checklist-state.ts` and
the `shortlisted` readers · `apps/web/lib/periodic-jobs` + the pricing admin page · new guards + one
changelog fragment.

Anything outside this set: stop and report rather than widening it.

## Before you push

`git diff --stat origin/main...HEAD` and read every file. An unintended deletion — especially of a
helper a recent PR added — means a restore loop wrote over your merge. CI cannot see it.

## Report

Per build: done or dropped · the property the guard holds · the sabotage you watched go red.
**For build 1, if you are not certain of the wording, bring the owner two options and stop.** A
guessed sentence on a live legal page is worse than an unfinished build.

---

## ➕ ADDED 2026-09-21 — builds 7, 8, 9

### 7 — The Explore card names the wrong trade
A couple filters Explore by a trade; the card headline names the shop's **first** service, not the
one that matched. "Photography by X" under Florist. The card's own docblock promises an instant
*is this what I'm shopping for* read, which is exactly what this breaks.

- Anchor: `git grep -n "services\[0\]\|primary_canonical_service" origin/main -- 'apps/web/app/(shell)/explore'`
  → `vendor-card.tsx` takes `vendor.services[0]` unconditionally; `folder-vendors-section.tsx` does
  the same. **Nothing passes the filtered category in.**
- **Property:** when a category filter is active, the headline names the matching service. With no
  filter, today's behaviour is correct — do not change it.

### 8 — The download page contradicts itself
A visitor told "the desktop download isn't available right now" is **also** told, further down,
"Signed with an Apple Developer ID and notarized by Apple."

- Anchor: `git grep -n "notariz" origin/main -- apps/web/app/download/page.tsx`
- The hero's notarization line **is** correctly branched and the availability state **is** honest —
  the unconditional claim is the `Value` card outside both branches. Fix that card only.
- `git grep -rln "notariz" origin/main -- apps/web` → 3 files, **none a test.** Add the guard.
- **Property:** no unconditional notarization claim can render while the build is unavailable or
  unnotarized. Assert the property, not the sentence.

### 9 — A couple cannot report a fraudulent shop
`ReportPageButton` accepts `targetType: 'event' | 'user_profile' | 'chapter'`; `PublicPageActions`
is mounted on `app/[slug]/page.tsx` and `/u/*` only — **never under `app/v/`** — and prod's
`user_reports_target_type_check` allows `photo, comment, user, ai_output, event, user_profile,
chapter`. **No vendor or shop anywhere.** A couple who meets a misrepresenting shop has no route.

- Anchor: `git grep -n "targetType" origin/main -- apps/web/app/_components/report-page-button.tsx` ·
  `git grep -n "PublicPageActions" origin/main -- apps/web/app` ·
  `select pg_get_constraintdef(oid) from pg_constraint where conname='user_reports_target_type_check';`
- ⚠ Extending a CHECK vocabulary: **a re-listed CHECK drops a later value** if you retype the list
  from an old migration. Read the live constraint first and add to what is actually there. The
  PGlite replay catches this — let it.
- ⚠ The report must reach somewhere a human looks. An emitted report with no desk is a tray badge
  reaching nobody; find the existing admin reports desk and route to it rather than building a second.
- **Property:** a shop page offers a report route, and a filed shop report lands on the desk a human
  already opens. Assert both ends — **either half alone is indistinguishable from neither.**
- 🔑 The agent that found this flagged it as arguably outside "fully functional for a wedding at
  minimum." It is a trust-and-safety gap, not a feature gap. **If the bundle is tight, drop it and
  say so** — but it should not be forgotten before the marketplace has strangers in it.

---

## ➕ ADDED 2026-09-21 (second pass) — found by walking the LIVE site, logged out

### 10 — A shop page contradicts itself, on a shop the front door features
`https://setnayan.com/setnaprod` renders **"SERVICES OFFERED · Pabati · Day Of Coordinator"** near the
top and, further down, **"SetnaProd hasn't listed a service you can ask about yet."** The Inquire CTA
sits above both and leads to that dead end. SetnaProd is featured on the home page as a verified
"first shop" — and does **not** appear on `/explore` at all, because explore is service-card driven.

So a couple who clicks the front door's featured shop reaches a page that contradicts itself and
cannot be contacted.

- Reproduce logged out: `https://setnayan.com/` (the "first shops" row) → `/setnaprod` → `/explore`.
- **Find where the two lists come from — they disagree about what "a service" is.** One counts
  something the other does not (almost certainly active/priced vs merely present). **Make both read
  one resolver** rather than fixing the sentence; two mechanisms answering one question is the defect.
- **Property:** a shop's services section, its inquire state, and its presence on `/explore` all
  derive from the same predicate. Assert that a shop with no inquirable service says so **in one
  place only**, and that the home page does not feature a shop `/explore` will not list.

### 11 — A public promise the product cannot keep
Every shop page states: **"Bookings through Setnayan generate a review request 24 hours after the
event."** Three things are wrong with that sentence:
1. Nothing generates it — the review is gated behind `service_marked_complete_at`, which is set on
   **0 of 51** bookings, and no supplier is ever told to set it (that is **CTRL-B2 build 1**).
2. The code's own rule is **M=7 days / N=30 days** (`reviewState` in `lib/completion-handshake.ts`),
   not 24 hours. The page invents a third number.
3. `vendor_reviews` is empty, so this has never once happened.

- Anchor: `git grep -n "24 hours after" origin/main -- apps/web/app`
- ⚠ **Coordinate with CTRL-B2.** If B2 lands the completion chain, the sentence becomes *nearly*
  true and only the number is wrong. If B2 drops that build, the sentence must not survive as-is.
  **Fix the copy to match whatever the mechanism actually does — do not fix the mechanism here.**
- **Property:** the interval the page promises is the interval `reviewState` computes. Derive the
  displayed number from the same constant; a hand-typed duration in copy is how this drifted.

### 12 — The public shop address is a test artifact
Saysay's live, shareable web address is **`/saysay-live-band-and-hosting-fix`**. The `-fix` suffix is
leftover from a repair and is now a customer-facing URL on the only shop with real bookings.

- 🔑 **This is an owner call, not a silent fix.** Changing a slug breaks every link already shared,
  and this shop has been booked twice. **Do not rename it.** Bring it to the owner with the options
  (leave it · rename with a permanent redirect from the old slug) and whether a redirect mechanism
  exists. If there is no redirect, say so — that is itself the build.
