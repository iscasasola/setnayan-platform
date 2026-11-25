# Final check · Area 3 — Couple: Maker, Event Hub page, invitations, Papic, Memories

> Checker 3 of 8. REPORT ONLY. Pinned commit `fb3f72d` (main frozen). Kit: `build-sessions/FINAL-CHECK-KIT.md` §§ 3–6.
> Phase A = code pass (`SOURCE: CODE`); phase B = browser walk on staging as `couple_maker` (`SOURCE: SEEN`).
> Seeded events for this area: **Carla & Miguel** (`stg-carla-miguel`, wedding, Event Plus PAID, public Event Hub),
> **Mika turns 7** (`stg-mika-turns-7`, birthday 30 days ago: Memories, recap), the demo event.
> Standards read: corpus `HOUSE_DESIGN_STANDARD_2026-11-20.md` (Parts D, E, F, I, K), `DARK_MODE_STANDARD_2026-11-20.md`,
> `MOTION_STANDARD_2026-11-18.md`, `docs/brand.md`.

## BLOCKERS

None found.

## Progress

Marks: **OFFLINE** NEEDED (where signal is lost) / READ-ONLY / NOT NEEDED · **SHAPE** today → should.

### Pages (59)

- [ ] /dashboard/[eventId]/alaala
- [ ] /dashboard/[eventId]/alaala/assignments
- [ ] /dashboard/[eventId]/apple-pro
- [ ] /dashboard/[eventId]/event-qr
- [ ] /dashboard/[eventId]/galleries
- [ ] /dashboard/[eventId]/guests/invite
- [ ] /dashboard/[eventId]/guests/send
- [ ] /dashboard/[eventId]/invitation
- [ ] /dashboard/[eventId]/invitation/print
- [x] /dashboard/[eventId]/launch · OFFLINE READ-ONLY (planned at home; "Go live" on the day is rare) · SHAPE PAGE → PAGE
- [ ] /dashboard/[eventId]/live
- [ ] /dashboard/[eventId]/memories
- [ ] /dashboard/[eventId]/memories/download-all
- [ ] /dashboard/[eventId]/memories/thank-you
- [ ] /dashboard/[eventId]/monogram
- [ ] /dashboard/[eventId]/pabuya
- [ ] /dashboard/[eventId]/prints
- [x] /dashboard/[eventId]/story · OFFLINE READ-ONLY · SHAPE PAGE → PAGE
- [ ] /dashboard/[eventId]/studio/about/[addon]
- [ ] /dashboard/[eventId]/studio/guest-columns
- [ ] /dashboard/[eventId]/studio/live-studio-control
- [ ] /dashboard/[eventId]/studio/live-studio-control/setup
- [ ] /dashboard/[eventId]/studio/mood-board
- [ ] /dashboard/[eventId]/studio/pakanta
- [ ] /dashboard/[eventId]/studio/panood
- [ ] /dashboard/[eventId]/studio/panood/broadcast
- [ ] /dashboard/[eventId]/studio/panood/cameras
- [ ] /dashboard/[eventId]/studio/panood/cameras/print
- [ ] /dashboard/[eventId]/studio/panood/setup
- [ ] /dashboard/[eventId]/studio/papic/challenges
- [ ] /dashboard/[eventId]/studio/papic/crew
- [ ] /dashboard/[eventId]/studio/papic/crew/poster
- [ ] /dashboard/[eventId]/studio/papic/moderation
- [ ] /dashboard/[eventId]/studio/papic/recap
- [ ] /dashboard/[eventId]/studio/papic/run-of-show
- [ ] /dashboard/[eventId]/studio/patiktok
- [ ] /dashboard/[eventId]/studio/patiktok/[templateId]
- [ ] /dashboard/[eventId]/studio/patiktok/booth
- [ ] /dashboard/[eventId]/studio/photo-delivery
- [ ] /dashboard/[eventId]/studio/playlist
- [ ] /dashboard/[eventId]/studio/save-the-date
- [ ] /dashboard/[eventId]/studio/save-the-date/stamp
- [ ] /dashboard/[eventId]/studio/setnayan-ai
- [ ] /dashboard/[eventId]/studio/website-pro
- [x] /dashboard/[eventId]/website/editor · OFFLINE READ-ONLY · SHAPE forward into the Maker (`/launch?…&open=…`) → keep; `open=colors` opens Look, `special-message` and `what-to-bring` (Reminders) open their rows
- [x] /dashboard/[eventId]/website/hero-photo · OFFLINE NOT NEEDED (an upload; I disagree with read-only: a saved copy does nothing) · SHAPE PAGE → FULL-SCREEN POPUP (differs)
- [x] /dashboard/[eventId]/website/living-hero · OFFLINE NOT NEEDED (a video upload) · SHAPE PAGE → FULL-SCREEN POPUP (differs)
- [x] /dashboard/[eventId]/website/our-photos · OFFLINE NOT NEEDED (an upload) · SHAPE PAGE → FULL-SCREEN POPUP (differs)
- [ ] /dashboard/[eventId]/website/our-story
- [ ] /dashboard/[eventId]/website/photo-moments
- [ ] /dashboard/[eventId]/website/privacy
- [ ] /dashboard/[eventId]/website/site-chrome
- [ ] /dashboard/[eventId]/website/stories
- [ ] /dashboard/[eventId]/website/widgets
- [ ] /dashboard/creator
- [ ] /dashboard/library
- [ ] /dashboard/life-flash
- [ ] /panood/control/[eventId]
- [ ] /panood/program/[eventId]

### Forwards (13)

- [x] /dashboard/[eventId]/event-page → […] · lands on the guest Event Hub `/[slug]` for a couple (no slug → `/launch`); a coordinator or a failed read gets a 404 (F-01) · OFFLINE n/a · SHAPE forward
- [x] /dashboard/[eventId]/studio/[addon] → /dashboard/[…]/[…] · lands: `monogram-creator`→`/monogram`, `landing-page`→`/website`→`/launch` (2 hops), `music-creator`→`/studio/pakanta`, `orders`→`/orders`, `supplies-marketplace`→`/studio`→More menu (middleware, 2 hops), `rsvp`/`event`/`editorial`→`/website/editor`; any other value 404 · OFFLINE n/a · SHAPE forward
- [x] /dashboard/[eventId]/studio/indoor-blueprint → /dashboard/[…] · lands on `/guests?gview=seats&seat=map` (`guestsViewHref`), or `/dashboard/[eventId]` when the event type has no seating · OFFLINE n/a · SHAPE forward
- [x] /dashboard/[eventId]/studio/papic/crew/print → /dashboard/[…]/studio/papic/crew/poster · lands · OFFLINE n/a · SHAPE forward
- [x] /dashboard/[eventId]/website → /dashboard/[…]/launch · lands · OFFLINE n/a · SHAPE forward
- [x] /dashboard/[eventId]/website/colors → /dashboard/[…]/website/editor?open=colors · lands (the `open` value is checked under the editor page) · OFFLINE n/a · SHAPE forward
- [x] /dashboard/[eventId]/website/editorial → /dashboard/[…]/story · lands · OFFLINE n/a · SHAPE forward
- [x] /dashboard/[eventId]/website/special-message → /dashboard/[…]/website/editor?open=special-message · lands (the `open` value is checked under the editor page) · OFFLINE n/a · SHAPE forward
- [x] /dashboard/[eventId]/website/what-to-bring → /dashboard/[…]/website/editor?open=what-to-bring · lands (the `open` value is checked under the editor page) · OFFLINE n/a · SHAPE forward
- [x] /site-editor/[eventId] → /dashboard/[…]/website/editor · lands · OFFLINE n/a · SHAPE forward
- [x] /site-editor/[eventId]/editorial → /dashboard/[…]/website/editor · lands · OFFLINE n/a · SHAPE forward
- [x] /site-editor/[eventId]/event → /dashboard/[…]/website/editor · lands · OFFLINE n/a · SHAPE forward
- [x] /site-editor/[eventId]/rsvp → /dashboard/[…]/website/editor · lands · OFFLINE n/a · SHAPE forward

## Findings

_Format: kit § 6 plus `SOURCE`. Phase A findings are `SOURCE: CODE` until the browser pass confirms or strikes them._

### Area-wide

#### A-01 · Dark mode reaches only 3 of the 59 area-3 pages; the rest stay light when a person picks Dark

```
PAGE      every area-3 page except /dashboard/[eventId]/memories, /dashboard/library and /dashboard/life-flash
BUTTON    Preferences › Appearance › Dark
STEPS     1. As couple_maker, choose Dark. 2. Open the Maker, the Event Hub editor, any Studio page, Papic, Panood.
EXPECTED  K2: every signed-in screen is dark with the top block's glow (kit §5.6–7).
ACTUAL    By design they paint light: `DARK_READY` lists only `/dashboard/*/memories$`, `/dashboard/library` and
          `/dashboard/life-flash` from this area ("the Maker, the Studio, the website editor … STAYS LIGHT until it is
          swept and walked"). Not a per-page finding; one note so the controller decides whether the dark sweep of
          area 3 is in scope for the fix round. Phase B checks the 3 listed pages in dark.
WHERE     apps/web/lib/appearance.ts · `DARK_READY`
SHOTS     375 px dark (Maker, editor, Studio) beside Memories
RULE      HOUSE_DESIGN_STANDARD Part K2 · DARK_MODE_STANDARD §5
SEVERITY  look
SOURCE    CODE
```

### Forwards

#### F-01 · The "event page" forward gives a coordinator, and a failed read, a 404

```
PAGE      /dashboard/[eventId]/event-page   (event: stg-carla-miguel; sign in as coordinator for the 404)
BUTTON    the address itself (help-ask "invitations" place opens it: `help-ask-places.ts` `invitations: { path: 'event-page' }`)
STEPS     1. As a coordinator seated on the event (or a couple whose membership read fails), open /dashboard/[eventId]/event-page.
EXPECTED  The guest Event Hub `/[slug]` opens (it is public), or a failure says the read failed.
ACTUAL    `if (!membership || membership.member_type !== 'couple') notFound();` — a coordinator (`member_type 'coordinator'`)
          and any refused `event_members` read (logged `graceful_degrade`, then `membership` is null) both get a 404.
WHERE     apps/web/app/dashboard/[eventId]/event-page/page.tsx · `HostEventPageRedirect`
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 (honest states: a failed read is not "not found") · kit §5.2 (no link to a 404)
SEVERITY  wrong
SOURCE    CODE
```

### Event Hub page and editor (launch · story · editor · hero-photo · living-hero · our-photos)

#### E-01 · Saves that fail still land as saved (hero photo, Which version guests see, backdrop, last word)

```
PAGE      /dashboard/[eventId]/launch, /dashboard/[eventId]/website/hero-photo, /dashboard/[eventId]/story   (event: stg-carla-miguel)
BUTTON    "Save photo" / "Remove" (hero) · ⚙ "Which version guests see" ▾ · "Invitation backdrop" Save / Turn off · "Your last word" Save
STEPS     1. Make the write fail (RLS refusal, timeout). 2. Press the save.
EXPECTED  The control goes back and says "That did not save. Nothing changed — please try again."
ACTUAL    The update's `error` is never read, then the action lands as done: `await supabase.from('events').update({ landing_page_hero_image_url … })` → `return landAfterWrite(…)`; setOpenBrowse `const { data: event } = await supabase.from('events').update({ website_open_browse … })` and the Maker passes `{ ok: () => true }`; story `await session.from('events').update({ special_message … })` then `{ ok: true }`.
WHERE     apps/web/app/dashboard/[eventId]/website/hero-photo/actions.ts `uploadHeroPhoto`, `removeHeroPhoto` · website/editor/actions.ts `setOpenBrowse`, `saveRsvpBackdrop`, `clearRsvpBackdrop` · launch/_components/studio-tools.tsx `pickVersion` · story/actions.ts `saveEditorial` (all listed in lib/supabase-unread-error.baseline.txt)
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 (honest states) · design-and-wiring B6
SEVERITY  broken
SOURCE    CODE
```

#### E-02 · Our photos (draft path) drops a blocked or unreadable photo without a word

```
PAGE      /dashboard/[eventId]/website/our-photos   (event: stg-mika-turns-7, no Pro → draft)
BUTTON    "Save photos"
STEPS     1. Add a photo the screen blocks or cannot read. 2. Save.
EXPECTED  "One photo couldn't be added…", as on the live path.
ACTUAL    `if (drafting) { return draftEventsAndReturn(…) }` returns before the note; the person sees only "Saved in your Event Hub draft."
WHERE     apps/web/app/dashboard/[eventId]/website/our-photos/actions.ts (the `drafting` branch before the blocked-photo note)
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4
SEVERITY  broken
SOURCE    CODE
```

#### E-03 · The Event Pro price vanishes when the catalogue read fails

```
PAGE      /dashboard/[eventId]/launch   (event: stg-mika-turns-7, no Pro)
BUTTON    "Event Pro · ₱…" offer · "Unlock Event Pro · ₱…"
STEPS     1. Open the Maker on an event without Pro while the catalogue read fails.
EXPECTED  "Couldn't read" where the price goes.
ACTUAL    `formatV2Sku('COUPLE_WEBSITE_PRO').catch(() => null)` then `Event Pro{priceLabel ? … : ''}` — the price silently disappears and the button reads as if it had none.
WHERE     apps/web/app/dashboard/[eventId]/launch/_components/hub-pro-offer.tsx · website/editor/_components/unlock-label.ts `unlockLabel` · launch/page.tsx `proPriceLabel`
SHOTS     375 px light
RULE      CLAUDE.md §1 (a failed read shows "Couldn't read") · design-and-wiring B7
SEVERITY  money-signin
SOURCE    CODE
```

#### E-04 · The Event Hub lock names two different plans and shows no price

```
PAGE      /dashboard/[eventId]/website/hero-photo, /living-hero, /our-photos   (event: stg-mika-turns-7)
BUTTON    🔒 "Part of {plan}" · "Unlock {plan}"
STEPS     1. Open any of the three on an event without the part.
EXPECTED  One plan name from the catalogue, its price, one button (Problem → Solution → preview → price).
ACTUAL    Heading and button read `everythingTitle ?? PLAN_NAME.plus` (Event Plus) while the line says "It's part of Event Pro." and the Maker sells Event Pro; our-photos shows a "PLUS" mark with text "Pro". No price on the lock.
WHERE     apps/web/app/dashboard/[eventId]/website/_components/website-pro-lock.tsx (`planName`) · our-photos/page.tsx (PaidMark) · living-hero/actions.ts
SHOTS     375 px light
RULE      design-and-wiring B7 (honest locks) · CLAUDE.md §1 plans
SEVERITY  money-signin
SOURCE    CODE
```

#### E-05 · Failed reads draw as "nothing here" (scenes, chapters, our-photos)

```
PAGE      /dashboard/[eventId]/website/editor (Maker), /dashboard/[eventId]/story, /dashboard/[eventId]/website/our-photos
BUTTON    Scene list "0 showing" · "As the Day Unfolded" panel · page load
STEPS     1. Open each with its read failing.
EXPECTED  A "Couldn't read" state.
ACTUAL    editor: error only logged, then `liveWidgets = (widgetsRaw ?? [])` → `todo('0 showing')`; story: `catch { chapterCards = { cards: [], overrides: [] } }` hides the panel; our-photos: `const { data: event }` (error unread) then `redirect(/dashboard/${eventId})` with no word.
WHERE     website/editor/page.tsx (`widgetsRaw`) · story/page.tsx (`chapterCards`, `desk = null`) · website/our-photos/page.tsx
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4
SEVERITY  wrong
SOURCE    CODE
```

#### E-06 · "site", "wedding page" and "monogram" in visible text

```
PAGE      /dashboard/[eventId]/launch, /story, /website/editor, /website/hero-photo, /website/living-hero
BUTTON    labels, tips, success lines
STEPS     1. Read the Maker Logo motion lock, cover lines, camera tip; Story cover step; editor rows; hero tip; living-hero success.
EXPECTED  "Event Hub" and "Logo Maker"/"logo"; the event's own word on a birthday.
ACTUAL    "the Animated Monogram" (aria label) · "the monogram" · "your monogram on the saved photos" · "The one on your site now" · "the picture from your site" · `source: 'Monogram'` · "Your names and your monogram" · "What appears on your site, and in what order." · "…so your monogram and countdown stay readable" · "Saved. Your wedding page now leads with it." · "You don't have access to this wedding." (on a birthday)
WHERE     launch/_components/maker-logo.tsx (`paidMarkLabel`), stage-tools.tsx, stage-panel/camera-face.tsx · story/_lib/load-cover-candidates.ts, story/_components/cover-step.tsx, whats-next-step.tsx · website/editor/page.tsx ("Show, hide & reorder" blurb) · website/hero-photo/page.tsx (Tip) · website/living-hero/_components/living-hero-studio.tsx, living-hero/actions.ts
SHOTS     375 px light
RULE      brand.md word rules
SEVERITY  wrong
SOURCE    CODE
```

#### E-07 · Maker layers that do not use the shared overlay (no dim/blur/lock)

```
PAGE      /dashboard/[eventId]/launch (also the editor shell)
BUTTON    Section list ▾ · scene "Move up/down" menu · "Not walking — everyone" tray · lower-third Menu · Maker part sheet
STEPS     1. Open each layer. 2. Try to scroll or tap the page behind.
EXPECTED  Sheet/PickMenu with the one backdrop; the page behind dimmed, blurred and inert.
ACTUAL    plain absolute `role="menu"` with no backdrop (sheet-sections.tsx; editor-shell.tsx `sn-glass-bare absolute`); a `fixed inset-0` `role="dialog"` with OverlayBackdrop but no useModalA11y (details-march-tray.tsx); a hand-built sheet with its own `sn-popup-dark` (stages-studio-parts.tsx); a `bg-white` absolute menu (maker-lower-third.tsx)
WHERE     launch/_components/{sheet-sections,details-march-tray,stages-studio-parts,maker-lower-third}.tsx · website/editor/_components/editor-shell.tsx
SHOTS     375 px light
RULE      HOUSE_DESIGN_STANDARD Part K3
SEVERITY  look
SOURCE    CODE
```

#### E-08 · Motion and legacy pieces: switches slide `left`, autoplay video ignores reduced motion, legacy button

```
PAGE      /dashboard/[eventId]/story, /website/living-hero, /website/our-photos
BUTTON    section switches · hero videos · progress bar · "Save photos"
STEPS     1. Flip a Story switch. 2. Open living-hero with reduced motion on. 3. Look at our-photos.
EXPECTED  transform/opacity only; autoplay loops respect reduced motion; ActionButton and token colours.
ACTUAL    story knob `transition-all … left-[22px]`; living-hero `<video autoPlay muted loop>` with no reduced-motion check, progress `transition-all` on `width`; our-photos `className="button-primary"`, `bg-red-50 text-red-800`, no back link, `MAX_PHOTOS = 24` typed in page and action
WHERE     story/_components/editorial-editor.tsx · living-hero/_components/living-hero-studio.tsx · our-photos/page.tsx, our-photos/actions.ts
SHOTS     375 px light
RULE      MOTION_STANDARD E2 · CLAUDE.md §3 (Button, Colour) · design-and-wiring D12–D13
SEVERITY  look
SOURCE    CODE
```

#### E-09 · Editor sub-pages are their own addresses; they should rise over the Maker

```
PAGE      /dashboard/[eventId]/website/hero-photo, /website/living-hero, /website/our-photos
BUTTON    the page itself
STEPS     1. From the Maker, open Hero photo / Make it move / Our photos.
EXPECTED  FULL-SCREEN POPUP (photo/video, nobody shares it): rises over the Maker, ✕ returns to the same row.
ACTUAL    Each is a separate page with a "Back to Event Hub" link (our-photos has none); hand-typed `text-[15px]`, `text-[13px]`.
WHERE     website/hero-photo/page.tsx · website/living-hero/page.tsx · website/our-photos/page.tsx
SHOTS     375 px light
RULE      SHAPE
SEVERITY  look
SOURCE    CODE
```
