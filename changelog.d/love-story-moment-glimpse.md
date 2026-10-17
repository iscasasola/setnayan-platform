## 2026-10-17 · feat(love-story): a moment's 2–3 photos show as Glimpse in Conversation, Timeline and Swipe cards

Owner, on live cale-ice › Story: *"photos uploaded were up to 3, it only showed 1"* → *"Use the Glimpse swipe for a
moment's photos: one big, the next peeking, swipe or auto-scroll; one photo stays as now."*

- The three two-voices looks drew `photos[0]` only. A moment holding two or more photos now draws them at its photo
  slot as the Photos scene's own `GlimpseRail` (drift, pause on touch, still under reduced motion, tap → the shipped
  full-screen photo). `GlimpseRail` gains one optional prop, `width` (the centre card's size), so it can sit inside a
  moment; the rail is sized from the moment (`cqw`), not the window. No second carousel.
- One photo renders byte-for-byte as before (all five looks, with and without the entrance).
- Swipe cards: inside the photos a swipe moves the photos (the rail is its own scroller and contains its overscroll);
  anywhere else on the card it moves the cards.
- The Maker's empty samples of the three looks draw the Glimpse shape at the photo slot.
- Guard `lib/every-photo-a-moment-holds-reaches-the-guest.test.ts` (a property over every look the registry offers).

SPEC IMPACT: None — the ruling is already recorded (DECISION_LOG 2026-10-17 "A LOVE STORY MOMENT'S PHOTOS SHOW AS
GLIMPSE"). Glimpse moves as the shipped slow drift (DECISION_LOG 2026-10-15 "GLIMPSE'S MOTION IS A SLOW CONTINUOUS
DRIFT"), not the "~4 s" step that row repeats.
