## 2026-11-17 · feat(supplier): the supplier dashboard wears the owner's blue look (light) + the Prints row says what it is

- **The blue look, carried to every supplier page** (owner 16 Nov, DECISION_LOG "SUPPLIER DASHBOARD = THE OWNER'S BLUE LOOK … CARRIED TO EVERY SUPPLIER PAGE"; P1 drawings `prototypes/supplier_*_clean_2026-11-16/`). New `app/vendor-dashboard/_components/supplier-look.css`, switched on by `data-supplier-look` on the supplier template. It re-points the existing colour tokens on `<html>` while a supplier page is on screen. No component is recoloured by hand. The page is #EEF2F8 with the soft glow, cards are white with a soft shadow, titles are #101B30, body text is #566275, links are #175AB9, and the main button is solid #2272E6 with a white label (4.55:1) and the 16 Nov blue shadow. Ghost fills and washes are #E8F0FA, lines are cool, and the top bar is solid white from 1100. Admin › Colours and the couple side are untouched. Leaving the supplier area restores them.
- **Light only.** The ruling's dark mode is held as an owner question. The app is light-locked, the shell rule says dark follows the person's Appearance setting rather than the device, and the hand-typed white surfaces in the supplier area would break under it.
- **Shop › Promote › Prints row:** "Calling card + tarps" now reads "Marketing materials, printed out" (P1 drawing). The sheet, the 15 designs and the 7 pieces are unchanged.

SPEC IMPACT: None. The look and the words are the 16 Nov rulings already in DECISION_LOG. Nothing new is decided.
- The glow and the main button's shadow now read the tokens (`--color-mulberry`, the new `--sn-glow-soft`) instead of typed rgba values. Guard: `_components/the-blue-look-is-tokens-only.test.ts`.
- Audit fixes, 17 Nov:
  - **Prints follows the shop drawing.** The "Prints" heading stays. Under it sits "Marketing materials, printed out" and its counts (derived from `PRINT_DESIGNS` / `PRINT_PIECES`, never typed). Then come seven piece rows (name · size, then their line), each opening the shipped sheet on that piece. The icon is a calling card (`IdCard`).
  - **Shop's Prints tile.** The cover gains a Prints tile wearing the same `PRINTS_LINE`. It opens the shipped Promote sheet.
  - **Drawing colours.** Tiles, washes and pills are #DCE6F2, and warn is #8A5A00.
  - **Tokens only.** The glow and the button lift are tokens (`--sn-ambient`, `--sn-forward-lift`), read in globals.css at zero specificity. The lift never covers the keyboard focus ring.
  - **No Admin › Colours leak.** The supplier scope now holds every token a saved set writes. Guards: `the-blue-look-is-tokens-only.test.ts` and `shop/promote/prints-are-the-drawn-seven-rows.test.ts`.
- **Ready for #7888 (the clean warm look), which ships first.** The supplier scope re-points its new tokens to the drawing, so the supplier side never goes warm.
  - The secondary button (`--sn-btn-secondary-*`) is the blue ghost #E8F0FA with ink words (15.0:1). Hover is the #DCE6F2 wash. There is no outline.
  - The floating bar's `--sn-dock-lift` is the drawing's cool shadow.
  - The blue band keeps white words (`--sn-on-band`, 4.55:1). Ink on the blue would read about 3.2:1.
  - The guard holds each value. It also passes against #7888's `app-colours.ts`.
- **Template ratchet.** The cover's Prints tile is a wash tile (`--surface-soft`) with no bordered card, so Shop stays at its baseline.
- **Re-audit fixes (17 Nov).**
  - **Only the main button lifts.** The lift rule is narrowed to `.button-primary` and the filled `.ab.ab-brand.ab-main`, as the drawing lifts `.btn.pri` alone. Before, every brand-tone ActionButton lifted. A guard fails if the selector widens again.
  - **The Shop cover's quick row is the drawn three.** Prints · Your gifts · Plan are three centred white tiles, each with a 40px icon square on the wash.
    - Prints and Your gifts open the shipped Promote sheet at its own `#prints` / `#gifts` section.
    - Plan is the cover's `#plan` door, worded from `planLabel`.
    - No new read. Guard: `shop/the-quick-row-is-the-drawn-three.test.ts`.
  - `printsCountLine` goes through `formatCount`, and the Promote page's docblock now says seven rows.
- **Every way into a client conversation lands on the client's Chat** (owner 17 Nov on the #7901 preview: a pop-up's Reply opened the old full-screen thread page; owner rule 11 Nov, "a redesign moves every way in").
  - The links now go through `supplierChatHref`: Today's Reply and "Open the conversation", Today's Agree second action, the push notification, the ongoing "Reply to …" task, the dispute row, the upcoming-date row, the day sheet's Chat, the money row's Log payment, the day-check asks, Bookings, the fee lock, the inquiry lines, the on-the-day console, the public-page desk, the quote's "Back to conversation", the client page's Open chat / Log payment / Build quote, and Files' "Share files in chat".
  - The thread page itself forwards a plain arrival (stored bell notices, old pushes) to the client's Chat, and "Update this quote" to its Quotation.
  - It still draws for: a thread with no event, the computer inbox pane (`?pane=1`, owner 13 Nov D3), a return carrying its own notice, a released inquiry, and an older or closed chat on the event. The client's Chat draws the event's newest thread (`readClientChatThreadId`), so those must not forward.
  - Guard: `lib/a-conversation-opens-the-client-chat.test.ts` (sabotaged three ways, each red).
- **An action inside the client's Chat returns to the client's Chat, its notice said there** (owner 17 Nov via controller). Covers agree / decline a booking ask, send a quote, log a payment, and refusals.
  - Every return from inside the conversation is built with `supplierThreadPageHref`, and the thread page decides where it lands.
  - The forward now carries the notice params (`SUPPLIER_THREAD_NOTICE_KEYS`: notice · lock_agree · lock_decline · fee · taken · free · competing · error · msg) onto `?tab=chat`.
  - The client page hands them back to the ONE thread draw (`PickedPageContext.threadSearch` → `SupplierThreadBody search`). The same notice lines are drawn in the same chat box.
  - The page still draws for its own tools (Decisions `view`, counter-offer `compose=deal`), the computer pane, an unknown param, and an older chat on the event.
  - The guard's allow-list is now the helpers file alone.
- **Section labels are bold sentence case (owner 17 Nov, the clean look `dashboards_clean_look_2026-11-16`).** "NEEDS YOU TODAY · 9 · ⚙" is now **Needs you today** with its count in a pale pill right after it.
  - Tokens only: `.home-k2` / `.hc-k2` in globals.css read `--sn-label-*` (defaults are the old uppercase grey, so the couple side is unchanged); `supplier-look.css` sets them to the drawing (17px · 700 · ink · no tracking; count = the ghost wash · ink · 600).
  - The pinned Needs row has no ⚙ (the one ⚙ stays in the header; `today-gear-ride.tsx` removed, `today-gear-rides-the-header.test.ts` now holds that rule), no band (it paints the page's own fixed ground) and no bottom line.
  - Shop's "Your bundles and services" head moves onto the house label. Guard: `app/vendor-dashboard/section-labels-are-sentence-case.test.ts`.
- **Round 3 labels + CI.** Shop (Makers · Bundles · Services · Badges), Offers, Performance, Team access, the client page (Payments · Quotation · Your next move · Day-of timeline · Your handovers) and the Files heading move onto the house label (sentence case); the Offer editor's "As couples see it" too. `--sn-canvas` is the page's cool white on supplier pages, so no beige band shows. CI: "Message the couple" on the fee lock gets its `eventId`; `threadSearch` is optional on the picked-page context; `readClientChatThreadId` logs a refused read; five older guards follow the helper links; screens map + port baseline regenerated.
- **Sheets read the supplier tokens (owner 17 Nov).** The account and Notifications sheets wore gold because they read the `--m-*` palette (`--m-nav-active`, `--m-orange*`, `--m-ivory`, warm slates: `:root` hexes), not because they portal: the supplier scope is on `<html>`, so it reaches `<body>` portals. `supplier-look.css` now re-points that palette to the drawing, so the active row, ✓, the SHOP tag, "Profile & settings", "Mark all read", "View all" and the unread dots go blue, and the name card loses its warm glow (`--sn-cover-glow`). The name is the app sans, bold (`.sn-sheet-name`, the drawing's 1.15em · 700). The sheet labels (Switch to · You are in · Your shop · Today · Earlier · Waiting on this page) are the new token-read `.sn-sheet-k`, sentence case on supplier pages; the couple side keeps the mono caps. Client settings rises full screen (`MenuSettingsButton menu="client" rise`, owner 10 Nov), and its This client / Notes labels are the house label. Guard: `section-labels-are-sentence-case.test.ts` test 6.
- **The Shop quick row's "Prints" tile is "Promote" (owner 17 Nov: *"Prints should be renamed as Promote, since when you open it, it promotes"*).** The word is typed once (`shop-cover.tsx`; no registry or route title carries it). The tile now opens the Promote sheet itself (already titled "Promote") instead of scrolling to its Prints section; `data-shop-quick="promote"`. The route is unchanged and the screens map is unchanged. Guards `the-quick-row-is-the-drawn-three` and `prints-are-the-drawn-seven-rows` follow.

## 2026-11-17 · fix(shop): one service card holds everything — meta line and Edit · Share · Online · Delete inside its frame

Owner on the #7901 preview, Shop › Services ("Ballroom Uplighting"): *"i see so many spaces"* — the card stopped 44 px
short (the computer's hover Delete took its own column outside it), the Edit/Share/Online row sat apart below it, and
"flat · assigned to You" and "• Full reach" hung as two loose lines under that. Now the card's OWN frame holds it all,
through the footer slot `ServiceFace` already had ("Inside the frame, under the face"): the face, then ONE meta line
(price basis · branch · coverage · reach), then the row (✎ · ⇪ · Online switch · 🗑). `ServiceCardView` passes `footer`
through; `ServiceCardItem` gains `footInFace` and `ServiceCardItemFooter` (reads the row + delete from context, since a
server list cannot hand the client item a render function). Still ONE frame, never a box around the card (10 Nov
ruling and its guard hold). The 🗑 is the same SwipeToDelete-backed Delete (open-booking refusal → warning sheet →
Undo), hover/keyboard only on a computer, never on a touch screen (DECISION_LOG 2026-11-03); a phone still swipes.
Measured in `/dev/service-card-row-lab`: card fills the list at 1280 (was 44 px short), gutters 16 / 16 at 390, all
row buttons 44×44. Reposition only — no data or action added or lost.
Guards: `the-card-menu-row-is-edit-share-go-online.test.ts` admits only a hover-only Delete wired to `onDelete`
(sabotage-proven); `no-delete-x-on-list-rows.test.ts` ALLOWED names the row file with why.

SPEC IMPACT: None

## 2026-11-17 · fix(shop): the service card says each thing once; the Shop tile is Prints again

Owner on the #7901 preview (Shop › Services list): the "🏆 Booked 2× · 8 more to the 10-event medal" record now rides
INSIDE the card as one quiet line above the row (`CardRecordSection compact` — no rule, the distance on the same line,
truncated never wrapped); no divider between cards (the cards' edges separate them, the list's even 20 px gap); and
the first card no longer reads "Styling, Flowers & Lights › Lights & Sounds › Lights & Sounds" — `pathLabel`
(`lib/vendor-coverages.ts`) never repeats a level, and the meta line adds the coverage only where the group heading
and the card's category do not already say it, so every card reads the same. Order inside the card: face · meta ·
medal line · ✎ ⇪ Online 🗑. Measured at 390 in `/dev/service-card-row-lab`: medal 1 line (19 px), gap 20, gutters 16/16.
Owner ruling 17 Nov (superseding that morning's rename): *"then we should just have promote button and find gifts
there? That also means change Promote on Shop to Prints."* — the Shop quick tile is **Prints** again, still worded
`PRINTS_LINE`, and opens the prints ALONE (`PromoteBody part="prints"` in its own `?sheet=prints` screen; the gifts
and stories are not read). The separate Promote button waits on a drawing.
Guards: `the-card-says-each-level-once.test.ts` (new, sabotage-proven); the quick-row, prints, share-your-work and
shop-sheets guards follow the ruling; the card-row guard now holds "no divider".

SPEC IMPACT: None

## 2026-11-17 · fix(swipe): a card never paints over a pinned bar

Owner via P2, Shop › Services: *"scrolling overlaps"* — a scrolled service card (its ✎ ⇪ Online row) drew OVER the
pinned bar ("View shop ↗ · ⚙ · +"). The swipe front's `z-10` and the card face footer's `z-10` shared the page's
stacking order with the pinned bars (`z-[5]` / `z-[6]`, both already on the opaque `--sn-canvas`). `SwipeToDelete`'s
row and the service card `<li>` are now `isolate` — their own stacking context — so every swipe row in the app keeps
its lifts inside itself; the row's sheets are portalled, so none is trapped. Measured in `/dev/service-card-row-lab` with
a stand-in `sticky top-0 z-[5]` bar: the topmost element over the bar was the card's row 3/3 (before) → the bar 3/3
(after), at 390 and 1280. Guard: `the-card-says-each-level-once.test.ts` #4 (sabotage-proven).
Also merged `origin/main` (the J3 badge row also uses `ServiceCardView`'s `footer`; one prop, both uses documented).

SPEC IMPACT: None

## 2026-11-17 · fix(shop): the shop's own card wears the app-drawn seal and badges

Owner, 17 Nov: "badges and seal is still not visible" — the only seal on the supplier's Shop header was the one baked
into the cover photo. Measured on prod (read-only): the test shop is verified and in good standing, holds 0 stored
seals (0 platform-wide — the yearly run has not happened) and 0 card-badge holds; the public shop page and the Find
card already drew the Setnayan Verified seal and each card's Verified medal. Only the supplier's OWN surfaces drew none.
- Shop header: the "✓ Verified" text becomes the app's Setnayan Verified seal (`ImageBadge`, `verifiedBadge()`), then
  the earned milestone/award circles (`shopBadges`, the public hero's filter), or the honest next step
  (`nextToEarnLine`) when none is earned yet.
- Shop › Services: each card draws its J3 medal row (`CardBadgeRow`) from the same read the public page makes
  (`readShopSeals` → `readCardBadges`). A refused read draws nothing.
- Guard: `the-shop-card-wears-its-seal-and-badges.test.ts` (sabotage-checked).

SPEC IMPACT: None.

## 2026-11-17 · fix(ci): Shop › Services back under its template-score baseline

`template-score-ratchet` read the services page at 93 against a baseline of 91: the one-line meta line and the compact
medal line each counted as a "long paragraph" because their inline expressions (an IIFE, a ternary of fragments) kept
nested braces the scorer cannot collapse. Both now work their words out above the JSX (`coverageLeaf`, `medalTail`);
the lines render the same. Guard regexes in `the-card-says-each-level-once.test.ts` follow the names.

SPEC IMPACT: None.
