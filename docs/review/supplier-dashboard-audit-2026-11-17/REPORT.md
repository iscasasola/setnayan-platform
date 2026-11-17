# Supplier dashboard audit · 2026-11-17

**Scope:** every supplier dashboard screen: Today · Clients · Calendar (Dates) · Shop · Services and card maker · Chat · Forms · Prints · Badges · Plans · Settings.
**Base:** `origin/main` @ `082aad9a`. Live `www.setnayan.com/api/health` could not be read from this session, so nothing here claims to describe what production serves.
**Method:**
- Six read-only code passes, one per screen group.
- Every HIGH finding I fixed was re-read in the source myself before the fix.
- The dev labs were run at **390 × 844** with Playwright: `supplier-lab`, `clients-lab`, `forms-lab`, `supplier-chat-lab`, `supplier-plan-lab`, `award-lab`. The check measured `scrollWidth`, flagged elements wider than the viewport, flagged tap targets under 44 px, and scanned for banned words.
- No production writes, no sign-ins.

**Checks per screen:**
1. Every button reaches a real place.
2. No failure renders like success or emptiness.
3. Copy rules: "supplier", never "vendor"; no "Event Hub" or "website" on supplier pages.
4. 390 px overflow.
5. Stuck spinners.
6. Dead links.
7. 44 px buttons and full-screen rises.

## 0 · What came back clean

| Check | Result |
|---|---|
| Dead links (1, 6) | **None found.** Every `href`, `router.push` and `redirect` target on all eleven screens resolves to a real route folder. This includes every row of `settings/settings-rows.ts` and the five policy links. `/vendor-dashboard/more` redirects once to Settings (no loop). `/calendar` and `/clients` are one-hop redirects into Customers. |
| Copy (3) | **No user-visible "vendor" or "Event Hub" string** on any screen in scope. There are two uses of "Your website" (`shop/_components/public-line-card.tsx`, `suggested-coverage-card.tsx`), but both mean the supplier's own outside site, not ours (see owner question Q4). |
| 390 px overflow (4) | All six labs measured `scrollWidth = 390`, with no element past the right edge and no tap target under 44 px. |
| Stuck spinners (5) | `SupplierSubmit`, `SubmitButton`, `StayForm` and `SaveFileLink` all reset on a refusal or a throw. One real stuck state was found, in Clients (C-7 below). |
| Button floor (7) | `app/globals.css` gives every `<button>`, `[role=button]`, `a.button` and `input[type=submit]` a `min-height: 44px`. **So most "`h-9` button" reports from a static read are false:** the rendered button is 44 px tall. The real gaps are plain `<a>` links (no floor), elements that set `min-h-0`, and buttons that are 44 tall but narrow. |

⚠ **Not measured:** `/dev/supplier-print-lab` returned **404** in dev, and `/dev/card-maker-lab` drew no `<body>` text in the time allowed. Prints and the card maker were therefore read in code only, not in a browser.

## 1 · The one disease: a failure that renders like success or emptiness

Almost every real fault found today has the same shape as the 2026-08-20 sweep:
- a read whose `error` is dropped, or a `.catch(() => [])`;
- the empty value then reaches the render as "No … yet", "Free", "0 of 3 papers", "Nothing waiting on you" or "Saved".

The honest pattern is already in the tree (`vendor-dashboard/reads-are-honest.test.ts`, `lib/guests.ts`). These sites escape that guard because they:
- destructure through a `.then(...)`,
- `.catch(() => [])` a function that throws, or
- live in a helper under `lib/`.

## 2 · Findings by screen

Severity: **H** = money, data loss, or a false statement about the supplier's own business · **M** = a false empty or a misleading lock · **L** = polish.
✅ = I re-read it in source myself. Unmarked = from the code pass, high confidence, not yet re-read. **P** = plausible, needs a second look.

### Today
| # | Sev | Where | Fault | Fix |
|---|---|---|---|---|
| T-1 ✅ | H | `vendor-dashboard/page.tsx` (`feeBillsRead === FEE_BILLS_UNREADABLE ? []`) | An unreadable fee-bill list became `[]`, so Today said **"Nothing waiting on you"** while a booking fee could be unpaid. The code comment says the opposite is intended. | **#7953** |
| T-2 | H | `lib/vendor-overview.ts` (`fetchVendorThreads(...).catch(() => [])`, meetings, unsent quotes) | A refused threads read drops every inquiry and owed reply. `deskIncomplete` does not include these reads, so Today reads "Nothing waiting on you" and **Inquiries 0**. | Next. Switch to `fetchVendorThreadsDetailed` and fold the result into `deskIncomplete`. Not shipped today, because it touches the `lib/` read that several in-flight Today PRs also read. |
| T-3 | H | `supplier-today-first-screen.tsx` ("No bookings yet") with `lib/vendor-overview.ts` (`bookingsComplete` computed, never used) | A refused room read or schedule read gives **"No bookings yet · Add the ones you already have"** to a shop with bookings. | Next. Return `bookingsComplete` and draw a "Couldn't load your bookings" row. |
| T-4 | L | `_components/today-settings.tsx`, `customers/_components/customers-settings.tsx` | The Today and Customers ⚙ menus open as a **half sheet** (`max-h-[52dvh]`), not full screen. | **In flight: #7760** (Settings v2 step 1 — "every ⚙ rises full screen"). Q1. |

### Calendar (Customers › Dates)
| # | Sev | Where | Fault | Fix |
|---|---|---|---|---|
| D-1 ✅ | **H (data loss)** | `calendar/actions.ts` `ownedServiceIds` | A refused read returned `[]`. `editCalendar` diffed that against the schedule, **unassigned every service**, ignored the delete's error, and said **"Schedule saved"**. `createCalendar` made the schedule empty and said "Schedule made". | **#7936** |
| D-2 ✅ | H | `calendar/actions.ts` `movePoolCategory` (`(count ?? 0) === 0`) | A refused count was read as 0, which **switched off a schedule that still had services**. | **#7936** |
| D-3 ✅ | H | `calendar/actions.ts` `notifyWaitlistSlot` | The count returned was thrown away, so the page always said **"Told them — the couples waiting know"**, even when nobody was waiting or the call threw. | **#7936** |
| D-4 | M | `lib/vendor-waitlist.ts` `fetchVendorWaitlist` with `dates-folds.tsx` ("Nobody waiting.") | A refused read says "Nobody waiting." and hides the notify button. | Next |
| D-5 | M | `customers/page.tsx` (`pools.length === 0` → "Set how many events you take a day") | `fetchVendorPools` is `…OrNull ?? []`, so a refused read tells a shop that already has schedules to set one up. | Next. Read `fetchVendorPoolsOrNull` directly. |
| D-6 | M | `calendar/actions.ts` `pickWaitlistCouple` (count and next-row reads) | A refused read says "No one is waiting", and `count ?? 0` lets a pick past the cap. | Next |
| D-7 | M | `calendar/actions.ts` `importExternalClient` (hall loop) and `setServiceHalls` | When the 2nd of N halls fails, the page says **"Nothing changed"** although hall 1 was written, so a retry duplicates it. | Next. Needs a partial-save notice or one RPC. Q2. |
| D-8 **P** | M | `customers/_components/customers-calendar.tsx` (`startTransition(async () => fetchMonth…)`, no catch) | One failed ‹ › month tap throws to the error boundary and replaces the whole Clients screen. | Next |
| D-9 | L | `customers-calendar.tsx` ("Try again" with `min-h-0`) | This one opts out of the 44 px floor and is about 18 px tall. | Next |

### Clients (the picked client)
`clients/page.tsx` redirects to `customers?tab=clients`. Both list pages are already under `reads-are-honest.test.ts`. The faults are all in the sub-pages.

| # | Sev | Where | Fault | Fix |
|---|---|---|---|---|
| C-1 | **H (money)** | `clients/[eventId]/_components/booth-event-section.tsx` with `lib/vendor-3d-booth-event-pricing.ts` | A refused order read gives `'none'`, so a supplier **who already paid** for booth branding sees the buy form again. A refused plan read tells a paying supplier it "comes with a paid plan". | Next |
| C-2 | H | `_components/script-tab.tsx` (four `…Res.data ?? []`) | A refused schedule read says **"<couple> haven't built their timeline yet"**, and written scripts show blank. | Next. #7917 touches this file for styling only. |
| C-3 | M | `_pages/forms.tsx`, `shop/_components/shop-forms-body.tsx` (`tierRes.error` ignored) | A paid shop is told "Media files come with Pro". The server re-checks, so this is wrong copy, not a breach. | Next |
| C-4 | M | `challenge-photos/page.tsx`, `_components/vendor-challenge-section.tsx` with `lib/papic-games.ts` (`if (error \|\| !data) return []`) | A refused read says "No shared photos yet" and "No challenges yet — write your first one", which invites duplicates. | Next |
| C-5 | M | `editorial-media/page.tsx` (`{ data: rows }`) | "Already on their editorial" disappears, and the room count shows the full allowance. | Next |
| C-6 **P** | M | `mood-board/page.tsx` (`signoffError` logged, then `?? []`) | An open sign-off ask is hidden. | Next |
| C-7 | M | `editorial-media/_components/editorial-media-studio.tsx` (`setBusy('Removing…'); await …; setBusy(null)`) | The `{ok:false}` result is ignored. A thrown call leaves **"Removing…" spinning** with every button disabled. | Next. try/finally. |
| C-8 | L | the editorial ✕ (`h-7 w-7`), colour-lane `<input type=color>` (`h-8`), cocktail edit/remove/resize (≈18–20 px), and the "Event brief" back `<a>` links on four sub-pages | Under 44 px. Links and inputs get no global floor. | Next |

### Shop
| # | Sev | Where | Fault | Fix |
|---|---|---|---|---|
| S-1 ✅ | H | `shop/page.tsx` (`if (!data)` → "Set up my shop" → `/open-shop`) | `data` is null **only when the loader threw**, because a proven absence has already redirected. So a supplier who **has** a shop was invited into the new-shop wizard. Same fault class as `lib/roles.ts` "Create your shop". | **#7941** |
| S-2 | H (money) | `shop/page.tsx` (`tier: own?.tier_state ?? null` → `planWord(null)` = "Free") | A refused own-row read shows **"Free plan"** on the cover and on the Plan tile of a paying shop. | Next |
| S-3 | H | `shop/page.tsx` (`soft.read('latestApplication', …, null)`) | A refused read looks like "no application", so a shop in review reads **"Get verified · 0 of 3 papers"**. | Next. Use a distinct unread sentinel. |
| S-4 | H | `shop/page.tsx` (`verified: own?.verification_state === 'verified'`) | The same refused read locks the Offer Maker behind "Get verified" for a verified shop. | Next. Pairs with S-2. |
| S-5 | **H (data loss)** | `shop/promote/_components/share-your-work-data.ts` (`notesErr` logged, then `noteRows ?? []`) | A refused read shows each Ultra story's "In our words" box empty. **A blank save deletes the note**, so a supplier can wipe a published note they never saw. | Next. Priority. |
| S-6 | M | `shop/_components/autoreply-section.tsx` (mounted in the Customers ⚙) | A refused read draws both switches as **off**, and a re-save turns them off. | Next |
| S-7 ✅ | L | `shop-cover.tsx` (the "★ rating · reviews" `<Link>`, and the "Open in browser" `<a h-9>`) | Plain links under 44 px. | **#7941** |
| S-8 **P** | L | `shop-cover.tsx` (`grid grid-cols-4`, `COVER_PILL` with no truncate) | "Promote" may spill past an ~83 px pill at 390 px. Not reproduced in a lab. | Next. Measure first. |

### Services and card maker
| # | Sev | Where | Fault | Fix |
|---|---|---|---|---|
| V-1 ✅ | H | `services/_components/services-manager.tsx` (`fetchVendorCoverages(...).catch(() => [])`) | A refused read put **"not in what you do" on every card**, and "Your coverage" said "Nothing yet". | **#7952** |
| V-2 ✅ | M | `services-manager.tsx` (`{decodeURIComponent(search.error)}`) | Decodes an already-decoded param. A message with a bare `%` throws `URIError` and breaks the whole Shop page. | **#7952** |
| V-3 | H | `services-manager.tsx` (tier read via `.then((r) => r, () => ({ data: null }))`) | `error` is never read, so branches hide and every card says "assigned to You". The code's own comment calls that "a silent lie". | Next |
| V-4 | M | `lib/vendor-services.ts` `fetchInclusionsByService` / `fetchDiscountsByService` | A refused read draws cards with no "What's included" and no discount. | Next |
| V-5 | M | `services/_components/stay-on-section.tsx` (`if (read.status !== 'ok') return null`) | Held cards keep a `#stay-on` tag that points at nothing. | Next |
| V-6 | M | `services/[serviceId]/page.tsx` (halls read gives `[]`) | The venue's "Uses" row vanishes. | Next |
| V-7 | M | `services/coverage-actions.ts` (`getCoverageTaxonomy().catch(() => [])`, tier `{ data }`) | A refused read becomes **"That kind is not one couples search by yet"**, a false claim about the trade. A founder can also get a wrong "bigger plan" line. | Next |
| V-8 | M | `coverage-panel.tsx` ("…or request it under Tools.") | Points at a Tools view that was removed. | Next. Link `SERVICE_REQUEST_NEW_HREF`. |
| V-9 | M | `coverage-panel.tsx` (pill ✕ `h-4 w-4`, breadcrumb crumbs, `<Crumb active onClick={() => {}}>`) | The ✕ is 44 tall but only **16 px wide**, and it is destructive. The current crumb is a button that does nothing. | Next |
| V-10 | M | `canvas-maker.tsx` `CanvasSheet` (`max-h-[86dvh]`) | The maker's own sheets rise to 86 %, not full screen. | **Maybe in flight: #7928 / #7897** (card maker). Never touch #7860. Q1. |
| V-11 **P** | L | `card-check-actions.ts` (`if (!shop) return []`) | An unresolved shop reads as "no photo problems", so Create is allowed. | Next |

### Chat
| # | Sev | Where | Fault | Fix |
|---|---|---|---|---|
| H-1 ✅ | H | `messages/[threadId]/page.tsx` (`counterHref={\`?compose=deal\`}`, `reviseHref={\`?compose=quote\`}`, and the blocker's "Send a new quotation" `href="?compose=quote"`) | The same chat box draws inside `/clients/<id>?tab=chat`. There a relative `?compose=` **drops `tab=chat` and lands on Details**, because the client page never reads `compose`. Counter-offer, "Update this quote" and "Send a new quotation" all looked dead. | **#7951** |
| H-2 ✅ | **H (money)** | `messages/[threadId]/pay-confirm-actions.ts` (`if (error) { console.error(…); return; }`, the same in `refuseVendorPayment` and `clearVendorPaymentPlan`) | A refused **"Confirm received"** turns back into its label with no word, so the supplier cannot tell it failed. The mounts are on the thread, on the client's Payment page and in the Money fold. | **Not shipped:** it needs a result channel (`useActionState` or a `?pay=` notice) across three plain-form mounts, and #7917 / #7632 are editing `vendor-payment-live.tsx`. Q3. |
| H-3 | M | `messages/[threadId]/pax-actions.ts` (decline: the `update` error is never read, but the audit row is still written) | The audit records a decline that may not have happened. | Next |
| H-4 | M | `messages/[threadId]/page.tsx` (`vendors.data ?? []`) | The Customer card says "None yet" for booked suppliers. | Next |
| H-5 | M | `messages/[threadId]/page.tsx` (`eventRead` error ignored) | A refused read says "No date yet" and names nobody but "the couple". | **Maybe in flight: #7870** |
| H-6 **P** | L | `questions-actions.ts` (`msgError` logged, then `status: 'sent'`) | "Sent" shows even when the chat line failed. | Next |
| H-7 | L | `vendor-offer-service.tsx` (`<select>` `py-1.5`) | The select is about 32 px. A `<select>` gets no global floor. | Next. #7632 touches the file. |

### Forms
Forms has no page of its own. It opens as Shop › Makers `?maker=forms` and as the picked client's Forms page.

| # | Sev | Where | Fault | Fix |
|---|---|---|---|---|
| F-1 | M | `shop-forms-body.tsx`, `_pages/forms.tsx` (`lib?.cards… ?? []` → `readFormSuggestions`) | A refused library read shows "No suggested forms for this service yet" under the "couldn't load" line. | Next |
| F-2 | L | `forms/_components/forms-page-body.tsx` (`eventForms?.length ?? 0`) | The heading reads "· 0" directly above "We couldn't load this event's forms". | Next |
| F-3 **P** | L | `form-maker.tsx`, `form-view-sheet.tsx` (`start(async () => …)` with no try/catch) | A thrown call skips `setState`, so the screen goes quiet or hits the error boundary. | Next |
| F-4 **P** | L | `form-maker.tsx` (`<Sheet rise page>`), `form-view-sheet.tsx` (`<Sheet rise>`), with no `full` | Capped at `max-h-[90dvh]` on a phone. | **Maybe in flight: #7882** (forms rise full). Q1. |

### Prints · Badges
| # | Sev | Where | Fault | Fix |
|---|---|---|---|---|
| P-1 | M | `shop/promote/_components/shop-prints-section.tsx` (`on={badgeRead.k === 'ok' && badgeRead.verified} disabled`) | While loading, or on a failed read, the Verified, Rating and Badges switches are drawn **off**, which looks the same as "you don't have it". | **Maybe in flight: #7925** (badges v84 in Shop › Badges and Prints) |
| P-2 | M | `shop-prints-section.tsx` (`SaveFileLink` `<a h-[34px]>` / `h-9`) | The Save links are 34–36 px, and links get no floor. | **Maybe in flight: #7925** |
| P-3 | L | `shop-prints-section.tsx` (`aria-label={big ? 'Back to Prints' : 'Back to Promote'}`, `h-9 w-9`) | Says "Back to Promote" when the supplier came from Prints, and the target is 36 px wide. | Next |
| P-4 **P** | L | `app/_components/save-file-link.tsx` (the error line is a sibling inside a flex row) | On a phone the error line squeezes the title. | Next |
| B-1 | — | `shop/_components/badges/badge-page-model.ts` | Imported by nothing, so the five-badge page is not mounted yet. | **In flight: #7925** |

### Plans
| # | Sev | Where | Fault | Fix |
|---|---|---|---|---|
| L-1 ✅ | **H (money)** | `subscription/_components/plan-screen.tsx` (`let { data: tierRow } = await readTierRow()`) | A refused read gave `asVendorTier(undefined)` = `'free'`, so a paying shop read **"You are on Free · nothing to pay"** and "there is nothing to cancel", with every paid row locked. This hit the Plan page **and** the Shop ⚙ fold. | **#7949** |
| L-2 | H | `plan-screen.tsx` (`fetchV2VendorCatalog()` gives `[]` on error) | A shop on Plus **loses its own "Plus · your plan" row**, and Pro/Ultra say "Not sold on this cycle". | Next |
| L-3 | H | `subscription/actions.ts` (`redirect(payPath ?? '/vendor-dashboard/subscription?ordered=' + …)`) | When the `orders` insert fails, the page shows a green "Order started" with **"Send your payment" → `/pay/<ref>`, which 404s**, because `/pay` resolves only `orders` and `booking_fee_charges`. | **Not shipped.** Q2 (money-flow call). |
| L-4 | M | `plan-screen.tsx` (`planChangeRow` error dropped) | The "Today" figure ignores held credit, and a scheduled change and its undo vanish. | Next |
| L-5 **P** | M | `actions.ts` (`ref` null, so `?ordered=` is empty) | No notice, no error and no pay panel, while admins are still notified. | Next |
| L-6 | L | `plan-rows.tsx` ("Cancel the plan" `DatesRow` with no `href`) | Looks tappable and does nothing. | Next. Reword it as a statement. |
| L-7 | M | `plan-rows.tsx` (the ~85-char line in a `truncate` row) | "…you are on Free after {date}" is cut off at 390 px, **so the end date is lost**. The same happens to Settings › "Your events" and Help › "How fees work". | Next. Lead with the date. |

### Settings
| # | Sev | Where | Fault | Fix |
|---|---|---|---|---|
| G-1 | L | `lib/notifications.ts` (count gives `0` on error) | The Notifications row drops its "N new" badge on a failed read. | Next. Use the nullable variant already in the file. |
| — | — | every row in `settings-rows.ts` | All land on a real route. | — |

## 3 · Shipped today, all draft, `do-not-auto-merge`, auto-merge OFF

| PR | Area | What |
|---|---|---|
| #7936 | Calendar | D-1, D-2, D-3, plus a guard: `calendar/a-refused-read-never-saves.test.ts` |
| #7941 | Shop | S-1, S-7, plus a guard: `the-open-shop-redirect-is-a-proven-absence.test.ts` now also fails on a **link** to `/open-shop` |
| #7949 | Plans | L-1, plus a guard: `subscription/a-refused-plan-read-is-not-free.test.ts` |
| #7951 | Chat | H-1. The two guards that pinned the literal strings now pin both forms. |
| #7952 | Services | V-1, V-2, plus a guard: `services/a-refused-category-read-is-not-outside.test.ts` |
| #7953 | Today | T-1, plus a guard in `_components/an-unread-desk-is-not-caught-up.test.ts` |

Every new guard was sabotage-checked: restoring the `origin/main` source turns it red.

⚠ **The fix PRs are drafts, so the repo's `typecheck + lint` gate stays red on purpose** ("Draft PR: checks not run. Mark ready to test."). Every job that does run on a draft (guards, source guards, lint guards, secret scan) passed. The full suite runs only after a PR is marked ready. Each PR body has its local `pnpm preflight` table.
⚠ **#7941 regenerates `port-control-baseline.json`.** It will conflict with any other PR that regenerates that file and merges first. The fix is to regenerate again, never to hand-merge.

## 4 · Owner questions

- **Q1 · Full screen everywhere?** These still open as partial sheets: the Today and Customers ⚙ (52 %), the Form Maker and form view (90 %), and the card maker's own `CanvasSheet` (86 %). `the-rise-screen-is-one-full-screen.test.ts` deliberately keeps non-rise ⚙ menus as sheets. Should every one of them rise full? #7760, #7882 and #7928 are each partway there.
- **Q2 · A half-made purchase or booking.** When a plan order cannot be written (L-3), or the 2nd of N halls fails (D-7), should the supplier be told "we started it — try again", or should Setnayan roll the first part back? This is money flow, so it is your call.
- **Q3 · Payment confirm failure (H-2).** Is a line under the button ("That didn't go through — the payment is still waiting for you") right on all three mounts, or should a failed confirm also alert the admin desk?
- **Q4 · "Your website".** Two Shop cards say "Your website" about the supplier's own outside site. Does the "no website on supplier pages" rule cover that, or only our Event Hub?

## 5 · Screen · fault · fix · owner question

| Screen | Fault | Fix PR / in-flight PR | Owner question |
|---|---|---|---|
| Today | Unread fee bills → "Nothing waiting on you" (T-1) | #7953 | — |
| Today | Refused threads read → inquiries dropped, "0" (T-2) | next | — |
| Today | Refused bookings read → "No bookings yet" (T-3) | next | — |
| Today | ⚙ opens as a half sheet (T-4) | #7760 | Q1 |
| Calendar | Refused read unassigns every service, says "saved" (D-1) | #7936 | — |
| Calendar | Refused count switches a schedule off (D-2) | #7936 | — |
| Calendar | "Told them" when nobody was told (D-3) | #7936 | — |
| Calendar | "Nobody waiting" / "Set up a schedule" on a refused read (D-4, D-5, D-6) | next | — |
| Calendar | Half-saved halls say "Nothing changed" (D-7) | next | Q2 |
| Calendar | Month tap throws to the error page (D-8) | next | — |
| Clients | Paid booth branding offered again (C-1) | next | — |
| Clients | "Haven't built their timeline yet" on a refused read (C-2) | next (file in #7917, styling only) | — |
| Clients | Forms, challenges, photos, editorial and sign-off show false empties (C-3 … C-6) | next | — |
| Clients | "Removing…" stuck forever (C-7) | next | — |
| Clients | Sub-44 px links and controls (C-8) | next | — |
| Shop | Loader crash → "Set up my shop" (S-1) | #7941 | — |
| Shop | Refused read → "Free plan", "0 of 3 papers", Offer Maker locked (S-2 … S-4) | next | — |
| Shop | Blank "In our words" box can delete a published note (S-5) | next | — |
| Shop | Auto-reply switches drawn off on a refused read (S-6) | next | — |
| Shop | Cover links under 44 px (S-7) | #7941 | — |
| Services | Every card "not in what you do" on a refused read (V-1) | #7952 | — |
| Services | Bare `%` in an error crashes Shop (V-2) | #7952 | — |
| Services | Branches hidden, "assigned to You" (V-3) | next | — |
| Services | Inclusions, stay-on, halls and coverage-action false empties (V-4 … V-7) | next | — |
| Services | "Request it under Tools", which is gone (V-8) | next | — |
| Services | 16 px-wide destructive ✕ (V-9) | next | — |
| Card maker | Sheets at 86 % (V-10) | #7928 / #7897 (never #7860) | Q1 |
| Chat | Compose doors land on Details inside the client (H-1) | #7951 | — |
| Chat | Failed "Confirm received" is silent (H-2) | not shipped | Q3 |
| Chat | Pax decline audited when the update failed (H-3) | next | — |
| Chat | "None yet" / "No date yet" on refused reads (H-4, H-5) | next / #7870 | — |
| Forms | False "No suggested forms" and "· 0" (F-1, F-2) | next | — |
| Forms | Maker sheets at 90 % (F-4) | #7882 | Q1 |
| Prints | Switches drawn off while unread; 34 px Save links (P-1, P-2) | #7925 | — |
| Prints | "Back to Promote" from Prints (P-3) | next | — |
| Badges | The five-badge page is not mounted (B-1) | #7925 | — |
| Plans | Refused read → "You are on Free" (L-1) | #7949 | — |
| Plans | Plus loses its own row when the catalogue read fails (L-2) | next | — |
| Plans | "Send your payment" → 404 when the order insert fails (L-3) | not shipped | Q2 |
| Plans | End date cut off at 390 px (L-7) | next | — |
| Settings | Notifications badge drops on a refused read (G-1) | next | — |
| Settings | Every row lands on a real route | clean | — |
| All | "Your website" for the supplier's own site | — | Q4 |
