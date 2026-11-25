STATUS: phase B in progress (blocker A4-B01 OPEN: the Event Hub flaps between 200 and 500)

# Final check · Area 4 · Guest (Event Hub, pass, camera)

Checker 4 of 8. Report only. Pinned commit `fb3f72d`. Kit: `build-sessions/FINAL-CHECK-KIT.md`.
Phase A = code pass (`SOURCE: CODE`). Phase B = staging browser walk (`SOURCE: SEEN`), on the copy at commit `bd86936` (area-4 code identical to `fb3f72d`), started 25 Nov 06:45 UTC.

Marks on each line: **OFFLINE** = NEEDED (where signal is lost) · READ-ONLY · NOT NEEDED.
**SHAPE** = TODAY → SHOULD (PAGE · FULL-SCREEN POPUP · SMALL POPUP); `=` when they match.

## BLOCKERS

Phase A (code): none.

```
ID        A4-B01
PAGE      /[slug] (every Event Hub: stg-bea-paolo, stg-carla-miguel, stg-mika-turns-7, stg-sofia-debut) and /[slug]/everyone
BUTTON    none (opening the link)
STEPS     1. Open /stg-bea-paolo signed out. 2. Open it again signed in as `guest`, then as `messy_one`.
EXPECTED  The invitation opens in under about 0.7 s (it did: 06:45 UTC, 0.5–0.8 s to DOM, all six views).
ACTUAL    From about 07:00 UTC every Event Hub answers HTTP 500 after 20–24 s and draws "Still opening your invitation…" (app/[slug]/error.tsx). Six tries, three viewers, four events: all 500. In the same minute /about, /live, /papic/try and /api/health answer 200 in under 1 s, so the fault is in the Hub's own reads, not the deployment. /stg-bea-paolo/everyone took 58 s (curl) and 110 s (browser) to answer 200; /stg-bea-paolo/print took 29 s to redirect. Guests cannot open their invitation, reply, or reach their pass. 07:14 UTC re-measure (curl, signed out): /stg-bea-paolo 500 at 23.6 s · /suppliers 200 at 9.6 s · /hardinngtagaytayeventsplace 200 at 13.6 s · /papic/join/zzz 200 at 5.1 s · /pricing 1.6 s · /api/health 0.6 s. A server action that reads one row (/live "Connect" with a wrong code, `pairLiveScreen`) never returned in 60 s. So every database read on the copy is slow; the Hub is simply the page whose deadline turns it into a 500. Likely a slow or locked read under the 8 checkers' load (the copy has no logs this session can read); the controller should read the Vercel function log for /[slug] around 07:00 UTC.
SHOTS     375 px light (the "Still opening your invitation…" screen)
RULE      Kit § 5 item 1 (it opens; no 5xx) · item 10 (speed)
SEVERITY  blocker
SOURCE    SEEN 25 Nov 07:00–07:14 UTC · 200 again at 07:15 · 500 again from 07:19 for every viewer (signed out, `guest`, `messy_one`) on every Hub tried. Every failure carries the same REFERENCE (one error digest), which fits the Hub's read deadline (`lib/read-limit.ts`; `lib/invitation-retry.ts` names the free database's stalls) rather than a code fault. The auto-retry (`AUTO_RETRY_DELAY_MS`) fires once and fails too, so the guest is left on "This invitation didn't load" + Try again. Controller: the copy's database is stalling; phase B of the Hub pages waits on it.
```

## Report at once (money-signin, kit § 6)

- **A4-06** `/join/[eventId]/connect/confirm`: a pending join request can bind itself to the event by opening the confirm page directly, so a person is let in before the hosts approve.
- **A4-04** `/claim/[token]`: the godparent records can stay on the guardian's account while the screen says the claim succeeded.
- **A4-77** `/papic/order/[token]`: an unread amount is drawn as ₱0.00 with a Copy of "0.00" (behind a flag).
- **A4-78** `/papic/order/[token]`: a failed read of logged payments hides them, so a guest may log the same transfer twice (behind a flag).
- **A4-64** Papic "Add credits": prices are formatted outside `lib/php.ts` (centavos rounded away), and a peso-per-credit rate is hand-typed in code (behind a flag).

## Phase A summary (code pass, 25 Nov 2026)

- **Pages:** 37 pages + 1 forward checked, all ticked below. **83 findings**: blocker 0 · money-signin 5 · broken 7 (A4-02 counts only if its flag is on) · wrong 49 · look 22.
- **OFFLINE marks:** NEEDED 7 · READ-ONLY IS ENOUGH 5 · NOT NEEDED 26.
  - Of the 7 NEEDED, only `/[slug]` (its bare address and the guest's `?tab=me` copy) and `/[slug]/find-my-table` are kept today.
  - `/[slug]/hub` (the home-screen tile), `/[slug]/find-seat`, `/[slug]/seat`, `/papic/guest` and `/papic/seat` cannot be opened with no signal.
- **SHAPE marks:** PAGE 30 · forward 2 · differs today 6.
  - 5 pages should be a FULL-SCREEN POPUP: `/everyone`, `/invite/reply`, `/papic/decorate`, `/papic/guest`, `/papic/pool`.
  - `/papic/lightcheck` should not be a product route at all.
  - Layers inside pages that differ: A4-17..A4-20, A4-36, A4-40, A4-62, A4-63.
- **Dark (K2):** not applicable. No area-4 route is on `DARK_READY` (`lib/appearance.ts`), and the guest Event Hub never wears the app glow (DARK_MODE_STANDARD §1). The only self-forced dark page is `/[slug]/avatar` (A4-29).
- **Patterns builders can fix once:**
  - a failed read drawn as "this link isn't active" (A4-03, 10, 12, 54, 71);
  - "the couple" said on every event type (A4-08, 16, 48);
  - three raw readers of the seat plan (A4-34);
  - hand-made layers instead of `Sheet` / `RiseScreen` (K3).

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
- [x] /papic/me/[token] — OFFLINE: READ-ONLY IS ENOUGH (scanned at the door and in the hall to reach the camera and own photos) — not kept today · SHAPE: PAGE = PAGE
- [x] /papic/order/[token] — OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE
- [x] /papic/pool — OFFLINE: NOT NEEDED (a live gallery) · SHAPE: PAGE → FULL-SCREEN POPUP (DIFFERS, A4-81)
- [x] /papic/seat/[token] — OFFLINE: NEEDED (crew shooting in the hall) — queue as /papic/guest; cannot be opened with no signal · SHAPE: PAGE = PAGE (the crew return by the seat link)
- [x] /papic/try — OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE (lives at app/(shell)/papic/try)
- [x] /samahan/join/[token] — OFFLINE: NOT NEEDED · SHAPE: PAGE = PAGE
- [x] /wall/[eventId] — OFFLINE: NOT NEEDED (live wall never saved; freezes on last frame) · SHAPE: PAGE = PAGE

## Phase B progress (on the copy; SOURCE: SEEN)

Each line: **sizes** 375 · 768 · 1280, light and dark asked of the browser · **DARK** · **buttons N · pressed N · failed N** (375 / 1280 where they differ) · time to DOM (calm / during A4-B01). Pages reached by a real token need a token the seed does not hand to area 4; these lines walk the door a person reaches with a dead or missing token, which is what a stranger, a forwarded link or an old QR shows.

- [x] /live — sizes ok · DARK: self-forced dark (same in both) · buttons 3 · pressed 3 · failed 1 (Connect gives no pressed state, A4-B04) · 0.6–0.9 s
- [x] /live/screen — not paired → shows /live's form (by design) · DARK: self-forced dark · buttons 3 · pressed 3 · failed 0 · 1.1–1.5 s
- [x] /wall/[eventId] — sizes ok · DARK: self-forced dark · buttons 3 · pressed 3 · failed 1 (a non-uuid address says "Something hiccuped", A4-B07) · 0.6–1.1 s
- [x] /claim/[token] (dead) — sizes ok · light only (signed out) · buttons 2 · pressed 2 · failed 0 · 4.8 s calm, 16–26 s in the stall (slow, A4-B01)
- [x] /join/[eventId] — guest-list-only event forwards to its Hub (by design, `anyoneMayAskToJoin`); dead id "This invite link isn't valid" · buttons 2 · pressed 2 · failed 0 · 0.6–1.1 s · A4-06 NOT reproduced: no seeded event is "Anyone, I approve", and a checker does not change a shared event's setting
- [x] /join/[eventId]/connect/confirm — signed out → /login?next=/join/<id>/connect (the route handler; returns there) · signed in as `guest` → /dashboard (no seat to link)
- [x] /join/[eventId]/set-password — signed out → /login?next=…/set-password (phase A's "next dropped" is NOT seen: the next is kept) · signed in: buttons 4 (field, Show password, Set password, Skip for now) + wordmark · pressed 4 (Show → field turns to text and the button says Hide; Set password with "abc" → the checklist says "Weak password · 8 or more characters" and nothing is saved; Skip; wordmark) · failed 1 (Skip lands on a 404, A4-B09) · a valid Set password not pressed (would change the shared `guest` sign-in)
- [x] /join/[eventId]/success — signed out → /login with no return path (confirmed) · signed in: → /join/<id> → the Hub
- [x] /join/crew/[token] (dead) — sizes ok · light only · **buttons 0** (A4-B02) · 0.7–0.9 s
- [x] /panood/cam/[token] (dead) — sizes ok · light only · buttons 2 · pressed 2 · failed 1 (a dead token greeted as valid, A4-B03) · 0.8 s
- [x] /samahan/join/[token] (dead) — sizes ok · light only · buttons 2 · pressed 2 · failed 0 · 0.7–1.1 s
- [x] /papic/claim/[token] (dead) — sizes ok · light only · buttons 2 · pressed 2 · failed 1 (A4-B03; the press took 45 s in the stall) · 0.7–1.1 s
- [x] /papic/decorate (no session) — sizes ok · light only · buttons 1 (wordmark only) · pressed 1 · 0.7–0.9 s
- [x] /papic/demo/[token] (expired) — sizes ok · light only · buttons 1 (wordmark only) · pressed 1 · 1.8–3.4 s calm, up to 37 s in the stall · its words send people to "the Papic tile on the Setnayan homepage"; the try-with-a-friend demo is drawn client-side and could not be confirmed from the HTML (unverified, not counted)
- [x] /papic/guest (no session) — sizes ok · light only · buttons 1 (wordmark only) · pressed 1 · 0.7–1.0 s
- [x] /papic/join/[token] (dead) — sizes ok · light only · buttons 1 (wordmark only) · pressed 1 · 2.5–24 s (one 120 s time-out in the stall)
- [x] /papic/lightcheck — sizes ok · light only · buttons 5 · pressed 5 · failed 0 (fake camera: "ImageCapture.takePhoto(): OK") · 0.4–0.9 s · A4-73 CONFIRMED: a public operator tool, "Throwaway diagnostic", reachable by anyone
- [x] /papic/me/[token] (dead) — sizes ok · light only · buttons 1 (wordmark only) · pressed 1 · 3.8–16 s (slow, A4-B01)
- [x] /papic/order/[token] — **404 on the copy**: `NEXT_PUBLIC_PAPIC_GUEST_BUY` is off here, so A4-64/77/78 stay latent (code-only, behind the flag)
- [x] /papic/pool (no session) — **404 "This page doesn't exist on Setnayan"** under the tab title "Everyone's photos · Papic · Setnayan" (A4-B08)
- [x] /papic/seat/[token] (dead) — sizes ok · light only · buttons 2 · pressed 2 · failed 1 (greeted as valid, lands on /papic/claim/<token>?state=invalid, A4-B03) · 0.6–0.8 s
- [x] /papic/try — sizes ok · light only (signed out) · buttons 11 at 375 / 24 at 1280 · pressed 8 (5 look chips: each marks itself pressed and changes its line; the link; Sign in; wordmark) · failed 0 · ☰ and Search under 44 px (shell, area 1) · 0.6–0.9 s
- [ ] /[slug] and its 14 pages, /[slug]/hub — WAITING on A4-B01 (every Hub address answers 500 since 07:19 UTC). Seen once at 06:45: /[slug] signed out at all six views (shots/area-4), /[slug]/everyone 200 in 110 s.

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

### Phase B findings (SOURCE: SEEN on the copy)

```
ID        A4-B02
PAGE      /join/crew/[token]   (a crew QR that does not exist: /join/crew/zzz)
BUTTON    none — the page has 0 controls
STEPS     1. Open /join/crew/zzz at 375, 768 and 1280.
EXPECTED  A dead link says so and offers one way on (the wordmark home at least, like /join/zzz "Back home").
ACTUAL    "This QR does not open anything / Ask the shop for their crew QR for this event — it may have been replaced." and nothing to press: no wordmark, no Back home. Every other dead door in the area offers one (claim, join, samahan: "Back home"/"Go home").
SHOTS     375 px light
RULE      Kit § 5 item 2 (no dead end) · Add 2 EFFECTIVE (no dead end)
SEVERITY  broken
SOURCE    SEEN
```

```
ID        A4-B03
PAGE      /panood/cam/[token] and /papic/claim/[token]   (a token that does not exist: zzz)
BUTTON    "Sign in to join this camera" / "Join & open my camera" · "Start shooting"
STEPS     1. Open /panood/cam/zzz signed out, then signed in as `guest`. 2. Open /papic/claim/zzz and press "Start shooting".
EXPECTED  A link that opens nothing says so on arrival, before asking for a sign-in or a press.
ACTUAL    /papic/seat/zzz too ("Claim your photo-crew seat · Start shooting" → /papic/claim/zzz?state=invalid). /panood/cam/zzz greets the person as valid: "You're invited to operate a camera … Sign in to join this camera"; after sign-in "Join as a live camera … Join & open my camera". /papic/claim/zzz says "Claim your photo-crew seat … Start shooting"; only after the press (45 s during the A4-B01 stall) does it land on ?state=invalid "This link isn't active". The person signs in or waits for nothing.
SHOTS     375 px light (both screens)
RULE      Add 2 EFFECTIVE · honest states (CLAUDE.md §5 rule 4)
SEVERITY  wrong
SOURCE    SEEN
```

```
ID        A4-B04
PAGE      /live   (Live Watch: connect a screen)
BUTTON    "Connect"
STEPS     1. Open /live. 2. Type ZZZ999. 3. Press Connect.
EXPECTED  The button looks pressed at once (pending), then "that code doesn't work" (`/live?error=code`).
ACTUAL    The button stays exactly as it was (not disabled, no busy state, same word) and nothing changed for 60 s while the copy's database stalled (A4-B01): the person cannot tell the press was taken and presses again. An empty press relies on the browser's own "Please fill out this field." bubble.
SHOTS     375 px dark (the page draws its own dark)
RULE      Kit § 5 item 10 (a press should look pressed at once)
SEVERITY  look
SOURCE    SEEN
```

```
ID        A4-B05
PAGE      /[slug]   (stg-bea-paolo, signed out; seen at 06:45 UTC while it loaded)
BUTTON    none
STEPS     1. Open /stg-bea-paolo at 1280 and 375.
EXPECTED  Desktop words for desktop; one frame per block.
ACTUAL    (a) At 1280 the cover still says "SWIPE UP FOR THE EVENT" — there is no swipe with a mouse; it should read "Scroll for the event" on a pointer screen. (b) THE VENUE card holds a second bordered grey box ("RECEPTION · Hardin ng Tagaytay Events Place"): a frame inside a frame. (c) "THE ENTOURAGE" eyebrow sits flush under the venue card with no gap (should be 24). (d) At 1280 it is the phone column in a wide white page (Add 2 BALANCED), at 768 likewise.
SHOTS     shots/area-4/home-375-light.png · home-1280-light.png
RULE      Add 2 CLEAN / BALANCED · Add 7 (tablet designed for)
SEVERITY  look
SOURCE    SEEN
```

```
ID        A4-B06
PAGE      /wall/[eventId] and /live   (the venue-screen code pages)
BUTTON    the page text
STEPS     1. Open /wall/zzz and /live.
EXPECTED  Words that fit every event type (a debut, a birthday, a reunion).
ACTUAL    "Enter the screen code from the couple's Setnayan dashboard." · "Type the code shown under Venue screens in the couple's Live Studio controller." Same pattern as A4-08/16/48 ("the couple" on every event type). /wall/zzz also carries the generic tab title "Setnayan · The home of every Filipino celebration".
SHOTS     375 px light
RULE      brand.md (event words) · A4-08 pattern
SEVERITY  wrong
SOURCE    SEEN
```

```
ID        A4-B07
PAGE      /wall/[eventId]   (an address whose id is not an event id: /wall/zzz)
BUTTON    "Start Memory lane"
STEPS     1. Open /wall/zzz. 2. Type ZZZ999. 3. Press Start Memory lane.
EXPECTED  "This screen link is wrong — open it again from the host's dashboard" (or the code-mismatch line).
ACTUAL    The form is drawn for an event that does not exist, and the press answers "Something hiccuped — try again." (any non-401 from /api/wall/claim). A wrong link is told it is a passing fault, so the person at the projector keeps retrying. With a well-formed id the same press reads the 401 line. Anchor: `apps/web/app/wall/[eventId]/_components/wall-claim.tsx` "Something hiccuped — try again.".
SHOTS     1280 px (a projector)
RULE      honest states (CLAUDE.md §5 rule 4)
SEVERITY  wrong
SOURCE    SEEN
```

```
ID        A4-B08
PAGE      /papic/pool   (opened with no Papic session, e.g. a forwarded link)
BUTTON    none
STEPS     1. Open /papic/pool signed out with no pass.
EXPECTED  The same door as /papic/guest and /papic/decorate: "Open your invitation first. Scan your personal QR or open your invite link…".
ACTUAL    The site 404 page "This page doesn't exist on Setnayan … Take me home / Browse suppliers", HTTP 404, while the tab reads "Everyone's photos · Papic · Setnayan". A guest who saved the album link is told it never existed.
SHOTS     375 px light
RULE      honest states · Add 2 EFFECTIVE (one way per door)
SEVERITY  wrong
SOURCE    SEEN
```

```
ID        A4-B09
PAGE      /join/[eventId]/set-password   (signed in as `guest`, a guest of the event, not a host)
BUTTON    "Skip for now" (and Save, which falls back to the same place)
STEPS     1. Sign in as `guest`. 2. Open /join/<eventId>/set-password. 3. Press "Skip for now".
EXPECTED  The guest lands on the event they just joined: its Event Hub (/<slug>), or their own home.
ACTUAL    The link is /dashboard/<eventId> — the HOST's planning page. For a guest it is HTTP 404 "This page doesn't exist on Setnayan" (31 s to answer during A4-B01). The last step of joining ends on a not-found page.
SHOTS     375 px light (the 404 after Skip)
RULE      Kit § 5 item 2 (a link to a 404) · sign-in door
SEVERITY  broken
SOURCE    SEEN
```

```
ID        A4-B10
PAGE      /[slug]   (the supplier desk block, when a supplier's time block has no time)
BUTTON    none
STEPS     1. On a Hub whose supplier desk lists a block with no start/end time, read the time line.
EXPECTED  A plain word: "Time to follow".
ACTUAL    "Time TBD" (`apps/web/app/[slug]/_components/supplier-desk.tsx` `'Time TBD'`): a planner's abbreviation a guest reads.
SHOTS     375 px light
RULE      Add 3 (TBD) · brand.md tone
SEVERITY  look
SOURCE    CODE (phase B grep; seen once the Hub loads)
```

```
NOTE      (not area 4, passed on) /dashboard/[eventId]/guests as messy_one (event M & J, 370 guests): tapping a guest row opens the card sheet full height (not half) and it stayed on "Opening their card…" for 7 s+ at 06:55 UTC; during A4-B01 the page itself did not load in 60 s. Area 2 owns it.
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

### /papic/me/[token]

```
ID        A4-74
PAGE      /papic/me/[token]   (event: stg-mika-turns-7)
BUTTON    the "Memories of you" section (Download, Decorate a photo, Make my Story)
STEPS     1. Open the personal QR page while the `photo_tags` read fails.
EXPECTED  "Couldn't read your photos", distinct from having none.
ACTUAL    `getGuestLiveGallery` returns null on failure (`if (tagsError) return null;`) and `GuestGallery` treats it as empty (`if (!gallery || gallery.photos.length === 0) return null;`): the whole section with Download, Decorate and Story silently disappears. Anchors: `apps/web/lib/guest-live-gallery.ts` `getGuestLiveGallery`; `apps/web/app/papic/me/[token]/page.tsx` `GuestGallery`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-75
PAGE      /papic/me/[token]   (event: stg-mika-turns-7)
BUTTON    "Make my Story"
STEPS     1. Tap "Make my Story" while the `guests` read in `prepareGuestStory` errors.
EXPECTED  "Couldn't load your photos".
ACTUAL    `const { data } = await admin.from('guests')…; if (!data) return empty;` returns `taggedPhotoCount: 0`, so the maker says "No tagged photos of you just yet. Once you're tagged in a few, come back…". Anchor: `apps/web/app/papic/me/[token]/actions.ts` `prepareGuestStory`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-76
PAGE      /papic/me/[token]   (event: stg-mika-turns-7, a guest with tagged photos)
BUTTON    "Open my camera" and "Make my Story"
STEPS     1. Open the personal QR page as a guest with tagged photos.
EXPECTED  One accent-filled main button per screen.
ACTUAL    `className="button-primary w-full gap-2"` (Open my camera, `page.tsx`) and `className="inline-flex … rounded-md bg-mulberry px-4 py-2.5 … text-cream"` (`guest-story-maker.tsx`, phase `idle`) inside the same DoorShell card.
SHOTS     375 px light
RULE      K1
SEVERITY  look
SOURCE    CODE
```

### /papic/order/[token] (flag NEXT_PUBLIC_PAPIC_GUEST_BUY; otherwise 404)

```
ID        A4-77
PAGE      /papic/order/[token]
BUTTON    the payment rails' "Exact amount" and its Copy
STEPS     1. Open an order whose `requested_total_php` is unreadable or absent.
EXPECTED  No ₱0 anywhere; the copy control hidden (the header already does this: `formatPhp(amount)` shows "—").
ACTUAL    `amountPhp={amount ?? 0}` is passed to `PayRailsBlock`; `PaymentDetailsBlock` draws `payAmount(0)` ("₱0.00") with `<CopyButton value={amountPhp.toFixed(2)} />` ("0.00"). `mintOrderQr` refuses 0, so no ₱0 QR is minted. Anchor: `apps/web/app/papic/order/[token]/page.tsx` `amountPhp={amount ?? 0}`.
SHOTS     375 px light
RULE      CLAUDE.md §1 ("never ₱0" on a failed read) · §5 rule 4
SEVERITY  money-signin
SOURCE    CODE
```

```
ID        A4-78
PAGE      /papic/order/[token]
BUTTON    "What you've logged" section and "Log my payment"
STEPS     1. Log a payment. 2. Reload the order while the `payments` read errors.
EXPECTED  "Couldn't read your logged payments", so the guest does not log the same transfer twice.
ACTUAL    `const [{ data: payments }, settings] = await Promise.all([ admin.from('payments')…` ignores `error`; `{(payments ?? []).length > 0 ? (` hides the section and "Already sent it?" is still offered. Anchor: `apps/web/app/papic/order/[token]/page.tsx` `admin.from('payments')`.
SHOTS     375 px light
RULE      Honest states (money)
SEVERITY  money-signin
SOURCE    CODE
```

### /papic/pool

```
ID        A4-79
PAGE      /papic/pool   (event: stg-mika-turns-7 with `pool_gallery_open`)
BUTTON    "Browse everyone's photos" (on /papic/me)
STEPS     1. Tap the doorway while the `events` read errors.
EXPECTED  A "couldn't load" state (the page already has `initialUnreadable` for the tiles).
ACTUAL    `const { data: ev } = await admin.from('events')…; if (!ev?.pool_gallery_open) notFound();` turns a failed read into a 404. Anchor: `apps/web/app/papic/pool/page.tsx` `pool_gallery_open`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-80
PAGE      /papic/pool   (event: stg-mika-turns-7)
BUTTON    "Load more"
STEPS     1. Tap "Load more" while `/api/papic/guest-pool` returns a 5xx or HTML, or the fetch throws.
EXPECTED  "Couldn't load more · Try again", with the button kept.
ACTUAL    `} else { setCursor(null); }` makes the button vanish as if the list had ended; a thrown fetch hits an empty `catch {}`. Anchor: `apps/web/app/papic/pool/_components/pool-grid.tsx` `loadMore`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

```
ID        A4-81
PAGE      /papic/pool   (event: stg-mika-turns-7)
BUTTON    "Browse everyone's photos"
STEPS     1. Tap it on /papic/me.
EXPECTED  SHAPE tests: a photo gallery, not shared (the URL carries no identity) → FULL-SCREEN POPUP over /papic/me; ✕ returns to the same place.
ACTUAL    A two-hop navigation to a standalone `<main className="min-h-screen bg-cream px-4 py-8 text-ink">`. Anchor: `apps/web/app/papic/pool/page.tsx`.
SHOTS     375 px light
RULE      SHAPE
SEVERITY  look
SOURCE    CODE
```

### /papic/seat/[token]

The loading skeleton is in A4-68; the ✕ offline issue in A4-70; Add credits in A4-62 and A4-64.

```
ID        A4-82
PAGE      /papic/seat/[token]   (event: stg-carla-miguel, a claimed seat)
BUTTON    page load / "Open my camera"
STEPS     1. Open your claimed seat while the `paparazzi_seats` read errors.
EXPECTED  "We couldn't check your seat · Try again" (the claim page has `?state=unreadable` for this).
ACTUAL    `if (error || !seat || seat.claimer_user_id !== user.id) { redirect(`/papic/claim/${token}`); }` sends the rightful claimer back to "Claim your photo-crew seat" with no explanation. Anchor: `apps/web/app/papic/seat/[token]/page.tsx` `seat.claimer_user_id !== user.id`.
SHOTS     375 px light
RULE      Honest states
SEVERITY  wrong
SOURCE    CODE
```

### /papic/try

```
ID        A4-83
PAGE      /papic/try (also /papic)
BUTTON    the line under the demo photos
STEPS     1. Run the demo with two phones and take a shot.
EXPECTED  No line that implies Papic does not cap shots (shots are metered by the event pool).
ACTUAL    `` `${remaining} demo shot${…} left — the demo caps this, not Papic.` ``; the truth guard's "unlimited" rule only matches the literal word. Anchor: `apps/web/app/(shell)/papic/_papic-scan.tsx` "the demo caps this, not Papic".
SHOTS     375 px light
RULE      brand.md claims (price promises)
SEVERITY  wrong
SOURCE    CODE
```

## Owner adds 1–10b (phase B)

**Add 1 · Shape.** Marked per page in Progress (phase A). Seen on the copy: the 22 non-Hub doors are PAGEs and should be (each is reached by a shared link or QR). The 6 that differ stand as phase A wrote them (A4-32, 41, 55, 69, 73, 81). Seen in passing, not area 4: the couple's guest card opens full height, not half (passed to area 2).

**Add 2 · Clean / balanced / effective** (non-Hub doors):
- `/live`, `/wall`: CLEAN ok · BALANCED ok · EFFECTIVE fails: no pressed state (A4-B04), a wrong link called a hiccup (A4-B07).
- dead doors (`/claim`, `/join`, `/samahan/join`): ok on all three.
- `/join/crew` dead: EFFECTIVE fails, no way on (A4-B02).
- Papic dead doors (`/papic/guest`, `/decorate`, `/join`, `/me`, `/demo`): CLEAN ok · BALANCED ok · EFFECTIVE fails: the wordmark is the only way on (phase A "doors with no button").
- `/papic/claim`, `/papic/seat`, `/panood/cam` with a dead token: EFFECTIVE fails, the door asks for a press that cannot work (A4-B03).
- `/papic/try`: CLEAN ok · BALANCED ok at 375, desktop is the phone column centred · EFFECTIVE ok.
- `/[slug]`: A4-B05 (desktop "swipe up", a frame in a frame, a missing gap, phone column on desktop). The rest waits on A4-B01.

**Add 3 · Placeholders.**
- Code grep over the area's routes (`lorem|TODO|TBD|XXX|coming soon|john doe|juan dela cruz|your name here|beta`):
  - "The app is coming soon" (`/papic/join` banner) — already A4 phase A;
  - "Time TBD" on the supplier desk of a Hub (`app/[slug]/_components/supplier-desk.tsx` `'Time TBD'`) when a block has no time — a developer word a guest can read; should say "Time to follow" (A4-B10, look);
  - the empty "Photo moments" grey sample bars are hidden from guests (`hideWhenEmpty={guestView}`), so not a finding;
  - the `e.g. Maria Teresita Aquino-Reyes` field hint reads as a hint, not a finding.
- Seen on the copy: `/papic/lightcheck` "Throwaway diagnostic" is a public developer page (A4-73). No lorem, no ₱X, no made-up counts on the doors walked.

**Add 4 · Where area 4 sells** (a guest never buys a plan; these are the only money points a guest meets):

| Route | What | Price shown | How reached | On the copy |
|---|---|---|---|---|
| `/papic/order/[token]` + "Add credits" on the guest camera | Papic photo credits bought by a guest | from code, not the catalogue (A4-64) | camera › out of credits › Add credits | **off**: `NEXT_PUBLIC_PAPIC_GUEST_BUY` unset, the route 404s; A4-64/77/78 stay latent |
| guest camera / "Add from your phone" when the event pool is empty | the wall: "The event's credits ran out, so these shots are kept on this phone…" / "Out of Credits" | none (the guest is not the buyer; the line tells them the hosts add more) | the camera | waits on a seeded event with an empty pool and a Hub that loads |
| `/[slug]/pabuya` (E-Gifts) | a guest's gift to the host (not a Setnayan sale): bank / GCash details | the guest types the amount | Hub › E-Gifts | waits on A4-B01 |

Taps from the wall to "payment logged": not measurable on the copy (the guest buy is off). Never paid anything.

**Add 5 · Easy to handle** (guest jobs):
- Connect a venue screen (`/live`): OK. Two taps, but a press gives no feedback (A4-B04) and the field takes 12 characters with `autocomplete=off` (right).
- Join an event and set a password (`/join` › set-password): HARD. The last step, Skip, lands on a 404 (A4-B09).
- Claim a crew seat with an old link (`/papic/claim`, `/papic/seat`): HARD. It asks for a press, then says the link is dead (A4-B03).
- Open the invitation, reply, find my seat, shoot photos: wait on A4-B01.

**Add 6 · Buttons.** Counted per page in Phase B progress (375 / 1280). Running total for the 22 non-Hub pages: controls 51 at 375 (64 at 1280: `/papic/try` adds the shell's desktop menu) · pressed 51 · failed 6 (A4-B03 ×3, A4-B04, A4-B07, A4-B09). The wordmark and "Back home" links were checked by their destination (`/` answers 200), not clicked one by one. Not pressed: a valid "Set password" (would change the shared `guest` sign-in).

**Add 7 · Sizes and dark.**
- 375 · 768 · 1280 walked on every non-Hub page: no sideways scroll, nothing cut off, no bar overlap. Desktop on these doors is a centred phone card in an empty page (fine for a one-step door).
- DARK: `/live`, `/live/screen`, `/wall` draw their own dark always (a venue screen) · every other page in the area is signed-out and **light only** (19 pages counted, not reported) · the guest Event Hub wears the couple's theme in both settings (by design, DARK_MODE_STANDARD §1).
- Home shots: `shots/area-4/home-{375,768,1280}-{light,dark}.png` — the Event Hub /stg-bea-paolo at 06:45 UTC; light and dark are the same picture (the couple's theme).

**Add 8 · Reveals.** Area 3 owns the list and the Maker. On the guest side: /stg-carla-miguel opened with "Tap or swipe up to unveil" at 06:45 (one reveal, the couple's choice). Playing every reveal at 3 sizes waits on A4-B01.

**Add 9.** Not area 4.

**Add 10 · Offline — beyond the five.** (The five include "guests at the venue: the Event Hub and the walk-in hub", so the Hub, `?tab=me`, find-my-table, the seat pages and the guest camera are NOT listed here; phase A marked them.)

Guest:

| Part | When the signal drops | Level | Why |
|---|---|---|---|
| `/[slug]/invite/reply` (the reply) | on the road, in a province with weak data, days before | SAVE AND SYNC | A tita answers on a jeepney; a lost reply is a guest the hosts chase by hand. |
| `/[slug]/welcome` (name the plus-one) | weak data, before the day | SAVE AND SYNC | Same: one short form; losing it means a nameless seat. |
| `/[slug]/pabuya` (E-Gifts details) | at the venue, in the money dance | READ-ONLY | The bank or GCash details must show so the guest can send later; the transfer itself needs signal anyway. |
| `/papic/me/[token]` (my camera and my photos, from the pass) | at the venue door and tables | READ-ONLY | It is the door to the camera; with no copy the QR on the pass opens the browser's error page. |
| `/join/crew/[token]` (crew run of show) | back of house at the venue | READ-ONLY | A crew member re-checks the call time with no signal. |
| `/[slug]/print` (print my photos) | after the event, at home | NOT NEEDED | — |

Event Hub (host side seen by guests): covered by the five.

Offline tried on the copy: waits on A4-B01 (the Hub must load once with signal before a copy exists). Pages that need no Hub were checked in phase A from `sw.js`: none of `/papic/*`, `/join/*`, `/claim/*`, `/live*`, `/wall/*` is kept; with no signal the browser shows its own error page.

**Add 10b.** Areas 5–7. Not area 4. One guest-side note: a supplier's crew QR (`/join/crew/<token>`) that was replaced shows a page with no button (A4-B02).

## For the browser pass (phase B, on staging)

- **Offline (DevTools offline, 375 px).**
  - Open `/stg-bea-paolo`, `?tab=program`, `?tab=me`, `/find-my-table`, `/find-seat` and `/seat` with signal, then offline. Confirm which ones load (A4-01, A4-23).
  - Install the home-screen tile and open it offline (A4-24).
  - Open the camera, shoot offline, press ✕ (A4-70).
  - Check whether the saved Hub's Live group still holds the camera you can shoot from.
  - Read `NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED` and count the service workers (A4-02).
- **`/find-my-table` copy:** a copy saved the day before shows "seats show on the day". Check it is replaced on the day.
- **Entrance:** on a floor-plan entrance, compare the door on `/find-my-table`, `/find-seat` and `/seat` (A4-33).
- **A4-06:** reproduce with the `guest` account on an "Anyone, I approve" event. Send a request, then open `/join/<eventId>/connect/confirm` directly.
- **A4-30:** check whether a pending join request that answered Yes appears under "Also coming" on `/stg-bea-paolo/everyone`.
- **One main button (K1):**
  - Me on `/stg-bea-paolo`, both for a guest who owes a reply and for one who said Yes;
  - `/invite/enter` for a signed-in guest whose seat is not linked (A4-39);
  - `/papic/me` with tagged photos (A4-76);
  - the Papic pool's "In your Memories" toggles.
- **Layers (K3):**
  - selfie ⓘ backdrop tap (A4-17);
  - phone Back inside Relive and the suppliers sheet (A4-18);
  - My QR at 375 px (A4-20);
  - the `/find-seat` door pass: scroll behind, Esc, Back (A4-36);
  - My shots ✕ reach and stacking with Add from your phone (A4-62, A4-63);
  - `TicketPopup` together with the Yes celebration on the first arrival.
- **Live screens:** pull the TV's or projector's network for about 20 s on `/live/screen` and `/wall/<id>`. Does it keep its frame, recover, or land on the browser's error page? Try `/wall/zzz` (an id that is not a uuid).
- **Doors with no button:** the Papic dead ends (claim taken, seat reissued, join/me/demo invalid, decorate/pool with no session) only offer the wordmark to `/`.
- **Flags to read on the preview:**
  - `PABUYA_PUBLIC_ROUTE_ENABLED` (`/pabuya` returns 404 when it is off);
  - `NEXT_PUBLIC_PAPIC_GUEST_BUY` (`/papic/order`, Add credits);
  - `guestAvatarsEnabled` (`/avatar`);
  - `dependentPeopleEnabled` (`/claim`);
  - whether `CUSTOM_QR_GUEST` is owned on stg-carla-miguel (`/seat`).
- **Addresses:** personal links and QR codes on `/welcome`, `/find-seat` and `/request` must not show `*.vercel.app` (the fallback when `NEXT_PUBLIC_APP_URL` is unset).
- **Sign-in returns:** `/join/<id>/set-password` through the login bounce (`?next=` is dropped); `/join/<id>/success` signed out (no return path).
- **Speed:** check `/papic/guest` and `/papic/seat` on slow 3G. They show a cream skeleton, then a black camera (A4-68).
