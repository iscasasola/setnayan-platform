'use client';

/**
 * /dev/figure-lab — THROWAWAY character-design prototype (2026-07-08).
 * Thin ssr:false mount of the client scene, the same pattern as
 * plan3d-scene-loader (three must never render on the server).
 */

import dynamic from 'next/dynamic';

const FigureLabClient = dynamic(() => import('./figure-lab-client'), { ssr: false });

export default function FigureLabPage() {
  return <FigureLabClient />;
}
