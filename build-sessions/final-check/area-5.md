# Final check · Area 5 · Supplier: shop, cards, Toolkit, plans

Checker 5 of 8. Report only. Pinned check commit: `fb3f72d` (main, frozen).
Phase A = code pass (`SOURCE: CODE`). Phase B = browser walk on staging as `supplier_shop` (`SOURCE: SEEN`), later.
Page list: `pnpm exec tsx scripts/staging/areas.ts --area 5` at `fb3f72d` (48 pages, 5 forwards; matches kit § 4).

Marks on every page: **OFFLINE** = NEEDED (where signal is lost) / READ-ONLY / NOT NEEDED.
**SHAPE** = TODAY → SHOULD (PAGE / FULL-SCREEN POPUP / SMALL POPUP).

## BLOCKERS

None found in phase A so far.

## Progress

- [x] /open-shop · OFFLINE: NOT NEEDED (sign-up creates the account and the shop; needs internet) · SHAPE: TODAY a full page (5-step wizard, its own `<main>`; `?claim=` draws the claim door the same way) → SHOULD FULL-SCREEN POPUP with a full entry (differs)
- [x] /open-shop/invite · OFFLINE: NOT NEEDED (a first-run step; the QR stays in Shop › Partnerships) · SHAPE: TODAY a full page (last step of opening a shop) → SHOULD FULL-SCREEN POPUP, the closing step of /open-shop's (differs)
- [x] /open-shop/logo · OFFLINE: NOT NEEDED (an upload) · SHAPE: TODAY a full page (step after the shop opens) → SHOULD FULL-SCREEN POPUP, a step of /open-shop's (differs)
- [ ] /vendor-dashboard
- [ ] /vendor-dashboard/activities
- [ ] /vendor-dashboard/attributes
- [ ] /vendor-dashboard/collections
- [ ] /vendor-dashboard/collections/albums
- [ ] /vendor-dashboard/creators
- [ ] /vendor-dashboard/deep-search
- [ ] /vendor-dashboard/help
- [ ] /vendor-dashboard/invite
- [ ] /vendor-dashboard/lines
- [ ] /vendor-dashboard/moodboard-library
- [ ] /vendor-dashboard/packages
- [ ] /vendor-dashboard/packages/[packageId]
- [ ] /vendor-dashboard/partnerships
- [ ] /vendor-dashboard/profile
- [ ] /vendor-dashboard/recommendations
- [ ] /vendor-dashboard/repertoire
- [ ] /vendor-dashboard/services
- [ ] /vendor-dashboard/services/[serviceId]
- [ ] /vendor-dashboard/services/new
- [ ] /vendor-dashboard/services/new/[category]
- [ ] /vendor-dashboard/services/requests
- [ ] /vendor-dashboard/services/requests/[requestId]
- [ ] /vendor-dashboard/services/requests/new
- [ ] /vendor-dashboard/services/their-work
- [ ] /vendor-dashboard/settings
- [ ] /vendor-dashboard/shop
- [ ] /vendor-dashboard/shop/badges
- [ ] /vendor-dashboard/shop/promote
- [ ] /vendor-dashboard/shop/qrs
- [ ] /vendor-dashboard/shop/qrs/[code]
- [ ] /vendor-dashboard/shop/store
- [ ] /vendor-dashboard/shop/store/[shelf]
- [ ] /vendor-dashboard/shop/store/[shelf]/[item]
- [ ] /vendor-dashboard/subscription
- [ ] /vendor-dashboard/team
- [ ] /vendor-dashboard/team/roles
- [ ] /vendor-dashboard/team/roles/inquiries
- [ ] /vendor-dashboard/theft-watch
- [ ] /vendor-dashboard/track-record
- [ ] /vendor-dashboard/website
- [x] /vendor-invite/[slug] · OFFLINE: NOT NEEDED (a couple's landing from a supplier's QR; adding to a plan needs internet. Couple-at-an-expo offline goes through the in-app expo scanner, not this page) · SHAPE: TODAY PAGE (shared link) → SHOULD PAGE (same)
- [x] /vendor/claim/[token] · OFFLINE: NOT NEEDED (claim + sign-up need internet) · SHAPE: TODAY PAGE (emailed/shared link, door shell) → SHOULD PAGE (same)
- [x] /vendor/claim/[token]/finalize · OFFLINE: NOT NEEDED (writes the claim) · SHAPE: TODAY a hand-off step that redirects; only its error screens draw (door shell) → SHOULD PAGE (same)
- [x] /vendor/fit/[ref] · OFFLINE: NOT NEEDED (a supplier's fit QR; the verdict reads the couple's event and budget live. Note: couple at an expo is a full-offline place — the plan routes that through the in-app expo scanner, so this landing needing internet is consistent) · SHAPE: TODAY PAGE (QR link) → SHOULD PAGE (same)

Forwards:

- [x] /vendor-dashboard/branches → /vendor-dashboard/profile…#where · lands (keeps the query); the `where` fold opens
- [x] /vendor-dashboard/more → /vendor-dashboard/settings · lands
- [x] /vendor-dashboard/performance → /vendor-dashboard/shop#analytics · lands (carousel holds `id="analytics"`)
- [x] /vendor-dashboard/reviews → /vendor-dashboard/website#reviews · lands (`Fold anchor="reviews"`)
- [x] /vendor-dashboard/verify → /vendor-dashboard/profile…#docs · lands; `#docs` should open the ⚙ sheet on Verification (`shop-settings.tsx`): confirm in phase B

## Findings

### Cross-cutting (several pages or groups)

#### A5-X-01 · Dark: every static supplier card carries a drop shadow
PAGE      every /vendor-dashboard/* page in this area (the supplier navy look), e.g. /vendor-dashboard/shop
BUTTON    —
STEPS     1. Sign in as supplier_shop. 2. Turn on dark. 3. Open any page in the area and look at any card (`.sn-frame`, `.sn-tile`, `.sn-row`).
EXPECTED  Dark is flat: cards are one step lighter (`--color-raised`) with no shadow; depth comes from the surface step only.
ACTUAL    The dark supplier block sets `--sn-frame-shadow` to a black drop shadow (`0 14px 30px -14px rgb(0 0 0 / 0.85)`, plus a second one) and `--sn-frame-shadow-tile` to another, so every frame, tile and row in dark is a shadowed card. The same "depth from light" shadow is set for dark in `globals.css`, so the couple side matches it (cross-area).
CODE      apps/web/app/vendor-dashboard/_components/supplier-look.css · `html.dark:has([data-supplier-look])` › `--sn-frame-shadow` / `--sn-frame-shadow-tile`; apps/web/app/globals.css · `depth from light`
SHOTS     to take in phase B: 375 px dark on /vendor-dashboard/shop and /vendor-dashboard/services
RULE      HOUSE_DESIGN_STANDARD Part K2 ("There are no shadows") · DARK_MODE_STANDARD § 5 checklist · Part I rule 4 (shadows only on floating overlays)
SEVERITY  look
SOURCE    CODE

#### A5-X-02 · Dark: no page in the area has a top block that carries the glow (Today excepted, and only partly)
PAGE      every page in this area except /vendor-dashboard (list in the Progress marks: "glow: no")
BUTTON    —
STEPS     1. Dark on. 2. Open each page. 3. Look at the screen's first block.
EXPECTED  The page is flat navy and the screen's ONE top block (header band, cover, picked item's head) wears `--color-band-glow` (blue from the top right, amber bottom left).
ACTUAL    In the supplier area only Today's next-event photo fallback (`hc-ecard-plain` in `today-next-events.tsx`) reads `--color-band-glow`. No other page in the area renders `.sn-band`, `hc-ecard-plain` or `var(--color-band-glow)`, so in dark every other screen is flat everywhere, which the standard names as a failure ("A dark frame that is flat everywhere … fails review"). The masthead (`PageMasthead`) draws no visible block, so a page has no shared top block to carry it.
CODE      apps/web/app/globals.css · `.sn-band` / `--color-band-glow`; apps/web/app/vendor-dashboard/_components/today-next-events.tsx · `hc-ecard-plain`; apps/web/app/_components/page-masthead.tsx · `sr-only`
SHOTS     to take in phase B: 375 px dark of each page's first screen
RULE      HOUSE_DESIGN_STANDARD Part K2 · DARK_MODE_STANDARD § 3 ("Decide the screen's top block … Only that block gets the glow")
SEVERITY  look
SOURCE    CODE

#### A5-X-03 · "Vendor AI" in the order line a supplier reads on their plan page and receipt
PAGE      /vendor-dashboard/subscription (payment history), and the receipt /receipts/order/[orderId] (area 2 page)
BUTTON    the AI Chatbot add-on's buy / free first cycle
STEPS     1. As a supplier, take the AI Chatbot add-on (first free cycle, or a paid 28-day cycle). 2. Open Plan › the payment history row. 3. Open its receipt.
EXPECTED  The supplier's word: "Setnayan AI — AI Chatbot …" or the add-on's catalogue name. Never "vendor".
ACTUAL    The order is written with `description: 'Vendor AI — AI Chatbot (first cycle · free)'` and `'Vendor AI — AI Chatbot (28-day)'`; the plan screen's history row titles itself with `o.description` and the receipt prints `order.description` as the line.
CODE      apps/web/app/vendor-dashboard/subscription/ai-addon-actions.ts · `Vendor AI — AI Chatbot`; apps/web/app/vendor-dashboard/subscription/_components/plan-screen.tsx · `o.description?.trim() || 'Your plan'`; apps/web/app/receipts/order/[orderId]/page.tsx · `what: order.description`
SHOTS     to take in phase B: only if a seeded order of this kind exists (never buy one)
RULE      docs/brand.md word rules (supplier, never vendor)
SEVERITY  wrong
SOURCE    CODE

#### A5-X-04 · The card maker lists three availability styles as "Coming soon"
PAGE      /vendor-dashboard/services/new/[category] and /vendor-dashboard/services/[serviceId] (the card maker, Booking terms › Availability)
BUTTON    "How this card books" dropdown
STEPS     1. Open a card in the maker. 2. Open Booking terms › Availability › "How this card books". 3. Read the options; also the "Recommended for <service>" line when the service's style is one of them.
EXPECTED  A shipped screen never advertises a feature that is not live: an unavailable style is left out of the list (or the whole row is left out until it ships).
ACTUAL    "By the hour · Coming soon", "Set times · Coming soon", "Rooms by the night · Coming soon" are listed as disabled options with the note "… coming soon. It can't be picked yet."; a "Coming soon" tag also stands in place of Use it beside "Recommended for <service>".
CODE      apps/web/app/vendor-dashboard/services/_components/canvas-maker.tsx · `AvailabilityBlock` · `· Coming soon` / `data-coming-soon`; apps/web/lib/availability-styles.ts · `CARD_STYLES_COMING_SOON`
SHOTS     to take in phase B: 375 px light with the dropdown open
RULE      docs/brand.md claims never made, 9 (a coming feature) · checklist item 2 ("coming soon")
SEVERITY  wrong
SOURCE    CODE

#### A5-X-05 · A hand-typed example price in the auto-reply voice preview
PAGE      /vendor-dashboard/customers ⚙ › Auto-reply › voice (an AREA 6 page; the component lives in this area's shop folder) — passed on, not this area's to walk
BUTTON    — (the "what couples get" preview)
STEPS     1. Open the auto-reply voice card. 2. Read the preview answer.
EXPECTED  No price is typed in code: the preview reads the shop's own card prices, or shows the sentence shape without numbers.
ACTUAL    The preview is a fixed sentence with typed amounts: "Full-Day Coverage from ₱48,000; Half-Day Coverage from ₱28,000 … Signature package is ₱85,000", shown to every trade (a caterer sees photo-coverage prices).
CODE      apps/web/app/vendor-dashboard/shop/_components/voice-match-card.tsx · `PREVIEW_ANSWER`
SHOTS     area 6 to take
RULE      CLAUDE.md § 1 ("Never write a price into code") · docs/brand.md claims never made, 1
SEVERITY  wrong
SOURCE    CODE

### Opening a shop and claim doors

#### A5-G1-01 · Opening a shop is a page, not a full-screen popup
PAGE      /open-shop   (signed out, and signed in with no shop; also /open-shop?claim=<token>)
BUTTON    "Open your shop" doors (For Suppliers, sign-up)
STEPS     1. Open /open-shop at 375 px. 2. Walk the 5 steps. 3. Press Back in the browser mid-way.
EXPECTED  A multi-step fill-in rises as a FULL-SCREEN POPUP (`RiseScreen`) with its own full entry address; ✕ returns to where the person came from; on desktop a large centred dialog.
ACTUAL    A plain page: `OpenShopWizard` draws its own `<main data-open-shop-wizard>` (and `ClaimDoor` its own `<main data-claim-door>`), no RiseScreen, no ✕ back to the page it was opened from.
CODE      apps/web/app/open-shop/_components/open-shop-wizard.tsx · `data-open-shop-wizard`; apps/web/app/open-shop/_components/claim-door.tsx · `data-claim-door`
SHOTS     to take in phase B: 375 px light + desktop
RULE      SHAPE (owner 25 Nov)
SEVERITY  look
SOURCE    CODE

#### A5-G1-02 · "Check your shop" fact sheet is hand-rolled and opens up to 88% tall
PAGE      /open-shop   (step 4, "Check your shop")
BUTTON    any fact row (Name · Services · Events · Where · Contact · Number)
STEPS     1. Reach step 4. 2. Tap a fact row. 3. Look at the sheet's top on a 375 px phone with the keyboard up.
EXPECTED  The one floating surface, `Sheet` (half height on a phone, grows from the row), with the shared backdrop.
ACTUAL    The step's own panel is re-classed into a fixed sheet (`sheetClass`: `fixed inset-x-0 … max-h-[calc(88dvh-…)]`, `role: 'dialog', 'aria-modal': true`) over `OverlayBackdrop`. It uses the house backdrop and `useModalA11y`, but it is a second sheet primitive, and a tall one: its top can sit out of thumb reach. Once /open-shop becomes a RiseScreen (A5-G1-01) this must not become a popup on a popup.
CODE      apps/web/app/open-shop/_components/open-shop-wizard.tsx · `const sheetClass` · `'aria-modal': true`
SHOTS     to take in phase B: 375 px light + 375 px dark
RULE      HOUSE_DESIGN_STANDARD D2 (`Sheet` is the one floating surface) · K3 · SHAPE (never a tall half-sheet)
SEVERITY  look
SOURCE    CODE

#### A5-G1-03 · Claim door's peso formatter turns a missing price into "₱0"
PAGE      /open-shop?claim=<token>   (a couple-made claim link)
BUTTON    "Package price" / the price change line
STEPS     1. Open a claim link whose recorded booking has no price, or clear the price box. 2. Reach the bundle / price screens.
EXPECTED  An unknown price reads "Not set" (or is not drawn); money is formatted only by `lib/php.ts`.
ACTUAL    A local `peso()` does `Number(...) || 0`, so an empty or null price prints "₱0" — e.g. "Package price ₱0 as you confirmed" and "Their booking keeps ₱0 until they say yes." (the latter is drawn on `priceChanged` with no check that `record.price` exists). Verify in phase B with the seeded claim link.
CODE      apps/web/app/open-shop/_components/claim-door.tsx · `const peso =` · `Their booking keeps` · `as you confirmed`
SHOTS     to take in phase B: 375 px light
RULE      CLAUDE.md §1 (money only through `lib/php.ts`; never ₱0 for an unknown) · §5 rule 4 (honest states)
SEVERITY  money-signin
SOURCE    CODE

#### A5-G1-04 · First-card preview formats its price by hand
PAGE      /open-shop   (step "Your first service card")
BUTTON    —
STEPS     1. Reach the first-card step. 2. Type a price.
EXPECTED  The price line uses `formatPhp` / `formatPhpRounded` from `lib/php.ts`.
ACTUAL    `` `₱${formatCount(cardPriceNumber)}` `` builds the peso string by hand.
CODE      apps/web/app/open-shop/_components/open-shop-wizard.tsx · `['Price', cardPriceNumber ?`
SHOTS     to take in phase B: 375 px light
RULE      CLAUDE.md §1 (format money only through `apps/web/lib/php.ts`)
SEVERITY  wrong
SOURCE    CODE

#### A5-G1-05 · Two filled accent buttons on "Invite shops you trust"
PAGE      /open-shop/invite
BUTTON    "Share" (inside the QR card) and "Done"
STEPS     1. Open a shop. 2. Land on /open-shop/invite at 375 px.
EXPECTED  One main (filled blue) button per screen; the other neutral.
ACTUAL    `QrCard` draws Share as `actionButtonClass('brand', { main: true })` and the page adds `ActionButton tone="brand" main label="Done"` — two filled accents on one screen.
CODE      apps/web/app/open-shop/invite/page.tsx · `label="Done"`; apps/web/app/_components/qr-card.tsx · `data-qr-share`
SHOTS     to take in phase B: 375 px light + 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### A5-G1-06 · "Only invite those you trust." is said twice
PAGE      /open-shop/invite
BUTTON    —
STEPS     1. Open /open-shop/invite.
EXPECTED  The owner's line once.
ACTUAL    `INVITE_SHOPS_LINE` is the QR card's `line` and again a paragraph under it (`data-onboarding-invite-line`).
CODE      apps/web/app/open-shop/invite/page.tsx · `line={INVITE_SHOPS_LINE}` · `data-onboarding-invite-line`
SHOTS     to take in phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part I 5 (exact words) · checklist 11
SEVERITY  wrong
SOURCE    CODE

#### A5-G1-07 · "Invite shops you trust" is a page, not a step of the open-shop popup
PAGE      /open-shop/invite
BUTTON    —
STEPS     1. Finish opening a shop.
EXPECTED  The closing step of the /open-shop FULL-SCREEN POPUP (not shared or revisited by link — its QR lives in Shop › Partnerships).
ACTUAL    Its own page with its own `<main data-onboarding-invite>`.
CODE      apps/web/app/open-shop/invite/page.tsx · `data-onboarding-invite`
SHOTS     to take in phase B: 375 px light
RULE      SHAPE (owner 25 Nov)
SEVERITY  look
SOURCE    CODE

#### A5-G1-08 · "Add your logo" is a page, not a step of the open-shop popup
PAGE      /open-shop/logo
BUTTON    —
STEPS     1. Open a shop; land on Add your logo.
EXPECTED  A step inside the /open-shop FULL-SCREEN POPUP (photo work → full screen).
ACTUAL    Its own page (`AddYourLogo` draws `<main data-open-shop-logo>`).
CODE      apps/web/app/open-shop/logo/_components/add-your-logo.tsx · `data-open-shop-logo`
SHOTS     to take in phase B: 375 px light
RULE      SHAPE (owner 25 Nov)
SEVERITY  look
SOURCE    CODE

#### A5-G1-09 · A failed read says the supplier link is gone, or that the couple has no event
PAGE      /vendor-invite/[slug]   (slug: the seeded shop's)
BUTTON    "Create your event" / "Add … to my plan"
STEPS     1. Open the shop's invite link while the shop read or the host-events read is refused. 2. Read the screen.
EXPECTED  A refused read says it could not read and offers Try again.
ACTUAL    `const { data: vendor } = await admin.from('vendor_profiles')…` binds no error, so a refused read is `notFound()` ("not available"). `listHostEvents` (lib/vendor-couple-invite.ts) also binds no error on `event_members` / `event_moderators`, so a host with events is told "Create your event first". The same reader feeds /vendor/fit/[ref].
CODE      apps/web/app/vendor-invite/[slug]/page.tsx · `const { data: vendor } = await admin`; apps/web/lib/vendor-couple-invite.ts · `listHostEvents`
SHOTS     to take in phase B: 375 px light (hard to force on staging — code finding)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE

#### A5-G1-10 · Couple's claim link: two accent buttons
PAGE      /vendor/claim/[token]   (a couple-made `auto_share_link` invite)
BUTTON    "Claim & sign up" and "Sign in & claim"
STEPS     1. Open a couple's claim link signed out.
EXPECTED  One filled main; the other neutral or a text link.
ACTUAL    `CoupleLinkDoor` draws "Claim & sign up" `tone="brand" main` and "Sign in & claim" `tone="brand"` (accent-outlined) side by side.
CODE      apps/web/app/vendor/claim/[token]/_components/claim-parts.tsx · `label="Sign in & claim"`
SHOTS     to take in phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD Part K1.2
SEVERITY  look
SOURCE    CODE

#### A5-G1-11 · Claim dead ends say "contact support" with no way to do it
PAGE      /vendor/claim/[token]   (an invite already claimed or revoked)
BUTTON    — (no button at all)
STEPS     1. Open a claimed or revoked claim link.
EXPECTED  A dead end states the fact and offers one action (support / help door, or sign in).
ACTUAL    `TerminalCard` renders `DoorShell tone="dead_end"` with an empty body: "please contact support" and nothing to press.
CODE      apps/web/app/vendor/claim/[token]/page.tsx · `function TerminalCard` · `please contact support`
SHOTS     to take in phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD F3/F4 (one action) · checklist 2
SEVERITY  wrong
SOURCE    CODE

#### A5-G1-12 · Finalize errors show raw database text and send a signed-in person to sign in
PAGE      /vendor/claim/[token]/finalize
BUTTON    "Back to sign in"
STEPS     1. Signed in, open a claim link and continue. 2. Let `claim_ready_the_shop` (or the auto-link) refuse.
EXPECTED  A plain reason + Try again (re-open the claim), never a raw error message.
ACTUAL    `ErrorShell` prints `readyErr?.message` / `linked.message` as the body and its only button goes to /login, though the person is signed in. No Try again.
CODE      apps/web/app/vendor/claim/[token]/finalize/page.tsx · `function ErrorShell` · `body={readyErr?.message`
SHOTS     to take in phase B: 375 px light
RULE      HOUSE_DESIGN_STANDARD F4 · CLAUDE.md §3 (failure gives a plain reason plus Try again)
SEVERITY  wrong
SOURCE    CODE

#### A5-G1-13 · A failed card-count read sends a claimed shop to "make your first card"
PAGE      /vendor/claim/[token]/finalize
BUTTON    —
STEPS     1. Claim a shop that already has cards while the `vendor_services` count read is refused.
EXPECTED  A refused read is not "no cards".
ACTUAL    `const { count } = await admin.from('vendor_services')…` binds no error; `(count ?? 0) === 0` redirects to /vendor-dashboard/services/new/<category>.
CODE      apps/web/app/vendor/claim/[token]/finalize/page.tsx · `(count ?? 0) === 0`
SHOTS     —
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE

#### A5-G1-14 · Fit check calls a supplier available when the calendar could not be read
PAGE      /vendor/fit/[ref]   (signed in as a couple, an event picked)
BUTTON    —
STEPS     1. Open a supplier's fit QR as a host. 2. Pick an event while the availability read fails.
EXPECTED  The date row says it could not check (neither ✓ nor ✗), and the verdict is not "Fits".
ACTUAL    `getVendorAvailableDays(...).catch(() => true)` turns a failed read into "available", so the date row ticks and the badge can say "Fits".
CODE      apps/web/app/vendor/fit/[ref]/page.tsx · `.catch(() => true)`
SHOTS     —
RULE      CLAUDE.md §5 rule 4 (a failed read never renders as success)
SEVERITY  wrong
SOURCE    CODE

#### A5-G1-15 · Fit check's event choice is a pill row with an ink-filled selected pill
PAGE      /vendor/fit/[ref]   (a host with 3+ events)
BUTTON    the event pills
STEPS     1. Open the fit QR as a host with several events, light then dark.
EXPECTED  3+ choices are one `PickMenu` dropdown; colours by token so dark stays readable.
ACTUAL    Each event is a `Link` pill; the picked one is `bg-ink text-cream` — verify in phase B that it reads in dark (ink turns light there).
CODE      apps/web/app/vendor/fit/[ref]/page.tsx · `bg-ink text-cream`
SHOTS     to take in phase B: 375 px light + 375 px dark
RULE      HOUSE_DESIGN_STANDARD D2 (3+ choices = PickMenu) · K2
SEVERITY  look
SOURCE    CODE
