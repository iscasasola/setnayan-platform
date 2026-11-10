## 2026-11-10 · fix(onboarding): the 375 px breaks from the /dev/onboarding-lab sweep (Lane P fixes 1–9)

Owner rule, 10 Nov: uniform buttons and design templates. Screenshots of `/dev/onboarding-lab` at 375 px found nine
breaks; each is fixed, copy, behaviour and every `data-testid` unchanged.

- **Equal-weight actions at equal widths** — new `StepActions` (`app/onboarding/_shared/step-field.tsx`): house
  ActionButtons side by side at equal widths, each the whole row when the words do not fit two to a row. The wedding
  Area step's "More places" / "We already have our venue", the cover photo's "Upload a photo" / "Use a theme picture
  for now", and "Keep the one picked" under the look dropdown (now the template's full-width `StepPick`).
- **Tradition is one dropdown** — the legacy wedding's Catholic / Muslim / INC chip row is one `StepPick`; an
  interfaith wedding ticks two; a not-yet faith is greyed on the web and left out in the store app (as before).
- **The names step's text no longer sits on its box's edge** — root cause: the wedding prototype's reset
  `.onbw *{margin:0;padding:0}` (same weight as a Tailwind class, loaded later) stripped every house part inside
  the approved card flow of its padding and margins. The reset now stops at `[data-setup-card]`; on the prototype's
  own screens the house button (`.ab`) and dropdown box (`.sn-step-box`) get their 14 px sides back.
- **"You did the hard part" is not a card** — the recap sheet's border, radius, shadow and fill are gone; its
  sections keep their hairline dividers and its rows sit on the screen's gutter.
- **Generic needs rows are not boxes** — Photos / One QR / Guest list … are parted by dividers on the list.
- **Nothing clipped** — the date legend and its line keep their spacing under the reset and the swatches now show the
  cells' tints (they drew blank); the monogram's two actions sit at equal widths, each the whole row on a phone. The
  wedding date step is taller than an 812 px phone (its day cells keep the 44 px press floor), so the legend is
  reached by scrolling — it is whole when scrolled to.
- **`ActionButton` passes `data-*` through** (`components/action-button.tsx`) — its own `data-tone` / `data-main` /
  `data-waiting` win. The location step's "Near me" is now the house button and keeps `data-asks-location`.
  Note: existing callers' `data-*` hooks (seat plan, guests, people roster) were silently dropped before and now
  reach the DOM.
- Guard: `LocationStep`'s bare-button ratchet falls 1 → 0.

SPEC IMPACT: None
