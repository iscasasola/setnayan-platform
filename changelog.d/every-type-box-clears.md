## 2026-10-31 · fix(input): the ✕ clears the box on an iPhone, and every type box has one

Owner, live iPhone, Guests › March with "Dela" typed and the keyboard up: *"Why does the x inside the type box not
clearing the type box. We want every type box too have the clear button"*.

**The cause (reproduced in WebKit at 390×844, touch, a 120 ms held tap — the words stayed "Dela"):** `GlobalHaptics`
answers every button press at finger-DOWN with the iOS haptic switch, a programmatic `.click()` on a hidden checkbox on
`<body>` (`lib/haptics.ts`). The riding row's tap-away (`useTapAway`, `app/_components/typing-band.tsx`) heard that
click as a tap OUTSIDE the row and queued a blur: during the finger's hold the field left, the keyboard closed, the row
unfolded (⇕ · ≡ · ＋ back, the field shorter), and the lift's click was hit-tested where the ✕ no longer was (it hit a
`<p>` of the list). A zero-length synthetic tap hides it, which is why it passed every earlier check. Fix: a click no
person made (`!e.isTrusted`) is never a tap away. After: the box empties, the focus and the riding band stay.

**Every type box:** one shared piece, `components/clear-field.tsx` — `ClearButton` (holds the focus, never focuses),
`clearTyped` (native setter + `input` event, so React state / `onChange` / a save-as-you-type hear it as typing) and
`isClearableField` (the rule). The thumb row draws it; `GlobalClearField` (mounted once in `app/providers.tsx`) draws it
inside any other box that takes words while it is typed into and has words — portaled into the box's own parent so a
sheet's tap-outside and the riding row's tap-away read it as inside. Excluded, by rule: password, number and
numeric/decimal text boxes, date/time pickers, one-time codes, textareas, read-only/disabled, boxes with their own ✕,
and `data-no-clear="<why>"`. March, Seats and the Guests list now search for nothing AT ONCE on ✕ (`ThumbField.onClear`
cancels their 250 ms wait). Guard: `lib/every-type-box-has-the-clear-button.test.ts` (prints the inventory count).

SPEC IMPACT: None — an input behaviour; no locked decision changes.
