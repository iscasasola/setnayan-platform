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
