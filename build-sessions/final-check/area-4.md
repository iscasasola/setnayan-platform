# Final check · Area 4 · Guest (Event Hub, pass, camera)

Checker 4 of 8. Report only. Pinned commit `fb3f72d`. Kit: `build-sessions/FINAL-CHECK-KIT.md`.
Phase A = code pass (`SOURCE: CODE`). Phase B = staging browser walk (`SOURCE: SEEN`), not started.

Marks on each line: **OFFLINE** = NEEDED (where signal is lost) · READ-ONLY · NOT NEEDED.
**SHAPE** = TODAY → SHOULD (PAGE · FULL-SCREEN POPUP · SMALL POPUP); `=` when they match.

## BLOCKERS

None yet.

## Progress

- [x] /[slug] — OFFLINE: NEEDED (venue door: pass on Me; hall: Live programme, seat line, directions) · SHAPE: PAGE = PAGE (its layers differ: A4-17..A4-20)
- [x] /[slug]/avatar — OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE
- [x] /[slug]/cached/[key] — OFFLINE: READ-ONLY IS ENOUGH (it is the Event Hub, same cache) · SHAPE: rewrite of PAGE = PAGE
- [x] /[slug]/everyone — OFFLINE: NOT NEEDED · SHAPE: PAGE → FULL-SCREEN POPUP (DIFFERS, A4-32)
- [x] /[slug]/find-my-table — OFFLINE: NEEDED (in the hall, door to table) — kept today, but a copy saved before the day shows "seats show on the day" · SHAPE: PAGE = PAGE
- [x] /[slug]/find-seat — OFFLINE: NEEDED (venue door pass; the hall map) — not kept today · SHAPE: PAGE = PAGE (its door pass layer: A4-36)
- [x] /[slug]/hub → forward to /[slug] (every branch lands) — OFFLINE: NEEDED (installed home-screen tile at the venue door) · SHAPE: forward = forward
- [x] /[slug]/invite — OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE
- [x] /[slug]/invite/enter — OFFLINE: READ-ONLY IS ENOUGH (ticket at the door; ?tab=me copy is the fallback) · SHAPE: PAGE = PAGE (its ticket popup: A4-40)
- [x] /[slug]/invite/reply — OFFLINE: NOT NEEDED (before the day) · SHAPE: PAGE → FULL-SCREEN POPUP (DIFFERS, A4-41)
- [x] /[slug]/pabuya — OFFLINE: READ-ONLY IS ENOUGH (money dance in the hall; the bank app needs signal anyway) · SHAPE: PAGE = PAGE
- [x] /[slug]/print — OFFLINE: NOT NEEDED (after the event) · SHAPE: PAGE = PAGE
- [x] /[slug]/recap — forward to /[slug]?story=later (lands) — OFFLINE: NOT NEEDED · SHAPE: forward = forward
- [x] /[slug]/request — OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE
- [x] /[slug]/seat — OFFLINE: NEEDED (table-sign QR in the hall; personal pass at the door) — not kept today · SHAPE: PAGE = PAGE
- [x] /[slug]/welcome — OFFLINE: NOT NEEDED (one-time plus-one form) · SHAPE: PAGE = PAGE
- [x] /claim/[token] — OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE
- [x] /join/[eventId] — OFFLINE: NOT NEEDED (but scanned at the venue door; no Setnayan offline line) · SHAPE: PAGE = PAGE
- [x] /join/[eventId]/connect/confirm — OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE
- [x] /join/[eventId]/set-password — OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE
- [x] /join/[eventId]/success — OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE
- [x] /join/crew/[token] — OFFLINE: READ-ONLY IS ENOUGH (run of show, back of house) · SHAPE: PAGE = PAGE
- [x] /live — OFFLINE: NOT NEEDED (Live Watch never saved) · SHAPE: PAGE = PAGE
- [x] /live/screen — OFFLINE: NOT NEEDED (Live Watch never saved) · SHAPE: PAGE = PAGE
- [x] /panood/cam/[token] — OFFLINE: NOT NEEDED (a live camera) · SHAPE: PAGE = PAGE (camera, but reached and re-opened by its shared link: test 1)
- [x] /papic/claim/[token] — OFFLINE: NOT NEEDED (one-time claim) · SHAPE: PAGE = PAGE
- [x] /papic/decorate — OFFLINE: NOT NEEDED (an open page saves to the phone queue) · SHAPE: PAGE → FULL-SCREEN POPUP (DIFFERS, A4-55)
- [x] /papic/demo/[token] — OFFLINE: NOT NEEDED (marketing demo) · SHAPE: PAGE = PAGE
- [x] /papic/guest — OFFLINE: NEEDED (hall and tables, mid-shoot) — shots queue on the phone, but the camera cannot be opened with no signal · SHAPE: PAGE → FULL-SCREEN POPUP (DIFFERS, A4-69)
- [x] /papic/join/[token] — OFFLINE: NOT NEEDED (one server hop) · SHAPE: PAGE = PAGE
- [x] /papic/lightcheck — OFFLINE: NOT NEEDED · SHAPE: PAGE → not a product route (an operator tool; app/dev or deleted, A4-73)
- [ ] /papic/me/[token]
- [ ] /papic/order/[token]
- [ ] /papic/pool
- [ ] /papic/seat/[token]
- [ ] /papic/try
- [x] /samahan/join/[token] — OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE
- [x] /wall/[eventId] — OFFLINE: NOT NEEDED (live wall never saved; freezes on last frame) · SHAPE: PAGE = PAGE

## Offline today: what ships for guests (read once, applies to every page below)

From `apps/web/public/sw.js` (`isDayOfGuestNavigation`, `maybeServeOfflineCopy`), `lib/offline-copies.ts`,
`lib/offline-copy-addresses.ts`, `app/_components/offline-bar.tsx`, `public/offline.html`:

- **Kept for no signal:** the bare `/<slug>` (any query except `?tab=me`) and `/<slug>/find-my-table`, network-first
  into `DAYOF_CACHE` (2-day max age, one copy per full URL incl. query, only what this phone already opened). The
  guest's own `/<slug>?tab=me` (pass, "Your schedule") is a per-viewer saved copy, kept from 3 days before to the day
  after the event, for the pass holder or the seat's own account only.
- **Not kept, not even intercepted:** every other `/<slug>/*` page and all of `/papic/*`, `/join/*`, `/claim/*`,
  `/live*`, `/wall/*`, `/panood/*`, `/samahan/*`. With no signal the browser shows its own no-internet page.
- **No guest write is queued offline.** The only queue in `sw.js` (`guestbook-sync`) has no caller in `app/` and
  posts to `/api/guestbook`, which does not exist. The second worker `public/sw-offline.js` (the media write queue)
  only registers when `NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED` is on (default off).
- **The offline bar is honest:** it says only "You're offline" / "Back online ✓" (`OFFLINE_WORDS`).
- **Gap against the plan for the day** (whole Event Hub downloads: program, seat and table, venue directions, the
  guest's own Memories; Live Watch never): today only what the guest already opened is kept, the seat page
  (`/seat`, `/find-seat`) and venue directions are not kept at all, and Memories is not kept.

## Findings

Numbered `A4-NN`. Every phase A finding is `SOURCE: CODE`; phase B confirms or strikes it.

### Cross-cutting

```
ID        A4-01
PAGE      /offline.html (served when a kept guest page has no copy)
BUTTON    the page text
STEPS     1. Open /stg-bea-paolo and /stg-bea-paolo/seat with signal. 2. Go offline. 3. Open /stg-bea-paolo?tab=program (never opened) and /stg-bea-paolo/seat.
EXPECTED  Words that match what the phone kept.
ACTUAL    offline.html says "Any pages and event details you've already opened are still available — reconnect to load the rest." /seat was opened but is not kept (not intercepted: the browser's own error page); only /<slug>, /<slug>/find-my-table and the guest's ?tab=me copy are kept. Anchor: `apps/web/public/offline.html` "Any pages and event details you've already opened"; `apps/web/public/sw.js` `isDayOfGuestNavigation`.
SHOTS     375 px light (DevTools offline)
RULE      CLAUDE.md §5 rule 4 (honest states) · offline words promise only what the page does
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-02
PAGE      every page (service workers)
BUTTON    none
STEPS     1. Read NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED on the preview (flags.ts list). 2. If on: DevTools → Application → Service workers.
EXPECTED  One worker controls scope `/`.
ACTUAL    `app/_components/offline-daemon-mount.tsx` registers `/sw-offline.js` with the default scope `/`, the same scope `app/layout.tsx` `sw-register` gives `/sw.js`. One scope holds one registration, so each register replaces the other's script; `sw-offline.js` has no fetch handler, so while it controls, none of the guest offline copies above are served. Latent while the flag is off (default).
SHOTS     DevTools Application panel
RULE      Offline: guests at the venue (one of the 5 full-offline places)
SEVERITY  broken (only if the flag is on; else no finding)
SOURCE    CODE
```

### /claim/[token]

```
ID        A4-03
PAGE      /claim/[token]   (a dependents claim link)
BUTTON    opening the link
STEPS     1. Open a valid claim link while the `dependents` read fails.
EXPECTED  "Couldn't read · Try again"; a valid link is never called dead.
ACTUAL    The read error is dropped and the page says "This link isn't active." `actions.ts` `claimAlaga` does the same (`if (!row) redirect(`/claim/${token}?error=invalid`)`). Anchor: `apps/web/app/claim/[token]/page.tsx` `ClaimAlagaPage` `admin.from('dependents')`.
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-04
PAGE      /claim/[token]
BUTTON    "Claim my profile"
STEPS     1. Sign in as the adult. 2. Press "Claim my profile" while the godparents write fails.
EXPECTED  Profile and its godparent records move together, or the person is told it did not finish.
ACTUAL    Ownership moves, then `await admin.from('godparents').update({ owner_user_id: user.id }).eq('dependent_id', row.dependent_id);` runs with its result unchecked and the action redirects to success. The godparent records stay on the guardian's account. Anchor: `apps/web/app/claim/[token]/actions.ts` `claimAlaga`.
SHOTS     n/a (server)
RULE      Honest states · records attached to the right person
SEVERITY  money-signin
SOURCE    CODE
```

```
ID        A4-05
PAGE      /claim/[token]
BUTTON    "Claim my profile" / "Take over …'s care"
STEPS     1. Claim. 2. Land on /dashboard?seg=people&claimed=1.
EXPECTED  A small success toast.
ACTUAL    Nothing reads `claimed` (`app/(hub)/dashboard/page.tsx` reads seg, hub, request_declined, inviter_muted, request_error). The success is silent. Anchor: `apps/web/app/claim/[token]/actions.ts` `claimed=1`.
SHOTS     375 px light
RULE      CLAUDE.md §3 Toast (success is a small toast)
SEVERITY  look
SOURCE    CODE
```

### /join/[eventId]

No findings. Every redirect target exists; the event read throws on error; requests go through `guest_join_request_create`.

### /join/[eventId]/connect/confirm

```
ID        A4-06
PAGE      /join/[eventId]/connect/confirm   (event: any event whose "Who can RSVP" is "Anyone, I approve")
BUTTON    "Yes, save it"
STEPS     1. Signed in as `guest`, open /join/<eventId> and press "Send request" (the request row carries the account email). 2. Type /join/<eventId>/connect/confirm directly. 3. Press "Yes, save it".
EXPECTED  No seat is offered: a request is never a way in until the hosts press Keep or Link (owner 2026-09-26).
ACTUAL    The request-only guard `onlyARequestHoldsThisEmail` lives only in `connect/route.ts`. The confirm page calls `findSeatToConnect` directly, and its email branch ("2. The account's email, on a row of THIS event": `.ilike('email', userEmail)`) never checks `entry_source` (`emailMayBindRow`), so a request row is offered and `connectEventForUser` binds it. Anchors: `apps/web/lib/event-account-link.ts` `findSeatToConnect`; `apps/web/app/join/[eventId]/connect/confirm/page.tsx` `findSeatToConnect(eventId`. No guard test covers it.
SHOTS     375 px light (the "Yes, save it" screen for a request-only account)
RULE      Sign-in door: a pass attached before the hosts approve
SEVERITY  money-signin
SOURCE    CODE
```

### /join/[eventId]/set-password

No findings. (Browser pass: through the login bounce `?next=` is dropped, so Save/Skip fall back to `/dashboard/<eventId>`.)

### /join/[eventId]/success

No findings. (Browser pass: signed out, `redirect('/login')` carries no return path.)

### /join/crew/[token]

```
ID        A4-07
PAGE      /join/crew/[token]   (a supplier's crew QR)
BUTTON    the "What the shop calls you" field
STEPS     1. Open a crew QR signed out, with anonymous crew joining on.
EXPECTED  The shared `.input-field` input; no white surface.
ACTUAL    A hand-made white input: `className="h-12 w-full rounded-xl bg-white px-4 text-[16px] text-ink dark:bg-raised"`; the error line uses `text-danger-700`. Anchor: `apps/web/app/join/crew/[token]/_components/crew-name-form.tsx` `CrewJoinForm`.
SHOTS     375 px light
RULE      design-and-wiring §D12 (one input primitive) · §D13 (no bg-white)
SEVERITY  look
SOURCE    CODE
```

### /live

```
ID        A4-08
PAGE      /live   (event: stg-mika-turns-7, a birthday)
BUTTON    the page line and the `?error=locked` line
STEPS     1. Open /live. 2. Enter a code for an event that has not unlocked Live Watch.
EXPECTED  The event's own words (`eventWordsForEvent`), as `panood/cam` already does.
ACTUAL    "Type the code shown under Venue screens in the couple's Live Studio controller." and `locked: '… Ask the couple to unlock it first.'` on every event type. Anchor: `apps/web/app/live/page.tsx` `ERRORS` "Ask the couple".
SHOTS     375 px light + desktop
RULE      Words (event words, not "couple" on a birthday)
SEVERITY  wrong
SOURCE    CODE
```

### /live/screen

```
ID        A4-09
PAGE      /live/screen   (a paired TV on an event with Live Studio)
BUTTON    none (the polling TV)
STEPS     1. Pair a TV on a paid event. 2. Let the `orders` read fail once during a poll.
EXPECTED  Keep the last picture with "Reconnecting…" (the file's own rule: a refused read is not unpaired).
ACTUAL    `checkOrderActive` throws, `resolveBroadcastWindow` catches it as not owned (`try { owned = await eventSkuActive(supabase, eventId, LIVE_STUDIO_SKU); } catch { owned = false; }`), so `loadLiveScreen` returns `locked` and the room's screen says "Live Watch isn't active for this event." on a paid event until a later poll succeeds. Anchors: `apps/web/lib/live-studio-window-server.ts` `resolveBroadcastWindow`; `apps/web/app/live/_lib/load-screen.ts` `state: 'locked'`.
SHOTS     desktop (TV)
RULE      CLAUDE.md §5 rule 4 (honest states)
SEVERITY  wrong
SOURCE    CODE
```

### /panood/cam/[token]

```
ID        A4-10
PAGE      /panood/cam/[token]
BUTTON    "Join this camera" / "Join & open my camera"
STEPS     1. Press Join while the `panood_claim_camera` RPC errors (a blip, not a bad token).
EXPECTED  "Couldn't reach Setnayan · Try again" with Join still there.
ACTUAL    Every failure goes to `?state=error`, drawn exactly like a dead link: `if (state === 'invalid' || state === 'error') {` → "This link isn't active. The host may have reissued this camera." Anchors: `apps/web/app/panood/cam/[token]/page.tsx` `PanoodCameraJoinPage`; `apps/web/app/panood/actions.ts` `claimPanoodCamera`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-11
PAGE      /panood/cam/[token]
BUTTON    the status pill in the header
STEPS     1. Join a camera while the control-room channel is refused or failed, or while streaming is off.
EXPECTED  The pill agrees with the footer's link state.
ACTUAL    The pill says "Connected" with a pulsing green dot whenever the local camera opened: `{state === 'live' ? 'Connected' : …}`, even while the footer reports a refused or failed link. Anchor: `apps/web/app/panood/cam/[token]/_components/panood-camera-publish.tsx` `PanoodCameraPublish`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

### /samahan/join/[token]

```
ID        A4-12
PAGE      /samahan/join/[token]
BUTTON    opening the link
STEPS     1. Open a valid invite while the `community_invite_tokens` read fails.
EXPECTED  "Couldn't read · Try again".
ACTUAL    The error is dropped: `const { data } = await admin.from('community_invite_tokens')…maybeSingle(); if (!data) return { status: 'not_found' };` → "This invite link doesn't work." Anchor: `apps/web/lib/communities.ts` `fetchPendingCommunityInvite`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-13
PAGE      /samahan/join/[token]
BUTTON    none (the "N members" line)
STEPS     1. Open a valid invite while the member-count read fails.
EXPECTED  The count hidden or "—".
ACTUAL    `member_count: count ?? 0,` draws "0 members". Anchor: `apps/web/lib/communities.ts` `fetchPendingCommunityInvite`.
SHOTS     375 px light
RULE      Honest states (a failed read is never 0)
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-14
PAGE      /samahan/join/[token]
BUTTON    "Join <group>" (when it fails)
STEPS     1. The join upsert fails, or open /samahan/join/<token>?error=anything signed in.
EXPECTED  A plain reason plus Try again.
ACTUAL    The raw database message, or any text in the URL, is printed: `sub={`Error: ${search.error}. Try again, or ask an organizer for a fresh link.`}`; the action sets `?error=${encodeURIComponent(error.message.slice(0, 80))}`. Anchor: `apps/web/app/samahan/join/[token]/page.tsx` "Error: ${search.error}".
SHOTS     375 px light
RULE      Honest states · HOUSE_DESIGN_STANDARD F4 (plain reason)
SEVERITY  wrong
SOURCE    CODE
```

### /wall/[eventId]

```
ID        A4-15
PAGE      /wall/[eventId]   (an event that owns the live wall, during the event)
BUTTON    none (the projector's 60 s full sweep)
STEPS     1. A claimed wall is live. 2. The `wall_visible_photos` RPC and/or the `events` read fail during a poll.
EXPECTED  Freeze on the last collage with an amber dot (the file's own promise: "never whites out").
ACTUAL    `getWallSnapshot` drops both errors and returns 200 with `tiles: []`, `count: 0`, mode `coming_soon`; on the full sweep `reconcileTiles(prev, snap.tiles)` removes every tile, so the room sees "0 photos / Waiting for the first shot…" (or the teaser if the events read failed). On first render a failed `isWallSessionLive` read shows the code-entry screen on a claimed TV. Anchors: `apps/web/lib/live-wall.ts` `getWallSnapshot`; `apps/web/app/wall/[eventId]/_components/wall-projection.tsx` `reconcileTiles(prev, snap.tiles)`.
SHOTS     desktop (projector)
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-16
PAGE      /wall/[eventId]   (event: stg-mika-turns-7)
BUTTON    the claim screen and its error line
STEPS     1. Open the wall on a screen. 2. Enter a wrong code.
EXPECTED  The event's own words.
ACTUAL    "Enter the screen code from the couple's Setnayan dashboard.", "ask the couple to generate a fresh one", and the not-lit card "Check the link with the couple." Anchors: `apps/web/app/wall/[eventId]/_components/wall-claim.tsx` `WallClaim`; `apps/web/app/wall/[eventId]/page.tsx` "Check the link with the couple".
SHOTS     desktop
RULE      Words (event words)
SEVERITY  wrong
SOURCE    CODE
```

### /[slug] (the Event Hub)

Reply writes go to the same `guests` row by `guest_id` + `event_id` and revalidate `/dashboard/${eventId}/guests`; a
decline frees the seat in the database (`free_seat_on_decline`); the main reads throw into `error.tsx`. Clean there.

```
ID        A4-17
PAGE      /[slug]   (event: stg-bea-paolo, a guest with face tagging on, on the day)
BUTTON    ⓘ "Details" on the selfie screen (Me → Face tagging)
STEPS     1. Me → Face tagging → the camera screen opens. 2. Tap ⓘ. 3. Tap the dark area above the sheet.
EXPECTED  One layer at a time; the shared OverlayBackdrop (dim + blur); a backdrop tap closes.
ACTUAL    A second dialog opens on top of the full-screen camera dialog with its own scrim, no blur, and no close on tap (only "Got it"): `className="absolute inset-0 z-20 flex flex-col justify-end bg-black/50"` `role="dialog" aria-modal="true" aria-label="Face tagging"`. It also draws a spinner (`Loader2 … animate-spin`). Anchor: `apps/web/app/[slug]/_components/selfie-capture.tsx` `aria-label="Face tagging"`.
SHOTS     375 px light
RULE      HOUSE_DESIGN_STANDARD K3 (popup on popup, own scrim, backdrop tap) · CLAUDE.md §3 Loading (no spinners)
SEVERITY  look
SOURCE    CODE
```

```
ID        A4-18
PAGE      /[slug]   (event: stg-mika-turns-7, the after-event story)
BUTTON    "Relive it" · "See all N suppliers" / a supplier tile · "See all N" on a scene
STEPS     1. Open the story. 2. Open any of these layers. 3. Press the phone's Back.
EXPECTED  A full-screen popup (RiseScreen); Back or ✕ returns to the same place in the story.
ACTUAL    Hand-made full screens with no history entry, so phone Back leaves the Event Hub: `className="fixed inset-0 z-[100] flex flex-col bg-[#0E0D0C] text-white"` (`story/relive.tsx`), `role="dialog" aria-modal="true" aria-label={label} className="fixed inset-0 z-[95] …"` (`story/story-suppliers.tsx` `function Layer(`). Anchors: `apps/web/app/[slug]/_components/story/relive.tsx`; `apps/web/app/[slug]/_components/story/story-suppliers.tsx`.
SHOTS     375 px light
RULE      K3 · SHAPE (full screen = RiseScreen)
SEVERITY  look
SOURCE    CODE
```

```
ID        A4-19
PAGE      /[slug]   (event: stg-mika-turns-7)
BUTTON    "Open the gallery" / "Open your day" (OpenUpScene) · Me → Face tagging → camera
STEPS     1. Open the layer.
EXPECTED  RiseScreen, the one full-screen piece.
ACTUAL    Each draws its own full screen: `className="fixed inset-0 z-[90] flex flex-col bg-cream text-ink"` (`editorial/open-up-layer.tsx` `data-open-up-layer={kind}`; it does handle Back through the hash), `className="fixed inset-0 z-[70] … bg-[#1d1719] text-cream"` (`selfie-capture.tsx` `data-face-screen`).
SHOTS     375 px light
RULE      K3 · SHAPE (the camera is a FULL-SCREEN POPUP = RiseScreen)
SEVERITY  look
SOURCE    CODE
```

```
ID        A4-20
PAGE      /[slug]   (event: stg-bea-paolo for "My QR"; stg-mika-turns-7 for the minute sheet)
BUTTON    "My QR" · a plus-one's ticket · a minute on the story dial · "Open in your browser"
STEPS     1. Open each on a 375 px phone.
EXPECTED  The shared Sheet: half height on a phone, centred dialog on desktop.
ACTUAL    They use OverlayBackdrop but draw their own panels; My QR is a centred card on the phone: `<div className="fixed inset-0 z-50 flex items-center justify-center p-4"> <OverlayBackdrop …/>` (`guest-hub-bar.tsx` `export function GuestSheet`), `className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] …"` (`story/story-clock.tsx`), `copy-my-link.tsx` `OpenInBrowser` `aria-labelledby="open-in-browser-title"` (the same layer opens on /invite/enter).
SHOTS     375 px light + desktop
RULE      K3 · SHAPE (small popup = Sheet)
SEVERITY  look
SOURCE    CODE
```

```
ID        A4-21
PAGE      /[slug]   (event: stg-mika-turns-7, the "By the numbers" scene)
BUTTON    the scene's numbers (invited · said yes · replied %)
STEPS     1. Open the after-event story when one of the guest count reads fails.
EXPECTED  Counts from `lib/guests.ts` (`computeGuestStats` / `headcountForBasis`); a failed read shows "—", never 0.
ACTUAL    Three count queries of its own (a SQL copy of `countsTowardEvent`), and a failed read becomes 0: `const { count: att } = await ahead.guestsAttending; attending = att ?? 0;` → `saidYes: data.metrics.attending`. Anchors: `apps/web/app/[slug]/_components/editorial/data.ts` `guestsAttending: early(`; `editorial-content.tsx` `saidYes: data.metrics.attending`.
SHOTS     375 px light
RULE      design-and-wiring C8 (one reader) · honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-22
PAGE      /[slug]   (event: stg-carla-miguel, signed in as a booked supplier)
BUTTON    supplier desk → "The running order"
STEPS     1. A booked supplier opens the Event Hub while the run-of-show read is refused.
EXPECTED  "Couldn't read" (`fetchRunOfShowBlocks` answers null for a refused read).
ACTUAL    `blocks: blocks ?? [],` turns null into empty, so the desk says "{TheOrganizer} hasn't written the day's timeline yet." (`/vendor-dashboard/on-the-day/live/[eventId]` already handles this with `programUnread`). Anchors: `apps/web/app/[slug]/_lib/supplier-desk.server.ts` `blocks: blocks ?? []`; `supplier-desk.tsx` `hasProgramme`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-23
PAGE      /[slug]   (any event on the day; a host can preview with ?phase=event)
BUTTON    the "Live now" notice at the top of Live
STEPS     1. Open the Event Hub on the day. 2. Go offline. 3. Open Live, Me, find-seat, venue.
EXPECTED  Offline words match what ships.
ACTUAL    `detail={`The ${words.eventWord} is happening. Your schedule, QR, and venue info are pinned below — they work offline if WiFi cuts out.`}`. The QR is not on Live (it is "first on Me, and only on Me"); only pages already opened are kept; the doors from here (find-seat, venue, papic) have no offline copy at all. Anchor: `apps/web/app/[slug]/_components/day-of-banner.tsx` "they work offline if WiFi cuts out".
SHOTS     375 px light (online + DevTools offline)
RULE      Offline words promise only what the page does · honest states
SEVERITY  wrong
SOURCE    CODE
```

### /[slug]/hub (forward)

Every branch lands on `/{slug}` (before the day `''` / `?phase=`; the day `?tab=live|gallery|me`; after `#site-gallery` / `#site-me`).

```
ID        A4-24
PAGE      /[slug]/hub   (event: stg-bea-paolo)
BUTTON    the installed home-screen tile (manifest start_url)
STEPS     1. Install the Event Hub tile from the thank-you page. 2. At the venue with no signal, open the tile.
EXPECTED  The saved Event Hub opens (the bare /<slug> copy in DAYOF_CACHE).
ACTUAL    The tile starts at `/<slug>/redeem?…&to=hub`. The worker leaves redeem to the browser (`isGuestPassHop`) and has no rule for `/hub` (`isDayOfGuestNavigation` keeps only `/<slug>` and `find-my-table`), so the guest gets the browser's no-internet page from the home-screen tile. Anchors: `apps/web/app/[slug]/manifest.webmanifest/route.ts` `reentryRedeemPath(source.slug, code, 'hub')`; `apps/web/public/sw.js` `isDayOfGuestNavigation`.
SHOTS     375 px light (installed tile, DevTools offline)
RULE      Offline: guests at the venue
SEVERITY  broken
SOURCE    CODE
```

### /[slug]/cached/[key]

No findings. Internal rewrite of `/{slug}`; a failed pass check throws.

### /[slug]/welcome

```
ID        A4-25
PAGE      /[slug]/welcome   (event: stg-bea-paolo, a plus-one's link)
BUTTON    the heading / "Your details … from <name>"
STEPS     1. Open a plus-one's link while the bringer's row read fails.
EXPECTED  "Couldn't read", or the page fails honestly.
ACTUAL    The error is ignored and a made-up name is drawn: `… ) || 'the inviting guest';` → "You are the +1 of the inviting guest", and `primaryFirst` becomes "the" ("from the …"). Anchor: `apps/web/app/[slug]/welcome/page.tsx` `'the inviting guest'`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-26
PAGE      /[slug]/welcome   (event: stg-bea-paolo, an unnamed plus-one)
BUTTON    "Save" / "Save to my account" / "just show my pass"
STEPS     1. Type the name. 2. Press Save while the action's event or guest read fails.
EXPECTED  The door says the save failed and keeps what was typed.
ACTUAL    `const [{ data: event }, { data: guest }] = await Promise.all([` … `if (!event?.slug || !guest?.guest_id) redirect(`/${slug}`);` sends the guest to /{slug}, which sends an unnamed plus-one back to /welcome with no message and the typed name lost. Anchor: `apps/web/app/[slug]/welcome/actions.ts` `if (!event?.slug || !guest?.guest_id) redirect(`.
SHOTS     375 px light
RULE      Honest states (a failure renders as a failure)
SEVERITY  broken
SOURCE    CODE
```

```
ID        A4-27
PAGE      /[slug]/welcome   (event: stg-bea-paolo)
BUTTON    the alert notice at the top of the door
STEPS     1. Open /<slug>/welcome?error=<any text> while holding a plus-one pass.
EXPECTED  Only known error keys draw a message.
ACTUAL    `const errorMessage = errorKey ? (ERROR_COPY[errorKey] ?? errorKey) : null;` draws any query text as an alert on the couple's page (the action itself puts a full sentence in the query). Anchor: `apps/web/app/[slug]/welcome/page.tsx` `ERROR_COPY[errorKey] ?? errorKey`.
SHOTS     375 px light
RULE      Words · honest states
SEVERITY  wrong
SOURCE    CODE
```

### /[slug]/avatar

```
ID        A4-28
PAGE      /[slug]/avatar   (event: stg-bea-paolo)
BUTTON    page load
STEPS     1. Open /<slug>/avatar holding a pass while the guest-row read fails.
EXPECTED  Honest failure (the event read on this page already throws).
ACTUAL    `const { data: guest } = await admin.from('guests').select('guest_id, avatar_config, display_name, first_name')` … `if (!guest) redirect(`/${slug}`);` treats a failed read as no guest. Anchor: `apps/web/app/[slug]/avatar/page.tsx` `select('guest_id, avatar_config, display_name, first_name')`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-29
PAGE      /[slug]/avatar   (event: stg-carla-miguel, a light couple theme)
BUTTON    whole page · "Save"
STEPS     1. Open the avatar maker.
EXPECTED  The page wears the couple's look from the layout (`every-guest-page-wears-the-theme.test.ts` lists it); no self-forced dark; Save is ActionButton.
ACTUAL    The page paints its own dark ground and white text: `<main className="min-h-screen bg-[#0b0d12] p-3 sm:p-5">` … `text-white`; Save is a hand-made white fill `className="rounded-xl bg-white px-4 py-2 …"`. Anchors: `apps/web/app/[slug]/avatar/page.tsx` `bg-[#0b0d12]`; `avatar/_components/avatar-maker.tsx` `dirty ? 'Save' : 'Saved'`.
SHOTS     375 px light + desktop
RULE      Theme (guest pages keep the couple's design) · CLAUDE.md §3 Button
SEVERITY  look
SOURCE    CODE
```

### /[slug]/everyone

```
ID        A4-30
PAGE      /[slug]/everyone   (event: stg-bea-paolo)
BUTTON    the "Also coming" list
STEPS     1. Someone not on the list asks to join through /invite and answers Yes. 2. A guest opens /everyone.
EXPECTED  Only people who count toward the event (`countsTowardEvent`); an unapproved request is not listed.
ACTUAL    The list filters on `rsvp_status` alone and never reads `entry_source`: `return rows.filter((r) => r.rsvp_status === 'attending');`. A join request is stored with the requester's own answer (`rsvp_status: answers.rsvp_status` in `app/join/[eventId]/actions.ts`), so a stranger's pending Yes prints as "Also coming". Anchors: `apps/web/lib/entourage.ts` `guestsWhoSaidYes`; `apps/web/app/[slug]/everyone/page.tsx` `${ENTOURAGE_COLUMNS}, rsvp_status`.
SHOTS     375 px light
RULE      Connections: a second reader of "who is coming" (use `countsTowardEvent`)
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-31
PAGE      /[slug]/everyone   (event: stg-bea-paolo)
BUTTON    the "Also coming" section, seen by a signed-in host
STEPS     1. A host opens /everyone while the `event_members` read fails.
EXPECTED  A failure state or the error boundary.
ACTUAL    The error is dropped (`const { data } = await supabase.from('event_members')`), the host is treated as a stranger and told "The rest of the guest list is for invited guests. Open your own invitation link…". Anchor: `apps/web/app/[slug]/everyone/page.tsx` `eventRecognisesViewer`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-32
PAGE      /[slug]/everyone   (event: stg-bea-paolo)
BUTTON    the invitation's preview that opens "Everyone who will be there"
STEPS     1. Press the full-list door on the invitation.
EXPECTED  SHAPE tests: nobody shares or bookmarks this list (test 1 no); it is more than one short screen (test 2 yes) → FULL-SCREEN POPUP over the invitation; ✕ returns to the same place.
ACTUAL    It navigates to its own page with "Back to the invitation" (`href={`/${slug}`}`) at the foot.
SHOTS     375 px light
RULE      SHAPE
SEVERITY  look
SOURCE    CODE
```

### /[slug]/find-my-table

```
ID        A4-33
PAGE      /[slug]/find-my-table   (event: stg-carla-miguel)
BUTTON    the entrance marker and the dotted path on the map
STEPS     1. The couple sets the entrance in the seat-plan editor (`event_floor_plan.entrance_*`). 2. A guest opens /find-my-table, then /find-seat.
EXPECTED  Both pages draw the same door through the one reader `fetchEntrance` (`lib/indoor-blueprint.ts`).
ACTUAL    This page has its own `resolveEntrance` that reads only `events.venue_entrance_x/y` (`.select('venue_entrance_x, venue_entrance_y')`), never the floor plan's entrance that wins in `fetchEntrance`; and `if (error) return DEFAULT_ENTRANCE;` silently draws a default door on a failed read. Anchor: `apps/web/app/[slug]/find-my-table/page.tsx` `resolveEntrance`.
SHOTS     375 px light
RULE      Connections (second reader) · honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-34
PAGE      /[slug]/find-my-table · /[slug]/find-seat · /[slug]/seat   (event: stg-carla-miguel)
BUTTON    the table map on each page
STEPS     1. Open each page once seats are shown; compare with the couple's seat plan.
EXPECTED  Tables come from the couple's seat-plan reader `lib/seating.ts` `fetchTables` (its order `sortTables`, its capacity and coordinate clean-up).
ACTUAL    Three raw `event_tables` reads, each with its own order: `.from('event_tables').select('table_id,public_id,event_id,table_label,…')` (`find-my-table/page.tsx` `tablesRaw`), `.from('event_tables').select(TABLES_SELECT)` (`find-seat/page.tsx`), and a LOCAL `async function fetchTables(` that shadows the shared name (`seat/page.tsx`).
SHOTS     375 px light
RULE      design-and-wiring C8 (one reader) · Connections: a guest's table must read the seat plan's reader
SEVERITY  wrong
SOURCE    CODE
```

### /[slug]/find-seat

```
ID        A4-35
PAGE      /[slug]/find-seat   (event: stg-bea-paolo)
BUTTON    "Confirm your Booking" (the link in the dashed step-up card under the search)
STEPS     1. Open /stg-bea-paolo/find-seat without a pass.
EXPECTED  "Open your invitation" (the door's words since 3 Nov).
ACTUAL    `Confirm your Booking`, which a guest reads as a purchase; the line is held in `lib/ugat/baselines/wrong-words.baseline.txt`. Anchor: `apps/web/app/[slug]/find-seat/_components/seat-frame.tsx` `StepUp`.
SHOTS     375 px light
RULE      Words
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-36
PAGE      /[slug]/find-seat   (event: stg-carla-miguel, on the day)
BUTTON    "Show at the door"
STEPS     1. A seated guest opens the page. 2. Presses "Show at the door".
EXPECTED  The shared full-screen layer (RiseScreen) with the shared backdrop.
ACTUAL    A hand-rolled modal with its own ground: `role="dialog" aria-modal="true"` … `className="fixed inset-0 z-[60] flex flex-col bg-ink`. Anchor: `apps/web/app/[slug]/find-seat/_components/door-pass.tsx` `DoorPass`.
SHOTS     375 px light
RULE      K3
SEVERITY  look
SOURCE    CODE
```

```
ID        A4-37
PAGE      /[slug]/find-seat   (also /[slug]/seat)   (event: stg-carla-miguel, on the day)
BUTTON    the door pass's foot line ("Checked in · 5:42 pm" / "Show this at the door")
STEPS     1. A guest who already checked in opens the pass while the `guest_checkins` read fails.
EXPECTED  It does not claim the guest is not checked in.
ACTUAL    The error is dropped: `const [{ data: checkin }, qrSvg] = await Promise.all([` → "Show this at the door". `/seat` has the same shape (`const { data: checkin }` in `PersonalPass`, which drives the arrival bloom). Anchor: `apps/web/app/[slug]/find-seat/page.tsx`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

### /[slug]/invite

```
ID        A4-38
PAGE      /[slug]/invite   (an event that takes requests)
BUTTON    the request form / "Request sent"
STEPS     1. Open /invite while one of these reads fails: the event's question settings, the membership check, the existing request.
EXPECTED  A failure state.
ACTUAL    All three errors are dropped (`const { data: askRow } = await admin` / `const { data: existing } = await admin` / `const { data: claim } = await admin`): default questions are drawn, a member is shown the form, and someone who already asked gets a second form instead of "Request sent". Anchor: `apps/web/app/join/[eventId]/_components/join-flow.tsx` `JoinFlow`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

### /[slug]/invite/enter

```
ID        A4-39
PAGE      /[slug]/invite/enter   (event: stg-bea-paolo, a guest who said Yes)
BUTTON    "Save my ticket" and "Yes, save to my account" / "Sign in to your account" / "Open in your browser"
STEPS     1. A signed-in guest whose seat is not yet linked to their account opens the thank-you after a Yes.
EXPECTED  One main button in the ticket section.
ACTUAL    Two `button-primary` buttons in the same `data-landing="ticket"` section: Save (`variant="primary"`) and `saveNode`, which renders `<SubmitButton className="button-primary min-h-[56px] w-full" …>Yes, save to my account` (and `button-primary` in the `sign_in` and in-app `OpenInBrowser` states). The guard `each-guest-page-has-one-main-action.test.ts` counts the page source only. Anchors: `apps/web/app/[slug]/_components/save-to-account.tsx`; `apps/web/app/[slug]/invite/enter/page.tsx` `data-landing-keep-slot`.
SHOTS     375 px light
RULE      K1
SEVERITY  look
SOURCE    CODE
```

```
ID        A4-40
PAGE      /[slug]/invite/enter   (event: stg-bea-paolo)
BUTTON    the ticket popup that opens on arrival
STEPS     1. Open the personal link after a new or changed ticket.
EXPECTED  `Sheet` (a small popup).
ACTUAL    A hand-rolled centred card `<div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true"` (it does use the shared `OverlayBackdrop`). The `OpenInBrowser` layer here is A4-20. Anchor: `apps/web/app/[slug]/_components/ticket-popup.tsx` `TicketPopup`.
SHOTS     375 px light
RULE      K3 · SHAPE (small popup = Sheet)
SEVERITY  look
SOURCE    CODE
```

### /[slug]/invite/reply

The write is clean: `admin.from('guests').update({ rsvp_status, rsvp_set_by: 'guest', … })` on the row the couple's
list reads; a decline frees the seat (trigger `guests_free_seat_on_decline`); a failed write shows "it has not been
recorded yet"; `/dashboard/${eventId}/guests` is revalidated.

```
ID        A4-41
PAGE      /[slug]/invite/reply   (event: stg-bea-paolo, a pending guest)
BUTTON    "Reply to the invitation"
STEPS     1. A guest presses Reply on a phone.
EXPECTED  SHAPE tests: nobody shares this address (test 1 no); with meal, dietary, mobile, one box set per +1, tagging, chapters and Terms it is more than one short screen (test 2 yes) → FULL-SCREEN POPUP over the invitation; ✕ returns to the same place. (An event that asks nothing beyond yes/no would fit a SMALL POPUP.)
ACTUAL    A full page navigation to `/{slug}/invite/reply` (`inviteReplyPath`); only the desktop gets a layer (`ReplyPanel`, a Sheet framing the page).
SHOTS     375 px light + desktop
RULE      SHAPE
SEVERITY  look
SOURCE    CODE
```

### /[slug]/pabuya (E-Gifts)

```
ID        A4-42
PAGE      /[slug]/pabuya   (event: stg-carla-miguel)
BUTTON    the header label and the eyebrow
STEPS     1. Open the E-Gifts page.
EXPECTED  "E-Gifts" only; "Pabuya" never visible.
ACTUAL    The header shows `Pabuya` and the eyebrow reads `'The pabuya · digital money dance'` / `'The pabuya · E-Gifts'`. Anchor: `apps/web/app/[slug]/pabuya/page.tsx` `PabuyaPublicPage`.
SHOTS     375 px light
RULE      brand.md word rules (E-Gifts, never Pabuya)
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-43
PAGE      /[slug]/pabuya   (event: stg-carla-miguel)
BUTTON    the footer
STEPS     1. Scroll to the foot.
EXPECTED  No "safe" promise about Setnayan.
ACTUAL    `Kept safe on Setnayan`. Anchor: `apps/web/app/[slug]/pabuya/page.tsx` "Kept safe on Setnayan".
SHOTS     375 px light
RULE      brand.md claims #10 ("safe")
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-44
PAGE      /[slug]/pabuya   (event: stg-carla-miguel)
BUTTON    the ways-to-give list
STEPS     1. Open the page while the `event_egift_methods` read fails.
EXPECTED  "Couldn't read", or the error boundary (the reader's own comment says a failed read throws).
ACTUAL    `readEgiftMethods` returns `{ methods: [], read: false }` and `fetchEgiftMethods` drops the flag (`return (await asked).methods;`), so the page says "{hosts} hasn't set up e-gifts yet. Check back soon". Anchor: `apps/web/lib/egift.ts` `fetchEgiftMethods`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

### /[slug]/print

```
ID        A4-45
PAGE      /[slug]/print   (event: stg-mika-turns-7)
BUTTON    page load
STEPS     1. Open /print while the event read fails.
EXPECTED  The error boundary (siblings use `guestRead`).
ACTUAL    The error is dropped (`const { data } = await admin.from('events')`) and the page answers 404 for an event that exists. Anchor: `apps/web/app/[slug]/print/page.tsx` `fetchEvent`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-46
PAGE      /[slug]/print   (event: stg-mika-turns-7)
BUTTON    page load
STEPS     1. The story loader throws, or the arranged-pages read fails.
EXPECTED  A failure state.
ACTUAL    `} catch { data = null; }` around `loadEditorialData` → "This keepsake isn't ready to print yet." (a claim about the hosts); `.catch(() => [])` around `loadStoryPages` prints the automatic layout as if nothing were arranged. Anchor: `apps/web/app/[slug]/print/page.tsx` `loadEditorialData`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-47
PAGE      /[slug]/print   (event: stg-mika-turns-7, a birthday)
BUTTON    the headline
STEPS     1. `composeCopy` throws.
EXPECTED  The event type's own words.
ACTUAL    The fallback prints a wedding headline for any event: `headline: `${data.displayName} Are Married`,`. Anchor: `apps/web/app/[slug]/print/page.tsx` "Are Married".
SHOTS     375 px light
RULE      Words (event words)
SEVERITY  wrong
SOURCE    CODE
```

### /[slug]/recap

No findings. A forward to `/{slug}?story=later`.

### /[slug]/request

```
ID        A4-48
PAGE      /[slug]/request   (any non-wedding event that takes requests)
BUTTON    the title and lines
STEPS     1. Ask to join a birthday or a wake. 2. Land on ?sent=1.
EXPECTED  The event's own word (the page's comment promises "never 'the couple' to a family at a wake").
ACTUAL    `sentTitle: 'Sent to the couple',` / `waiting: 'Waiting for the couple to confirm you',` for every event type. Anchor: `apps/web/lib/request-key.ts` `REQUEST_WORDS`.
SHOTS     375 px light
RULE      Words (event words)
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-49
PAGE      /[slug]/request   (an event that takes requests)
BUTTON    landing right after "Send"
STEPS     1. Send a request while the `guests` read by token fails.
EXPECTED  A failure state.
ACTUAL    `logQueryError('request-key.read', error, {}, 'graceful_degrade'); return null;` → `if (!key) redirect(`/${home}`);` sends the requester to the event page as a stranger with no word that the request was sent. Anchors: `apps/web/lib/request-key.server.ts` `readRequestKeyByToken`; `apps/web/app/[slug]/request/page.tsx`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

### /[slug]/seat

The table-reader copy is in A4-34; the check-in read in A4-37.

```
ID        A4-50
PAGE      /[slug]/seat   (event: stg-carla-miguel)
BUTTON    the personal pass
STEPS     1. Scan a personal QR while the `event_tables` read fails.
EXPECTED  "We couldn't load your seat pass".
ACTUAL    `const { rows: tables, failed: tablesFailed } = await fetchTables(admin, event.event_id);` is followed by `<PersonalPass … tables={tables}` without checking `tablesFailed`, so an empty list draws "The floor plan is on its way… still arranging". Anchor: `apps/web/app/[slug]/seat/page.tsx` `tablesFailed`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-51
PAGE      /[slug]/seat   (event: stg-carla-miguel, on the day)
BUTTON    the table view and the personal pass
STEPS     1. Scan on the day while the `event_floor_plan` or `events` read fails.
EXPECTED  The error boundary, as /find-seat and /find-my-table do (`throwOnReadError: true`).
ACTUAL    `const published = await guestsMaySeeSeatsFor(admin, event.event_id);` (both calls, no `throwOnReadError`) returns false on a failed read, so a guest at the venue is told seats "show on the day", on the day. Anchor: `apps/web/app/[slug]/seat/page.tsx` `guestsMaySeeSeatsFor(admin, event.event_id)`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-52
PAGE      /[slug]/seat   (event: stg-carla-miguel)
BUTTON    "Turn on alerts" ("Get seat & schedule alerts")
STEPS     1. Press "Turn on alerts". 2. A coordinator reseats the guest.
EXPECTED  "We'll let you know on this device if your table changes… even if you close this page" happens.
ACTUAL    `guest_push_subscriptions` has a writer (`seat/actions/guest-push-actions.ts`) and no reader or sender anywhere in `app/` or `lib/`, so the promise is never kept. A failed subscribe or save is silent too (`await subscribeAndSave();`, try/finally with no catch; the banner just disappears). Anchor: `apps/web/app/[slug]/seat/_components/guest-push-prompt.tsx` `handleEnable`.
SHOTS     375 px light
RULE      design-and-wiring B5/B10 (every control does something real; a table with a writer has a reader) · honest states
SEVERITY  broken
SOURCE    CODE
```

```
ID        A4-53
PAGE      /[slug]/seat   (not visible)
BUTTON    the file's header comment
STEPS     1. Read the header comment.
EXPECTED  No price written into code or comments.
ACTUAL    `gated on the paid CUSTOM_QR_GUEST SKU, ₱1,499`. Anchor: `apps/web/app/[slug]/seat/page.tsx` header comment "CUSTOM_QR_GUEST SKU".
SHOTS     n/a
RULE      CLAUDE.md §1 (never write a price into a comment)
SEVERITY  look
SOURCE    CODE
```

### Papic: what ships for offline and photo credit

- **A shot taken with no signal is not lost.** It is saved on the phone first (IndexedDB, `lib/papic-upload/store.ts`).
  The sender wakes on `online`, on visibility, when the page opens and on its back-off timer (a Web Lock between
  tabs). There is no Background Sync (iOS has none), so waiting shots send only while a camera for that event and
  person is open. The chip's words ("Offline · N waiting … Keep this page open") match the code. A waiting shot is
  dropped after 7 days (`SHOT_TTL_MS`) and shown as "Couldn't save N".
- **The gaps:** the camera page cannot be opened with no signal (not intercepted), and ✕ lands on `offline.html`
  (A4-70).
- **Photo credit** reads through `lib/papic-event-pool.ts` (`fetchGuestQuota` → `readEventPoolStatus`), except the
  low-credits threshold (A4-65).

### /papic/claim/[token]

```
ID        A4-54
PAGE      /papic/claim/[token]   (any seat link)
BUTTON    "Start shooting" / "Claim my seat & start shooting"
STEPS     1. Open a valid seat link. 2. Tap the button while the `papic_claim_seat` RPC (or a non-captcha anonymous sign-in) errors.
EXPECTED  A retryable "we couldn't check just now · your link is fine", like the page's own `unreadable` and `verify` states.
ACTUAL    `redirect(`/papic/claim/${token}?state=error`)` → `if (state === 'invalid' || state === 'error') {` draws the terminal "This link isn't active. The host may have reissued this seat." with no form. Anchors: `apps/web/app/papic/actions.ts` `claimPapicSeat`; `apps/web/app/papic/claim/[token]/page.tsx`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

### /papic/decorate

```
ID        A4-55
PAGE      /papic/decorate   (event: stg-carla-miguel)
BUTTON    "Decorate a photo" (on /papic/me)
STEPS     1. Open /papic/me/<token>. 2. Tap "Decorate a photo".
EXPECTED  SHAPE tests: a photo editor, not shared or revisited by link → FULL-SCREEN POPUP over /papic/me; ✕ returns to the same place.
ACTUAL    A two-hop navigation (`me/[token]/session/route.ts` `NEXT_DESTINATIONS` `decorate: '/papic/decorate'`) to a standalone `<main className="min-h-screen bg-cream px-4 py-8 text-ink">` with its own "Back to my photos" link. Anchor: `apps/web/app/papic/decorate/_components/kwento-decorator.tsx`.
SHOTS     375 px light
RULE      SHAPE
SEVERITY  look
SOURCE    CODE
```

### /papic/demo/[token]

```
ID        A4-56
PAGE      /papic/demo/[token]
BUTTON    the line under "That's the 3 demo credits"
STEPS     1. Scan a demo QR. 2. Take three shots.
EXPECTED  No claim that Papic is unlimited (shots are metered by the event pool, `papic_event_pool_config`).
ACTUAL    `The real Papic is unlimited — every guest, all day, all in your Memories.`. `papic-page-says-only-what-is-true.test.ts` bans exactly this, but its `PAPIC_PAGE_FILES` list misses this file. Anchor: `apps/web/app/papic/demo/[token]/_components/demo-join-flow.tsx` "The real Papic is unlimited".
SHOTS     375 px light
RULE      brand.md claims (price promises)
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-57
PAGE      /papic/demo/[token]
BUTTON    "Take the shot"
STEPS     1. Open a demo link and register. 2. Let the session expire (or lose signal). 3. Tap "Take the shot".
EXPECTED  It says the demo expired or the shot failed.
ACTUAL    Nothing happens and nothing is said: `if (!gate.ok) { if (gate.reason === 'cap') setRemaining(0); return; }`; a thrown `recordDemoShot` only reaches the `finally`. Anchor: `apps/web/app/papic/demo/[token]/_components/demo-join-flow.tsx` `takeShot`.
SHOTS     375 px light
RULE      design-and-wiring B5/B6 (a failure renders as a failure)
SEVERITY  broken
SOURCE    CODE
```

```
ID        A4-58
PAGE      /papic/demo/[token]
BUTTON    the credit counter / "That's the 3 demo credits"
STEPS     1. Shoot on the demo.
EXPECTED  The count from the server cap `DEMO_SHOT_CAP` (`lib/demo-sessions.ts`).
ACTUAL    A hand-typed second copy: `const [remaining, setRemaining] = useState(3);` and `'That’s the 3 demo credits'`. Anchor: `apps/web/app/papic/demo/[token]/_components/demo-join-flow.tsx`.
SHOTS     375 px light
RULE      design-and-wiring C8 (one reader) · brand.md (hand-typed counts)
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-59
PAGE      /papic/demo/[token]
BUTTON    the demo card
STEPS     1. Open a demo link.
EXPECTED  A frame token surface.
ACTUAL    `<div className="w-full max-w-md rounded-2xl border border-[var(--m-line)] bg-white p-7 …">` (`function Shell`). Anchor: `apps/web/app/papic/demo/[token]/page.tsx` `function Shell`.
SHOTS     375 px light
RULE      design-and-wiring D13 (no bg-white) · lint:no-card
SEVERITY  look
SOURCE    CODE
```

### /papic/guest (the guest camera)

```
ID        A4-60
PAGE      /papic/guest   (event: stg-carla-miguel before its capture day, or a blocked guest)
BUTTON    "Open my camera" (on /papic/me), which lands here
STEPS     1. Open /papic/me/<token>. 2. Tap "Open my camera" (`/papic/me/<t>/session?next=guest`, no `from`). 3. Arrive before the day, while access is off or unknown, or while blocked.
EXPECTED  Every refusal has a way back to this event's Event Hub (the slug is already read: `ownHubSlug`).
ACTUAL    The only way off is `{backSlug ? (<Link href={`/${backSlug}`} …>Back to the invitation</Link>) : null}`; with no `?from=` the "Guest cameras open on the day", "aren't on yet / couldn't check" and "Camera unavailable." screens have no button, only the DoorShell wordmark to `/`. Other entries without `from`: `public-event-day-bar.tsx` `href="/papic/guest"`, kwento-decorator's "Open the camera page". Anchor: `apps/web/app/papic/guest/page.tsx` `backSlug`.
SHOTS     375 px light
RULE      Every screen has a way off (`lib/page-home.ts`: a guest page never sends anyone to `/`)
SEVERITY  broken
SOURCE    CODE
```

```
ID        A4-61
PAGE      /papic/guest   (event: stg-carla-miguel)
BUTTON    the thumbnail beside the shutter ("My shots")
STEPS     1. Open the camera while the read of the guest's own shots fails. 2. Tap the thumbnail.
EXPECTED  "Couldn't read your earlier shots" (`getGuestOwnShots` returns null for exactly this).
ACTUAL    `...(myShots ?? []).map(...)` folds the failure into empty; the sheet says "Your shots land here as you take them.". Anchor: `apps/web/app/papic/guest/_components/papic-guest-capture.tsx` `myShotsList`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-62
PAGE      /papic/guest   (event: stg-carla-miguel)
BUTTON    the "My shots" sheet · "Add credits" (also on /papic/seat; flag NEXT_PUBLIC_PAPIC_GUEST_BUY)
STEPS     1. Tap the thumbnail. 2. (Flag on) tap "Add credits", or run out of shots.
EXPECTED  The shared `Sheet`.
ACTUAL    Two hand-rolled panels: `role="dialog" aria-modal="true"` `className="fixed inset-x-0 bottom-0 z-[46] flex h-[72%] …"` with its own drag-to-close (`my-shots-sheet.tsx`), and `role="dialog" aria-modal="true" … className="fixed inset-0 z-50 flex items-end …"` with its own `max-h-[85vh]` panel (`papic-buy-shell.tsx` `PapicBuyShell`). Both do use `OverlayBackdrop`. Anchors: `apps/web/app/papic/guest/_components/my-shots-sheet.tsx`; `apps/web/app/papic/_components/papic-buy-shell.tsx`.
SHOTS     375 px light
RULE      K3
SEVERITY  look
SOURCE    CODE
```

```
ID        A4-63
PAGE      /papic/guest   (event: stg-carla-miguel)
BUTTON    "Add from your phone" (in the My shots header)
STEPS     1. Open My shots. 2. Tap "Add from your phone".
EXPECTED  Never a popup on top of a popup.
ACTUAL    `const openPhone = useCallback(() => setPhoneOpen(true), []);` leaves `shotsOpen` true, so `<AddFromPhoneSheet open={phoneOpen} …>` opens over the still-open `<MyShotsSheet open={shotsOpen} …>`. Anchor: `apps/web/app/papic/guest/_components/papic-guest-capture.tsx` `openPhone`.
SHOTS     375 px light
RULE      K3 · SHAPE (popup on a popup)
SEVERITY  look
SOURCE    CODE
```

```
ID        A4-64
PAGE      /papic/guest   (also /papic/seat/[token]; behind NEXT_PUBLIC_PAPIC_GUEST_BUY)
BUTTON    each offer row in "Add credits" ("₱N — adds N credits to your shared pool")
STEPS     1. Open Add credits.
EXPECTED  Pesos only through `lib/php.ts`; no rate written in code.
ACTUAL    `function peso(n: number): string { return `₱${Math.round(n).toLocaleString('en-PH')}`; }` formats locally and rounds away centavos; the "N% off ₱M" figure uses `export const PAPIC_PESO_PER_CREDIT = 1;` (`papicPoolRungPhrase`). Anchor: `apps/web/lib/papic-tier-copy.ts` `function peso`.
SHOTS     375 px light
RULE      CLAUDE.md §1 (money through php.ts only) · §5 rule 3 (never guess a number that governs money)
SEVERITY  money-signin
SOURCE    CODE
```

```
ID        A4-65
PAGE      /papic/guest   (an event with a per-guest ceiling)
BUTTON    the low-credits pill
STEPS     1. Shoot until the remaining credits near the soft stop.
EXPECTED  The threshold is the pool's live `softStopPct` read through `lib/papic-event-pool.ts`.
ACTUAL    `remaining <= Math.floor((total * (100 - DEFAULT_EVENT_POOL_CONFIG.softStopPct)) / 100)` uses the last-resort fallback, not the owner-tunable `papic_event_pool_config` row. Anchor: `apps/web/app/papic/guest/_components/papic-guest-capture.tsx` `const low =`.
SHOTS     n/a
RULE      design-and-wiring C8 (photo credit: one reader)
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-66
PAGE      /papic/guest   (an event with a per-guest ceiling)
BUTTON    the remaining-credits pill
STEPS     1. Open the camera while both `papic_guest_captures` reads in `fetchGuestQuota` fail.
EXPECTED  An unknown count is not drawn as a full allowance (the function's own comment says so).
ACTUAL    `used` stays 0 when `countError` is set (logged only, "graceful_degrade"), so `remaining = … GUEST_CAPTURE_CREDITS - used` shows the full figure. The record RPC still enforces the cap. Anchor: `apps/web/lib/papic-guest.ts` `fetchGuestQuota`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-67
PAGE      /papic/guest   (event: stg-carla-miguel)
BUTTON    the page gate
STEPS     1. A guest the host blocked opens the camera while the `event_blocked_users` read errors.
EXPECTED  A failed gate read does not hand out the camera.
ACTUAL    `const { data: blockRow } = await admin.from('event_blocked_users')…` ignores `error`, then `if (blockRow) {`: the camera opens and the capture route later refuses every shot. Anchor: `apps/web/app/papic/guest/page.tsx` `event_blocked_users`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-68
PAGE      /papic/guest · /papic/seat/[token]
BUTTON    route load
STEPS     1. Tap Camera on the Hub on a slow connection (or open a seat camera).
EXPECTED  The skeleton draws only what the page draws: a dark full-screen stage.
ACTUAL    `return <GridPageSkeleton title />;` (`guest/loading.tsx`, a cream card grid) and `return <FormPageSkeleton title />;` (`seat/[token]/loading.tsx`, a form shell), then a black full-screen camera.
SHOTS     375 px light (slow 3G)
RULE      CLAUDE.md §3 Loading · HOUSE_DESIGN_STANDARD F1
SEVERITY  look
SOURCE    CODE
```

```
ID        A4-69
PAGE      /papic/guest   (event: stg-carla-miguel)
BUTTON    "Camera" on the Event Hub bar
STEPS     1. On the Hub, tap Camera.
EXPECTED  SHAPE tests: the URL carries no identity and QR scans land on /papic/me first, so test 1 does not hold; it is a camera → FULL-SCREEN POPUP (RiseScreen) over the Hub; ✕ returns to the same scroll and tab without a reload.
ACTUAL    Two navigations (`guestCameraHref = … /papic/me/${…}/session?next=guest&from=${event.slug}` in `site-body.tsx`) to a page with `'fixed inset-0 z-30 h-[100dvh] overflow-hidden …'`; its ✕ is a link to `cameraExitHref(...)` that reloads the Hub. `the-camera-tab-is-the-camera.test.ts` #6 and `the-camera-is-the-whole-screen.test.ts` pin the page shape and move with the owner's word.
SHOTS     375 px light + desktop
RULE      SHAPE (the camera is a FULL-SCREEN POPUP)
SEVERITY  look
SOURCE    CODE
```

```
ID        A4-70
PAGE      /papic/guest   (also /papic/seat/[token])   (event: stg-carla-miguel)
BUTTON    ✕ "Close the camera"
STEPS     1. Open the camera with signal. 2. Lose signal in the hall. 3. Shoot. 4. Tap ✕.
EXPECTED  Back to the Hub's saved copy.
ACTUAL    The exit link is `return `/${slug}?${HUB_TAB_PARAM}=${to}${n}`;` with `&added=N` after shots (`hub-tabs.ts` `cameraExitHref`). The worker's fallback matches the exact URL (`caches.match(request).then((c) => c ?? caches.match('/offline.html'))`), and that URL was never cached, so the guest lands on offline.html (the shots stay queued). Anchors: `apps/web/app/[slug]/_components/hub-tabs.ts` `cameraExitHref`; `apps/web/public/sw.js` `isDayOfGuestNavigation` fallback.
SHOTS     375 px light (DevTools offline)
RULE      Offline: guests at the venue
SEVERITY  broken
SOURCE    CODE
```

### /papic/join/[token]

```
ID        A4-71
PAGE      /papic/join/[token]
BUTTON    page load
STEPS     1. Scan a valid camera QR while the `paparazzi_seats` or `guests` read errors.
EXPECTED  "We couldn't check · your link is fine", as /papic/me and claim's `unreadable` state do.
ACTUAL    `const { data } = await admin.from('paparazzi_seats')…; return Boolean(data);` and `catch { return false; }` fold a failure into "This link isn't active … Ask whoever sent it to re-share your link". Anchor: `apps/web/app/papic/join/[token]/page.tsx` `resolveKind`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-72
PAGE      /papic/join/[token]
BUTTON    the "Shoot from the Setnayan app" notice
STEPS     1. Open a join link in a phone browser with no store URL set.
EXPECTED  No coming-feature or app claim before it is live.
ACTUAL    `<span data-coming-soon="">The app is coming soon — for now, keep going right here in your browser. Nothing to install.</span>` under "Shoot from the Setnayan app". Anchor: `apps/web/app/papic/join/[token]/_components/app-install-banner.tsx` `data-coming-soon`.
SHOTS     375 px light
RULE      brand.md claims #8 and #9 (app before approval; coming features)
SEVERITY  wrong
SOURCE    CODE
```

### /papic/lightcheck

```
ID        A4-73
PAGE      /papic/lightcheck
BUTTON    the page itself · "Copy"
STEPS     1. Visit /papic/lightcheck.
EXPECTED  A throwaway diagnostic lives under `app/dev/**` or is removed.
ACTUAL    The page says `DELETE THIS ROUTE once the numbers are recorded in the verdict.` and is baselined in `lib/ugat/baselines/no-door.baseline.txt` ("a page nobody can reach without typing its address"). Copy says success whatever happens: `void navigator.clipboard?.writeText(text); say('Copied to clipboard.');`. Anchors: `apps/web/app/papic/lightcheck/page.tsx`; `_components/lightcheck-client.tsx` "Copied to clipboard.".
SHOTS     n/a
RULE      design-and-wiring D11/D17 (labs under app/dev) · honest states
SEVERITY  look
SOURCE    CODE
```
