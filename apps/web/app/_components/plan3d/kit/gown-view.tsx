'use client';

/**
 * 👗 The gown maker's stage (copies `cake-view.tsx`): the live 3D mannequin is the main view; three.js and the body are
 * fetched lazily (`next/dynamic`, ssr off), so no page that does not open the gown maker carries them.
 *
 * A phone that cannot run WebGL (or loses it) gets an honest line and keeps every number she typed; the design's
 * 2D picture arrives with the design card (`GownStill`, step A10).
 */
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Shirt } from 'lucide-react';
import { EmptyState } from '@/app/_components/states/empty-state';
import { GOWN_SCENES, type GownSceneId } from '@/lib/gown/scenes';
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
          <EmptyState Icon={Shirt} title="3D isn't available on this device" blurb="Your measurements are kept. The designer still gets every number you set." />
        ) : (
          <div className={`skeleton ${css.ghost}`} aria-busy="true" />
        )}
      </div>
    </div>
  );
}
