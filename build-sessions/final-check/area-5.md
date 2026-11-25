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
- [x] /vendor-dashboard (Today + layout shell: top bar, rail, bottom bar) · OFFLINE: READ-ONLY IS ENOUGH (the on-the-day work lives on /vendor-dashboard/on-the-day and expo work on the calendar/QR; Today should open as a saved copy with "as of", edits "Needs internet") · SHAPE: TODAY page → SHOULD PAGE (same)
- [x] /vendor-dashboard/activities · OFFLINE: READ-ONLY IS ENOUGH (an emcee may glance at segments on the day; the run sheet on On the day is the working copy) · SHAPE: TODAY page (+ Add sheet) → SHOULD PAGE (same)
- [x] /vendor-dashboard/attributes · OFFLINE: NOT NEEDED · SHAPE: TODAY page (+ Add sheet, `?add=` deep link) → SHOULD PAGE (same)
- [ ] /vendor-dashboard/collections
- [ ] /vendor-dashboard/collections/albums
- [x] /vendor-dashboard/creators · OFFLINE: NOT NEEDED · SHAPE: TODAY page (+ Send offer sheet) → SHOULD PAGE (same)
- [ ] /vendor-dashboard/deep-search
- [x] /vendor-dashboard/help · OFFLINE: NOT NEEDED (five doors to online pages) · SHAPE: TODAY page of 5 link rows → SHOULD SMALL POPUP (Sheet from Settings › Help) (differs)
- [ ] /vendor-dashboard/invite
- [x] /vendor-dashboard/lines · OFFLINE: READ-ONLY IS ENOUGH (lines are read during a wedding; writing happens on the client's script tab) · SHAPE: TODAY page → SHOULD PAGE (same)
- [ ] /vendor-dashboard/moodboard-library
- [ ] /vendor-dashboard/packages
- [ ] /vendor-dashboard/packages/[packageId]
- [ ] /vendor-dashboard/partnerships
- [ ] /vendor-dashboard/profile
- [ ] /vendor-dashboard/recommendations
- [ ] /vendor-dashboard/repertoire
- [x] /vendor-dashboard/services · OFFLINE: READ-ONLY IS ENOUGH (a forward to Shop; the cards as a saved copy, R11) · SHAPE: TODAY forward → /vendor-dashboard/shop (keeps every param) → SHOULD PAGE (same) · glow: n/a (forward)
- [x] /vendor-dashboard/services/[serviceId] · OFFLINE: READ-ONLY IS ENOUGH (show a card at an expo; editing needs internet) · SHAPE: TODAY own page (the card maker, Back "Shop") → SHOULD FULL-SCREEN POPUP (differs) · glow: no
- [x] /vendor-dashboard/services/new · OFFLINE: NOT NEEDED (making a card needs internet) · SHAPE: TODAY own page (picker, then the maker) → SHOULD FULL-SCREEN POPUP (differs) · glow: no
- [x] /vendor-dashboard/services/new/[category] · OFFLINE: NOT NEEDED (making a card needs internet) · SHAPE: TODAY own page (the maker for one kind; "Start another from this") → SHOULD FULL-SCREEN POPUP (differs) · glow: no
- [x] /vendor-dashboard/services/requests · OFFLINE: NOT NEEDED (a list of category requests, never needed without signal) · SHAPE: TODAY page → SHOULD PAGE (same; actions and notices land here by link) · glow: no
- [x] /vendor-dashboard/services/requests/[requestId] · OFFLINE: NOT NEEDED · SHAPE: TODAY page → SHOULD PAGE (same; "requested=1" / decision notices link here) · glow: no
- [x] /vendor-dashboard/services/requests/new · OFFLINE: NOT NEEDED (sending a request needs internet) · SHAPE: TODAY page, 3 steps as 3 addresses → SHOULD FULL-SCREEN POPUP (differs) · glow: no
- [x] /vendor-dashboard/services/their-work · OFFLINE: READ-ONLY IS ENOUGH (portfolio shown to a client at an expo) · SHAPE: TODAY page → SHOULD PAGE (same; a card's Portfolio row links to its album anchor) · glow: no
- [x] /vendor-dashboard/settings · OFFLINE: NOT NEEDED (rows open other pages; nothing to do here offline) · SHAPE: TODAY page → SHOULD PAGE (forward target of /more, `#more-tools` deep link) (same)
- [x] /vendor-dashboard/shop · OFFLINE: READ-ONLY IS ENOUGH (showing the shop to a client at an expo is a look, not an edit; R11 "shop offline" is read-only) · SHAPE: TODAY PAGE (the Shop tab) → SHOULD PAGE (same; its Logo / Cover / Storage doors differ, see A5-G4-04)
- [x] /vendor-dashboard/shop/badges · OFFLINE: NOT NEEDED (progress ladder, nothing done on the road) · SHAPE: TODAY PAGE (ToolPage) → SHOULD PAGE (same; "See all" link target, bookmarked)
- [x] /vendor-dashboard/shop/promote · OFFLINE: READ-ONLY IS ENOUGH (prints and gifts need internet to buy; the list can be read) · SHAPE: TODAY PAGE (Shop › Promote) → SHOULD PAGE (same)
- [x] /vendor-dashboard/shop/qrs · OFFLINE: NEEDED — at an expo (the supplier shows Check a date / Shortlist / Your page codes for a client to scan where the hall has no signal; R8 offline client QR) · SHAPE: TODAY PAGE (ToolPage) → SHOULD PAGE (same)
- [x] /vendor-dashboard/shop/qrs/[code] · OFFLINE: NEEDED — at an expo (the one code held up for scanning; a saved copy of the code image is enough, no edits) · SHAPE: TODAY PAGE → SHOULD PAGE (same; linked from Today's "Open QR" and bookmarks)
- [x] /vendor-dashboard/shop/store · OFFLINE: NOT NEEDED (Toolkit browsing and buying need internet) · SHAPE: TODAY PAGE → SHOULD PAGE (same)
- [x] /vendor-dashboard/shop/store/[shelf] · OFFLINE: NOT NEEDED · SHAPE: TODAY PAGE → SHOULD PAGE (same)
- [x] /vendor-dashboard/shop/store/[shelf]/[item] · OFFLINE: NOT NEEDED (Buy / Install need internet) · SHAPE: TODAY PAGE → SHOULD PAGE (same; each widget has its own address, shared and bookmarked)
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

### Today, settings and small tools

#### A5-G2-01 · The rail's Plan row says "Free" when the plan read fails
PAGE      every /vendor-dashboard/* page (the layout's rail, desktop + tablet)   (shop: Liwanag Photo & Film, Pro)
BUTTON    "Plan" row (its count text shows the plan name)
STEPS     1. Sign in as `supplier_shop`. 2. The layout's tier read on `vendor_profiles` is refused (any error). 3. Look at the rail's Plan row.
EXPECTED  A refused read says it could not be read ("—" or "Couldn't read"), never a plan name.
ACTUAL    `tierProbePromise` keeps only `tierRes.data` (no `error` branch) → `tier: null` → `TIER_LABEL[asVendorTier(tier)]` = "Free" on a Pro shop.
CODE      apps/web/app/vendor-dashboard/layout.tsx · `tierProbePromise` · apps/web/app/vendor-dashboard/_components/vendor-rail-context.tsx · `TIER_LABEL[asVendorTier(tier)]`
SHOTS     to take in phase B: desktop light + dark (rail)
RULE      CLAUDE.md §5 rule 4 (honest states) · kit § 5 item 9 ("Free" on a failed read)
SEVERITY  money-signin
SOURCE    CODE

#### A5-G2-02 · The rail's plan word is a second tier reader (no promotion applied)
PAGE      every /vendor-dashboard/* page (rail Plan row) vs /vendor-dashboard/subscription and every gate
BUTTON    "Plan" row
STEPS     1. A shop whose tier is raised by a live promotion (`applyVendorTierPromotion`). 2. Compare the rail's plan word with the plan page and the gates.
EXPECTED  One reader for a shop's plan (`resolveVendorTier` / `lib/vendor-tier-caps.ts`), so every page agrees.
ACTUAL    The layout reads raw `tier_state` itself; the gates use `resolveVendorTier`, which applies `getPromotedVendorTierFor`. A promoted shop can read "Free" in the rail and "Pro" on its gates. Verify in phase B.
CODE      apps/web/app/vendor-dashboard/layout.tsx · `tierProbePromise` · apps/web/lib/vendor-feature-gate.ts · `applyVendorTierPromotion`
SHOTS     to take in phase B: desktop light
RULE      design-and-wiring C8 (one reader per shared fact)
SEVERITY  wrong
SOURCE    CODE

#### A5-G2-03 · Creators: a refused plan read locks Send for a paying shop
PAGE      /vendor-dashboard/creators   (shop: Liwanag Photo & Film, Pro)
BUTTON    "Send offer" (in the sheet)
STEPS     1. Open Creators. 2. The tier read is refused. 3. Tap Send offer on any creator.
EXPECTED  A refused plan read is said; a Pro shop is never told to buy a plan.
ACTUAL    `resolveVendorTier` destructures only `{ data }` (no error check) → `asVendorTier(undefined)` = free → `sendNeedsPro` true → the sheet says "Sending an offer is part of every paid plan… Send asks for the plan" to a Pro shop.
CODE      apps/web/lib/vendor-feature-gate.ts · `resolveVendorTier` · apps/web/app/vendor-dashboard/creators/page.tsx · `sendNeedsPro`
SHOTS     to take in phase B: 375 px light + 375 px dark (sheet open)
RULE      CLAUDE.md §5 rule 4 (honest states) · kit § 5 item 9
SEVERITY  money-signin
SOURCE    CODE

#### A5-G2-04 · Creators: the Send lock has no 🔒 door, and its two sentences disagree on the plan
PAGE      /vendor-dashboard/creators   (a Free shop; phase B can only read the words on the Pro shop)
BUTTON    "Send offer"
STEPS     1. As a Free shop, open Creators › Send offer. 2. Fill it in. 3. Press Send offer.
EXPECTED  🔒 shown, then Problem → Solution → preview → price from the catalogue → one button to a real checkout. One plan named, the same everywhere.
ACTUAL    The sheet says "part of every paid plan"; pressing Send bounces back with "Creator collabs are a Pro-and-up feature. Upgrade your plan…" (`humanizeOfferError`). No price, no checkout door — the press only returns an error line.
CODE      apps/web/app/vendor-dashboard/creators/_components/creators-tools.tsx · `sendNeedsPro` · apps/web/app/vendor-dashboard/creators/actions.ts · `humanizeOfferError`
SHOTS     to take in phase B: 375 px light (sheet + the error line)
RULE      design-and-wiring B7 (🔒 locks are honest) · HOUSE_DESIGN_STANDARD D3 ("Every lock shows 🔒")
SEVERITY  broken
SOURCE    CODE

#### A5-G2-05 · Creators: a refused list read reads as "No creators match yet" and "no offers sent"
PAGE      /vendor-dashboard/creators
BUTTON    —
STEPS     1. Open Creators while the creator chapters or the offers read is refused.
EXPECTED  "Couldn't load creators · Try again", distinct from empty.
ACTUAL    `fetchEligibleCreators` and `fetchVendorSentOffers` keep only `{ data }` (`data ?? []`) → the empty state "No creators match yet" and an empty Sent list.
CODE      apps/web/lib/creator-offers.ts · `fetchEligibleCreators` · `fetchVendorSentOffers`
SHOTS     to take in phase B: 375 px light
RULE      CLAUDE.md §5 rule 4 (honest states) · kit § 5 item 9
SEVERITY  wrong
SOURCE    CODE

#### A5-G2-06 · Today: the failure screen has no Try again
PAGE      /vendor-dashboard
BUTTON    —
STEPS     1. Open Today while `fetchVendorOverviewData` or `readTodaySchedules` throws.
EXPECTED  The shared `ErrorState`: what broke → what survived → one Try again.
ACTUAL    A hand-made header "This page is temporarily unavailable. Refreshing usually clears this. Your data is safe." with no button (and the setup maker's "The service maker couldn't load. Refresh to try again." likewise).
CODE      apps/web/app/vendor-dashboard/page.tsx · `This page is temporarily unavailable` · `The service maker couldn’t load`
SHOTS     to take in phase B: only if a failure can be forced
RULE      HOUSE_DESIGN_STANDARD F4 · CLAUDE.md §3 (Empty / error: `error-state.tsx`)
SEVERITY  look
SOURCE    CODE

#### A5-G2-07 · Today: the next-event card has a shadow and a white pill in dark
PAGE      /vendor-dashboard   (Coming up carousel, next event)
BUTTON    the event card
STEPS     1. Open Today in dark with a booked event coming up.
EXPECTED  K2: static cards flat in dark (no shadows), no white surfaces.
ACTUAL    `EventCard` hand-types `shadow-[0_1px_2px…,0_8px_24px…]` on a static card in both modes, and the "when" pill is `bg-white` (white in dark); the position pill is `bg-black/45`.
CODE      apps/web/app/vendor-dashboard/_components/today-next-events.tsx · `EventCard` · `data-today-next-when`
SHOTS     to take in phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2 · design-and-wiring D13 (no `bg-white`)
SEVERITY  look
SOURCE    CODE

#### A5-G2-08 · Today welcome: the first card's price is formatted by hand, and "Edit in the Card Maker"
PAGE      /vendor-dashboard?opened=1 (the welcome after opening a shop)
BUTTON    "Edit in the Card Maker" · "Approve card"
STEPS     1. Finish /open-shop with a first card. 2. Land on Today's welcome.
EXPECTED  Pesos only through `lib/php.ts` (`formatPhp`); no "Edit in X" link (put the field there or say "Edit card").
ACTUAL    `from ₱{formatCount(card.price)}` builds the peso string by hand; the link reads "Edit in the Card Maker". The Approve button is the legacy `.button-primary`.
CODE      apps/web/app/vendor-dashboard/_components/today-welcome.tsx · `from ₱{formatCount(card.price)}` · `Edit in the Card Maker`
SHOTS     to take in phase B: 375 px light + dark (only if a fresh shop can be walked; never on the seeded one)
RULE      CLAUDE.md §1 (money only through `lib/php.ts`) · HOUSE_DESIGN_STANDARD D3 ("Never 'Edit in X ↗'")
SEVERITY  wrong
SOURCE    CODE

#### A5-G2-09 · Help: "we answer within a business day" is a speed promise
PAGE      /vendor-dashboard/help
BUTTON    "Talk to Setnayan"
STEPS     1. Settings › Help. 2. Read the last row.
EXPECTED  No speed claims or service promises in UI copy.
ACTUAL    Row line: "Send us a message — we answer within a business day".
CODE      apps/web/app/vendor-dashboard/settings/settings-rows.ts · `we answer within a business day`
SHOTS     to take in phase B: 375 px light
RULE      docs/brand.md claims 6 (speed) and 10 (promises)
SEVERITY  wrong
SOURCE    CODE

#### A5-G2-10 · Attributes: "attribute payload" and an unproven ranking claim
PAGE      /vendor-dashboard/attributes
BUTTON    swipe left › Delete (the toast after it) · the ⓘ beside the title
STEPS     1. Remove a service's attributes by swipe. 2. Read the toast. 3. Open the ⓘ.
EXPECTED  Plain words; no claim the app cannot back.
ACTUAL    Toast: "Removed that service's attribute payload." (database word). ⓘ: "Completing more fields raises your marketplace ranking and unlocks listing visibility." — verify the ranking claim is true before it stays.
CODE      apps/web/app/vendor-dashboard/attributes/_components/attributes-view.tsx · `attribute payload` · `INTRO`
SHOTS     to take in phase B: 375 px light
RULE      docs/brand.md (tone, claims) · HOUSE_DESIGN_STANDARD Part I 5 (exact words)
SEVERITY  wrong
SOURCE    CODE

#### A5-G2-11 · Your segments: a second accent button on the screen ("Add question")
PAGE      /vendor-dashboard/activities
BUTTON    "Add question" · "Save" (inside an opened segment or question) · the thumb row ＋ "Add a segment"
STEPS     1. Open Your segments. 2. Look at the screen with one segment open.
EXPECTED  K1: one main (blue) button per screen; every other button neutral or a text link.
ACTUAL    The thumb row's ＋ is the main action, while "Write your own" always shows `ActionButton tone="brand"` "Add question" (accent-outlined), and each opened row's "Save" is `tone="brand"` too. The "Write your own" form is also always open on the page while segments add from a sheet.
CODE      apps/web/app/vendor-dashboard/activities/questions-section.tsx · `label="Add question"` · `label="Save"` · apps/web/app/vendor-dashboard/activities/_components/activities-view.tsx · `label="Save"`
SHOTS     to take in phase B: 375 px light + dark
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### A5-G2-12 · Segments and Lines send a shop-less person through /verify
PAGE      /vendor-dashboard/activities · /vendor-dashboard/lines
BUTTON    —
STEPS     1. A signed-in person with no shop opens either address.
EXPECTED  The same landing every other tool uses for "no shop" (`/vendor-dashboard`, which tells a team member from a new supplier).
ACTUAL    `redirect('/vendor-dashboard/verify')` → forwards to `/vendor-dashboard/profile#docs` → profile finds no shop and redirects to `/vendor-dashboard`: two extra hops through a page about verification.
CODE      apps/web/app/vendor-dashboard/activities/page.tsx · `redirect('/vendor-dashboard/verify')` · apps/web/app/vendor-dashboard/lines/page.tsx · same
SHOTS     not needed
RULE      design-and-wiring A4 (every way in lands where it says)
SEVERITY  wrong
SOURCE    CODE

#### A5-G2-13 · Shell: "+ Create service card" is a filled accent beside each page's own main button
PAGE      every /vendor-dashboard/* page on desktop (the rail's create slot)
BUTTON    "+ Create service card"
STEPS     1. Open any supplier page at desktop width that has its own main button (e.g. Your segments' ＋, Shop).
EXPECTED  K1: one main button per screen.
ACTUAL    The layout passes `createSlot` = `fd-btn-gold` "+ Create service card" (the shell's filled action) on every page; with the page's own main verb that is two filled accents on one screen. Verify in phase B how `fd-btn-gold` draws in the supplier blue.
CODE      apps/web/app/vendor-dashboard/layout.tsx · `createSlot` · `fd-btn-gold`
SHOTS     to take in phase B: desktop light + dark
RULE      HOUSE_DESIGN_STANDARD Part K1
SEVERITY  look
SOURCE    CODE

#### A5-G2-14 · SHAPE: Help is a page of five links
PAGE      /vendor-dashboard/help
BUTTON    Settings › "Help"
STEPS     1. Settings › Help.
EXPECTED  SMALL POPUP (`Sheet`, half height on a phone): one short screen of five doors, not shared by link.
ACTUAL    TODAY: its own page with a Back button.
CODE      apps/web/app/vendor-dashboard/help/page.tsx · `SUPPLIER_HELP_ROWS`
SHOTS     to take in phase B: 375 px light
RULE      SHAPE (owner 25 Nov)
SEVERITY  look
SOURCE    CODE

### Service cards

#### A5-G3-01 · A refused card read shows "page doesn't exist" for the shop's own card
PAGE      /vendor-dashboard/services/[serviceId]   (shop: Liwanag Photo & Film)
BUTTON    any service row on Shop (opens the card)
STEPS     1. Shop › tap a card. 2. The `vendor_services` read is refused (any error).
EXPECTED  "Couldn't load this card · Try again" — the card is still there.
ACTUAL    `loadCardForEdit` returns null on `error || !row`, and the page calls `notFound()` — a failed read is drawn as "this page doesn't exist", the same as a card that was deleted.
CODE      apps/web/lib/service-card-maker.server.ts · `if (error || !row) return null` ; apps/web/app/vendor-dashboard/services/[serviceId]/page.tsx · `if (!card) notFound()`
SHOTS     to take in phase B: 375 px light + 375 px dark (only reproducible with a refused read; confirm by code)
RULE      CLAUDE.md §5 rule 4 (honest states) · HOUSE_DESIGN_STANDARD F4
SEVERITY  broken
SOURCE    CODE

#### A5-G3-02 · A refused plan read locks a venue's "Add the first space" for a Pro payer
PAGE      /vendor-dashboard/services/[serviceId]   (a venue card; seeded venue shop is Area 7's — reproduce on any venue card)
BUTTON    "Add the first" (AddFirstSpace, no hall yet)
STEPS     1. Open a venue card with no hall. 2. The `vendor_profiles.tier_state` read in the page's Promise.all fails.
EXPECTED  The plan read failing is said ("Couldn't check your plan · Try again"); a payer is never shown an upgrade lock.
ACTUAL    `tierRes.error` is never looked at; `tier_state ?? null` → below Pro → the Pro lock and its upgrade door show to a shop that pays for Pro.
CODE      apps/web/app/vendor-dashboard/services/[serviceId]/page.tsx · `proOpen={!vendorPaywallApplies(isTierAtLeast(` (comment: "A refused tier read reads as below Pro")
SHOTS     to take in phase B: 375 px light + dark (code-only unless the read is refused)
RULE      CLAUDE.md §5 rule 4 · reads-are-honest.test.ts ("isn't part of your current plan. Upgrade → to a payer")
SEVERITY  money-signin
SOURCE    CODE

#### A5-G3-03 · The maker's sheets are a hand-rolled overlay; on a computer nothing behind is dimmed or blurred
PAGE      /vendor-dashboard/services/new · /services/new/[category] · /services/[serviceId]
BUTTON    "Services", "Who it's for", the coverage ask, "Delete" (every `CanvasSheet`)
STEPS     1. Open the maker on desktop (≥ 1024 px). 2. Tap the Services row (or Who it's for, or Delete).
EXPECTED  The shared `Sheet` (or `RiseScreen`) with the one `OverlayBackdrop`: dim + blur, page behind inert, backdrop tap closes.
ACTUAL    `CanvasSheet` is its own `createPortal` (`fixed inset-0 z-sn-toast`, `role="dialog" aria-modal`). `OverlayBackdrop` is `lg:hidden`; on desktop a clear `<button aria-label="Close">` catches the tap and the page stays bright and sharp behind it. Its panel also carries its own `shadow-[0_-12px_40px…]` and inline `--m-paper` fill instead of the Sheet's surface.
CODE      apps/web/app/vendor-dashboard/services/_components/canvas-maker.tsx · `function CanvasSheet` · `<OverlayBackdrop onClose={onClose} className="lg:hidden" />`
SHOTS     to take in phase B: desktop light + dark with a sheet open; 375 px light + dark
RULE      HOUSE_DESIGN_STANDARD Part K3 (1)–(2) · CLAUDE.md §3 (Floating surface: no new hand-rolled aria-modal)
SEVERITY  look
SOURCE    CODE

#### A5-G3-04 · Maker sheets open as tall bottom sheets, and on Today they open on top of a sheet
PAGE      /vendor-dashboard/services/new (and the maker opened from Today › What you offer › Start)
BUTTON    "Services" / "Who it's for" in the maker
STEPS     1. On a phone, Today › What you offer › Start (the maker in the shared Sheet). 2. Tap the Services row.
EXPECTED  One layer at a time; a short choice opens at half height; the long ones live in a full-screen maker.
ACTUAL    The maker already sits in a `Sheet` on Today (comment in `CanvasSheet`: "Today's 'What you offer → ＋ Start' opens it in the shared Sheet … every sheet the maker opens … opened BEHIND that sheet"; fixed by raising the z-index), so each choice is a popup on a popup. Each `CanvasSheet` is `max-h-[86dvh]` from the bottom, so its top (title, ✕) sits out of thumb reach on a phone.
CODE      apps/web/app/vendor-dashboard/services/_components/canvas-maker.tsx · `sn-canvas-sheet absolute inset-x-0 bottom-0 mx-auto max-h-[86dvh]` · comment "ABOVE THE FRAME THAT HOSTS THE MAKER"
SHOTS     to take in phase B: 375 px light + dark, from Today and from /services/new
RULE      SHAPE (owner 25 Nov): never a popup on a popup, never a tall half-sheet · HOUSE_DESIGN_STANDARD K3 (4)
SEVERITY  look
SOURCE    CODE

#### A5-G3-05 · Making or editing a card is a page, not a full-screen popup
PAGE      /vendor-dashboard/services/new · /services/new/[category] · /services/[serviceId]
BUTTON    Shop › "＋ Add" / a card row / "Start another from this"
STEPS     1. Shop › Add a service (or tap a card). 2. Look at what opens; press ✕/Back.
EXPECTED  A multi-step fill-in rises as a `RiseScreen` over Shop; ✕ returns to the same scroll place; large centred dialog on desktop.
ACTUAL    Each is its own page with a "‹ Shop" link (`/services/new/[category]` links "‹ Services", which bounces through the `/services` redirect to Shop's top). No `@rise` slot exists for services (`@rise` holds only team, settings, subscription, website, profile).
CODE      apps/web/app/vendor-dashboard/services/new/page.tsx · apps/web/app/vendor-dashboard/services/[serviceId]/page.tsx · apps/web/app/vendor-dashboard/services/new/[category]/page.tsx · `href="/vendor-dashboard/services"`
SHOTS     to take in phase B: 375 px light + dark, desktop
RULE      SHAPE (owner 25 Nov): "adding a service card is a multi-step fill-in → FULL-SCREEN POPUP"
SEVERITY  look
SOURCE    CODE

#### A5-G3-06 · "Tell us what you do" is three addresses, not one full-screen popup
PAGE      /vendor-dashboard/services/requests/new
BUTTON    "Can't find yours? Tell us what you do" (from the maker's picker)
STEPS     1. Maker › search › Tell us what you do. 2. Step 1 group → step 2 category → step 3 name.
EXPECTED  A 3-step fill-in rises as one `RiseScreen` over the maker; ✕ returns to the maker as it was.
ACTUAL    Each step is the same page with `?group=` / `?tile=`; the maker is left behind (its "‹" goes to `SERVICE_MAKER_HREF`, a fresh maker — anything typed there is gone unless the device copy offers it).
CODE      apps/web/app/vendor-dashboard/services/requests/_components/tell-us-view.tsx · `SERVICE_REQUEST_NEW_HREF}?group=` · `backToCard`
SHOTS     to take in phase B: 375 px light + dark
RULE      SHAPE (owner 25 Nov)
SEVERITY  look
SOURCE    CODE

#### A5-G3-07 · "That request is gone." is sent to the list, which never shows it
PAGE      /vendor-dashboard/services/requests
BUTTON    "Put it here" (on a request that was removed meanwhile)
STEPS     1. Open a waiting request. 2. Admin removes it. 3. Pick a card › Put it here.
EXPECTED  The list says "That request is gone."
ACTUAL    `putCardUnderRequest` redirects to `/vendor-dashboard/services/requests?error=…`, but `YourRequestsPage` reads no searchParams and `YourRequestsView` draws no error line — the press looks like it did nothing.
CODE      apps/web/app/vendor-dashboard/services/requests/actions.ts · `That request is gone.` ; apps/web/app/vendor-dashboard/services/requests/page.tsx · `export default async function YourRequestsPage()`
SHOTS     to take in phase B: 375 px light (hard to stage; confirm by code)
RULE      HOUSE_DESIGN_STANDARD D3 ("failure = plain reason + Try again") · checklist 2 (a press that does nothing)
SEVERITY  broken
SOURCE    CODE

#### A5-G3-08 · Request detail: a main button plus accent-outlined buttons in one screen
PAGE      /vendor-dashboard/services/requests/[requestId]
BUTTON    "Make a card now" + "Put it here" (waiting) · "Pick the service that fits" + "Request a different name" (not added)
STEPS     1. Open a waiting request while the shop has a card not yet placed. 2. Open a request marked Not added.
EXPECTED  One filled blue main button; every other button neutral or a text link.
ACTUAL    Waiting: "Put it here" is `actionButtonClass('brand')` (blue outline on a blue wash) beside the main "Make a card now". Not added: "Request a different name" is `tone="brand"` outlined beside the main "Pick the service that fits".
CODE      apps/web/app/vendor-dashboard/services/requests/_components/request-detail-view.tsx · `className={actionButtonClass('brand')}` · `label="Request a different name"`
SHOTS     to take in phase B: 375 px light + dark
RULE      HOUSE_DESIGN_STANDARD Part K1 (2)
SEVERITY  look
SOURCE    CODE

#### A5-G3-09 · Card maker: accent-outlined "Pick up" / "Use it" beside the main Create
PAGE      /vendor-dashboard/services/new · /services/new/[category] · /services/[serviceId]
BUTTON    "Pick up" (Picked up where you left off?) · "Use it" (each availability template + Recommended)
STEPS     1. Start a card, leave, come back (the device copy is offered). 2. Open How clients book with a template installed and a recommended style.
EXPECTED  The thumb row's "Create" / "Save card" is the one blue main; the rest neutral.
ACTUAL    "Pick up" is `tone="brand"` (outlined accent) and every "Use it" is `tone={on ? 'neutral' : 'brand'}` — up to several accent-outlined buttons on the screen that holds the main Create. Choosing one style is a pick, not a second forward step.
CODE      apps/web/app/vendor-dashboard/services/_components/canvas-maker.tsx · `label="Pick up"` · `function AvailabilityBlock` · `tone={on ? 'neutral' : 'brand'}` · `tone={using ? 'neutral' : 'brand'}`
SHOTS     to take in phase B: 375 px light + dark
RULE      HOUSE_DESIGN_STANDARD Part K1 (2)–(3)
SEVERITY  look
SOURCE    CODE

#### A5-G3-10 · "Who it's for" sheet saves with the legacy `.button-primary`
PAGE      /vendor-dashboard/services/new · /services/[serviceId]
BUTTON    "Save who it's for"
STEPS     1. Maker › Who it's for. 2. Look at the save button in light and dark.
EXPECTED  `ActionButton tone="brand" main` (the supplier blue, 40 px paint in a 44 px press).
ACTUAL    `SubmitButton className="button-primary min-h-[44px]"` — the legacy primary, which CLAUDE.md §3 says not to add to; verify in phase B that it reads blue (not terracotta) inside the supplier look, light and dark.
CODE      apps/web/app/vendor-dashboard/services/_components/canvas-maker.tsx · `button-primary min-h-[44px] disabled:opacity-50`
SHOTS     to take in phase B: 375 px light + dark
RULE      CLAUDE.md §3 (Button) · HOUSE_DESIGN_STANDARD K1 (supplier blue inside supplier surfaces)
SEVERITY  look
SOURCE    CODE

#### A5-G3-11 · Claim banner says "their wedding" for any event, with a terracotta heart
PAGE      /vendor-dashboard/services/new/[category]?claim=…
BUTTON    —
STEPS     1. A host adds the supplier to a debut or birthday and the supplier claims it. 2. The card maker opens with the claim banner.
EXPECTED  "…Saving links it straight to their event." in the supplier's blue look.
ACTUAL    The words are fixed: "they added you to their <kind> plan. Saving links it straight to their wedding." The heart is `text-terracotta` (the couple accent) on `--m-paper-2` inside a supplier surface.
CODE      apps/web/app/vendor-dashboard/services/new/[category]/page.tsx · `Saving links it straight to their wedding` · `text-terracotta`
SHOTS     to take in phase B: 375 px light + dark (needs a claim link; Area 6 seed may have one)
RULE      docs/brand.md word rules (event) · DARK_MODE_STANDARD §1 (supplier family)
SEVERITY  wrong
SOURCE    CODE

#### A5-G3-12 · "Their work" says "this card" on a shop-wide page and hand-types its title
PAGE      /vendor-dashboard/services/their-work
BUTTON    —
STEPS     1. A card › Portfolio › an album row (opens Their work).
EXPECTED  A line that matches the page (every booked event's photos across the shop) and the house `PageMasthead`.
ACTUAL    Visible `<h1>` "Their work" + "Photos from the events this card was booked for" — but the page lists every album of the shop (`readShopWork`), each with its own "Booked on" card rows. The title is a hand-typed `text-[22px]` h1 instead of `PageMasthead`.
CODE      apps/web/app/vendor-dashboard/services/their-work/page.tsx · `Photos from the events this card was booked for`
SHOTS     to take in phase B: 375 px light + dark
RULE      CLAUDE.md §3 (Page title: PageMasthead) · checklist 11 (wrong words)
SEVERITY  wrong
SOURCE    CODE

### Shop, Toolkit and store

#### A5-G4-01 · "Most in one payment" shows a typed ₱ default when the setting read fails
PAGE      /vendor-dashboard/shop/promote   (shop: Liwanag Photo & Film) — also Shop › Promote door
BUTTON    "Buy more" → the gift store's foot line
STEPS     1. Open Promote. 2. Press "Buy more". 3. Read the line under "Buy now".
EXPECTED  The cap is read from `platform_settings.max_payment_php`; if that read fails the line says it could not be read (and the cart does not enforce an invented cap).
ACTUAL    `getMaxPaymentPhp` catches a refused read and returns `MAX_PAYMENT_PHP_DEFAULT` (a peso number typed in `lib/max-payment.ts`); the store prints "<₱…> is the most in one payment." and `canAdd` caps the cart with it, as if it were read.
CODE      apps/web/lib/max-payment.server.ts · `return MAX_PAYMENT_PHP_DEFAULT` · apps/web/app/vendor-dashboard/shop/promote/_components/gift-store.tsx · `is the most in one payment`
SHOTS     to take in phase B: 375 px light + 375 px dark
RULE      CLAUDE.md §5 rule 3 (never guess a number that governs money) · rule 4 (honest states)
SEVERITY  money-signin
SOURCE    CODE

#### A5-G4-02 · Gift ticket sheet has two accent buttons (filled + accent-outlined), hand-made
PAGE      /vendor-dashboard/shop/promote   (shop: Liwanag Photo & Film)
BUTTON    "Add 1" beside "Add 10" (the bundle)
STEPS     1. Promote › Your gifts. 2. Tap a gift ticket. 3. Look at the two add buttons.
EXPECTED  One main button (the bundle, filled blue); "Add 1" neutral. Both made with `ActionButton`.
ACTUAL    `AddButton` is a hand-made `<button>`: the main one `bg-sn-accent`, the other `border-sn-accent/40 bg-sn-accent/[0.09] text-sn-accent` — accent-outlined. Same in the Apple branch.
CODE      apps/web/app/vendor-dashboard/shop/promote/_components/gift-store.tsx · `function AddButton`
SHOTS     to take in phase B: 375 px light + 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K1.2 · design-and-wiring §D 12 (one button primitive)
SEVERITY  look
SOURCE    CODE

#### A5-G4-03 · Gift store and gift history paint a fixed light fill — a pale surface in dark
PAGE      /vendor-dashboard/shop/promote   (shop: Liwanag Photo & Film)
BUTTON    "Buy more" · the history door
STEPS     1. Switch to dark. 2. Promote › "Buy more" (and the gift history). 3. Look behind the gift tiles.
EXPECTED  Flat `--color-page` / navy surfaces from tokens in dark.
ACTUAL    The scroll body is `bg-[rgb(238_242_248)]` (the light page colour typed in) in both the store and the history; `gift-store.module.css` also types `rgb(37 99 235 / 0.06)`. In dark the sheet body stays near-white under navy cards.
CODE      apps/web/app/vendor-dashboard/shop/promote/_components/gift-store.tsx · `bg-[rgb(238_242_248)]` · gift-store.module.css · `rgb(37 99 235 / 0.06)`
SHOTS     to take in phase B: 375 px dark
RULE      HOUSE_DESIGN_STANDARD Part K2.1 (no white surfaces in dark) · design-and-wiring §D 13 (no typed colour)
SEVERITY  look
SOURCE    CODE

#### A5-G4-04 · Logo, Cover photo and Storage open full screen on a phone though each is one short screen
PAGE      /vendor-dashboard/shop   (shop: Liwanag Photo & Film)
BUTTON    the logo circle · the cover · the plan/storage chip
STEPS     1. Shop at 375 px. 2. Tap the logo (then the cover, then the storage chip).
EXPECTED  SMALL POPUP: `Sheet` at half height (See · Upload · Adjust / See · Upload · Choose / the meter + one button are ≤ 3 things).
ACTUAL    `ParamSheet` → `ShopDoorScreen`, which below 701 px IS `RiseScreen` (full screen).
CODE      apps/web/app/vendor-dashboard/shop/_components/shop-cover.tsx · `function ParamSheet` · apps/web/app/vendor-dashboard/_components/shop-door-screen.tsx · `return <RiseScreen`
SHOTS     to take in phase B: 375 px light
RULE      SHAPE (owner 25 Nov)
SEVERITY  look
SOURCE    CODE

#### A5-G4-05 · A popup opens on top of a popup: Shop › Promote/Prints door → gift store / prints sheet
PAGE      /vendor-dashboard/shop   (shop: Liwanag Photo & Film)
BUTTON    "Promote" / "Prints" (cover row) → "Buy more" / a print design
STEPS     1. Shop at 375 px. 2. Tap Promote (rises full screen). 3. Tap "Buy more" (or open Prints and pick a piece).
EXPECTED  One layer at a time: from inside a full-screen door, the next step opens in place (sections open inside the RiseScreen), never a second overlay.
ACTUAL    The door is `ShopDoorScreen` (RiseScreen); inside it `ShopGiftsSection` opens `GiftStore` as `<Sheet … full>` and `ShopPrintsSection` opens `PrintsSheet` as `<Sheet … wide full>` — a full sheet over a full-screen popup (and the ticket sheet a third level).
CODE      apps/web/app/vendor-dashboard/shop/_components/shop-cover.tsx · `promoteBody` · promote/_components/gift-store.tsx · `<Sheet open={open} onClose={close} labelledById={headingId} full` · promote/_components/shop-prints-section.tsx · `function PrintsSheet`
SHOTS     to take in phase B: 375 px light
RULE      SHAPE (owner 25 Nov: never a popup on top of a popup) · HOUSE_DESIGN_STANDARD D2 (RiseScreen: one level only)
SEVERITY  look
SOURCE    CODE

#### A5-G4-06 · "Name your shop first" sends the supplier back to the Shop tab, not to where the address is set
PAGE      /vendor-dashboard/shop/qrs   (also Shop › QR door and Promote › Prints)
BUTTON    "Name your shop first"
STEPS     1. As a shop with no web address yet, open My QRs. 2. Tap "Name your shop first".
EXPECTED  It lands on the field that sets the shop's web address (Your page / Your details), opened.
ACTUAL    `setupHref="/vendor-dashboard/shop"` everywhere: from the Shop tab's own QR door it reloads the same page; from My QRs it lands at the top of Shop with nothing pointing at the address. Verify in phase B (the seeded shop has an address; needs a shop without one).
CODE      apps/web/app/vendor-dashboard/shop/qrs/page.tsx · `setupHref="/vendor-dashboard/shop"` · promote/_components/promote-body.tsx · `setupHref="/vendor-dashboard/shop"`
SHOTS     to take in phase B: 375 px light
RULE      design-and-wiring §B 5 (every press reaches a real destination)
SEVERITY  broken
SOURCE    CODE

#### A5-G4-07 · Storage sheet's upgrade button names the plan but shows no price
PAGE      /vendor-dashboard/shop   (shop: Liwanag Photo & Film)
BUTTON    "Go Ultra" (the next plan with more space)
STEPS     1. Shop › the plan/storage chip. 2. Read the sheet.
EXPECTED  A gate shows Problem → Solution → preview → price from the catalogue → one button.
ACTUAL    `StorageBody` shows the meter (and "Over your space — new files wait for room") and "Go <plan>" with no price; the price is only on the plans page.
CODE      apps/web/app/vendor-dashboard/shop/_components/shop-cover.tsx · `function StorageBody`
SHOTS     to take in phase B: 375 px light
RULE      design-and-wiring §B 7 (🔒 locks are honest: price from the catalogue)
SEVERITY  wrong
SOURCE    CODE

#### A5-G4-08 · Shop's "couldn't read" screen is hand-made: own <h1> "My Shop" and the legacy button
PAGE      /vendor-dashboard/shop
BUTTON    "Try again"
STEPS     1. Shop loader throws (refused read). 2. Look at the screen.
EXPECTED  The shared `ErrorState` / `ReadFailed` (what broke → what survived → what to do), one `ActionButton`; the tab's name is "Shop".
ACTUAL    A typed `<h1>` "My Shop" with `text-3xl … sm:text-4xl` and a `.button-primary` link (legacy, no more to be added).
CODE      apps/web/app/vendor-dashboard/shop/page.tsx · `data-shop-unread` · `className="button-primary`
SHOTS     to take in phase B: cannot be forced on staging; code only
RULE      HOUSE_DESIGN_STANDARD F4 · CLAUDE.md §3 (Button, Empty/error rows)
SEVERITY  look
SOURCE    CODE

#### A5-G4-09 · Analytics streaming stand-in is a pulsing grey block
PAGE      /vendor-dashboard/shop
BUTTON    —
STEPS     1. Open Shop on a slow connection. 2. Watch the Analytics slot before the carousel lands.
EXPECTED  `Ghost` / `Sk` skeleton that draws the carousel card's shape with the Sheen; no `animate-pulse`.
ACTUAL    `AnalyticsPlaceholder` draws `h-[260px] animate-pulse rounded-2xl bg-ink/[0.05]`.
CODE      apps/web/app/vendor-dashboard/shop/page.tsx · `function AnalyticsPlaceholder`
SHOTS     to take in phase B: 375 px light (throttled)
RULE      HOUSE_DESIGN_STANDARD F1 · CLAUDE.md §3 Loading (no animate-pulse)
SEVERITY  look
SOURCE    CODE

#### A5-G4-10 · A Shop tool opens as a body panel with no dim, blur or lock behind it
PAGE      /vendor-dashboard/shop   (shop: Liwanag Photo & Film)
BUTTON    any widget tile under "Your widgets" (e.g. "Run of show")
STEPS     1. Shop › tap a widget tile. 2. Try the bottom nav / top bar while it is open.
EXPECTED  Part K3: anything on top draws the shared `OverlayBackdrop` (dim + blur), the page behind is inert, a backdrop tap closes it.
ACTUAL    `BodyPanel` is a hand-built `fixed z-sn-pop` panel over the body that keeps the bars live (by an earlier ruling, "keep the navs"); it draws no backdrop. The 24 Nov K3 rule outranks it — needs an owner call.
CODE      apps/web/app/vendor-dashboard/_components/body-panel.tsx · `export function BodyPanel` · shop/_components/shop-makers.tsx · `<BodyPanel`
SHOTS     to take in phase B: 375 px light + dark
RULE      HOUSE_DESIGN_STANDARD Part K3.1–K3.2
SEVERITY  look
SOURCE    CODE

#### A5-G4-11 · Share your work: a refused plan read shows recaps as open; the Ultra notes vanish silently
PAGE      /vendor-dashboard/shop/promote   (shop: Liwanag Photo & Film)
BUTTON    —
STEPS     1. Promote › Share your work, when the tier read is refused.
EXPECTED  "Couldn't load" for the part that depends on the plan; never a gate opened by a failed read, never a section quietly gone.
ACTUAL    `gatedRead.catch(() => false)` treats an unread tier as not gated (recaps load); `loadUltraStoryNotes` returns `null` on a refused `vendor_profiles` read, so an Ultra shop's story-notes block simply is not drawn.
CODE      apps/web/app/vendor-dashboard/shop/promote/_components/share-your-work-data.ts · `gatedRead.catch(() => false)` · `function loadUltraStoryNotes`
SHOTS     cannot be forced on staging; code only
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
