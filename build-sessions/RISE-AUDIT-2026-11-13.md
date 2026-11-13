# RISE FULL SCREEN, EVERYWHERE — the audit (2026-11-13)

Owner rulings: DECISION_LOG 44a4c660 (9 Nov, "ONE WAY TO GO FULL SCREEN, APP-WIDE" · "FULL SCREEN ALWAYS LOSES THE BOTTOM
NAV") and 10 Nov — *"risefull screen is what we call it"* · *"fullscreen everything"*.

**The rule.** Anything full screen RISES out of the row/card you tapped and falls back into it on close. While it is up the
bottom nav slides down and the top bar slides up (0.32 s); ✕ (or Esc, or the phone's Back) is the exact reverse. No pop-up
box, no page jump, ONE level only. A tab re-tap (`sn:tab-reselect`) closes it and goes to the tab's top.
Small sheets that are correctly small — menus, pickers, confirms, one-field asks — STAY.

**The one part (reuse, never a second shell).** `app/_components/rise/rise-screen.tsx` (`RiseScreen`) on
`lib/rise-screen.ts` + `lib/rise-motion.ts` (`RISE_MS` · `RISE_EASE`), bars via `app/_components/nav/use-chrome-away.ts`
(`useChromeAway`, `front-door.css`). A ⚙ rises through `MenuSettingsButton`. A list row rises through `Fold rises` /
`SupplierOpenRow`. The picked client (`PickedShell`) is the full-screen view for a client/supplier.
Guard: `app/_components/rise/the-rise-screen-is-one-full-screen.test.ts`.

> Anchors are greppable symbols, never line numbers (CLAUDE.md Rule 0 · 7). All paths are under `apps/web/`.
> Legend — **today**: `sheet` = `<Sheet>` (bottom sheet on a phone, a drawer on a desk; `<Sheet rise>` is only its own
> slide-in, NOT a Rise) · `dialog` = its own `role="dialog"` overlay · `jump` = a `<Link>` to another page · `rise` =
> `RiseScreen`. **Target**: `RISE` = convert · `stays` = correctly small · `full` = already a full-screen view of its own.

## 0 · Status by batch

| batch | what | state |
|---|---|---|
| 1 | every ⚙ rises — `MenuSettingsButton` `rise` becomes the default (Home · Guests · Event Hub · Suppliers · Memories · People · Today · Clients · Portfolio · Supplier Hub · Shop). The picked client's own ⚙ keeps its sheet (`rise={false}`: it is already inside a risen view — one level). | ✅ this PR |
| 2 | lock & upsell explainers that were still sheets/dialogs → `RiseScreen` (`IapUnlockSheet` · `IapPapicSheet` · `IapLiveWatchSheet` · `ChoosePlanSheet`). `RiseScreen` gains `busy` (a purchase in flight holds every way out) and `useRiseClose` / `WithRiseClose` (an inner Done / Not now falls back exactly as ✕ does). | ✅ this PR |
| 3 | the supplier avatar rows (Your details · Your page · Helpers · Plan · Settings) — page jump → rise, through `@rise/(.)<page>` + `RiseRoute` (§ H). Billing & receipts and Profile & settings live in the `/dashboard` tree — next. | ✅ this PR (supplier rows) |
| 4 | Prints ⚙ (`StudioPrintSettings`, its fields must never unmount) · `ApplyProSheet` (drawn at z-90 inside the Maker — above the pop layer, needs a layer decision first) · `offer-editor.tsx` / `body-panel.tsx` own overlays → `RiseScreen` | next |
| 5+ | the content sheets marked RISE below (service/supplier card, schedule, forms, chat info, admin drawers) | next |

## A · Every ⚙ (settings door)

| file · symbol | trigger | today (before) | target |
|---|---|---|---|
| `dashboard/[eventId]/_components/home-settings-gear.tsx` · `menu="home"` | Home ⚙ | sheet | RISE ✅ b1 |
| `dashboard/[eventId]/guests/_components/guests-screen.tsx` · `menu="guests"` | Guests ⚙ | sheet | RISE ✅ b1 |
| `dashboard/[eventId]/launch/_components/hub-settings.tsx` · `menu="hub"` | Event Hub ⚙ | sheet | RISE ✅ b1 |
| `dashboard/[eventId]/vendors/_components/services-takeover.tsx` · `menu="suppliers"` | Suppliers ⚙ | sheet | RISE ✅ b1 |
| `app/_components/memories/event-memories-gallery.tsx` · `menu="memories"` | Memories ⚙ | sheet | RISE ✅ b1 |
| `dashboard/(account)/people/_components/people-pinned-row.tsx` · `menu="people"` | People ⚙ | sheet | RISE ✅ b1 |
| `vendor-dashboard/_components/today-settings.tsx` · `menu="today"` | Today ⚙ | sheet | RISE ✅ b1 |
| `vendor-dashboard/customers/_components/customers-settings.tsx` · `menu="customers"` | Clients ⚙ | sheet | RISE ✅ b1 |
| `vendor-dashboard/collections/_components/portfolio-settings.tsx` · `menu="portfolio"` | Portfolio ⚙ | sheet | RISE ✅ b1 |
| `vendor-dashboard/on-the-day/_components/hub-settings.tsx` · `menu="supplier-hub"` | Supplier Hub ⚙ | sheet | RISE ✅ b1 |
| `vendor-dashboard/shop/_components/shop-settings.tsx` · `menu="shop" rise` | Shop ⚙ | rise (Build 5) | rise |
| `app/_components/picked/picked-shell.tsx` · `menu="client" rise={false}` | ⚙ inside a picked client | sheet | **stays** — inside a risen view (one level) |
| `dashboard/[eventId]/launch/_components/studio-prints-settings.tsx` · `StudioPrintSettingsDoor` / `StudioPrintSettings` | Prints ⚙ (door only) | dialog (own portal, fields never unmount) | RISE — b4 |
| `dashboard/[eventId]/schedule/_components/chapters-host.tsx` · "Schedule settings" `<Sheet>` | Schedule ⚙ | sheet | RISE — b5 |

## B · Lock & upsell explainers

| file · symbol | trigger | today | target |
|---|---|---|---|
| `app/_components/lock/locked-feature.tsx` · `LockedFeature` / `LockExplainer` / `LockButton` | any 🔒 row (analytics, bundles, proposal maker, plan) | rise | rise |
| `app/_components/lock/limit-sheet.tsx` · `LimitSheet`; `vendor-dashboard/subscription/_components/limits-sheet.tsx` | a limit reached | rise | rise |
| `app/_components/iap/iap-unlock-sheet.tsx` · `IapUnlockSheet` (Patiktok · Setnayan AI · Pakanta · Memories thank-you) | locked add-on | sheet | RISE ✅ b2 |
| `app/_components/iap/iap-papic-sheet.tsx` · `IapPapicSheet` | Papic upsell | sheet | RISE ✅ b2 |
| `app/_components/iap/iap-live-watch-sheet.tsx` · `IapLiveWatchSheet` | Live watch upsell | sheet | RISE ✅ b2 |
| `app/_components/app-store/choose-plan-sheet.tsx` · `ChoosePlanSheet` (Live Studio control) | choose a plan | dialog | RISE ✅ b2 |
| `dashboard/[eventId]/website/_components/apply-pro-sheet.tsx` | "Unlock Pro and Apply" | dialog (z-90, in the Maker) | RISE — b4 (layer check first) |
| `app/_components/anon-gate/save-to-continue.tsx` | an anonymous save | dialog | stays (one ask) |

## C · Home, account pages and the avatar sheet

Avatar sheet: `app/_components/account-switcher/account-switcher.tsx` · `SwitcherPanelBody` (own portal; bottom sheet on a
phone, left drawer on a desk). Supplier rows from `vendor-dashboard/_components/supplier-avatar-rows.ts`
(`supplierAvatarRows`, `scopedMemberAvatarRows`). Every row today closes the sheet and **jumps** to a page.

| row · key | href | today | target |
|---|---|---|---|
| Your details · `details` | `/vendor-dashboard/profile` | jump | RISE ✅ b3 |
| Your page · `page` | `/vendor-dashboard/website` | jump | RISE ✅ b3 |
| Helpers · `helpers` | `/vendor-dashboard/team` | jump | RISE ✅ b3 |
| Plan · `plan` | `/vendor-dashboard/subscription` | jump | RISE ✅ b3 |
| Settings · `settings` | `/vendor-dashboard/settings` | jump | RISE ✅ b3 |
| Billing & receipts · `data-sheet-row="billing"` | `/dashboard/billing` | jump | RISE — b3 |
| cover "Profile & settings ›" | `/dashboard/profile` | jump | RISE — b3 |
| Help tile | `/help` · `/vendor-dashboard/help` | jump | RISE — b3 |
| Your events · Shop row · View page ↗ · Setnayan HQ · Create your shop | navigation | jump | **stays** (a place, not a view) |
| Appearance · Other accounts · Add account · Sign out · Show me around | inline / form / tour | — | stays |

| file · symbol | trigger | today | target |
|---|---|---|---|
| `dashboard/(launcher)/@modal/(.)create-event` · `InterceptedCreateEvent` → `create-event-panel.tsx` `<SidePanel` | + New event | side panel | RISE — b5 |
| `dashboard/(launcher)/_components/home-profile.tsx` · profile header links | name / photo / page | jump | RISE (with the Profile row) — b3 |
| `dashboard/(launcher)/_components/event-card-menu.tsx` · `RemoveDialog` | event card ⋯ / remove | dialog | stays (confirm) |
| `dashboard/(account)/settings/_components/settings-view.tsx` (supplier `vendor-dashboard/settings/settings-view.tsx`) · `<Link href>` rows | Settings rows | jump | RISE inside the risen Settings is a SECOND level → they open in place (Fold) — b3 |
| `dashboard/(account)/profile/page.tsx` · concierge / api-keys links | profile rows | jump | in place inside the risen Profile — b3 |
| `dashboard/(account)/people/_components/people-roster-view.tsx` · `GuestPopup` | a person | popup | RISE — b5 |
| `dashboard/(account)/create-event/_components/ask-for-event-type.tsx` | "Can't find yours?" | sheet | stays |
| `dashboard/(account)/samahan/…/samahan-stories.tsx` · `group-collage.tsx` · `life-flash/_components/flash.tsx` | story / collage / flash | full-screen dialog | full |

## D · Couple dashboard (`app/dashboard/[eventId]/**`)

| file · symbol | trigger | today | target |
|---|---|---|---|
| `vendors/_components/supplier-sheet.tsx` · `<Sheet wide rise>` | a supplier / service card on Find | sheet | **RISE** (the full service card) — b5 |
| `vendors/_components/find-inspiration.tsx` · `<Sheet full rise>` | Find › Inspiration | sheet (full height) | RISE — b5 |
| `vendors/_components/pay-sheet.tsx` | Pay a booked supplier | sheet | RISE — b5 |
| `vendors/[vendorId]/workspace/_components/couple-photo-approvals-sheet.tsx` | photo approvals line | sheet | RISE — b5 |
| `_components/new-manual-vendor-modal.tsx` · `<Sheet rise page>` | Add a supplier manually | sheet (page) | RISE — b5 |
| `_components/add-your-own-walk.tsx` · `AddYourOwnWalk` | first own-supplier add | sheet (4 steps) | RISE — b5 |
| `schedule/_components/schedule-sheet.tsx` · `<Sheet wide rise>` | add/edit on Booked › Schedule | sheet | RISE — b5 |
| `schedule/_components/day-sheets.tsx` (shift, requests) | Event Day rail | sheet | RISE — b5 |
| `schedule/_components/day-rail.tsx` host/MC `<Sheet wide rise>` | rail host | sheet | RISE — b5 (the "more" menu stays) |
| `schedule/_components/moment-sheets.tsx` | a moment and its tasks | sheet | RISE — b5 |
| `schedule/_components/emcee-script-button.tsx` | Generate emcee script | dialog | RISE — b5 |
| `website/our-story/_components/moment-sheet-studio.tsx` | Love Story add/edit | sheet | RISE — b5 |
| `website/_components/hub-history-sheet.tsx` | ↺ history | dialog | RISE — b5 |
| `sponsors/_components/invitation-template-modal.tsx` | template preview | dialog | RISE — b5 |
| `guests/_components/guest-seat-preview.tsx` · `<Sheet full rise>` | a guest's seat | sheet (full height) | RISE — b5 |
| `studio/papic/_components/source-row.tsx` (settings surface) | Papic source rows | sheet | RISE — b5 |
| `launch/_components/studio-wish-sheet.tsx` | wish list item | sheet | RISE — b5 |
| `vendors/[vendorId]/workspace/_components/picked-supplier-shell.tsx` · `PickedShell` | booked supplier | full (picked) | full |
| `vendors/_components/services-takeover.tsx` · `category-search-overlay.tsx` · `launch/_components/theme-preview-overlay.tsx` | Suppliers / search / theme | full screen | full |
| `details/_components/record-field-sheet.tsx` (@field intercept) | an Event Details row | sheet | stays (one field) |
| `vendors/_components/{find-services-sheet,fact-sheets,booked-where,booked-count-rule,shortlist-categories,accordion-build,lock-milestone,cancel-booking-button,plan-budget-accordion,own-pay-ways}.tsx` | pickers · asks · confirms | sheet / dialog | stays |
| `_components/{connect-supplier-modal,coordinator-level-ask,mood-board-asks,home-parts,vendor-direct-pay,cohost-welcome,inline-checkout-drawer}.tsx` · `home-cards/hub-pick-button.tsx` · `guest-setup/guest-setup-rows.tsx` | asks · pickers · checkout | sheet / popup | stays |
| `budget/_components/budget-sheets.tsx` | per-row editors | sheet | stays |
| `schedule/_components/{chapter-sheets,announce-button}.tsx` · chapters-host Delete?/Move? | forms · confirms · composer | sheet | stays |
| `messages/_components/chat-inbox.tsx` | compose a chat | sheet | stays (picker) |
| `launch/_components/{studio-prints-carousel,print-guest-sheet}.tsx` · Maker internals (stage-*, details-march*, add-part-sheet, maker-*) | Maker tools | sheet / dialog | stays (the Maker is its own full view) |
| `seating/_components/seating-editor.tsx` asks · `seating/lab/_components/accents-sheet.tsx` | seat plan asks | sheet | stays |
| `studio/papic/_components/{setting-row,challenge-add-sheet,papic-buy-sheet}.tsx` · mood-board pickers · patiktok `tag-sheet` | one choice · forms · buy | sheet | stays |
| `guests/_components/guest-popup.tsx` family (add, quick add, delete, reset, ⋯) · `sent-or-not-yet.tsx` · `send/_components/send-run.tsx` | forms · confirms | popup | stays |
| `details/_components/ask-the-hosts.tsx` · `sponsors/_components/{add,edit}-sponsor-modal.tsx` · `invitation/_components/{guest-invite-modal,reissue-qr-button}.tsx` | asks · forms | sheet / dialog | stays |

## E · Supplier dashboard (`app/vendor-dashboard/**`)

| file · symbol | trigger | today | target |
|---|---|---|---|
| `_components/supplier-open-row.tsx` · `SupplierOpenRow` (`Fold rises`) | overview / roster rows | rise | rise |
| `packages/…/package-editor.tsx` · `offers/…/offer-maker.tsx` · `performance/…/graph-tile.tsx` · `shop/…/{shop-badge-row,shop-cover,shop-makers}.tsx` · `collections/…/{portfolio-sections,collections-list}.tsx` · `subscription/…/limits-sheet.tsx` | editors · tiles · cover doors | rise | rise |
| `clients/[eventId]/_components/picked-client-shell.tsx` · `PickedShell` | a client row (and the @client intercepts) | full (picked) | full |
| `offers/_components/offer-editor.tsx` | an offer row | dialog (own "rise", not `RiseScreen`) | RISE — b4 |
| `_components/body-panel.tsx` · `BodyPanel` | Shop › Makers row | own fixed overlay | RISE — b4 |
| `collections/_components/portfolio-groups.tsx` (video) | play a video | sheet | RISE — b5 |
| `_components/setup-offer-fold.tsx` · "New service" | + new service in setup | sheet | RISE — b5 |
| `_components/supplier-setup-folds.tsx` · `SidePanel` | a setup step | side panel | RISE — b5 |
| `shop/promote/_components/shop-prints-section.tsx` · `<Sheet wide full>` | a print look | sheet (full) | RISE — b5 |
| `customers/_components/shop-wallet-sheet.tsx` | Money / wallet | sheet | RISE — b5 |
| `customers/_components/dates-sheets.tsx` · Waitlist | Waitlist | sheet | RISE — b5 (Block days / Capacity stay) |
| `clients/[eventId]/_components/event-files-board.tsx` · the viewer | open a file | sheet | inside `PickedShell` → stays a sheet (one level) |
| `messages/[threadId]/_components/chat-info-rail.tsx` · "Customer" | customer info (phone) | sheet | RISE — b5 |
| `invite/_components/qr-code-list.tsx` | a QR row | sheet | RISE — b5 |
| `forms/_components/{form-maker,form-view-sheet,forms-page-body}.tsx` | New form / a form / Load a form | sheet (page) | RISE — b5 |
| `subscription/_components/badge-upgrades-section.tsx` | Your upgrades row | sheet | RISE — b5 |
| `collections/_components/portfolio-show.tsx` | ▶ Show album | full-screen dialog | full |
| `clients/[eventId]/_components/{supplier-schedule,top-up-carry-over,day-check-line,client-refunds}.tsx` · `TopUpSettleSheet` · `quote-versions-*` | inside a picked client | sheet | stays (one level) |
| `_components/portfolio-upload.tsx` · `services/…/{service-card-share-sheet,service-card-item}.tsx` · `shop/…/shop-bundle-card.tsx` · `shop/promote/…/shop-gifts-section.tsx` · `customers/…/{money-log,outside-client-add,clients-show-sort}.tsx` · `messages/…/thread-tools-sheet.tsx` · `on-the-day/…/{crew-panel,hub-event-menu,guest-review-qr}.tsx` · `live/…/change-the-schedule.tsx` · `team/…/helpers-controls.tsx` · `bookings/…/vendor-prep-add.tsx` | uploads · shares · confirms · forms · menus | sheet / dialog | stays |
| Folds (profile details-screen, website page-parts, overview-sections, plan-rows, helpers-view, settings-view, …) | section heads | in place | stays |

## F · Admin (`app/admin/**`)

| file · symbol | trigger | today | target |
|---|---|---|---|
| `admin/categories/_components/four-level-map.tsx` · `MapDrawer` `<Sheet wide full>` | a category node | sheet (full) | RISE — b5 |
| `admin/connection-logs/connection-logs-client.tsx` · `InspectModal` | a log row | dialog | RISE — b5 |
| `admin/hub-music/hub-music-manager.tsx` (add/edit) | add/edit a track | sheet | stays (form) |
| `admin/fraud/_components/wipe-ban-dialog.tsx` · `admin/_components/admin-command-palette.tsx` · `admin/queues/_components/queue-drawer.tsx` | confirm · ⌘K · in place | dialog / in place | stays |

## G · Outside the four surfaces (not in scope; listed so nobody re-audits)

`app/_components/{terms-reaccept/terms-reaccept-sheet,chat/chat-file-swipe,frontdoor/discover-add-own,nfc-write-button,plan3d/booth-vendor-card,memories/memories-keepsake-row,top-up-settle-sheet}.tsx` ·
public pages `[slug]/…`, `v/[slug]/…`, `open-shop/…`, `panood/…`, `samahan/chat/…`. `PickMenu` dropdowns (~150 files) are
pickers and stay.

Re-measure any row: `grep -rn "<Sheet\b\|role=\"dialog\"\|<RiseScreen\|<MenuSettingsButton" apps/web/app --include=*.tsx`.

## H · Batch 3 design (the avatar rows) — measured before building

A page jump becomes a rise the way the picked client already does it: an **intercepted route**. Measured constraints:

1. **Slot.** `vendor-dashboard/layout.tsx` takes a `rise` slot: `@rise/(.)profile` · `(.)website` · `(.)team` ·
   `(.)subscription` · `(.)settings`, each re-exporting the SAME page (`export { default }` pattern of
   `customers/@client/(..)clients/[eventId]/page.tsx`) inside one client wrapper on `RiseScreen`, ✕ → `router.back()`.
   A hard load of the URL is not intercepted and draws the full page (deep links unchanged).
2. **Reset.** On a soft navigation an unmatched parallel slot KEEPS its last state, so the slot needs `@rise/page.tsx`
   and `@rise/[...catchAll]/page.tsx` returning null — or a bottom-tab tap would leave the risen page up.
3. **Two history entries.** `RiseScreen` pushes its own Back entry (`useBackCloses`) on top of the route's. ✕ / Back pop
   ours, play the fall, then `router.back()` pops the route's. A tab re-tap closes without popping ours (the wrapper
   must then NOT `router.back()`; the tab's own navigation and the catch-all clear the slot).
4. **Layer.** The avatar sheet (`account-switcher.tsx`, `z-[52]` panel over a `z-[51]` backdrop) is ABOVE the rise layer
   (`--sn-z-pop` 40). Today every row `onClick={close}`s the sheet, so the tapped row is gone before the screen mounts
   and `riseOriginNow()` finds nothing — it would appear, not rise. For "rises from the row, falls back into it" the
   sheet must stay MOUNTED (the row keeps its rect) but step aside while the rise is up, and come back on ✕.
5. **Couple side.** The same sheet is drawn on `/dashboard/*`; a soft tap there on a supplier row is outside the
   `vendor-dashboard` tree and is NOT intercepted — it stays a page jump into the supplier dashboard (a place change,
   which the rule allows).
6. **Proof.** These pages need a session and a database; a container with the dummy lab env cannot draw them. The
   mechanism is proved in `app/dev/rise-route-lab` (the shipped `SwitcherPanelBody`, rows pointed at lab pages, the same
   slot shape and `RiseRoute`): ✕ and the phone's Back both land back on the first URL with the sheet under the thumb.
   The real pages need a signed-in check by the controller.
7. **Speed (measured in the lab).** `riseOriginNow()` keeps a press for 1.5 s. A route whose PAGE is the screen rises
   only if the server answers inside that — warm 156 ms (rises), cold 1,489 ms (it simply appears). So the screen is
   each intercept's LAYOUT (it stands the moment the tap lands — 0.9 s in dev with no prefetch, the rows are prefetched
   in production) and the page, under its own `loading.tsx` skeleton, streams into the SAME screen (no second rise).
