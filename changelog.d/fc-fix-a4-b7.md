## 2026-11-25 · design(guest): the Hub cover hint, the venue card and /live Connect follow the approved drawing (final check, area 4, lane B batch 7)

Final check fixer, area 4 (Guest), lane B — drawings approved by the owner (Add 29), drawing
`prototypes/final-check-area-4_2026-11-25/final-check-area-4_2026-11-25.html` §§ 01 and 04:

- `/[slug]` cover: on a pointer screen (hover + fine pointer) the hint reads "Scroll for the event" under a down chevron;
  touch screens keep "Swipe up for the event" (A4-B05 a).
- `/[slug]` venue (photo-card style): the photo and its words share the plate's one hairline frame; the printed inner
  frame inside the card is switched off through its own knob, `--pahina-frame-opacity` (A4-B05 b).
- `/[slug]` host/stranger tree: 24 px between the block above and "The entourage" (A4-B05 c). The phone-width column
  on wider screens (part d) stays as it is (owner, Add 29).
- `/live`: pressing Connect shows pressed at once and stays pressed until the page answers ("Connecting…", locked
  field, no second press, no spinner, no veil); an empty press is the page's own line, never the browser's bubble, and
  spends no rate-limited try (A4-B04). `SubmitButton` gains `spinner` (default true — every other form unchanged).

Held by `apps/web/lib/the-hub-cover-and-live-connect-follow-the-drawing.test.ts`; the guest-page goldens
(`lib/site-body-fixture*.golden.html`) carry exactly the hint and the venue frame change.

SPEC IMPACT: None — the owner-approved drawing, ported.
