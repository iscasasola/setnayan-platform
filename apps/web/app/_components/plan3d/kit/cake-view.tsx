'use client';

/**
 * 🎂 One cake, two views — the 2D picture by default and a "3D" switch that loads the turntable lazily
 * (`next/dynamic`, ssr off: three.js is fetched only when somebody presses 3D). Both draw the same CakeFigureSpec.
 */
import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { CakeFigureSpec } from '@/lib/cake-config';
import { CakeFigure } from './cake-figure';
import css from './cake-view.module.css';

const CakeFigure3D = dynamic(() => import('./cake-figure-3d'), {
  ssr: false,
  loading: () => <div className={css.ghost} aria-busy="true" />,
});

export function CakeView({ spec, monogramText = null, title }: { spec: CakeFigureSpec; monogramText?: string | null; title?: string }) {
  const [view, setView] = useState<'2d' | '3d'>('2d');
  return (
    <div className={css.view}>
      <div className={css.stage}>
        {view === '3d' ? <CakeFigure3D spec={spec} onShow2d={() => setView('2d')} /> : <CakeFigure spec={spec} monogramText={monogramText} title={title} />}
      </div>
      <div className={css.switch} role="radiogroup" aria-label="View">
        {(['2d', '3d'] as const).map((v) => (
          <button key={v} type="button" role="radio" aria-checked={view === v} className={css.opt} onClick={() => setView(v)}>
            {v.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
}
