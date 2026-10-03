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

**What the couple customised (owner amendment, 2026-10-03: *"if they
customized it and changed its main background, it should also adjust"*).** The
card wears what the guest's Event Hub draws behind the event, from the hub's own
answers:
- **Main background:** the couple's Main background (Pro media, never on Classic)
  becomes the card's picture, a video as its still. The gated resolution
  (`heroMayBePageGround` ? `resolveMainGround(…)`) was lifted out of
  `app/[slug]/_lib/main-ground-layer.tsx` into `lib/guest-main-ground.ts`
  (`guestMainGround`). The page and Discover both ask it, and the guards that
  pinned it (`page-ground`, `free-themes-are-free`,
  `the-main-background-moves-for-guests`) now pin the lifted module plus the
  page's call.
- **Colour:** their background colour or ombré (free) becomes the paper card's
  ground, through the hub's `guestLookFrom` → `paperGroundOf` (`--color-cream` /
  `--color-ink`, the poster's `--m-paper` made transparent).
- **No theme loop:** where the hub draws no theme loop (an ombré, or "None — just
  the colour"), a theme-still card becomes the invitation card.
- **Published values only:** the event's columns and the live hero row in
  `invitation_widgets`. An unapplied Maker draft is never read.
- **In production today:** neither listed event has a custom colour or main
  background (cale-ice's is "None — just the colour"), so both draw the plain
  paper card.

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
but never in place of a picture. It also checks the customised cases through the
hub's real `guestLookFrom` and `guestMainGround`: nothing customised gives the
plain paper; a colour or ombré becomes the card's ground; a Pro main-background
image becomes the picture (never on Classic, never for a free couple); and an
unapplied draft is never read. It also checks that the mark is the fallback, that a wake gets no photo, that the theme still gets its
scrim, that the cover goes through the one resolver, and that only shelved cards
are dressed. Each check was confirmed to fail when its rule was broken.

SPEC IMPACT: None. This reverses an implementation note in `front-door.css`,
"no hero image is read: a public event's photo is the host's to show on their
own page", on the owner's 2026-10-03 instruction. Photos still appear only for
events the host made public and listed.

**2026-10-04 · perf(logo): the logo player loads only when a logo plays.** `CoupleLogo` now
imports `LayeredLogoPlayer` with `next/dynamic` (`ssr: false`). The player only ever mounted in the
`play` phase (set by an effect after mount), so the server HTML and the still are unchanged; a page
whose logos are stills — every Discover card without a moving mark — no longer ships the player. This
removes the bulk of the `/` route JS growth this PR's `<EventPoster>` import brought in.
