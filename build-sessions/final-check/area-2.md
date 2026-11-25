# Final check · Area 2 · Couple: create an event and plan it

> Checker 2 of 8. Report only, no fixes. Main frozen at `fb3f72d`. Phase A = code pass (`SOURCE: CODE`);
> phase B = browser walk on staging (`SOURCE: SEEN`), not started (no staging address yet).
> Page list from `pnpm exec tsx scripts/staging/areas.ts --area 2` (67 pages + 6 forwards, same as kit § 4),
> plus `/signup/you`, which the task names for this area although `areas.ts` files it under Area 1.
> Marks on each line: **OFFLINE** (NEEDED + where signal is lost / READ-ONLY IS ENOUGH / NOT NEEDED) and
> **SHAPE** (TODAY → SHOULD; `=` when they agree).

## Progress

### Create an event
- [x] /onboarding/[type] · OFFLINE: NOT NEEDED (disagree with plan: a create flow has nothing to read back, and its answers are already kept in the browser's own draft) · SHAPE: PAGE (bare full-height page, steps held in client state on one address) → FULL-SCREEN POPUP (A2-A1)
- [x] /onboarding/simple · OFFLINE: NOT NEEDED (same reason) · SHAPE: PAGE (one form, or setup cards paced on one address when the engine is on) → FULL-SCREEN POPUP (A2-A1)
- [x] /onboarding/wedding · OFFLINE: NOT NEEDED (same reason) · SHAPE: PAGE (bare full-height page, ~12 screens in client state) → FULL-SCREEN POPUP (A2-A1)
- [x] /dashboard/create-event (+ intercepting `@modal/(.)create-event`) · OFFLINE: NOT NEEDED · SHAPE: PAGE on a cold load / SIDE PANEL (`SidePanel phone="sheet"`: bottom sheet on a phone, wide right panel on desktop) when opened from the board → FULL-SCREEN POPUP, as screen 1 of the same create flow (A2-A1)
- [x] /signup/you · OFFLINE: NOT NEEDED · SHAPE: PAGE (sign-in-style card on a paper page) = PAGE (the sign-up and OAuth round trips land on it by address)
- [x] /host/accept/[token] · OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE (opened from an emailed link)

### Home and the event
- [x] /dashboard · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE   (findings A2-X4 … A2-B4; covers plain Home (Unihome v5) and the full board at `?seg=events`)
- [x] /dashboard/[eventId] · OFFLINE: READ-ONLY IS ENOUGH (saved copy already built, `OFFLINE_COPY_SHAPES`; the day-of console's own "Ready for no signal" block covers the venue) · SHAPE: PAGE = PAGE   (findings A2-X4, A2-B5 … A2-B8)
- [x] /dashboard/[eventId]/activity · OFFLINE: NOT NEEDED (disagree with plan: a history feed has no use without signal; nothing is acted on here) · SHAPE: PAGE = PAGE   (findings A2-X4, A2-B9, A2-B10)
- [x] /dashboard/year · OFFLINE: NOT NEEDED (forward only) · SHAPE: PAGE (forward) = PAGE (forward). `app/dashboard/(account)/year/page.tsx` · `redirect('/dashboard?seg=events#worth-planning')` — lands EXACTLY on the expected target. `?seg=events` resolves to the board (`resolveHomeSeg` → `EventsBoard`, which runs no landing jump), and the board renders `<section id="worth-planning" …>` ("Worth planning", `YearMomentsStrip`) in `app/(hub)/dashboard/page.tsx`. OK.
- [x] /dashboard/[eventId]/more · OFFLINE: NOT NEEDED (forward only) · SHAPE: PAGE (forward) = PAGE (forward). `app/dashboard/[eventId]/more/page.tsx` · `redirect(\`/dashboard/${eventId}\`)` — lands on the event home, which exists. OK.
- [x] /dashboard/[eventId]/progress · OFFLINE: NOT NEEDED (forward only) · SHAPE: PAGE (forward) = PAGE (forward). `app/dashboard/[eventId]/progress/page.tsx` · `redirect(\`/dashboard/${eventId}${suffix}\`)` — lands on `/dashboard/[eventId]` (the event home, exists), carrying `?sai=<value>` only when the old link had one. So the kit's `/dashboard/[…][…]` is really `/dashboard/[eventId]` (+ optional `?sai=`). OK.

### Account
- [x] /dashboard/notifications · way in: bell in the top bar (`(account)/layout.tsx` `UnreadBellBadge`) + command palette · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /dashboard/search · way in: palette step-out (`lib/shell-search.ts`), Unihome · OFFLINE: NOT NEEDED (live query; disagree with plan: a saved copy of a search is meaningless) · SHAPE: PAGE = PAGE
- [x] /dashboard/billing · way in: account menu "Billing & receipts" (`account-switcher.tsx`) + receipt slip · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /dashboard/api-keys · way in: Profile › Account row "API keys" (shown to every account) + `/api/v1` docs · OFFLINE: NOT NEEDED (disagree with plan: nothing to read offline) · SHAPE: PAGE = PAGE (A2-C3, A2-C4, A2-C5)
- [x] /dashboard/profile · way in: account menu, palette, settings rail · OFFLINE: NOT NEEDED (disagree with plan: settings forms only) · SHAPE: PAGE = PAGE (A2-C7, A2-C8, A2-C9, A2-C10)
- [x] /dashboard/profile/concierge · way in: NONE live (profile rows gated by `CONCIERGE_ENABLED = false`; only an admin notification link) · OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE (A2-C11: retire or give a door)
- [x] /dashboard/people · way in: rail (`rail-active.ts`); FORWARD → `/dashboard?seg=people&…` via `forwardToHome('people', …)` (all params carried; Home renders `PeopleSegment`) — confirmed · OFFLINE: READ-ONLY IS ENOUGH (on its Home target) · SHAPE: forward = forward
- [x] /dashboard/people/[dependentId] · way in: People › Loved ones cards (`dependents-section.tsx`) · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE (A2-C12)
- [x] /dashboard/clusters · way in: NONE (only door is its own child page's "All groups" button) · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE (A2-C13)
- [x] /dashboard/clusters/[clusterId] · way in: only from /dashboard/clusters (itself unreachable) and createCluster's redirect · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE (A2-C12, A2-C13)
- [x] /dashboard/samahan · way in: rail; FORWARD → `/dashboard?seg=people&view=samahan` (+`&left=1`/`&archived=1`) — confirmed: `/dashboard` resolves `seg=people` to `PeopleSegment`, `resolvePeopleView('samahan')` is never gated · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: forward = forward
- [x] /dashboard/samahan/[communityId] · way in: People › Groups rows, palette, Home, join-link redirect · OFFLINE: READ-ONLY IS ENOUGH (a group outing may lose signal; chat can wait) · SHAPE: PAGE = PAGE (A2-C14)
- [x] /dashboard/samahan/new · way in: People pinned row "＋ New", Groups section, palette, `/samahan` · OFFLINE: NOT NEEDED · SHAPE: PAGE → SMALL POPUP (A2-C15)

### Guests and seats
- [ ] /dashboard/[eventId]/guests
- [ ] /dashboard/[eventId]/guests/[guestId]
- [ ] /dashboard/[eventId]/guests/new
- [ ] /dashboard/[eventId]/guests/quick
- [ ] /dashboard/[eventId]/guests/import
- [ ] /dashboard/[eventId]/guests/claims
- [ ] /dashboard/[eventId]/guests/checkin
- [x] /dashboard/[eventId]/guests/souvenirs · OFFLINE: NEEDED (at the venue on the day; the desk is run by the couple's or coordinator's crew at the giveaway table, and it is not in `OFFLINE_COPY_SHAPES` today) · SHAPE: PAGE = PAGE (the crew reopens this station by its link on the day; Back and refresh must work)
- [x] /dashboard/[eventId]/guests/tea-ceremony · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE (printed and shared with both families)
- [x] /dashboard/[eventId]/seating · OFFLINE: READ-ONLY IS ENOUGH (the coordinator looking up a seat at the venue needs the saved copy; nobody edits the plan offline) · SHAPE: PAGE = PAGE (the address only forwards to Guests › Seats through `guestsViewHref(eventId, 'seats', …)`; Guests draws this same file with `host: 'guests'`, so the plan has one source)
- [x] /dashboard/[eventId]/seating/chart · OFFLINE: NOT NEEDED (disagree with plan: this prepares a print before the day) · SHAPE: PAGE → FULL-SCREEN POPUP (A2-E12)
- [x] /dashboard/[eventId]/seating/lab · OFFLINE: NOT NEEDED (disagree with plan: a heavy 3D room, no day-of use) · SHAPE: PAGE → FULL-SCREEN POPUP inside Guests › Seats, which already exists there (A2-E6)
- [x] /dashboard/[eventId]/seating/walkthrough · OFFLINE: NOT NEEDED (disagree with plan: an upload tool used before the day) · SHAPE: PAGE → FULL-SCREEN POPUP (A2-E12)
- [x] /dashboard/[eventId]/access-requests · OFFLINE: NOT NEEDED (disagree with plan: an answer needs the network to send) · SHAPE: PAGE = PAGE (notifications and the Home asks link here)
- [x] /dashboard/[eventId]/people · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/hosts · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE (the couple and helpers who hold the guest list are forwarded to `/guests`; it draws only for a helper who does not hold the guest list)

### Money
- [x] /dashboard/[eventId]/budget · OFFLINE: READ-ONLY IS ENOUGH (on the road / at an expo, to see what is still owed; no saved copy is built today) · SHAPE: PAGE = PAGE (its sheets are `Sheet rise`; Supplier → Record replaces the sheet, never stacks)
- [x] /dashboard/[eventId]/orders · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/orders/[orderId] · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/orders/new · OFFLINE: NOT NEEDED · SHAPE: forward only (`redirect(routes.dashboard.eventServices(eventId))` → `/dashboard/[eventId]/studio/website-pro`, row exists as `studio/[addon]`) = forward
- [x] /pay/[reference] · OFFLINE: NOT NEEDED (paying needs a connection) · SHAPE: PAGE = PAGE (opened from emails and buy buttons by link; the enlarged screenshot uses `OverlayBackdrop` + `useModalA11y`)
- [x] /receipts/[receiptId] · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /receipts/order/[orderId] · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /receipts/payment/[paymentId] · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE
- [x] /dashboard/[eventId]/refer · OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE
- [x] /proposals/[publicId] · OFFLINE: READ-ONLY IS ENOUGH · SHAPE: PAGE = PAGE (shared by link, printed)

### Suppliers
- [ ] /dashboard/[eventId]/vendors
- [ ] /dashboard/[eventId]/vendors/[vendorId] → /dashboard/[…]/vendors/[…]/workspace
- [ ] /dashboard/[eventId]/vendors/categories
- [ ] /dashboard/[eventId]/vendors/packages/[bookingId]
- [ ] /dashboard/[eventId]/vendors/[vendorId]/review
- [ ] /dashboard/[eventId]/contracts
- [ ] /dashboard/[eventId]/contracts/[contractId]
- [ ] /dashboard/[eventId]/disputes
- [ ] /dashboard/[eventId]/clearance
- [ ] /dashboard/[eventId]/messages
- [ ] /dashboard/[eventId]/messages/[threadId]
- [ ] /dashboard/[eventId]/manpower

### Plan the day
- [ ] /dashboard/[eventId]/details
- [ ] /dashboard/[eventId]/details/field/[row]
- [ ] /dashboard/[eventId]/details/change → /dashboard/[…]/details/field/area
- [ ] /dashboard/[eventId]/date-selection
- [ ] /dashboard/[eventId]/find-date
- [ ] /dashboard/[eventId]/checklist
- [ ] /dashboard/[eventId]/schedule
- [ ] /dashboard/[eventId]/documents
- [ ] /dashboard/[eventId]/paperwork
- [ ] /dashboard/[eventId]/sponsors
- [ ] /dashboard/[eventId]/nikah

## BLOCKERS

None found in the code pass so far.

## Findings

### Across the area (every page)

#### A2-X1 · Static cards still float on a shadow, light and dark
```
PAGE      every Area 2 page that draws a `.sn-frame` / `.sn-tile` / `.sn-row` card (Home, Budget, Guests, Suppliers, Schedule, Details, Profile …)   (event: Bea & Paolo)
BUTTON    —
STEPS     1. Open /dashboard/[eventId] in light, look at any card. 2. Settings › Appearance › Dark, open the same page.
EXPECTED  Light: a static card is a white surface with a 1 px hairline and NO shadow (Part I rule 4, 23 Nov). Dark: depth from a one-step-lighter card, NO shadow (K2, 24 Nov; DARK_MODE_STANDARD).
ACTUAL    The shared token still carries the 16 Nov "soft lift": light `--sn-frame-shadow: var(--m-shadow-md)` ("the soft lift — one value for tile, row and card"), and `.sn-tile` shares it via `--sn-frame-shadow-tile: var(--sn-frame-shadow)`. In `html.dark` the same token is a deep drop shadow (`0 14px 30px -14px rgb(0 0 0 / 0.85)`, "depth from light"). `.sn-frame` has no hairline border. One token fix in `apps/web/app/globals.css` (`--sn-frame-shadow`, `--sn-frame-shadow-tile`, the `.sn-frame` rule) changes every card at once; it also reaches other areas.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part I rule 4 (hairlines, not shadows) · Part K2 (no shadows in dark) · B6
SEVERITY  look
SOURCE    CODE
```

#### A2-X2 · Dark reaches 14 of 74 entries; the rest stay light
```
PAGE      every Area 2 page NOT listed here: /dashboard/[eventId] · /budget · /guests · /schedule (each exactly) · /dashboard/profile(+concierge) · /dashboard/people(+[dependentId]) · /dashboard/notifications · /dashboard/create-event · /dashboard/samahan(+children) · /signup/you
BUTTON    Settings › Appearance › "Dark"
STEPS     1. As couple_plan pick Dark. 2. Open /dashboard (the account home), then an event's Home, then Suppliers, then Budget, then /pay/[reference].
EXPECTED  Every signed-in screen follows the person's Dark choice with the flat page and the top-block glow (K2; kit § 5 item 7).
ACTUAL    Dark paints only on routes in `DARK_READY` (`apps/web/lib/appearance.ts`). Not on it, so they stay LIGHT for a person who chose Dark: the account home `/dashboard` itself, /onboarding/*, /dashboard/search, /billing, /api-keys, /clusters, and every event screen except Home, Budget, Guests and Schedule (Suppliers, Seating, Details, Messages, Orders, Documents, Paperwork, Check-in, every /guests/* sub-page …), plus /pay, /receipts, /proposals, /host/accept. Walking Home (dark) → Suppliers (light) → Budget (dark) flips the whole screen twice. This is the ruled roll-out ("area by area, only swept screens"), reported so the controller can decide how much dark must be done for launch. (Also stale: the `html.dark` comment in `globals.css` still says "Dark mode — INERT … LIGHT-LOCKED".)
SHOTS     none yet (phase B: 375 px dark on /dashboard and on an event's Suppliers)
RULE      HOUSE_DESIGN_STANDARD Part K2 · B4 ("dark is part of done") · kit § 5 item 7
SEVERITY  look
SOURCE    CODE
```

#### A2-X3 · Opening Create over the account home may darken the unswept home behind it
```
PAGE      /dashboard → /dashboard/create-event (the intercepted popup)   (signed in as couple_plan, Appearance = Dark)
BUTTON    "Create" / "New event" on the account home
STEPS     1. Pick Dark. 2. Open /dashboard (paints light: not on DARK_READY). 3. Press the create door: the create popup opens over the home and the address becomes /dashboard/create-event.
EXPECTED  Nobody meets a half-dark screen (appearance.ts call 3): either the home and the popup are both swept for dark, or neither paints dark.
ACTUAL    PLAUSIBLE. `/dashboard/create-event` is on `DARK_READY`; the intercepting route `app/(hub)/dashboard/@modal/(.)create-event/page.tsx` renders `CreateEventPanel` over the still-mounted /dashboard, and `app/_components/theme-provider.tsx` re-decides `.dark` on `usePathname()`. So the unswept home behind the panel should switch to dark tokens while the panel is up, and back to light when it closes. Phase B must look.
SHOTS     none yet (phase B: 375 px dark, before and after pressing create)
RULE      HOUSE_DESIGN_STANDARD Part K2 · lib/appearance.ts call 3 (no half-dark screen)
SEVERITY  look
SOURCE    CODE
```

#### A2-X4 · No glowing top block on the dark-ready event screens
```
PAGE      /dashboard/[eventId]/budget · /dashboard/[eventId]/guests · /dashboard/[eventId]/schedule (all on DARK_READY) · /dashboard/[eventId] on the event day and after · /dashboard · /dashboard/[eventId]/activity · every Area 2 page whose top is a bare `PageMasthead`   (event: Bea & Paolo, Appearance = Dark)
BUTTON    —
STEPS     1. Pick Dark. 2. Open Budget, Guests, Schedule. 3. Open the event Home inside the day-of window and after the day.
EXPECTED  Flat page; the screen's top block carries `--color-band-glow`, lit top-right (K2; DARK_MODE_STANDARD §3).
ACTUAL    In `apps/web/app/globals.css` the glow is read only by `.sn-band` (no component uses that class) and `.hc-ecard-plain` (the Home cover, `home-cover-band.tsx`); elsewhere only `papic-home-card.tsx` and the supplier/admin looks read it. `PageMasthead` renders its h1 `sr-only` and draws no band (`app/_components/page-masthead.tsx`), so Budget, Guests and Schedule — all three on `DARK_READY` — show a flat dark page with no lit top block. On the event Home the cover is drawn only by `HomeFirstScreen`; the `dayOfActive` and `afterActive` branches of `app/dashboard/[eventId]/page.tsx` draw no cover, so the day and after views are flat. The account home (`unihome.module.css`, `home-profile.module.css`) never reads the glow (it paints light today, A2-X2). The group readers each saw this on their own pages; it is written once here.
SHOTS     none yet (phase B: 390 px dark on Budget, Guests, Schedule)
RULE      HOUSE_DESIGN_STANDARD Part K2 · DARK_MODE_STANDARD §3
SEVERITY  look
SOURCE    CODE
```

### Money (group F)

Checked and fine (no finding): budget summary/list all come from `resolveEventMoneySettled` + `buildBudgetList`, a refused source draws "—" / a "+" floor (`ledgerRefused`, `owedFloor`); /pay amount comes from `orderGrossOwed` (voucher- and VAT-aware) and the receipt row is written by the same rule (`app/admin/payments/actions.ts` · `storedTotal` nets `voucher_discount_centavos`), so /pay and /receipts/[receiptId] agree; Maya approval re-asks Maya (`maya-return.ts` · `settleMaya`), the webhook is only a hint; ₱0 codes go to admin (`pay-code.ts` · `confirmFreeCode` → `notifyAdminsPaymentProofSubmitted`); the ordinary waiting state has its exit (`payable.back` main button). Only `/dashboard/*/budget$` of this group is on the dark ready-list (`lib/appearance.ts`), so no dark findings elsewhere.

#### A2-F1 · Second buttons not stepped down beside the main
```
PAGE      /dashboard/[eventId]/budget · /dashboard/[eventId]/orders/[orderId] · /proposals/[publicId]   (event: Bea & Paolo)
BUTTON    "Chat" (budget supplier sheet) · "Open receipt" + "Send your payment" (order) · "Accept quote" (quote)
STEPS     1. Budget → tap a booked supplier → the supplier sheet. 2. Open a paid order that still shows "still to send" (see A2-F2). 3. Open a sent quote as the host.
EXPECTED  One filled accent main per scope; every other button neutral (ink wash / hairline) or a text link.
ACTUAL    Budget supplier sheet: "Chat" is `tone="info"` (`actionButtonClass('info')` / `ActionButton tone="info"`), a blue outline on a blue wash, beside the main "Record a payment" — Code: `apps/web/app/dashboard/[eventId]/budget/_components/budget-sheets.tsx` · `SupplierSheet`. Order page: "Open receipt" is a hand-made filled green link (`bg-success-700 px-4 py-2 … text-cream`) and "Send your payment" is `button-primary`; both render together whenever a receipt exists and `totals.remaining > 0` — Code: `apps/web/app/dashboard/[eventId]/orders/[orderId]/page.tsx` · `Open receipt` / `Send your payment`. Quote page: the main "Accept quote" is a hand-made `bg-success-700 … text-white` button (green, not the accent, not `ActionButton`); "Send to couple" is hand-made `bg-ink` — Code: `apps/web/app/proposals/[publicId]/page.tsx` · `Accept quote`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1 (2, 3) · design-and-wiring D12 (one button primitive)
SEVERITY  look
SOURCE    CODE
```

#### A2-F2 · Order pages compute their own owed figure, disagree with /pay
```
PAGE      /dashboard/[eventId]/orders · /dashboard/[eventId]/orders/[orderId] · /receipts/order/[orderId]   (event: Bea & Paolo)
BUTTON    "Send your payment" · "Pay ₱X" (order slip) · — (list total)
STEPS     1. Buy an event service; on /pay apply a code (e.g. ₱500 off a ₱2,500 item) and pay the ₱2,000 the QR asks. 2. Open Orders, the order, and /receipts/order/<id> before and after HQ confirms.
EXPECTED  Every page names the same owed figure as the QR and the receipt: the ONE rule `orderGrossOwed` (nets the code off an unquoted order, honours VAT-inclusive keys, reads the effective VAT rate).
ACTUAL    Three private sums of `confirmed_total_php ?? requested_total_php`, none netting `voucher_discount_centavos` (`ORDER_SELECT` does not even read it): Orders list = `computeVatFromBase(Number(o.confirmed_total_php ?? o.requested_total_php), vatRatePct).gross`; order page = `computeOrderTotals(order, payments)` called WITHOUT a rate (defaults `vatRatePct = 0`, so it ignores `platform_settings` while the list and /pay read it, and today prints a "+ VAT (0%)" tile and "PH VAT (0%) is added on top" — the receipt rule says a non-VAT seller prints no VAT line); order slip = `stored = Number(order.confirmed_total_php ?? order.requested_total_php)` → "Pay {formatPhp(v.gross)}". So with a code applied the list, order page ("Total to pay", "Remaining", "₱2,500 still to send") and slip ask ₱2,500 while /pay asks ₱2,000; after HQ marks it paid the order page still shows "₱500 still to send" + "Send your payment" (`totals.remaining > 0 && order.status !== 'cancelled'` has no paid check) and /pay says settled. Code: `apps/web/app/dashboard/[eventId]/orders/page.tsx` · `computeVatFromBase(`; `apps/web/app/dashboard/[eventId]/orders/[orderId]/page.tsx` · `computeOrderTotals(order, payments)`; `apps/web/lib/orders.ts` · `vatRatePct = 0`; `apps/web/app/receipts/order/[orderId]/page.tsx` · `const stored =`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 (one reader; second copy is a defect) · design-and-wiring C8
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-F3 · Orders empty state offers a retired "custom quote"
```
PAGE      /dashboard/[eventId]/orders   (event: Lolo Ben at 80)
BUTTON    "New order"
STEPS     1. Open Orders on an event with no orders. 2. Read the empty line. 3. Tap New order.
EXPECTED  The words say what New order does now: opens Event services to buy a service.
ACTUAL    "No orders yet. Use New order above to request a custom quote." — but `/orders/new` is retired and forwards to Event services (`RetiredNewOrderPage` → `routes.dashboard.eventServices`); custom requests no longer exist. The flash texts for `self_comp=1` ("Self-comp order created…", the self-comp path was deleted) and `created=1` ("…log the payment so the Setnayan team can match it", logging moved to /pay) are also stale. Code: `apps/web/app/dashboard/[eventId]/orders/page.tsx` · `to request a custom quote`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring B5/B6 (words match the real destination)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-F4 · A refused "Cancel order" says nothing
```
PAGE      /dashboard/[eventId]/orders/[orderId]   (event: Bea & Paolo)
BUTTON    "Cancel order"
STEPS     1. As a co-host who did not place the order (or on an order that just became paid), press Cancel order.
EXPECTED  The page says the order could not be cancelled and why.
ACTUAL    `cancelOrder` filters `.eq('user_id', user.id)`; zero rows → `redirect(…?cancel=refused)`. The page's `searchParams` only reads `created`, `paid_logged`, `error` — nothing reads `cancel`, so the page reloads unchanged with no message. Code: `apps/web/app/dashboard/[eventId]/orders/actions.ts` · `?cancel=refused`; `apps/web/app/dashboard/[eventId]/orders/[orderId]/page.tsx` · `searchParams: Promise<{`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring B6 (a failure must render as a failure)
SEVERITY  broken
SOURCE    CODE
```

#### A2-F5 · Maya "Checking your payment" is a dead end
```
PAGE      /pay/[reference]   (event: Bea & Paolo)
BUTTON    —
STEPS     1. Pay with Maya and come back while Maya has not settled (`?maya=success`, result `pending`). 2. Wait past 20 re-asks (~60 s).
EXPECTED  A way back to the event and a press to try again, as the ordinary waiting state has ("THE WAITING PAGE MUST NOT BE A DEAD END").
ACTUAL    The `maya.phase === 'checking'` early return renders only `summaryFor(true)` + `<MayaChecking />` — no `payable.back` link (that is drawn only in the main render) and no button. After `TRIES` it says "Maya is still confirming your payment. Refresh in a minute." with nothing to press; /pay carries no site chrome, so in the installed app there is no way out but closing it. Code: `apps/web/app/pay/[reference]/page.tsx` · `data-pay-maya-checking-page`; `apps/web/app/pay/[reference]/_components/maya-checking.tsx` · `Refresh in a minute`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring B5 (no dead end) · brief: waiting state is not a dead end
SEVERITY  broken
SOURCE    CODE
```

#### A2-F6 · Pesos formatted outside lib/php.ts on pay and receipts
```
PAGE      /pay/[reference] · /receipts/[receiptId] · /receipts/order/[orderId] · /receipts/payment/[paymentId]   (event: Bea & Paolo)
BUTTON    —
STEPS     1. Pay a whole-peso order. 2. Compare /pay, the order page and the receipt slip.
EXPECTED  Every peso through `formatPhp` / `formatPhpRounded`: one spelling per figure.
ACTUAL    Private formatters: `payAmount` (`apps/web/lib/pay-amount.ts`, always ".00": /pay's headline, Maya receipt "Amount"); `formatPhpFromString` (`apps/web/lib/receipts.ts`, always ".00"); `slipFigure` (`apps/web/app/receipts/_components/receipt-slip.tsx`); `figure` (`apps/web/lib/payment-receipt-slip.ts`); `peso` (`apps/web/lib/payable-by-reference.ts`, /pay's line rows). One slip shows both spellings: /receipts/[receiptId] passes `amount={formatPhp(Number(receipt.gross_total_php))}` ("₱12,500") and `total={formatPhpFromString(receipt.gross_total_php)}` ("₱12,500.00"); /pay says "₱12,500.00" while the order page says "₱12,500".
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §1 (format money only through lib/php.ts) · design-and-wiring C8
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-F7 · Order slip names the wrong account and a gone step
```
PAGE      /receipts/order/[orderId]   (event: Sofia's 18th)
BUTTON    "Pay ₱X"
STEPS     1. Open an awaiting-payment order's slip from the account menu. 2. Read "Pay to" and "Then". 3. Open /pay for the same order.
EXPECTED  The slip names where /pay will actually take the money, and the next step that exists.
ACTUAL    "Pay to" = GCash whenever `settings.gcash_enabled && settings.gcash_number`, else BDO; /pay picks ONE rail by `pickPayerRail` (GCash only under this month's allowance, else BDO) and offers Maya first when open — so the slip can name GCash while /pay shows BDO or Maya. "Then: log the payment below" — there is nothing below on the slip, and the order page it links to no longer logs payments (it sends to /pay). Code: `apps/web/app/receipts/order/[orderId]/page.tsx` · `const payTo =` · `'log the payment below'`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 Payment (one reader for the pay route) · honest words
SEVERITY  wrong
SOURCE    CODE
```

#### A2-F8 · Receipt Pay button carries a raw hex colour
```
PAGE      /receipts/order/[orderId]   (event: Bea & Paolo)
BUTTON    "Pay ₱X"
STEPS     1. Open an awaiting-payment order slip.
EXPECTED  Token colours only; the button is the shared `ActionButton` / `actionButtonClass`.
ACTUAL    `RECEIPT_CTA = '… bg-terracotta-700 … text-[#FFFDF8] dark:text-cream'` — a hand-made filled button with a raw hex and a numbered palette class. Code: `apps/web/app/receipts/_components/receipt-slip.tsx` · `RECEIPT_CTA`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring D12/D13 · CLAUDE.md §3 Colour
SEVERITY  look
SOURCE    CODE
```

#### A2-F9 · Supplier receipt's "What is left" is a second money reader
```
PAGE      /receipts/payment/[paymentId]   (event: Bea & Paolo)
BUTTON    "PDF" (hosts' Receipt card) → —
STEPS     1. Book a supplier at a quote, accept a change order that adds to the price. 2. Pay the original total; supplier confirms. 3. Open the payment receipt, then the Budget page.
EXPECTED  "What is left" agrees with the budget's owed for that supplier (`resolveEventMoney` / `event_vendor_money_read`, which carries change-order deltas on top of the agreed price).
ACTUAL    The receipt reads `vendor_proposals.total_centavos` of the latest accepted quote directly and subtracts confirmed payments (`receiptOfPayment` → `leftCentavos: Math.max(0, agreed - paid)`); change orders are not in it, so it can print "Nothing · paid in full" while Budget still shows money owed. (The point-in-time rule — "as it stood when confirmed" — is intended; the agreed figure is the second copy.) PLAUSIBLE until walked with a change order. Code: `apps/web/app/receipts/payment/[paymentId]/page.tsx` · `.select('total_centavos')`; `apps/web/lib/deal-end.ts` · `receiptOfRow`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 Budget (amounts only via `event_vendor_money_read`) · design-and-wiring C8
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-F10 · Failed referral read shows "No referrals yet"
```
PAGE      /dashboard/[eventId]/refer   (event: Bea & Paolo)
BUTTON    —
STEPS     1. Open Refer a couple while the `referral_redemptions` read is refused.
EXPECTED  "Couldn't load the couples you referred" (ReadFailed), never the empty state.
ACTUAL    `const { data: rows } = await supabase.from('referral_redemptions')…` — `error` is never read; `(rows ?? []).map(…)` makes a failed read draw "No referrals yet. Share your link above…" and hides earned perks. Code: `apps/web/lib/referral-actions.ts` · `getMyReferral`; `apps/web/app/dashboard/[eventId]/refer/page.tsx` · `No referrals yet`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

### Home and the event (group B)

#### A2-B2 · Home's Shop part says "none" when the shop read failed
```
PAGE      /dashboard   (a shop owner's account)
BUTTON    —
STEPS     1. Sign in as an account that owns a shop. 2. The switcher read throws (or `fetchUserRoleSummary` degrades). 3. Look at the Shop part on Home.
EXPECTED  "Couldn't read your shop" (or the part withheld), never a claim that you have no shop.
ACTUAL    `loadSwitcherData` catches any throw and returns `context: { …, canOpenShop: false, shops: [] }`; `readUnihomeShop` then returns `{ kind: 'none' }` (also when `switcher` is null), and `ShopPart` prints "Shops on Setnayan are run by suppliers. Yours shows here once you have one." — i.e. a failed read told to an owner as "you have none". The component's own comment admits the case ("or the shops read was refused"). The guard `unihome-is-the-drawing.test.ts` test 7 holds the owner-path figures, not this branch. Code: `apps/web/lib/unihome.server.ts` · `if (!switcher) return { kind: 'none' }`; `apps/web/app/dashboard/(launcher)/_components/unihome.tsx` · `Yours shows here once you have one.`; `apps/web/app/_components/account-switcher/get-switcher-data.ts` · `getSwitcherData threw unexpectedly`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-B3 · Board shows two main "Create" buttons when Planning is empty
```
PAGE      /dashboard?seg=events   (an account whose Planning shelf is empty, e.g. only finished events)
BUTTON    "＋ Event" (pinned row) and "Create an event" (empty Planning shelf)
STEPS     1. Open /dashboard?seg=events with nothing upcoming. 2. Look at the pinned row and the Planning shelf.
EXPECTED  One main (filled accent) per screen; the second door to the same verb is neutral or a link.
ACTUAL    The pinned row's action is `ActionButton tone="brand" main={!tight}` (`pinned-row.tsx`, fed `action={{ label: 'Event', … href: '/dashboard/create-event' }}` by `HomePinnedRow`), and the empty shelf's `CollectionEmptyState` action is another `ActionButton … tone="brand" main … label="Create an event"`. Two filled terracotta buttons for the same verb on one screen. Code: `apps/web/app/(hub)/dashboard/page.tsx` · `title="Start an event"`; `apps/web/app/_components/pinned-row/pinned-row.tsx` · `main={!tight}`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE
```

#### A2-B4 · Event card "⋯" menu has no dim, blur or lock
```
PAGE      /dashboard?seg=events   (event: Bea & Paolo)
BUTTON    "Options for Bea & Paolo" (⋯ on the card)
STEPS     1. Open /dashboard?seg=events. 2. Press ⋯ on an event card. 3. Try scrolling / reading the page behind.
EXPECTED  The menu draws the ONE shared backdrop (dim + blur), the page behind is inert and does not scroll, backdrop tap closes it.
ACTUAL    The menu draws its own transparent `<button … className="fixed inset-0 z-40 cursor-default" />` as a click-catcher and a `role="menu"` panel; it does not use `OverlayBackdrop` or `useModalA11y` (no dim, no blur, no scroll lock, page not inert). Code: `apps/web/app/dashboard/(launcher)/_components/event-card-menu.tsx` · `Backdrop — closes on any outside press`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE
```

#### A2-B5 · Home recomputes "agreed" as paid + owing
```
PAGE      /dashboard/[eventId]   (event: Bea & Paolo)
BUTTON    —  (Budget card line "N% paid of ₱X agreed" and the phone tile "N% paid · ₱P of ₱X")
STEPS     1. Record a payment to a supplier that is larger than that supplier's agreed total (overpaid). 2. Open the event home. 3. Compare "agreed" with the Budget page.
EXPECTED  "Agreed" comes from the one reader (`resolveEventMoney` → `committed`, already fetched as `guard: read.money`, or `BudgetLiveSummary.budget`).
ACTUAL    Home builds its own: `const agreed = b.paidPhp + b.owingPhp; const pct = … b.paidPhp / agreed`, in both the card and the tile. `owingPhp` is `BudgetLiveSummary.remaining` = "budget − paid floored at 0", so with any overpayment `agreed` becomes the PAID figure, not the agreed total, and the share reads 100 %. The page only passes `{ paid, owing }` into `HomeMoneyRead` and drops `summary.budget`. A second copy of a money fact (agrees today only while nothing is overpaid). Code: `apps/web/app/dashboard/[eventId]/_components/home-control-row.tsx` · `const agreed = b.paidPhp + b.owingPhp`; `apps/web/app/dashboard/[eventId]/_components/home-control-faces.ts` · `const agreed = b.paidPhp + b.owingPhp`; `apps/web/app/dashboard/[eventId]/page.tsx` · `now: read.summary ? { paid: read.summary.paid, owing: read.summary.remaining }`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 (Budget: one reader) · design-and-wiring rule 8
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-B6 · Budget card stacks several main and green Pay buttons
```
PAGE      /dashboard/[eventId]   (event: Bea & Paolo, with 2+ payments due, one overdue)
BUTTON    "Pay" (each payment row in the Budget card / phone tile)
STEPS     1. Have two overdue payments and one not yet due. 2. Open the event home. 3. Look at the Budget card.
EXPECTED  At most one main button in the card; every other Pay steps down to neutral.
ACTUAL    Each row renders `ActionButton tone={late ? 'brand' : 'ok'} main={late}`: every overdue row is a filled terracotta main (two overdue = two mains in one card) and every other row is a green-washed `ok` button (another bright colour). The phone tile does the same per face: `action: { … label: 'Pay', … main: late || (isToday && i === 0) }`. Code: `apps/web/app/dashboard/[eventId]/_components/home-control-row.tsx` · `tone={late ? 'brand' : 'ok'} main={late}`; `apps/web/app/dashboard/[eventId]/_components/home-control-faces.ts` · `main: late || (isToday && i === 0)`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1 (2, 3, 4: "Inside one card, the rule above holds")
SEVERITY  look
SOURCE    CODE
```

#### A2-B7 · Guests card's main button is blue, not the accent
```
PAGE      /dashboard/[eventId]   (event: Bea & Paolo, guests added, invitations not sent)
BUTTON    "Send the invitations"
STEPS     1. Add guests, send none. 2. Open the event home. 3. Look at the Guests card.
EXPECTED  The card's one main is the filled accent (terracotta); "Later" neutral.
ACTUAL    `ActionButton tone="info" main … label="Send the invitations"` — a filled main in the info (blue) tone beside terracotta mains on the other cards of the same screen. Code: `apps/web/app/dashboard/[eventId]/_components/home-control-row.tsx` · `tone="info" main`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1 (1: main = the filled accent; 2: never another bright colour)
SEVERITY  look
SOURCE    CODE
```

#### A2-B8 · Event-day and after Home use typed half-pixel sizes
```
PAGE      /dashboard/[eventId]   (event day / after the day)
BUTTON    "Open the live desk" · "Planning tools — still here if you need them"
STEPS     1. Open the event home inside the day-of window (or after the day). 2. Look at the live-desk tile and the Planning tools fold.
EXPECTED  Type from the `text-sn-*` scale only; never `text-[Npx]`, never half pixels.
ACTUAL    In `page.tsx` itself: `text-[15px]` and `text-[12.5px]` on the live-desk tile, `text-[13.5px]` on both `<summary>` lines (day-of and after). Code: `apps/web/app/dashboard/[eventId]/page.tsx` · `text-[12.5px] text-ink/55` · `text-[13.5px] font-semibold text-ink/70`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §3 Type · design-and-wiring rule 13
SEVERITY  look
SOURCE    CODE
```

#### A2-B9 · Activity shows "Nothing has happened yet" on a failed read
```
PAGE      /dashboard/[eventId]/activity   (event: Bea & Paolo)
BUTTON    —  (and "Add your first guest" in the empty state)
STEPS     1. Open Bea & Paolo › See all recent activity. 2. Let the guests / event_vendors / orders / event_schedule_blocks reads fail (RLS refusal or blip).
EXPECTED  A failed read says so (ReadFailed / "Couldn't read"), never the empty state; a partly failed read says which part is missing.
ACTUAL    `fetchEventActivity` never looks at `error`: it loops `guestsRes.data ?? []`, `vendorsRes.data ?? []`, `ordersRes.data ?? []`, `blocksRes.data ?? []`. All four failing → `activity.length === 0` → `QuietStart title="Nothing has happened yet."` plus "Add your first guest" to a couple with 180 guests; one failing silently drops that source from the feed. No honest-read guard covers `lib/activity.ts`. Code: `apps/web/lib/activity.ts` · `for (const g of guestsRes.data ?? [])`; `apps/web/app/dashboard/[eventId]/activity/page.tsx` · `Nothing has happened yet.`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-B10 · Activity formats pesos with its own toLocaleString
```
PAGE      /dashboard/[eventId]/activity   (event: Bea & Paolo, with an order)
BUTTON    —  (row "Order placed · … · ₱…")
STEPS     1. Place an order. 2. Open the activity feed.
EXPECTED  Peso amounts go through `lib/php.ts` (`formatPhp` / `formatPhpRounded`).
ACTUAL    `formatPeso` in `lib/activity.ts` builds `` `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 0 })}` `` itself, and hides a 0 or missing total (`n <= 0` → no figure). (Lead: `wrong`, not money — the figure itself is right today.) Code: `apps/web/lib/activity.ts` · `function formatPeso`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §1 Money (format only through lib/php.ts) · design-and-wiring rule 8
SEVERITY  wrong
SOURCE    CODE
```

Notes (not findings): the forwards (/dashboard/year, /more, /progress) all land on targets that exist. Event home reads were spot-checked against its ~45 guard tests (honest money / guests / orders / Today / deep links). No banned words found in what a person reads on these pages. "Your photos are safe" (Memories read failure) is an allowed status line. Home's "Open shop dashboard" (supplier navy, filled) is drawn as in the approved Unihome v5 drawing, so it is not reported under K1. I did not report the rest of the typed-px and legacy-class debt on these pages (repo-wide counts are excluded).

### Seats, souvenirs and people (group E)

Notes on the lab (page 5), as asked:
- **What it is.** The 3D seat-plan room ("Sims build" plus walk-to-seat). The same component is streamed inside Guests › Seats as the 3D view: `seating/page.tsx` renders `<SeatingLabPage … searchParams={{ maker: '1' }}>`.
- **Can a couple reach the bare address?** Yes. The mood board's "Edit in Seat Plan →" link points there (`studio/mood-board/_components/mood-board-editor.tsx`, `href={`/dashboard/${eventId}/seating/lab`}`).
- **Who else links to it?** The seat editor's own `router.push(labUrl)` branches run only when `details` is not set. `seating/page.tsx` always passes `details`, so those pushes are never reached.
- **Should it exist as a person's page?** No. It should forward to Guests › Seats with the 3D view open (see A2-E6).
Connections, as asked:
- **Guests › Seats against the seating pages.** `?gview=seats` and `/seating` cannot disagree: they are the same `SeatingPage` file. The disagreement is inside the seat plan itself, and between it and the entrance chart (A2-E4).
- **A decline frees the seat.** This exists (`free_seat_on_decline`, migration `decline_frees_seat_assignment`).
- **Pending guests hold seats.** The capacity check counts every non-declined guest (`nonDeclinedCount`).
- **Hosts and helpers.** Invite and remove reach real couple-only actions:
  - `inviteHost` uses `requireCoupleMembership` and accepts the hired planner only.
  - `removeHost` and `setDelegateArea` are host-only.
  - The consent scopes are recorded as `vendor_lock: false, checkout: false`.
- **"Only a host books or pays."** I found no helper-facing control on these pages that books or pays:
  - The claim **Approve** (which can book) goes through `answer_claim_access_request`, which checks for the couple. A limited helper is refused by `limitedHelperRefusal`.
  - The `/hosts` helper view is read-only (`CoordinatorGrantChips`).

#### A2-E1 · Souvenir count counts declined and undecided guests as expected
```
PAGE      /dashboard/[eventId]/guests/souvenirs   (event: Bea & Paolo)
BUTTON    —  ("Souvenirs given  N / total")
STEPS     1. Open the Guests page, then Souvenir table. 2. Have some guests declined or pending. 3. Read the "Souvenirs given" count.
EXPECTED  The total counts the guests expected at the door, read through the one headcount reader (attending only, as the check-in desk's "expected" is).
ACTUAL    The total is every row on the list: declined, pending, maybe and every companion seat row. The page reads its own `guests` query and passes the whole roster. The desk then shows `received / formatCount(total)` with `const total = guests.length;`, so the bar can never reach "everyone" on a real event. The check-in desk on the same event uses `guests.filter((g) => g.rsvpStatus === 'attending')`. `countsTowardEvent` / `computeGuestStats` are not used. Code: `apps/web/app/dashboard/[eventId]/guests/souvenirs/_components/souvenir-desk.tsx` · `const total = guests.length;`; `.../souvenirs/page.tsx` · `const roster = (guestsRaw ?? []) as GuestRow[];`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 (Guest: check-in "expected" = attending only; one reader) · design-and-wiring C8
SEVERITY  wrong
SOURCE    CODE
```

#### A2-E2 · Souvenir desk opens normally when the guest list fails to load
```
PAGE      /dashboard/[eventId]/guests/souvenirs   (event: Bea & Paolo)
BUTTON    "Scan a guest QR"
STEPS     1. The `guests` read is refused or errors. 2. Open Souvenir table. 3. Scan any guest's QR.
EXPECTED  A refused guest read stops the desk and says it could not read the list. It never offers a scanner that turns every real guest away.
ACTUAL    The page shows only the partial `ReadRefusedNotice` ("a guest, their table, or who has already collected") and still renders `SouvenirDesk` with `guests = []`. The counter reads "0 / 0". Every scan then answers "That QR isn't a guest on this event's list.", which blames the guest at the table. The page's own comment warns about this exact effect for a delegate, but the read-failure path falls into it anyway. Code: `apps/web/app/dashboard/[eventId]/guests/souvenirs/page.tsx` · `somethingRefused` / `(guestsRaw ?? [])`; `souvenir-desk.tsx` · `That QR isn’t a guest on this event’s list.`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-E3 · Tea serving order lists declined guests and calls everyone an elder
```
PAGE      /dashboard/[eventId]/guests/tea-ceremony   (event: a Chinese wedding; not one of the seeded three)
BUTTON    —  ("N elders" per side)
STEPS     1. On a Chinese wedding, have guests on the groom's side who declined, plus friends and colleagues. 2. Open Paperwork › Tea ceremony.
EXPECTED  The serving order is the elders who are coming. The count beside each side counts those people.
ACTUAL    `served` drops only the bride, the groom and companion rows (`g.role !== 'bride' && g.role !== 'groom' && !g.plus_one_of_guest_id`). Every other accepted guest on a side is numbered into the printed order, including declined guests, friends and colleagues. Each side is labelled `${formatCount(guests.length)} elders`. Separately, a failed `events` read goes to `notFound()`, so a read error shows a 404 rather than "couldn't read". Code: `apps/web/app/dashboard/[eventId]/guests/tea-ceremony/page.tsx` · `const served = guests.filter(` · `elders` · `if (!eventRow || !isChineseWedding(eventRow))`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 (headcount via countsTowardEvent / attending) · CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-E4 · Seat plan and entrance chart give different unseated counts
```
PAGE      /dashboard/[eventId]/guests?gview=seats (= /seating) · /dashboard/[eventId]/seating/chart   (event: Bea & Paolo)
BUTTON    "N to seat" chip (desktop) · "Unseated: N" (phone) · chart notice "N guests have no seat yet"
STEPS     1. Have attending, pending and declined guests, some unseated, plus one "after party only" guest. 2. Open Guests › Seats on desktop and hover the "to seat" chip. 3. Open it on a phone. 4. Open Entrance seating chart.
EXPECTED  One unseated count, from one reader in `lib/seating.ts` (pending guests hold seats; declined guests do not), shown the same way everywhere.
ACTUAL    The same event shows four different "unseated" numbers:
          • Desktop chip "{toSeatReserved} to seat" counts attending guests only (`page.tsx` · `reservedGuests = seatingGuests.filter((g) => g.rsvp_status === 'attending')`).
          • That chip's own tooltip says "{unseatedCount} unseated" and counts every guest, declined included (`seating-editor.tsx` · `const unseatedCount = guests.length - seatedCount;`). The same tooltip's `totalCapacity` adds raw `t.capacity`, while the page's `totalSeats` uses `effectiveCapacity` (removed chairs).
          • The phone shows "Unseated: N" from `unseatedComing` (non-declined).
          • The entrance chart uses `unseatedCount()` in `lib/print-entrance-chart.ts` (non-declined). It also does not drop the guests `readNoSeatGuestIds` takes off the seat plan, so after-party-only guests are reported as "no seat yet".
          `computeSeatingStats` in `lib/seating.ts` exists and nothing uses it.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 (Seat: one reader, lib/seating.ts) · design-and-wiring C8/C9
SEVERITY  wrong
SOURCE    CODE
```

#### A2-E5 · Booked suppliers read from a second status list
```
PAGE      /dashboard/[eventId]/people · /dashboard/[eventId]/seating/lab   (event: Bea & Paolo)
BUTTON    —  ("Booked to be there · N suppliers"; the 3D room's booked-supplier zone suggestions)
STEPS     1. Open Who is here. 2. Read the suppliers count.
EXPECTED  "Booked" is read from `BOOKED_EVENT_VENDOR_STATUSES` (`lib/vendor-funnel.ts`), the one reader.
ACTUAL    Both pages filter on `CONFIRMED_VENDOR_STATUSES`, a separate literal list in `lib/events.ts`. It holds the same four values today, but it is a second copy that will drift the first time a booked status is added. Code: `apps/web/app/dashboard/[eventId]/people/page.tsx` · `.in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[])`; `apps/web/app/dashboard/[eventId]/seating/lab/page.tsx` · same string; `apps/web/lib/events.ts` · `export const CONFIRMED_VENDOR_STATUSES = [`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §4 (booked = BOOKED_EVENT_VENDOR_STATUSES) · design-and-wiring C8
SEVERITY  wrong
SOURCE    CODE
```

#### A2-E6 · Mood board opens a standalone 3D room titled "prototype"
```
PAGE      /dashboard/[eventId]/seating/lab   (event: Bea & Paolo; also a helper on Lolo Ben at 80)
BUTTON    "Edit in Seat Plan →" (Mood Board)
STEPS     1. Open Studio › Mood Board (outside the Maker). 2. Press "Edit in Seat Plan →". 3. Read the browser tab title. Also: as a helper the couple did not share the seat plan with, open /seating/lab by address.
EXPECTED  The link opens Guests › Seats with the 3D view (where the 3D room lives since R4), behind the same gates as the seat plan.
ACTUAL    The link goes to the bare `/seating/lab` page, outside the Guests shell. Its tab title reads "Seating · 3D lab (prototype)".
          The bare route does not check `surfaceEnabled(…, 'seating')` or `isDelegateWithoutArea(viewer, 'guest_list' | 'seat_plan')`. `seating/page.tsx` and `seating/chart/page.tsx` both do.
          PLAUSIBLE: for a helper without the seat plan, the reads return zero rows, so the page would draw an empty room instead of "not shared with you". A browser walk must confirm.
          The editor's own `router.push(labUrl)` is unreachable (`details` is always passed), so the mood-board link is the only live door to this route.
          Code: `apps/web/app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx` · `Edit in Seat Plan →`; `apps/web/app/dashboard/[eventId]/seating/lab/page.tsx` · `title: 'Seating · 3D lab (prototype)'`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring A2/A4 (one shell; every way in moves with it) · SHAPE (3D room = FULL-SCREEN POPUP over Guests › Seats)
SEVERITY  broken
SOURCE    CODE
```

#### A2-E7 · Access requests says "Nothing waiting" when the check failed
```
PAGE      /dashboard/[eventId]/access-requests   (event: Bea & Paolo)
BUTTON    —
STEPS     1. `readClaimAccessAsks` fails (claimsRead.measured = false) while the areas read succeeds with no pending rows. 2. Open Access requests.
EXPECTED  Only the "could not check" line, never a claim that nothing is waiting.
ACTUAL    The page draws "We could not check for suppliers who joined from your link. Reload to try again." Below it, the empty branch (`pending.length === 0 && !(claimsRead.measured && claimsRead.asks.length > 0)`) still draws "Nothing waiting on you.", which contradicts it. A supplier waiting to be let in reads as no one waiting. Code: `apps/web/app/dashboard/[eventId]/access-requests/page.tsx` · `Nothing waiting on you.`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-E8 · Who is here: a failed read says "not shared with you"
```
PAGE      /dashboard/[eventId]/people   (event: Bea & Paolo)
BUTTON    —
STEPS     1. The viewer's own `event_members` read errors (memberRes.error). 2. Open Who is here as the couple.
EXPECTED  "Couldn't read", with a retry.
ACTUAL    The error is logged, then `isCouple` becomes false and `delegatePermissions` null. `buildPeopleGroups` returns nothing, and the page tells the couple "None of this event's lists are shared with you. Ask the couple if you need to see who is coming." A refused read is stated as a fact about their access. Code: `apps/web/app/dashboard/[eventId]/people/page.tsx` · `if (memberRes.error)` · `None of this event&rsquo;s lists are shared with you`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-E9 · Two filled main buttons on the souvenir desk
```
PAGE      /dashboard/[eventId]/guests/souvenirs   (event: Bea & Paolo)
BUTTON    "Scan a guest QR" · "Confirm souvenir given"
STEPS     1. Open Souvenir table. 2. Search a name and pick a guest (the scanner is off).
EXPECTED  One main button per screen (K1). Once a guest is picked, "Confirm souvenir given" is the main button and the scanner button steps down to neutral.
ACTUAL    Both are `ActionButton tone="brand" main`, and both show at once. Code: `apps/web/app/dashboard/[eventId]/guests/souvenirs/_components/souvenir-desk.tsx` · `label="Scan a guest QR"` · `label="Confirm souvenir given"`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE
```

#### A2-E10 · Bright filled answer buttons and spinners on access cards
```
PAGE      /dashboard/[eventId]/access-requests   (event: Bea & Paolo)
BUTTON    "Share" / "Decline" (per line) · "Send my answer" · "Approve" / "Decline" (joined-from-link card)
STEPS     1. Have a pending area request. 2. Press Share on one line and Decline on another.
EXPECTED  One main button per card (K1). The other choices are neutral, made with ActionButton / PillSelector. No spinners.
ACTUAL    • RequestCard: a chosen line turns hand-made `bg-success-500` (Share) or `bg-warn-600` (Decline) filled. These sit beside the main "Send my answer", so one card shows several bright fills.
          • ClaimAccessCard: hand-rolled `<button>`s (`bg-ink` filled Approve). It shows a `Loader2 … animate-spin` spinner while sending and uses `text-[12px]`.
          Code: `apps/web/app/dashboard/[eventId]/access-requests/_components/request-card.tsx` · `border-success-400 bg-success-500 text-cream`; `.../claim-access-card.tsx` · `animate-spin`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1 · CLAUDE.md §3 (Button = ActionButton; Loading: no spinners)
SEVERITY  look
SOURCE    CODE
```

#### A2-E11 · Walkthrough: accent buttons, white input, native confirm
```
PAGE      /dashboard/[eventId]/seating/walkthrough   (event: Bea & Paolo)
BUTTON    "Save name" · "Save tables" · "Showing to guests" · swipe delete / "Remove video"
STEPS     1. Open Seat plan ⋯ › Walkthrough videos. 2. Add a zone, rename it and tick tables (do not save). 3. Swipe the zone left; press Remove video.
EXPECTED  One main button per zone card, with the others neutral (K1). No `bg-white`. Confirms use the shared Sheet (K3).
ACTUAL    • Rename: "Save name" is `ActionButton tone="brand"`, which is accent-outlined. It sits in the same card as "Save tables" (`tone="brand" main`).
          • The "Showing to guests" toggle is a hand-made `bg-success-100` filled pill.
          • The new-zone input carries `bg-white dark:bg-raised`.
          • Delete and Remove video ask through the browser's `confirm(…)`, not a shared Sheet.
          Code: `apps/web/app/dashboard/[eventId]/seating/walkthrough/_components/walkthrough-manager.tsx` · `label="Save name"` · `bg-white dark:bg-raised` · `confirm('Remove this walk video?`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part K1 · K2 (no white surfaces) · K3
SEVERITY  look
SOURCE    CODE
```

#### A2-E12 · Chart and walkthrough are pages, should be full-screen popups
```
PAGE      /dashboard/[eventId]/seating/chart · /dashboard/[eventId]/seating/walkthrough   (event: Bea & Paolo)
BUTTON    Seat plan ⋯ menu rows "Entrance seating chart" · "Walkthrough videos"
STEPS     1. Open Guests › Seats. 2. Open ⋯ and pick either row.
EXPECTED  By the SHAPE tests, neither is shared or come back to by link. Each is more than one short screen: the chart has a paper preview plus layout, size and Save; the walkthrough records or uploads video. Both should be a FULL-SCREEN POPUP (`RiseScreen`) over Guests › Seats, where ✕ returns to the same place.
ACTUAL    Both are separate pages reached by `MenuRow … href`, leaving the seat plan.
          The chart page also draws its paper with `bg-raised shadow-[0_1px_8px_rgba(0,0,0,0.14)]` and a loading veil of `animate-pulse bg-white/70`, and the Save button shows a `Loader2 animate-spin` spinner.
          Code: `apps/web/app/dashboard/[eventId]/seating/_components/seating-editor.tsx` · `label="Walkthrough videos"` · `label="Entrance seating chart"`; `.../seating/chart/_components/entrance-chart.tsx` · `animate-pulse bg-white/70`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      SHAPE (owner 25 Nov) · CLAUDE.md §3 (Loading: no animate-pulse, no spinners) · Part K2 (no white, no static shadow)
SEVERITY  look
SOURCE    CODE
```

#### A2-E13 · Souvenir and tea pages load with the guest-list skeleton
```
PAGE      /dashboard/[eventId]/guests/souvenirs · /dashboard/[eventId]/guests/tea-ceremony   (event: Bea & Paolo)
BUTTON    —
STEPS     1. From the event Home or Paperwork, open Souvenir table (or Tea ceremony) on a slow connection.
EXPECTED  The skeleton draws only what the page draws.
ACTUAL    PLAUSIBLE: neither route has its own `loading.tsx`, so the nearest one is `guests/loading.tsx`. That draws the guest List's skeleton ("Guests · List" ghost, list rows) inside `GuestsLastCopy`, which may paint the saved guest list itself while the souvenir desk or the serving order loads. A browser walk must confirm what shows. Code: `apps/web/app/dashboard/[eventId]/guests/loading.tsx` · `Ghost known="Guests · List"` · `<GuestsLastCopy>`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §3 (Loading: the skeleton draws only what the page draws)
SEVERITY  look
SOURCE    CODE
```

#### A2-E14 · Souvenir title is hand-made; Who is here uses half-pixel text
```
PAGE      /dashboard/[eventId]/guests/souvenirs · /dashboard/[eventId]/people   (event: Bea & Paolo)
BUTTON    —
STEPS     1. Open each page.
EXPECTED  The page title comes from `PageMasthead`. Type uses the `text-sn-*` scale, never a typed or half pixel size.
ACTUAL    • Souvenirs hand-rolls `<header><h1 className="… text-2xl font-semibold">` with no `PageMasthead`. It is not in the lint's ALLOWED list; only `guests/tea-ceremony` is.
          • People uses `text-[12.5px]` (a half pixel), plus `text-[12px]` and `text-[13px]`, on every group row.
          Code: `apps/web/app/dashboard/[eventId]/guests/souvenirs/page.tsx` · `Souvenir table` h1; `apps/web/app/dashboard/[eventId]/people/page.tsx` · `text-[12.5px]`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §3 (Page title = PageMasthead; Type: never text-[Npx], never half pixels)
SEVERITY  look
SOURCE    CODE
```

### Create an event (group A)

#### A2-A1 · Create-an-event is a bare page, not a full-screen popup
```
PAGE      /onboarding/[type] · /onboarding/simple · /onboarding/wedding · /dashboard/create-event   (signed in, from the /dashboard board)
BUTTON    "+ New event" → a type tile → ✕ / Back
STEPS     1. On /dashboard tap "+ New event". 2. Pick "Debut" (or Wedding). 3. On the first question tap ✕. 4. Repeat, go 3 steps in, then use the phone's Back.
EXPECTED  The whole create flow rises as ONE RiseScreen over the page it was started from; ✕ (and phone Back on screen 1) falls back to that same page; a large centred dialog on desktop; never a popup on a popup.
ACTUAL    Three different shapes. (a) The picker opens in a SidePanel over the board (`app/dashboard/(launcher)/_components/create-event-panel.tsx` · `<SidePanel open={open} onClose={close} title="New event" size="wide" phone="sheet">`). (b) Tapping a type does `router.replace(withNext(route))` (`event-type-picker.tsx` · `handleSelect`), so the panel vanishes and a bare full page loads at /onboarding/<type> (no shell, no top bar, no bottom nav; generic flow draws its own `<main className="flex min-h-screen flex-col bg-page">`). (c) ✕ on screen 1 goes to a FIXED address, not where the person started: `app/onboarding/_shared/onboarding-exit.ts` · `ONBOARDING_EXIT_HREF = '/dashboard/create-event'` (full create-event page, not the board they came from); signed out it is `'/'`, not /start where the tiles live. (d) Phone Back differs per flow: the wedding traps it with a sentinel history entry and steps back (`onboarding-shell.tsx` · `snOnboarding: true`), while /onboarding/[type] and /onboarding/simple have no popstate handling, so Back on step 5 drops the person out of the flow (the generic flow keeps answers in its draft but restarts at step 0 — `if (resume) setStep(...)` only). /onboarding/simple's "‹ Back" goes to /dashboard/create-event while its Cancel goes to `/dashboard`. Desktop: generic is a `max-w-xl` column on a full page, wedding uses its own `onb-twopane` two-pane layout; RiseScreen itself today is `fixed inset-0 … h-[100dvh]` with no centred-dialog desktop form (`app/_components/rise/rise-screen.tsx`).
SHOTS     none yet (phase B: 375 px light + dark)
RULE      SHAPE (owner 25 Nov, test 2: more than one short screen → FULL-SCREEN POPUP; ✕ returns to the same place)
SEVERITY  look
SOURCE    CODE
```

#### A2-A2 · Get-together tile sends signed-out visitors to login
```
PAGE      /onboarding/simple   (reached from /start or the front door, signed out)
BUTTON    the "Get-together" tile
STEPS     1. Signed out, open /start (or the front-door tiles). 2. Tap "Get-together".
EXPECTED  Zero friction: the questions run with no account; the account is asked only at save (owner 2026-10-25, quoted in `startHrefFor`: "Yes they can create an event. But saving an event must link by logging in").
ACTUAL    The tile goes to the type's `onboarding_href` = /onboarding/simple (`event-types.ts` · `startHrefFor` → `onboardingRouteFor` returns `t.onboardingHref` first; seeded '/onboarding/simple' in migration `20270307127948_simple_event_type_role_set_and_profile.sql`). That page redirects before any question: `app/onboarding/simple/page.tsx` · `if (!user) redirect('/login?next=/onboarding/simple');` and its action does the same (`commitSimpleEvent` · `return redirect('/login?next=/onboarding/simple')`). Every other type runs signed out and mints an anonymous session at the commit; this one is a login wall at the door. (An existing anonymous session passes, since `getCurrentUser` returns it.)
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §1 zero friction (a host starts an event with no account)
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-A3 · A rate-limited signed-out host cannot save, no way on
```
PAGE      /onboarding/[type] · /onboarding/wedding   (signed out, last screen)
BUTTON    "Create my debut" / the wedding's last "Continue"
STEPS     1. Signed out, on a shared network (mobile-carrier NAT, venue or expo wifi), walk any onboarding. 2. Press the final button after 5 other anonymous saves from the same IP that day.
EXPECTED  A plain reason and a way forward (sign in / create an account, the draft kept), never a "try again" that cannot succeed.
ACTUAL    Both commits refuse with `{ ok: false, error: 'rate_limited' }` when `allowAnonMint` says no (`app/onboarding/_shared/commit-event.ts` and `app/onboarding/wedding/actions.ts`; limit `MAX_PER_WINDOW = 5` per IP per `WINDOW_SECONDS = 60 * 60 * 24` in `lib/anon-mint-throttle.ts`). Neither client knows the code: generic shows `'Something went wrong saving your plan. Please try again.'` (only `'not_authenticated'` gets the sign-in link), and the wedding's `else` branch shows the same sentence; the account screen was dropped from the sequence (`id === 'account' && (authed || ANON_DRAFT_ENABLED)`), so there is no sign-in door on the screen. Retrying hits the same limit. The same dead end follows a failed anonymous mint in the wedding (`if (ANON_DRAFT_ENABLED) { setCommitError('Something went wrong saving your plan. Please try again.') }`). PLAUSIBLE how often it fires: whether many Filipino mobile users share one public IP must be confirmed from the `anon mint` throttle rows / logs.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §1 zero friction · §5 rule 4 (a failure gives a plain reason plus a way on)
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-A4 · Securing an anonymous plan with Google or log-in loses it
```
PAGE      /signup and /login, reached from the dashboard's save prompt after a signed-out onboarding (event: Lolo Ben at 80, made signed out)
BUTTON    "Continue with Google" (Apple / Facebook) on /signup · "I already have an account"
STEPS     1. Signed out, finish /onboarding/birthday → the event is saved under an anonymous session. 2. On the dashboard, the save prompt → "Create a free account". 3. Choose Google instead of email + password (or choose "I already have an account" and log in).
EXPECTED  The event made in step 1 is on the account the person ends up signed into.
ACTUAL    Only the email + password sign-up converts the anonymous user in place (`app/signup/actions.ts` · `if (existingUser?.is_anonymous) { … admin.auth.admin.updateUserById(userId, { email, password, … }) }`). The OAuth buttons call `supabase.auth.signInWithOAuth` (`app/auth/oauth-actions.ts` · `signInWithProvider`), which signs in a different user; nothing in `app/auth/callback/route.ts` or `app/login/actions.ts` mentions the anonymous session, and no `linkIdentity` exists in the repo. The event stays on the anonymous user and is later deleted by `app/api/cron/anon-draft-sweep/route.ts`. Both doors are offered to anonymous users by `app/_components/anon-gate/save-to-continue.tsx` (`href={`/signup?next=${next}`}` · `href={`/login?next=${next}`}` "I already have an account"), and OAuth is ON in production (`NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED` etc., build-sessions/P0-b-SWITCHES.md). A browser walk must confirm the event is missing after the Google round trip.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §1 zero friction (the account is asked at save; nothing made before it is lost)
SEVERITY  money-signin
SOURCE    CODE
```

#### A2-A5 · Onboarding prices formatted by three home-made peso helpers
```
PAGE      /onboarding/wedding · /onboarding/[type] · /onboarding/simple   (the services step and the wedding budget card)
BUTTON    —
STEPS     1. Walk any onboarding to the services step (Papic, Setnayan AI, Event Pro cards). 2. On the wedding, open the budget card.
EXPECTED  Every peso goes through `lib/php.ts` (`formatPhp` / `formatPhpRounded`).
ACTUAL    Three copies of `const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`;` — in `app/onboarding/_shared/services-step.tsx` (the "You'll pay" / "You save" lines, `PriceLine`), `lib/onboarding/services-step-data.ts` (`priceLabel: peso(aiPricePhp)`), and `app/onboarding/wedding/_components/wedding-cards.tsx` (budget hints `about ${peso(r.pesos)}`). Same output today; a second formatter is the drift CLAUDE.md §1 forbids. (Lead: set to `wrong`, not money — no figure differs today.)
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §1 (money only through lib/php.ts) · design-and-wiring C8
SEVERITY  wrong
SOURCE    CODE
```

#### A2-A6 · "Free to start, always." in the share text
```
PAGE      /onboarding/[type] · /onboarding/wedding
BUTTON    — (page metadata: link previews, browser tab)
STEPS     1. Share an /onboarding/debut or /onboarding/wedding link in Messenger.
EXPECTED  No price promise.
ACTUAL    `app/onboarding/[type]/page.tsx` · `"A few quick questions and we'll shape a plan made for your event. Free to start, always."` and `app/onboarding/wedding/page.tsx` · `"… every supplier sorted to fit. Free to start, always."`. brand.md bans "always free"-type promises; "Free to start, always" reads as one.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      brand.md claims never made, rule 3 (price promises)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-A7 · A failed profile read shows a blank "You" card
```
PAGE      /signup/you
BUTTON    "Done"
STEPS     1. A returning person opens /signup/you while the `users` read fails. 2. They retype a display name and press Done.
EXPECTED  A failed read says it could not read, and never lets Done write blanks over saved values.
ACTUAL    `app/signup/you/page.tsx` · `const { data: profile } = await supabase.from('users').select('display_name, slug, … phone, …')` — the `error` is never read; `const me = (profile ?? {}) as YouCardMe;` draws empty fields as if nothing were saved. Done then posts the empty phone and formal-name fields through `planYouCard` → `planPersonalInfoPatch`, so saved values can be cleared. The action's own read is the same shape (`app/signup/you/actions.ts` · `const { data: mine } = … select('slug, account_type')`), so a failed read makes `existing.slug === null` and a posted @name is applied to an account that already has one (bypassing the rename cap the comment names). Brand-new accounts lose nothing; a returning person can.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-A8 · "Your wedding plan is saved" email for every event type
```
PAGE      /signup (the save of an anonymous plan, on the way to /signup/you)   (event: Sofia's 18th, made signed out)
BUTTON    "Create account" (email + password)
STEPS     1. Signed out, make a debut through /onboarding/debut. 2. Secure it with email + password on /signup.
EXPECTED  The email names the person's event, or says "event".
ACTUAL    `app/signup/actions.ts` (anonymous convert-in-place branch) sends `subject: 'Your Setnayan plan is secured'` with `` `Your Setnayan account is set — your wedding plan is now saved to it.` `` for any type. The comment above it assumes "Anon-draft users are always couples (they came through wedding onboarding)", but `commitOnboardingEvent` (`app/onboarding/_shared/commit-event.ts`) mints anonymous sessions for every non-wedding type too.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      brand.md word rules (app copy says "event")
SEVERITY  wrong
SOURCE    CODE
```

#### A2-A9 · Raw database error printed on the host invitation
```
PAGE      /host/accept/[token]
BUTTON    "Accept invitation"
STEPS     1. Open a valid co-host invite signed in with the matching email. 2. Press Accept while the write fails.
EXPECTED  One plain sentence and Try again; the database text goes to the log only (the create-event page fixed this exact defect: "AN UNRECOGNISED CODE NEVER RENDERS ITSELF").
ACTUAL    `app/host/accept/[token]/actions.ts` · `?error=accept_failed&msg=${encodeURIComponent(error.message.slice(0, 80))}` and the page prints it: `body={`Error: ${search.error}${search.msg ? ' — ' + search.msg : ''}. Try again, or ask the inviter to re-send.`}`. The person reads "Error: accept_failed — <Postgres message>". Because `msg` is read straight from the URL, anyone can also craft a link that shows any text under the Setnayan invitation card. There is no Try again control on that card (`TerminalCard` without `cta`).
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (failure = plain reason plus Try again)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-A10 · A failed invite read shows "not found"
```
PAGE      /host/accept/[token]
BUTTON    —
STEPS     1. Open a valid invite link while the `event_moderators` read fails (or the service key is missing).
EXPECTED  "We couldn't read this invitation — try again", distinct from an invalid link.
ACTUAL    `app/host/accept/[token]/page.tsx` · `const { data: inviteRaw } = await admin.from('event_moderators')…maybeSingle();` then `if (!inviteRaw) { notFound(); }` — the `error` is never read, so a failed read is shown as a 404 (the invite looks dead and the invitee is told nothing true). The event and inviter reads beside it are the same shape (`[{ data: eventRow }, { data: inviterRow }]`): a failed read silently falls back to "a debut" / "a host".
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### ONBOARDING SHAPE (owner asked) — the full entry for A2-A1

**What it is TODAY (code at `fb3f72d`)**

- **Every flow is its own page at its own address, not a popup.**
  - `/onboarding/wedding`, `/onboarding/<type>` (debut, birthday, wake …) and `/onboarding/simple` are top-level routes outside every shell. No `app-rail-shell`, no top bar, no bottom nav; `SiteChrome` only draws on marketing NAV routes. Each flow draws its own frame: the generic one draws `<main className="flex min-h-screen flex-col bg-page">` with a brand header, a progress bar and a sticky glass `StepBar`; the wedding draws its `.onbw` shell from `_styles/onboarding.css`; simple is a plain `max-w-xl` form page.
  - The steps inside a flow are client state on ONE address. Step changes do not change the URL. The draft is in `localStorage` (30-day TTL), and `?resume=1` restores it after sign-in.
- **How many screens:**
  - Wedding, with the setup engine on (approved order `WEDDING_FLOW_ORDER` in `lib/onboarding/wedding-cards.ts`): names, event name, kind, date, area, pax, budget, then the `setup_photo` and `setup_look` cards, colours, the services step, congrats. That is about 12 screens, with `account` dropped because anonymous drafts are on.
  - Generic: `genericFlowScreens(...)`, which varies by type, shows "n of N". The "What do you need?" needs-only path is ONE screen with its own create button.
  - Simple: one form, or setup cards paced inside it when the engine admits `simple_event`.
- **How the person gets in:**
  - Signed in: `/dashboard` → "+ New event" is intercepted by `app/(hub)/dashboard/@modal/(.)create-event/page.tsx`. It renders the real create-event page inside `CreateEventPanel` = `SidePanel` (`phone="sheet"`: a bottom sheet on a phone, a wide right panel on desktop; it does use `useModalA11y`).
  - Tapping a type does `router.replace('/onboarding/<type>')`. The panel is gone and a full page loads. It is not a popup on a popup, but the person leaves the board.
  - A cold load or refresh of `/dashboard/create-event` is a full page (`max-w-6xl`).
  - Signed out: `/start` or the front-door tiles go straight to `/onboarding/<type>` (`startHrefFor`).
- **✕ / Back / close:**
  - Screen 1, the top-left ✕ (`onboardingExit`): signed in it goes to `/dashboard/create-event` (the full picker page, not the board they came from); signed out it goes to `/` (not `/start`).
  - Later screens: ‹ steps back one.
  - Phone or browser Back: the wedding catches it and steps back (sentinel history entry `snOnboarding`). On screen 1 it does `history.back()`, which lands on the board because the picker entry was replaced. The generic and simple flows do not catch it, so Back on any step leaves the flow.
  - Simple has a "‹ Back" link to `/dashboard/create-event` AND a "Cancel" link to `/dashboard`.
  - So ✕ and Back can land in two different places.
- **Desktop:**
  - Generic: a centred `max-w-xl` column on a full white page.
  - Wedding: its own two-pane layout (`onb-twopane`).
  - Picker from the board: a right-hand side panel.
  - Nothing is a centred dialog.
- **Zero friction, checked in code:**
  - Wedding and generic run fully signed out. `OnboardingWeddingPage` and `GenericOnboardingPage` have no auth redirect. At the final button `commitOnboardingWedding` / `commitOnboardingEvent` mint a Supabase anonymous session (`signInAnonymously`, behind `NEXT_PUBLIC_ANON_ONBOARDING_ENABLED`, ON in prod per `build-sessions/P0-b-SWITCHES.md`). The event is written under that session and the person lands on the event dashboard with the draft cleared.
  - Between the last step and the account, nothing is lost on the main path. The draft lives in `localStorage` until the commit succeeds, and email + password sign-up on `/signup` converts the SAME user id (`updateUserById`), so `event_members` still points at it. That path ends at `/login?ready=…`, not at `/signup/you`.
  - Three breaks:
    - Get-together is a login wall at the door (A2-A2).
    - A rate-limited or failed anonymous mint leaves "try again" with no sign-in door (A2-A3).
    - Securing the plan with Google, Apple or Facebook, or "I already have an account", leaves the event on the anonymous user, to be swept (A2-A4).
  - Note for the lead, not a finding: with anonymous drafts ON, the account is NOT asked at save. The event is saved anonymously and the account is nudged later (`SecureAccountBanner` / `SaveToContinue`). The owner's 2026-10-25 words quoted in `startHrefFor` ("saving an event must link by logging in") and the CLAUDE.md line "the account is asked for at save" read the other way. Confirm which is meant.

**What it SHOULD be (owner, by the three tests)**

- One create flow, picker included, as ONE `RiseScreen` rising over the page it was started from (the board, Home, an event page, `/start`).
- ✕ (and phone Back on its first screen) falls back to exactly that page with its scroll kept. Inside, ‹ and phone Back step back one screen.
- A large centred dialog on desktop.
- Never a popup on a popup: the picker is screen 1 of the same RiseScreen, not a SidePanel that hands off to a page.
- A hard load or share of `/onboarding/<type>` still draws the full page, the way `RiseRoute` does today.

**What would change (files / components)**

1. Add an intercepting `@rise` slot where creation starts: `app/(hub)/dashboard/@rise/(.)create-event`, plus one for `/onboarding/[type]`, `/onboarding/wedding` and `/onboarding/simple`, with a catch-all `[...rest]` and a `default.tsx`. This copies `app/vendor-dashboard/@rise/*`. Wrap each in `RiseRoute` (`app/_components/rise/rise-route.tsx`). Retire `@modal/(.)create-event` and `CreateEventPanel` (`app/dashboard/(launcher)/_components/create-event-panel.tsx`).
2. `event-type-picker.tsx` `handleSelect`: move to the type's screen INSIDE the same rise (a soft `router.push` that the slot intercepts, or client state) instead of `router.replace` to a bare page.
3. `app/onboarding/_shared/onboarding-exit.ts`: drop the fixed `ONBOARDING_EXIT_HREF`. ✕ calls the rise's `onClose` (back to the opener). Signed out with no opener, it goes to `/start`. Update `first-screen-can-cancel.test.ts` to match.
4. `generic-onboarding.tsx`, `onboarding-shell.tsx` (wedding) and `app/onboarding/simple/page.tsx`: stop drawing their own full-page `<main>` / `min-h-screen` frame and the header ✕/‹ ring when inside the rise (RiseScreen owns the head and ✕). Put the step history on RiseScreen's Back (`useBackCloses`) in ALL three flows. Remove the wedding-only `snOnboarding` sentinel and add the same behaviour to generic and simple. Drop simple's duplicate "‹ Back" / "Cancel" pair.
5. `app/_components/rise/rise-screen.tsx`: a desktop form (a large centred dialog over a dim, `OverlayBackdrop`) instead of `fixed inset-0` at every width. This is shared, so it needs the owner's or a Fable drawing first (no drawing found in this pass).
6. Guard tests to update or extend: `app/onboarding/the-steps-wear-one-template.test.ts`, `first-screen-can-cancel.test.ts`, `app/dashboard/(account)/create-event/the-grid-opens-first.test.ts`, `app/_components/rise/the-rise-screen-is-one-full-screen.test.ts`. Also the Ugat doors in `screens.generated.json` (the ship controller regenerates them).
7. Already held, not touched by this: one commit per flow (`commitOnboardingEvent` / `commitOnboardingWedding` / `commitSimpleEvent`, `the-wedding-exists-only-when-it-does.test.ts`), `no-flow-hangs-forever.test.ts`, `every-onboarding-action-is-the-house-button.test.ts`, `the-walk-couple-c1.test.ts`, and the date-floor and entrance-block tests.

### Account (group C)

#### A2-C1 · Notifications skeleton draws cards, pills, buttons the page lacks
```
PAGE      /dashboard/notifications
BUTTON    —
STEPS     1. Open the bell › "View all" (or /dashboard/notifications) on a slow connection. 2. Watch the loading state, then the page.
EXPECTED  The skeleton draws only what the page draws: a visible "Notifications" title, then ONE card of plain rows (no type pills, no per-row buttons).
ACTUAL    loading.tsx draws 5 separate framed cards each with a pill (`h-5 w-16 rounded-full`) and a right button (`h-7 w-14`), and says "NOTHING AT THE TOP. The page has no back link, no title" — but the page now draws `NotificationsHead level="page"` with a visible `<h1>Notifications</h1>` and one `sn-notice-card` `<ul>` ("no cards, no type pills, no per-row buttons"). Code: `apps/web/app/dashboard/(account)/notifications/loading.tsx` · `Sk className="mt-0.5 h-5 w-16 shrink-0 rounded-full"`; `apps/web/app/_components/notifications/notifications-list.tsx` · `NotificationsHead`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      HOUSE_DESIGN_STANDARD Part F1 (skeleton draws only what the page draws)
SEVERITY  look
SOURCE    CODE
```


#### A2-C3 · API keys offered to every couple: dead end, wrong domain, bad endpoint
```
PAGE      /dashboard/api-keys   (any couple, e.g. Bea & Paolo's host)
BUTTON    "API keys" (Profile › Account row)
STEPS     1. Profile › Account › "API keys". 2. Read the page.
EXPECTED  A couple is not offered a public-API surface (CLAUDE.md §6 "No public API endpoints in V1"; keys are an Ultra-supplier grant). If shown at all, only to accounts with the grant, with real endpoints on setnayan.com.
ACTUAL    The profile row is unconditional (`<Link href="/dashboard/api-keys" className={ACCOUNT_ROW}>` in both the Account pane and `indexExtras`). Without the grant the page says "It is not open to any plan right now, so keys cannot be made yet." yet still shows "No keys yet. Create one above to start calling the API." and a "Try it" block with `curl https://setnayan-platform-web.vercel.app/api/v1/me` (not setnayan.com) and lists `GET /api/v1/suppliers — browse published suppliers (public, no auth)`: there is no `app/api/v1/suppliers` route (the directory is `/api/v1/vendors`, and it 404s unless `PUBLIC_API_ENABLED`). Code: `apps/web/app/dashboard/(account)/api-keys/page.tsx` · `setnayan-platform-web.vercel.app` · `GET /api/v1/suppliers`; `apps/web/app/dashboard/(account)/profile/page.tsx` · `href="/dashboard/api-keys"`; `apps/web/lib/public-api-flag.ts` · `isPublicApiEnabled`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §6 (no public API in V1) · brand.md (setnayan.com only; no coming features) · design-and-wiring B5 (no dead ends)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C4 · Refused API-keys read shows "Your keys (0)"
```
PAGE      /dashboard/api-keys
BUTTON    —
STEPS     1. Supplier with keys opens the page while the `api_keys` read is refused.
EXPECTED  "Couldn't read your keys" — never a zero list (the code's own comment: "they may create a duplicate").
ACTUAL    Error is only logged; `const keys = (data ?? []) as ApiKeyRow[]` → heading `Your keys ({keys.length})` = "(0)" and "No keys yet." — a live key that should be revoked is hidden. Code: `apps/web/app/dashboard/(account)/api-keys/page.tsx` · `logQueryError('ApiKeysPage.data'` · `Your keys ({keys.length})`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C5 · New API secret travels in the page URL (security)
```
PAGE      /dashboard/api-keys
BUTTON    "Create key"
STEPS     1. Account with the grant creates a key. 2. Look at the address bar / history.
EXPECTED  The one-time secret is shown without being put in a URL (history, server/request logs, Referer).
ACTUAL    `redirect(\`/dashboard/api-keys?just_created=${encodeURIComponent(key)}\`)` — the full bearer key lands in the query string and stays in browser history and request logs; the page renders it from `search.just_created`. Also "Revoke" (irreversible) has no confirm. Code: `apps/web/app/dashboard/(account)/api-keys/actions.ts` · `just_created=`; `apps/web/app/dashboard/(account)/api-keys/page.tsx` · `revokeApiKey`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring B6 (trace to end) · CLAUDE.md §3 Floating surface "Confirm only for the irreversible"
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C6 · Raw database error text shown to people
```
PAGE      /dashboard/api-keys, /dashboard/profile, /dashboard/clusters, /dashboard/clusters/[clusterId], /dashboard/samahan/new
BUTTON    "Create key" · "Save" (profile) · "Create group"/"Add"/"Rename"/"Save" (clusters) · "Create group" (samahan)
STEPS     1. Trigger any save failure (RLS, constraint, network).
EXPECTED  A plain reason plus Try again (CLAUDE.md §3 Toast row).
ACTUAL    Postgres/PostgREST `error.message` is echoed into the UI: api-keys `encodeURIComponent(error?.message ?? 'Could not create key')`; profile `updatePersonalInfo` → `?error=${encodeURIComponent(error.message)}`; clusters actions `return { ok: false, error: error.message }` (rendered `role="alert"`); samahan `createCommunity` → `'member_link_failed: ' + memberError.message`. Pages print `?error=` raw when not in their ERROR_COPY map. Code: `apps/web/app/dashboard/(account)/api-keys/actions.ts`, `.../profile/actions.ts` · `updatePersonalInfo`, `.../clusters/actions.ts`, `.../samahan/actions.ts` · `member_link_failed`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §3 (failure = plain reason + Try again)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C7 · Refused profile read shows blank forms that Save will overwrite
```
PAGE      /dashboard/profile
BUTTON    "Save" (Profile / Guest details)
STEPS     1. Open Profile while the `users` read is refused. 2. Fields show empty. 3. Press Save.
EXPECTED  "Couldn't read your profile" and no editable form (or a locked one) — a refusal must not look like an empty profile.
ACTUAL    `profileErr` is only logged (`'graceful_degrade'`); every field renders `defaultValue={profile?.… ?? ''}`, switches fall to defaults, Account ID "—". `updatePersonalInfo` writes the fields the form carries, so Save writes the blanks over the saved name/phone/birthday/meal. A refused `account_deletion_requests` read likewise hides a pending request and re-offers "Delete my account" (duplicate filing). Code: `apps/web/app/dashboard/(account)/profile/page.tsx` · `logQueryError(\n      'ProfilePage (users)'` · `pendingDeletionErr`; `.../profile/actions.ts` · `planPersonalInfoPatch`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C8 · Account pane prints raw enum and internal section codes
```
PAGE      /dashboard/profile   (?tab=account)
BUTTON    —
STEPS     1. Profile › Account (as a supplier-owner account, and as a couple).
EXPECTED  Plain words: "Supplier"/"Host"; no internal jargon.
ACTUAL    `<Row label="Account type" value={profile?.account_type ?? '—'} />` prints the enum as-is ("customer", "vendor", "admin" — `CREATE TYPE public.account_type AS ENUM ('customer', 'vendor', 'admin')`), so a supplier reads "vendor". "Internal account" shows to everyone with values like "Yes (§ 10a — owner)". Code: `apps/web/app/dashboard/(account)/profile/page.tsx` · `label="Account type"` · `§ 10a — owner`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      brand.md word rules (supplier, never vendor)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C9 · Profile advertises "Legacy contact … Coming soon"
```
PAGE      /dashboard/profile   (?tab=privacy)
BUTTON    —
STEPS     1. Profile › Privacy › Your data.
EXPECTED  No coming feature shown in UI.
ACTUAL    A tile "Legacy contact — Choose, while living, who inherits your memories. Coming soon." with an inert "Not set" pill. Code: `apps/web/app/dashboard/(account)/profile/page.tsx` · `data-coming-soon` · `Coming soon.`
SHOTS     none yet (phase B: 375 px light + dark)
RULE      brand.md claims #9 (no coming feature) · design-and-wiring B5
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C10 · White surfaces and a static shadow in feature files
```
PAGE      /dashboard/profile, /dashboard/samahan/[communityId]
BUTTON    —
STEPS     1. Profile › Privacy (Legacy contact pill). 2. A group's chatroom with an event card; Members view (photo badge).
EXPECTED  Token colours only; no `bg-white`; no shadow on a static element (K2 / Part I4).
ACTUAL    profile `bg-white/60 dark:bg-raised` on the "Not set" pill; group chatroom event card `rounded-2xl border border-ink/15 bg-white/70 … dark:bg-raised` (hand-made frame, `no-card-ok`); identity header camera badge `bg-mulberry text-white dark:text-cream shadow`. Code: `apps/web/app/dashboard/(account)/profile/page.tsx` · `bg-white/60`; `.../samahan/[communityId]/_components/group-chatroom.tsx` · `bg-white/70`; `.../samahan/[communityId]/_components/samahan-identity-header.tsx` · `bg-mulberry text-white dark:text-cream shadow`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring D13 · HOUSE_DESIGN_STANDARD Part K2 / Part I4
SEVERITY  look
SOURCE    CODE
```

#### A2-C11 · Setnayan AI settings page has no live door, two Backs
```
PAGE      /dashboard/profile/concierge
BUTTON    "Back to profile" (×2)
STEPS     1. Look for a way in from Profile. 2. Open the URL directly.
EXPECTED  A page is reachable (Ugat no-door) or retired; one back per screen.
ACTUAL    Both profile rows are wrapped in `{CONCIERGE_ENABLED ? (…) : null}` and `CONCIERGE_ENABLED = false` permanently, so no person reaches it (Ugat counts the gated profile link + an admin action as doors). Opened directly, the live branch draws "Back to profile" twice (top, and again beside "See pricing"), and no PageMasthead (raw `<h1>`). Code: `apps/web/app/dashboard/(account)/profile/concierge/page.tsx` · `if (!CONCIERGE_ENABLED)` · `label="Back to profile"`; `apps/web/lib/concierge.ts` · `CONCIERGE_ENABLED = false`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring A3 (registered and reachable) · CLAUDE.md §3 (PageMasthead every page)
SEVERITY  broken
SOURCE    CODE
```

#### A2-C12 · A refused read shows "page not found" (loved one, linked events)
```
PAGE      /dashboard/people/[dependentId], /dashboard/clusters/[clusterId]
BUTTON    —
STEPS     1. Open a loved one's page (or a linked-events group) while its first read is refused.
EXPECTED  "Couldn't read this — try again", never a 404 that says the record is gone.
ACTUAL    Dependent: `if (depError) logQueryError(...)` then `if (!depRow) notFound();` — the comment admits it "404s". Cluster: `fetchCluster` returns `null` on error, page does `if (!cluster) notFound();`. Code: `apps/web/app/dashboard/(account)/people/[dependentId]/page.tsx` · `DependentPage.dependent`; `apps/web/lib/clusters.ts` · `fetchCluster`; `.../clusters/[clusterId]/page.tsx` · `if (!cluster) notFound();`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C13 · Linked events (/dashboard/clusters) has no way in
```
PAGE      /dashboard/clusters, /dashboard/clusters/[clusterId]
BUTTON    —
STEPS     1. From Home, the menu, an event, Profile or the palette, try to reach "Linked events".
EXPECTED  A menu row or a real door (Ugat no-door check).
ACTUAL    No file outside `app/dashboard/(account)/clusters/` links to `/dashboard/clusters` (grep finds none; not in `customer-menu.ts`, `account-rail-context.tsx` or `nav-registry-defaults.ts`). screens.generated.json lists its only door as its own child page; the child's extra "doors" (`lib/art-kits.ts`, `lib/wedding-essentials.ts`, `middleware.ts`, `nav-registry-defaults.ts`) look like `[param]` pattern matches, not real links (PLAUSIBLE — they contain no "clusters"). Code: `apps/web/app/dashboard/(account)/clusters/page.tsx` · `ClustersPage`; `apps/web/lib/ugat/screens.generated.json` · `"route":"/dashboard/clusters"`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      design-and-wiring A3 (registered and reachable)
SEVERITY  broken
SOURCE    CODE
```

#### A2-C14 · Group page turns refused reads into "none" and "rotate"
```
PAGE      /dashboard/samahan/[communityId]   (?tab=events, ?tab=members, chatroom)
BUTTON    "Rotate link" (prompted by the false state)
STEPS     1. Open a group while the events / roster / invite-token read is refused. 2. Open ⋯ › All events, ⋯ › Members.
EXPECTED  Each list says it could not be read.
ACTUAL    `fetchCommunityEvents` and `fetchCommunityRoster` return `[]` on error → Events says "Walang event pa." and ⋯ "All events" trails `formatCount(eventCount)` = "0"; Members draws an empty roster (no "(you)" row, no "Leave group"). `fetchInviteToken` returns `null` on error → organizer reads "No active link — rotate to mint a fresh one.", and rotating kills the link that still works. (The reader test only holds that the token read logs + returns null; the render is not held.) Code: `apps/web/lib/communities.ts` · `fetchCommunityEvents` · `fetchCommunityRoster` · `fetchInviteToken`; `.../samahan/[communityId]/page.tsx` · `No active link — rotate to mint a fresh one.` · `Walang event pa.`
SHOTS     none yet (phase B: 375 px light + dark)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

#### A2-C15 · "Create a group" is a whole page for two fields
```
PAGE      /dashboard/samahan/new
BUTTON    "＋ New" (People › Groups pinned row) / "New group"
STEPS     1. People › Groups › ＋ New.
EXPECTED  SHAPE test 3: not shared by link, one short screen, 2 fields → SMALL POPUP (`Sheet`) over People › Groups.
ACTUAL    A full page (`PageMasthead title="Create a group"`, name + optional description, `button-primary` submit); errors round-trip by `?error=`. Also the name placeholder uses the owner's own first and family name as an example group. Code: `apps/web/app/dashboard/(account)/samahan/new/page.tsx` · `NewSamahanPage` · `placeholder="Barkada`.
SHOTS     none yet (phase B: 375 px light + dark)
RULE      SHAPE (owner 25 Nov)
SEVERITY  look
SOURCE    CODE
```

Checked and clean (no finding): /dashboard/billing honest states (`read.measured`, `receiptsMeasured`, supplier sections `Unread`), pesos via `formatPhp` (re-export of `lib/php.ts`), VAT from `getEffectiveVatRatePct` (falls to 0 by owner design = the setting's value); /dashboard/search forward on empty `q` → `DISCOVER_HREF`; /dashboard/people and /dashboard/samahan forwards land on Home › People as specified; profile `href="#slug"` / `#privacy` anchors switch group via `SettingsShell` `hashchange`; K3 layers in samahan use `OverlayBackdrop` + `useModalA11y` / `PickMenu`.
