# STANDARD · the collection card

> **Owner, 2026-09-23:** *"should be the standard look on alaga, samahan, shortlist. These is a
> proper template that can help us manage and have a unified design. same goes to other that
> needs creating a new something."*

One shell that every collection fills. **Not four lookalikes** — that is the whole point of the
ruling.

## Where it lives today

**Inline in `app/dashboard/(launcher)/page.tsx` (2,176 lines). It is not a component.** Only
`ProgressRing` and `EventMonogram` are already shared. **Step one is extraction, and the first
adopter must not fork it.**

## The anatomy — seven slots, five optional

| slot | required | what it is | Planning today |
|---|---|---|---|
| `cover` | no | image behind the head; falls back to the derived treatment | the couple's photo |
| `kicker` | no | up to 2 chips over the cover | `KASAL` · `YOU ORGANISE THIS` |
| `title` | **yes** | the thing's name | "Indalecio & Claire" |
| `mark` | no | monogram/logo at the card's edge | the generated monogram |
| `meta` | no | one quiet line | "Dec 18" |
| `attention` | no | **one** amber row — what needs the reader | "24 need you · 1 payment t…" |
| `progress` | no | ring + plain-language remainder | "7% · 86 days to go" |

Plus the grid's closing **`+ New <thing>`** dashed tile.

## The rules that make it a standard rather than a style

1. **One attention row, never two.** If a collection has more to say it says the most urgent
   thing. Two rows is a list, and a list is not a card.
2. 🔑 **`attention` and `progress` must accept UNKNOWN as distinct from ZERO.** A card that prints
   a confident **0 needs you** when the count could not be read is this codebase's signature
   defect, in the template. Model both as `number | null`; `null` renders "couldn't load", never
   a number and never silence. See `lib/soft-read.ts`.
3. **The remainder is plain language.** "86 days to go", not "7%" alone. The ring is the
   decoration; the sentence is the information.
4. **Every slot except `title` degrades.** No cover, no mark, no date, no progress — the card must
   still look deliberate, not broken. A third of the Planning grid is already that case.
5. **The `+ New` tile is part of the grid, not a button elsewhere.** It is how a collection says
   it can grow.
6. **The card is a link, whole.** No nested interactive elements competing with it except the
   overflow `⋮`.

## Adopters, and what fills each slot — TO CONFIRM, not assumed

| collection | title | kicker | attention | progress |
|---|---|---|---|---|
| **Planning** (today) | couple names | type · role | tasks needing you | % · days to go |
| **Alaga** | ? | ? | ? | ? |
| **Samahan** | ? | ? | ? | ? |
| **Shortlist** | ? | ? | ? | ? |

⚠ **The three unknown rows are the real work.** Extracting the shell is mechanical; deciding what
"attention" means for a Samahan is a product question. **Do not invent them** — measure what each
surface already shows, propose a mapping, and put anything genuinely new to the owner.

## Build order

1. Extract `CollectionCard` + `CollectionGrid` + `NewThingTile` from the launcher, with Planning
   as the only caller. **Nothing should change on screen.** That is the proof the extraction is
   faithful.
2. A guard: every adopter renders through the component — no forked copy.
3. Then one adopter at a time, each with its slot mapping confirmed first.

**Not yet scheduled.** Event Hub is rank 0 by the owner's own sequence.
