# HANDOFF AUDIT — THE COUPLE'S JOURNEY, END TO END

**Measured 2026-09-21** against `origin/main` @ `924538329` (read in a throwaway worktree —
**never** from `/Users/icecasasola`, and **not** from the primary checkout, which was sitting
**2290 commits behind `origin/main`** on `claude/front-door-drops-hero-for-anchor` when this ran)
and against **prod** (`njrupjnvkjkitfctetvi`, read-only).

⚠ **A HANDOFF IS NOT EVIDENCE — including this one.** Every row carries a greppable anchor or the
SQL that re-measures it. Re-measure before acting. No row cites a line number (RULE 0 §7).

---

## THE ONE NUMBER THAT FRAMES EVERY ROW BELOW

```sql
select e.display_name, e.event_date,
  (select count(*) from guests g where g.event_id=e.event_id) guests
from events e order by e.event_date nulls last;
```

**11 events · 9 weddings · 14 users (13 not internal) · 142 guests · 9 orders (6 paid, 6 receipted)
· 3 chat threads · 2 quotes · 51 event_vendors · 48 seat assignments.**

🛑 **NO WEDDING HAS EVER HAPPENED.** The only events past today are a song-desk test, a 0-guest
"Movie Night", and a Papic pool test. Every row tagged **NEVER EXERCISED** below is therefore a
*measured absence of evidence*, not a measured defect — and that distinction is the single most
important thing in this document.

---

## THE REGISTER

Ranked: money/own-event lies first → dead ends → absence. Effort S ≤ ½ day · M ≤ 2 days · L > 2 days.

| # | Stage | Symptom a real couple hits | Anchor (greppable / SQL) | Class | Impact | Eff |
|---|---|---|---|---|---|---|
| 1 | Suppliers | Searching the marketplace returns **one** supplier. Every "find your team" surface is technically working and commercially empty. | `select count(*) from vendor_profiles where is_published` → **1**; `vendor_services where is_active` → **2**; `platform_package_catalog` → 4 | NOT BUILT (supply, not code) | Loses money — the whole funnel has nothing to sell | L |
| 2 | Contracts | `/contracts` and `/documents` say *"No contracts yet. Vendors will upload PDFs here once you agree on terms in chat."* For the 8 `host_manual` + 43 unsourced suppliers a couple actually uses, **no such vendor account exists**, so that sentence can never come true. The couple cannot upload their own signed PDF. | empty-state string `Vendors will upload PDFs here` in `app/dashboard/[eventId]/documents/page.tsx`; only writer is `app/vendor-dashboard/contracts/actions.ts` + `app/vendor/lock/[token]/actions.ts`; `select count(*) from vendor_contracts` → **0** | BUILT BUT UNREACHABLE (for off-platform suppliers) | Misleads — promises a document that cannot arrive | M |
| 3 | Guests / invites | 142 guests hold a `qr_token` each; **2 have an email, 1 has a mobile.** There is no invitation send path of any kind, and no **bulk** "mark as given" — a 142-name list is 142 individual toggles. | `markGuestInvitationSent` in `app/dashboard/[eventId]/invitation/actions.ts` (the only guest writer); `select count(*) from guests where invitation_sent_at is not null` → **0**; `select kind,count(*) from email_deliveries group by 1` → no invitation kind ever | BUILT BUT INCOMPLETE | Annoys hard; blocks the Invite step from ever completing | M |
| 4 | Save-the-date | The launch **does** fan out emails (`fanOutSaveTheDateEmails`) — and would reach **2 of 142 guests**. One event has ever launched an STD and it had 0 guests. | `fanOutSaveTheDateEmails` in `lib/save-the-date-emails.ts`; `select count(*) from guests where std_sent_at is not null` → **0**; `select count(*) from events where std_launched_at is not null` → **1** | BUILT · NEVER EXERCISED | Misleads if sold as "we'll tell your guests" | S (copy) |
| 5 | Story (after) | `/dashboard/[eventId]/website/stories` — the host choosing which supplier-authored stories appear on their celebration (owner, 2026-08-15) — **has no link from anywhere in the app.** Only its own `actions.ts` names the path. | `git grep -n "website/stories" -- app lib` → only `website/stories/actions.ts` + two test files | BUILT BUT UNREACHABLE | Misleads — a shipped host control nobody can open | S |
| 6 | Day-of | The coordinator-broadcast card on the event Home renders a **stub** with a "Coming soon" pill whenever `NEXT_PUBLIC_COORDINATOR_P3_ENABLED` is off. Flag IS set in prod — **value unverified** (see *could not verify*). | `CoordinatorBroadcastStub` in `app/dashboard/[eventId]/_components/day-of-mode/coordinator-broadcast-card.tsx`; `isCoordinatorP3Enabled` | FLAG-GATED | Misleads only if the owner believes it ships | S (verify) |
| 7 | Live | Panood → your own YouTube channel is `ComingSoonPlaceholder` — *"Setnayan's YouTube OAuth verified-app review is still in progress"*. Blocked on Google, not on us. | `ComingSoonPlaceholder` in `app/dashboard/[eventId]/studio/panood/setup/page.tsx`; `YOUTUBE_OAUTH_CLIENT_ID` **is** set in prod | DECIDED-BUT-UNBUILT (external) | Honest today; becomes a lie the day review clears and nobody flips it | S |
| 8 | Papic (money) | Guest Papic purchasing is switched **on** in prod and has **never taken a single peso**. | `NEXT_PUBLIC_PAPIC_GUEST_BUY` SET in prod (`vercel env ls production`); `select count(*) from papic_guest_orders` → **0**; `papic_guest_captures` → 0 | BUILT · NEVER EXERCISED | Unknown money surface — an unproven checkout is a money risk | M (proof run) |
| 9 | Papic (play) | 631 challenges and 75 missions are seeded; **zero completions ever.** | `select count(*) from papic_mission_completions` → **0** vs `papic_challenge_library` → 631 | BUILT · NEVER EXERCISED | — | M (proof run) |
| 10 | After | `event_recaps`, `guest_souvenir_claims`, `live_studio_highlights`, `person_story_items` are all **0 rows**. The whole after-the-event arc is untested against real data. | `select count(*) from event_recaps` (and the three siblings) | BUILT · NEVER EXERCISED | — | L (proof run) |
| 11 | Reviews | Not one review exists. The gate itself is correct and cron-free (`reviewState` evaluates M=7d / N=30d against `now()`), and the doors exist in three places. It has simply never fired because no wedding has passed. | `select count(*) from vendor_reviews` → **0**; `reviewState` in `lib/completion-handshake.ts`; doors in `plan-budget-accordion.tsx`, `build-locked.tsx`, `vendors/[vendorId]/workspace/page.tsx` | BUILT · NEVER EXERCISED | — | S (proof run) |
| 12 | Completion | `completion_status = 'auto_confirmed'` has **readers in 8 files and no writer anywhere.** Harmless today because `reviewState` derives the same outcome from elapsed time — but any surface that filters on the literal string will under-count forever. | `git grep -n auto_confirmed -- app lib` → readers only; `lib/admin/app-performance-stats.ts` filters `.in('completion_status', ['confirmed','auto_confirmed'])` | BUILT BUT PARTLY DEAD | Misleads admin metrics, not the couple | S |
| 13 | Quotes | `vendor_status` defines `shortlisted · delivered · complete`. Prod has only `considering · contracted · deposit_paid`. `shortlisted` is written **only** by `lib/reusable-bookings.server.ts`, whose flag is **not set in prod**, so the state is currently unreachable; several readers still filter on it. | `select status,count(*) from event_vendors group by 1`; `NEXT_PUBLIC_REUSABLE_BOOKINGS_ENABLED` **ABSENT** from prod | BUILT BUT UNREACHABLE | Annoys — `checklist-state.ts` `one_option`/`searching` states can never be entered | M |
| 14 | Errors | 73 couple-dashboard Supabase calls still discard their `error`, tracked as debt. Highest-stakes of these are guest writes (`guests.update` in `claims/actions.ts` ×4) — a refused write leaves the screen unchanged and says nothing. | `grep "dashboard/\[eventId\]" apps/web/lib/supabase-unread-error.baseline.txt` → 73 of 369 | BUILT BUT BROKEN (degraded) | Misleads about their own guest list | L (whole file) |
| 15 | Paperwork | Government paperwork upload is shipped (`uploadPaperworkScan`) and **no couple has ever used it**; `event_appointments` is 0 too. | `uploadPaperworkScan` in `app/dashboard/[eventId]/paperwork/actions.ts`; `select count(*) from event_paperwork` → **0** | BUILT · NEVER EXERCISED | — | S (proof run) |
| 16 | Budget | `event_costs` (money with no supplier — rings, licence, tips) is shipped with a door on `/budget` and has **0 rows**. `budget_builds` is also 0. | `cost-actions.ts` `from('event_costs').insert`; `select count(*) from event_costs` → **0** | BUILT · NEVER EXERCISED | — | S (proof run) |
| 17 | Payments | The only payment rail is the **manual QR overlay**: the couple scans, pays, uploads proof, an admin matches. Maya automation is dark. Every peso Setnayan has taken went through a human. | `MAYA_APPROVED` in `app/api/v1/billing/initialize-maya/route.ts`; `NEXT_PUBLIC_MAYA_STATUS` **ABSENT** from prod | DECIDED-BUT-UNBUILT | Operational ceiling on revenue, not a lie | L |
| 18 | Payments | 3 recorded supplier deposits sit with `vendor_confirmed_at IS NULL` — the supplier never acknowledged them. | `select count(*) from event_vendor_payments where vendor_confirmed_at is null` → **3** | DATA, not a defect | Worth one look: is the nudge reaching them? | S |
| 19 | Video | No video has ever been rendered. `patiktok_render_jobs`, `patiktok_source_clips`, `render_jobs` are all 0; there is no `remotion` workspace under `apps/`. | `select count(*) from patiktok_render_jobs` → **0**; `ls apps/` → `mobile`, `web` | DECIDED-BUT-UNBUILT | V1 promise ("template-driven renders") is not shippable today | L |
| 20 | Day-of triggers | The guest-side run-of-show trigger is off — `NEXT_PUBLIC_GUEST_NOW_TRIGGER` is **absent from production**. | `vercel env ls production \| grep GUEST_NOW_TRIGGER` → nothing | FLAG OFF | Annoys | S (flip + verify) |

---

## WHAT I CHECKED AND FOUND **HEALTHY** (do not re-report these)

- **`invitation_sent_at` has a writer** — `markGuestInvitationSent` (guests) and `sponsors/actions.ts`
  (sponsors). The `CLAUDE.md` claim that it was done is **true**. Row 3 above is about *volume*, not
  the writer's existence.
- **Entourage walking order + Move ↑/↓ + pairing are live on `origin/main`** — `entourage-order-actions.ts`,
  `walking-order-lines.tsx`, `pair-actions.ts` calling the `pair_guests` RPC. Verified by
  `git log origin/main -- …/entourage-order-actions.ts` (4 commits).
- **The payment page rebuild landed** — `app/pay/[reference]` with `payAmount` shared between the
  printed figure and `mintOrderQr`, guarded by `the-figure-and-the-qr-agree.test.ts`.
- **The money resolver is sound** — `resolveEventMoney` in `lib/budget-truth.ts` enforces
  `committed + overpaid === paid + stillOwed` and never lets an estimate into `committed`.
- **`deposit_paid_php` vs the payment log is already reconciled.** Prod *does* disagree for two
  suppliers (₱3,350 and ₱2,000 logged, `deposit_paid_php` NULL) — and `lib/paid-to-vendor.ts` is the
  one reader every money surface goes through, so nothing prints ₱0. Verified, not a gap.
- **The completion handshake is cron-free and correct** — `reviewState` computes M=7d/N=30d against
  `now()`, so "auto-confirms after 7 days" is a true promise with no scheduler behind it.
- **The quote → lock → pay chain HAS run end to end**, once, very recently:
  `select kind,max(created_at) from email_deliveries group by 1` shows `lock_request_received` and
  `lock_request_agreed` on 2026-09-19 and `order_paid` on 2026-09-20.
- **Email is configured and delivering** — `RESEND_API_KEY` is set in production; 20 accepted
  deliveries, latest today.
- **Every "orphan" route I chased turned out to be a deliberate redirect** — `/design`, `/progress`,
  `/today`, `/for-you`, `/website/launch`, `/website/editorial`, `/studio/papic/crew/poster`,
  `/studio/editorial-pro`. `lib/routes.ts` + `scripts/lint-routes.mjs` are doing their job.
  **`/website/stories` is the single real exception** (row 5).

---

## WHAT I COULD NOT VERIFY

1. **The prod VALUES of the feature flags — only whether each is set.** `filter_project_envs` with
   `decrypt` was **refused by the permission system** (Credential Materialization), and the
   un-decrypted Vercel API call returned **403 forbidden**. `vercel env ls production` from the repo
   root works and gives set/not-set, which is what rows 6, 8, 13, 17 and 20 rest on.
   🔑 **Set ≠ true.** `NEXT_PUBLIC_COORDINATOR_P3_ENABLED` being present says nothing about whether
   it reads `1`. Anything in this file that turns on a flag's *value* needs thirty seconds in the
   browser, per the standing rule: **a flag's default in code is not its value in production.**
2. **Anything behind a login.** I did not sign in as `testnayan1`, so no claim here rests on a
   rendered couple page — only on the source, the route graph, and prod rows.
3. **Whether the three unacknowledged supplier deposits (row 18) ever produced a nudge.** Reading
   `edge_logs` for the notification path was out of scope for a read-only pass.
4. **Whether rows 8–11, 15 and 16 are defective.** They have never run in production. "Never
   exercised" is the honest verdict; calling them working *or* broken would be an invention.

---

## HOW TO RE-MEASURE THIS WHOLE FILE

```sql
-- the frame
select (select count(*) from events) e, (select count(*) from guests) g,
       (select count(*) from orders) o, (select count(*) from chat_threads) t,
       (select count(*) from vendor_reviews) r, (select count(*) from vendor_contracts) c;
-- has a wedding happened yet?
select display_name, event_date from events where event_date < current_date order by event_date;
```

```bash
git worktree add --detach /tmp/wt-read-couple origin/main   # never read code from ~ or a stale branch
cd /tmp/wt-read-couple/apps/web
git grep -n "website/stories" -- app lib                     # row 5
git grep -n "auto_confirmed" -- app lib                      # row 12
grep -c "dashboard/\[eventId\]" lib/supabase-unread-error.baseline.txt   # row 14
cd <repo root> && vercel env ls production                   # rows 6, 8, 13, 17, 20
```
