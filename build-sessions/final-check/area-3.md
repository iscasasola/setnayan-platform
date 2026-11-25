# Final check · Area 3 — Couple: Maker, Event Hub page, invitations, Papic, Memories

> Checker 3 of 8. REPORT ONLY. Pinned commit `fb3f72d` (main frozen). Kit: `build-sessions/FINAL-CHECK-KIT.md` §§ 3–6.
> Phase A = code pass (`SOURCE: CODE`); phase B = browser walk on staging as `couple_maker` (`SOURCE: SEEN`).
> Seeded events for this area: **Carla & Miguel** (`stg-carla-miguel`, wedding, Event Plus PAID, public Event Hub),
> **Mika turns 7** (`stg-mika-turns-7`, birthday 30 days ago: Memories, recap), the demo event.
> Standards read: corpus `HOUSE_DESIGN_STANDARD_2026-11-20.md` (Parts D, E, F, I, K), `DARK_MODE_STANDARD_2026-11-20.md`,
> `MOTION_STANDARD_2026-11-18.md`, `docs/brand.md`.

## BLOCKERS

#### B-01 · Story Assignments can never assign anyone: the guest read filters on an RSVP value that does not exist

```
PAGE      /dashboard/[eventId]/alaala/assignments   (event: stg-carla-miguel)
BUTTON    "Pick a guest…" / "Assign" on every moment
STEPS     1. Open Memories › Guest Stories (`/alaala`) › "Manage assignments". 2. Open any moment's guest picker.
EXPECTED  The attending guests are listed and a guest can be assigned to a moment.
ACTUAL    `.eq('rsvp_status', 'confirmed')` — the `rsvp_status` enum is `'pending', 'attending', 'declined', 'maybe'` (no `confirmed`; no migration adds it), so Postgres rejects the query. `guestsError` is logged as graceful_degrade and `(guests ?? [])` makes every moment say "No guests to assign". The whole assignment flow stops for every event. It also re-filters guests instead of `countsTowardEvent`.
WHERE     apps/web/app/dashboard/[eventId]/alaala/assignments/page.tsx (the `guests` read, `guestsError`) · _components/assignment-controls.tsx `GuestPicker` · supabase/migrations/20260513010000_iteration_0001_guests.sql (`rsvp_status` enum)
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 (honest states) · design-and-wiring C8 (headcount reader)
SEVERITY  blocker
SOURCE    CODE
```


## Progress

Marks: **OFFLINE** NEEDED (where signal is lost) / READ-ONLY / NOT NEEDED · **SHAPE** today → should.

### Pages (59)

- [x] /dashboard/[eventId]/alaala · OFFLINE READ-ONLY · SHAPE PAGE → PAGE
- [x] /dashboard/[eventId]/alaala/assignments · OFFLINE NOT NEEDED · SHAPE PAGE → FULL-SCREEN POPUP (differs) · BLOCKER B-01
- [x] /dashboard/[eventId]/apple-pro · OFFLINE NOT NEEDED (App Store purchase) · SHAPE PAGE → FULL-SCREEN POPUP (differs, unsure: a page today to keep StoreKit off the Maker's first load)
- [ ] /dashboard/[eventId]/event-qr
- [x] /dashboard/[eventId]/galleries · OFFLINE READ-ONLY · SHAPE PAGE → PAGE
- [ ] /dashboard/[eventId]/guests/invite
- [ ] /dashboard/[eventId]/guests/send
- [ ] /dashboard/[eventId]/invitation
- [ ] /dashboard/[eventId]/invitation/print
- [x] /dashboard/[eventId]/launch · OFFLINE READ-ONLY (planned at home; "Go live" on the day is rare) · SHAPE PAGE → PAGE
- [x] /dashboard/[eventId]/live · OFFLINE NEEDED (at the venue on the day: hiding a photo mid-party; disagree with read-only) · SHAPE PAGE → PAGE
- [x] /dashboard/[eventId]/memories · OFFLINE READ-ONLY (mild disagreement: the Papic on/off switch is used at the venue) · SHAPE PAGE → PAGE
- [x] /dashboard/[eventId]/memories/download-all · OFFLINE NOT NEEDED · SHAPE PAGE → PAGE
- [x] /dashboard/[eventId]/memories/thank-you · OFFLINE NOT NEEDED · SHAPE PAGE → PAGE
- [ ] /dashboard/[eventId]/monogram
- [ ] /dashboard/[eventId]/pabuya
- [x] /dashboard/[eventId]/prints · OFFLINE READ-ONLY · SHAPE PAGE → PAGE
- [x] /dashboard/[eventId]/story · OFFLINE READ-ONLY · SHAPE PAGE → PAGE
- [ ] /dashboard/[eventId]/studio/about/[addon]
- [ ] /dashboard/[eventId]/studio/guest-columns
- [x] /dashboard/[eventId]/studio/live-studio-control · OFFLINE READ-ONLY · SHAPE PAGE → PAGE
- [x] /dashboard/[eventId]/studio/live-studio-control/setup · OFFLINE NOT NEEDED · SHAPE forward (to `/panood/control/[eventId]`; 404 when `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` is off; Ugat marks it no-door) → list as a forward
- [ ] /dashboard/[eventId]/studio/mood-board
- [ ] /dashboard/[eventId]/studio/pakanta
- [x] /dashboard/[eventId]/studio/panood · OFFLINE NOT NEEDED · SHAPE forward (to live-studio-control, or `/studio/panood/setup` with the flag off)
- [x] /dashboard/[eventId]/studio/panood/broadcast · OFFLINE NEEDED with the flag off (old day-of control room at the venue) · SHAPE PAGE → PAGE (forward to `/panood/control` with the flag on)
- [x] /dashboard/[eventId]/studio/panood/cameras · OFFLINE READ-ONLY · SHAPE PAGE → PAGE (with the flag on its only doors are in the old control room)
- [x] /dashboard/[eventId]/studio/panood/cameras/print · OFFLINE READ-ONLY · SHAPE PAGE → PAGE (print)
- [x] /dashboard/[eventId]/studio/panood/setup · OFFLINE NEEDED with the flag off (Go live / End at the venue), else READ-ONLY · SHAPE PAGE → PAGE
- [x] /dashboard/[eventId]/studio/papic/challenges · OFFLINE NEEDED (at the venue on the day: "Ask now"/"Stop" run live; disagree with read-only) · SHAPE PAGE → PAGE (no working door: P-02)
- [x] /dashboard/[eventId]/studio/papic/crew · OFFLINE READ-ONLY · SHAPE PAGE → SMALL POPUP (differs; one QR + Copy + Print, duplicate of Event Details › How guests get in)
- [x] /dashboard/[eventId]/studio/papic/crew/poster · OFFLINE READ-ONLY · SHAPE PAGE → PAGE (print)
- [x] /dashboard/[eventId]/studio/papic/moderation · OFFLINE READ-ONLY · SHAPE PAGE → folded into the Memories photo sheet (differs; owner 23 Oct)
- [x] /dashboard/[eventId]/studio/papic/recap · OFFLINE READ-ONLY · SHAPE PAGE → PAGE
- [x] /dashboard/[eventId]/studio/papic/run-of-show · OFFLINE NEEDED (coordinator at the venue: "This is happening now", Pause) · SHAPE PAGE → PAGE (no working door: P-02)
- [ ] /dashboard/[eventId]/studio/patiktok
- [ ] /dashboard/[eventId]/studio/patiktok/[templateId]
- [ ] /dashboard/[eventId]/studio/patiktok/booth
- [x] /dashboard/[eventId]/studio/photo-delivery · OFFLINE NOT NEEDED (OAuth + Drive; disagree with read-only) · SHAPE PAGE → PAGE
- [ ] /dashboard/[eventId]/studio/playlist
- [ ] /dashboard/[eventId]/studio/save-the-date
- [ ] /dashboard/[eventId]/studio/save-the-date/stamp
- [ ] /dashboard/[eventId]/studio/setnayan-ai
- [x] /dashboard/[eventId]/studio/website-pro · OFFLINE NOT NEEDED (buying needs signal; a saved price list could mislead) · SHAPE PAGE → PAGE
- [x] /dashboard/[eventId]/website/editor · OFFLINE READ-ONLY · SHAPE forward into the Maker (`/launch?…&open=…`) → keep; `open=colors` opens Look, `special-message` and `what-to-bring` (Reminders) open their rows
- [x] /dashboard/[eventId]/website/hero-photo · OFFLINE NOT NEEDED (an upload; I disagree with read-only: a saved copy does nothing) · SHAPE PAGE → FULL-SCREEN POPUP (differs)
- [x] /dashboard/[eventId]/website/living-hero · OFFLINE NOT NEEDED (a video upload) · SHAPE PAGE → FULL-SCREEN POPUP (differs)
- [x] /dashboard/[eventId]/website/our-photos · OFFLINE NOT NEEDED (an upload) · SHAPE PAGE → FULL-SCREEN POPUP (differs)
- [x] /dashboard/[eventId]/website/our-story · OFFLINE READ-ONLY · SHAPE PAGE → FULL-SCREEN POPUP (differs; weddings already forward into the Maker; a birthday has no visible door)
- [x] /dashboard/[eventId]/website/photo-moments · OFFLINE READ-ONLY · SHAPE PAGE → FULL-SCREEN POPUP (differs)
- [x] /dashboard/[eventId]/website/privacy · OFFLINE READ-ONLY (disagree in part: "Who can watch on the day" is pressed at the venue) · SHAPE PAGE → FULL-SCREEN POPUP (differs)
- [x] /dashboard/[eventId]/website/site-chrome · OFFLINE READ-ONLY · SHAPE PAGE → FULL-SCREEN POPUP (differs; video upload)
- [x] /dashboard/[eventId]/website/stories · OFFLINE READ-ONLY · SHAPE PAGE → FULL-SCREEN POPUP (differs)
- [x] /dashboard/[eventId]/website/widgets · OFFLINE READ-ONLY · SHAPE PAGE → FULL-SCREEN POPUP (differs)
- [ ] /dashboard/creator
- [x] /dashboard/library · OFFLINE READ-ONLY · SHAPE forward to `/dashboard?seg=memories` (Home section) → keep
- [x] /dashboard/life-flash · OFFLINE READ-ONLY · SHAPE PAGE → PAGE (its player is a hand-built full-screen layer; should be RiseScreen)
- [x] /panood/control/[eventId] · OFFLINE NEEDED (host/coordinator at the venue on the day; a read-only copy is NOT enough for a live control: every tap is a form POST + redirect with ~15 reads, no queue, no offline sign) · SHAPE PAGE → PAGE; its Setup half-sheet should be a FULL-SCREEN POPUP (differs)
- [x] /panood/program/[eventId] · OFFLINE NEEDED (second window captured by OBS at the venue; re-attaches every 2 s) · SHAPE PAGE → PAGE

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

### Event Hub editor sub-pages (our-story · photo-moments · privacy · site-chrome · stories · widgets · website-pro)

#### E-10 · Saving the story words after a failed read wipes the couple's moments

```
PAGE      /dashboard/[eventId]/website/our-story   (event: stg-mika-turns-7)
BUTTON    "Save our story"
STEPS     1. The read of `events.love_story` fails. 2. Press Save our story.
EXPECTED  The save refuses ("Couldn't read your story"); nothing is overwritten.
ACTUAL    `const { data: current } = await supabase.from('events').select('love_story')` — error unread; `mergeStoryWords(base, …)` then starts from nothing, so the written blob drops `moments` and every key the form does not carry.
WHERE     apps/web/app/dashboard/[eventId]/website/our-story/actions.ts `updateOurStory` · lib/love-story-words.ts `mergeStoryWords`
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 (a failed read never acts as empty)
SEVERITY  broken
SOURCE    CODE
```

#### E-11 · Photo moments and widget toggles say "Saved" when the write changed no row

```
PAGE      /dashboard/[eventId]/website/photo-moments, /website/widgets   (sign in as a non-couple member)
BUTTON    "Save changes" · "Visible" toggle · move up/down
STEPS     1. As a member who is not the couple (no host check on the live path), save.
EXPECTED  A refused write says so.
ACTUAL    Live path `.update({ photo_moments_config: config }).eq('event_id', …)` with no `.select()` and no `requireHostMembership` (only the draft path checks); an RLS-filtered update returns no error and 0 rows → `{ ok: true }` → "Saved." Same shape in widgets `toggleWidgetVisibility`, `moveWidget`. (unsure whether RLS admits a non-couple writer)
WHERE     website/photo-moments/actions.ts `updatePhotoMoments` · website/widgets/actions.ts
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 · design-and-wiring B6
SEVERITY  broken
SOURCE    CODE
```

#### E-12 · Event Hub locks: "Event Pro" typed by hand beside a heading that reads Event Plus; no price; badge "Pro" labelled Event Plus

```
PAGE      /dashboard/[eventId]/website/our-story, /website/site-chrome, /website/widgets   (event: stg-mika-turns-7)
BUTTON    "Go Event Pro" · "photos come with Event Pro" · "Unlock {plan}" ×2 · the "Pro" paid mark
STEPS     1. Open each without the part.
EXPECTED  One plan name read from the catalogue, its price, one button.
ACTUAL    `LOVE_STORY_PRO_CTA = 'Go Event Pro'`; site-chrome "It's part of Event Pro." under "Part of {planName}" (= Event Plus); site-chrome stacks two lock cards, two unlock buttons, no price; widgets `<PaidMark word="PLUS" label={paidMarkLabel(proMark, 'Event Plus')} text="Pro">`. Same family as E-04.
WHERE     lib/love-story-moments.ts · our-story/_components/love-story-book.tsx · website/site-chrome/page.tsx · website/_components/website-pro-lock.tsx · website/widgets/page.tsx
SHOTS     375 px light
RULE      design-and-wiring B7 · CLAUDE.md §1 plans
SEVERITY  money-signin
SOURCE    CODE
```

#### E-13 · Our story: a failed price or plan read drops the price and offers Pro to a couple who may own it

```
PAGE      /dashboard/[eventId]/website/our-story   (event: stg-mika-turns-7)
BUTTON    "Add more stories and your photos · Go Event Pro"
STEPS     1. The SKU or entitlement read fails. 2. Open the page.
EXPECTED  "Couldn't read" for the price; no upsell on an unread plan.
ACTUAL    `formatV2Sku('COUPLE_WEBSITE_PRO').catch(() => null)` → price dropped; `eventHubPartActive(...).catch(() => false)` and `eventOwnsCoupleWebsitePro(...).catch(() => false)` → the upsell shows.
WHERE     website/our-story/page.tsx · our-story/_components/love-story-pro-line.tsx
SHOTS     375 px light
RULE      CLAUDE.md §1 money · design-and-wiring B7
SEVERITY  money-signin
SOURCE    CODE
```

#### E-14 · Event services in the iPhone app: screen reader reads "₱0" on packs and photo sizes

```
PAGE      /dashboard/[eventId]/studio/website-pro   (iPhone app shell)
BUTTON    pack rows · photo-size chips (aria-labels)
STEPS     1. Open in the app with VoiceOver. 2. Focus a pack or chip.
EXPECTED  Apple's price, or no price, never ₱0.
ACTUAL    In the app `withoutWebFigures` / `appleFacts` set `php: 0`, but labels still run `formatPhp(p.php)`: "Event Plus, ₱0", "500 photos, ₱0".
WHERE     studio/website-pro/_components/event-services-view.tsx (aria-label on pack rows and chips; `appleFacts`) · website-pro/page.tsx `withoutWebFigures`
SHOTS     375 px light (app)
RULE      CLAUDE.md §1 (never ₱0)
SEVERITY  money-signin
SOURCE    CODE
```

#### E-15 · Privacy: tapping another visibility choice shows nothing until saved

```
PAGE      /dashboard/[eventId]/website/privacy   (event: stg-carla-miguel)
BUTTON    Public · Unlisted · Only guests with a Setnayan account · Private
STEPS     1. Tap "Private" (currently Public). 2. Look before Save.
EXPECTED  The tapped choice shows as chosen.
ACTUAL    The radio is `sr-only`; the border and "Current" badge come from `const selected = value === currentValue` (the server value), not `:checked`.
WHERE     website/privacy/page.tsx `VisibilityCard`
SHOTS     375 px light
RULE      design-and-wiring B6
SEVERITY  wrong
SOURCE    CODE
```

#### E-16 · Failed reads read as real (privacy consent, story authors, page loads bounce to Home)

```
PAGE      /dashboard/[eventId]/website/privacy, /website/stories, /website/photo-moments, /website/site-chrome, /website/widgets
BUTTON    "Feature our wedding" · "by …" · page load
STEPS     1. Make the read fail.
EXPECTED  "Couldn't read".
ACTUAL    privacy: `catch { showcaseOptedIn = false }` → "Off — your wedding stays private" + an offer about a consent never read; stories: authors read "A Setnayan storyteller" and "Read it" drops; photo-moments/site-chrome/privacy/widgets: `const { data: event }` (error unread) then `redirect(/dashboard/${eventId})`.
WHERE     website/privacy/page.tsx (`showcaseOptedIn`) · website/stories/page.tsx (`peopleError`) · the four page.tsx event reads
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4
SEVERITY  wrong
SOURCE    CODE
```

#### E-17 · Site chrome: with both parts locked, "Save" still shows and says "Saved"

```
PAGE      /dashboard/[eventId]/website/site-chrome   (a Free event)
BUTTON    "Save music & video"
STEPS     1. Both fields locked. 2. Press Save.
EXPECTED  No Save shown.
ACTUAL    Form posts no fields → `hasWrite` false → lands `?saved=1` → "Saved — your guests will see this on your Event Hub." Also three accent-filled buttons on one screen (two lock `ab-main` + Save).
WHERE     website/site-chrome/page.tsx · site-chrome/actions.ts `updateSiteChrome`
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 · Part K1
SEVERITY  wrong
SOURCE    CODE
```

#### E-18 · Words: "landing page", "wedding URL", "monogram", "load-bearing", and a guest-gate claim that disagrees with Privacy

```
PAGE      /dashboard/[eventId]/website/photo-moments, /website/site-chrome, /website/widgets
BUTTON    ⓘ texts, list header, footer, errors, tab title
STEPS     1. Read the copy on a birthday event.
EXPECTED  "Event Hub", the event's own noun, plain words, one true statement.
ACTUAL    "displayed in order on your landing page" · "your wedding URL" · "loops behind your monogram" · `title: 'Customize widgets'` · "your wedding's load-bearing surfaces" · widgets ⓘ says the public page shows a "scan your QR" gate to anyone without an invitation, while Privacy says Public = "Anyone can open your page and read it" (unsure which is true today)
WHERE     website/photo-moments/page.tsx, _components/photo-moments-editor.tsx · website/site-chrome/page.tsx (Video hero ⓘ) · website/widgets/page.tsx
SHOTS     375 px light
RULE      brand.md word rules and tone
SEVERITY  wrong
SOURCE    CODE
```

#### E-19 · Editor sub-pages: hand-built moment sheet (92 dvh), animate-pulse, wrong skeletons, no way back, K1, legacy pieces

```
PAGE      /dashboard/[eventId]/website/our-story, /photo-moments, /privacy, /site-chrome, /stories, /widgets, /dashboard/[eventId]/studio/website-pro
BUTTON    moment sheet · loading · Back · buttons
STEPS     1. Open each; add a moment; load slowly.
EXPECTED  Sheet/RiseScreen; Sk/Ghost; the skeleton draws only what the page draws; a Back to the Maker; one main button.
ACTUAL    moment-sheet(-studio).tsx: `createPortal(<div className="fixed inset-0 …"><OverlayBackdrop/><div role="dialog" … max-h-[92dvh]>`; `animate-pulse` in moment-order-cards.tsx; `scrollIntoView({behavior:'smooth'})` with no reduced-motion check; our-story/stories/site-chrome inherit `FormPageSkeleton` (a form card none of them draws), widgets loading draws a toolbar it does not have; no Back on photo-moments/site-chrome/widgets; privacy "Manage launch" `ab ab-brand` beside `ab-main` Save; widgets "Visible" `ab-ok` + hand-styled pills; our-story `button-primary`, `bg-red-50`, no PageMasthead; website-pro InfoDot `transition-all text-[10px]`, a hand-built `.es-step` fixed scrim layer during Apple Pay, `font-size: 28px` off scale; typed `/dashboard/${eventId}/launch` hrefs where `routes.dashboard.website.*` exist
WHERE     website/our-story/_components/{moment-sheet,moment-sheet-studio,moment-order-cards}.tsx · website/loading.tsx, privacy/loading.tsx, widgets/loading.tsx · privacy/page.tsx · widgets/page.tsx · studio/website-pro/_components/event-services-view.tsx, event-services-website.css
SHOTS     375 px light
RULE      HOUSE_DESIGN_STANDARD Parts K1, K3, F1 · MOTION_STANDARD E2 · CLAUDE.md §3
SEVERITY  look
SOURCE    CODE
```

#### E-20 · Six editor sub-pages are addresses; they should rise over the Maker (two may have no visible door)

```
PAGE      /dashboard/[eventId]/website/our-story, /photo-moments, /privacy, /site-chrome, /stories, /widgets
BUTTON    the page itself
STEPS     1. Reach each from the Maker.
EXPECTED  FULL-SCREEN POPUP over the Maker (long, not shared); ✕ returns to the row.
ACTUAL    All six are pages; four already have an inline Maker panel. photo-moments and widgets are reached only through editor rows' `href` (which editor-shell may not render) and the nav-registry "website-editor" area no menu reads (unsure: confirm in phase B).
WHERE     the six page.tsx files · website/editor/page.tsx (row `href`s) · lib/nav-registry-defaults.ts
SHOTS     375 px light
RULE      SHAPE · design-and-wiring A3
SEVERITY  look
SOURCE    CODE
```

### Live studio (live · live-studio-control · panood · panood/control · panood/program)

> Three pages change with `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` (value on staging not readable from code). Phase B: note it.

#### L-01 · Live controller: about a dozen controls show success after a failed write (cut, ★ default, delete channel, on-air light, watch links)

```
PAGE      /panood/control/[eventId]   (event: stg-carla-miguel)
BUTTON    camera tile cut ("Now on Channel 1.") · "Clear Channel 1" · ★ default · delete channel · delete moment · remove film · "Save watch link" · Facebook save/remove · "We're on air" on/off · "End (on air by hand)"
STEPS     1. Press each while the write fails.
EXPECTED  An error banner; the state unchanged.
ACTUAL    Every listed write is unchecked, then the success banner: `cutToMainStage` both `update({ is_main_stage … })` unchecked → "Now on Channel 1." (if only the second fails, NOTHING is on air); `deleteRoamZone`: the delete is unchecked, then `revokeChannelCamera` runs anyway → "Camera channel removed." (the camera link dies while the channel stays); `endManualOnAir` returns `{ ok: true }` so the on-air light can stay on.
WHERE     apps/web/app/panood/control/[eventId]/actions.ts (`cutToMainStage`, `clearMainStage`, `setFeaturedRoamZone`, `deleteRoamZone`, `deleteHighlight`, `removeEventFilm`, `saveControlWatchUrl`, `saveControlFacebookUrl`, `setControlManualAir`, `clearControlManualAir`, `endManualOnAir`; all in lib/supabase-unread-error.baseline.txt)
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 · design-and-wiring B6
SEVERITY  broken
SOURCE    CODE
```

#### L-02 · Live controller reads "Off air" while live when its reads fail

```
PAGE      /panood/control/[eventId]
BUTTON    On air / Off air tally · Go live / End row · channel tiles
STEPS     1. While live, reload with the broadcast, on-air, grant or camera read failing.
EXPECTED  "Couldn't check whether you're on air", never "Off air".
ACTUAL    `try { activeBroadcast = await getActivePanoodBroadcast(eventId) } catch {}`; the manual-on-air read error only logged → `isLive` false → "Off air" + Go live; a grant read error hides Go live behind "connect first"; cameras `.catch(() => new Map())` → every channel looks unbound.
WHERE     apps/web/app/panood/control/[eventId]/page.tsx (`activeBroadcast`, `isLive`, `hasRouteToAir`) · transport-row.tsx
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4
SEVERITY  wrong
SOURCE    CODE
```

#### L-03 · Live controller: a paying host is sent to the buy page mid-show when the plan read fails; unlock price silently dropped

```
PAGE      /panood/control/[eventId]
BUTTON    ⚡ "Mark moment" · delete moment · "Rehearse free — unlock…" bar · tile "Unlock" chip
STEPS     1. An owning host marks a moment while the entitlement read fails. 2. Open with the catalogue read failing.
EXPECTED  An error; "Couldn't read" by the price; unlock opens a checkout.
ACTUAL    `eventEntitlementClient(eventId).catch(() => null)` → `owned=false` → `redirect(DETAIL_PATH)`; `formatV2Sku(LIVE_STUDIO_SKU).catch(() => null)` → "… · one event" with no price; every unlock door goes to the detail page, not a checkout.
WHERE     panood/control/[eventId]/actions.ts `requireLiveStudioOwned` · page.tsx (unlock bar)
SHOTS     375 px light
RULE      CLAUDE.md §1 money · design-and-wiring B7
SEVERITY  money-signin
SOURCE    CODE
```

#### L-04 · Program window: a failed channel read skips the paid-channel gate (falls back to the old watermark paywall)

```
PAGE      /panood/program/[eventId]   (an unpaid event with Live Studio channels)
BUTTON    program output
STEPS     1. The `live_studio_roam_zones` read fails while the program window opens.
EXPECTED  Fail closed: only the ★ channel can go to air.
ACTUAL    `fetchProgramChannels(admin, eventId).catch(() => [])` and `if (error || !data) return []` → `if (channels.length > 0)` skipped → `air` null → `sourceAllowed = air ? … : true`: any camera the controller sends is painted. The comment says the legacy path "keeps its own paywall (lib/panood-watermark.ts)", so a watermark may still apply (unsure). Also `const { data: event } …; if (!event) notFound()` → OBS captures a 404 on a failed read.
WHERE     apps/web/app/panood/program/[eventId]/page.tsx `fetchProgramChannels` · program-surface.tsx `sourceAllowed`
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 · design-and-wiring B7
SEVERITY  money-signin
SOURCE    CODE
```

#### L-05 · Live Watch setup: "Saved — guests see Watch Live" after a failed write; Go live / End report ok after failed writes

```
PAGE      /dashboard/[eventId]/studio/panood/setup   (event: stg-carla-miguel)
BUTTON    "Save watch link" · Facebook "Save" · "Remove link" · "Go live" · "End broadcast"
STEPS     1. Press each while the `events` update fails.
EXPECTED  An error; nothing marked saved.
ACTUAL    6 `events.update` results unread (baseline) → `redirect(…?watch_url_saved=1)`; `goLivePanood` and `endPanoodBroadcast` return `{ ok: true }` after unchecked writes, so the Event Hub may never show the player, or keep showing a finished broadcast.
WHERE     studio/panood/setup/actions.ts (`savePanoodWatchUrl`, `savePanoodFacebookUrl`, `clearPanoodFacebookUrl`, `goLivePanood`, `endPanoodBroadcast`, `clearPanoodWatchUrl`)
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 · design-and-wiring B6
SEVERITY  broken
SOURCE    CODE
```

#### L-06 · Memory lane: the Flash switch ignores a failed save

```
PAGE      /dashboard/[eventId]/live   (event: stg-carla-miguel)
BUTTON    "Flash to Memory lane" switch
STEPS     1. Tap while the save fails.
EXPECTED  An error; the switch goes back.
ACTUAL    `await toggleFlashAutoWall(eventId, !enabled);` — the result is discarded.
WHERE     live/_components/flash-auto-wall-toggle.tsx `FlashAutoWallToggle`
SHOTS     375 px light
RULE      design-and-wiring B6
SEVERITY  broken
SOURCE    CODE
```

#### L-07 · Live studio prices: a failed catalogue read shows "—" and sends ₱0 into checkout; the Logo pack has no buy door

```
PAGE      /dashboard/[eventId]/studio/live-studio-control, /dashboard/[eventId]/studio/panood/setup
BUTTON    Pricing tile · "(—, one price per event)" · "Add Live Watch" sheet · "Animated Monogram" pack card
STEPS     1. Open with the catalogue read failing. 2. Look for a way to buy the pack.
EXPECTED  "Couldn't read" and buying held back; the pack opens a real checkout.
ACTUAL    `priceLabel = sku ? formatPhp(…) : '—'`, `priceCentavos: String(sku?.price_centavos ?? 0)` into ChoosePlanSheet; pack card "Open the orders page to purchase." with no link, and "Price set in the Setnayan catalog" on a failed read.
WHERE     studio/live-studio-control/page.tsx · studio/panood/setup/page.tsx `PackCard`
SHOTS     375 px light
RULE      CLAUDE.md §1 money · design-and-wiring B7
SEVERITY  money-signin
SOURCE    CODE
```

#### L-08 · Failed reads read as real across the live pages (counts 0, "Auto", no cameras, nothing to print, not connected)

```
PAGE      /dashboard/[eventId]/live, /studio/live-studio-control, /studio/panood/broadcast, /cameras, /cameras/print, /setup
BUTTON    counts · mode · camera lists · print sheet · Connect YouTube · Go live
STEPS     1. Open each with its read failing.
EXPECTED  "Couldn't read".
ACTUAL    /live `String(visibleCount ?? 0)`, mode "Auto", Flash ON; live-studio-control `youtubeGrant = (grantRaw ?? null)` → offers Connect again, stats errors → "No reviews yet"; broadcast and cameras `fetchPanoodCameras(…).catch(() => [])` → "No cameras provisioned yet"/"No cameras yet", `eventSkuActive(...).catch(() => false)` treats a paid event as the free 3-camera tier; print `(zoneRows ?? [])` → "There are no join cards to print yet."; setup active broadcast in `try{}catch{}` → Go live shows while live.
WHERE     live/page.tsx · studio/live-studio-control/page.tsx, lib/add-on-stats.ts · studio/panood/broadcast/page.tsx · cameras/page.tsx · cameras/print/page.tsx · studio/panood/setup/page.tsx
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4
SEVERITY  wrong
SOURCE    CODE
```

#### L-09 · Cameras page and print sheet disagree on what a guest camera joins (seat vs channel)

```
PAGE      /dashboard/[eventId]/studio/panood/cameras vs /cameras/print
BUTTON    camera cards · QR
STEPS     1. Compare the two pages.
EXPECTED  One description of what can be joined.
ACTUAL    cameras hands out a QR per seat ("Camera N"); print reads per channel and says seat cards with no channel "lead nowhere … on a day that cannot be re-run". Also "Copy" fails silently (`catch { // Fall back silently }`) and print has no Print button on a phone (only "Press ⌘P").
WHERE     studio/panood/cameras/page.tsx · cameras/print/page.tsx · studio/panood/_components/copy-link.tsx
SHOTS     375 px light
RULE      design-and-wiring C8 · kit §5.3
SEVERITY  wrong
SOURCE    CODE
```

#### L-10 · Live pages advertise features still coming, promise "free" and speed; wedding words on every event; "Monogram"

```
PAGE      /dashboard/[eventId]/studio/live-studio-control, /studio/panood/setup, /panood/control/[eventId]
BUTTON    "Not included" list · rollout cards · overlay switch · masthead
STEPS     1. Read the copy on stg-mika-turns-7.
EXPECTED  No coming features, price promises or speed claims; "Logo Maker"; the event's own word.
ACTUAL    "rolls out as the streaming infrastructure comes online", "We'll email you the moment the Connect button lights up", "Coming soon — admin setup pending", "Coming with rollout" cards, "Cast to projector: Coming with the rollout", "Coming soon — Setnayan's YouTube app review is still with Google"; "free for every couple", "Free, always available"; "~10 seconds", "Takes about 20 seconds"; "Broadcast your wedding live", "your wedding page"; `label="Monogram"`, "Monogram — placed", "Animated Monogram", "Your bespoke monogram".
WHERE     studio/live-studio-control/page.tsx · studio/panood/setup/page.tsx · panood/control/[eventId]/page.tsx
SHOTS     375 px light
RULE      brand.md claims #3, #6, #9 · word rules
SEVERITY  wrong
SOURCE    CODE
```

#### L-11 · Live pages: many accent fills per screen, spinners, pulsing dot, hand-built menus/toasts, half-pixel type, `bg-white`

```
PAGE      /dashboard/[eventId]/live, /studio/live-studio-control, /studio/panood/*, /panood/control/[eventId], /panood/program/[eventId]
BUTTON    Go live · End · Connect · unlock CTAs · saves · tally dot · ✎ rename
STEPS     1. Open each at 375 px.
EXPECTED  One main button per screen; Sk not spinners; Sheet/Toast; tokens.
ACTUAL    setup: five accent fills (`ab-main`, `bg-mulberry` ×2, `bg-burgundy` ×2); control: `bg-mulberry` on ~9 buttons + `bg-danger-600` + `bg-burgundy`; live-studio-control: `main` + `ab-main` Connect + `bg-mulberry` plan trigger; `Loader2 animate-spin` (live mode-control, live-wall-controls, ingest-health-strip); `animate-pulse` tally (control-room.tsx, control page); ✎ rename is a `<details>` with an absolute form, no backdrop; banners are a hand-rolled `ToastLayer`; `text-[9.5px]`…`[12.5px]`; `bg-white`; program lower third `bg-[#D96B4A]`; cameras buttons hand-built; /studio/panood and broadcast skeletons drawn for redirects; "Back to Live Watch" points at a redirect.
WHERE     studio/panood/setup/page.tsx, go-live-card.tsx · panood/control/[eventId]/page.tsx, transport-row.tsx, _components/{toast-layer,ingest-health-strip}.tsx · live/_components/mode-control.tsx · studio/panood/broadcast/control-room.tsx · panood/program/[eventId]/program-surface.tsx
SHOTS     375 px light
RULE      HOUSE_DESIGN_STANDARD Parts K1, K3 · CLAUDE.md §3 (Loading, Toast, Type, Colour)
SEVERITY  look
SOURCE    CODE
```

#### L-12 · Live controller Setup (~740 lines, seven sections) opens in a half sheet

```
PAGE      /panood/control/[eventId]
BUTTON    "Setup"
STEPS     1. Open Setup at 375 px.
EXPECTED  FULL-SCREEN POPUP (many screens long).
ACTUAL    `<Sheet … wide>` holds connect, add camera, overlays, moments, watch links, films, venue screens.
WHERE     panood/control/[eventId]/_components/setup-sheet.tsx `SetupSheet`
SHOTS     375 px light
RULE      SHAPE · Part K3
SEVERITY  look
SOURCE    CODE
```

### Memories (memories · download-all · thank-you · alaala · assignments · galleries · prints · library · life-flash)

#### M-01 · Memories keep-time words: "free, for life", and "3 months" for every plan

```
PAGE      /dashboard/[eventId]/memories, /memories/download-all   (event: stg-carla-miguel, Event Plus)
BUTTON    ⚙ "Keep full resolution" ⓘ · viewer Share ⓘ · Download all ⓘ · originals-reminder email
STEPS     1. Open ⚙ › Keep full resolution ⓘ. 2. Open a photo › Share ⓘ.
EXPECTED  No "free for life"; originals kept 3/6/12 months by plan, then a 720p copy for life.
ACTUAL    "Your Memories stay free, for life." · "Keep full resolution keeps it for good" · "the 720p copy stays, free, for life" · "Off · 3 months after the event we keep the 720p copy" on every plan; the drop job itself uses a flat 92 days (`lib/papic-fullres-drop-core.ts`) — the copy and the code both ignore 3/6/12 by plan.
WHERE     memories/_components/memories-settings.tsx `MemoriesSettings` · lib/memories-viewer.ts `shareWords` · lib/papic-originals-reminder-core.ts · memories/download-all/page.tsx · lib/papic-fullres-drop-core.ts
SHOTS     375 px light + 375 px dark
RULE      brand.md claims #3 (originals 3/6/12 by plan; no "free for life")
SEVERITY  money-signin
SOURCE    CODE
```

#### M-02 · "Keep full resolution" price: a failed catalogue read looks like "not on sale"; its checkout opens on top of the ⚙ sheet

```
PAGE      /dashboard/[eventId]/memories
BUTTON    ⚙ › "Turn on · ₱…/yr"
STEPS     1. Open ⚙ while the HIGH_RES_ARCHIVE read fails. 2. On a good read press Turn on.
EXPECTED  "Couldn't read" by the row; the checkout replaces the sheet (one layer).
ACTUAL    `priceRes.data?.is_active ? … : null` (error unread) → a bare icon and no door; `InlineCheckoutDrawer` is its own `role="dialog" aria-modal … fixed inset-0` opened over the ⚙ Sheet (popup on a popup; the Thank-You SavePanel uses the same drawer).
WHERE     memories/_components/memories-settings.tsx (`priceRes`) · app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx
SHOTS     375 px light + 375 px dark
RULE      CLAUDE.md §1 money · §5 rule 4 · Part K3
SEVERITY  money-signin
SOURCE    CODE
```

#### M-03 · Thank-You film: a failed price read says "isn't on sale" (dormant while the SKU is free for all)

```
PAGE      /dashboard/[eventId]/memories/thank-you
BUTTON    "Save to my phone" (unowned)
STEPS     1. With a price on the SKU, the catalogue read fails.
EXPECTED  "Couldn't read".
ACTUAL    `formatV2Sku(SKU_CODE).catch(() => null)` → "Saving the film isn't on sale right now." Dormant today (`FREE_FOR_ALL_SKUS` holds PAPIC_ADDON_THANK_YOU).
WHERE     memories/thank-you/page.tsx · _components/thank-you-maker.tsx `SavePanel`
SHOTS     375 px light
RULE      CLAUDE.md §1 money · §5 rule 4
SEVERITY  money-signin
SOURCE    CODE
```

#### M-04 · Prints: the Event Hub look lock says PLUS on the badge and Event Pro in the note, with no price in the note

```
PAGE      /dashboard/[eventId]/prints   (event: stg-mika-turns-7)
BUTTON    "Wear it" → ConfirmDialog "Event Pro" / "Not now"
STEPS     1. Open Prints on a free event. 2. Press Wear it.
EXPECTED  One plan name and its catalogue price on the lock; one button; an upsell is not a confirm dialog.
ACTUAL    badge `word="PLUS"`, note "Printing in your Event Hub look is Event Pro", `<ConfirmDialog confirmLabel="Event Pro">` used as a sales note; the price is only in the ProQuietLine above, which hides after "Not now"; typed `/studio/website-pro` href.
WHERE     launch/_components/studio-prints-settings.tsx `StudioHubLookRow` · studio-prints-six.tsx `StudioProDoor` · lib/studio-hub-look-row.ts
SHOTS     375 px light
RULE      design-and-wiring B7 · CLAUDE.md §1 plans · §3 Floating surface
SEVERITY  money-signin
SOURCE    CODE
```

#### M-05 · Assignments: "Remove" never says it failed

```
PAGE      /dashboard/[eventId]/alaala/assignments
BUTTON    "Remove"
STEPS     1. Press Remove while the action refuses.
EXPECTED  The failure is shown.
ACTUAL    `save.run(() => removeAssignment(...))` never reads `{ ok:false }`; raw strings reach the UI (`'Not authenticated'`, `error.message`); moments are the wedding list on every event type.
WHERE     alaala/assignments/_components/assignment-controls.tsx `AssignmentRow` · alaala/assignments/actions.ts · lib/kwento-moments.ts
SHOTS     375 px light
RULE      design-and-wiring B6
SEVERITY  broken
SOURCE    CODE
```

#### M-06 · Three pages are all called "Memories"; Galleries and the Memories tab count photos differently

```
PAGE      /dashboard/[eventId]/alaala, /dashboard/[eventId]/galleries, /dashboard/[eventId]/memories
BUTTON    page titles · "Ready · N" on the Papic row
STEPS     1. Finished-event "Memories" → /galleries. 2. Galleries › Guest Stories → /alaala. 3. Event bar Memories → /memories. Compare counts.
EXPECTED  One page per name; one photo count from one reader.
ACTUAL    alaala `metadata = { title: 'Memories' }`, galleries `title: 'Memories'` + `<PageMasthead title="Memories" />`, the tab; assignments' "← Memories" goes to alaala; photo-delivery "Back to Memories" goes to /galleries. Galleries counts every `papic_photos` row + guest captures (hidden and withheld included); Memories uses `countGalleryFrames`.
WHERE     alaala/page.tsx · galleries/page.tsx `countPapicPhotos` · memories/page.tsx `countGalleryFrames` · _components/after/finished-event-summary.tsx
SHOTS     375 px light
RULE      design-and-wiring A3, C8
SEVERITY  wrong
SOURCE    CODE
```

#### M-07 · Memories words: wedding wording on every event, "Monogram Maker", a "Coming soon" Drive copy while other lines promise it

```
PAGE      /dashboard/[eventId]/memories, /alaala, /memories/thank-you, /dashboard/library
BUTTON    withheld line · Alaala masthead · chip · ⚙ Drive row · errors
STEPS     1. Open on stg-mika-turns-7.
EXPECTED  The event's own words; Logo Maker; no coming feature advertised; plain error words.
ACTUAL    "belong to the couple" (birthday) · "Your wedding, kept alive." · "your wedding's own song" · chip `label: 'Monogram Maker'` · Drive card "Coming soon — Setnayan's Drive verified-app review is in progress." while the viewer ⓘ and the email say "Copy to Google Drive (free)" (unsure: `driveOAuthReady` on prod) · Thank-You shows the raw browser error · library Editorials "Your wedding editorial will appear here" on a failed read.
WHERE     memories/page.tsx (withheld line) · alaala/page.tsx · lib/add-ons-catalog.ts (`animated-monogram`) · studio/papic/_components/drive-copy-card.tsx · memories/thank-you/_components/thank-you-maker.tsx · (account)/library/_data/editorials.ts
SHOTS     375 px light
RULE      brand.md word rules and claims #9 · CLAUDE.md §5 rule 4
SEVERITY  wrong
SOURCE    CODE
```

#### M-08 · Memories failed reads vanish or read as empty (Alaala sections, assignments, library editorials)

```
PAGE      /dashboard/[eventId]/alaala, /alaala/assignments, /dashboard/library?tab=editorials
BUTTON    "Most storied moments" · "Mga Boses" · moment list · Editorials
STEPS     1. Make each read fail.
EXPECTED  "Couldn't read".
ACTUAL    `getKwentoDensity(...).catch(() => [])` and the stories reject → sections vanish; assignments `(assignments ?? [])`; `fetchLibraryEditorials` returns `empty` in every catch.
WHERE     alaala/page.tsx · alaala/assignments/page.tsx · (account)/library/_data/editorials.ts
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4
SEVERITY  wrong
SOURCE    CODE
```

#### M-09 · Dark: /dashboard/library forwards to Home, which is not dark-ready (dead DARK_READY entry); Life-Flash's top block has no glow and its player is hand-built

```
PAGE      /dashboard/library, /dashboard/life-flash
BUTTON    Dark mode · "▶ Play your Life-Flash"
STEPS     1. Choose Dark. 2. Open /dashboard/library and /dashboard/life-flash; press Play.
EXPECTED  Memories library paints dark; Life-Flash's top block carries `--color-band-glow`; the player is a RiseScreen.
ACTUAL    library `redirect(forwardToHome('memories', …))` → `/dashboard?seg=memories`, and `/dashboard` is not on `DARK_READY`; life-flash launcher `bg-ink dark:bg-raised` with no glow; player `<div className={styles.overlay} role="dialog" aria-modal="true">` with `document.body.style.overflow = 'hidden'`; `flash.module.css` hex (`#161311`, `#fff`, `#d98a54` …); scope chips are a wrapping `sn-chip` row, not PickMenu. Life-Flash 404s unless `NEXT_PUBLIC_LIFE_STORY === '1'` (check on staging).
WHERE     (account)/library/page.tsx · lib/appearance.ts `DARK_READY` · (account)/life-flash/_components/flash.tsx, flash.module.css · life-flash/page.tsx
SHOTS     375 px dark
RULE      Part K2 · K3 · DARK_MODE_STANDARD §3 · CLAUDE.md §3 Choices
SEVERITY  look
SOURCE    CODE
```

#### M-10 · Memories look: K1 in the Add photos sheet and Alaala, spinners, wrong skeleton, hex and half-pixel type in the grid

```
PAGE      /dashboard/[eventId]/memories, /download-all, /thank-you, /alaala, /alaala/assignments
BUTTON    buttons · loading · grid tiles
STEPS     1. Open each at 375 px light and dark.
EXPECTED  One main per scope; Sk/Ghost; tokens; text-sn-* scale.
ACTUAL    Add photos sheet `tone="brand"` "Add more" beside `main` "Choose photos"; Alaala two hand-filled `var(--m-mulberry)` links; Thank-You `ab-main` + `bg-ink` filled; `Loader2 animate-spin` (add-to-library, photo-viewer SharePanel, download-all-parts, thank-you-maker); memories/loading.tsx `ListPageSkeleton` (the page draws a Papic block and a grid); gallery tiles `bg-[rgba(184,150,62,0.92)] text-[#17160F]`, `text-[8.5px]`/`[9.5px]`/`[10.5px]`/`[12.5px]`, `duration-300`; download-all title twice and hand-rolled buttons; Alaala hand frames + hex `#5C4726`; assignments hand buttons.
WHERE     studio/papic/_components/add-to-library.tsx · alaala/page.tsx · thank-you-maker.tsx · memories/loading.tsx · app/_components/memories/event-memories-gallery.tsx · download-all/{page,download-all-parts}.tsx · alaala/assignments/_components/assignment-controls.tsx
SHOTS     375 px light + 375 px dark
RULE      Part K1 · CLAUDE.md §3 (Loading, Colour, Type) · MOTION_STANDARD
SEVERITY  look
SOURCE    CODE
```

#### M-11 · Assignments is its own address; it should rise over Alaala

```
PAGE      /dashboard/[eventId]/alaala/assignments
BUTTON    the page
STEPS     1. Alaala › Manage assignments.
EXPECTED  FULL-SCREEN POPUP over Alaala; ✕ returns.
ACTUAL    Its own page with "← Memories".
WHERE     alaala/assignments/page.tsx
SHOTS     375 px light
RULE      SHAPE
SEVERITY  look
SOURCE    CODE
```

### Papic and photo delivery (challenges · crew · poster · moderation · recap · run-of-show · photo-delivery · apple-pro)

> No page computes Papic credits itself or shows a per-camera allowance; the challenges cost line reads `lib/papic-event-pool.ts` and drops the balance (never 0) on a failed read.

#### P-01 · Every challenge and run-of-show press reads as saved when the write failed

```
PAGE      /dashboard/[eventId]/studio/papic/challenges, /studio/papic/run-of-show   (event: stg-carla-miguel)
BUTTON    "Add challenge" · "Add" · eye Hide/Show · "Ask now" · "Stop" · swipe delete · "Use this" · "This is happening now" · "Take off this moment" · "Pause/Resume challenges"
STEPS     1. Press any while the write is refused.
EXPECTED  A plain failure line under the control.
ACTUAL    Each action logs or drops the error and redirects to the bare page; `papicInPlaceAnswer` reads a bare path as `{ ok: true }`. `setCoupleChallengeActiveAction` never reads the error: `await supabase.from('papic_missions').update({ is_active: … })`. A failed count read reads as "Ten challenges are already on"; `?add=unavailable` reads in place as saved.
WHERE     studio/papic/actions.ts (`createCoupleChallengeAction`, `addLibraryChallengeAction`, `setCoupleChallengeActiveAction`, `armChallengeAction`, `setChallengesPausedAction`, `clearMomentChallengeAction`, `stopChallengeAction`, `deleteCoupleChallengeAction`) · studio/papic/_lib/papic-in-place.ts `papicInPlaceAnswer` · lib/papic-missions.ts `activationRefused`
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 · design-and-wiring B6
SEVERITY  broken
SOURCE    CODE
```

#### P-02 · Challenges and run-of-show have no door a person can reach

```
PAGE      /dashboard/[eventId]/studio/papic/challenges, /studio/papic/run-of-show
BUTTON    "Pick your challenges" / "Set a challenge for each moment"
STEPS     1. Look for a menu row or link into either page.
EXPECTED  A real door.
ACTUAL    The only links sit in the `!standalone` branch of `CoupleChallengesManager`, which is never drawn (rendered only with `inCard` in papic-camera-settings.tsx or `standalone` on the page). Ugat counts the links; no person can press them. Also "Clear search and filters" goes to Memories (`href={papicCardHref(eventId)}`) instead of clearing.
WHERE     studio/papic/couple-challenges-manager.tsx (`if (!standalone)`, the FilterChip block) · studio/papic/_components/papic-camera-settings.tsx
SHOTS     375 px light
RULE      design-and-wiring A3, B5
SEVERITY  broken
SOURCE    CODE
```

#### P-03 · Photo delivery "Disconnect" says disconnected after a failed write (the Google token may stay stored)

```
PAGE      /dashboard/[eventId]/studio/photo-delivery   (event: stg-carla-miguel)
BUTTON    "Disconnect"
STEPS     1. Press while the `oauth_grants` or `events` update is refused.
EXPECTED  "Couldn't disconnect".
ACTUAL    Both updates unchecked, then always `?disconnected=1` → "Drive disconnected." (baseline rows).
WHERE     studio/photo-delivery/actions.ts `disconnectPhotoDelivery`
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4
SEVERITY  broken
SOURCE    CODE
```

#### P-04 · Photo delivery promises "free, for life" and a flat "3 months" for every plan

```
PAGE      /dashboard/[eventId]/studio/photo-delivery
BUTTON    retention notice · step 3 · delivery-complete copy
STEPS     1. Read the page.
EXPECTED  No "free for life"; originals 3/6/12 months by plan.
ACTUAL    "Every photo stays in your Memories, free, for life." and "3 months after your event's last day…" three times. Same family as M-01.
WHERE     studio/photo-delivery/page.tsx · _components/photo-delivery-panel.tsx
SHOTS     375 px light
RULE      brand.md claims #3
SEVERITY  money-signin
SOURCE    CODE
```

#### P-05 · Recap "Publish" / "Make it private" fail without a word

```
PAGE      /dashboard/[eventId]/studio/papic/recap   (event: stg-mika-turns-7)
BUTTON    "Publish my recap" · "Publish anyway" · "Make it private" · socials switch
STEPS     1. Press while the `event_recaps` upsert is refused.
EXPECTED  A failure line.
ACTUAL    `await admin.from('event_recaps').upsert(…)` error discarded, action returns void, the page re-renders unchanged; the socials switch flips back silently.
WHERE     studio/papic/recap/actions.ts `publishRecap`, `unpublishRecap` · recap/_components/recap-social-feature-toggle.tsx
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 · design-and-wiring B6
SEVERITY  broken
SOURCE    CODE
```

#### P-06 · Crew "Copy link" does nothing when the clipboard is blocked (the link is not printed on the page)

```
PAGE      /dashboard/[eventId]/studio/papic/crew
BUTTON    "Copy link"
STEPS     1. Press where the clipboard is blocked.
EXPECTED  The link shown, or a failure line.
ACTUAL    `catch { /* … the visible link is still selectable */ }` but the page never prints the link; a second copy-button primitive beside `app/_components/copy-button.tsx`.
WHERE     studio/papic/crew/_components/copy-button.tsx `CopyButton`
SHOTS     375 px light
RULE      design-and-wiring B5, D12
SEVERITY  broken
SOURCE    CODE
```

#### P-07 · Apple Pro: the button stays disabled forever when the App Store product is missing

```
PAGE      /dashboard/[eventId]/apple-pro   (iPhone app)
BUTTON    "Unlock Plus and Apply"
STEPS     1. The EVENT_PLUS product is missing (`PRO` null).
EXPECTED  A sentence saying the store is not answering.
ACTUAL    `if (sample || !PRO) return;` leaves the price state at 'loading': disabled with no line. A failed entitlement/ownership read (`.catch(() => null)`) shows the sale to a couple who may own it (a server refusal backstops it).
WHERE     app/_components/iap/apple-pro-screen.tsx · app/dashboard/[eventId]/apple-pro/page.tsx
SHOTS     375 px light (app)
RULE      CLAUDE.md §5 rule 4
SEVERITY  broken
SOURCE    CODE
```

#### P-08 · Papic failed reads read as real (crew notice, moderation list, recap counts, photo-delivery state)

```
PAGE      /dashboard/[eventId]/studio/papic/crew, /moderation, /recap, /dashboard/[eventId]/studio/photo-delivery
BUTTON    "Not working yet" notice · guest photo list · "The 0 photos…" · delivery panel
STEPS     1. Make each read fail.
EXPECTED  "Couldn't read".
ACTUAL    crew: a failed read says "This link has been turned off or has expired. Issue a fresh one…" (and offers no button); moderation: notice plus "No guest photos yet"; recap: "The 0 photos that are safe to share" under the refusal notice, guests counted outside `countsTowardEvent`; photo-delivery: sync mode defaults to "Selected" manual release and the connect card shows to a connected event.
WHERE     studio/papic/crew/page.tsx, lib/shared-join-link.ts · moderation/page.tsx · recap/page.tsx, lib/auto-recap.ts · photo-delivery/page.tsx
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 · design-and-wiring C8
SEVERITY  wrong
SOURCE    CODE
```

#### P-09 · Papic words: wedding moments and wording on every event, internal notes, raw database errors, garbled ⓘ labels

```
PAGE      /dashboard/[eventId]/studio/papic/run-of-show, /moderation, /recap, /challenges, /dashboard/[eventId]/studio/photo-delivery
BUTTON    moments · footer · reasons · errors · ⓘ
STEPS     1. Open on stg-mika-turns-7; trigger a failure; use a screen reader on the ⓘ.
EXPECTED  The event's own words; plain reasons; real labels.
ACTUAL    run-of-show always lists "Bridal March", "Veil & Cord", "Money Dance" (`KWENTO_MOMENTS`); moderation footer "Source · iteration 0012 Papic · UGC moderation (Apple 1.2 / Google Play UGC)"; "Not from this wedding"; recap "share a couple's recap"; `error.message.slice(0, 80)` and "something hiccuped"; photo-delivery "Could not save sync mode: {Postgres text}", "as it lands in R2", "One-tap OAuth"; challenges ⓘ label "Your guests see up to on their phone." (number missing); photo-delivery ⓘ label `"files · $ delivered.\` : …"` (code text).
WHERE     studio/papic/run-of-show/page.tsx, lib/kwento-moments.ts · moderation/page.tsx, moderation/actions.ts · recap/page.tsx · couple-challenges-manager.tsx (InfoTip) · photo-delivery/page.tsx, actions.ts, _components/photo-delivery-panel.tsx
SHOTS     375 px light
RULE      brand.md word rules and tone · CLAUDE.md §3 Toast
SEVERITY  wrong
SOURCE    CODE
```

#### P-10 · Papic look: K1 (several tints per card), spinners, width transition, poster wider than 375 px, no masthead

```
PAGE      /dashboard/[eventId]/studio/papic/challenges, /crew, /crew/poster, /moderation, /recap, /run-of-show, /dashboard/[eventId]/studio/photo-delivery, /dashboard/[eventId]/apple-pro
BUTTON    buttons · loading · QR poster · titles
STEPS     1. Open each at 375 px.
EXPECTED  One main per scope; no spinners; transform/opacity; fits 375 px; PageMasthead.
ACTUAL    challenges `bg-mulberry` "Add challenge" + accent-outlined "Ask now" per row; moderation cards: terracotta-outlined Delete, `bg-warn-50` Report, terracotta Block, green Approve; recap `tone="ok"` Keep all beside `bg-mulberry` Publish, `Loader2 animate-spin`; photo-delivery filled `bg-success-700` "Open in Drive", `bg-mulberry` Release, `animate-spin` + `transition-[width] duration-700`; poster QR fixed `h-[420px] w-[420px]` inside `px-8` (side-scrolls at 375 px), `bg-white`, rail/nav may print (unsure); crew loading draws a 4-tile grid for one card; challenges and run-of-show have no PageMasthead; apple-pro `.button-primary`.
WHERE     couple-challenges-manager.tsx · moderation/page.tsx · recap/_components/guest-phone-review.tsx · photo-delivery/_components/{photo-delivery-panel,release-progress-poller}.tsx · crew/poster/page.tsx · crew/loading.tsx · run-of-show/page.tsx · app/_components/iap/apple-pro-screen.tsx
SHOTS     375 px light
RULE      Part K1 · CLAUDE.md §3 · MOTION_STANDARD E2
SEVERITY  look
SOURCE    CODE
```

#### P-11 · Crew and moderation pages should not be pages

```
PAGE      /dashboard/[eventId]/studio/papic/crew, /studio/papic/moderation
BUTTON    the pages
STEPS     1. Open from Launch / Alaala "See all →".
EXPECTED  Crew: a SMALL POPUP (the one code already lives on Event Details › How guests get in). Moderation: on the photo in Memories (owner 23 Oct: "the separate moderation page and the padlock go").
ACTUAL    Both are full pages with doors; crew copies `one-code.tsx` with hand frames.
WHERE     studio/papic/crew/page.tsx · moderation/actions.ts (`photoActionHome` note) · alaala/page.tsx
SHOTS     375 px light
RULE      SHAPE
SEVERITY  look
SOURCE    CODE
```
