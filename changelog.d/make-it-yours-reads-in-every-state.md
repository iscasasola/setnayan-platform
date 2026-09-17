## 2026-09-17 · fix(story): a selected word keeps the colour the host chose

Selecting a word in "Make it yours" laid the action colour at 10% behind it. On the
page the four word colours read ink 14.28:1 · terracotta 4.76:1 · blue 8.50:1 ·
gold 4.95:1; under that wash they read 12.46 · **4.15** · 7.41 · **4.32**. Terracotta
and gold fell below the 4.5:1 AA bar for normal text, so picking a word was what made
it hard to read. The same wash did the same thing to `.mini` on hover (4.76 → 4.15).

- selected text now matches selected PHOTOS — the 2px outline, no background, which is
  what `.obj.ph.sel` has always done;
- `.mini` keeps its hover tint (a button needs the affordance, and has no outline doing
  that work) and deepens its label to `--color-mulberry-700`, 5.79:1 on the tint.

Lightening the wash was measured and refused: terracotta is still under at 5% (4.45) and
only clears at 4% by 0.02, where the tint is two levels off white. Darkening the gold was
refused too — the palette's deepest gold reaches 4.38 on the wash.

Held by `apps/web/app/dashboard/[eventId]/story/selected-words-keep-their-contrast.test.ts`,
which resolves the colours out of the stylesheets and re-does the arithmetic rather than
asserting one line is absent — so a wash reintroduced at any opacity or spelling fails there.

SPEC IMPACT: None. No decision changes; this restores the 4.5:1 the palette already promises.
