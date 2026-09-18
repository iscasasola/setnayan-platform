## 2026-09-18 · fix(css): a route-entry animation stops unpinning every fixed overlay

The owner opened the Suppliers page on a phone and found a dimmed screen with a
dialog he could not reach — a sliver of the 3-step coach-mark visible at the
bottom edge, Skip and Next below the fold. It looked like a broken layout.

Measured on production:

```
.sn-page-enter   transform: matrix(1, 0, 0, 1, 0, 0)
backdrop         636 x 2444     (should be 636 x 1107 — the viewport)
card             top 1052 → bottom 1393,  viewport ends at 1107
```

```css
.sn-page-enter { animation: sn-rise-soft 400ms both var(--sn-ease-out); }
```

`fill-mode: both` keeps the animation's properties applied **after it ends**, so
the transform settles on an **identity matrix**. It moves nothing. It is
invisible in a screenshot, in a diff, and in review.

🔑 **And per CSS spec any transform on an ancestor becomes the containing block
for `position: fixed` descendants.** `.sn-page-enter` wraps every in-shell page,
so one word in a shorthand silently unpinned every fixed overlay in the app.

`backwards` holds the from-state before the run (no flash) and returns the
element to its own styles afterwards — visually identical, structurally inert.
The keyframe declares only `from`, so nothing is lost by not holding an end
state.

**28 other rules do the same thing** and are baselined, not fixed: most are leaf
elements — badges, loaders, decorative spans — where a held transform harms
nothing, and "harmless" depends on whether anything inside is `position: fixed`,
which is a fact about the React tree rather than the stylesheet. The list may
only shrink; a NEW entry fails. Same shape as the comment-stripper baseline.

The detector also catches `translate` / `rotate` / `scale`, which create a
containing block identically and are the obvious next spelling.

Sabotage: `both` restored fails **2**; the animation deleted rather than
corrected fails 1; a new rule anywhere in the sheet fails 1; the detector
ceasing to see `both` fails 1.

⚠ This is the third time this overlay class cost time today — it swallowed
clicks earlier and produced a false "posts 200 and persists nothing" finding.

SPEC IMPACT: None.
