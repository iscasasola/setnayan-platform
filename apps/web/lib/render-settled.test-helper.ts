/**
 * render-settled.test-helper.ts — render a tree whose `next/dynamic` pieces
 * have ARRIVED, for tests that read the HTML with `renderToStaticMarkup`.
 *
 * ── 🔴 WHY THIS REPLACED A CLOCK ───────────────────────────────────────────
 * The Maker's Details pieces load lazily (`launch/_components/details-lazy.tsx`,
 * 2026-09-29): the first render draws each piece's loading slot
 * (`data-lazy-slot`) and asks for its code. Five tests waited for that code with
 * the same loop — re-render every 10ms, give up after 50 tries — and a loop that
 * gives up after 500ms is a guess about how fast the machine is. On a loaded CI
 * runner the guess lost: PR #6159's run 36585597410 failed
 * `details-guided-flow.test.ts` "(6) a step is its item…" with *no step
 * heading* while the HTML still held the slot — a test that never touched the
 * change it was failing, and passed 4/4 locally.
 *
 * 🔑 WAIT ON THE LOAD, NOT ON THE CLOCK. Under Node, `next/dynamic` is
 * react-loadable (`next/dist/shared/lib/loadable.shared-runtime`). Each dynamic
 * component is `forwardRef(LoadableComponent)`, and `LoadableComponent.preload()`
 * returns THE promise its render waits on — the same subscription, not a second
 * load. Its own `.then` updates the component's state before any handler we
 * attach runs, so one render after the promise settles is complete.
 *
 * ⚠ WHY EACH PIECE IS PRELOADED ON ITS OWN, NOT WITH `Loadable.preloadAll()`.
 * That starts EVERY registered loader and rejects on the first failure — and a
 * piece these tests never draw (`maker-logo.tsx`, which reaches `server-only`)
 * cannot load under Node at all. Tried first, measured: it failed four tests
 * that render nothing of the Logo. `Promise.allSettled` over the pieces lets an
 * undrawn piece fail harmlessly.
 *
 * 🪤 THE OLD LOOP DID NOT EVEN WAIT FOR EVERY PIECE. It re-rendered only while
 * the HTML held `data-lazy-slot=` — and `SlotNone` (`lazy-slot.tsx`) draws
 * NOTHING while it loads. `GuideHead` is a SlotNone piece: the loop waited on
 * the step's foot, and the heading arrived or not by luck. Here every piece is
 * awaited, whatever its slot draws.
 *
 * ⚠ AND A REAL FAILURE STILL SURFACES. A drawn piece that could not load and
 * shows a visible slot is thrown here, with the reasons of any load that failed.
 * A SlotNone piece that failed draws nothing, so the caller's own assertion
 * catches the gap — probed 2026-09-29: a `GuideHead` whose load throws fails
 * "(6)" with "no step heading", never a pass.
 */
import type React from 'react';
import * as detailsLazy from '../app/dashboard/[eventId]/launch/_components/details-lazy';

type Preloadable = { render?: { preload?: () => Promise<unknown> } };

/** Every `next/dynamic` component exported by these modules. */
function dynamicPieces(modules: readonly object[]): Preloadable[] {
  const pieces: Preloadable[] = [];
  for (const mod of modules) {
    for (const value of Object.values(mod)) {
      const piece = value as Preloadable;
      if (piece && typeof piece.render?.preload === 'function') pieces.push(piece);
    }
  }
  return pieces;
}

/**
 * Render `el` once every lazy piece it may draw has settled.
 * `lazyModules` — the stand-in modules whose pieces the tree draws; the Details
 * pieces (`details-lazy.tsx`) are always included.
 */
export async function renderSettled(
  el: React.ReactElement,
  lazyModules: readonly object[] = [],
): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const pieces = dynamicPieces([detailsLazy, ...lazyModules]);
  if (pieces.length === 0) {
    throw new Error('renderSettled: found no next/dynamic pieces to wait for — has the lazy module changed shape?');
  }
  const settled = await Promise.allSettled(pieces.map((p) => p.render!.preload!()));
  const html = renderToStaticMarkup(el);
  if (/data-lazy-slot=/.test(html)) {
    const reasons = settled
      .filter((s): s is PromiseRejectedResult => s.status === 'rejected')
      .map((s) => String((s.reason as Error)?.message ?? s.reason).split('\n')[0]);
    throw new Error(
      'renderSettled: the tree still draws a loading slot after every lazy piece settled. ' +
        'Either the piece is not in details-lazy.tsx (pass its module in `lazyModules`) or its code failed to load' +
        (reasons.length ? ` — failed loads: ${[...new Set(reasons)].join(' · ')}` : '.'),
    );
  }
  return html;
}
