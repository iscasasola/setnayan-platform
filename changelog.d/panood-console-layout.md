## 2026-07-21 · fix(live-studio): console layout follows the device, not the window

The control room switched on a `lg:` (1024px **viewport**) breakpoint, which conflated "narrow
window" with "small device". For an ordinary page that's fine. For this console it broke the exact
workflow the feature was designed around:

> The operator runs OBS beside the control room. Snap two windows side by side on a 1440px laptop
> and each gets ~720px — under the breakpoint — so the director board collapses into the phone
> layout at precisely the moment they're setting up to broadcast.

### What changes

- **`lib/panood-console-layout.ts`** — a pure resolver keyed off `screen.width` + `(pointer: fine)`,
  neither of which moves when a window does. A laptop stays a laptop at any window width; a phone
  still gets the phone UI; a wide touch screen gets compact, because a director board needs a cursor.
- **Operator override** — a Board / Compact switch, persisted in `localStorage`. Global, not
  per-event: it's a statement about their hardware, which doesn't change between weddings.
- **Frozen on air** — once `is_live`, automatic re-detection stops. A layout reflow during the
  processional is the kind of thing that makes an operator miss a cut. An explicit manual switch
  still works: the freeze exists to stop the *browser* surprising them, not them.

### Detail

`layout === null` until mount, so the server render and first paint keep the original CSS
breakpoints — no hydration mismatch, and on any machine where window ≈ screen the visible result
is identical. The listener is on the `(pointer: fine)` media query (external monitor plugged in,
tablet gains a trackpad) and deliberately **not** on resize.

**Camera capability is unaffected** — caps come from `panoodCameraCapForTier` server-side, so a
narrow window never costs an operator a camera. Only the layout moves.

11 new unit tests (115 total, all pass), covering the narrow-window regression, pointer-type
override, threshold inclusivity, override-beats-freeze, and localStorage junk not wedging a layout.
Typecheck + production build clean.

SPEC IMPACT: None — behavioural fix to the shipped console.
