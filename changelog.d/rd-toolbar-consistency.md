# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-10-10 · fix(maker): Edit · Style · Background · Animate read as one toolbar on every stage

A consistency pass on the new Event Hub Maker's phone toolbar, from a measured list (owner 2026-10-10: *"please make Edit | Style | Background | Animate Consistent in design"* · *"long press to preview whole page has not return button?"*). One commit per item.

- **Exit preview works on the RSVP stage.** Holding ▶ opens the whole-page preview on every stage, but on RSVP a tap on "Exit preview" reached the guest's page instead of the button — only Esc left the preview. Cause: the RSVP stage is a layer laid over the work area at z-30 in the Maker's shell (`maker-shell.tsx`, `data-maker-rsvp-layer`) and the button was drawn into that same shell at z-26, so the stage's own frame was on top of it. The button now stands above every layer the shell lays over its work area (`stage-tools.tsx`, z-31). Measured in the browser at 375×812 and 532×728 on all five stages: the button is the topmost thing at nine points of its own box, and one tap leaves the preview with the four tools back on top. Held by `lib/the-play-button-previews.test.ts` (6), which compares the button's layer with every `data-maker-*-layer` of the shell rather than with a number (sabotage: back to 26 → red).

SPEC IMPACT: None — the approved toolbar, made consistent; no new control, setting, price or schema.
