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

---

### Follow-ups in the same PR

**The tour card is centred on every screen size** (owner, 2026-09-18). It was
`items-end … sm:items-center` — a bottom sheet on phones, which is the standard
thumb-reach placement, and exactly where the transform bug hid it: with the
backdrop sized to the DOCUMENT, "the bottom" was ~1300px below the fold and the
card surfaced behind the bottom nav. The sizing fix alone would have restored a
working bottom sheet; the owner asked for centre regardless.

**A z-index bump was considered and rejected — it would have done nothing.** The
dialog is `z-50` and the nav `z-30`, so the dialog should win. It does not,
because the dialog sits INSIDE `.sn-page-enter`, whose transform creates a
**stacking context**, and that wrapper is `z-index: auto`. The dialog's 50 is
scoped inside it and cannot outrank a nav that lives outside. **One word caused
both symptoms** — containing block (wrong size, wrong position) and stacking
context (painted under the nav) — and removing it fixes both. A z-index change
would have looked like a fix and moved nothing.

**Only 1 of the other 28 rules was the same change.** Classifying by whether the
keyframes declare an end state: **1 from-only** (`.sn-lens-swap > *`, switched to
`backwards`, baseline now 27) and **27 that declare a `to`** — for which
`backwards` would SNAP THE ELEMENT BACK. `.sn-veil` is the plain example: its
keyframe ends `translateY(-103%); opacity: 0`, so `backwards` would restore a
dark veil permanently over the Alaala tile. Those need their end state moved
into the base rule and re-checked by eye, one at a time — 27 visual regressions
waiting to happen for a problem none of them currently causes. They stay
baselined, and the guard names any that later matters.
