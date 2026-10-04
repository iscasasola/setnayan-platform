'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createCanvasTyping, typeablePart } from '@/app/[slug]/_components/type-in-place-canvas';
import { createCanvasBringUp } from '@/app/[slug]/_components/canvas-bring-up';

/**
 * /dev/hero-lab?maker=1&type=1 — ✍ TAP-TO-TYPE ON THE REAL MASTHEAD, measured.
 *
 * The canvas half of Maker core part 2 (`type-in-place-canvas.ts`) on the
 * lab's real `PahinaMasthead`, with no Maker, no sign-in and no database: a tap
 * on a part puts the caret in it, and every message the canvas would send the
 * Maker is listed with how long the page took — the tap → the caret, a
 * keystroke → the letter painted, and a pick → the words replaced (the Maker's
 * own `typeText`, sent from the two buttons). DEV-ONLY, like its page; drawn
 * after mount from the page's own chunk (never an async chunk of its own).
 */
export function TypeLab({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [log, setLog] = useState<string[]>([]);
  const typingRef = useRef<ReturnType<typeof createCanvasTyping> | null>(null);
  useEffect(() => {
    const add = (line: string) => setLog((l) => [line, ...l].slice(0, 12));
    // 📱 The same bring-up (and way back) the Maker's canvas uses on a phone.
    const lift = createCanvasBringUp(window);
    const typing = createCanvasTyping(
      window,
      (m) => {
        add(`${String(m.phase)} · ${String(m.el)} · “${String(m.text ?? '').slice(0, 44)}”${m.caret === false ? ' · Format ▾ only' : ''}`);
        // No Maker here to say `settle`: the lab's edit is over when the typing is.
        if (m.phase === 'end') lift.down();
      },
      lift,
    );
    typingRef.current = typing;
    const el = root.current!;
    const onClick = (e: MouseEvent) => {
      if (typing.inside(e.target)) return;
      const part = (e.target as Element).closest?.('[data-el]') as HTMLElement | null;
      const typeEl = typeablePart(part, 'f:hero');
      if (!part || !typeEl) {
        typing.stop();
        return;
      }
      e.preventDefault();
      const t0 = performance.now();
      typing.begin(part, 'f:hero', typeEl, { x: e.clientX, y: e.clientY });
      const focused = document.activeElement?.hasAttribute('contenteditable') ? 'caret in the words' : 'no caret';
      add(`tap → ${focused} in ${(performance.now() - t0).toFixed(1)} ms`);
    };
    const onKey = () => {
      const t0 = performance.now();
      requestAnimationFrame(() => add(`keystroke → painted in ${(performance.now() - t0).toFixed(1)} ms`));
    };
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKey, true);
    return () => {
      el.removeEventListener('click', onClick);
      el.removeEventListener('keydown', onKey, true);
      typing.dispose();
      lift.dispose();
    };
  }, []);
  const pick = (el: string, text: string) => {
    const t0 = performance.now();
    typingRef.current?.set(root.current?.querySelector<HTMLElement>('[data-lab-design]') ?? null, el, text);
    requestAnimationFrame(() => setLog((l) => [`pick (${el}) → on the page in ${(performance.now() - t0).toFixed(1)} ms`, ...l].slice(0, 12)));
  };
  return (
    <div ref={root}>
      <div data-type-lab-log="" className="sticky top-9 z-10 border-b border-ink/10 bg-white/95 px-4 py-2 font-mono text-[11px] text-ink/80">
        <div className="mb-1 flex flex-wrap gap-2">
          <button type="button" className="rounded border px-2" onClick={() => pick('eyebrow', 'You are invited')}>
            Wording pick (eyebrow)
          </button>
          <button type="button" className="rounded border px-2" onClick={() => pick('date', 'Ika-18 ng Disyembre, 2026')}>
            Format pick (date)
          </button>
        </div>
        {log.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
      {children}
    </div>
  );
}
