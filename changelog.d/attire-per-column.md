## 2026-10-16 · fix(attire): each column wears its own — a men's Wear ▾ never offers or shows a women's style

Owner, on his own event's Attire (a role with "6 people", FOR MEN / FOR WOMEN): *"the drawing is not following the
type of attire."* The men's column read "Long gown" and drew a suit.

**Cause.** The sponsors' row was saved before the 2026-10-14 men/women split with ONE Wear for everybody — a women's
one, `long_gown` (production's published `dress_code_config.groups` holds exactly that for three two-pick groups,
read SELECT-only). `picksOf` handed that one Wear to both columns, every person's Wear ▾ listed all seven styles
(the prototype's "fitting ones first"), and `GARMENT_FOR.m.long_gown` drew a man's "Long gown" as a suit — so the men's
column both offered and displayed a gown while drawing something else.

**Now.**
- `lib/attire-figures.ts` — `STYLE_ORDER` is each person's OWN styles: men and boys Barong Tagalog · Suit · Formal ·
  Smart casual; women all seven (each has a woman's drawing — pantsuit, women's barong); girls the dresses only.
  `GARMENT_FOR` holds only those; `garmentFor` draws the silhouette for a style that is not the person's. New `fitsWho`.
- `lib/attire-rows.ts` — `pickOptions(row, column)` is a column's Wear ▾; `picksOf` reads each column's own style:
  a Wear stored once for everybody stays with the person it fits and reads **"Not said yet"** for the other (never
  the nearest men's style — no outfit is assumed, 2026-09-20). The first men's write pins the women to what they
  read. Officiants & readers, Nikah principals and the celebrant (`either`) keep every style; their figure is the
  person whose style it is. `readerAttire` keeps a one-answer role's style only for the person it fits.
- Studio › Mood Board › Attire — each column's Wear ▾ lists only `pickOptions`; its figure follows its own pick.
- Guest page — the row says "For men · … · For women · …" per column; the reader's panel and the guest checklist
  (`guest-checklist-facts.ts`, via the same `readerAttire`) never tell a ninong the shared gown.
- Labs: `/dev/details-lab?studio=1&attire=shared` and `/dev/maker-lab/guest?attire=shared` (`&you=ninong`).

Guarded by `apps/web/lib/each-column-wears-its-own.test.ts` (each part sabotaged once, red);
`the-palette-wears-a-person.test.ts`'s "every style for everyone" check is amended to the new lists.

No migration: the per-column storage already existed (`dress_code_config.women`, 2026-10-14).

SPEC IMPACT: `DECISION_LOG.md` — a 2026-10-16 row: each column's Wear ▾ lists only that person's styles
(supersedes the 2026-10-14 prototype's "every style for everyone, the fitting ones first"), and the old-data
reading (the person it fits keeps a shared Wear; the other reads "Not said yet").
