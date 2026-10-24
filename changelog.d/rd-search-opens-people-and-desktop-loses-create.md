## 2026-10-22 · feat(search, people, topbar): the shell's search finds people and opens their card; the top bar loses "+ Create event" on desktop too

Owner, 22 Oct 2026 — "follow your recommendation":

- **People in the shell's search.** `/dashboard/search` (the in-shell results, #6782 — merged into this branch) lists **People** after your own things (`ShellPeopleSection`, the results' own `fd-item` card):
  your people whose name matches (the roster — names only through `visible_connection_names`, matched by the
  People page's own field matcher `lib/people-name-match.ts`), then **On Setnayan** — `searchPeopleByName`'s
  fence, unchanged (five refusals, four fields, never an email). Nothing new decides who may be found
  (`lib/shell-people-search.ts` + the pure `lib/shell-people-results.ts`). A refused read says
  "We couldn't search people just now", never an empty section.
- **A person result opens their card.** `/dashboard/people?person=<public id>` — the account's
  `users.public_id` (S89U-…), else the person node's `people.public_id` (S89P-…), never a `user_id`
  (`lib/people-person-link.ts`). Somebody on your list opens their roster card (`RosterPerson.publicId`, read
  beside the accounts the roster already reads); anybody else opens an **On Setnayan** card
  (`found-person-card.tsx` — name · face · @tag · why you might know them, Follow · Add) through
  `findPersonByPublicId`, which shares the name search's refusals (`findableHits`). A refused read: "We
  couldn't open that person just now." Closing the card drops the param; Back returns to the results. The card
  opens after mount (it is a portal; a first-render open mismatched hydration).
- **No "+ Create event" in the shared top bar at any width.** The phone had already lost it; at ≥ 1024 the
  shell still drew its default on every couple tree. The default is now nothing — Create lives on the Events
  board (Planning's ＋ and "Create an event"). The Shop's own "+ Create service card" still passes through
  `createSlot`; HQ's `null` still draws nothing. The store shell uses the same shell, so it follows.
- Guards: `app/_components/frontdoor/the-top-bar-creates-no-event.test.ts` (renders the shell signed in — both
  variants, slot unsaid / null / the Shop's — and reads the bar; sabotage: a computed-href default → red),
  `lib/a-person-result-opens-their-card.test.ts` (round trip: the search's href → the People page's resolver
  names the same person; a refused read → unavailable; the section RENDERS with each card linking to its person and is mounted by the page; sabotage: unmount → red, links to the bare list → red, resolve on `connectionId` → red, force
  `unavailable: false` → red). Turned around on purpose: `create-follows-the-surface`, `one-top-bar` (the
  "create button exists" test), `doorway-shell` § 9.

SPEC IMPACT: DECISION_LOG row 2026-10-22 "PEOPLE ARE PART OF THE SHELL'S SEARCH — A PERSON OPENS THEIR CARD; THE
TOP BAR LOSES ＋ CREATE EVENT ON DESKTOP TOO" (corpus `DECISION_LOG.md`).
