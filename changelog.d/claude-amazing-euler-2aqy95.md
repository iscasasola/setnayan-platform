## 2026-11-04 · feat(offline): each person's "Your schedule" is saved for no signal

Owner-approved 5 Nov (schedule plan, "each person's day: Your schedule, saved for no signal"). Built on the EV3 saved
copy (`lib/offline-copies.ts`, `public/sw.js` "THE SAVED COPY FOR A NO-SIGNAL VENUE") — no second system.

**What was already saved, measured on `origin/main` before this change:**
- Crew — the supplier's event console `/vendor-dashboard/on-the-day/live/<event>` (crew see only the Hub): saved (EV3).
- Coordinator — Home › Today `/dashboard/<event>` (its run of show) and the Check-in desk: saved (EV3).

**What was not, and now is:**
- Guest (and a role holder — bridesmaid, ninong, …) — Event Hub › Me `/<slug>?tab=me`, the "Your schedule" card.
  Before: only the per-deploy `setnayan-dayof-<VERSION>` cache held it — erased by every deploy (~6 a day), one copy
  per address for whoever opened it, not erased by "Remove it from this browser", and no mark on the page.
- Supplier, incl. Host/MC — Customer › Schedule `/vendor-dashboard/clients/<event>?tab=schedule`: never kept.
- Hosts / coordinator — the Schedule `/dashboard/<event>/schedule`: never kept.

**The delta:**
- Three addresses join `OFFLINE_COPY_SHAPES` (lib + sw copy, held equal by `app/sw-offline-copies.test.ts`). A query
  is part of an address only where the shape spells it out; the guest's is owned by its slug, never a reserved word.
- Each of those pages draws the existing saved mark (`SavedMarkLine` + `savedMark`, words and tones unchanged) via one
  new wrapper, `app/_components/offline-ready/schedule-saved-mark.tsx`, and keeps its own copy on every open with signal.
- 🧾 A copy's VERSION: each page renders `data-sn-copy-version=<fingerprint of the day it drew>` (`copyVersionOf`);
  the worker records it with the copy. A save from a page of another version re-renders the copy however fresh its
  clock, and until it lands the mark reads "Couldn’t update · the copy from 2:10 PM is still on this phone" — never
  "Saved for offline". A Release, an edit, a deleted moment and a moved call time each change the version; a phone
  clock that is off cannot. A page whose schedule read FAILED renders `unread`, which the worker never keeps over the
  good copy (and the save says it failed).
- Privacy: a guest's copy is kept only when the day on screen is the viewer's own (the pass holder `g-<guest>`, or the
  account whose seat it is — never a host's "Open as", a sample, or the Maker's canvas); the page also posts
  `OFFLINE_VIEWER` so a different person's copies are erased. Sign-out: the existing signed-out landing wipe
  (`LastSeenSignedOutWipe` → `OFFLINE_COPIES_WIPE_SCRIPT`) is unchanged and covers accounts; the worker now also erases
  an event's saved Me when it sees the guest's one sign-out request go by (`POST /<slug>/sign-out`, every guest
  sign-out door), and every copy on `/auth/sign-out`. The day-of cache no longer keeps `?tab=me` at all.
- Lab: `/dev/home-lab?view=offline&schedule=1&state=ok|nosignal|stale` (the guest card is drawn on the server there).
- 📦 Bundles (measured with a production build against `main` @ `bdbd8a2d`, same machine): main holds the shared
  bundle 5 bytes and the Maker's first load 127 bytes under their ceilings. Three things kept this change inside them:
  the reserved-slug check lives in `lib/offline-copy-addresses.ts` (server + tests only), not in the module the client
  hook imports; the Schedule page draws only a plain server slot (`data-schedule-copy`, its facts as attributes) and
  the route's new one-line `schedule/layout.tsx` draws the saved mark into it (`ScheduleSavedSlot`), because the Maker
  draws the Schedule page whole and never imports that layout — an import from the page put 3.6KB in the Maker's
  first load, and an `import()` instead put one more chunk in webpack's runtime, which every page loads.

Tests (extended, each mutation-tested on a scratch copy of sw.js — dropping the version check, the unread refusal,
the sign-out erase, the day-of exclusion, the reserved-slug check, the nav-refresh version or the query in the
address each turned its test red): `lib/offline-copies.test.ts`, `app/sw-offline-copies.test.ts`.

Not done here, said plainly: the supplier Hub's and coordinator Home's own saved sets do not include the schedule
address (they cannot tell its version without another read), so a supplier's Schedule tab is saved when they open it
with signal in the event window. `/<slug>/find-my-table` and the guest's other tabs stay in the shared day-of cache as
before. Not measured on a real phone at a venue.

SPEC IMPACT: None — implements the owner-approved 5 Nov schedule-plan step; no locked decision changed.
