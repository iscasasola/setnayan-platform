## 2026-11-24 · feat(offline): R18 — the guest's whole Event Hub works with no signal

The owner ruled the release order on 24 Nov: "start with event hub. then suppliers." This is that first piece. It extends the EV3 saved copy (`lib/offline-copies.ts`, `public/sw.js`). There is no new cache, no new engine and no migration.

- **What a guest's phone keeps now.**
  - It saves every Event Hub page the guest can open when they open the hub with signal inside the window (3 days before to the day after):
    - the arrival page;
    - its own pages: Live (the program, Now · Next), Home, Details, Story and Me;
    - the rooms: seat and table (`/find-my-table`, `/find-seat`, `/seat`), E-Gifts with the couple's numbers (`/pabuya`) and the guest list (`/everyone`);
    - the latest announcement's answer.
  - The venue, saved directions and "Open in Maps" are on the hub page itself.
  - Left out, to keep it small: The Day's Gallery (photos), the 3D walk (`/venue`), the reply and its meal choices.
  - A room the guest cannot open (a forward, or a 404) is recorded as not theirs, never as a failed save.
  - The cap goes from 4 pages per save to 12 (`OFFLINE_MAX_PAGES`, with the reason written beside it). Measured on setnayan.com: a hub page is ~370 KB and a room 70–130 KB, so a whole hub is about 2 MB, with no photos.
- **A deploy no longer erases it.** The guest's pages moved out of `setnayan-dayof-${VERSION}` into the per-viewer saved copy, which no deploy touches.
  - The day-of cache is retired. `activate` deletes an older phone's copy of it.
  - `GuestPreload` no longer asks for the page itself, and the worker never keeps a guest page anywhere else (`isGuestPageUrl`). That leaves one copy per page.
- **Only that viewer's, and the seal holds.** Every kept hub page names its viewer (`data-sn-copy-viewer`), and the worker keeps a guest page only for that viewer.
  - A rotated QR or a removed guest draws a stranger's page. That page is never kept, and the network answering without the seal erases the event's copy.
  - Rooms and the announcement are kept only beside a sealed hub page.
  - The hub's "whose copy is this" rule is now ONE function (`guestCopyViewer`). The rooms ask it too (`roomCopyViewer`).
  - Sign-out, another person signing in, and the day after the event erase the copy, as before.
- **The mark.** Every saved page shows the shipped mark at the top, in the one frame: `savedMark` / `SavedMarkLine`, "Saved for offline · updated 6:40 PM", amber after 3 h on the day.
  - A failed save says so and offers the one "Update now" its words name.
  - Me keeps its own "Your schedule" mark.
- **The address move (#7868, `NEXT_PUBLIC_U_NESTING_CUTOVER`, still off).** Every guest shape reads both `/<event>…` and `/{username}/<event>…` and keeps them as one copy under the bare form. This covers saving, opening, sign-out and the old-copy clean-up.
  - A save follows the switch's 307 only when it lands on the same page.
  - The guard tests run with the switch on, so turning it on cannot silently stop offline.
- **Needs internet (R15).** With no signal, these grey out in place, say "Needs internet" and are `aria-disabled`:
  - Live Watch and the live photo wall;
  - the reply and its meal choices;
  - a guest's privacy requests and the song request;
  - the 3D walk and The Day's Gallery;
  - the couple's Maker doors.

  A tap shows the house toast, "Needs internet · it works again when you're back online", and does nothing else. They come back on their own when the signal returns.
  - One mechanism does this: `lib/needs-internet.ts` plus `needs-internet-guard.tsx`. It greys by address, or by a `data-needs-internet` mark, and writes attributes only.
  - It is mounted on the guest hub and on the couple's three offline pages, not in the dashboard layouts, so the Maker's first load is unchanged.
  - The Papic camera is untouched: it already queues.
- **Words.** The E-Gifts header said "Pabuya"; it now says "E-Gifts".
- **Guards:**
  - `app/sw-offline-copies.test.ts`: 13 new R18 tests, covering both address forms, every page saved, a deploy, the seal, sign-out, the day after, the announcement, the host's app, and one cache only.
  - `lib/needs-internet.test.ts`: the real guard against a fake document, offline and online.
  - `lib/offline-copies.test.ts`: 4 new tests.
  - `app/[slug]/every-saved-hub-page-wears-its-mark.test.ts`.
  - `app/sw-the-maker-asks-once.test.ts`: its day-of tests are re-pointed to the new rules.
  - 17 sabotages were each measured landing (1 → 0) and seen red. One guard was decorative on the first run (rooms kept without a sealed hub page) and got its own test.
- Waits for the owner's OK on drawing frame Q (the greys' look); labelled `do-not-auto-merge`.

SPEC IMPACT: None. This builds R18 and the Event Hub part of R15 exactly as written in DECISION_LOG 24 Nov ("Offline goes live in pieces: the Event Hub first", the coverage audit) and OFFLINE_MODE_PLAN_2026-11-24.md (R18). Nothing was re-decided.
