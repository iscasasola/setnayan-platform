FIXER: batch 5 of ~6 · #8313 (b1) ready · #8316 (b2) ready · #8317 (b3) ready · #8339 (E-01, L-01, L-02, L-05) ready · #8357 (money rows I-01, E-03, E-13, I-03, M-02, M-03, S-01, I-02; draft, preflight running) · 🟠 I-02 lock+door (drawing), M-02 sheet layering (lane B), S-01 two Setnayan AI prices (which price), E-13 unread plan upsell/cap (plan rule) · next: L-02 rest, L-08, I-07 rest, E-05, S-05, N-08, E-16 story authors
STATUS: phase B done — 56 of 59 pages walked at 375 / 768 / 1280, light and dark (3 did not open within 180 s on the loaded copy: /apple-pro, /studio/panood/broadcast, /panood/control) · 13 forwards land (§ Forwards) · presses at 375: buttons 766 · pressed 137 · no visible change or blocked 140 (explained under N-13's notes) · left 62 (writes: save, send, publish, pay, delete) · the rest are the invitation's per-guest repeats past the first 40 and pages that forwarded · findings: phase A 78 (B-01 confirmed; 16 more confirmed SEEN) + phase B 13 new (blocker 1 · money-signin 1 · broken 1 · wrong 5 · look 5) · Adds 1–8 and 10 written; Add 9 / 10b not area 3.

# Final check · Area 3 — Couple: Maker, Event Hub page, invitations, Papic, Memories

> Checker 3 of 8. REPORT ONLY. Pinned commit `fb3f72d` (main frozen). Kit: `build-sessions/FINAL-CHECK-KIT.md` §§ 3–6.
> Phase A = code pass (`SOURCE: CODE`); phase B = browser walk on staging as `couple_maker` (`SOURCE: SEEN`).
> Seeded events for this area: **Carla & Miguel** (`stg-carla-miguel`, wedding, Event Plus PAID, public Event Hub),
> **Mika turns 7** (`stg-mika-turns-7`, birthday 30 days ago: Memories, recap), the demo event.
> Standards read: corpus `HOUSE_DESIGN_STANDARD_2026-11-20.md` (Parts D, E, F, I, K), `DARK_MODE_STANDARD_2026-11-20.md`,
> `MOTION_STANDARD_2026-11-18.md`, `docs/brand.md`.

## Lock proof (phase B step 0)

- **Upload:** 25 Nov 2026 06:46:56 UTC, signed in as `couple_maker`, one 64 × 64 px JPEG (692 bytes) through Memories › Add photos on Carla & Miguel. Result "1 added to your Memories", credits 50 → 47.
- **Object path (seen in the network):** `/api/upload` returned a presigned PUT to the `setnayan-media` bucket at **`staging/final-check/papic/event-<carla-miguel id>/seat-…/…-upload-….jpg`**, and the PUT answered 200. **The object sits under `staging/final-check/`. Lock holds.**
- **Stored key:** the save action records `r2://setnayan-media/papic/event-…/…jpg` with no prefix: the lock adds the prefix in the storage client, so the database row carries the plain key. Not a finding, noted so area 8 is not surprised by it.
- **Preview:** `/api/health` reports `bd86936`, env `preview`.

## Phase B status (browser walk)

- Walking the staging copy as `couple_maker` at 375 / 768 / 1280, light and dark, one page load per page (width and theme switched in place: dark is the `html.dark` class the `sn-theme` cookie sets on `DARK_READY` routes).
- **The copy is very slow under the eight checkers:** the first byte of a signed-in page takes 30–130 s (health answers in 0.6 s, so it is the database side). Load times below are measured under that load and are NOT speed findings on their own.
- **Twice a slow page sent the signed-in couple to `/login?next=/dashboard`** (guests/invite at 768, guests/send in dark): the middleware session check (`lib/supabase/middleware.ts`, `withBudget` / `SESSION_CHECK_BUDGET_MS`) treats a check that runs out of time as "nobody is signed in", by design. Logged as N-01 below.

## Phase A summary (code pass, 25 Nov 2026)

- **Pages:** 59 of 59 checked, plus 13 of 13 forwards. Every finding below is `SOURCE: CODE`; phase B confirms or strikes each one.
- **Findings (78):** blocker 1 · money-signin 19 · broken 18 · wrong 23 · look 17. Repeats of one problem across one group are folded into one entry.
- **OFFLINE (59 pages):** NEEDED 8 · READ-ONLY 35 · NOT NEEDED 16. The 8 NEEDED pages are the Panood controller and program window, `/live`, Live Watch setup and broadcast (flag off), Papic challenges and run-of-show, and the Patiktok booth. Each is used at the venue on the day, so I disagree with the plan's read-only copy for them. `/panood/control` needs queued writes and an offline sign at the least.
- **SHAPE (59 pages):** 18 differ today. 3 entries are forwards, not pages (library, live-studio-control/setup, studio/panood). The rest match.
- **Worst first:** B-01 (Story Assignments cannot assign anyone) · L-01/L-02 (the live controller says done or "Off air" after a failed write or read) · E-10 (a story save after a failed read wipes the moments) · I-01 (E-Gift accounts read as "none yet" on a failed read) · M-01/P-04 ("free, for life" and a flat 3 months, against brand.md claim 3) · E-01 (Event Hub saves that land as saved after failing).
- **Phase B notes:** `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED`, `NEXT_PUBLIC_LIFE_STORY` and `GUEST_COLUMNS_ENABLED` change what opens. Pakanta and Patiktok open only for an owner. Couples are sent from `/monogram` and `/studio/mood-board` into the Maker. Phase B will need an event without an Event Hub, or a coordinator, to reach those.

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
SOURCE    CODE + SEEN (25 Nov, staging copy: Carla & Miguel's Guests page reads "61 coming"; Story Assignments shows "No guests to assign" on all 10 moments. A1-056 / live fault B-01 confirmed on the copy.)
```


#### B-02 · Every guest Event Hub answers 500 after ~23.6 s on the copy (seen 25 Nov, about 09:00 UTC onward)

```
PAGE      /stg-carla-miguel · /stg-bea-paolo · /stg-mika-turns-7   (signed out, as a guest)
BUTTON    the Event Hub link itself
STEPS     1. Signed out, open any seeded Event Hub. 2. Wait.
EXPECTED  The cover and the opening reveal ("Tap or swipe up to unveil"), as at 06:56 UTC the same day.
ACTUAL    HTTP 500 every time, each after 23.6–23.8 s (same length on all three hubs, five tries). The guest sees the
          error page "Still opening your invitation… This is taking a little longer than usual. One moment." with a
          disabled "Opening…" button and a reference number. Inside the Maker, the hub's own preview frames
          (`/stg-carla-miguel?phase=save_the_date&editor=1&tabs=1`, `?phase=rsvp…`, `/stg-mika-turns-7?phase=editorial…`)
          also answered 500, and the Maker logged "An error occurred in the Server Components render".
          At the same moment `/pricing` answered 200 in 46 s and `/api/health` in 0.6 s.
CAUSE?    Not proven. The equal 23.6 s on every hub looks like a fixed time limit inside the hub's render being hit
          while the shared copy is under the eight checkers' load. If it is only load, it is still a finding: under a
          slow database the guest gets an error page, not the saved copy or a slower page. Area 4 should re-check
          when the copy is quiet; area 3 will re-check before closing.
SHOTS     375 px light (the error page)
RULE      Kit § 5 item 1 (no 5xx, no error screen) · CLAUDE.md §5 rule 4 (honest states)
SEVERITY  blocker
SOURCE    SEEN
```

## Progress

Marks: **OFFLINE** NEEDED (where signal is lost) / READ-ONLY / NOT NEEDED · **SHAPE** today → should.

### Pages (59)

- [x] /dashboard/[eventId]/alaala · OFFLINE READ-ONLY · SHAPE PAGE → PAGE · **B** Carla: opens · DARK no · controls 375 25 / 1280 35 · in-page: buttons 1 · pressed 1 · failed 0 · left 0 (writes: save/send/publish/pay/delete) · links 13 (read, destinations in the walk)
- [x] /dashboard/[eventId]/alaala/assignments · OFFLINE NOT NEEDED · SHAPE PAGE → FULL-SCREEN POPUP (differs) · BLOCKER B-01 · **B** Carla: opens · DARK no · controls 375 12 / 1280 22 · in-page: buttons 1 · pressed 1 · failed 0 · left 0 (writes: save/send/publish/pay/delete) · links 1 (read, destinations in the walk)
- [x] /dashboard/[eventId]/apple-pro · OFFLINE NOT NEEDED (App Store purchase) · SHAPE PAGE → FULL-SCREEN POPUP (differs, unsure: a page today to keep StoreKit off the Maker's first load) · **B** Carla: did not open in 180 s on the copy (load) — not walked
- [x] /dashboard/[eventId]/event-qr · OFFLINE READ-ONLY (shown to the crew at the venue: it must be in the saved copy) · SHAPE PAGE → PAGE · **B** Carla: opens · DARK no · controls 375 13 / 1280 23 · in-page: buttons 3 · pressed 2 · failed 0 · left 1 (writes: save/send/publish/pay/delete) · links 0 (read, destinations in the walk)
- [x] /dashboard/[eventId]/galleries · OFFLINE READ-ONLY · SHAPE PAGE → PAGE · **B** Mika: opens · DARK no · controls 375 15 / 1280 25 · in-page: buttons 1 · pressed 1 · failed 0 · left 0 (writes: save/send/publish/pay/delete) · links 4 (read, destinations in the walk) · Carla: opens · DARK no · controls 375 15 / 1280 25 · in-page: buttons 1 · pressed 1 · failed 0 · left 0 (writes: save/send/publish/pay/delete) · links 4 (read, destinations in the walk)
- [x] /dashboard/[eventId]/guests/invite · OFFLINE READ-ONLY · SHAPE PAGE → PAGE · **B** Carla: opens · DARK no · controls 375 21 / 1280 31 · in-page: buttons 5 · pressed 2 · failed 0 · left 3 (writes: save/send/publish/pay/delete) · links 6 (read, destinations in the walk)
- [x] /dashboard/[eventId]/guests/send · OFFLINE READ-ONLY · SHAPE hand-built full-screen layer at its own address → FULL-SCREEN POPUP (RiseScreen) (differs) · **B** Carla: opens · DARK no · controls 375 18 / 1280 28 · in-page: buttons 1 · pressed 0 · failed 1 · left 0 (writes: save/send/publish/pay/delete) · links 0 (read, destinations in the walk)
- [x] /dashboard/[eventId]/invitation · OFFLINE READ-ONLY · SHAPE PAGE → PAGE · **B** Carla: opens · DARK no · controls 375 597 / 1280 607 · in-page: buttons 390 · pressed 29 · failed 0 · left 11 (writes: save/send/publish/pay/delete) · links 197 (read, destinations in the walk) (first 40 pressed)
- [x] /dashboard/[eventId]/invitation/print · OFFLINE READ-ONLY · SHAPE PAGE → PAGE (print) · **B** Carla: opens · DARK no · wider than the screen 375px +238 · controls 375 10 / 1280 20 · presses: page redirected before the press pass (counted at its landing page)
- [x] /dashboard/[eventId]/launch · OFFLINE READ-ONLY (planned at home; "Go live" on the day is rare) · SHAPE PAGE → PAGE · **B** Carla: /dashboard/C/launch?tool=details&item=background · DARK no · controls 375 46 / 1280 51 · presses: page redirected before the press pass (counted at its landing page)
- [x] /dashboard/[eventId]/live · OFFLINE NEEDED (at the venue on the day: hiding a photo mid-party; disagree with read-only) · SHAPE PAGE → PAGE · **B** Carla: opens · DARK no · controls 375 20 / 1280 30 · in-page: buttons 10 · pressed 6 · failed 0 · left 4 (writes: save/send/publish/pay/delete) · links 0 (read, destinations in the walk)
- [x] /dashboard/[eventId]/memories · OFFLINE READ-ONLY (mild disagreement: the Papic on/off switch is used at the venue) · SHAPE PAGE → PAGE · **B** Carla: opens · DARK yes · controls 375 29 / 1280 41 · in-page: buttons 15 · pressed 1 · failed 12 · left 2 (writes: save/send/publish/pay/delete) · links 1 (read, destinations in the walk) · Mika: opens · DARK yes · controls 375 28 / 1280 40 · presses: page redirected before the press pass (counted at its landing page)
- [x] /dashboard/[eventId]/memories/download-all · OFFLINE NOT NEEDED · SHAPE PAGE → PAGE · **B** Mika: opens · DARK no · controls 375 12 / 1280 22 · in-page: buttons 2 · pressed 2 · failed 0 · left 0 (writes: save/send/publish/pay/delete) · links 0 (read, destinations in the walk)
- [x] /dashboard/[eventId]/memories/thank-you · OFFLINE NOT NEEDED · SHAPE PAGE → PAGE · **B** Mika: opens · DARK no · controls 375 11 / 1280 21 · in-page: buttons 1 · pressed 1 · failed 0 · left 0 (writes: save/send/publish/pay/delete) · links 0 (read, destinations in the walk)
- [x] /dashboard/[eventId]/monogram · OFFLINE READ-ONLY · SHAPE PAGE → PAGE (a couple with an Event Hub is redirected to Maker › Details › Logo; phase B needs an event without one) · **B** Mika: /dashboard/M · DARK yes · controls 375 57 / 1280 68 · presses: page redirected before the press pass (counted at its landing page) · Carla: /dashboard/C/launch?tool=details&item=logo · DARK no · controls 375 22 / 1280 36 · presses: page redirected before the press pass (counted at its landing page)
- [x] /dashboard/[eventId]/pabuya · OFFLINE READ-ONLY · SHAPE PAGE → PAGE · **B** Carla: opens · DARK no · controls 375 18 / 1280 28 · in-page: buttons 7 · pressed 3 · failed 4 · left 0 (writes: save/send/publish/pay/delete) · links 1 (read, destinations in the walk)
- [x] /dashboard/[eventId]/prints · OFFLINE READ-ONLY · SHAPE PAGE → PAGE · **B** Mika: /dashboard/M/prints?tool=details&item=every-print · DARK no · controls 375 17 / 1280 46 · in-page: buttons 6 · pressed 2 · failed 1 · left 3 (writes: save/send/publish/pay/delete) · links 1 (read, destinations in the walk) · Carla: /dashboard/C/prints?tool=details&item=every-print · DARK no · controls 375 17 / 1280 47 · in-page: buttons 6 · pressed 2 · failed 1 · left 3 (writes: save/send/publish/pay/delete) · links 1 (read, destinations in the walk)
- [x] /dashboard/[eventId]/story · OFFLINE READ-ONLY · SHAPE PAGE → PAGE · **B** Carla: opens · DARK no · controls 375 12 / 1280 22 · in-page: buttons 1 · pressed 1 · failed 0 · left 0 (writes: save/send/publish/pay/delete) · links 1 (read, destinations in the walk) · Mika: did not open in 180 s on the copy (load) — not walked
- [x] /dashboard/[eventId]/studio/about/[addon] · OFFLINE NOT NEEDED · SHAPE PAGE → PAGE (opens for 9 keys; retired → owner redirect; others 404) · **B** Carla: opens · DARK no · controls 375 2 / 1280 2 · in-page: buttons 7 · pressed 1 · failed 4 · left 0 (writes: save/send/publish/pay/delete) · links 2 (read, destinations in the walk) · Carla: opens · DARK no · controls 375 13 / 1280 23 · in-page: buttons 1 · pressed 1 · failed 0 · left 0 (writes: save/send/publish/pay/delete) · links 2 (read, destinations in the walk)
- [x] /dashboard/[eventId]/studio/guest-columns · OFFLINE READ-ONLY · SHAPE PAGE → PAGE (404 unless `GUEST_COLUMNS_ENABLED` and the privacy control are on) · **B** Carla: opens · DARK no · controls 375 2 / 1280 2
- [x] /dashboard/[eventId]/studio/live-studio-control · OFFLINE READ-ONLY · SHAPE PAGE → PAGE · **B** Carla: opens · DARK no · controls 375 17 / 1280 27 · in-page: buttons 4 · pressed 3 · failed 1 · left 0 (writes: save/send/publish/pay/delete) · links 3 (read, destinations in the walk)
- [x] /dashboard/[eventId]/studio/live-studio-control/setup · OFFLINE NOT NEEDED · SHAPE forward (to `/panood/control/[eventId]`; 404 when `NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED` is off; Ugat marks it no-door) → list as a forward · **B** Carla: /panood/control/C · DARK no · controls 375 11 / 1280 11 · presses: page redirected before the press pass (counted at its landing page)
- [x] /dashboard/[eventId]/studio/mood-board · OFFLINE READ-ONLY (also serves the couple-at-an-expo case) · SHAPE PAGE → PAGE (couples are redirected to Maker › Details › Mood board) · **B** Mika: /dashboard/M/launch?tool=details&item=mood-board · DARK no · controls 375 19 / 1280 32 · presses: page redirected before the press pass (counted at its landing page) · Carla: /dashboard/C/launch?tool=details&item=mood-board · DARK no · controls 375 22 / 1280 35 · presses: page redirected before the press pass (counted at its landing page)
- [x] /dashboard/[eventId]/studio/pakanta · OFFLINE NOT NEEDED · SHAPE PAGE → PAGE (retired; owners only — seeded events are bounced to Home) · **B** Carla: /dashboard/C · DARK yes · controls 375 52 / 1280 62
- [x] /dashboard/[eventId]/studio/panood · OFFLINE NOT NEEDED · SHAPE forward (to live-studio-control, or `/studio/panood/setup` with the flag off) · **B** Carla: /dashboard/C/studio/live-studio-control · DARK no · controls 375 17 / 1280 27 · presses: page redirected before the press pass (counted at its landing page)
- [x] /dashboard/[eventId]/studio/panood/broadcast · OFFLINE NEEDED with the flag off (old day-of control room at the venue) · SHAPE PAGE → PAGE (forward to `/panood/control` with the flag on) · **B** Carla: did not open in 180 s on the copy (load) — not walked
- [x] /dashboard/[eventId]/studio/panood/cameras · OFFLINE READ-ONLY · SHAPE PAGE → PAGE (with the flag on its only doors are in the old control room) · **B** Carla: opens · DARK no · controls 375 18 / 1280 28 · presses: page redirected before the press pass (counted at its landing page)
- [x] /dashboard/[eventId]/studio/panood/cameras/print · OFFLINE READ-ONLY · SHAPE PAGE → PAGE (print) · **B** Carla: opens · DARK no · controls 375 14 / 1280 24 · in-page: buttons 3 · pressed 2 · failed 0 · left 1 (writes: save/send/publish/pay/delete) · links 1 (read, destinations in the walk)
- [x] /dashboard/[eventId]/studio/panood/setup · OFFLINE NEEDED with the flag off (Go live / End at the venue), else READ-ONLY · SHAPE PAGE → PAGE · **B** Carla: opens · DARK no · controls 375 21 / 1280 31 · in-page: buttons 6 · pressed 3 · failed 0 · left 3 (writes: save/send/publish/pay/delete) · links 4 (read, destinations in the walk)
- [x] /dashboard/[eventId]/studio/papic/challenges · OFFLINE NEEDED (at the venue on the day: "Ask now"/"Stop" run live; disagree with read-only) · SHAPE PAGE → PAGE (no working door: P-02) · **B** Carla: opens · DARK no · controls 375 82 / 1280 92 · in-page: buttons 1 · pressed 1 · failed 0 · left 0 (writes: save/send/publish/pay/delete) · links 0 (read, destinations in the walk)
- [x] /dashboard/[eventId]/studio/papic/crew · OFFLINE READ-ONLY · SHAPE PAGE → SMALL POPUP (differs; one QR + Copy + Print, duplicate of Event Details › How guests get in) · **B** Carla: opens · DARK no · controls 375 16 / 1280 26 · in-page: buttons 4 · pressed 2 · failed 0 · left 2 (writes: save/send/publish/pay/delete) · links 2 (read, destinations in the walk)
- [x] /dashboard/[eventId]/studio/papic/crew/poster · OFFLINE READ-ONLY · SHAPE PAGE → PAGE (print) · **B** Carla: opens · DARK no · wider than the screen 375px +125 · controls 375 11 / 1280 21 · in-page: buttons 1 · pressed 1 · failed 0 · left 0 (writes: save/send/publish/pay/delete) · links 0 (read, destinations in the walk)
- [x] /dashboard/[eventId]/studio/papic/moderation · OFFLINE READ-ONLY · SHAPE PAGE → folded into the Memories photo sheet (differs; owner 23 Oct) · **B** Carla: opens · DARK no · controls 375 14 / 1280 24 · in-page: buttons 4 · pressed 1 · failed 0 · left 3 (writes: save/send/publish/pay/delete) · links 0 (read, destinations in the walk)
- [x] /dashboard/[eventId]/studio/papic/recap · OFFLINE READ-ONLY · SHAPE PAGE → PAGE · **B** Carla: opens · DARK no · controls 375 20 / 1280 30 · in-page: buttons 5 · pressed 3 · failed 0 · left 2 (writes: save/send/publish/pay/delete) · links 2 (read, destinations in the walk) · Mika: opens · DARK no · controls 375 17 / 1280 27 · in-page: buttons 5 · pressed 2 · failed 1 · left 2 (writes: save/send/publish/pay/delete) · links 2 (read, destinations in the walk)
- [x] /dashboard/[eventId]/studio/papic/run-of-show · OFFLINE NEEDED (coordinator at the venue: "This is happening now", Pause) · SHAPE PAGE → PAGE (no working door: P-02) · **B** Carla: opens · DARK no · controls 375 55 / 1280 65 · in-page: buttons 43 · pressed 7 · failed 33 · left 0 (writes: save/send/publish/pay/delete) · links 2 (read, destinations in the walk) (first 40 pressed)
- [x] /dashboard/[eventId]/studio/patiktok · OFFLINE NOT NEEDED · SHAPE PAGE → PAGE (retired; owners only) · **B** Carla: /dashboard/C · DARK yes · controls 375 52 / 1280 62
- [x] /dashboard/[eventId]/studio/patiktok/[templateId] · OFFLINE NOT NEEDED · SHAPE PAGE → FULL-SCREEN POPUP (differs; retired, owners only) · **B** Carla: opens · DARK no · controls 375 2 / 1280 2
- [x] /dashboard/[eventId]/studio/patiktok/booth · OFFLINE NEEDED (operator at the venue on the day; clips should queue) · SHAPE PAGE → PAGE, camera inline → FULL-SCREEN POPUP (differs; retired, owners only) · **B** Carla: /dashboard/C · DARK yes · controls 375 52 / 1280 62
- [x] /dashboard/[eventId]/studio/photo-delivery · OFFLINE NOT NEEDED (OAuth + Drive; disagree with read-only) · SHAPE PAGE → PAGE · **B** Carla: opens · DARK no · controls 375 18 / 1280 28 · in-page: buttons 5 · pressed 4 · failed 1 · left 0 (writes: save/send/publish/pay/delete) · links 3 (read, destinations in the walk)
- [x] /dashboard/[eventId]/studio/playlist · OFFLINE READ-ONLY (DJ glance at the venue) · SHAPE PAGE → PAGE · **B** Carla: opens · DARK no · controls 375 84 / 1280 94 · in-page: buttons 73 · pressed 8 · failed 32 · left 0 (writes: save/send/publish/pay/delete) · links 1 (read, destinations in the walk) (first 40 pressed)
- [x] /dashboard/[eventId]/studio/save-the-date · OFFLINE READ-ONLY · SHAPE PAGE → PAGE · **B** Carla: opens · DARK no · controls 375 51 / 1280 61 · in-page: buttons 32 · pressed 14 · failed 12 · left 5 (writes: save/send/publish/pay/delete) · links 7 (read, destinations in the walk)
- [x] /dashboard/[eventId]/studio/save-the-date/stamp · OFFLINE NOT NEEDED (a WebGL maker) · SHAPE PAGE → FULL-SCREEN POPUP (differs) · **B** Carla: opens · DARK no · controls 375 12 / 1280 22 · in-page: buttons 1 · pressed 0 · failed 0 · left 1 (writes: save/send/publish/pay/delete) · links 1 (read, destinations in the walk)
- [x] /dashboard/[eventId]/studio/setnayan-ai · OFFLINE READ-ONLY · SHAPE PAGE → PAGE · **B** Carla: opens · DARK no · controls 375 13 / 1280 23 · in-page: buttons 1 · pressed 1 · failed 0 · left 0 (writes: save/send/publish/pay/delete) · links 2 (read, destinations in the walk)
- [x] /dashboard/[eventId]/studio/website-pro · OFFLINE NOT NEEDED (buying needs signal; a saved price list could mislead) · SHAPE PAGE → PAGE · **B** Carla: opens · DARK no · controls 375 20 / 1280 30 · in-page: buttons 9 · pressed 6 · failed 3 · left 0 (writes: save/send/publish/pay/delete) · links 1 (read, destinations in the walk)
- [x] /dashboard/[eventId]/website/editor · OFFLINE READ-ONLY · SHAPE forward into the Maker (`/launch?…&open=…`) → keep; `open=colors` opens Look, `special-message` and `what-to-bring` (Reminders) open their rows · **B** Carla: /dashboard/C/launch?stage=save_the_date · DARK no · controls 375 22 / 1280 35 · presses: page redirected before the press pass (counted at its landing page)
- [x] /dashboard/[eventId]/website/hero-photo · OFFLINE NOT NEEDED (an upload; I disagree with read-only: a saved copy does nothing) · SHAPE PAGE → FULL-SCREEN POPUP (differs) · **B** Carla: opens · DARK no · controls 375 16 / 1280 26 · in-page: buttons 3 · pressed 2 · failed 0 · left 1 (writes: save/send/publish/pay/delete) · links 2 (read, destinations in the walk)
- [x] /dashboard/[eventId]/website/living-hero · OFFLINE NOT NEEDED (a video upload) · SHAPE PAGE → FULL-SCREEN POPUP (differs) · **B** Carla: opens · DARK no · controls 375 12 / 1280 22 · in-page: buttons 1 · pressed 1 · failed 0 · left 0 (writes: save/send/publish/pay/delete) · links 1 (read, destinations in the walk)
- [x] /dashboard/[eventId]/website/our-photos · OFFLINE NOT NEEDED (an upload) · SHAPE PAGE → FULL-SCREEN POPUP (differs) · **B** Carla: opens · DARK no · controls 375 12 / 1280 22 · in-page: buttons 2 · pressed 1 · failed 0 · left 1 (writes: save/send/publish/pay/delete) · links 0 (read, destinations in the walk)
- [x] /dashboard/[eventId]/website/our-story · OFFLINE READ-ONLY · SHAPE PAGE → FULL-SCREEN POPUP (differs; weddings already forward into the Maker; a birthday has no visible door) · **B** Carla: /dashboard/C/launch?tool=details&item=love-story · DARK no · controls 375 10 / 1280 20 · presses: page redirected before the press pass (counted at its landing page)
- [x] /dashboard/[eventId]/website/photo-moments · OFFLINE READ-ONLY · SHAPE PAGE → FULL-SCREEN POPUP (differs) · **B** Carla: opens · DARK no · controls 375 18 / 1280 28 · in-page: buttons 8 · pressed 3 · failed 2 · left 3 (writes: save/send/publish/pay/delete) · links 0 (read, destinations in the walk)
- [x] /dashboard/[eventId]/website/privacy · OFFLINE READ-ONLY (disagree in part: "Who can watch on the day" is pressed at the venue) · SHAPE PAGE → FULL-SCREEN POPUP (differs) · **B** Carla: opens · DARK no · controls 375 22 / 1280 32 · in-page: buttons 5 · pressed 2 · failed 2 · left 1 (writes: save/send/publish/pay/delete) · links 3 (read, destinations in the walk)
- [x] /dashboard/[eventId]/website/site-chrome · OFFLINE READ-ONLY · SHAPE PAGE → FULL-SCREEN POPUP (differs; video upload) · **B** Carla: opens · DARK no · controls 375 15 / 1280 25 · in-page: buttons 5 · pressed 4 · failed 0 · left 1 (writes: save/send/publish/pay/delete) · links 0 (read, destinations in the walk)
- [x] /dashboard/[eventId]/website/stories · OFFLINE READ-ONLY · SHAPE PAGE → FULL-SCREEN POPUP (differs) · **B** Carla: opens · DARK no · controls 375 12 / 1280 22 · in-page: buttons 1 · pressed 1 · failed 0 · left 0 (writes: save/send/publish/pay/delete) · links 1 (read, destinations in the walk)
- [x] /dashboard/[eventId]/website/widgets · OFFLINE READ-ONLY · SHAPE PAGE → FULL-SCREEN POPUP (differs) · **B** Carla: opens · DARK no · controls 375 95 / 1280 105 · in-page: buttons 78 · pressed 4 · failed 27 · left 9 (writes: save/send/publish/pay/delete) · links 7 (read, destinations in the walk) (first 40 pressed)
- [x] /dashboard/creator · OFFLINE READ-ONLY · SHAPE PAGE → PAGE · **B** Carla: opens · DARK no · controls 375 10 / 1280 23 · in-page: buttons 4 · pressed 3 · failed 1 · left 0 (writes: save/send/publish/pay/delete) · links 0 (read, destinations in the walk)
- [x] /dashboard/library · OFFLINE READ-ONLY · SHAPE forward to `/dashboard?seg=memories` (Home section) → keep · **B** Carla: /dashboard?seg=memories · DARK no · controls 375 21 / 1280 35 · presses: page redirected before the press pass (counted at its landing page)
- [x] /dashboard/life-flash · OFFLINE READ-ONLY · SHAPE PAGE → PAGE (its player is a hand-built full-screen layer; should be RiseScreen) · **B** Carla: opens · DARK yes · controls 375 10 / 1280 23 · in-page: buttons 3 · pressed 1 · failed 2 · left 0 (writes: save/send/publish/pay/delete) · links 1 (read, destinations in the walk)
- [x] /panood/control/[eventId] · OFFLINE NEEDED (host/coordinator at the venue on the day; a read-only copy is NOT enough for a live control: every tap is a form POST + redirect with ~15 reads, no queue, no offline sign) · SHAPE PAGE → PAGE; its Setup half-sheet should be a FULL-SCREEN POPUP (differs) · **B** Carla: did not open in 180 s on the copy (load) — not walked
- [x] /panood/program/[eventId] · OFFLINE NEEDED (second window captured by OBS at the venue; re-attaches every 2 s) · SHAPE PAGE → PAGE · **B** Carla: opens · DARK no · controls 375 0 / 1280 0 · presses: page redirected before the press pass (counted at its landing page)

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

### Invitations, Logo Maker, E-Gifts (guests/invite · guests/send · invitation · print · save-the-date · stamp · event-qr · monogram · pabuya)

#### I-01 · E-Gifts: a failed read of the money accounts shows "No e-gift methods yet" and an add form

```
PAGE      /dashboard/[eventId]/pabuya   (event: stg-carla-miguel)
BUTTON    the methods list · "Add an e-gift method"
STEPS     1. Open while the `event_egift_methods` read fails.
EXPECTED  "Couldn't read your E-Gift methods", no add form.
ACTUAL    The page calls `fetchEgiftMethods` (drops the `read` flag) instead of `readEgiftMethods`, which exists so "a refused read must never draw as 'no methods yet' with an add form". With the event read also failing, the notice says "Your gift methods below are correct and saved" without having read them.
WHERE     apps/web/app/dashboard/[eventId]/pabuya/page.tsx (`fetchEgiftMethods`) · lib/egift.ts `readEgiftMethods` · _components/pabuya-manager.tsx
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 (money destinations)
SEVERITY  money-signin
SOURCE    CODE
```

#### I-02 · Custom Event Hub address: no lock or price before Save, and the refusal shows the bare key "needs_custom_address"

```
PAGE      /dashboard/[eventId]/invitation   (an event without the custom-address part)
BUTTON    "Save address"
STEPS     1. Type a new address. 2. Press Save address.
EXPECTED  A 🔒 with the catalogue price and a real checkout door; at least a plain sentence.
ACTUAL    `redirect(\`${back}?slug_error=needs_custom_address\`)`; `SLUG_ERROR_COPY` has no such key, so the page prints `decodeURIComponent(slugErrorKey)` — the person reads "needs_custom_address".
WHERE     invitation/actions.ts `updateEventSlug` · invitation/page.tsx (`SLUG_ERROR_COPY`) · lib/slug-availability.ts
SHOTS     375 px light
RULE      design-and-wiring B7
SEVERITY  money-signin
SOURCE    CODE
```

#### I-03 · Save the Date prices: a failed read drops the price and claims the opening is bundle-only

```
PAGE      /dashboard/[eventId]/studio/save-the-date   (event: stg-carla-miguel)
BUTTON    "Unlock the openings" / "Unlock Event Pro" lines
STEPS     1. Open while the catalogue read fails.
EXPECTED  "Couldn't read" by the price.
ACTUAL    `formatV2Sku('COUPLE_WEBSITE_PRO').catch(() => null)` → price silently dropped; `formatV2Sku(STD_PREMIUM_OPENINGS_SERVICE_KEY).catch(() => null)` → "The cinematic opening is part of Event Pro" (a false claim from a failed read).
WHERE     studio/save-the-date/page.tsx `SaveTheDatePage`
SHOTS     375 px light
RULE      CLAUDE.md §1 money · §5 rule 4
SEVERITY  money-signin
SOURCE    CODE
```

#### I-04 · Invitation sheet "Mark sent" failure is never shown; "Save monogram" reads a zero-row update as saved

```
PAGE      /dashboard/[eventId]/invitation
BUTTON    "Mark sent" / "Not sent yet" · "Save monogram"
STEPS     1. Press Mark sent when the write is refused. 2. Save the mark when RLS refuses the row.
EXPECTED  "Couldn't save".
ACTUAL    `redirect(…/invitation?invite=failed)` but the page never reads `invite`; `updateMonogram` `.update({...}).eq('event_id', eventId)` with no `.select()` → `?mono_saved=1`.
WHERE     invitation/actions.ts `markGuestInvitationSent`, `updateMonogram` · invitation/page.tsx (`searchParams`) · _components/guest-invite-modal.tsx
SHOTS     375 px light
RULE      design-and-wiring B6 · CLAUDE.md §5 rule 4
SEVERITY  broken
SOURCE    CODE
```

#### I-05 · Event QR "Regenerate QR" throws its result away (no failure, no success, no confirm)

```
PAGE      /dashboard/[eventId]/event-qr
BUTTON    "Regenerate QR"
STEPS     1. Press when the update errors or matches zero rows.
EXPECTED  "Couldn't make a new QR"; success said; a confirm like the guest QR's.
ACTUAL    `action={async (data) => { 'use server'; await regenerateEventMasterQR(data); }}` — `{ ok: false, reason }` never reaches the screen.
WHERE     event-qr/page.tsx · event-qr/actions.ts `regenerateEventMasterQR`
SHOTS     375 px light
RULE      design-and-wiring B6 · CLAUDE.md §5 rule 4
SEVERITY  broken
SOURCE    CODE
```

#### I-06 · Save the Date "Render": a failed read can blank the saved film; a dropped connection escapes; the date fill reports Saved after a failed write

```
PAGE      /dashboard/[eventId]/studio/save-the-date
BUTTON    "Render my Save the Date"
STEPS     1. Open when the events read fails, press Render. 2. Press Render offline. 3. Render a film date on an undated event when the write fails.
EXPECTED  "Couldn't read" and no save offered; a failure line; a failed write said.
ACTUAL    eventError only logged, the builder filled with `?? null` blanks and `saveAllStdContent` writes every field (unsure how the patch treats null); `handleRender` awaits `save.run(...)` with no try/catch (siblings wrap it); `update({ event_date: filmDate … }).is('event_date', null)` error discarded then `{ ok: true }` → "Saved." (baseline).
WHERE     studio/save-the-date/page.tsx · _components/StdBuilderClient.tsx `handleRender` · actions.ts `saveAllStdContent`
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 · design-and-wiring B6
SEVERITY  broken
SOURCE    CODE
```

#### I-07 · Invitation failed reads read as facts (no address yet, House theme, free QR look, bounce, 404)

```
PAGE      /dashboard/[eventId]/guests/send, /guests/invite, /invitation, /invitation/print, /event-qr
BUTTON    "Your Event Hub has no address yet…" · requests notice · Theme · QR look · page loads
STEPS     1. Make each read fail.
EXPECTED  "Couldn't read".
ACTUAL    send: `loadInviteSetup` returns `slug: null` on error → "Your Event Hub has no address yet, so there are no personal links to send"; invite: `pendingRes.count ?? 0` hides requests, the theme falls to House, `eventHubOwnership(...).catch(() => null)` draws a paid couple's QR in the free look; invitation: `if (!event) redirect(/dashboard/${eventId})`, and zero guests draw an empty table with no EmptyState; print: `notFound()` on a failed read, an empty dashed sheet for zero guests; event-qr: `redirect('/dashboard')`.
WHERE     guests/_components/invite-message-setup.ts `loadInviteSetup` · guests/invite/_components/share-link-panel.tsx · invitation/page.tsx · invitation/print/page.tsx · event-qr/page.tsx
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4 · kit §5.9
SEVERITY  wrong
SOURCE    CODE
```

#### I-08 · Words: "Monogram" across the Logo Maker, invitation and launch sheet; "site", "slug", "Pabuya", "text" (SMS); a non-setnayan.com fallback domain

```
PAGE      /dashboard/[eventId]/monogram, /invitation, /studio/save-the-date, /pabuya, /guests/invite
BUTTON    titles · labels · notices · links
STEPS     1. Read the pages.
EXPECTED  "Logo Maker", "Event Hub", "E-Gifts", email only, setnayan.com only.
ACTUAL    monogram: `title: 'Monogram Maker'`, `<PageMasthead title="Your wedding monogram" />`, "Make it my monogram", "Your monogram, everywhere", "View live site", loader "Opening the monogram studio", menu `label: "Monogram"`; invitation: "Your monogram", "Save monogram", "Your invitation site", "No slug set yet", "Slug saved."; save-the-date: "your live site", "wedding-site song", "Manage site music", "Website → Privacy"; pabuya: `title: 'Pabuya · E-Gifts'`, eyebrow "Pabuya", "your event page"; invite: "Send it by text, email, or your group chat"; fallback `?? 'https://setnayan-platform-web.vercel.app'` in four places (only if NEXT_PUBLIC_APP_URL is unset).
WHERE     monogram/{page,draft-restore,mark-everywhere,upload-mark,animated-monogram-upgrade}.tsx, studio-notices.ts · components/sd-loader/loader-steps.ts · lib/nav-registry-defaults.ts · invitation/page.tsx · studio/save-the-date/page.tsx, _components/{StdBuilderClient,launch-std-button}.tsx · pabuya/page.tsx, _components/pabuya-manager.tsx · guests/invite/_components/share-link-panel.tsx, guests/_components/guest-card-data.ts, invitation/print/page.tsx
SHOTS     375 px light
RULE      brand.md word rules · CLAUDE.md §1 (email only)
SEVERITY  wrong
SOURCE    CODE
```

#### I-09 · Logo Maker unlock: no price on the page; a dropped connection stops the unlock silently; the stamp gives no "Saved"

```
PAGE      /dashboard/[eventId]/monogram, /studio/save-the-date/stamp
BUTTON    "Unlock Animation & Apply" · "Love it — use this seal"
STEPS     1. Unowned event → press Unlock. 2. Save a wax seal.
EXPECTED  🔒 → price from the catalogue → one button; a small "Saved".
ACTUAL    no price anywhere; `onClick={async () => { await save(true); window.location.assign(unlockHref); }}` with no catch; the stamp's `StayForm` has no `sayNote` (unsure: the page may re-render visibly).
WHERE     monogram/animate-rows.tsx · studio/save-the-date/stamp/wax-stamp-maker.tsx · app/_actions/stay-registry/stdStamp.ts
SHOTS     375 px light
RULE      design-and-wiring B6, B7
SEVERITY  wrong
SOURCE    CODE
```

#### I-10 · Invitation look: send run and Logo popup hand-built, many accent fills, spinners, hex, bg-white, native confirm

```
PAGE      /dashboard/[eventId]/guests/send, /guests/invite, /invitation, /invitation/print, /studio/save-the-date, /stamp, /event-qr, /monogram, /pabuya
BUTTON    layers · buttons · frames · loading
STEPS     1. Open each at 375 px.
EXPECTED  RiseScreen/Sheet/ConfirmDialog; one main per screen; tokens; Sk skeletons; a Print button on a phone.
ACTUAL    send run: portal `fixed inset-0 z-[110]` with `html.style.overflow = 'hidden'`, ✕ always goes to /guests, `bg-white`, hand shadows, `text-[11.5px]`; Logo "everywhere" popup `fixed inset-0 z-[70] role="dialog"` with a `setTimeout` slideshow ignoring reduced motion and `480ms cubic-bezier(.22,1,.36,1)`; save-the-date: `bg-mulberry` on Unlock ×2, Render, Launch now, wax seal + accent-outlined Schedule/Change time, `GridPageSkeleton`; invitation `button-primary` + `bg-mulberry` link + hex `#C97B4B` + `bg-white`; monogram `ab-main` + `bg-mulberry` ×2, SDLoader as loading; pabuya `button-primary` + `ab-main`, `window.confirm`; stamp hex gold main `bg-[#cb9e4b]`; invite no PageMasthead, hand frames, `animate-spin` on Regenerate; event-qr `rounded-card`, hex QR colours; print pages only "Press ⌘P" (no Print button on a phone).
WHERE     guests/send/_components/send-run.tsx · monogram/mark-everywhere.tsx, animate-rows.tsx, loading.tsx · studio/save-the-date/** · invitation/page.tsx · pabuya/_components/{pabuya-manager,pabuya-message-editor}.tsx · guests/invite/** · event-qr/page.tsx · invitation/print/page.tsx
SHOTS     375 px light
RULE      Part K1, K3 · CLAUDE.md §3 · MOTION_STANDARD
SEVERITY  look
SOURCE    CODE
```

#### I-11 · Send run and wax-seal maker are addresses; they should rise over the page you came from

```
PAGE      /dashboard/[eventId]/guests/send, /studio/save-the-date/stamp
BUTTON    the pages
STEPS     1. Invite › "Send invites one by one". 2. Save the Date › "Make your wax seal". 3. Press ✕ / Back.
EXPECTED  FULL-SCREEN POPUP (RiseScreen): ✕ returns to the same place.
ACTUAL    send: its own address drawn as a hand-built full-screen layer, ✕ → /guests even from /guests/invite; stamp: its own page with "Back to Save the Date".
WHERE     guests/send/_components/send-run.tsx · studio/save-the-date/stamp/page.tsx
SHOTS     375 px light
RULE      SHAPE
SEVERITY  look
SOURCE    CODE
```

### Studio tools and creator (about/[addon] · guest-columns · mood-board · pakanta · patiktok ×3 · playlist · setnayan-ai · creator)

> Phase B: Pakanta and Patiktok are retired (`redirectUnlessEventKeepsRetired` bounces non-owners to Home), guest-columns is flag-gated, and couples are redirected off the mood-board page, so `couple_maker` may not reach these; a seeded owner or coordinator is needed.

#### S-01 · Add-on About pages: a failed price or order read hides the price and offers "Get" again; About and the tool disagree on the Setnayan AI price

```
PAGE      /dashboard/[eventId]/studio/about/[addon] (e.g. setnayan-ai), /dashboard/[eventId]/studio/setnayan-ai   (event: stg-carla-miguel)
BUTTON    "Get · ₱…" · plan row · "Verifying"
STEPS     1. Open About while the price read fails. 2. Place an order, then open About while the order read fails. 3. Compare About › Setnayan AI with the tool page on a non-wedding event.
EXPECTED  "Couldn't read"; never offered to buy again; one price from one reader.
ACTUAL    `formatV2Sku(entry.serviceKey).catch(() => null)` → "Get" with no price; `.then((r) => r.data)` drops the order error → "Get" again (a second purchase); About uses the flat `formatV2Sku('SETNAYAN_AI')` while the tool uses `resolveSetnayanAiDisplayPricePhp` (per event type), or no price with the paywall off.
WHERE     studio/_components/addon-detail-view.tsx `AddOnDetailView` · studio/setnayan-ai/page.tsx
SHOTS     375 px light
RULE      CLAUDE.md §1 money · §5 rule 4 · design-and-wiring C8
SEVERITY  money-signin
SOURCE    CODE
```

#### S-02 · About pages mark Save the Date and the animated logo "Free" over copy that sells their paid parts; "Get" opens the feature page, not a checkout

```
PAGE      /dashboard/[eventId]/studio/about/save-the-date, /about/animated-monogram, /about/setnayan-ai
BUTTON    "Free" pill · hero copy · "Get · ₱…"
STEPS     1. Open each; press Get.
EXPECTED  Free parts said free, paid parts named with their plan; one button to a real checkout.
ACTUAL    `tier: 'free'` pill over "A reveal they'll want to watch twice" / "An animated trace that draws itself on" (the catalogue says those need Event Pro); `href={surfaceHref}` opens the feature page; Setnayan AI then needs a second Unlock; Papic → `/studio/papic` → Home.
WHERE     lib/add-ons-detail.ts · lib/add-ons-catalog.ts · studio/_components/addon-detail-view.tsx
SHOTS     375 px light
RULE      design-and-wiring B7 · brand.md claims 1/3
SEVERITY  money-signin
SOURCE    CODE
```

#### S-03 · Hand-formatted pesos and "Pricing loads from your catalog" on a failed read (Setnayan AI, Pakanta)

```
PAGE      /dashboard/[eventId]/studio/setnayan-ai, /dashboard/[eventId]/studio/pakanta
BUTTON    hero price · "Continue to payment · ₱…"
STEPS     1. Open each; then with the price read failing.
EXPECTED  `formatPhp`; "Couldn't read".
ACTUAL    `` `₱${Math.round(pricePhp).toLocaleString('en-PH')}` `` and `` ` · ₱${pricePhp.toLocaleString('en-PH')}` ``; `resolveSetnayanAiDisplayPricePhp(...).catch(() => 0)` merges a failed read with a real zero → "Pricing loads from your catalog — please refresh in a moment."
WHERE     studio/setnayan-ai/page.tsx · studio/pakanta/page.tsx, _components/pakanta-music-form.tsx
SHOTS     375 px light
RULE      CLAUDE.md §1 (money via lib/php.ts; "Couldn't read")
SEVERITY  money-signin
SOURCE    CODE
```

#### S-04 · Creator page crashes on a "%" in the error parameter; Delete removes a chapter with no confirm

```
PAGE      /dashboard/creator   (couple_maker)
BUTTON    error banner · chapter "Delete"
STEPS     1. Open `/dashboard/creator?error=100%`. 2. Press Delete on a chapter.
EXPECTED  The page opens; an irreversible delete confirms once.
ACTUAL    `decodeURIComponent(search.error)` decodes an already-decoded value → URIError → error screen (and any link can put words in the red banner); `deleteChapter` hard-deletes in one press.
WHERE     app/dashboard/(account)/creator/page.tsx (FormFlash) · creator/actions.ts `deleteChapter`
SHOTS     375 px light
RULE      kit §5.1 · CLAUDE.md §3 Floating surface
SEVERITY  broken
SOURCE    CODE
```

#### S-05 · Studio tools failed reads read as real (mood board, playlist, Setnayan AI, guest columns, Patiktok, creator)

```
PAGE      /dashboard/[eventId]/studio/mood-board, /playlist, /setnayan-ai, /guest-columns, /patiktok, /patiktok/[templateId], /patiktok/booth, /dashboard/creator
BUTTON    boards · sync chip · "Working right now" · queues · renders · offers
STEPS     1. Make each read fail.
EXPECTED  "Couldn't read".
ACTUAL    mood board: `(inspirationRes.data ?? [])` empty board, finalizations only `console.error` → every part "never signed off", booked count 0 → "Once you've booked suppliers…"; playlist: booked error ignored → "book your DJ first", `fetchEventSongRequests` drops `failed` → tray looks "all placed"; Setnayan AI: `measured` never read → "0% booked · 0 suppliers"; guest-columns "No one has written yet."; patiktok renders vanish, "Pick from 0 tracks", booth finds no tables; creator "No chapters yet", supplier offers vanish.
WHERE     studio/mood-board/_components/mood-board-editor.tsx · studio/playlist/page.tsx, lib/songs.ts · setnayan-ai/_components/setnayan-ai-value.tsx, lib/setnayan-ai-activity.ts · guest-columns/page.tsx · patiktok/page.tsx, [templateId]/page.tsx, booth/page.tsx · (account)/creator/page.tsx, lib/creator-offers.ts
SHOTS     375 px light
RULE      CLAUDE.md §5 rule 4
SEVERITY  wrong
SOURCE    CODE
```

#### S-06 · Playlist re-computes "booked" with a hand list instead of BOOKED_EVENT_VENDOR_STATUSES

```
PAGE      /dashboard/[eventId]/studio/playlist
BUTTON    "Synced with {supplier}"
STEPS     1. Compare with the one reader.
EXPECTED  Import `BOOKED_EVENT_VENDOR_STATUSES`.
ACTUAL    `.in('status', ['contracted','deposit_paid','delivered','complete'])` (matches today; a second copy).
WHERE     studio/playlist/page.tsx
SHOTS     375 px light
RULE      design-and-wiring C8
SEVERITY  wrong
SOURCE    CODE
```

#### S-07 · Studio words: "vendor", "wedding" on every event, "Monogram", "Stop…" lines, raw codes and database text

```
PAGE      /dashboard/[eventId]/studio/mood-board, /playlist, /setnayan-ai, /pakanta, /about/[addon], /guest-columns, /patiktok
BUTTON    toasts · mastheads · errors
STEPS     1. Read on stg-mika-turns-7; trigger failures.
EXPECTED  supplier; the event's own word; Logo Maker; plain reasons.
ACTUAL    "Shared with N vendor(s)" · "Notify your N booked vendor(s)" · "Your wedding playlist" · "ready for your wedding" (with `eventWord` in scope) · "Now playing on your wedding page" · 'Monogram Maker' · "Stop hunting. Start choosing." · "Stop guessing who to hire" · guest-columns `'not_found'`, `error.message.slice(0, 80)` · mood board `message: assetErr.message` · patiktok "TikTok connection failed (<code>; env missing: X)" · booth "upload presign failed (500)".
WHERE     studio/mood-board/_components/share-with-vendors-button.tsx, mood-board/actions.ts, dress-code-actions.ts · studio/playlist/page.tsx · studio/setnayan-ai/page.tsx · studio/pakanta/** · lib/add-ons-catalog.ts, lib/add-ons-detail.ts · guest-columns/actions.ts · patiktok/page.tsx, _components/booth-capture.tsx
SHOTS     375 px light
RULE      brand.md word rules and tone · CLAUDE.md §3 Toast
SEVERITY  wrong
SOURCE    CODE
```

#### S-08 · Patiktok promises things not built (shipped floor sticker, signage, 4K, "auto-pick" music on a render worker) and saves partially

```
PAGE      /dashboard/[eventId]/studio/patiktok/[templateId], /studio/patiktok
BUTTON    "What ships in the Station Pack" · Music "Auto-pick from template vibe" · render finish
STEPS     1. Read the template page. 2. Queue a render with Auto-pick. 3. Finish a render while a clip write fails.
EXPECTED  Only what is live; failures said.
ACTUAL    "Physical X-mark floor sticker (50×50 cm vinyl, shipped 3–5 days)", signage card, 4K — no fulfilment code found; Auto-pick leaves `musicUrl` null and renders in the browser, not a worker; `patiktok_render_job_clips.upsert` / `patiktok_source_clips.update` errors discarded then `{ ok: true, downloadUrl }`; `failPatiktokRenderJob` can leave a failed render "queued".
WHERE     studio/patiktok/[templateId]/page.tsx, _components/render-form.tsx · patiktok/actions.ts
SHOTS     375 px light
RULE      brand.md claims 6/9 · CLAUDE.md §5 rule 4
SEVERITY  wrong
SOURCE    CODE
```

#### S-09 · Studio look: K1 breaks, spinners and pulses, hand-built pickers and tag sheet, width transition, wrong skeletons

```
PAGE      /dashboard/[eventId]/studio/mood-board, /patiktok, /patiktok/booth, /playlist, /setnayan-ai, /guest-columns, /pakanta, /about/[addon], /dashboard/creator
BUTTON    buttons · layers · loading
STEPS     1. Open each at 375 px.
EXPECTED  One main per scope; Sheet; Sk; transform/opacity; PickMenu.
ACTUAL    patiktok two `ab-main` "Open booth dashboard" + `ab-main` Download + `bg-mulberry` triggers, broken class `text-terracotta-700-700`; creator selected audience `ab-main` beside "Save changes" `ab-main`, native `<select>`; mood-board `StudioPopup` hand-built `fixed inset-0 role="dialog"`; booth tag sheet hand-built, `max-h-[85vh]`, `animate-pulse` REC, `bg-success-700` Keep; `animate-spin` in mood-board, pakanta, guest-columns, patiktok; Setnayan AI `transition-all` on a width bar; playlist `GridPageSkeleton` for a list; guest-columns no PageMasthead, raw buttons; `text-[12px]`/`[12.5px]` throughout.
WHERE     patiktok/page.tsx · (account)/creator/page.tsx · mood-board/_components/colour-picker-sheet.tsx `StudioPopup` · patiktok/_components/{tag-sheet,booth-capture}.tsx · setnayan-ai/_components/setnayan-ai-value.tsx · playlist/loading.tsx · guest-columns/**
SHOTS     375 px light
RULE      Part K1, K3 · CLAUDE.md §3 · MOTION_STANDARD E2
SEVERITY  look
SOURCE    CODE
```

#### S-10 · Patiktok template pick and booth camera should be full-screen layers

```
PAGE      /dashboard/[eventId]/studio/patiktok/[templateId], /studio/patiktok/booth
BUTTON    template page · "Open camera"
STEPS     1. Open a template; open the camera.
EXPECTED  FULL-SCREEN POPUP (one-step pick; a camera).
ACTUAL    template pick is its own address; the camera opens inline in a `max-w-[280px]` box.
WHERE     patiktok/[templateId]/page.tsx · patiktok/_components/booth-capture.tsx
SHOTS     375 px light
RULE      SHAPE
SEVERITY  look
SOURCE    CODE
```

<!-- PHASE-B-START -->
### Phase B — new findings (SOURCE: SEEN on the copy, 25 Nov)

#### N-01 · A slow session check sends a signed-in couple to the sign-in page

```
PAGE      /dashboard/[eventId]/guests/invite (768) · /guests/send (dark) · /studio/save-the-date · /studio/about/panood   (event: stg-carla-miguel)
BUTTON    none: opening the page
STEPS     1. Signed in as couple_maker, open the page while the copy is slow (first byte 30 s or more). 2. Look where you land.
EXPECTED  The page, late; or a "taking longer than usual" state that keeps the person signed in.
ACTUAL    Four times the page landed on `/login?next=%2Fdashboard` (the sign-in card, Google / Apple / email). The same
          session, opened again a minute later, was still signed in. `lib/supabase/middleware.ts` runs the session check
          under `withBudget(…, SESSION_CHECK_BUDGET_MS)` and treats a check that runs out of time as "nobody is signed in"
          (a stated trade, written after the 20 Aug outage). The person is told to sign in again although nothing is wrong
          with their account, and `next` drops the page they asked for (it says /dashboard, not the invite page).
RULE      Kit § 6 money-signin (signing in or out wrongly) · CLAUDE.md §5 rule 4 (honest states)
SEVERITY  money-signin
SOURCE    SEEN + CODE
```

#### N-02 · Memory lane prints an internal code and the event's raw id

```
PAGE      /dashboard/[eventId]/live   (event: stg-carla-miguel)
BUTTON    the "Auto" picker
STEPS     1. Memories › Memory lane. 2. Read the line under "Auto"; scroll to the foot.
EXPECTED  A plain line: "Showing now: your photos (picked for you)".
ACTUAL    "Showing now: coming-soon (auto)" — the internal mode name. The page foot shows the tail of the event's id
          ("…895b-525bee8e5cb5"). The page has no PageMasthead (the top block starts with the picker) and the bottom nav
          lights no tab.
RULE      brand.md (plain words, no internal names) · Add 2 EFFECTIVE · CLAUDE.md §3 (PageMasthead on every page)
SEVERITY  wrong
SOURCE    SEEN
```

#### N-03 · Memories › More from your day squeezes the Papic card into a one-word column at 375

```
PAGE      /dashboard/[eventId]/galleries   (events: stg-carla-miguel, stg-mika-turns-7)
STEPS     1. Open at 375 px.
EXPECTED  Title, state and line on one row; the button under them or at the right without crushing the text.
ACTUAL    "Papic — candid photos", the "Ready · 1" chip and "Every shot your friends caught…" wrap one word per line in a
          column about 50 px wide beside a full-width "View & download" button. Fine at 768 and 1280.
SHOTS     375 px light
RULE      Add 2 BALANCED · HOUSE_DESIGN_STANDARD (layout at 375)
SEVERITY  look
SOURCE    SEEN
```

#### N-04 · The song-file limit disagrees between two pages, and upload boxes say the limit twice in raw file types

```
PAGE      /dashboard/[eventId]/studio/save-the-date (Step 4) · /website/site-chrome (Set the mood) · /website/hero-photo
STEPS     1. Read the song upload box on Save the Date. 2. Read the song upload box on Set the mood.
EXPECTED  One limit for "your song" (both say it becomes the site's song), in plain words, said once.
ACTUAL    Save the Date: "UP TO 40 MB … MP3/M4A/AAC/OGG/WAV, up to 40 MB. This becomes your wedding-site song."
          Set the mood: "UP TO 20 MB … MP3, M4A, AAC, OGG, or WAV. Up to 20 MB." Every box prints the raw types
          ("AUDIO/MPEG · AUDIO/MP4 · AUDIO/AAC…", "VIDEO/QUICKTIME") and then the same limit again in words. Hero photo:
          "JPEG · JPG · PNG · WEBP · UP TO 10 MB" then "JPG, PNG, or WebP. Up to 10 MB." ("MB" breaks onto its own line
          at 375). "wedding-site" is a banned word (Event Hub).
RULE      Add 2 CLEAN (said once) · brand.md word rules · Kit § 5 item 3 (two pages disagree on one fact)
SEVERITY  wrong
SOURCE    SEEN
```

#### N-05 · Memories opens a six-step tour that blocks every control until Skip

```
PAGE      /dashboard/[eventId]/memories   (event: stg-carla-miguel)
STEPS     1. Open Memories for the first time on a phone.
EXPECTED  The page works at once; a first-timer can tell what to press (Add 5: a step that needs a tour is a finding).
ACTUAL    "STEP 1 OF 6 · Albums … Press Next" covers the grid; 12 of the 15 controls (Papic switch, credits ⓘ,
          All Papic settings, Recap, Thank-You Video, the album and chapter pickers, ⚙, the photo) could not be pressed
          until the tour is dismissed. Also K1: "Add photos" and the floating "+" are both terracotta on the same screen,
          beside a grid tile "Add photo · 3 credits each" — three ways to add one photo.
SHOTS     375 light + dark (committed as the area's home shots)
RULE      Add 5 (first-timer, no tour) · HOUSE_DESIGN_STANDARD K1
SEVERITY  look
SOURCE    SEEN
```

#### N-06 · Dark: the bottom bar loses the active tab on Memories

```
PAGE      /dashboard/[eventId]/memories (dark, 375 and 768)
STEPS     1. Preferences › Appearance › Dark. 2. Open Memories.
EXPECTED  The active tab marked as in light (the terracotta pill on "Memories").
ACTUAL    In light the Memories cell is a terracotta pill; in dark no cell is marked, so the person cannot see where they are.
SHOTS     home-375-light.png / home-375-dark.png in shots/area-3/
RULE      DARK_MODE_STANDARD (same affordances in both themes) · Add 7
SEVERITY  look
SOURCE    SEEN
```

#### N-07 · The event's badge in the side rail spills out of its ring

```
PAGE      every event page at 768 and 1280 (event: stg-carla-miguel; shell, shared with area 2)
STEPS     1. Open any event page wider than a phone. 2. Look at the round badge above the event name in the rail.
EXPECTED  "C & M" inside its ring, on one line.
ACTUAL    "C &" and "M" break onto two lines and the M hangs outside the ring.
RULE      Add 2 CLEAN/BALANCED
SEVERITY  look
SOURCE    SEEN
```

#### N-08 · Pages filed under two sections: the masthead says Today, the back link says Memories / Studio / add-ons

```
PAGE      /studio/papic/recap ("Today · Papic" / "Back to Memories") · /studio/about/papic ("Today" / "Back to Studio")
          · /studio/setnayan-ai and /studio/live-studio-control ("Today" / "Back to add-ons") · /studio/playlist ("Today" / "Back to Carla & Miguel")
STEPS     1. Open each page. 2. Compare the masthead, the lit bottom-nav cell and the back link.
EXPECTED  One home for each page: the masthead, the lit tab and Back agree.
ACTUAL    The bottom nav lights Today and the masthead says Today, while Back names another place. "Studio" and
          "add-ons" are not in the event menu (Today · Guests · Suppliers · Memories · Hub), so a person cannot find
          them again.
RULE      design-and-wiring A3 (registered and reachable) · Add 2 EFFECTIVE
SEVERITY  wrong
SOURCE    SEEN
```

#### N-09 · Send run: an empty white picture frame, and the guest's phone number beside "Send"

```
PAGE      /dashboard/[eventId]/guests/send   (event: stg-carla-miguel)
STEPS     1. Guests › Send invites.
EXPECTED  The invitation picture the guest will receive; the guest's email (Setnayan sends email only).
ACTUAL    A large empty white rounded square where the picture belongs (light; a white surface in any theme). Under the
          name: a phone icon and "+639170000069" directly above the main "Send" button, which reads as texting.
RULE      Add 3 (empty image frame) · CLAUDE.md §1 (email only, no SMS) · I-08
SEVERITY  wrong
SOURCE    SEEN
```

#### N-10 · Save the Date reveal picker: text-only tiles, a lone tile, and at 375 the preview is off-screen

```
PAGE      /dashboard/[eventId]/studio/save-the-date › Step 5 "How your page opens"
STEPS     1. Open at 375. 2. Tap each of the 10 reveals.
EXPECTED  (Add 8) Each choice with a picture of what it does, grouped, the current one marked, one tap to watch it.
ACTUAL    Marked: yes (the picked tile rings). Plays: yes, in the Live preview, all 10 (no write is made by a tap).
          But: tiles are words only ("Veil · VEIL LIFTS AWAY") while the Maker's Cover Scene › Style draws each reveal
          (`RevealPicture`); 11 tiles in a flat 2-column grid with "Fireworks" alone on the last row; no grouping (the
          envelopes and the scenes mixed). At 375 the preview sits below the option rows and "Make this mine", so a
          tap shows nothing until the person scrolls down. At 1280 the preview sits beside the tiles (good), but two
          terracotta buttons share the screen ("Make this mine" and "Render my Save the Date") and the launch note
          says "Website → Privacy". The page logs React error #418 (text mismatch) on load.
SHOTS     375 light (grid of all 10), 1280 light
RULE      Add 8 · K1 · brand.md word rules
SEVERITY  look
SOURCE    SEEN
```

#### N-11 · Small words: "1 PHOTOS", "Apply 0 changes"

```
PAGE      /studio/papic/recap ("1 PHOTOS · 0 MESSAGES · 97 GUESTS") · /dashboard/[eventId]/prints (a disabled "Apply 0 changes")
RULE      brand.md (plain words)
SEVERITY  wrong
SOURCE    SEEN
```

#### N-12 · The Event Hub preview frames inside the Maker answer 500

Folded into **B-02** (same 23.6 s 500s). Seen on `/launch`, `/monogram` → Maker, `/studio/mood-board` → Maker,
`/website/editor` → Maker, `/site-editor/*` → Maker and `/prints` (both events): the Maker's own picture of the
Event Hub is an error frame while the hub is down.

#### N-13 · Run of show: "Use this" adds nothing

```
PAGE      /dashboard/[eventId]/studio/papic/run-of-show   (event: stg-carla-miguel)
BUTTON    "Use this" beside each suggested prompt under a moment
STEPS     1. Open Run of show at 375. 2. Press "Use this" on suggested prompts (the press pass pressed about 30).
EXPECTED  The prompt joins the event's challenges (`addLibraryChallengeAction`), and the page says so.
ACTUAL    The page did not change and said nothing; two presses logged a failed resource load. Afterwards Papic
          Challenges still reads "0 of 8 chosen — room for 8 more." Nothing was added, so nothing needed undoing.
          (P-01 is the code side: these presses read as done when the write fails.)
RULE      design-and-wiring B5/B6 (every press reaches a real action; a failure renders as a failure)
SEVERITY  broken
SOURCE    SEEN
```

#### Press-pass notes (not findings)

- E-Gifts message presets: pressed by hand, each fills the message box (the counter cannot see a text box's value).
- Save the Date font, colour and reveal picks change only the live preview (no page text changes): pressed, not failed.
- Memories: 12 presses blocked by the first-time tour (N-05).
- Playlist feel chips (24) and two Event Hub plan rows on `/studio/website-pro` could not be pressed: something sits over them at 375 (the floating bottom bar over the lower rows). Not confirmed as a fault; recheck by hand.
- Widgets "is always visible" rows are fixed by design; Move up / Move down and Auto wait for Save. Privacy's two switches and life-flash's sort (no items) gave no visible change: recheck by hand.
- "Create chapter" and "Apply 0 changes" are disabled until there is something to apply: correct.

## Phase B — what the walk confirmed from phase A

Phase A findings are about code paths; most of them are about a failed read or a failed write, which a healthy copy
does not produce on demand. Each is marked: **SEEN** (confirmed in the browser), **NOT SEEN** (the copy did not show it;
the code finding stands), or **n/a** (needs a failure or a flag the copy does not have).

| ID | Phase B |
|---|---|
| B-01 | **SEEN** — 61 coming on Guests; every moment reads "No guests to assign". |
| A-01 | **SEEN** — with Dark chosen, only `/memories`, `/life-flash` and the Papic forward (lands on Memories) paint dark. Every other area-3 page stays light. |
| F-01 | n/a (coordinator account and a failed read). The forwards for a couple land: see § Forwards. |
| E-01, E-02, E-03, E-05, E-10, E-11, E-13, E-16, E-17 | n/a — failed reads and writes. Code findings stand. |
| E-06, E-18, I-08 | **SEEN** — "Your monogram", "Save monogram", "Monogram text" on the invitation page; "monogram" on Alaala and Panood setup; "YOUR INVITATION SITE"; "wedding-site song" (N-04); "Website → Privacy" (N-10). |
| E-04, E-12 | NOT SEEN on Carla (Event Plus paid; the Event Hub locks did not show). Code finding stands. |
| E-07, E-08, E-15, E-19 | NOT SEEN in this pass (the Maker's inner layers did not open: B-02 broke its preview). |
| E-09, E-20, I-11, M-11, P-11, S-10 | **SEEN** as addresses: every editor sub-page, the send run, assignments, crew and moderation open at their own address. |
| E-14, P-07 | n/a — iPhone app only (`/apple-pro` sends a web browser back to the event Home). |
| L-01 … L-09 | n/a — `/panood/control` did not open within 180 s on the copy (load); the live controller needs a second device. |
| L-10 | **SEEN** — "WEB V1", "JUST LAUNCHED · EARLY ACCESS", "Be one of the first", "— No reviews yet" on Live Watch (`/studio/live-studio-control`). |
| L-11 | **SEEN** in part — Memory lane mixes a black "Save" button, a terracotta "Generate screen code" and a terracotta switch on one screen. |
| L-12 | NOT SEEN (controller did not open). |
| M-01, P-04 | NOT SEEN on the pages walked (the Drive line on Recap reads "Save the originals to your Drive"). Code finding stands. |
| M-02, M-03, M-04 | n/a — failed catalogue reads. |
| M-05, M-08 | n/a — failed writes / reads. |
| M-06 | **SEEN** — `/galleries` and `/memories` are both titled "Memories"; Alaala's masthead is "Memories · Kept alive". |
| M-07 | **SEEN** in part — "Your wedding, kept alive." and wedding moments (Bridal March, Money Dance) on Alaala. |
| M-09 | **SEEN** — `/dashboard/library` is on `DARK_READY` but lands on `/dashboard?seg=memories`, which stays light. |
| M-10 | **SEEN** in part — K1 on Memories (N-05); half-pixel type measured on Alaala (14.5 px, 13.5 px, 10.5 px) and Assignments (10.5 px). |
| P-01, P-03, P-05, P-08 | n/a — failed writes / reads. |
| P-02 | NOT checked by a walk from the menu (pages opened by address). |
| P-06 | n/a — clipboard blocked. |
| P-09 | **SEEN** in part — wedding moments on every event's Papic pages. |
| P-10 | **SEEN** — the crew poster is 125 px wider than a 375 px screen; the invitation print sheet 238 px wider. |
| I-01, I-04, I-06, I-07 | n/a — failed reads / writes. |
| I-02, I-03, I-09 | NOT SEEN in this pass. |
| I-05 | NOT pressed (Regenerate QR would cut the crew's paired code on a shared seed). |
| I-10 | **SEEN** in part — the send run is a hand-built full-screen layer (✕ top left, its own progress bar). |
| S-01, S-02 | **SEEN** in part — Papic About reads "FREE TO START" with a "Get" button. |
| S-03, S-05 | n/a — failed reads. |
| S-04 | NOT pressed (Delete would remove a chapter). |
| S-06 | code only. |
| S-07 | **SEEN** — Setnayan AI's headline is "Stop guessing who to hire" (brand.md tone bans "Stop" headlines); "wedding" on the playlist and Setnayan AI for every event. |
| S-08, S-09 | Patiktok pages are retired and send a couple to the event Home (seen); not walkable. |

## Add 1 · Shapes (phase B)

The phase A marks in § Progress stand; the walk agrees with each. What the browser added:

- `/guests/send` is a full-screen layer (✕, progress bar, one guest at a time) at its own address → **FULL-SCREEN POPUP** (RiseScreen). Differs.
- Save the Date is one long PAGE of six steps with the preview at the foot on a phone → keep PAGE, but the reveal step's preview must sit with the choice (N-10).
- Memories' first-time tour is a popup over the page that blocks it (N-05) → should not be a gate at all.
- The Maker's sub-tools (`/website/*`, `/monogram`, `/studio/mood-board`) already forward into `/launch?tool=details&item=…`, so they open as the Maker's own panel; the six editor sub-pages that still open as pages are listed in E-20.

## Add 2 · Clean, balanced, effective (the screens walked)

| Screen | CLEAN | BALANCED | EFFECTIVE |
|---|---|---|---|
| Memories | fails: three "add" controls, two terracotta (N-05) | ok | fails: a 6-step tour before the page can be used |
| Memories › More from your day | ok | fails at 375 (N-03) | ok |
| Alaala (Kept alive) | fails: every card carries a helper paragraph | ok at 375; at 1280 the cards hold a 540 px text column in a 770 px card | ok |
| Story Assignments | ok | ok | fails: nothing can be assigned (B-01) |
| Invitation (QRs & print) | fails: 390 buttons on one page (4 per guest × 97) | ok | fails: the page title is a count ("97 guests · QRs & print sheet") |
| Send run | fails: an empty white frame (N-09) | ok | ok: one guest, one Send |
| Memory lane | fails: internal code, raw id (N-02) | ok | fails: no masthead, no lit tab |
| Save the Date | fails: two terracotta buttons; limits said twice in raw types (N-04, N-10) | ok at 1280; at 375 the preview is far from the choice | fails at 375 (N-10) |
| Setnayan AI | ok | ok | fails: "Stop…" headline; the buy button shows before what you get |
| Live Watch | fails: "WEB V1", "EARLY ACCESS", empty rating card | fails: the card row runs off the right edge at 375 (third card cut) | ok |
| Recap | fails: Drive banner above "Back to Memories" | ok | fails: filed under Today (N-08) |
| Set the mood / Hero photo | fails: raw types + limit twice (N-04); a native checkbox for "Turn background music on" (choices rule: a switch) | ok | ok |
| Creator (Your Chapters) | fails: long helper paragraphs under every field | ok | fails: a native select ("Not about one of my events") and a mm/dd/yyyy date box (US order) |
| Download all | ok | ok | ok: "No photos or clips to download yet." |

## Add 3 · Placeholders a real couple could see

- Send run: an empty white picture frame (N-09).
- Memory lane: "coming-soon (auto)" and the raw event id (N-02).
- Live Watch: "WEB V1", "JUST LAUNCHED · EARLY ACCESS", "Be one of the first", "— No reviews yet" (L-10).
- Papic About: a "How it works" phone with "12 tagged" and coloured tiles — a drawing, labelled as a preview: fine.
- The Maker's guest preview carries a "SAMPLE" mark and a sample "Table 7 · code" guest: labelled, fine.
- Not findings: the seeded `stg-` events, `@final-check.test` names, the seeded phone numbers.

## Add 4 · Every place area 3 sells (seen on the copy, Carla & Miguel)

Prices are read from the copy's catalogue (copied from live). Nothing was paid; no checkout was submitted.

| Route | What is sold | Price shown | How a person reaches it |
|---|---|---|---|
| `/memories` (Add photos sheet, grid tile) | Papic credits (a photo costs credits) | "47 credits left · 3 credits a photo"; no ₱ on the page | Memories › Add photos |
| `/studio/about/papic` | Papic | "FREE TO START" + "Get"; no ₱ | Studio About (only from Today-filed doors) |
| `/studio/setnayan-ai` | Setnayan AI | ₱2,790, "one-time purchase", "Unlock Setnayan AI" | Today › add-ons |
| `/studio/live-studio-control` | Live Watch controller (multi-camera) | ₱3,990 "one price per event" | Today › add-ons |
| same page, "Add hosted channel" sheet | Live Watch hosted channel | ₱3,990 "/ day" (a second catalogue row with the same price on the copy) | the sheet's button |
| `/studio/save-the-date` Step 5 | the cinematic reveal | "add the cinematic reveal with Event Pro" (no ₱ on this step; Carla shows "Cinematic openings unlocked") | Save the Date |
| `/website/*` locks, `/prints` look lock, `/our-story` | Event Pro / Event Plus | no ₱ on the lock (E-04, E-12, M-04) | the Hub editor |
| `/memories` ⚙ "Keep full resolution", `/memories/thank-you` | storage upgrade, Thank-You film | not shown on the copy for Carla/Mika | ⚙ |
| `/monogram` → Maker › Logo | Logo Maker unlock | not shown (I-09: no price on the page) | Maker › Details › Logo |
| `/apple-pro` | Event Pro in the iPhone app | web sends it Home | iPhone app only |

- **EVIDENT:** fails for Papic About and every Event Hub lock (no ₱ before the button). Setnayan AI and Live Watch show the price first: ok.
- **CLEAN:** Live Watch fails (two prices, two buy doors, a hosted-channel sheet over the page, plus "EARLY ACCESS").
- **HONEST:** not provable for the failed-read cases on a healthy copy (E-03, L-07, M-02, M-03, S-01, S-03 stand from code).
- **Taps from the wall to "payment logged": not counted.** Logging a BDO / GCash proof writes an order to a shared seed; it was left for the money fixer with area 8.

## Add 5 · Main jobs, as a first-timer on a phone

| Job | Rating | The step that makes it hard |
|---|---|---|
| Upload a photo to Memories | OK | the first-time tour blocks the page until Skip (N-05) |
| Assign a guest to a story moment | HARD | impossible (B-01) |
| Send invitations one by one | OK | "Send" sits under a phone number; nothing says it sends an email (N-09) |
| Pick a reveal for the Save the Date | HARD at 375, OK at 1280 | the preview is below the fold at 375 (N-10) |
| Write the E-Gift note | EASY | the presets fill the message at once (seen) |
| Set up Memory lane for the venue | HARD | "coming-soon (auto)", no masthead, several look-alike buttons (N-02) |
| Write a chapter (creator) | HARD | a wall of helper text, a native select and a US date box |
| Edit the Event Hub in the Maker | not rated | the Maker's preview frames answered 500 (B-02) |

## Add 7 · Sizes and dark

- **Three sizes:** every page that opened was walked at 375, 768 and 1280. Only two overflow the screen: the invitation print sheet (+238 px at 375) and the Papic crew poster (+125 px at 375). At 768 the side rail shows and the bottom bar hides: no page showed both.
- **DARK per page:** yes on `/memories` (both events) and `/life-flash`; **no on every other area-3 page** (A-01). `/dashboard/library` is listed dark-ready but lands on Home (M-09).
- **Partly dark:** none of the dark pages showed a white surface at any width (measured: no element over 5,000 px² with a near-white fill). Memories' top block carries the glow in dark (seen).
- **Across roles:** the area's six home shots are Memories (`shots/area-3/home-{375,768,1280}-{light,dark}.png`). Note for the controller: on the event Home (area 2), dark at 768/1280 leaves near-white fills on the account chip, the rail's "Today" row and a neutral badge ("2 suppliers without a time").

## Add 8 · The reveals

- **One list:** the Maker (`maker-made-once.tsx`), Save the Date (`StdBuilderClient.tsx` → `RevealPreviewCard`) and the admin Reveal Studio (`studio.tsx`) all read `REVEAL_LIBRARY`, filtered only by the admin's allowed map: same 10 names, same order (Veil · Beach curtains · Envelope · classic · Envelope · gatefold · Fabric · Scratch · Smoke · Cathedral doors · Petals · Fireworks), plus "No reveal" first on Save the Date. Seen on Save the Date: all 10, in that order.
- **How a couple finds them:** Save the Date › Step 5: N-10 (text-only tiles, lone last tile, preview off-screen at 375; fine at 1280). Maker › Cover Scene › Style: could not be walked — the Maker's preview frames answered 500 (B-02); the code draws a picture per reveal (`RevealPicture`), so the two pickers already look different.
- **Every reveal plays (Save the Date live preview):** all 10 picked at 375 and 1280; the preview played Veil, Beach curtains, Envelope · classic, Fabric and Fireworks on screen (the others played below the fold at 375). Picking makes no write (no request but the page's own reads).
- **On the guest's Event Hub:** at 06:56 UTC the Veil drew at 375 and waited for "Tap or swipe up to unveil" (shot `hub0`). A light strip about 15 px wide shows down the right edge of the veil at 375. From ~09:00 every hub answered 500 (B-02), so 768/1280, dark, reduced motion and the other nine reveals could not be played on the hub. `?reveal=` previews are off on the copy (`NEXT_PUBLIC_STD_REVEAL` is not "1"), so a reveal other than the couple's choice cannot be shown to a guest page without changing the couple's draft — not done.
- **Reduced motion:** the code stands the opening down (`reveal-overlay.tsx`: `!reducedMotion` in `active`) — not seen on the hub (B-02).
- **Code note:** a comment in `reveal-overlay.tsx` names a price ("the paid ₱999 opening"): CLAUDE.md §1 says never write a price in a comment.

## Add 9 · not area 3. Add 10b · not area 3 (supplier QR is areas 5–7).

## Offline — beyond the five (Add 10)

Only parts that are NOT one of the owner's five full-offline places (guests at the venue on the Event Hub and walk-in hub · supplier on the day · supplier at an expo · couple at an expo · coordinator on the day). Area 3 covers the couple/host and the parts of the guest Event Hub the Maker writes.

### Event host or couple

| Part (route · what it does) | Moment the signal drops | Level | Why |
|---|---|---|---|
| `/dashboard/[eventId]/live` · Memory lane: hide a photo, switch guests' phones off | at the venue on the day | SAVE AND SYNC | A wrong photo on the venue screen must come down now; a hide that waits for signal is too late, so the tap must queue and the screen must say "will hide when back online". |
| `/panood/control/[eventId]` · live controller (cut, on-air, Go live / End) | at the venue on the day | FULL for the program window, SAVE AND SYNC for settings | The stream runs on venue Wi-Fi; the controller is a form POST + redirect per tap with no queue and no offline sign, so a dropped tap looks done. |
| `/panood/program/[eventId]` · the OBS program window | at the venue on the day | FULL (keep the last scene) | OBS captures this window; a reload error page goes out live to the online guests. |
| `/dashboard/[eventId]/studio/papic/challenges` · "Ask now" / "Stop" | at the venue on the day | SAVE AND SYNC | A challenge is asked at a moment in the program; it must queue and say so, not report "saved" after a failed write (P-01). |
| `/dashboard/[eventId]/studio/papic/run-of-show` · "This is happening now", Pause | at the venue on the day | SAVE AND SYNC | Same as challenges: the coordinator marks the moment as it happens. |
| `/dashboard/[eventId]/memories` · the Papic on/off switch and credits | at the venue on the day | READ-ONLY (switch: SAVE AND SYNC) | The couple checks credits and turns cameras on or off at the venue; the balance must show the last copy with its time, never ₱0 or 0 credits. |
| `/dashboard/[eventId]/event-qr` · the crew pairing QR | at the venue on the day | READ-ONLY | The crew scans it at the door; the saved copy must hold the current code. |
| `/dashboard/[eventId]/invitation/print` and `/studio/papic/crew/poster` · print sheets | on the road (printing at a shop) | READ-ONLY | The couple prints at a print shop with weak data; the saved copy must print. |
| `/dashboard/[eventId]/guests/send` · the send run | in a province with weak data | SAVE AND SYNC | "Mark sent" after sharing a link through a messenger app must not be lost when the signal drops between invites. |
| `/dashboard/[eventId]/launch` (the Maker) | in a province with weak data | READ-ONLY + draft kept on the phone | A couple editing on weak data must not lose a typed story or a picked reveal; the Maker draft lives on the server only today. |
| `/dashboard/[eventId]/memories/download-all`, `/galleries`, `/alaala`, `/story` | on the road | READ-ONLY | Looking back at photos and words; nothing breaks if it waits. |

### Guest Event Hub (the parts the Maker writes)

| Part | Moment | Level | Why |
|---|---|---|---|
| The opening reveal on `/[slug]` | at the venue on the day | FULL (already part of the five: the saved Event Hub copy must carry the reveal's art, or open straight to the page) | A guest opening the saved copy with no signal must not be stuck behind a reveal whose pictures did not load. |
| `/[slug]` Memory lane on guests' phones | at the venue on the day | READ-ONLY | It is a slideshow; the last photos are enough. |

### Offline pieces tried on the copy (browser set offline)

- **Memories, signal dropped with the page open:** the offline bar appears at once and reads "You're offline". The page stays as it was.
- **Memories, reloaded with no signal:** the service worker (`/sw.js`) was registered and active, yet the reload gave the browser's own "No internet" error (`ERR_INTERNET_DISCONNECTED`): no saved copy of Memories was served. Caveat: this was a headless browser's offline switch; a phone test on a quiet copy should confirm before a fix.
- **Back online:** the bar left; nothing to catch up (no write was queued).
- **Papic capture, check-in desk, saved Event Hub copies:** guest-side (area 4); the Event Hub could not be tested because it answered 500 (B-02).

<!-- PHASE-B-END -->

## Second pass (25 Nov)

Adds 11, 11b, 12, 13, 15, 17, 18 on the pages batch 1 touched (from the walk's shots and the code). Lane in brackets.

- [B] `/dashboard/[eventId]/alaala/assignments` · Add 13 / Add 12 · "Nudge" and "Remove" are word-only bordered chips (no icon, 12 px, under 44 px tall), not `ActionButton`. Should be: icon + word, house press. Reference: iOS Mail swipe actions (one destructive, one neutral).
- [B] `/dashboard/[eventId]/alaala/assignments` · Add 11 · ten moments in one long list with no jump; on a phone the person scrolls past all ten to reach the last. Reference: iOS Settings grouped list with a section index.
- [B] `/dashboard/[eventId]/live` · Add 12 · the mode picker shows a `Loader2` spinner (`animate-spin`) while saving; the house has no spinners (Motion standard: Tap/Release press, skeletons). Same file family as L-11.
- [B] `/dashboard/[eventId]/live` · Add 11b · the same single column at 1280 as at 375 (a phone column on desktop).
- [B] `/dashboard/[eventId]/invitation` · Add 11 / 11b · 97 guest rows × 4 buttons in one page, no paging or load-more; at 1280 still the phone list. Reference: Gmail desktop list (dense rows, actions on hover) vs phone (row opens a sheet).
- [B] `/dashboard/[eventId]/invitation` · Add 15 · the QR centre mark and print sheet draw the Setnayan mark from `lib/qr-style-svg.ts` / `lib/qr-look.ts`, not the one brand source (already on Add 15's list; confirmed on screen at 375).
- [B] `/dashboard/[eventId]/studio/papic/crew` · Add 13 · "Copy link" and "Print poster" use generic icons; Papic's topic icon (`lib/topic-icons.ts`) is not used on the page.
- [A] `/dashboard/[eventId]/event-qr` · Add 1 · "Regenerate QR" cuts the old printed code (irreversible for new pairings) with no confirm; batch 1 says the outcome, but a confirm like the guest QR's is a new popup, so it waits for the drawing → lane B.
- [B] `/dashboard/[eventId]/studio/photo-delivery` · Add 11b · a phone column at 1280; the connect card's body is a long paragraph.
- Add 17: none of the touched pages is a retired candidate (all have a live door). R6 (challenges, run-of-show) was not touched.
- Add 18: none of the touched pages shows reveal templates. N-10 (Save the Date Step 5) is the area's one second copy; it is batch 2.
- `Copy health (not counted)`: the copy's Event Hubs answered 500 after ~23.6 s from ~09:00 UTC (B-02 / SW-500, area 1 builds it).
