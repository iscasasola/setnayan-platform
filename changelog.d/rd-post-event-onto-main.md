## 2026-09-30 · feat(event-hub): Post Event scenes, scene styles and the Stage D menu, onto main after the Oct 1 release

Train n (#6166: #6153 Stage D event menu + #6156 scene styles & Post Event) merged onto
`origin/main` after the Oct 1 release train (#6181). #6166 had fallen behind main and its
"typecheck + lint" was red. Where the two collided, both intents are kept, and main's
release wins on guest pages:

- **RSVP** — yes or no only, never "maybe" (main). The Question and Ticket styles now draw
  the same two answers and say the couple's own YES / NO words from the RSVP stage. A guest
  already saved as "maybe" has to pick an answer in every style.
- **Dress code** — the Welcome page's "your own look" half (`part`, `dressCodeGeneral`)
  and the scene's style both apply.
- **Letters (Messages scene)** and the **entourage's Two sides / March styles** use the
  couple's own role names. The existing `role-names-reach-every-screen` sweep caught the
  entourage styles printing the usual words.
- **Entourage** — main's by-role Secondary Sponsors layout plus the train's styles. In
  "Two sides", a **best woman** now stands on the best man's side. Before this, she had no
  side (main's `best-woman-stands-where-the-best-man-stands` sweep caught it). Sabotage
  check: removing her turns the style test red.
- **PickMenu** — the Page ▾ dropdown's icon plus a Style's hint and small preview.
- **Maker fixed parts** — Welcome's look and E-Gifts plus the day's own parts (seat, photos,
  announcements, live hub). A canvas write from a fixed part's Style row goes through main's
  latest-wins queue.
- **Fixed the #6166 CI failure at its source:** `ugat-both-ends` found
  `app/_components/nav/sub-nav.tsx` was only imported by a test after Stage D retired the
  phone sub-nav. The file is deleted, and `the-phone-bar-is-anchored.test.ts` now tests
  the dock holding the bar alone.
- **Shared bundle back under 202KB, and the limit was not raised.** CI measured #6187 just over the
  limit (202.0KB). Every app chunk was byte-identical to main; only webpack's runtime grew, by one
  async-chunk entry. The Maker imported `findMakerSection` from the guest page's ~32KB editing
  bridge, so the bridge was shared by two chunk groups and split into a chunk of its own.
  `findMakerSection` now lives in `app/[slug]/_components/maker-section-find.ts`, and the bridge
  re-exports it. Measured locally: shared 206,833 bytes gz (15 bytes under, identical to main),
  43 async entries (main 43). Maker first load 504.8KB → **500.0KB**. Guard:
  `the-maker-never-imports-the-guest-bridge.test.ts`; pointing the Maker back at the bridge
  turns it red.
- **The "Place card" seat style shows the guest's FORMAL name** (owner 2026-09-30: *"A place card is
  a name card by definition, and 'no casual greetings' means formal, not no name"*). It reads
  "Mr. Manuel C. Casasola" (prefix, first name, middle initial(s), last name, suffix), drawn in the
  hero's Names look, with the table under it. The new `placeCardName` in `lib/formal-name.ts` returns
  NULL without a last name, so the card never prints a bare first name. #6183's no-first-name rule
  still holds for greetings everywhere else. The name is resolved on the server (`site-body`), so no
  new client import. The guest read now also selects `name_prefix, middle_name, name_suffix`; its
  narrow column list is deliberate, and the dup-rule baseline was regenerated with its generator
  (+3 `omit` lines against `ENTOURAGE_COLUMNS`). Guards: `formal-name.test.ts` and
  `every-scene-style-draws.test.ts`. Sabotage checks: printing a bare first name turns both red;
  dropping the Names look turns the style test red.
- Regenerated the port-control baseline with `gen-port-baseline.mjs`.
- Guards: `a-guest-answers-yes-or-no.test.ts` now checks every RSVP style (two answers,
  the couple's words, "maybe" guests must answer). Sabotage check: removing the words
  from the styled answers turns 2 tests red.

SPEC IMPACT: None. This change only combines rulings already in DECISION_LOG
(2026-09-24 "POST EVENT … BECOMES SCENES", the 2026-09-29 scene-style rows and the
2026-09-30 RSVP "remove the maybe").
