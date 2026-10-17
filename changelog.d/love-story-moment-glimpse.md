## 2026-10-17 · feat(love-story): a moment's 2–3 photos show as Glimpse in Conversation, Timeline and Swipe cards

Owner, on live cale-ice › Story: *"photos uploaded were up to 3, it only showed 1"* → *"Use the Glimpse swipe for a
moment's photos: one big, the next peeking, swipe or auto-scroll; one photo stays as now."*

- The three two-voices looks drew `photos[0]` only. A moment holding two or more photos now draws them at its photo
  slot as the Photos scene's own `GlimpseRail` (drift, pause on touch, still under reduced motion, tap → the shipped
  full-screen photo). `GlimpseRail` gains one optional prop, `width` (the centre card's size), so it can sit inside a
  moment; the rail is sized from the moment (`cqw`), not the window. No second carousel.
- Nothing is cropped (owner, on live "The Proposal", a man cut off at the photo's edge: *"there might be a better way
  to present instead if it looking cropped"*): in these three looks the one photo and every Glimpse frame are drawn
  WHOLE at their own shape (`object-contain`), centred in the look's reserved place (same width and shape as before,
  at most 70svh tall), with the Glimpse corners and lift. The words below never jump while a photo loads. A moment's
  photos store no crop or focal point (refs only), so the whole picture is the only thing to honour.
  `GlimpseRail` gains `whole` (the Photos scene keeps its filled 3:4 cards).
- Swipe cards: inside the photos a swipe moves the photos (the rail is its own scroller and contains its overscroll);
  anywhere else on the card it moves the cards.
- The Maker's empty samples of the three looks draw the Glimpse shape at the photo slot.
- Guard `lib/every-photo-a-moment-holds-reaches-the-guest.test.ts` (a property over every look the registry offers; nothing is cropped).

SPEC IMPACT: None — the ruling is already recorded (DECISION_LOG 2026-10-17 "A LOVE STORY MOMENT'S PHOTOS SHOW AS
GLIMPSE"). Glimpse moves as the shipped slow drift (DECISION_LOG 2026-10-15 "GLIMPSE'S MOTION IS A SLOW CONTINUOUS
DRIFT"), not the "~4 s" step that row repeats.
