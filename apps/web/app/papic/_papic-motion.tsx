'use client';

/**
 * /papic's ONE bold moment — and, after design#6, the ONLY thing left in this
 * file.
 *
 * ─── WHAT USED TO BE HERE ────────────────────────────────────────────────
 * This island also carried `LineRevealHeading`, `RevealBand`, `RevealList` and
 * `HowItWorksPanel`: a private, byte-identical copy of the shared primitives in
 * `_pa-motion.tsx`. That fork is what the doorway kit's docblock means by
 * "`/papic` carried a private fork of the motion primitives on top of that".
 * `/papic` now mounts `DoorwayPage` like the other six, so the copies are
 * deleted rather than kept in step by hand, and the page imports `RevealBand`
 * from the shared module.
 *
 * ─── THE SIGNATURE THAT SURVIVED, AND WHY IT LIVES HERE ──────────────────
 * On step 02 of "How it works" — "Every photo finds its people" — a cluster of
 * abstract photo tiles begins loosely scattered and SETTLES each tile into its
 * own tidy grid slot as the step scrolls in. "Your photos find you", made
 * literal in one ~1s move. It reaches the archetype through the step's own
 * `figure` field, so it is CONTENT belonging to one step rather than a layout
 * exception carved into the shared spine.
 *
 * Two-IO discipline: the "How it works" SECTION carries one champagne
 * PanelThread (inside the kit's `HowItWorksPanel`). This settle is scoped to its
 * OWN ref, separate from that panel root, so the two IntersectionObserver
 * entrances don't double-fire on the same element.
 *
 * a11y / SSR contract: the tiles are `aria-hidden` decoration and carry no copy.
 * Under `prefers-reduced-motion` the foundation hook rests them already-settled
 * (no offset). No new colour — `--m-ivory` / `--m-paper-2`, both locked tokens.
 */

import { useSettle } from '@/app/_components/marketing/_premium';

/**
 * SettleTiles — THE signature. A presentational cluster of six abstract photo
 * tiles (token-coloured rounded rects, NO real images, NO faces) that begin
 * loosely scattered/overlapped and settle into a neat 3×2 grid via useSettle as
 * step 02 scrolls into view.
 *
 * Each tile is a `[data-settle-item]` whose START offset (data-settle-x/y/rotate)
 * is its scattered position relative to its OWN tidy grid slot; useSettle animates
 * x/y/rotation → 0, landing it in the natural CSS grid cell. No layout math: the
 * grid is the resting layout, the offsets are the only thing the hook moves.
 *
 * This component owns its OWN useSettle ref (scoped to this cluster), separate
 * from the HowItWorksPanel's usePanelIntro root — so the two IO entrances don't
 * double-fire. threshold 0.4 so the settle reads as deliberate once the step is
 * comfortably on screen. reduced-motion = tiles rest already-settled.
 */
const TILES: ReadonlyArray<{
  x: number;
  y: number;
  rotate: number;
  tone: 'ivory' | 'paper-2';
}> = [
  { x: -54, y: -30, rotate: -9, tone: 'ivory' },
  { x: 48, y: -42, rotate: 7, tone: 'paper-2' },
  { x: -38, y: 26, rotate: 11, tone: 'paper-2' },
  { x: 60, y: 18, rotate: -6, tone: 'ivory' },
  { x: -16, y: 48, rotate: 5, tone: 'ivory' },
  { x: 30, y: -14, rotate: -12, tone: 'paper-2' },
];

export function SettleTiles() {
  const ref = useSettle({ duration: 1, threshold: 0.4, stagger: 0.06 });
  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      aria-hidden
      className="mt-5 grid grid-cols-3 gap-2.5"
    >
      {TILES.map((tile, i) => (
        <span
          key={i}
          data-settle-item
          data-settle-x={tile.x}
          data-settle-y={tile.y}
          data-settle-rotate={tile.rotate}
          data-settle-opacity={0.85}
          className="block aspect-[4/5] rounded-lg border border-[var(--m-ink)]/[0.06] shadow-sm"
          style={{
            background:
              tile.tone === 'ivory' ? 'var(--m-ivory)' : 'var(--m-paper-2)',
          }}
        />
      ))}
    </div>
  );
}
