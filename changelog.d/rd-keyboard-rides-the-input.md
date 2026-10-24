## 2026-10-24 · feat(keyboard): the keyboard rides the input — one reading, one band, default on

Owner: "This should be a template that will make everyone adapt." — approved on
`prototypes/keyboard_rides_the_input_2026-10-24.html` (buttons fold). `lib/keyboard-ride.ts` + `useKeyboardRide()`
is the one reader of `visualViewport` (eight readers moved onto it with their behaviour kept) and publishes
`--sn-keyboard-h` / `html[data-keyboard="open"]`, also from the iOS app's keyboard events. `app/_components/typing-band.tsx`
is the Maker's band extracted (its four bars draw it; the in-flow bar renders byte-identical). The bottom bar slides
away while the keyboard is up and its clearance becomes the keyboard's. `ThumbRow` rides by default: "Typing · <place>"
+ Done on a cream plate, the field alone with ✕, ⇕ · ≡ · ＋ folded. The chat composer wears the band over its whole row.
Guard: `lib/every-bottom-input-rides-the-keyboard.test.ts`.

SPEC IMPACT: DECISION_LOG.md row "THE KEYBOARD RIDES THE INPUT — ONE TEMPLATE, DEFAULT ON" (corpus 9ef36d15).
