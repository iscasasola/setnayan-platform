## 2026-11-05 · fix(offline): a guest's sign-out erases their day-of pages too

Follow-up to #7270 ("Your schedule saved for no signal"), found while building it. `public/sw.js` keeps guest pages
for a no-signal venue in `DAYOF_CACHE` (`/<slug>`, `/<slug>/find-my-table`, the other `?tab=` pages), and
`GuestPreload` asks it to keep `/<slug>` in `IMAGE_CACHE`. Both are ONE copy per address for whoever opened it last,
and the no-signal fallback reads them with `caches.match` (every cache). Nothing cleared them when a guest signed out,
so on a shared phone with no signal the next person could open the previous guest's table page.

Now the worker's existing sign-out hook (`signOutForget`, which already erased the per-person saved Me) also runs
`forgetGuestPages`: a guest's `POST /<slug>/sign-out` (every guest sign-out door) erases that slug's pages from both
caches, and `/auth/sign-out` erases every guest page. Only same-origin keys whose first segment is a guest slug are
touched — never a reserved route, an icon, an image or code. Not answered by the worker (a pass hop stays the
browser's).

Test: `app/sw-offline-copies.test.ts` "a guest’s sign-out erases their day-of pages too…" — mutation-tested on scratch
copies of sw.js (dropping the erase, erasing the day-of cache only, erasing every slug, dropping the reserved check
each turned it red).

Not covered: a pass that expires, or that the hosts remove, without the guest pressing sign-out leaves those pages
until the per-deploy cache turns over (as before).

SPEC IMPACT: None — a privacy fix inside the shipped no-signal fallback.
