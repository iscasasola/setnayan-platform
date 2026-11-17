/**
 * rise-layer.ts — ⚡ A RISE ON ITS OWN LAYER, FOR AS LONG AS IT MOVES, and not one frame longer (owner 2026-11-17
 * *"since it shows, it feels like it is lagging"*).
 *
 * Both full-screen rises (`app/_components/rise/rise-screen.tsx`, `app/_components/picked/picked-shell.tsx`) grow out of
 * the tapped thing with a `clip-path`. Unpromoted, a `clip-path` change repaints the whole screen and everything on it on
 * every frame — ~42 repaints in the 0.7 s rise, each as heavy as the screen. On its own compositor layer the screen is
 * painted once and only the clip is redrawn per frame. The look is untouched: same frames, same timing, same easing.
 *
 * ⚠ `will-change: transform` makes the element the containing block of its `position: fixed` children
 * (`lib/lingering-transform.ts`). Harmless here — both screens ARE `fixed inset-0`, the viewport's own box — and it comes
 * off the moment the motion finishes or is cancelled, so it never lingers.
 * 🔒 lib/a-sheet-mounts-once-on-a-tap.test.ts
 */
export const RISE_LAYER_WILL_CHANGE = 'transform, clip-path, opacity';

export function onItsOwnLayer(el: HTMLElement, a: Animation): Animation {
  el.style.willChange = RISE_LAYER_WILL_CHANGE;
  const off = () => {
    // Only ours: a newer motion that re-armed it keeps it until its own end.
    if (el.getAnimations?.().some((x) => x !== a && x.playState === 'running')) return;
    el.style.willChange = '';
  };
  a.finished.then(off, off);
  return a;
}
