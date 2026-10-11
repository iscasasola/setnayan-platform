## 2026-10-11 · fix(onboarding): the wedding setup cards get their spacing back — the old sheet's reset stops at them

Owner, walking the live wedding onboarding (desktop window, steps 1, 2 and 7 of 9): *"the flow of onboarding is not
fixed properly. button rules spacing rules."* Fields with the placeholder on the left edge, pills with no padding, the
counter, title, line and control stacked with no space, a white blob behind "Pick one".

**The cause (seen in a browser at 375 and 1280, then removed and re-measured).** The approved cards (`SetupFrame`,
`app/onboarding/_shared/setup-card.tsx`; the wedding's own, `wedding-cards.tsx`) are spaced only with Tailwind classes
and are drawn inside `<div class="onbw">`. The old onboarding sheet opens with `.onbw *{margin:0;padding:0}` — as
strong as one Tailwind class, loaded later — so every margin and padding on every card element came out 0: a field was
30 px tall with 0 px inside, every gap between counter → title → line → control → quick answers → footer was 0.

- `onboarding.css` — the reset now leaves `[data-setup-card]` and everything in it alone
  (`.onbw *:not(:where([data-setup-card],[data-setup-card] *))`). Same weight as before, so every `.onbw .x{…}` rule
  still beats it and every older screen is reset exactly as it was.
- `onboarding-desktop.css` — a setup card is capped at 560 px like every other single-column screen (width only). The
  centred flex parent had shrunk each card to the width of its own words (413 px on "Who's getting married?"); 560 is
  also what the approved desktop drawing shows.
- `/dev/onboarding-lab` (dev only — 404 in production) — the REAL `OnboardingShell` with its own wrapper and sheets, no
  sign-in, no database; every server action it would send is refused in the browser (the last button is the real
  commit). `__onboardingLab.open({ step })` opens a card without a page load.
- Guards: `the-setup-cards-keep-their-spacing.test.ts` (every margin/padding rule of every `.onbw` sheet is matched
  against every element of every card as it renders — none may match; sabotaged four ways, red each time) and
  `app/dev/onboarding-lab/the-lab-never-ships.test.ts`. `pills-are-everywhere.test.ts` (3b) anchored on the reset's
  old spelling; it now reads the reset in either form. The Root map lists the lab as an internal page with no door
  (`screens.generated.json`, `no-door.baseline.txt` — one line each, written by their generators), like every lab.

After, on all eight cards in the frame, phone and desktop alike: counter → title 8 px · title → line 8 · line →
control 24 · control → quick answers 20 · → footer 24; a field is 54 px tall with 16 px left/right and 12 px
top/bottom; a quick answer 44 px tall with 16 px left/right. Every older `.onbw` screen was photographed before and
after at 375 and 1280 — the date, the account gate, the services step, the finish, and every screen of the old
sequence — and the pictures are byte-identical; the old "Where" screen that opens inside the area card kept every
computed margin and padding (200 elements, 0 changed).

NOT in this change (reported to the controller, nothing built): the cards still differ from the approved prototype in
structure (the names card, the full-width dropdown fields, the cover preview, the missing fonts and music cards, the
"Next" button's place); "his name is not there" — the record does not say which of the two name slots the account
holder takes once the "who are you" card left the flow; and where each answer is saved.

SPEC IMPACT: None.
