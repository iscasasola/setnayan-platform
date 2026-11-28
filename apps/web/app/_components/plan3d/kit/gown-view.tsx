'use client';

/**
 * 👗 The gown maker's stage (copies `cake-view.tsx`): the live 3D mannequin is the main view; three.js and the body are
 * fetched lazily (`next/dynamic`, ssr off), so no page that does not open the gown maker carries them.
 *
 * A phone that cannot run WebGL (or loses it) gets the house error report (what broke, what survived, what to do) and
 * keeps every number she typed; the design's
 * 2D picture arrives with the design card (`GownStill`, step A10).
 */
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ErrorState } from '@/app/_components/states/error-state';
import { GOWN_SCENES, type GownSceneId } from '@/lib/gown/scenes';
import { gownStillColour, gownStillLayers } from '@/lib/gown/still';
import type { GownConfig } from '@/lib/gown-config';
import type { GownFigureProps } from './gown-figure-3d';
import css from './gown-view.module.css';

const GownFigure3D = dynamic(() => import('./gown-figure-3d'), {
  ssr: false,
  loading: () => <div className={`skeleton ${css.ghost}`} aria-busy="true" />,
});

export function canWebgl(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

export type GownViewProps = Omit<GownFigureProps, 'onShow2d'> & {
  /** Fill the parent's height (the designer's stage sizes itself) instead of a tall 3:4 box. */
  fill?: boolean;
  /** Start without 3D (the lab's fallback view). */
  force2d?: boolean;
};

export function GownView({ fill = false, force2d = false, ...figure }: GownViewProps) {
  // 3D unless this browser cannot draw it (decided after mount, so the server and first paint agree).
  const [mode, setMode] = useState<'2d' | '3d' | null>(null);
  useEffect(() => setMode(!force2d && canWebgl() ? '3d' : '2d'), [force2d]);
  const scene: GownSceneId = figure.scene ?? 'studio';
  return (
    <div className={css.view} data-gown-view={mode ?? 'starting'}>
      <div
        className={fill ? `${css.stage} ${css.fill}` : css.stage}
        data-tone={GOWN_SCENES[scene].dark ? 'dark' : 'light'}
        style={{ ['--gown-scene-bg' as string]: GOWN_SCENES[scene].bg }}
      >
        {mode === '3d' ? (
          <GownFigure3D {...figure} onShow2d={() => setMode('2d')} />
        ) : mode === '2d' ? (
          <ErrorState
            title="3D can't open on this device"
            broke="This browser can't draw the 3D mannequin."
            survived="Every number you set is kept, and goes to the designer with your design."
            todo="Carry on with your measurements and choices; the designer sees them all."
          />
        ) : (
          <div className={`skeleton ${css.ghost}`} aria-busy="true" />
        )}
      </div>
    </div>
  );
}

/**
 * A10: the design's picture (the design card, the send screen). The 2D drawing first, in the gown's own colour; once on
 * screen, on a device that draws 3D, one still frame of the stage takes its place. `alt` names the design in words.
 */
export function GownStill({ design, alt, ...figure }: Omit<GownViewProps, 'design' | 'fill' | 'force2d'> & { design: GownConfig; alt: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [three, setThree] = useState(false);
  // The 3D canvas is see-through, so the drawing steps aside once the frame has her in it (and comes back if 3D gives up).
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el || !canWebgl() || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setThree(true); io.disconnect(); } }, { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const colour = gownStillColour(design);
  return (
    <div ref={box} className={css.still} data-gown-still={three && drawn ? '3d' : '2d'} role="img" aria-label={alt}>
      {three && drawn ? null : (
        <svg viewBox="0 0 40 56" className={css.stillSvg} aria-hidden="true">
          {gownStillLayers(design).map((l, i) => (
            <path key={i} d={l.d} fill={colour} fillOpacity={l.sheer ? 0.45 : 1} stroke="currentColor" strokeOpacity={0.35} strokeWidth={0.6} />
          ))}
        </svg>
      )}
      {three ? (
        <div className={css.stillStage}>
          <GownFigure3D {...figure} design={design} still onShow2d={() => { setThree(false); setDrawn(false); }}
            onSolved={(sv) => { setDrawn(true); figure.onSolved?.(sv); }} />
        </div>
      ) : null}
    </div>
  );
}
