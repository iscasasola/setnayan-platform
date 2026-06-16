'use client';

/**
 * RigidFlaps — the WebGL-or-CSS switch for the rigid reveal flaps (PR3a).
 *
 * Renders the real three.js 3D scene (RigidWebGL, lazy-loaded so three.js stays
 * code-split) and falls back to the existing CSS-3D flaps when WebGL can't
 * initialise — so the reveal is never gated. The fallback also fires on
 * `?reveal3d=off` (or `=0`), an A/B escape hatch so the look can be compared
 * against the known-good CSS version on a preview without a deploy.
 *
 * `cssFallback` is the caller's existing progress-driven CSS flap JSX, so the
 * fallback is byte-identical to today's reveal.
 */

import dynamic from 'next/dynamic';
import { useEffect, useState, type ReactNode } from 'react';
import type { RigidWebGLVariant } from './rigid-webgl';

const RigidWebGL = dynamic(() => import('./rigid-webgl'), { ssr: false });

type Props = {
  variant: RigidWebGLVariant;
  progress: number;
  /** Couple's lettered monogram — carved into the cathedral doors (church-doors). */
  monogramText?: string;
  cssFallback: ReactNode;
};

export function RigidFlaps({ variant, progress, monogramText, cssFallback }: Props) {
  const [webglOk, setWebglOk] = useState(true);
  const [forceCss, setForceCss] = useState(false);

  useEffect(() => {
    try {
      const v = new URLSearchParams(window.location.search).get('reveal3d');
      if (v === 'off' || v === '0') setForceCss(true);
    } catch {
      /* noop */
    }
  }, []);

  if (forceCss || !webglOk) return <>{cssFallback}</>;
  return <RigidWebGL variant={variant} progress={progress} monogramText={monogramText} onUnsupported={() => setWebglOk(false)} />;
}
