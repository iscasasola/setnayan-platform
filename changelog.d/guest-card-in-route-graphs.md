## 2026-10-29 · fix(guests): the guest card opens from every route that calls it

The same fault as Home's ⚙ (#7042), one tap deeper. A walker in the Wedding March, a parent in the Parents row or on
Studio › Prints opens THE guest card through `openGuestCard`, which ANSWERED THE CARD DRAWN. Next sends a client
component in an action's answer through the CALLING route's client manifest, built from that route's SERVER imports
only, and the action is called from the browser (`guest-card-sheet.tsx`) on the Maker, the Event Hub editor, a Details
field (and its intercepted sheet) and Home › Event settings — none of which import the card's pieces from a server file
(the Maker keeps them out of its first load on purpose).

- **Proof (production build of `origin/main`, Next 15.5.28).** On all five routes the card's pieces
  (`guest-invite-cell`, `guest-card-rows`, …) are listed in the route's client manifest with `chunks: []`, and their
  module code lives only in chunks of the Guests routes and the dev labs — so the browser is told to run a module it has
  no way to load. A tap there falls to "Something on our end didn't work". The Guests page itself was fine (its own server
  files draw the card).
- **Fix — answer data, draw in the browser.** `openGuestCard` now answers the card's data (`{ read, returnTo }`); the new
  `guests/_components/guest-card-in-place.tsx` draws THE same `GuestCard` from it, loaded by the sheet at the first tap
  and warmed by the Maker's preload line (`maker-tools.tsx`, "Guest card"). The alternative — importing the card into
  each calling route's server graph — would put the whole card into the Maker's first load, which it was kept out of.
- **First-load JS (gzipped, `check-maker-js-budget.mjs`'s measure, local production builds before → after):**
  `/launch` 500.4 → 501.4 KB (budget 507), `/website/editor` 454.9 → 455.9, Home 490.5 → 490.6, Details field
  426.1 → 426.2, intercepted field 407.6 → 407.7. Shared bundle 201.7 → 201.8 KB (budget 202). No guest-card piece is in
  any first-load chunk.
- **Guard.** `_components/the-settings-sheet-is-in-homes-graph.test.ts`'s `todo` is now a real test over EVERY
  production route: walk the route's server graph to its client boundary, on through the client graph (and through the
  answers of actions that answer drawn pieces — found automatically: a `'use server'` `.tsx` whose code renders), and
  require each such answer's pieces in the route's own boundary. One inert edge (Home's loading screen draws the cover
  band without its ⚙) is listed and held by its own test. Sabotaged once: restoring the drawn answer fails it, naming
  exactly the five routes above.

SPEC IMPACT: None.
