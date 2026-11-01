## 2026-10-28 · feat(offline): EV3 — coordinators and suppliers run the day with no signal

Owner-approved 2026-10-28 (DECISION_LOG "OFFLINE SAVING IS ALWAYS ON", "APPROVED — EVENT DAY NEVER FAILS (always-on)
… + BROWSER OFFLINE SUPPORT", "APP-WIDE SPEED RULE"; prototype claude.ai/artifact/KeAoiB3WoQRH1fqG9hoKzw).

- **The worker keeps the viewer's OWN event pages** (`public/sw.js` "THE SAVED COPY FOR A NO-SIGNAL VENUE"): exactly
  four query-less shapes — `/dashboard/<event>`, `/dashboard/<event>/guests/checkin`, `/vendor-dashboard/on-the-day`,
  `/vendor-dashboard/on-the-day/live/<event>` — in `setnayan-offline-pages-v1` (survives deploys; its old page's
  content-hashed code is kept in the immutable cache when the copy is saved). HTML stays NETWORK-FIRST: a copy answers
  only a navigation whose request failed or one made while the browser says it is offline — never
  stale-while-revalidate. A kept page's own open re-saves it from that same response; its siblings are re-saved at most
  every 30 min (Update now forces). One viewer at a time (a save or a signed-in page by another account —
  `OfflineViewerScript` in the dashboard + supplier layouts — erases everything first; the signed-out landing pages run
  `OFFLINE_COPIES_WIPE_SCRIPT`); a save may name only its own event's addresses; a redirected/refused render is never
  kept; copies are erased after the day after the event (PH time). The copy's `<html>` carries
  `data-sn-saved-copy`, so the page says it is the copy and the day-of refresh tick stands still on it (a failed
  `router.refresh()` reloads the page in Next — it would have re-opened the copy every 45 s).
  🍎 On WebKit a cold worker answers only when the browser says it is offline (or when its in-memory registry lists
  the page) — the 2026-07-03 "Service Worker context closed" crash class is not reopened for online navigations.
- **Coordinator Home › Today "Ready for no signal"** (event day only): the saved mark (amber past **3 h**: "Saved 9
  hours ago · update before you leave for the venue"), Guest list / Seat plan / Run of show / Check-in desk counts (a
  refused read says "Couldn't read", never ✓ or 0), Update now, Print ▾ (check-in list · seat chart by table · A to Z —
  one PickMenu), the works / waits fold, ⓘ help with the owner's limit wording, and "For no-signal venues, use the
  Setnayan app or Add to Home Screen" in a plain browser tab.
- **Supplier Hub › the event card**: the saved mark + Update now at the top (always on — this is the supplier-side
  preload that was missing). **Check-in desk** (Hub › Scan for a supplier who runs the hosts' door): its own saved
  mark, and an **offline queue on the SHIPPED daemon** — a new `checkin` store in `lib/offline` (DB_VERSION 2, create-
  only upgrade), `checkin-handler.ts` replaying `checkInGuest` with the door-side scan time; "● No signal · N scans saved
  on this phone" → "✓ Back online · N sent"; a guest another phone already checked in, or a scan the live check now
  refuses, lands in "Needs a look" — never dropped (an item the daemon gives up on leaves a note too). Only the account
  that scanned sends its scans. `checkInGuest` now reports `already` / `refused` and accepts `scannedAt` (last 36 h,
  never future). The floor console's seat finder says "No signal — finding a seat needs signal" instead of failing.
- Lab: `/dev/home-lab?view=offline[&state=…][&browser=1][&desk=notes|sent]` (dev only).

Guards (each sabotaged once on a scratch copy, red, then restored): `app/sw-offline-copies.test.ts` (network-first after
a deploy · refreshed on open · offline opens each view · code kept · the copy is marked · one viewer · sign-out wipe ·
own-event scope · refused render never kept · failed save keeps the older copy · erased after the window · WebKit cold
pass-through · frames/queries never answered · dev host keeps nothing) — mutations: copy-first (SWR), viewer-erase
removed, save-viewer erase removed, keep-anything, expiry ignored, scope widened, WebKit gate removed;
`lib/offline-copies.test.ts` (the mark is honest; amber line; window; per-viewer registry) — mutations: failed reads as
saved, amber removed; `lib/offline/the-scanner-queues-on-the-daemon.test.ts` — mutations: desk keeps its own
localStorage queue, daemon loses the checkin route, handler sends another account's scan.
`app/sw-production-trace.golden.json` is unchanged (reading the registry no longer creates the cache).

⚠ The amber line (3 h, `STALE_AFTER_MS`) is reasoned from the refresh cadence, NOT yet measured on production data —
this session's read of prod was refused by its permission gate. To measure it (read-only): for past events, count
`guests.updated_at`, `event_seat_assignments.created_at` and the run-of-show rows' change times per hour across the
event day and the day before; the line belongs where the last burst of changes before the start ends.

SPEC IMPACT: DECISION_LOG.md — one row recording what EV3 built: the amber line (3 h, reasoned, measurement pending),
the four kept page shapes, network-first-only HTML, and the WebKit cold-worker limit (iPhone browser tabs need signal or
the app / Home Screen; the help already says so).
