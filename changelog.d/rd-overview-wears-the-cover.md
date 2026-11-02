## 2026-09-29 · fix(overview): the Wedding Day tile's band wears the Event Hub's cover, and so does every card on the home board

**The tile.** Owner, on the event Overview's dark "THE WEDDING DAY · Friday,
December 18 · 80 days to go" tile, whose top band showed the stock
`/event-types/wedding.webp` under a random blue/violet per-event grade: *"this
needs to adapt to the background of the event hub"*. The band (`EventScene`,
`app/dashboard/(launcher)/_components/event-scene.tsx`) now takes a `cover`
from the SAME resolver the dashboard card uses since #6105
(`resolveEventPoster`, `lib/event-poster.server.ts`), read for a band by a new
pure `sceneCoverFor` (`lib/event-poster.ts`): the couple's hero photo → their
Save-the-Date background (only where the hub shows it) → their theme's still →
and only when the event has chosen nothing, the stock type photo as before. The
cover wears the Event Hub's own legibility veil (`--hub-scrim` from
`hubLegibilityVars`: the theme's measured scrim in its own colour over a theme
still; rising from the foot over a photo), with no per-event colour grade; the
card's white-title scrim stays the last layer. A wake's band is still and
colourless — no photo, no hue — matching its poster's quiet masthead. A poster
that cannot be resolved, or a cover image that fails to load, falls through to
the old order. No new resolver.

**A second defect found on the way.** The Overview's lean `events_host` select
never named `landing_page_hero_image_url`, so the "own hero wins" path the band
was built with (2026-08) never received a photo — every couple saw the stock
image. The select now reads it, plus `invite_theme`, `std_background`,
`monogram_text`, `monogram_color` (all already projected by `events_host`).

**The home board.** Today's, Put away, Untold and Told cards stay glass cards,
but their band now reads the same cover (`scenePoster` on `GlassEventCard`;
`planningPosters` resolves each board event once — Planning's page, Now
happening, Put away when shown, and `finished`, which is Untold ∪ Told — inside
the board's one wait from #6124). Planning's posters are
unchanged.

Held by `apps/web/lib/the-overview-band-wears-the-hub-cover.test.ts` (the order,
the render — cover over stock, stock only when nothing, a quiet wake — and the
wiring on both surfaces); 7 sabotages each turned it red.

SPEC IMPACT: None — implements the 2026-09-29 DECISION_LOG row "THE OVERVIEW'S
WEDDING DAY TILE WEARS THE EVENT HUB'S OWN BACKGROUND" as recorded.
