'use client';

/**
 * MoltenMonogramInline — the client boundary that lazy-loads the WebGL molten
 * monogram animation (the 'molten' motion key) for HeroMonogram.
 *
 * HeroMonogram is server-usable (no 'use client'), so it cannot itself call
 * next/dynamic(ssr:false). This thin client wrapper owns that import so three.js
 * stays code-split out of the main bundle (only fetched when a 'molten' mark
 * actually mounts), exactly as the reveal overlay did before molten moved here.
 *
 * Inline + loop = ambient monogram animation (transparent, in-flow, never fires
 * onDone). HeroMonogram only renders this on a surface that passes allowWebgl
 * (one live WebGL context at a time); everywhere else molten degrades to the CSS
 * Gold Turn.
 */

import dynamic from 'next/dynamic';

const Molten = dynamic(() => import('./molten-monogram-reveal'), { ssr: false });

export function MoltenMonogramInline({
  markSvg,
  monogram,
  lowRes = false,
}: {
  markSvg: string | null;
  monogram: string;
  lowRes?: boolean;
}) {
  return <Molten markSvg={markSvg} monogram={monogram} inline loop lowRes={lowRes} />;
}
