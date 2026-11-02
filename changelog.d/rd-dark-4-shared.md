## 2026-10-13 · fix(controls): the shared controls press at 44 and carry their dark (dark mode PR 4, "shared pieces")

Owner rulings: 44 px is the minimum press (2026-10-12); dark mode "approve all" (2026-10-13 — the warm set, the guest
Event Hub never darkened, printouts always light). Every builder that day measured the same faults in the shared
pieces; they are fixed once, at the source. **Light does not change** except the invisible press areas; the ready-list
stays EMPTY, so nobody sees dark yet.

- **One shared press, `.sn-hit`** (`globals.css`): an invisible `::after` 46 px tall around the control's centre,
  vertical only, softly positioned. Worn by the pill selector's choice (38 px), the chip (40 — its old 2-px expander
  pressed at 42), the form-row pill and the dropdown button (40), the toast's Undo / Try again (34). The ActionButton's
  expander now covers the button form too (`.ab::after`), not only the link form (#6499). Measured in the browser with
  `elementFromPoint`: 46–47 px.
- **Dark at the source:** the dropdown button, form-row pills / fields, chips, toast (note + small pills; failure
  words), confirm box, requirements modal, print button, the timeline row's field → the approved card
  (`dark:bg-raised`, #232019); the switch's "off" = the template's dark line; the build-cart peek is the raised card
  in dark; the QR plate (`.qr-slot`) stays white in dark; `.m-btn-primary` / `.m-btn-orange` / `.sn-btn-primary` take
  the page's ink-black words on their light dark-mode fills. Count, the progress ring and the media meter were already
  on paired tokens (measured, unchanged).
- **`lint:contrast`**: the CSS pass reads `:is(a, b)` selector lists whole (the dark override of `.ab-main` /
  `.ab-fill` was missed — a false 1.04:1), and `text-terracotta`'s dark value is read in the dark pass. Dark baseline
  **321 → 305** uses.
- Guards: `lib/the-shared-controls-press-at-44.test.ts` (with `lib/press-reach.ts`),
  `lib/the-shared-pieces-have-their-dark.test.ts`; `action-link-presses-at-44` reads the generalised rule.

SPEC IMPACT: None (implements INTERACTION_RULES § 9 templates, the 44-px ruling and the dark-mode calls as recorded;
no new decision).
