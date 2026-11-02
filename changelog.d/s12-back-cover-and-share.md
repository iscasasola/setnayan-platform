## 2026-09-09 · feat(story): the back cover, and an honest share sheet

**S12 of the by-the-minute story build (`01` §3.9 + §9 · `08` step 2.7), part one.**

- **The back cover** — the door after The End. Renders AFTER the colophon, outside the locked
  close, so the edition still ends on the host's last word and then their song. **Absent, not
  empty**: when the host announced nothing it draws nothing at all, which is what the owner's
  2026-09-07 ruling says most stories should look like.
- **The phone's own share sheet**, feature-detected, beside the Facebook / Pinterest / copy-link
  controls that already shipped.

### Two fake doors refused, and one of them was mine

- **The guest gets no "tell me when there's more".** Measured against production before building
  it: there is no event-follow table of any name, and `push_subscriptions` holds **zero** rows.
  A control that records nothing and notifies nobody is a fake door. `GUEST_DOOR_IS_UNBUILT`
  records the reason where the next person will look.
- **No Messenger button.** The web send-dialog requires a Facebook app id and **there is none in
  this repo or its env names**; an `fb-messenger://` link is inert on desktop. The native share
  sheet is what actually reaches Messenger on a phone, so that is what ships.

### The guard caught the author twice, both times a fake door

The module first sent a stranger to `/create` — **no such route exists**. The test then looked for
`dashboard/create-event/page.tsx`, which is also wrong: the URL is `/dashboard/create-event` but
the file is under `dashboard/(account)/create-event`, because a route group contributes nothing to
the address. **THE URL IS NOT THE PATH.** The guard now opens the real file, so an invented route
cannot pass.

### RULE 0 — most of this session already shipped, and was not rebuilt

The locked close, the colophon, the A3 keepsake broadsheet, the 9:16 card and every metadata claim
in `01` §10 all already ship. Relive ships too — it is absent on `/movie-night` only because no
minute there carries media. **An absent control is not an unbuilt one.**

### ⏭ NOT IN THIS PR, and why

**A4 one-minute-per-page.** `keepsake.css.ts`'s A4 is a *screen-preview width that scales to A3 in
print* — a real per-minute layout does not exist. It is deliberately left: it is a **visual print
layout**, this project cancels every preview build, and a page nobody can render before merging is
the wrong thing to ship blind. It also has to carry S14's new edition stamp through.

`SPEC IMPACT`: None — no schema, no pricing. `Design_Editorial_By_The_Minute_2026-09-07/09` records
the remaining piece.

---

## 2026-09-09 · feat(story): S15 — a tap from the story is attributable, and No. 2 opens on No. 1

**`03` §2.3 · `08` steps 4.2 + 4.3.** Landed in this PR because both halves edit the same
component the back cover does; two branches on one file is how a feature gets deleted by a merge.

- **Supplier reach.** A credit on a published story linked to `/v/{slug}` **bare**, so every
  arrival from a celebration counted as untracked traffic. It now carries
  `?src=editorial&utm=story:{slug}`. The receiving side already shipped — `/v/[slug]` validates
  `src` against a closed set — so this is the missing half of a mechanism, not a new one.
  ⛔ **Reuses `editorial`; does NOT invent `src=story`**, which that set would DISCARD, and the
  only symptom would be attribution quietly returning to nothing.
- **"Previously · No. 1"** at the top of the next edition, when the host started it from the last
  one's back cover.

### Three rules the code had to be built around

🔒 **The tier boundary was nearly moved by a kindness.** The owner's lock: paying changes HOW
RICHLY a supplier is credited, **never WHETHER**. The story names every supplier; only the paid
tiers carry a link out. Making every credit clickable is the obvious improvement and would have
quietly promoted every LISTED supplier. **Only the link that already existed gained attribution**,
and a guard pins the tier predicate.

🔒 **The pointer shows only what the reader could already open.** An unpublished predecessor is
silently absent — a "Previously · No. 1" leading to a locked page discloses that a private story
exists and what it is called.

🔒 **The number is the STAMPED one.** `edition_no` is written once and a trigger refuses to move
it; recomputing here would re-run a count that has since changed, and the point of stamping was
that *"No. 1, theirs forever"* be true.

### ⚠ The campaign carries the slug, not the public id

`03` §2.3 writes `utm=story:{public_id}`. Measured: the editorial loader selects **no `public_id`
at all**, so using one meant widening a read on the busiest page in the product for an identifier
it does not need. The slug is already in the address the reader is standing on.

### Measurement

`TSC_EXIT=0` **and** `ERROR_LINES=0` — and the typecheck caught a real defect, not a formality:
**both slugs are nullable** (a curated sample has no event row; a supplier may have no marketplace
profile). No profile → **no link at all** rather than a dead one; no event slug → the link still
attributes and simply carries no campaign, because a literal `story:null` would poison the reach
numbers it exists to feed.

12 tests across two suites, counts checked non-zero. **Mutation-tested, counts printed, all RED:**

| sabotage | count | result |
|---|---|---|
| invent `src=story` | 1 → 0 | 6 pass → 4 pass, 2 fail |
| allow a dead link for a profile-less supplier | 1 → 0 | 6 pass → 5 pass, 1 fail |
| make every credit a link (moves the tier line) | 1 → 0 | 6 pass → 5 pass, 1 fail |

🪤 **`lint-one-comment-stripper` caught this PR growing a second stripper** — and caught it only
because the guards were re-run AFTER the last edit. **A guard sweep run before your last edit
proves nothing about your last edit.**

### ⏭ Still not built, and named

**The live-viewer figure.** `panood_broadcasts.peak_concurrent_viewers` exists (S4) with **zero
readers and zero writers**; filling it means extending the broadcast controller's own poll, which
is the Live Studio surface, not the story. **A4 one-minute-per-page** remains as recorded above.
