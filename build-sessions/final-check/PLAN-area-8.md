# Final check · PLAN · Area 8 · Admin console

**Date:** 25 Nov 2026 · Fable planner for area 8 · plan and drawings only, no app code changed.
**Sources:** `ALL-FINDINGS.md` (this branch) · `area-8.md` on `final-check/area-8` (search the short ID, e.g. `D-4`) · `FINAL-CHECK-OWNER-ADDS-2026-11-25.md` (Adds 1–25 win) · the house design standard.
**Drawings:** specs repo `iscasasola/Setnayan-specs`, `prototypes/final-check-area-8_2026-11-25/final-check-area-8_2026-11-25.html` (one file, 18 sections, Now beside Proposed, 375 and 1280, light and dark).

## Rules every batch keeps

- Lane A changes HOW something shows or refuses. It never changes an amount, a fee, a plan's contents, who may pay or sign in, or which price is read. If the true fix would, mark the entry 🟠 in the PR body and skip it.
- One branch and one draft PR per batch: `claude/fc-fix-a8-bK`, label `do-not-auto-merge`, from fresh `origin/main`, merge commits only.
- Every fix carries a test that holds the claim itself (not a proxy). Source-scanning guards use `lib/strip-comments.ts`. Server actions stay at 1251 (fold, never raise). No migrations unless the finding needs one.
- Failed-read fixes use the shipped parts: `ReadFailed` / `TemplateFail` / `ErrorState`, and the three-way split (read failed ≠ empty ≠ zero).
- Shared sweeps are built only by the area named first in their list. Area 8's members are listed at the end of lane A so nobody fixes them twice.

## Lane A · 123 entries · 10 batches (guards first)

Order of batches: A1 (guards) → A2 (money desks) → A3 (prices and offers) → A4 (decisions that fail silently) → A5 → A6 → A7 → A8 → A9 → A10.
Order inside a batch: the table order (money-signin and broken first, then wrong, then look). Component tests render the surface with the read forced to fail; unit tests call the action or helper; source guards scan the named files.

### Batch A1 · Missing admin guards (server gates, fail closed)

IDs (13): A8·L-1 · A8·L-2 · A8·L-8 · A8·C-3 · A8·G-4 · A8·D-1 · A8·D-3 · A8·D-4 · A8·B-2 · A8·D-2 · A8·F-17 · A8·A-1 · A8·E-2

| # | ID | Sev | Where · file | Fix (the claim) | Test that holds it |
|---|---|---|---|---|---|
| 1 | A8·L-1 | money-signin | /admin/verification-docs `verification-docs-server.ts` | Government-ID shelf is read with the service role behi… → The page calls `requireAdmin()(code)lib/admin/require-a… | source guard: `verification-docs/page.tsx` calls `requireAdmin()` before any `createAdminClient()` read |
| 2 | A8·L-2 | wrong | /admin/demand | Three more pages lean on the layout gate alone → Every /admin page checks for an admin server-side itself. | source guard over every `app/admin/**/page.tsx`: each calls `requireAdmin()` itself (allow-list empty); `/admin/demand` runs no `after()` rebuild before the gate |
| 3 | A8·L-8 | money-signin | /admin/categories `areas.ts` | "Catalogue · Escalated" is never enforced → `lib/admin/areas.ts` `ADMIN_AREA_LIST` row `catalogue`: Escalated = "hide for everyone · combin… | unit: each catalogue write (delete, combine, hide-for-everyone, retire) and each money-desk action (payouts, subscriptions, founder-seats, launch-offer, booking-fees, payment-options) refuses an admin without the area level via `requireAdminCan`; source guard lists every action file |
| 4 | A8·C-3 | money-signin | /admin/approvals `actions.ts` | Approve, Reject and Mark handled read with the service-role client before the a… → The admin gate runs before any createAdminClient() read. | source guard: in `approvals/actions.ts` the admin gate is the first await, before any `createAdminClient()` |
| 5 | A8·G-4 | money-signin | /admin/background-videos `route.ts` | Any signed-in account can upload into the homepage background-vi… → An admin check on the server for the site's own `homepage-bg/(co… | route test: `background-videos/route.ts` answers 403 for a signed-in non-admin and writes nothing to `homepage-bg/` |
| 6 | A8·D-1 | money-signin | /admin/account-deletions `actions.ts` | Approving a deletion marks it "approved" before any area, self… → Deletions · Escalated ("approve a deletion", `lib/admin/areas.ts… | unit: `approveDeletion` without Deletions · Escalated returns a refusal and the row stays `pending` |
| 7 | A8·D-3 | money-signin | /admin/event-deletions `actions.ts` | Removing an event never checks Deletions · Escalated → "remove an event" is Deletions · Escalated (`ADMIN_AREA_LIST`), so it should… | unit: `removeEvent` checks `requireAdminCan(deletions, escalated)` first; refused → no write, no notice |
| 8 | A8·D-4 | money-signin | /admin/accounts `actions.ts` | The supplier invite gives a free paid plan without the Plans or Gif… → The same gate as `setVendorTier` ((code)) or `issueVendorSkuComp` (g… | unit: the supplier invite that grants a paid plan runs the same gate as `setVendorTier` / `issueVendorSkuComp` |
| 9 | A8·B-2 | money-signin | /admin/pricing `actions.ts` | Most price writes skip the "Prices & promos · Escalated" check that… → Every price change checks (code). `lib/admin/areas.ts` says Escalated… | source guard: every exported price write in `pricing/**/actions.ts` calls the Prices & promos · Escalated check |
| 10 | A8·D-2 | money-signin | /admin/account-deletions `actions.ts` | The internal-account guard on erasure lets the erase run when its read fails → An unread target refuses the erase. | unit: when the internal-account read errors, the erase is refused (fail closed) and nothing is deleted |
| 11 | A8·F-17 | wrong | /admin/live-studio-channels `actions.ts` | The "don't disconnect a checked-out channel" guard is skipped when its read fails → Refuse (fail closed). | unit: when the checked-out read errors, disconnect is refused |
| 12 | A8·A-1 | money-signin | /admin/payments `actions.ts` | The duplicate-reference check is skipped when the payment's own row can't be read → The approval is refused with "couldn't check". | unit: approve with an unreadable payment row returns "couldn't check" and approves nothing |
| 13 | A8·E-2 | money-signin | /admin/force-majeure/[flagId] `actions.ts` | A resolved force-majeure flag can be re-resolved, overwritin… → A resolved flag is closed to re-resolution, like resolveDispu… | unit: `resolveForceMajeure` on a resolved flag returns "already resolved" and leaves the row and audit untouched |

### Batch A2 · Money desks: payments, receipts, payouts

IDs (13): A8·A-2 · A8·A-3 · A8·A-10 · A8·A-11 · A8·A-18 · A8·A-19 · A8·A-20 · A8·A-8 · A8·A-7 · A8·A-22 · A8·A-23 · A8·A-21 · A8·A-5

| # | ID | Sev | Where · file | Fix (the claim) | Test that holds it |
|---|---|---|---|---|---|
| 1 | A8·A-2 | money-signin | /admin/payments `error.tsx` | Refund refusals and the two-admin request show up as a crash, with th… → An inline notice: "needs a second admin, request open in Approvals". | component: a refund refusal and the two-admin request render the inline notice; `error.tsx` is not reached |
| 2 | A8·A-3 | money-signin | /admin/payments | The shortfall notice says "₱0 received" when the payments read fails → "Couldn't check what was received", with no peso figure. | component: payments read failed → "Couldn't check what was received", no ₱ figure in the notice |
| 3 | A8·A-10 | money-signin | /admin/payments `actions.ts` | A failed receipt write is silent on approve → The desk says the receipt didn't issue. | unit: approve with a failed receipt write returns a notice that the receipt did not issue |
| 4 | A8·A-11 | money-signin | /admin/payments `desk.tsx` | The desk says "Nothing to reconcile." and hides unmatched BDO money → The From-your-BDO block, its failure line and the drop tile still show. | component: empty queue + unmatched BDO rows still draws From-your-BDO, its failure line and the drop tile |
| 5 | A8·A-18 | broken | /admin/payments `actions.ts` | "Read it" throws the admin out of the payment it was reading → It returns to the same opened payment, where the read card shows the result. | unit: "Read it" redirects to the same opened payment (`open=` kept) |
| 6 | A8·A-19 | broken | /admin/payments `received.ts` | "Set aside" with nothing picked does nothing → The button is disabled or says "Pick a reason" (as "Not received" does). | component: "Set aside" is disabled, or says "Pick a reason", until a reason is picked |
| 7 | A8·A-20 | wrong | /admin/payments | "Event today 0" and "Nobody has read this picture yet" appear on failed reads → "Couldn't read" in place of the number or the card text. | component: failed reads print "Couldn't read" in place of "Event today 0" and the picture line |
| 8 | A8·A-8 | money-signin | /admin/money `transactions-ledger.tsx` | Totals over a 200-row cap are shown as whole totals → Totals cover every row, or the tile says "newest 200". | unit: ledger totals come from an uncapped sum, or the tile is labelled "newest 200" |
| 9 | A8·A-7 | money-signin | /admin/receipts | The receipt month filter uses the server's UTC month, labelled as a Manila month → The Manila calendar month, which BIR reconciliation needs. | unit: the receipt month filter uses the Manila month at 00:30 PHT on the 1st (UTC is still last month) |
| 10 | A8·A-22 | wrong | /admin/receipts | The month picker offers only the months already on screen → Every month that has receipts. | unit: the month picker lists every month that has receipts, not only the page on screen |
| 11 | A8·A-23 | wrong | /admin/payouts | Payout times show in UTC → Manila time, as Subscriptions and Payment options use. | unit: payout times format in Asia/Manila |
| 12 | A8·A-21 | wrong | /admin/subscriptions | Subscriptions: "Unknown supplier" when the names read fails → "Couldn't read the supplier". | component: names read failed → "Couldn't read the supplier", never "Unknown supplier" |
| 13 | A8·A-5 | money-signin | /admin/settings/payment-methods | Prices and peso amounts are typed into the Payment methods copy → No peso figure typed in code. | source guard: no ₱ literal in the Payment methods copy; figures come from the catalogue reader |

### Batch A3 · Prices, offers, gifts, founder seats

IDs (14): A8·B-1 · A8·B-4 · A8·B-7 · A8·B-8 · A8·B-9 · A8·B-10 · A8·B-16 · A8·B-6 · A8·A-9 · A8·A-6 · A8·F-1 · A8·F-3 · A8·F-23 · A8·A-24

| # | ID | Sev | Where · file | Fix (the claim) | Test that holds it |
|---|---|---|---|---|---|
| 1 | A8·B-1 | money-signin | /admin/pricing `price-control-actions.ts` | A failed sign-up discount read counts as 0%: it is shown, and… → A refused discount read says "Couldn't read" and blocks the s… | unit: a refused sign-up discount read returns unread; the UI says "Couldn't read" and Save is blocked |
| 2 | A8·B-4 | money-signin | /admin/pricing `pricing-surface.tsx` | Booking fee form fills in code values when the settings read fails, and still offers Save → "Couldn't read" with saving off. | component: settings read failed → "Couldn't read", booking-fee Save off |
| 3 | A8·B-7 | money-signin | /admin/pricing `v2-catalog.ts` | Free windows says there are no services when the catalogue read fails → "Couldn't read the services" with Create turned off. | component: catalogue read failed → "Couldn't read the services", Create off |
| 4 | A8·B-8 | money-signin | /admin/pricing `pricing-surface.tsx` | Under a failed catalogue read, empty-state copy still shows beneath the banner → Nothing below the banner claims an empty state. | component: under the failed-read banner no empty-state copy renders |
| 5 | A8·B-9 | wrong | /admin/pricing `free-windows-surface.tsx` | Supplier free windows print the plan's code key ("Solo" / "Enterprise") → "Plus" / "Ultra". | unit: supplier free windows print "Plus" / "Ultra" via `TIER_LABEL`, never the code key |
| 6 | A8·B-10 | wrong | /admin/pricing `pricing-surface.tsx` | Supplier add-on rows say "(Supplier Ultra)" → "Ultra". The owner ruled on 14 Nov "NO 'SUPPLIER'" (`TIER_LABEL` comment in (code)). | source guard: no "(Supplier " in pricing surfaces; rows read `TIER_LABEL` |
| 7 | A8·B-16 | wrong | /admin/pricing `catalog-editor.tsx` | Picking a kind with no prices says 'Nothing matches "".' → An empty state that says nothing of that kind is on sale. | component: a kind with no prices and an empty query shows the nothing-on-sale empty state |
| 8 | A8·B-6 | money-signin | /admin/budget-planner | Budget planner saves hide every failure, and a typo clears a price → A refusal shows a plain reason. | unit: a budget-planner save refusal returns a plain reason; a non-number is rejected, not saved as empty |
| 9 | A8·A-9 | money-signin | /admin/discount-codes/new `v2-catalog.ts` | A failed catalog read shows "No active services in the catalog right n… → "Couldn't read the catalog", and Create is held back. | component: catalogue read failed → "Couldn't read the catalog", Create held back |
| 10 | A8·A-6 | money-signin | /admin/founder-seats `actions.ts` | Founder seat grant matches emails with a wildcard; failed reads read as "no account" / "already empty" → An exact email match. | unit: founder seat grant matches the email exactly (no wildcard); a failed read is "couldn't read", not "no account" |
| 11 | A8·F-1 | money-signin | /admin/gifts `gift-limit-settings.server.ts` | Gift limit shows the built-in default as the live setting w… → "Couldn't read" where the % sits, and no Save over a value n… | component: gift limit read failed → "Couldn't read" where the % sits, Save off |
| 12 | A8·F-3 | money-signin | /admin/gifts `v2-catalog.ts` | A refused catalogue read empties the deal and free-window price pic… → "Couldn't read the catalogue" in the What's free / Services rows, an… | component: catalogue refused → "Couldn't read the catalogue" in What's free / Services, pickers off |
| 13 | A8·F-23 | wrong | /admin/gifts | A failed supplier or user search says "No suppliers match" → "Couldn't search". | component: a failed supplier or user search says "Couldn't search" |
| 14 | A8·A-24 | wrong | /admin/offers | Gifts search: a failed read says "No suppliers match" → "Couldn't search". | component: a failed gifts search says "Couldn't search" |

### Batch A4 · Disputes, removals, verification: a decision never fails silently

IDs (13): A8·E-1 · A8·E-3 · A8·E-4 · A8·E-13 · A8·E-5 · A8·D-5 · A8·D-9 · A8·E-8 · A8·E-11 · A8·E-9 · A8·E-10 · A8·E-12 · A8·D-12

| # | ID | Sev | Where · file | Fix (the claim) | Test that holds it |
|---|---|---|---|---|---|
| 1 | A8·E-1 | money-signin | /admin/disputes | A settlement the database refused, or one that succeeded, is never shown to the admin → B is told it was already settled. | unit: a refused settlement and an already-settled one each return their own notice to the admin |
| 2 | A8·E-3 | money-signin | /admin/disputes `booking-fee-disputes-section.tsx` | Booking fee dispute shows "Fee ₱0" and a confident "no chat / no save" when i… → "Couldn't read" for each failed read. | component: each failed read on a booking-fee dispute says "Couldn't read", never "Fee ₱0" or "no chat" |
| 3 | A8·E-4 | money-signin | /admin/disputes `payment-disputes-section.tsx` | Dispute evidence silently disappears on a failed read → "Couldn't read" on the row, as QuoteVersionsEvidence already says… | component: evidence read failed → "Couldn't read" on the row |
| 4 | A8·E-13 | wrong | /admin/disputes `error.tsx` | Refusals arrive as the crash page instead of a plain reason → A plain reason plus Try again, on the same screen. | component: a refusal renders a plain reason + Try again on the same screen, not `error.tsx` |
| 5 | A8·E-5 | money-signin | /admin/force-majeure/[flagId] | A failed booking lookup makes a flag read "Whole event" and hides the deposit → Say the booking and deposit could not be read. | component: booking lookup failed → says the booking and deposit could not be read |
| 6 | A8·D-5 | money-signin | /admin/event-deletions | A failed cancel of unpaid bills is swallowed and the event is removed anyway → Stop with a failure. | unit: a failed cancel of unpaid bills stops the removal with a failure |
| 7 | A8·D-9 | broken | /admin/event-deletions | "Keep it" can fail to record yet still notifies the couple → A failure is shown and nothing is sent. | unit: "Keep it" with a failed write returns a failure and sends no notification |
| 8 | A8·E-8 | broken | /admin/verification-docs `actions.ts` | "Download" sends a team-member admin to the public home page with… → The page is hidden from people who can't use it, or the press says… | unit: Download for a team-member admin either works or returns a plain refusal; never a redirect to / |
| 9 | A8·E-11 | wrong | /admin/verification-docs | A storage failure still draws "Nothing here." on both shelves → Only the TemplateFail. | component: storage failure draws only the TemplateFail, no "Nothing here." |
| 10 | A8·E-9 | broken | /admin/verify | Verify actions land on the wrong surface or tab → Come back to the same surface, tab or shop with the result. | unit: each verify action redirects back to its own surface, tab and shop |
| 11 | A8·E-10 | wrong | /admin/verify | Three verify queues show "empty" copy when the read failed → Only the "couldn't load" line. | component: each of the three verify queues shows only "couldn't load" when its read failed |
| 12 | A8·E-12 | wrong | /admin/fraud `wipe-ban-dialog.tsx` | Wipe + ban request gives no sign it was opened; a second press cras… → The dialog closes with "sent — waiting for a second admin", and the… | component: a wipe + ban request closes with "sent — waiting for a second admin"; a second press is refused, no crash |
| 13 | A8·D-12 | wrong | /admin/accounts | The Delete and Blacklist confirms promise a hard-delete cascade that no longe… → The true erasure words, like account-deletions' `ERASURE_WORDS` ("Orders and… | source guard: Delete and Blacklist confirms read `ERASURE_WORDS` |

### Batch A5 · People, team and supplier work

IDs (12): A8·D-8 · A8·D-6 · A8·D-10 · A8·D-11 · A8·D-13 · A8·D-14 · A8·D-15 · A8·I-7 · A8·I-8 · A8·C-10 · A8·C-8 · A8·C-9

| # | ID | Sev | Where · file | Fix (the claim) | Test that holds it |
|---|---|---|---|---|---|
| 1 | A8·D-8 | broken | /admin/accounts | A comma in the Users or Venues search breaks the read and shows "Couldn't read" → Results. The Events tab already sanitises this (`eventWordFilters`, F-W2-37). | unit: a comma in the Users / Venues search is sanitised as `eventWordFilters` does; results return |
| 2 | A8·D-6 | money-signin | /admin/accounts `v2-catalog.ts` | Comp-grant service picker shows a failed catalog read as "No catalog SKUs found." → "Couldn't read" (the `services === null` path). | component: `services === null` → "Couldn't read", never "No catalog SKUs found." |
| 3 | A8·D-10 | wrong | /admin/accounts | The face-tagging switch on the Events tab never says whether it worked → "The database refused the face-tagging change", as (code) shows. | unit: the face-tagging switch returns a success or "The database refused the face-tagging change" |
| 4 | A8·D-11 | wrong | /admin/accounts `vendor-earnings.ts` | Rollups are silently cut at 1,000 rows on the Events and Demo tabs → Paged reads, or a disclosure when a read is capped. | unit: Events / Demo rollups page past 1,000 rows, or disclose the cap |
| 5 | A8·D-13 | wrong | /admin/accounts `next.config.ts` | The Demo tab contradicts itself and points to retired addresses → One true statement, and links whose labels match where they go. | source guard: the Demo tab links resolve (no retired address) and state one thing |
| 6 | A8·D-14 | wrong | /admin/team `team-ops.server.ts` | Team "Add" and "Save" give no sign anything happened, and a second p… → "Waiting on a second admin in Approvals", and one pending request per… | unit: Team Add / Save returns "Waiting on a second admin in Approvals"; a second press makes no second request |
| 7 | A8·D-15 | wrong | /admin/team | A failed owner check shows the owner as an ordinary admin with "No areas yet" → "Couldn't check the owner", never an unlocked row. | component: owner check failed → "Couldn't check the owner", row stays locked |
| 8 | A8·I-7 | wrong | /admin/vendor-recommendations | Recommendation map and supplier-flag queue show 0 and "nothing pending" when the reads fail → "Couldn't read", never zero or empty. | component: failed reads on the recommendation map and flag queue say "Couldn't read" |
| 9 | A8·I-8 | wrong | /admin/vendor-partnerships | Open proposals header says "(0)" and "No proposals awaiting" on a failed r… → The heading says "not measured", as the Live partnerships heading does. | component: open-proposals read failed → heading says "not measured" |
| 10 | A8·C-10 | wrong | /admin/work `supplier-work.server.ts` | Verification checks that fail to run show up as "no checks" on a Documents row → A line saying the checks could not run, before Approve. | component: checks that could not run print a line before Approve |
| 11 | A8·C-8 | wrong | /admin/work `supplier-inbox.tsx` | "From suppliers" filter shows "Documents 0" when that read failed → "—" or "couldn't read" beside that kind, and an "All" count that says it i… | component: Documents read failed → "—" beside it and an "All" count marked incomplete |
| 12 | A8·C-9 | wrong | /admin/work | Event-type read error is dropped, so the "It is this event type" picker is just empty → "Couldn't read the event types". | component: event-type read error → "Couldn't read the event types" |

### Batch A6 · Moderation and safety queues

IDs (13): A8·F-6 · A8·F-20 · A8·F-7 · A8·F-15 · A8·F-13 · A8·F-14 · A8·F-16 · A8·F-18 · A8·F-5 · A8·F-19 · A8·F-24 · A8·F-21 · A8·F-22

| # | ID | Sev | Where · file | Fix (the claim) | Test that holds it |
|---|---|---|---|---|---|
| 1 | A8·F-6 | broken | /admin/editorial-review `actions.ts` | Editorial unlock, resolve and re-scan ignore write failures, and a failed unlo… → The failure is shown, and nothing is sent to the couple. | unit: unlock / resolve / re-scan with a failed write return a failure and send nothing to the couple |
| 2 | A8·F-20 | wrong | /admin/editorial-review | A refused editorial read shows as "not found" → "Couldn't read this editorial". | component: a refused editorial read says "Couldn't read this editorial", not "not found" |
| 3 | A8·F-7 | broken | /admin/user-reports `actions.ts` | "Block uploader" can block nobody and still record "Uploader blocked" → The failure is shown and the report stays open. | unit: "Block uploader" with zero rows blocked returns a failure and the report stays open |
| 4 | A8·F-15 | wrong | /admin/user-reports `actions.ts` | An escalated user report shows as "Resolved" and drops out of every view → It stays visible as escalated until a person settles it. | unit: an escalated report keeps an `escalated` status that the default view lists |
| 5 | A8·F-13 | wrong | /admin/reviews `actions.ts` | Escalating an appeal closes it; no "two-admin queue" exists to receive it → The appeal lands in a queue someone works, as the notice promises. | unit: escalating an appeal lands it in a worked queue (Approvals) and leaves it open |
| 6 | A8·F-14 | wrong | /admin/reviews `actions.ts` | Reject or Escalate from a stale page overwrites an appeal that was already decided → "Already decided", nothing changed. | unit: Reject / Escalate on a decided appeal returns "Already decided" and changes nothing |
| 7 | A8·F-16 | wrong | /admin/live-studio-channels `live-studio-channel-grants.ts` | A refused grants read shows every channel as "Not connected" → "Couldn't read the connections". | component: a refused grants read says "Couldn't read the connections" |
| 8 | A8·F-18 | wrong | /admin/live-studio-channels | OAuth error codes and raw status values are shown to the admin → Plain words. | unit: OAuth error codes and raw statuses map to plain words (no code reaches the page) |
| 9 | A8·F-5 | broken | /admin/live-studio-channels `admin-pages.ts` | The "Live Watch channels" menu item opens a 404 while the Live… → The view is hidden while the flag is off (the page's own commen… | unit: the "Live Watch channels" menu item is absent while its flag is off |
| 10 | A8·F-19 | wrong | /admin/repost-watch | Failed reads show "No QR flags" and "No shop holds an allowance" → "Couldn't read" in place of the empty line. | component: failed reads say "Couldn't read" in place of "No QR flags" / "No shop holds an allowance" |
| 11 | A8·F-24 | wrong | /admin/integrity-watch | A refused open-count read hides the tab badge, which looks the same as "none open" → "—" on that tab. | component: a refused open-count read shows "—" on the tab |
| 12 | A8·F-21 | wrong | /admin/papic-storage | Storage totals can be quietly cut off at the database's row limit and still shown as measur… → The totals are paged to the end or marked as a lower bound. | unit: storage totals page to the end, or are marked a lower bound |
| 13 | A8·F-22 | wrong | /admin/papic-storage `backfill-tiles-button.tsx` | "Made 2 copys" → "Made 2 copies". | unit: plural of copy is "copies" |

### Batch A7 · Studio, colours and content

IDs (13): A8·G-5 · A8·G-6 · A8·G-7 · A8·G-3 · A8·G-8 · A8·G-9 · A8·G-10 · A8·G-11 · A8·G-12 · A8·G-16 · A8·F-8 · A8·F-25 · A8·P-B-12

| # | ID | Sev | Where · file | Fix (the claim) | Test that holds it |
|---|---|---|---|---|---|
| 1 | A8·G-5 | broken | /admin/studio `std-video-moderation.tsx` | "Open couple page ↗" goes to /{public_id}, which is not an Event Hub address → The couple's Event Hub (`publicEventPath(slug)`). | unit: "Open couple page" builds `publicEventPath(slug)` |
| 2 | A8·G-6 | broken | /admin/studio `studio.tsx` | The "Show the reveal on couple sites" switch saves a value nothing reads → The switch changes something, or it is removed. | source guard: the reveal switch has a reader, or the control is gone |
| 3 | A8·G-7 | broken | /admin/studio `widget-list.tsx` | On a phone, homepage widgets cannot be reordered → The Move buttons, which the file's own docblock promises for touch users. | component: at 375 each homepage widget row carries Move up / Move down |
| 4 | A8·G-3 | money-signin | /admin/studio | On Journal Spotlights, failed reads show as empty, "not for sale" or "no approval pending" → "Couldn't read" for each read that failed. | component: each failed Journal Spotlights read says "Couldn't read" |
| 5 | A8·G-8 | wrong | /admin/studio `reveal-config.ts` | When the Reveal Studio read fails, the locked defaults are shown as the live house settings → "Couldn't read", with the editor withheld. | component: Reveal Studio read failed → "Couldn't read", editor withheld |
| 6 | A8·G-9 | wrong | /admin/studio `spotlight-awards.ts` | When the Spotlight Awards read fails, it shows "No awards for this month yet" and zeroes → "Couldn't read". | component: Spotlight Awards read failed → "Couldn't read", no zeroes |
| 7 | A8·G-10 | wrong | /admin/studio `moodboard-library-surface.tsx` | Moodboard colour tags look empty when their read fails, and "S… → "Couldn't read" for the tags, and no save over an unread state. | component: colour-tag read failed → "Couldn't read", Save off |
| 8 | A8·G-11 | wrong | /admin/studio | Social queue: a failed evergreen read says "No evergreen items yet", and the autopilot form… → "Couldn't read", and the settings form withheld (as on Referrals). | component: evergreen read failed → "Couldn't read", autopilot form withheld |
| 9 | A8·G-12 | wrong | /admin/background-videos `background-videos.ts` | When the background-videos read fails, the page shows an empty editor with no message → "Couldn't read". | component: background-videos read failed → "Couldn't read" |
| 10 | A8·G-16 | wrong | /admin/pakanta `pakanta-deliver.tsx` | The Music Maker delivery copy says "couple's site" → Event Hub, as the next line of the same file already says. | source guard: no "couple's site" in `pakanta-deliver.tsx` (says Event Hub) |
| 11 | A8·F-8 | broken | /admin/colours `app-colours.ts` | The Liveliness switches and Icon tile colours save but change nothing ("applies in the next update") → No pressable "not yet" control. | source guard: no pressable control saves a value nothing reads (Liveliness, Icon tile colours) |
| 12 | A8·F-25 | wrong | /admin/colours `colours-editor.tsx` | "Reset to current" replaces the live colour set at once, though it… → A discard of the draft, or a clear label and confirm for an app-wide… | component: "Reset to current" only discards the draft, or is labelled and confirmed as app-wide |
| 13 | A8·P-B-12 | wrong | /admin/catalogue | Catalogue › Templates & media names Hub music and Songs but has no chip for them → see the finding in area-8.md | unit: every view named in a landing card line has a chip (no 6-chip cut that hides Hub music / Songs) |

### Batch A8 · Insights and app performance

IDs (12): A8·H-1 · A8·H-6 · A8·H-7 · A8·H-8 · A8·H-9 · A8·H-10 · A8·H-11 · A8·H-16 · A8·H-3 · A8·H-14 · A8·H-15 · A8·P-B-22

| # | ID | Sev | Where · file | Fix (the claim) | Test that holds it |
|---|---|---|---|---|---|
| 1 | A8·H-1 | money-signin | /admin/app-performance | A failed sales read shows ₱0 and flat bars under a "Live" pill → The sales card says "Couldn't read" or "—" where the peso figures would be. | component: sales read failed → "Couldn't read", no ₱0, no "Live" pill |
| 2 | A8·H-6 | wrong | /admin/app-performance | A refused Resolve, Ignore or Archive save says "Saved ✓"; Archive also leaves t… → A plain failure reason plus Try again, and the rows go back to Active. | unit: a refused Resolve / Ignore / Archive returns the failure; rows go back to Active |
| 3 | A8·H-7 | wrong | /admin/app-performance | Overview prints zeros and "nothing yet" copy when non-money reads fail → "—" or "Couldn't read" in each affected card. | component: failed non-money reads print "—" or "Couldn't read" per card |
| 4 | A8·H-8 | wrong | /admin/app-performance | "Fastest movers" says "not enough data" for every entity row, and its footnote is false → An entity row is either measured, or says it is not computed. | component: an unmeasured entity row says "not computed"; the footnote matches |
| 5 | A8·H-9 | wrong | /admin/app-performance | Operations says it is "Live" over a view that never refreshes; failed reads… → Stale numbers are labelled stale, and a failed read says "Couldn't read". | component: a stale view is labelled stale; a failed read says "Couldn't read" |
| 6 | A8·H-10 | wrong | /admin/app-performance `smoke-test-panel.tsx` | The Sentry smoke test reports success on a network failure → It says the test did not reach the server. | unit: the smoke test reports "did not reach the server" on a network failure |
| 7 | A8·H-11 | wrong | /admin/app-performance `route.ts` | Growth "Export CSV" writes 0 where a read failed → The CSV marks unread values, or carries an errors row. | unit: the growth CSV marks unread values (or an errors row), never 0 |
| 8 | A8·H-16 | wrong | /admin/app-performance `charts.tsx` | Comparisons don't name their period → Each comparison says what it compares against ("vs last month", "of previous step"). | component: every comparison names its period |
| 9 | A8·H-3 | money-signin | /admin/ugat/map `data.ts` | On the entity map, every failed count reads 0 and "live", orders and billing included → "Couldn't read" or "—", never 0. | component: a failed count on the entity map reads "—", never 0 / "live" |
| 10 | A8·H-14 | wrong | /admin/ugat `brain-surface.tsx` | A failed brain-chunk read shows 0 counts and "No chunks authored yet" in all eight topics → "—" in the KPI cards and no empty-state copy. | component: brain-chunk read failed → "—" in the KPI cards, no empty-state copy |
| 11 | A8·H-15 | wrong | /admin/ugat `actions.ts` | Menu edits report success when the database refuses them → A failure with its reason, and no audit row. | unit: a refused menu edit returns its reason and writes no audit row |
| 12 | A8·P-B-22 | wrong | /admin/app-performance?tab=papic-storage | A one-press job with no confirm, labelled like a fix → see the finding in area-8.md | component: the one-press Papic storage job is named for what it does and asks first (house confirm sheet) |

### Batch A9 · Setup: business, keys, switches, catalogue counts

IDs (10): A8·I-6 · A8·I-3 · A8·I-1 · A8·I-2 · A8·I-10 · A8·I-11 · A8·I-12 · A8·B-14 · A8·B-15 · A8·C-11

| # | ID | Sev | Where · file | Fix (the claim) | Test that holds it |
|---|---|---|---|---|---|
| 1 | A8·I-6 | broken | /admin/business `settings-surface.tsx` | The owner's numbers lost their only editor in the Settings → Busi… | unit: `saveBusinessIdentity` keeps the owner's numbers editable from Setup › Business (fields posted, round-trip) |
| 2 | A8·I-3 | money-signin | /admin/business | A failed settings read prints a VAT of 0, a 1970 "Last updated" and the de… → Every field says "Couldn't read" and every save is off, as the banner prom… | component: settings read failed → every field "Couldn't read", every Save off |
| 3 | A8·I-1 | money-signin | /admin/integrations `actions.ts` | Config saves ignore a failed platform_settings write and still sa… → A failed write shows a failure, like `saveOAuthField` / `savePayer… | unit: a failed `platform_settings` write returns a failure from each config save |
| 4 | A8·I-2 | money-signin | /admin/integrations | "Clear saved key(s)" always reports cleared, and the message always talk… → A failure says so. On success the notice names the integration that was… | unit: "Clear saved key(s)" reports failure on failure and names the integration on success |
| 5 | A8·I-10 | wrong | /admin/switches `sample-event-switch.tsx` | Sample switch states "Default — off" as fact while the default f… → The default row says what the env says, as the AI paywall row do… | component: the sample switch default row reads the env, as the AI paywall row does |
| 6 | A8·I-11 | wrong | /admin/switches `demo-mode-surface.tsx` | Demo-mode row is labelled "View /vendors" → Supplier wording, naming the real destination (the marketplace on Discover). | source guard: the demo-mode row says supplier and names the real destination |
| 7 | A8·I-12 | wrong | /admin/demand `demand-radar-card.tsx` | Admin radar copy promises a floor control that does not exist → The copy matches the page: no control writes radar_min_n_floor. | source guard: radar copy promises no floor control |
| 8 | A8·B-14 | wrong | /admin/categories | Categories counts and lists say "0" and "none waiting" when a read fails → "—", which the page's own banner promises ("anything that reads '—' below is unkn… | component: failed reads print "—" on Categories counts and lists |
| 9 | A8·B-15 | wrong | /admin/categories/requests `list-view.tsx` | Service requests state guesses as facts when reads fail → "Couldn't read" for each fact that failed. | component: each failed service-request fact says "Couldn't read" |
| 10 | A8·C-11 | wrong | /admin/admin-log | Admin log prints raw action and table names ("vendor tier set · vendor_profiles") → Plain words that say "supplier", and no table names. | unit: every admin-log action maps to plain words; no table name, no "vendor" |

### Batch A10 · Home, Work and the shell

IDs (10): A8·C-4 · A8·C-1 · A8·C-5 · A8·C-6 · A8·C-7 · A8·L-5 · A8·L-9 · A8·P-B-3 · A8·P-B-14 · A8·P-B-18

| # | ID | Sev | Where · file | Fix (the claim) | Test that holds it |
|---|---|---|---|---|---|
| 1 | A8·C-4 | broken | /admin `admin-destinations.ts` | "Answered on Focus" search rows open the Work list in Full mode → The in-place answer for that question. | unit: an "Answered on Focus" destination resolves to the in-place answer, not Work in Full |
| 2 | A8·C-1 | money-signin | /admin `focus-home.tsx` | Asking "payments to confirm" in Focus answers "0" when the payments count failed, and counts rows inste… → "Couldn't count" when the read failed. | unit: payments count failed → "Couldn't count"; the number counts payments, not rows |
| 3 | A8·C-5 | broken | /admin/help/guides | "Message us" in the team Help only scrolls the page → A real way to message someone, or a label that says what it does. | component: "Message us" opens a real message door, or is renamed for what it does |
| 4 | A8·C-6 | wrong | /admin/work `queues-triage-feed.tsx` | Work › All lane chips add the watch-only trails into "All N" → The chip agrees with the Next card's "N need you" (totalOpen leaves the tra… | unit: the "All N" chip equals `totalOpen` (watch-only trails left out) |
| 5 | A8·C-7 | wrong | /admin/work `tab-landing.tsx` | Work landing's "Waiting · across every queue" counts a watch trail and leaves out queues the Work… → The same total the Work list and Focus show. | unit: the Work landing "Waiting" total equals the Work list and Focus total |
| 6 | A8·L-5 | wrong | /admin/work `loading.tsx` | Nine pages, behind 39 of the area's 71 addresses, load with the overview… → The skeleton draws only what that page draws (HOUSE_DESIGN_STANDARD F1: "… | source guard: each of the nine pages has its own `loading.tsx`; the shared one is not the overview skeleton |
| 7 | A8·L-9 | wrong | /admin/discount-codes `middleware.ts` | Four forwards land somewhere other than the kit says; the kit reads the dead redirect → Kit § 4: (code), (code), (code), `/admin/work`. | unit: the four forwards land where kit § 4 says, with their `?tab=` |
| 8 | A8·P-B-3 | wrong | /admin/payments?view=fees | Fees owed: "Nothing waiting" over a list of 9 suppliers with fee owed ₱0 → One clear story: who owes what, and why a supplier is listed for review. | component: Fees owed never says "Nothing waiting" above listed rows; each row says why it is listed |
| 9 | A8·P-B-14 | wrong | /admin/payments?view=fees | Page titles: missing on four views, doubled on two → see the finding in area-8.md | source guard: every admin view has exactly one title |
| 10 | A8·P-B-18 | look | any admin address opened or re-opened wi | Offline, every new admin address is the browser's own error page → see the finding in area-8.md | offline walk: a new admin address with the signal off shows the app's offline screen, not the browser error |
### Files, batch by batch (all under `apps/web/`; paths checked on `origin/main`)

- **A1:** `app/admin/verification-docs/page.tsx` · `lib/verification-docs-server.ts` · `app/admin/demand/page.tsx` · `app/admin/venues/new/page.tsx` · `app/admin/more/page.tsx` · `lib/admin/require-admin.ts` · `lib/admin/areas.ts` · the actions under `app/admin/categories/` · `app/admin/{payouts,subscriptions,founder-seats,launch-offer,booking-fees,payment-options}/actions.ts` · `app/admin/approvals/actions.ts` · the background-videos upload `route.ts` · `app/admin/account-deletions/actions.ts` · `app/admin/event-deletions/actions.ts` · `app/admin/accounts/actions.ts` · `app/admin/pricing/actions.ts` + `price-control-actions.ts` · `app/admin/live-studio-channels/actions.ts` · `app/admin/payments/actions.ts` · `app/admin/force-majeure/[flagId]/actions.ts`.
- **A2:** `app/admin/payments/` (`actions.ts`, `error.tsx`, `received.ts`, `_components/desk.tsx`) · `app/admin/money/_components/transactions-ledger.tsx` · `app/admin/receipts/` · `app/admin/payouts/` · `app/admin/subscriptions/` · `app/admin/settings/payment-methods/`.
- **A3:** `app/admin/pricing/` (`price-control-actions.ts`, `_surfaces/pricing-surface.tsx`, `_surfaces/free-windows-surface.tsx`, `_components/catalog-editor.tsx`) · `lib/v2-catalog.ts` · `app/admin/budget-planner/` · `app/admin/discount-codes/new/` · `app/admin/founder-seats/actions.ts` · `app/admin/gifts/` · `lib/gift-limit-settings.server.ts` · `app/admin/offers/`.
- **A4:** `app/admin/disputes/` (`page.tsx`, `error.tsx`, `_components/booking-fee-disputes-section.tsx`, `_components/payment-disputes-section.tsx`) · `app/admin/force-majeure/[flagId]/` · `app/admin/event-deletions/` · `app/admin/verification-docs/` · `app/admin/verify/` · `app/admin/fraud/_components/wipe-ban-dialog.tsx` · `app/admin/accounts/` (the Delete and Blacklist confirm words).
- **A5:** `app/admin/accounts/` · `lib/vendor-earnings.ts` · `lib/v2-catalog.ts` · `next.config.ts` (Demo tab links) · `app/admin/team/` (`team-ops.server.ts`) · `app/admin/vendor-recommendations/` · `app/admin/vendor-partnerships/` · `app/admin/work/_components/supplier-inbox.tsx` · `lib/admin/supplier-work.server.ts`.
- **A6:** `app/admin/editorial-review/` · `app/admin/user-reports/actions.ts` · `app/admin/reviews/actions.ts` · `app/admin/live-studio-channels/` · `lib/live-studio-channel-grants.ts` · `lib/admin/admin-pages.ts` · `app/admin/repost-watch/` · `app/admin/integrity-watch/` · `app/admin/papic-storage/` (`backfill-tiles-button.tsx`).
- **A7:** `app/admin/reveal-studio/` (`std-video-moderation.tsx`, `studio.tsx`) · `app/admin/website/widget-list.tsx` · `app/admin/studio/_surfaces/` (`moodboard-library-surface.tsx`, the spotlights, awards and social-queue surfaces) · `lib/reveal-config.ts` · `lib/spotlight-awards.ts` · `lib/background-videos.ts` · `app/admin/pakanta/pakanta-deliver.tsx` · `app/admin/colours/_components/colours-editor.tsx` · `lib/app-colours.ts` · `app/admin/_components/tab-landing.tsx` (P-B-12 only: the 6-chip cut).
- **A8:** `app/admin/app-performance/` (`_components/charts.tsx`, the growth export `route.ts`) · `app/admin/operations-hiring/_components/smoke-test-panel.tsx` · `app/admin/ugat/` (`map/data.ts`, `_surfaces/brain-surface.tsx`, `actions.ts`).
- **A9:** `app/admin/settings/_surfaces/settings-surface.tsx` · `app/admin/business/` · `app/admin/integrations/` · `app/admin/settings/_components/sample-event-switch.tsx` · `app/admin/settings/_surfaces/demo-mode-surface.tsx` · `app/vendor-dashboard/demand/_components/demand-radar-card.tsx` (the admin radar copy) · `app/admin/categories/` · `app/admin/categories/requests/_components/list-view.tsx` · `app/admin/admin-log/`.
- **A10:** `app/admin/_components/` (`admin-destinations.ts`, `focus-home.tsx`, `tab-landing.tsx`) · `app/admin/help/guides/page.tsx` · `app/admin/queues/_components/queues-triage-feed.tsx` · `app/admin/work/loading.tsx` · `middleware.ts` · `app/admin/payments/` (the fees view) · the service worker's offline fallback for `/admin/*`.

### Area 8 members of shared lane A sweeps (built by the first-named area; listed so they are not fixed twice)

- SW-PHP (area 1 builds): A8·A-12 A-13 A-14 A-15 A-16 A-17 B-5 C-2 D-7 E-6 E-7 F-2 F-4 G-2 H-2 I-4 I-5
- SW-WORDS (area 1): A8·P-B-15 B-13 C-12 D-16 D-17 E-14 G-13 G-14 G-15 H-12 H-13 I-9
- SW-COMING (area 1): A8·H-5 · SW-RETNAME (area 1): A8·P-B-13 · SW-PLACE (area 1): A8·P-B-16 · SW-URI (area 1): A8·F-9 · SW-COMM (area 1): A8·H-4
- SW-HYDR (area 2): A8·P-B-1 · SW-TELE (area 6): A8·P-B-2
- The shared admin guards are area 8's own: batch A1.

## Lane B · 18 screens · drawing first

One line per screen. "§N" is the section in the drawings file. Nothing in lane B is built until this line says approved.

| § | ID | Screen | The change, in one line | Drawing | Status |
|---|---|---|---|---|---|
| 1 | A8·P-B-7 | /admin (1280) · /admin/payments Full (375, 768) | Top-bar search becomes the search icon on Focus; the desk's own reference box goes on a phone (the thumb row searches) | §1 | APPROVAL: pending controller |
| 2 | A8·P-B-8 | /admin (Focus) | Completions card loses its side stripe and sits in the content column | §2 | APPROVAL: pending controller |
| 3 | A8·D-29 | /admin/accounts · Users · Comp grants | The 5-part form becomes a full-screen popup (RiseScreen) over the list | §3 | APPROVAL: pending controller |
| 4 | A8·C-20 | /admin/approvals | Queue first; New request is a small popup (Sheet, 3 fields) | §4 | APPROVAL: pending controller |
| 5 | A8·P-B-11 | /admin/catalogue · /admin/work · /admin/app-performance | A card with nothing waiting keeps full strength; only the "0" is quiet | §5 | APPROVAL: pending controller |
| 6 | A8·A-29 | /admin/discount-codes/new | Create is a full-screen popup over Discount codes | §6 | APPROVAL: pending controller |
| 7 | A8·E-17 | /admin/disputes (also /admin/completions) | Resolve opens a small popup from the row; the sheet is the confirm | §7 | APPROVAL: pending controller |
| 8 | A8·F-30 | /admin/editorial-review/[id] | "● Vulgar" chip words take the danger colour on the soft fill | §8 | APPROVAL: pending controller |
| 9 | A8·C-15 | /admin/help/guides | Add the PageMasthead (an sr-only h1): no visible change | §9 | APPROVAL: pending controller · planner says lane A |
| 10 | A8·P-B-4 | /admin/business?view=accounts | The pinned title wraps on a phone instead of scrolling sideways | §10 | APPROVAL: pending controller |
| 11 | A8·D-30 | /admin/venues/new | New venue is a full-screen popup over People › Venues | §11 | APPROVAL: pending controller |
| 12 | A8·P-B-10 | /admin/work · /admin/catalogue · /admin/app-performance | The dotted line that repeats the chip names goes | §12 | APPROVAL: pending controller |
| 13 | A8·P-B-17 | any admin page, signal off (375) | The offline bar sits above the top bar; the shell moves down | §13 | APPROVAL: pending controller |
| 14 | A8·P-B-5 | every admin page (top bar) | The overdue chip is never cut: "1 overdue" at 1280, sign + number on a phone | §14 | APPROVAL: pending controller |
| 15 | A8·P-B-6 | every admin page (top bar, 768 and 1280) | "Setnayan Team" is a plain one-line label, no pill | §15 | APPROVAL: pending controller |
| 16 | A8·P-B-9 | every admin page at 1280 (rail) | The public footer leaves the admin rail | §16 | APPROVAL: pending controller |
| 17 | A8·P-B-20 | every admin page, Focus, 375 and 768 | Focus keeps the five-tab bar on a phone | §17 | APPROVAL: pending controller · planner says lane C (reverses the 14 Nov Focus / Full ruling) |
| 18 | SW-SELECT (A8·B-21 C-19 D-26 D-27 G-19 H-20 I-16) | /admin/categories faith pick stands for all 7 | Native select with 3+ choices becomes the PickMenu | §18 (the sweep's one reference drawing) | APPROVAL: pending controller |

### Build notes for lane B (for after approval)

- §3, §6, §11 use the shared `RiseScreen`; §4, §7 the shared `Sheet`. No hand-built layer, no popup on a popup, one shared backdrop, focus back on the opener, the list keeps its scroll. The old addresses (`/admin/discount-codes/new`, `/admin/venues/new`) forward to the list with the popup open, so bookmarks and the People ＋ still work.
- §6, §11 keep their server actions (move, do not add: the count stays 1251). §7 folds the `ConfirmForm` step into the sheet.
- §16 changes what `the-rail-lists-no-tools.test.ts` holds: update that guard so the footer is required on the public rail and absent inside `/admin` (never delete the guard).
- §13: the bar's height feeds `--gs-top`, so the sticky pinned row moves with the top bar.
- §14 on a phone keeps the full sentence in `aria-label`.
- §1 at 1280: the icon opens the same `AdminCommandPalette`; ⌘K stays.
- Motion: sheets and RiseScreens rise on Rise 700 with settle `cubic-bezier(.2,.8,.2,1)`; backdrop Quick 200; press Tap 100. Tokens only.
- Dark: every dark frame assumes SW-DARK has switched the written admin dark set on (A8·L-3) and keeps the white-lit glow on the top block. Each build proves a 390 px dark shot.
- 44 px touch floor on a phone; desktop rows stay denser.
- Add 15: the top-bar mark is whatever Admin › Business › Default brand icon holds; no drawing or build copies the mark.

### Area 8 members of other lane B sweeps (their reference drawing is the first-named area's)

SW-K2 (58 IDs) · SW-K1 (16) · SW-DIALOG (6) · SW-SKEL (10) · SW-POPPOP (A8·A-28 B-20 D-28) · SW-DARK (A8·P-B-19 L-3) · SW-SHADOW (A8·L-4) · SW-CONFIRM (A8·L-7 B-19 C-18 G-18 G-22 G-24) · SW-TAP (A8·P-B-21) · SW-SPIN (A8·L-6). Full lists: "Sweeps" in `ALL-FINDINGS.md`.

## Lane C and what the planner would move

- A8·G-1 (referral reward has no setter): lane C, owner first. Not planned here.
- **A8·P-B-20 (§17) reads as lane C:** the area report itself says it "may be intended by the 14 Nov Focus | Full ruling: owner's call". Drawn so the owner can see it, not to be built on a controller OK alone.
- **A8·C-15 (§9) reads as lane A:** the shipped `PageMasthead` is an sr-only h1, so adding it changes no pixel. Move it into batch A10.
- A8·L-8 and A8·D-4 (batch A1) enforce limits the Team grid already promises. If the controller wants "who can do what" ruled first, they are the two to hold as 🟠.
