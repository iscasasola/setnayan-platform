## 2026-10-03 · fix(discover): a Discover event card wears the event's cover, not only its monogram

Owner, on the cale-ice card on Discover: *"why is the cover like this? it should
have adjusted."* Discover's event card (`app/_components/frontdoor/front-door-discover.tsx`)
drew `card.cover` (the monogram, or initials) and nothing else, while the
dashboard's card for the same event wore its hero.

**No second resolver.** The loader (`lib/discover-events.ts` → `dressCards`) now
asks the dashboard card's own resolver, `resolveEventPoster`
(`lib/event-poster.server.ts`, commit 9585ed04c): hero photo → Save-the-Date
background (Pro-gated by the hub's `resolveHubLook`) → the theme's still. It
narrows the result with `sceneCoverFor`, the form a card wears when its words
sit beside the picture rather than on it (the Overview band and the board's
glass cards already use it). A wake (`quiet`) keeps the monogram.

**No picture → the dashboard's paper invitation card (owner ruling A,
2026-10-03).** Measured in production, cale-ice and maria-and-jose (the only two
upcoming public events) are both Classic with no hero photo. Classic never shows a
photo (`heroMayBePageGround`), so their poster is `invitation`, `sceneCoverFor` is
null, and the picture-only cover still drew the bare monogram. Asked to choose,
the owner picked "Paper invitation card". An `invitation` poster now draws the
same card its dashboard card draws: `<EventPoster>` from the same poster facts,
with the mark read through `resolveEventMonogramSvg` and `logoPlaysFor`. That card
is a 3:4 poster whose words do not fit a 16:9 strip, so the Discover event cover
is now 3:4, the dashboard poster's shape, for every event card so a shelf's rows
stay even.

**Only listed public events.** The pure core (`lib/discover-events-core.ts`)
leaves `scene: null`. The loader fills it in only for the ≤ 20 cards
`selectDiscoverShelves` already let through, so no hero is read or presigned for
an event that is not public and listed. A refused cover read costs only the
picture: the card keeps its mark, and the failure is logged as
`discover-events.covers`.

**Render.** The card moved to `discover-event-card.tsx` and its cover to
`discover-event-cover.tsx`, both server components. The paper card brings
`event-poster.module.css` and the `CoupleLogo` island onto `/` (sizes are in the
PR body). The mark is always drawn under the picture. A photo that fails to
load is an `alt=""` image, which draws nothing, so the mark shows through without
a client `onError`. Nothing is printed on the picture (the date plate is its own
chip), so a photo gets no veil. A theme's still keeps the hub's `--hub-scrim`.

**Held by** `apps/web/lib/the-discover-card-wears-the-cover.test.ts`. It renders
the real card and checks that a hero photo appears on it, and that a Classic
public event with no hero draws the paper invitation card (names, mark, date)
but never in place of a picture. It also checks that the mark is the fallback, that a wake gets no photo, that the theme still gets its
scrim, that the cover goes through the one resolver, and that only shelved cards
are dressed. Each check was confirmed to fail when its rule was broken.

SPEC IMPACT: None. This reverses an implementation note in `front-door.css`,
"no hero image is read: a public event's photo is the host's to show on their
own page", on the owner's 2026-10-03 instruction. Photos still appear only for
events the host made public and listed.
