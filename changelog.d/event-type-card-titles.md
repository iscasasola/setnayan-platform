## 2026-09-30 · fix(create-event): the event name is inside its card again

Owner, on the "What kind of event are you planning?" grid: *"cannot see the
event names"*. In the board's add-flow side panel (`CreateEventPanel`, 44rem)
every card's name sat above the card's top edge and was clipped.

Cause: `EventTypePhotoPicker` chose its column count from VIEWPORT breakpoints
(`lg:grid-cols-4 xl:grid-cols-5`), but the same page is also imported whole into
a 44rem panel — so a 1280px+ window packed five columns into the panel: cards
~107×134px, shorter than the name + tagline + Begin stack pinned to their
bottom. The stack grew up past the card and `overflow-hidden` cut the name.
The phone sheet had a smaller cousin of the same fault: at 390px its cards are
narrower than the full page's, and Anniversary / Tournament / Christening ran
past a 121px line and were cut at the right edge.

Fix (at the source, same design): from `sm` up the grid is
`repeat(auto-fill, minmax(11rem, 1fr))`, so the count follows the room the grid
actually has in either frame (5-up on the wide page, 3-up in the panel, 2-up on
phones as before); the name is sized to the card (`clamp(1.125rem, 14cqi,
1.875rem)` on a `container-type: inline-size` card) so the longest one-word
names fit; the scrim holds 60% ink up to 60% of the card, lifting white-on-photo
contrast under the name from ~2:1 (Travel, Wedding) to ≥4.2:1, and under the
tagline to ≥5.3:1 (measured at the brightest 5% of pixels over every shipped
photo, page and panel, 390 and 1280).

Guard: `apps/web/tests/e2e/event-type-cards-fit.spec.ts` renders the real
component with the app's compiled CSS, in both frames at 390/768/1280/1440, and
measures every name and tagline box inside its card.

SPEC IMPACT: None.
