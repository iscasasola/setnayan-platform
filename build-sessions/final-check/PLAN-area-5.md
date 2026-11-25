# Final check · PLAN · Area 5 — Supplier: shop, cards, Toolkit, plans

**Date:** 25 Nov 2026 · Fable planner for area 5. Plan and drawings only; no app code was changed.
**Read from:** `ALL-FINDINGS.md` (branch `final-check/brief`), `area-5.md` (branch `final-check/area-5`, with its `## Second pass (25 Nov)`), owner Adds 1–25, the house design standard, and the component code on main at `7c14361159`.
**Drawings:** specs repo `prototypes/final-check-area-5_2026-11-25/final-check-area-5_2026-11-25.html` (19 sections: one per lane B screen, plus the SW-SPIN reference).

Paths below are under `apps/web/app/vendor-dashboard/` unless they start with `apps/`, `lib/`, `open-shop/`, `vendor/` or `vendor-invite/` (those are under `apps/web/` or `apps/web/app/`).

## How the fixer uses this

- Lane A now, in the batch order below. One branch and one PR per batch: `claude/fc-fix-a5-b1` … `b4`.
- **No LIVE entry belongs to area 5** (all 21 are area 1). Batch 1 is the worst-first batch and is already open as PR #8305: this plan keeps its 11 IDs as they are.
- **Area 5 builds no shared lane A sweep** (no sweep names area 5 first). Skip the IDs listed under "Area 5 IDs that other areas build".
- Lane B waits. Every lane B line below reads `APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29)`. Start a line only when the controller changes it to approved.
- Lane C: `A5-G5-01` (seats count paused and removed members) and the area 5 members of the shared lane C entries (`B5-01` · `B5-05` · `B5-19` sign-in, `B5-23` plan story). Never built without the owner.
- Lane R: none in area 5 (second pass SP5-11).
- Money entries (`money-signin`): change only HOW it shows ("Couldn't read", a guard that refuses). Never an amount, a plan's contents or which price is read. If the right fix needs that, mark it 🟠 in the PR and skip it.
- A failed read never shows as 0, empty, Free, a lock or "none yet": it says "Couldn't read …" with Try again (`ReadFailedNote`, `ToolFail`, `TemplateFail`, `ErrorState`; all shipped).
- Budgets hold: server actions 1,251 (fold, never raise), shared JS 202.3 KB, no baseline regenerated. A fix that removes a line from `lib/supabase-unread-error.baseline.txt` shrinks that file in the same commit.

## Lane A · 48 own entries = 4 batches

### Batch 1 · a refused plan read is said, never "Free" or a lock (11) · `claude/fc-fix-a5-b1` · PR #8305 (open)

Order as built: the one honest reader first (`readVendorTier`, `readExtraAgentSeats`), then each screen.

| # | ID | Files | The fix | The test that holds the claim |
|---|---|---|---|---|
| 1 | A5-G2-01 | `layout.tsx` | The rail's Plan row shows "—" (title "Couldn't read your plan") on a refused read. | `lib/vendor-tier-read-is-honest.test.ts`: a client that returns an error yields the unread state, never `free`. |
| 2 | A5-G2-02 | `layout.tsx` · `lib/vendor-feature-gate.ts` | The rail reads the plan through the one reader, so the promotion applies like on every gate. | Same file: the layout imports the one reader and reads no `tier_state` of its own. |
| 3 | A5-G2-03 | `creators/_components/creators-tools.tsx` · `lib/vendor-feature-gate.ts` | A refused read says "Couldn't read your plan just now"; a Pro shop is never told to buy. | Unread tier → the Send block renders the unread note, not the plan ask. |
| 4 | A5-G6-13 | `deep-search/page.tsx` | Unread plan → `ReadFailedNote`; no runner drawn on a guess. | Unread tier renders no Free lock and no runner. |
| 5 | A5-G6-14 | `deep-search/page.tsx` | A failed history read says "Couldn't load your searches"; a failed dossier read says "Couldn't read", not "Running". | A read error never yields the empty list or the word "Running". |
| 6 | A5-G5-04 | `theft-watch/page.tsx` | Unread plan → `ReadFailedNote`, never "is a Pro feature". | Unread tier renders no `VendorTierGate`. |
| 7 | A5-G5-03 | `website/page-data.ts` · `website/_components/page-parts.tsx` | Unread plan → no plan ask, one `TemplateFail` line. | Unread tier renders zero `PlanAsk`. |
| 8 | A5-G3-02 | `services/[serviceId]/page.tsx` | Unread plan → `ReadFailedNote` where "Add the first space" sits. | Unread tier never renders the lock on that row. |
| 9 | A5-G5-05 | `profile/` (`details-data.ts`) | A refused row → `ReadFailedNote` and no Save that would write OFF. | A refused row renders no switch card and no submit. |
| 10 | A5-G4-11 | `shop/promote/` (`share-your-work-data.ts`) | Unread plan → recaps and the Ultra notes each say "couldn't load". | Unread tier never returns recaps as open; the notes part renders its failure. |
| 11 | A5-G5-02 | `team/` · `lib/vendor-seats.ts` | "Couldn't read your extra seats"; the cap is not lowered on a guess. | A refused read returns unread; the seat cap equals the plan's base cap, not base + 0. |

### Batch 2 · the other failed reads say "Couldn't read" (14) · `claude/fc-fix-a5-b2`

Order: the shared readers in `lib/` first (they feed several pages), then the pages, then the three doors outside the dashboard. The two money rows are display only.

| # | ID | Files | The fix | The test |
|---|---|---|---|---|
| 1 | A5-G5-07 | `lib/vendor-team.ts` `fetchTeamManagerContext` · `team/roles/page.tsx` · `team/roles/inquiries/page.tsx` · `team/_components/team-screen.tsx` | A refused team read returns "unread", apart from "not a manager". The three pages say "Couldn't load your team · Try again"; no role lock, no silent bounce. | `a-refused-team-read-is-not-a-role-lock.test.ts`: a client error yields the unread state; the pages render the failure, not `RoleLock` and not a redirect. |
| 2 | A5-G5-08 | `team/roles/inquiries/page.tsx` | When the card read failed, only the failure notice shows; "No live cards on this branch yet." is drawn only on a read that succeeded with zero cards. | `readFailed` true → the empty sentence is absent from the render. |
| 3 | A5-G5-06 | `track-record/page.tsx` | A failed profile read says "Couldn't read your shop just now · Try again" (`ToolFail`); "Set up your supplier profile first" only when the read succeeded with no profile. | A read error renders `ToolFail`; a real null renders the set-up line. |
| 4 | A5-G3-01 | `lib/service-card-maker.server.ts` · `services/[serviceId]/page.tsx` | The reader returns "unread" apart from "no such card"; the page says "Couldn't load this card · Try again" and calls `notFound()` only for a real miss. | A client error never reaches `notFound()`. |
| 5 | A5-G2-05 | `lib/creator-offers.ts` (`fetchEligibleCreators`, `fetchVendorSentOffers`) · `creators/` | Each returns null on error; the page says "Couldn't load creators · Try again", distinct from "No creators match yet". | Error → null → the failure state; empty array → the empty state. |
| 6 | A5-G6-10 (money) | `recommendations/page.tsx` · `recommendations/_panel.tsx` | Bind every read's `error`. A failed part says "Couldn't read …"; a raw code falls back to the catalogue name or "Couldn't read", never the code; On/Off is not drawn from a failed opt-in read. Display only: no price is chosen or typed. | One case per read (sent, taxonomy, catalogue, opt-in): an error never renders "No recommendations for your categories yet", a raw code or an Off switch. |
| 7 | A5-G4-01 (money) | `lib/max-payment.server.ts` · `shop/promote/_components/gift-store.tsx` | When the setting read fails the line says the cap couldn't be read; `MAX_PAYMENT_PHP_DEFAULT` is never printed as the cap. The server-side guard that refuses an over-cap payment is unchanged. 🟠 if the guard itself would need a different number. | A failed setting read renders no ₱ figure in the "most in one payment" line. |
| 8 | A5-G6-01 | `collections/albums/page.tsx` | A failed bookings read says "Couldn't read your bookings" with Try again. | `!room.complete` or a read error never renders "No booked events yet". |
| 9 | A5-G6-05 | `partnerships/page.tsx` | No "(0)" beside a section whose read failed (no count, beside the "couldn't load" notice). | `partnershipsMeasured` false → the headings carry no count. |
| 10 | A5-G6-06 | `partnerships/page.tsx` | A failed names read shows "Couldn't read this shop's name", never the raw id. | The render never contains a `vendor_profile_id` as a name. |
| 11 | A5-G6-11 | `lib/songs.ts` (`fetchVendorSongs`, `searchSongs`) · `repertoire/_components/repertoire-view.tsx` | A failed set-list or library read says "Couldn't read your set list" with Try again. | Error → the failure state, never "Add the songs you perform". |
| 12 | A5-G1-09 | `apps/web/app/vendor-invite/[slug]/page.tsx` · `lib/vendor-couple-invite.ts` `listHostEvents` | A refused read says it couldn't read and offers Try again; "link is gone" and "no event" only on a successful read. | A client error never renders the gone or the no-event card. |
| 13 | A5-G1-13 | `apps/web/app/vendor/claim/[token]/finalize/page.tsx` | A failed card-count read is not "no cards": the claimed shop lands on Today, not on "make your first card". | `count === null` with an error never takes the first-card path. |
| 14 | A5-G1-14 | `apps/web/app/vendor/fit/[ref]/page.tsx` | The calendar read no longer falls back to `true`: the date row says it couldn't check (neither ✓ nor ✗) and the verdict is not "Fits" on an unread date. | A thrown calendar read yields `ok: null` for the date check and a non-fit verdict line. |

### Batch 3 · presses, doors and popups that must answer (12) · `claude/fc-fix-a5-b3`

Order: the two shared layers first (they touch many pages), then the maker, then single doors.

| # | ID | Files | The fix | The test |
|---|---|---|---|---|
| 1 | B5-18 | the "Write to NFC" popup (QrCard's NFC layer, used on `open-shop/invite` and `shop/qrs/*`) | Escape, the backdrop and back close it like every other popup (use `useModalA11y` / the shared Sheet close). No look change. | `every-supplier-popup-closes-on-escape.test.ts`: dispatch Escape on the open NFC layer → it is closed and focus is back on the opener. |
| 2 | B5-21 | `shop/_components/shop-settings.tsx` (the ⚙ layer) | Same: Escape closes it and focus returns to the ⚙. | Same file, second case, on the Shop settings layer. |
| 3 | B5-22 | `services/_components/canvas-maker.tsx` | Drop `inert` from the whole form on a locked card. Make the fields read-only or disabled one by one; the ⓘ notes, "About this card" and "Show me" stay pressable. **Stop there:** removing the pencils and the add-photo tile is lane B (drawing B7). | On a locked card, pressing ⓘ and "About this card" opens them; a typed-row cannot change its value; the form submits nothing. |
| 4 | A5-G2-04 | `creators/_components/creators-tools.tsx` · `creators/actions.ts` `humanizeOfferError` | The Send lock shows 🔒 and one sentence that names one plan (the same in the UI and in the action's refusal). The price on the lock is SW-NOPRICE (area 3 builds the shared lock line): leave a slot, type no price. | The plan named by the lock equals the plan named by `humanizeOfferError`; the lock renders 🔒. |
| 5 | A5-G3-07 | `services/requests/actions.ts` · `services/requests/page.tsx` · `_components/your-requests-view.tsx` | The list reads the notice key and shows "That request is gone." | The key the action redirects with is rendered by the list page. |
| 6 | A5-G4-06 | `shop/qrs/page.tsx` · `shop/promote/_components/promote-body.tsx` | "Name your shop first" lands on the field that sets the shop's web address (Your details / Your page), not on the Shop tab. | `setupHref` resolves to the route and anchor of the address field; that anchor exists in the target page. |
| 7 | A5-G2-12 | `activities/page.tsx` · `lines/page.tsx` | A shop-less person goes to `/vendor-dashboard`, like every other tool, not through `/verify`. | Neither page redirects to `/vendor-dashboard/verify` for "no shop". |
| 8 | A5-G1-11 | `apps/web/app/vendor/claim/[token]/page.tsx` `TerminalCard` | Each dead end states the fact and offers one action: the help door (`/help?for=shop#contact`) or sign in. | Every `TerminalCard` variant renders exactly one link or button, and none says "contact support" without a link. |
| 9 | A5-G2-06 | `page.tsx` (Today) | The failure screen is the shared `ErrorState`: what broke → what survived → one Try again. | The failure branch renders `ErrorState` with a retry. |
| 10 | A5-G6-04 | `packages/[packageId]/page.tsx` · `package-editor.tsx` | ✕ returns to where the Bundle Maker was opened (Your packages or Shop › services), scroll kept: `router.back()` when it was opened in the app, the list as the fallback. | Opened from `/packages`, close lands on `/packages`; opened directly, close lands on the list. |
| 11 | B5-25 | `attributes/page.tsx` · `attributes/_components/attributes-view.tsx` | Attributes lists the shop's services from the same reader Your details and Shop use; "No services yet" only when that reader returns none. | A shop with one live service renders that service; a read error renders the failure, not the empty line. |
| 12 | B5-20 | `shop/` (the "Where your price sits" block) · the shop page's card "from" line | The block reads the cards' starting prices from the same source the cards show. A per-guest card's "from" equals its per-guest price × its minimum. Display only. 🟠 if the two "from" figures come from two stored values that disagree: that is data, not this batch. | Cards with a starting price → the block never says "Add a starting price"; one pure-function test holds per-guest × minimum = "from". |

### Batch 4 · words, counts and made-up values (11) · `claude/fc-fix-a5-b4`

Order: the constants first, then pages.

| # | ID | Files | The fix | The test |
|---|---|---|---|---|
| 1 | A5-G5-10 | `team/_components/helpers-view.tsx` · `team/roles/page.tsx` · `website/_components/page-parts.tsx` · `theft-watch/page.tsx` | Counts and plan names come from their one source (`VENDOR_DUTIES.length`, `TIER_LABEL`, the seats reader), not typed ("and 3 more", "1 Helper free", "Pro"). Display only: no plan content changes. | A source scan (through `lib/strip-comments.ts`) finds none of the typed strings in those four files. |
| 2 | A5-G1-06 | `open-shop/invite/page.tsx` | "Only invite those you trust." once (keep the one on the QR card). | The page renders `INVITE_SHOPS_LINE` once. |
| 3 | B5-09 | `shop/promote/` (Your gifts) | The gift row shows its catalogue name ("Papic 150"), never `PAPIC_GUEST_150`. The dead-end line "can't be set here yet" is filed with SW-COMING, not here. | No rendered gift title matches `/^[A-Z0-9_]+$/`. |
| 4 | A5-G2-10 | `attributes/_components/attributes-view.tsx` (`INTRO`) | Plain words; drop "attribute payload" and the ranking claim. | The file contains neither phrase. |
| 5 | A5-X-05 | `shop/_components/voice-match-card.tsx` (`PREVIEW_ANSWER`) | The preview reads the shop's own card price, or shows no price. No price typed in code. (The page is area 6's; the component is here.) | The source has no `₱` followed by a digit. |
| 6 | B5-10 | `packages/` (the Bundle Maker's totals and discount hint) | Totals read "—" until two cards are picked; the discount hint shows a range only when it has one. | Zero cards picked → no "₱0" in the render and no "above ₱0 and below ₱0". |
| 7 | A5-G3-12 | `services/their-work/page.tsx` | One line that fits a shop-wide page; the title comes from the page's registry entry. | The page does not say "this card". |
| 8 | B5-07 | `shop/_components/shop-cover.tsx` (the hero eyebrow) · `shop/qrs/*` | Show the shop's address without its query (`?src=own&via=link` stays in the link, never in the words). | The eyebrow text contains no "?" and no "=". |
| 9 | B5-12 | `deep-search/page.tsx` | The masthead shows "Deep Search" (visible), and "Unused searches don't carry over" is said once. The pill and icon tile are lane B (drawing B5). | The h1 is not `sr-only`; the sentence appears once in the render. |
| 10 | B5-27 | `_components/today-v2.tsx` · `today-wrap-up.tsx` | One line says the day is clear; the snoozed tasks sit under it. | `empty-today-says-it-once.test.ts` (shipped) gains the case "every task snoozed": the sentence is rendered once. |
| 11 | B5-08 | `shop/` (Analytics › Opened) · Today's "How is business" | 🟠 **Hold for the controller.** The finding asks for a flat chart that says "Nobody opened your page in the last 30 days". The house standard F3 says an empty dashboard part draws sample rows, faded and marked "Example". Removing the "Example" shape is a look change and reverses F3 for this chart: it needs a ruling or a drawing, not a silent fix. | If ruled: a real zero renders no sample series. |

### Area 5 IDs that other areas build (skip here)

SW-500 (B5-03) · SW-COMING (A5-X-04 · A5-G6-03) · SW-URI (A5-G6-22) · SW-PHP (A5-G1-03 · A5-G1-04 · A5-G2-08 · B5-04) · SW-BOOKED (B5-02) · SW-PROMISE (B5-24) · SW-WORDS (A5-X-03) · SW-RAWDB (A5-G1-12) · SW-WEDDING (A5-G3-11) · SW-NOPRICE (A5-G4-07 · A5-G5-09 · A5-G6-12 · A5-G6-15; area 3 builds the shared lock line, then area 5's four call sites follow in that PR) · SW-SPEED (A5-G2-09) · SW-PLACE (B5-13).

## Lane B · 19 drawn sections (18 screens + 1 sweep reference)

Drawing file: `prototypes/final-check-area-5_2026-11-25/final-check-area-5_2026-11-25.html` in `iscasasola/Setnayan-specs`. Each section shows Now beside Proposed at 375 and 1280, light and dark. Dark does not paint on any area 5 page today (B5-00), so each "Now" is one light frame; the dark "Proposed" frames land with SW-DARK. No price or plan content is drawn.

| Drawing | ID | Screen | The change in one line | Status |
|---|---|---|---|---|
| B1 | A5-G1-01 · B5-15 (look) | Open a shop (`/open-shop`) | The five steps rise in the shared RiseScreen (centred dialog on desktop); ✕ returns to where the person was. | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B2 | A5-G1-08 · B5-15 (look) | Add your logo (`/open-shop/logo`) | A step of the same layer, in the supplier look (no warm page, no brown bars). | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B3 | A5-G1-07 | Invite shops you trust (`/open-shop/invite`) | The closing step of the same layer; Later and Done in its bar. | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B4 | B5-11 | Today at 1280 (`/vendor-dashboard`) | Counts fit their column and show once; the band sits inside the gutter; the stage step uses the supplier accent. | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B5 | A5-G6-16 · SP5-06 · SP5-07 | Deep Search | Status is the house chip (dot + word); the icon tile goes. | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B6 | A5-G2-14 | Help (`/vendor-dashboard/help`) | A small popup (Sheet) from Settings with the same five rows. | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B7 | B5-16 | Card maker, a booked card | Read-only fields (no pencil, no add-photo tile); the name shows from its start; one bar at the thumb. | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B8 | A5-G3-05 · SP5-05 | Card maker (`services/new`, `new/[category]`, `[serviceId]`) | Rises over Shop in the RiseScreen; ✕ returns to the same scroll place. Needs a `@rise` slot for services. | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B9 | A5-G3-06 | Tell us what you do (`services/requests/new`) | Three steps open in place inside the maker's layer; ‹ returns to the maker as it was. | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B10 | A5-G4-04 | Shop › Logo · Cover photo · Storage | Half sheets on a phone (already Sheets from 701 px). | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B11 | B5-06 · SP5-04 | Shop at 1280 | The tab uses the body's width; service cards one per row until each has 320 px. | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B12 | B5-17 · SP5-02 | Toolkit (`shop/store`) | Shelves sit side by side on tablet and desktop; on a phone the list fades and clears the thumb row. | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B13 | A5-G5-17 · SP5-08 | Roles (`team/roles`) | Opens in place inside the risen Team layer (‹ back to Team). | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B14 | A5-G5-16 · A5-G5-18 | Who gets new inquiries (`team/roles/inquiries`) | One PickMenu for the branch; opens in place under Roles; Adjust opens under its group. | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B15 | A5-G5-19 | Theft Watch | Rises from the Shop shelf in the RiseScreen. | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B16 | A5-G5-20 | Track record | Rises from the Shop shelf in the RiseScreen. | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B17 | A5-G1-15 | Fit check (`/vendor/fit/[ref]`) | The event choice is one PickMenu; colours by token. | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B18 | B5-26 | Back control and title, across the area | One pinned row (ToolPin: ‹ + a visible title) on every page with a way back. | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |
| B19 | SW-SPIN (A5-G4-09 · A5-G6-21 · A8·L-6) | Busy states (sweep; area 5 is named first) | Ghost skeleton in the loaded shape; a pressed button that names its step; no spinner, no pulse. | APPROVAL: approved by the owner 25 Nov (drawing https://claude.ai/artifact/PXhoxhtaK266X68bNeSZ5f; Adds 28–29) |

### Area 5 IDs in lane B sweeps that other areas draw

SW-K1 (A5-G1-05 · A5-G1-10 · A5-G2-11 · A5-G2-13 · A5-G3-08 · A5-G3-09 · A5-G3-10 · A5-G4-02 · A5-G5-12 · A5-G5-13 · A5-G5-14 · A5-G6-02 · A5-G6-07 · A5-G6-08 · A5-G6-17 · A5-G6-18 · B5-14) · SW-DIALOG (A5-G1-02 · A5-G3-03 · A5-G4-08 · A5-G4-10 · A5-G6-19) · SW-DARK (A5-X-02 · B5-00) · SW-SHADOW (A5-X-01 · A5-G2-07): reference drawings by area 1. SW-K2 (A5-G4-03 · A5-G5-15 · A5-G6-09) · SW-POPPOP (A5-G3-04 · A5-G4-05 · A5-G5-11 · A5-G6-20): reference drawings by area 2.

### Build order for lane B, once approved

1. B18 (the one pinned row) and B19 (busy states): shared parts that the others use.
2. B8, then B9 and B7 (the maker's layer; B9 and B7 live inside it).
3. B1 → B2 → B3 (one layer, three steps).
4. B13 → B14 (inside Team's layer), B15, B16, B6, B10.
5. B4, B11, B12, B5, B17 (layout and token changes, no shape change).

Each lane B PR carries the Fable prototype link, a 390 px dark shot with the top-block glow (after SW-DARK), and the walk of every way in (rows, shelf links, notices, the old addresses as forwards).

## Flags for the controller (🟠)

- **Popup on a popup (B9 · B13 · B14).** The findings ask for a full-screen popup over a screen that is itself a full-screen layer (the maker after B8; Team, which already rises). Add 1 says never a popup on a popup, and RiseScreen is one level. The drawings open these in place inside the layer that is up. Confirm that reading.
- **B5-15 is two things.** The colour mismatch is drawn (B2). "The steps open again for an established shop" is a forward to Shop: lane A, no drawing. Add it to batch 3 when the controller agrees.
- **B5-16 and B5-22 overlap.** B5-22 (lane A, batch 3) makes help pressable on a locked card. B5-16 (lane B, B7) removes the edit marks. Batch 3 must not remove the pencils.
- **B5-08 (lane A in the list) reads as lane B.** Removing the "Example" chart shape reverses house standard F3 for that chart. Held in batch 4, row 11.
- **Money, never drawn.** B10's Storage sheet and B12's "With a plan" rows carry plan names and catalogue prices. They are dashed "unchanged" boxes in the drawing. The price on the Storage button is SW-NOPRICE (lane A sweep). Nothing in lane B changes a price or what a plan holds.
- **Second pass, not in ALL-FINDINGS.** SP5-01 (pull to refresh) reverses the owner's 15 Jun rule (`overscroll-behavior: none`): lane C, the owner decides; not drawn. SP5-03 (44 px rows on desktop) is a site-wide rule (Add 11b), one house ruling for every area; not drawn. SP5-08 (an icon per role) and SP5-07's new icon are Add 13 icons to draw first. SP5-09 and SP5-10 follow Add 15 and Add 16.
- **Lane R:** none.
