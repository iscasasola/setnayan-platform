# 27 Nov walkthrough list: re-measured on origin/main (29 Nov)

> **STATUS: ready.** Cloud checker, read only. Code read at **origin/main `2d6a8b396`** (fresh clone, 28 Nov 18:3xZ). Every anchor is a greppable string or symbol from `apps/web/`.
> Source list: specs `HANDOVER-2026-11-27/WALKTHROUGH-27NOV-FINDINGS.md` (Passes 1–3) and `MASTER-PLAN-2026-11-27.md`.
> Verdicts: **FIXED** (merged PR + proof on main) · **IN FLIGHT** (open PR whose diff fixes it) · **STILL BROKEN** (anchor on main) · **RUNTIME** (can't be decided from code; likely cause named) · **OWNED ELSEWHERE**.
> I opened each PR's diff rather than trusting its title. #8427 and #8432 landed via #8444. #8422 (L3) and #8423 (L4) landed via #8430. #8449 landed via #8510/#8521.

## 0 · Lane state (read this first)

| Lane | PR | State on 28 Nov 18:40Z |
|---|---|---|
| L1 crashes + auth | #8427 | merged (via #8444) |
| L2 guest + Hub | #8432 | merged (via #8444) |
| L3 press / Tab / no-select | #8422 → #8430 | merged |
| L4 words | #8423 → #8430 | merged |
| L5 couple numbers | #8424 (via #8468) | merged |
| L6 supplier numbers | #8428 | merged |
| L9 public copy | #8449 (via #8510/#8521) | merged |
| IAP replay | #8415 | merged |
| **L7 admin** | **#8418** | **open, `mergeable_state: clean`**, head `fa19e5e65` |
| **L8 iPad / layout** | **#8421** | **open, conflicting with main** |
| **L4b hints + "Free to start"** | **#8436** | open |
| **Batch B (L7 + L8 + L4b)** | **#8456** | **open, `dirty` (conflicting): runs no CI.** It contains #8418's head. |
| Lights & Sounds + Find empty | #8426 | open |

**The biggest lever is to unblock #8456, or ship #8418 on its own, which is clean.** About 12 rows below wait only on it.

**Tally (about 75 findings).** About 45 are FIXED. About 12 are IN FLIGHT, all waiting on #8418 or #8456/#8421. **21 are STILL BROKEN**: G8b, G6b · C2, C3, C4, C11b, C12a, C17c, C18e, C18m · S1, S4b, C5, S7, S10, S11 · D7c, D7d, D7e · G13, G16b. The §1 tables hold 26 rows. Five of them are not code faults: D7a, D7b, D7f/g and S3d are RUNTIME (live only), and S9 is IN FLIGHT plus an owner word. About 10 are RUNTIME or data only. 4 are OWNED ELSEWHERE (B2, the seat plan's grey block, "+1 · TBA", and test data under R6).
**Real-user faults to send first:** D7e (the check-in team read fails with permission denied), C18m (a false "Free to start" on Papic), C4 (a paid receipt says unconfirmed), S1 (the badge ring says 10, but the ruling is 5), C5 (expired vs Talking), G13 (sign-in Tab order).

## 1 · STILL BROKEN, grouped by area (one builder per area, no shared files)

### Guest / public
| id | sev | what | anchor on main | files | fix direction | owner? |
|---|---|---|---|---|---|---|
| G8b | brand | "kept for life, **free**" is still in public copy. The notification itself is fixed. | "kept for life, free" in `app/_components/frontdoor/front-door-landing.tsx`, `app/(shell)/papic/page.tsx` ("kept for life, free, with nothing to renew"), `lib/llms-txt.ts`, `lib/seo/ai-answers.ts`; "stays online, free, for life" in `app/(shell)/privacy/page.tsx` | those 5 files | Say "kept for life" and drop "free" (brand.md claim 3). | **Yes.** #8449 left it in place, so confirm it counts as a banned price promise. |
| G6b | brand | Handle "@someone" | Data in `users.slug`, minted by `public.mint_user_username` (migration `20271357986226_event_address_owner_and_usernames.sql`), which has no stand-in check | new migration | Refuse the `ROSTER_UNNAMED` stand-in in `mint_user_username`, then re-mint the existing handle. | **Yes.** Renaming a live handle needs his OK: the code says an address is never reissued. |

### Couple
| id | sev | what | anchor on main | files | fix direction | owner? |
|---|---|---|---|---|---|---|
| C4 (W1-6) | bug | A paid receipt still says "Becomes your transaction receipt once the payment is confirmed." | `app/receipts/order/[orderId]/page.tsx`: `order.status === 'paid' \|\| order.status === 'fulfilled' ? 'Becomes your transaction receipt once the payment is confirmed.'` | that page | Split off paid/fulfilled: say the receipt is issued, or link to it. | Maybe: legal wording for a paid order. |
| C3 (W1-5) | brand | Papic unit: Event services still says "guest photos left" and "After this:" | `studio/website-pro/_components/event-services-view.tsx` `countNoun(facts.photosLeft, 'guest photo', 'guest photos')`; `lib/event-services.ts` `eventServicesTodayLine` "photos left"; hand-typed "150 credits left" in `launch/_components/stage-panel/camera-face.tsx` | those 3 | Say credits (DECISION_LOG 22 Sep "ONE WORD IS 'CREDITS'"). Read the preview's count instead of hand-typing it. | **Yes:** the 23 Nov Event services drawing says "photos". Confirm that the 22 Sep "credits" ruling wins. |
| C2 (W1-4) | bug | Booked count: one reader exists, but 7 copies remain, and the counts are in different units | Copies: `lib/coordinator-trade.ts` `export const BOOKED_EVENT_VENDOR_STATUSES`; `lib/booked-by-payment.ts` `const BOOKED = new Set`; `lib/vendors.ts` `BOOKED_VENDOR_STATUSES`; `lib/event-deletion-gate.ts` `BOOKED_VENDOR_STATUSES`; `lib/vendor-activity.ts` `FINALIZED_STATUSES`; `lib/answers-desk.ts` `BOOKED_FOR_COMPLETION`; `lib/events.ts` `CONFIRMED_VENDOR_STATUSES`; and `lib/suppliers-build.ts` `buildMoneyOf` `const LOCKED`. Home counts categories (`bookedCategoryTally`), while the schedule tile counts suppliers (`lib/home-schedule.ts` `oweTimes`). | those lib files | Re-export from `lib/booked-status.ts` (`isBookedStatus`) everywhere, and name each count's unit ("categories" vs "suppliers"). | Maybe: should Home count categories or suppliers? |
| C11b (W1-13) | bug | The guest card shows the text "Opening their card…", not a skeleton | `guests/_components/guest-card-sheet.tsx` `data-guest-card-loading` "Opening their card…" (also `text-[13.5px]`) | `guest-card-sheet.tsx`, `app/_components/inspector/inspector-column.tsx` | `Sk`/`Ghost` skeleton of the card; then profile the 3–4 s card read. | no |
| C12a (W1-14) | polish | The guest card's "More" row shows its contents where a value goes | `guests/_components/guest-card-body.tsx` `<K.Fold summary="More" value={… ['Not counted', 'Passed away', … 'Delete'].join(' · ')}` | `guest-card-body.tsx` | Drop `value` (drawing `guests_redesign_2026-11-20_fable.html` §3). | no |
| C17c | polish | "1 credits left" (no singular), and `toLocaleString` instead of `formatCount` | `details/page.tsx` `` `… credits left` ``; `_components/event-dashboard.tsx` `` `${papicHome.shotsLeft.toLocaleString('en-PH')} credits left` `` | those 2 | `countNoun` + `formatCount` | no |
| C18e | polish | An explaining empty state is left | `vendors/[vendorId]/workspace/page.tsx` "No contracts uploaded yet. {displayName} can upload PDFs from" | that page | One line plus [Open chat]. | no |
| C18m | **brand (false claim)** | Papic add-on still says "Free to start". Free Papic credits were turned off on prod on 28 Nov (#8452). This is in **no** open PR. | `lib/add-ons-catalog.ts` `freeTrial: 'Free to start'` (shown by `studio/_components/addon-detail-view.tsx`) | `lib/add-ons-catalog.ts` | Remove `freeTrial` from Papic. | no (DECISION_LOG 28 Nov) |

### Supplier
| id | sev | what | anchor on main | files | fix direction | owner? |
|---|---|---|---|---|---|---|
| S1 (W1-1) | bug | Badge threshold: two ladders. Today/Shop shelf reads 5; the Analytics ring reads 10. | `performance/_components/one-analytics-section.tsx` `milestoneLadder(badgeFacts.completedEvents)` → `lib/service-card-record.ts` `MILESTONE_THRESHOLDS = [10, 50, …]`, while the shelf uses `lib/badge-tiers.ts` `completed_bookings: [5, 25, 50, …]` | `one-analytics-section.tsx`, `growth-view.ts` | Build the ring from `SHOP_BADGE_STEPS.completed_bookings` (as `shelfNextBadgeLine` does); add a test that the ring's goal equals the shelf's. | No: **already ruled 5** (DECISION_LOG 15 Nov, "CORRECTION to e6cd652e"). `MILESTONE_THRESHOLDS` is for service-card medals only. |
| S4b (W1-7/12f) | bug | An unnamed host still renders "S— / Someone —" on client event lines | `lib/supplier-event-lines.server.ts` `if (n) nameOf.set(u.user_id, n);` runs no `realNameOrNull`, so `event-lines.tsx` `initials()` draws "S—" | `lib/supplier-event-lines.server.ts` | `realNameOrNull(...)` (`lib/no-name.ts`) before `nameOf.set`, so the host falls to `UNNAMED_HOST`. | no |
| C5 (W1-12c) | bug | The couple sees "expired" while Clients shows "Holding · Talking" | `lib/vendor-customer-pipeline.ts` `askEnded` exists (#8424); `.askEnded` has 0 readers in `app/` | `customers/_components/customers-roster.tsx` | Draw `askEnded.line` before the "Holding · Talking" branch. | no |
| S10 (W2-16) | bug | Old supplier URLs redirect on the client, after the shell streams | `app/vendor-dashboard/reviews/page.tsx` `redirect('/vendor-dashboard/website#reviews')`; `payday/page.tsx` `customerLandingAnchor('payday')`; `calendar/page.tsx`; `services/page.tsx`. None are in `lib/legacy-redirects.ts` `legacyRedirectTarget` | `lib/legacy-redirects.ts`, `middleware.ts`, the 4 `page.tsx` (+ `calendar`/`payday` `loading.tsx`) | Move them into the middleware map, keeping the query and anchor. Keep `calendar/[date]`, `services/[serviceId]`, `services/new` and the `actions.ts` files. | no |
| S7 (W1-22) | polish | "All dates" opens the Clients list on the week strip | `_components/supplier-today-first-screen.tsx` `href: '/vendor-dashboard/customers?seg=dates'` (also a typed route string); `customers-calendar.tsx` rests on the week ("THE WEEK AT REST", owner 19 Nov) | those 2 | Use a `lib/routes.ts` builder + `#calendar`. Optionally `?seg=dates` opens the whole month. | **Yes:** whole month or week strip? |
| S11 (W2-17) | polish | iPad 820: Shop analytics opens mid-scroll | `performance/_components/analytics-carousel.tsx`. #8421 says it is "not changed … owner-ruled carousel (27 Oct)" | `analytics-carousel.tsx`, `analytics-growing.css` | Start-align at ≥768. Needs a Fable drawing. | **Yes** (drawing) |
| S9 (W2-15) | polish | "Log a payment" is icon only. The ✓ icon swap is IN FLIGHT (#8421/#8456 `TOPIC_ICON.payment`); the word is not. | `customers/_components/money-log.tsx` `icon={Check}`; `components/thumb-row.tsx` "44 px rounds, icon only" | `money-log.tsx`, `thumb-row.tsx` | After #8456, add a worded action seat to `ThumbRow`. | **Yes:** confirm the exception to ThumbRow icon-only (reported approved 27 Nov) |
| S3d (W1-8) | bug? | Plan page "Photos & video 0 KB" while the portfolio holds 10 photos | `vendor_storage_files().media_bytes` (migration `20271360925434_supplier_storage_meter_counts_everything.sql`); depends on `supplier_stored_files` rows | maybe a backfill migration | SELECT-only prod check of that shop's `portfolio_r2_keys`, then a backfill if they are missing. | no |

### Admin (all of D1–D5 wait on #8418; the rest are live-Problems noise or faults)
| id | sev | what | anchor on main | files | fix direction | owner? |
|---|---|---|---|---|---|---|
| D7c (W1-11) | bug (noise) | DELETE event_category_decisions matched zero rows (5×) | `app/dashboard/[eventId]/vendors/category-decision-actions.ts` `restoreTileToPlan`: `.from('event_category_decisions').delete()` has no `ABSENT_IS_FINE_HEADER`; its sibling `clearCategoryDecision` has it | that file | Skip the delete when the `decision` read returns no row (or add the header). | no |
| D7d (W1-11) | bug | `sendChatMessage` ok:false is filed with no reason | `lib/telemetry/fault-normalize.ts` `readActionResult` reads only `o.error`/`o.message`, but `lib/chat-actions.ts` `ChatSendRefusal = { ok: false; reason: string }` → the literal `'returned ok:false'` | `fault-normalize.ts` | Read `o.reason`; then decide whether rule refusals (`contact_blocked`, `too_long`) are faults at all. | Maybe: are rule refusals "problems"? |
| D7e (W1-11) | **bug (real read failure)** | GET event_moderators permission denied: the check-in team read fails | `app/dashboard/[eventId]/guests/checkin/page.tsx` user client `.from('event_moderators').select('user_id, guest_id, role_subtype')`; `guest_id` was revoked from authenticated in `20271251336140_cohosts_come_from_the_guest_list.sql` | `guests/checkin/page.tsx` | Read with the service client after the host gate (as `lib/people-with-access.server.ts` does), or drop `guest_id`. | no |
| D7b (W1-11) | bug (noise) | PATCH payments matched zero rows | `app/admin/payments/actions.ts` `approvePaymentCore` `.eq('status', 'pending')` (a double approve, or the Maya return racing the webhook). Money stays fail-closed. | `payments/actions.ts`, `lib/maya-checkout.server.ts` | Return early if already matched, or mark the guarded update as expected. | no |
| D7a (W1-11) | bug (noise?) | POST orders 23505 (3×) | Likely `lib/booking-fee-lock.server.ts` `collectBookingFeeAtLock` → `isAlreadyBilled` (`orders_booking_fee_one_bill_per_charge`), logged by `lib/supabase/db-error-log.ts` `createLoggingFetch` | those | Read the constraint in the Problems row. If it is the booking-fee index, mark it expected; if it is `reference_code`, retry on collision. | no |
| D7f/g (W1-11) | polish / bug | Home dead tap; rage taps on Suppliers and Guests | `app/_components/nav/bottom-nav.tsx` has no pending state (no `useLinkStatus`); a tap on the current Home cell does nothing (`lib/telemetry/fault-observer.ts` `DEAD_TAP`) | `bottom-nav.tsx` | Pending state on the tapped cell; the current cell scrolls to top. Time `/guests` and `/vendors`. | no |

### Shared (sign-in, switcher, press feedback)
| id | sev | what | anchor on main | files | fix direction | owner? |
|---|---|---|---|---|---|---|
| G13 (W2-2) | bug | Sign-in Tab order: "Continue with Google" and "Use a password instead" still sit between email and password. The eye is fixed. | `app/login/_components/sign-in-card.tsx`: `<GoogleAddressDoor enabled={showOAuth}` is rendered before `<PasswordField`; same in `app/signup/page.tsx` | `sign-in-card.tsx`, `signup/page.tsx`, `app/_components/auth/google-address-door.tsx` | Render the door after password + Continue, and extend `lib/one-tab-stop-per-control.test.ts`. | no |
| G16b (W2-3) | polish | 25 bespoke sr-only file inputs are still Tab stops. The named surfaces are fixed. | e.g. `chat-send-form.tsx` `CHAT_PHOTO_INPUT_ID`, `client-refunds.tsx` `onChange={onProof}`, `portfolio-upload.tsx`, `supplier-suggest-board.tsx` | those uploaders | Move them to `FileUpload` (`inputBesideButton`), or `tabIndex={-1}`; widen the guard to the whole tree. | no |

## 2 · Every finding, one verdict each

### Possible blockers
| # | verdict | evidence |
|---|---|---|
| B1 IAP sandbox replay + non-couple Buy | FIXED | #8415 `lib/iap/fulfil.server.ts` `isRetiredIapProduct(tx.product.productId)` + `lib/iap/products-delivery.ts` `RETIRED_PAPIC_CREDIT_PRODUCTS`; guard `lib/iap/a-retired-replay-is-settled.test.ts`. Couple-only: `studio/website-pro/page.tsx` `isCoupleOf(` + `lib/iap/iap-outcome.ts` `couple_only`. Confirm in Problems after the next App Review buy. |
| B2 Social queue FAILED posts | OWNED ELSEWHERE | Facebook session |
| B3 guest dead taps | FIXED | #8432 `app/[slug]/_components/safari-hop.tsx` `SafariHop`; `copy-my-link.tsx` `<LinkToCopyByHand`; guard `the-guest-taps-are-never-dead.test.ts`. Re-walk in Messenger on an iPhone. |

### Pass 1 bugs
| # | verdict | evidence |
|---|---|---|
| W1-1 badge threshold | STILL BROKEN | see S1 (ruled 5) |
| W1-2 rating | FIXED (Shop) / RUNTIME (public page) | #8428 `lib/shop-rating.ts` `shopRatingOf`, used by `one-analytics-section.tsx`, `shop/page.tsx`, `website/page-data.ts`. Public `app/v/[slug]/page.tsx` shows stars only for trusted reviews on a verified shop (`trustedReviewStats.trusted_review_count > 0`), so it is data |
| W1-3 Build drops a booked supplier | FIXED | #8424 `lib/suppliers-build.ts` `buildLinesOf` `alsoBooked: BuildLine[] = bookedRows.slice(1)`. Leftover: `buildMoneyOf` `const LOCKED` (see C2) |
| W1-4 booked counts | STILL BROKEN (partly) | see C2 |
| W1-5 Papic unit | STILL BROKEN | see C3 |
| W1-6 paid receipt | STILL BROKEN | see C4 |
| W1-7 "Handled by" twice, no name | FIXED (Handled by) / STILL BROKEN ("S—") | #8428 `customers/_components/client-handling.tsx` `if (!view.handOver && !movingName) return null`; see S4b |
| W1-8 supplier counts, two readers | FIXED (portfolio, views, storage words) / RUNTIME (0 KB media) | #8428 `lib/portfolio-count.ts` `getPortfolioCount`; `lib/shop-count-window.ts` `SHOP_COUNT_WINDOW_DAYS = 30`; `lib/supplier-store.ts` `storageMeter` `meterWords`. Stale comment "the last 28 days" in `lib/supplier-today.ts` `businessLine`. See S3d |
| W1-9 admin stale count + 3 hops | IN FLIGHT #8418 | main: `lib/admin/queue-counts.ts` `countOpenProblems` never runs `close_quiet_fault_issues`; #8418 adds `closeQuietProblems`. Hops: #8418 `focus-row.tsx` `goes: true` |
| W1-10 "to be paid on" | IN FLIGHT #8418 | main: `lib/admin/queue-peek.ts` `` `${name} added a new ${kind} to be paid on` `` |
| W1-11 live Problems | STILL BROKEN (D7c, D7d, D7e) / RUNTIME (D7a, D7b, D7f, D7g) | see the Admin table |
| W1-12a "Add another account" strands | FIXED | #8427 `app/login/page.tsx` `decodeParkedList(cookieStore.get(ACCOUNTS_LIST_COOKIE)`; guard `app/login/parked-accounts-come-back.test.ts` |
| W1-12b "Not Someone?" / @someone | FIXED (copy) / STILL BROKEN (handle data) | #8430 `app/[slug]/_components/not-you-switch.tsx` `realNameOrNull(account.firstName) ?? 'you'`; handle: see G6b |
| W1-12c expired vs Talking | STILL BROKEN | see C5 |
| W1-12d "Loading…" text | FIXED | #8428: "Loading supplier dashboard" has 0 hits; `app/vendor-dashboard/loading.tsx` `<Screen label="Loading Today">` with `Sk`; `dashboard/(account)/billing/loading.tsx` `ListPageSkeleton` |
| W1-12e subscription hydration | FIXED (not run live; client pieces in the shared `vendor-dashboard/layout.tsx` not covered by the guard) | #8427 `subscription/_components/badge-upgrades-section.tsx` (no `toLocaleDateString` in the client piece); guard `the-plan-page-draws-one-way.test.ts`. Confirm signed in after deploy. |
| W1-12f "Handled by" second shop / own owner as host | FIXED (own owner) / STILL BROKEN ("S—") | #8428 `lib/supplier-event-lines.ts` `shopPeopleIdsOf` + `isShopPerson(`; see S4b |

### Pass 1 polish
| # | verdict | evidence |
|---|---|---|
| testnayan4 profile link wraps | IN FLIGHT #8421/#8456 | `unihome.tsx` `.addrLink` ellipsis |
| testnayan4 empty gradient cover | RUNTIME (data) | `(launcher)/_components/event-scene.tsx` falls back to `eventTypePlaceholderGradient` when the type's hero photo is missing, so upload one in admin |
| switcher "@ email" | IN FLIGHT #8456 | main: `app/_components/account-switcher/other-account-row.tsx` draws `@` before `{acct.email}`. #8421's hunk targets the old row: drop it. |
| "1 guest photos left" / "1 photos left" | FIXED (#8423 `countNoun`) + leftover | see C17c |
| Home "0 of 25" vs Find 1 | FIXED | #8424 `lib/home-control.server.ts` `bookedCategoryTally(` |
| `next` the account can't open → 404 | FIXED for /admin | #8427 `lib/admin/require-admin.ts` `NOT_ADMIN_LANDING`; other gated areas would need the same |
| "3 planning" counts invited-only | FIXED | #8424 `lib/event-board.ts` `planningCountOf` |
| Hub card "live" while Unlisted | FIXED | #8424 `home-control-faces.ts` `hubReachOf` (`'public'` only says "guests see it now") |
| 12 seat plan grey block / 6·0·2 | OWNED ELSEWHERE | seat plan |
| 13 Find "1 yours" first paint | RUNTIME | likely `shortlist-categories.tsx` `<Count value={yours}` count-up via `components/count.tsx` `useCountTo` + `savedInPlaceCount` |
| 13 guest card blank 3–4 s | STILL BROKEN (pattern) | see C11b |
| 14 "More" row / invite popover dim | STILL BROKEN (More) / RUNTIME (popover: `guest-popup.tsx` already uses `OverlayBackdrop`; screen not identified) | see C12a |
| 15 "Next" on overdue | FIXED | #8424 `budget/_components/budget-figures.tsx` `next.late \|\| next.overdue ? 'Overdue' : 'Next'` |
| 16 mustard pill / Background clipped | IN FLIGHT #8421/#8456 | `launch/_components/look-sample.tsx` `PLATE_INK`; still `text-[11.5px]` in both main and the PR. Background clipping was fine in Pass 2. |
| 17 names 4 s late | RUNTIME | likely `lib/hub-fonts.ts` `preload: false` for the names face, or the stagger in `lib/hub-veil.ts`; measure on prod |
| 18 Orders on Ultra | FIXED | #8424 `orders/page.tsx` `planHeldWithoutOrder` |
| 19 Create event names one wedding | FIXED | #8424 `create-event/wedding-guard.ts` `inPlanningWeddingNames` |
| 20 Unihome chip highlights Discover | IN FLIGHT #8421/#8456 | main: `unihome-jump.tsx` `held.current = Date.now() + (reduce ? 0 : 700)` |
| 21 names across chat / Clients | FIXED | #8428 `lib/event-chat-title.ts` `eventHostsWords` / `eventRowTitle`; guard `lib/one-event-one-chat-title.test.ts`. ("Ana Santos & Marco Testing" is data.) |
| 22 "All dates" no calendar | STILL BROKEN (by design) | see S7 |
| 23 "1 tickets" | FIXED | #8423 `papic/portfolio-pack-actions.ts` `countNoun(summary.tickets, 'ticket', 'tickets')` |
| 24 Catalogue tile + "Real Stories (retired)" | IN FLIGHT #8418 | main: `app/admin/_components/tab-landing.tsx` `oldest(allViews, digest, nowMs)`; `lib/admin/admin-pages.ts` `'Real Stories (retired)'` |
| 25 "Marco Testing" twice | RUNTIME (data) | rows, not code; owner OK needed (R6) |
| 26 theme flips | not a fault (DARK_READY) | |

### Pass 2
| # | verdict | evidence |
|---|---|---|
| 1 Plan page crash + double error UI | FIXED (not run live) | #8427 (see W1-12e); `lib/stylesheet-recovery.ts` `standDownLoadBar` called from `lib/telemetry/report-crash.ts` |
| 2 sign-in Tab order | STILL BROKEN (partly) | eye fixed: `app/_components/password-field.tsx` `tabIndex={-1}`; see G13 |
| 3 hidden file inputs / map zoom | FIXED (named surfaces) + leftover | #8430 `app/_components/file-upload.tsx` `inputBesideButton`; `lib/map-controls-leave-tab-order.ts`; see G16b |
| 4 three saves in settings | FIXED | #8430 `details/_components/details-form.tsx` `autoSave?: boolean`; "Apply 0 changes" has 0 hits |
| 5 host sees Confirm attendance | FIXED | #8432 `app/[slug]/_components/site-body.tsx` `viewerIsHost && hostHasOwnReply(`; guard `a-host-is-not-asked-to-confirm.test.ts` |
| 6 /terms relative link | RUNTIME | `app/(shell)/terms/page.tsx` has only absolute hrefs; no relative `login?` href anywhere. Capture the live DOM href (a crawler join, or `/terms/` with a trailing slash). |
| 7 URIError + /admin not_found | FIXED | `lib/human-auth-error.ts` `decodeParamSafely` (81b47712f, guard widened in #8427 `lib/url-messages-are-ours.test.ts`); `require-admin.ts` `redirect(NOT_ADMIN_LANDING)`; guard `lib/admin/a-non-admin-goes-home.test.ts`. Leftover: `app/admin/integrations/page.tsx` `notFound()` (unreachable behind the layout gate) |
| 8 "Always free" | FIXED | #8430 (`git log -S`); guard `lib/seo/stale-claims.ts` |
| 9 "free, for life" | FIXED (notification `lib/papic-originals-reminder-core.ts` "kept in Memories for life") + leftover | see G8b |
| 10 Monogram / invitation site / mobile | FIXED | #8423 `invitation/page.tsx` "Save logo", "Your Event Hub", `unreachableSentence(invitationReach(guests))`. Leftover: hex `'#C97B4B'`, `bg-white` on that page |
| 11 Maker Done + nameless ✓ | FIXED | #8432 `maker-shell.tsx` `[data-maker-apply-slot]{display:none}`; `stages-studio-parts.tsx` `<ActionButton tone="brand" main icon={Check} label="Done"` |
| 12 RSVP wrap / twice / Send early | FIXED | #8432 `terms-tick.tsx` `whitespace-nowrap`; `reply-form.tsx` `replyAnswerMissing`; guard `send-waits-for-yes-or-no.test.ts` |
| 13 "event ’s" / "0 of 1 ready" | FIXED | #8432 `app/[slug]/_lib/private-page-line.ts` `privatePageLine`; `lib/guest-checklist.ts` `CHECKLIST_PASS_TITLE` |
| 14 contracts no title / back | IN FLIGHT #8421/#8456 | `<BackButton route="/dashboard/[eventId]/contracts"`. The sr-only h1 is the house `PageMasthead` by design. Leftover: `text-terracotta-700` |
| 15 "Log a payment" icon-only | IN FLIGHT (icon) / NEEDS OWNER (word) | see S9 |
| 16 old supplier URLs client redirect | STILL BROKEN | see S10 |
| 17a iPad Shop analytics mid-scroll | STILL BROKEN (owner hold) | see S11 |
| 17b iPad Unihome cover | IN FLIGHT #8421/#8456 | `unihome.module.css` `@media (min-width: 768px) { .dgrid2` |
| 17c "New event" + FAB | NEEDS OWNER | both are in the approved Unihome v5 drawing (`unihome.tsx` `NewEventTile`, `(hub)/dashboard/page.tsx` `label="Create an event"`) |
| 18 Add expense 1.5 s | RUNTIME | profile `budget/_components/budget-sheets.tsx` |

### Pass 3
| # | verdict | evidence |
|---|---|---|
| §1 press feedback | FIXED | #8430 `app/_components/press-feel.tsx` `PRESS_TARGETS` includes `a[href]`; guard `lib/the-press-feels-the-same-everywhere.test.ts` |
| §3 text selection | FIXED | #8430 `app/globals.css` body `user-select: none` + re-enables; guard `lib/no-text-selection-app-wide.test.ts` (admin not exempt) |
| §2 EXAMPLE cards (Home, Budget, Memories, Unihome People / Sample photo) | FIXED | #8423 `ExamplePreview`, `.sn-example` have 0 hits; guard `app/_components/states/no-sample-shown-as-real.test.ts` |
| §2 Shop "Example · Where your price sits" | FIXED | #8423 `performance/_components/graph-tile.tsx` (the `Example` chip removed); "Example ·" has 0 hits |
| §2 /features greyed-example line, /for-suppliers "Sample cards." | FIXED | #8430 (`lib/features-page.ts` A75/C39 retired) |
| §2 contracts empty | FIXED + leftover | `contracts/page.tsx` `message="No contracts yet."`; see C18e |
| §2 budget empty | FIXED | `budget-screen.tsx` "No expenses yet." |
| §2 invitation two lines | FIXED | 0 hits for "email or mobile on file" / "None marked as handed out yet" |
| §2 Unihome follow | FIXED | `unihome.tsx` `title="No events from people you follow"` |
| §2 supplier money / quotes / booked clients / reviews / Shop cards | FIXED | #8423 `customers/_components/money-view.tsx` "No payment plans yet."; `proposals/surface.tsx` "No booked clients yet." / "No templates yet."; the review and `analytics-growing.tsx` sentences have 0 hits |
| §2 Maker Background | FIXED | `lib/background-effect.ts` `parallaxOff: 'Needs a picture'` |
| §2 "+1 · TBA" | OWNED ELSEWHERE | `lib/plus-one-of.ts` `seatPlaceholderLabel` is shared with `seating-editor.tsx` |
| §2 "Venue TBA" | FIXED | `schedule/_components/day-rail.tsx`; it survives only as a Where choice (`chapter-sheets.tsx` `VENUE_TBA`), which is intended |
| §2 guests search "e.g." | FIXED (search) / IN FLIGHT #8436 (add-sheet hints) | main still has `capture-bar.tsx` `e.g. “Ana Cruz +1 groom vip #Barkada”` |
| §2 "Free to start" | FIXED on Unihome; marketing in #8436; **Papic add-on STILL BROKEN** | see C18m |
| §2 test names on live accounts | RUNTIME (data) | R6: the owner said "not yet" |

## 3a · Owner rulings given 28 Nov (in this session, verbatim "1 yes, 2 yes, 3 credits, 4 yes, 10 keep button")
- **G8b:** "kept for life, free" IS a banned price promise. Drop "free" on all 5 pages and say "kept for life". **Now buildable.**
- **G6b:** re-mint the live "@someone" handle, and block the stand-in word in `mint_user_username` (new migration). **Now buildable** (migration, `do-not-auto-merge`).
- **C3:** the Papic unit word is **credits** everywhere, Event services included (the 22 Sep ruling wins over the 23 Nov drawing). **Now buildable.**
- **C2:** keep both counts and name the unit ("N of M categories booked", "N suppliers without a time"). **Now buildable** with the C2 wave-2 work.
- **C16b:** Unihome keeps the "Create an event" button and drops the "New event" tile. **Now buildable** (a Unihome v5 delta; tell Fable to update the drawing).
- Still open: C4 receipt wording, S7 "All dates" month/week, S11 iPad analytics drawing, S9 worded "Log a payment", D7d (are chat refusals problems?).
- DECISION_LOG rows for these five are still to be written in the specs corpus (controller).

## 3 · Needs an owner ruling (do not guess). S1 does NOT: the badge threshold was ruled 5 on 15 Nov.
1. **G8b:** is "kept for life, free" a banned price promise? #8449 kept it on 5 public pages.
2. **C3:** "credits" (22 Sep ruling) or "photos" (23 Nov Event services drawing) on Event services?
3. **C16b / P2-17c:** "New event" tile *and* "Create an event" button: both are in Unihome v5. Keep one?
4. **G6b:** re-mint the live "@someone" handle (addresses are never reissued).
5. **D7d:** are chat rule refusals (`contact_blocked`, `too_long`) "problems"?
6. **C2:** should Home count booked *categories* or *suppliers*?
7. **C4:** the exact wording on a paid order's receipt.
8. **S7:** should "All dates" open the whole month or the week strip (ruled 19 Nov)?
9. **S11:** iPad Shop analytics carousel: needs a Fable drawing (the 27 Oct carousel ruling).
10. **S9:** a worded "Log a payment" against ThumbRow's icon-only rule (reported approved 27 Nov; confirm).
11. **#8418** browser titles change ("Booking fees" → "Fees owed", "Supplier payouts" → "Payouts", "Help" → "Team help"): an FYI.
