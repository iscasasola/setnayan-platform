# Final check · Area 4 · Guest (Event Hub, pass, camera)

Checker 4 of 8. Report only. Pinned commit `fb3f72d`. Kit: `build-sessions/FINAL-CHECK-KIT.md`.
Phase A = code pass (`SOURCE: CODE`). Phase B = staging browser walk (`SOURCE: SEEN`), not started.

Marks on each line: **OFFLINE** = NEEDED (where signal is lost) · READ-ONLY · NOT NEEDED.
**SHAPE** = TODAY → SHOULD (PAGE · FULL-SCREEN POPUP · SMALL POPUP); `=` when they match.

## BLOCKERS

None yet.

## Progress

- [ ] /[slug]
- [ ] /[slug]/avatar
- [ ] /[slug]/cached/[key]
- [ ] /[slug]/everyone
- [ ] /[slug]/find-my-table
- [ ] /[slug]/find-seat
- [ ] /[slug]/hub → forward
- [ ] /[slug]/invite
- [ ] /[slug]/invite/enter
- [ ] /[slug]/invite/reply
- [ ] /[slug]/pabuya
- [ ] /[slug]/print
- [ ] /[slug]/recap
- [ ] /[slug]/request
- [ ] /[slug]/seat
- [ ] /[slug]/welcome
- [x] /claim/[token] — OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE
- [x] /join/[eventId] — OFFLINE: NOT NEEDED (but scanned at the venue door; no Setnayan offline line) · SHAPE: PAGE = PAGE
- [x] /join/[eventId]/connect/confirm — OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE
- [x] /join/[eventId]/set-password — OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE
- [x] /join/[eventId]/success — OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE
- [ ] /join/crew/[token]
- [ ] /live
- [ ] /live/screen
- [ ] /panood/cam/[token]
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
- [ ] /samahan/join/[token]
- [ ] /wall/[eventId]

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
