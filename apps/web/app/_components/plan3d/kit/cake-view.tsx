'use client';

/**
 * 🎂 One cake, two pictures of the same CakeFigureSpec (v5 approved: "like an avatar being designed").
 *
 *   · `CakeView`  — the designer's stage: the live 3D cake is the MAIN view (drag to turn, tap a tier); 2D is only the
 *                   fallback for a phone that cannot run WebGL or loses its context. three.js is fetched lazily
 *                   (`next/dynamic`, ssr off), so no page that does not open the designer carries it.
 *   · `CakeStill` — the design card's picture: the 2D figure at once, replaced by ONE 3D still rendered in the browser
 *                   when the card scrolls into view (the canvas is then let go). Nothing is uploaded or stored.
 */
import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { CakeFigureSpec } from '@/lib/cake-config';
import { CakeFigure } from './cake-figure';
import css from './cake-view.module.css';

const CakeFigure3D = dynamic(() => import('./cake-figure-3d'), {
  ssr: false,
  loading: () => <div className={`skeleton ${css.ghost}`} aria-busy="true" />,
});

function canWebgl(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') ?? c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function CakeView({
  spec,
  monogramText = null,
  title,
  onTierTap,
  fill = false,
}: {
  spec: CakeFigureSpec;
  monogramText?: string | null;
  title?: string;
  onTierTap?: (index: number) => void;
  /** Fill the parent's height instead of keeping 4:3 (the designer's stage sizes itself). */
  fill?: boolean;
}) {
  // 3D unless this browser cannot draw it (decided after mount, so the server and first paint agree on the 2D cake).
  const [mode, setMode] = useState<'2d' | '3d' | null>(null);
  useEffect(() => setMode(canWebgl() ? '3d' : '2d'), []);
  return (
    <div className={css.view} data-cake-view={mode ?? 'starting'}>
      <div className={fill ? `${css.stage} ${css.fill}` : css.stage}>
        {mode === '3d' ? (
          <CakeFigure3D spec={spec} onShow2d={() => setMode('2d')} onTierTap={onTierTap} />
        ) : (
          <CakeFigure spec={spec} monogramText={monogramText} title={title} />
        )}
      </div>
    </div>
  );
}

export function CakeStill({ spec, monogramText = null, title }: { spec: CakeFigureSpec; monogramText?: string | null; title?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [render, setRender] = useState(false);
  const [still, setStill] = useState<string | null>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || !canWebgl()) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setRender(true);
        io.disconnect();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={box} className={css.stage} data-cake-still={still ? '3d' : '2d'}>
      {still ? (
        // eslint-disable-next-line @next/next/no-img-element -- a data: image drawn here, not a remote asset
        <img src={still} alt={title ?? ''} className={css.img} />
      ) : (
        <CakeFigure spec={spec} monogramText={monogramText} title={title} />
      )}
      {render && !still ? (
        <div className={css.offstage} aria-hidden>
          <CakeFigure3D spec={spec} still onShow2d={() => setRender(false)} onStill={(url) => { setStill(url); setRender(false); }} />
        </div>
      ) : null}
    </div>
  );
}
