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
- [ ] /[slug]/everyone
- [ ] /[slug]/find-my-table
- [ ] /[slug]/find-seat
- [x] /[slug]/hub → forward to /[slug] (every branch lands) — OFFLINE: NEEDED (installed home-screen tile at the venue door) · SHAPE: forward = forward
- [ ] /[slug]/invite
- [ ] /[slug]/invite/enter
- [ ] /[slug]/invite/reply
- [ ] /[slug]/pabuya
- [ ] /[slug]/print
- [ ] /[slug]/recap
- [ ] /[slug]/request
- [ ] /[slug]/seat
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
- [ ] /papic/claim/[token]
- [ ] /papic/decorate
- [ ] /papic/demo/[token]
- [ ] /papic/guest
- [ ] /papic/join/[token]
- [ ] /papic/lightcheck
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
ACTUAL    They use OverlayBackdrop but draw their own panels; My QR is a centred card on the phone: `<div className="fixed inset-0 z-50 flex items-center justify-center p-4"> <OverlayBackdrop …/>` (`guest-hub-bar.tsx` `export function GuestSheet`), `className="fixed inset-x-0 bottom-0 z-50 max-h-[80vh] …"` (`story/story-clock.tsx`), `copy-my-link.tsx` `aria-labelledby="open-in-browser-title"` (also on /invite/enter, A4-38).
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
