## 2026-10-16 · fix(maker): a text part's Style cards show its words again, on any Cover Scene ground

Owner, live on his phone (Invitation › Home › Title › Style): "previews are not showing properly. small caps shows a
weird photo that is same on the other styles". Every card was the same slice of the cover's photo with no words on it.

- **The cards were fitted on where the words used to be** (`stage-panel/style-preview.tsx`). A card measured its part
  in a 1600 px frame and showed it in a 900 px one. The Cover Scene is `100svh` tall with its words centred, and
  inside the frame `100svh` is the frame's own height, so the words moved about 350 px after they were measured. Now
  the frame has ONE height for the measure and the picture (`MINI_FRAME_MIN`, grown and measured again only when a
  part ends below it), and a part that moves after the fit (a late font or picture) is fitted again.
- **The card hid the ground its words are toned for** (`app/[slug]/_lib/editor-canvas.ts` `canvasOnlyCss`). Hiding
  the rest of the cover also hid the Cover Scene background, but the words kept their cream tone, so on a dark ground
  they were cream on the card's white. The background now stays under the part, with its shipped tone and scrim.
- **(a) The ＋ sat on the Title's words** (`add-part-sheet.tsx` `neighbourOf`). The picked part's frame took the
  cover's background layer (absolutely positioned, the whole screen tall) for "the part above". The gap came out as 0,
  so the frame hugged the words. Layers out of the flow are now skipped (`partNeighbourIsLayer`, `lib/maker-stage-room.ts`).
- **(b) The Reveal tile drew a blank white box** (`stage-tools.tsx`, `reveal-picture.tsx` `revealPageInk`). The
  picture read its colours off the cover's words, which are cream over a dark ground, so it drew cream flaps on the
  cream page. A word in a cream-toned cover is now read with the page's own ink.
- Lab: a Cover Scene "Your photo" pick now draws a stand-in photo (fabric on sand), so the photo case can be reproduced.
- Guard: `lib/a-text-style-card-shows-its-words.test.ts`. It runs every text part × every style × every ground kind
  through the real masthead and the real miniature CSS. Sabotaged once: with the ground hidden again it fails with
  "Title › Small caps on a dark colour: the words are #FBFAF7 over #FFFFFF on the card — 1.04:1".

SPEC IMPACT: None
