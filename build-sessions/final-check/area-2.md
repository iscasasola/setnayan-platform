# Final check · Area 2 · Couple: create an event and plan it

> Checker 2 of 8. Report only, no fixes. Main frozen at `fb3f72d`. Phase A = code pass (`SOURCE: CODE`);
> phase B = browser walk on staging (`SOURCE: SEEN`), not started (no staging address yet).
> Page list from `pnpm exec tsx scripts/staging/areas.ts --area 2` (67 pages + 6 forwards, same as kit § 4),
> plus `/signup/you`, which the task names for this area although `areas.ts` files it under Area 1.
> Marks on each line: **OFFLINE** (NEEDED + where signal is lost / READ-ONLY IS ENOUGH / NOT NEEDED) and
> **SHAPE** (TODAY → SHOULD; `=` when they agree).

## Progress

### Create an event
- [ ] /onboarding/[type]
- [ ] /onboarding/simple
- [ ] /onboarding/wedding
- [ ] /dashboard/create-event
- [ ] /signup/you
- [ ] /host/accept/[token]

### Home and the event
- [ ] /dashboard
- [ ] /dashboard/[eventId]
- [ ] /dashboard/[eventId]/activity
- [ ] /dashboard/year → /dashboard?seg=events#worth-planning
- [ ] /dashboard/[eventId]/more → /dashboard/[…]
- [ ] /dashboard/[eventId]/progress → /dashboard/[…][…]

### Account
- [ ] /dashboard/notifications
- [ ] /dashboard/search
- [ ] /dashboard/billing
- [ ] /dashboard/api-keys
- [ ] /dashboard/profile
- [ ] /dashboard/profile/concierge
- [ ] /dashboard/people
- [ ] /dashboard/people/[dependentId]
- [ ] /dashboard/clusters
- [ ] /dashboard/clusters/[clusterId]
- [ ] /dashboard/samahan → /dashboard?seg=people&view=samahan[…]
- [ ] /dashboard/samahan/[communityId]
- [ ] /dashboard/samahan/new

### Guests and seats
- [ ] /dashboard/[eventId]/guests
- [ ] /dashboard/[eventId]/guests/[guestId]
- [ ] /dashboard/[eventId]/guests/new
- [ ] /dashboard/[eventId]/guests/quick
- [ ] /dashboard/[eventId]/guests/import
- [ ] /dashboard/[eventId]/guests/claims
- [ ] /dashboard/[eventId]/guests/checkin
- [ ] /dashboard/[eventId]/guests/souvenirs
- [ ] /dashboard/[eventId]/guests/tea-ceremony
- [ ] /dashboard/[eventId]/seating
- [ ] /dashboard/[eventId]/seating/chart
- [ ] /dashboard/[eventId]/seating/lab
- [ ] /dashboard/[eventId]/seating/walkthrough
- [ ] /dashboard/[eventId]/access-requests
- [ ] /dashboard/[eventId]/people
- [ ] /dashboard/[eventId]/hosts

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
