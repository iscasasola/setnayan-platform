'use client';

import { useEffect, useState } from 'react';

/**
 * 🎚 THE LAB'S SCRUB BADGE (lab only — never a guest's page; owner 2026-10-09, on a page where Scrub was on: *"as a
 * guest nothing scrubbed"*). The prototype's pill, on the REAL thing: it says whether the hand-overs are on, which
 * one is playing and how far — or WHY they are off — so "off" can be told from "on but not noticeable", on a Mac
 * and on a phone.
 *
 * 🔑 IT HAS NO NUMBERS OF ITS OWN. Everything it says is read off the page: the marks and custom properties the real
 * engine sets (`data-hub-scrub-on`, `--hub-len`, `--hub-pout`, `--hub-pbin`, `--hub-pp`) and the reason the page
 * carries when it is off (`data-hub-scrub-off` — `hub-scrub-engine.ts`, `hub-scrub.tsx`). If the engine does not
 * run, this cannot pretend it does.
 *
 * It also says when a service worker answered the page's scripts: on the dev server those are held under names that
 * do not change, so the first load after an update can run the PREVIOUS script against the new page.
 */
const num = (el: Element | null | undefined, name: string) => Number((el as HTMLElement | null | undefined)?.style.getPropertyValue(name) || 0);
const pct = (n: number) => `${Math.round(n * 100)} %`;
const nameOf = (scene: Element | null | undefined) => scene?.querySelector('[data-lab-name]')?.getAttribute('data-lab-name') ?? 'a scene';

/** What the page says about its own Scrub, in one line. */
export function readScrubBadge(doc: Document, waited: boolean): string {
  const root = doc.querySelector('.hub-scenes');
  if (!root) return 'Scrub: OFF — no scene on this page leaves by Scrub';
  const off = root.getAttribute('data-hub-scrub-off');
  if (off !== null) return `Scrub: OFF — ${off}`;
  if (!root.hasAttribute('data-hub-scrub-on')) return waited ? 'Scrub: OFF — the page’s script has not started' : 'Scrub: starting…';
  /* The hand-overs the engine holds the page for (an empty scene's cell has no length). */
  const cells = [...root.querySelectorAll<HTMLElement>('.hub-cell')].filter((c) => c.style.getPropertyValue('--hub-len') !== '');
  if (cells.length === 0) return 'Scrub: ON — no hand-over on this page';
  const scenes = [...root.querySelectorAll<HTMLElement>('.hub-scene')];
  const leaving = cells.map((c) => c.querySelector<HTMLElement>(':scope > .hub-stage > .hub-scene'));
  const at = leaving.findIndex((s) => num(s, '--hub-pout') < 1);
  if (at < 0) return `Scrub: ON · all ${cells.length} hand-overs done`;
  const scene = leaving[at]!;
  const out = num(scene, '--hub-pout');
  const next = scenes[scenes.indexOf(scene) + 1];
  const head = `Scrub: ON · hand-over ${at + 1} of ${cells.length}`;
  if (out > 0) return `${head} · ${nameOf(scene)} leaves ${pct(out)} · ${nameOf(next)} arrives ${pct(num(next, '--hub-pbin'))}`;
  /* Not yet leaving: is it a list still building its rows? */
  const rows = [...scene.querySelectorAll<HTMLElement>('[data-hub-rows] > *')];
  const built = rows.filter((r) => r.style.getPropertyValue('--hub-pp') !== '' && num(r, '--hub-pp') >= 1).length;
  const some = rows.some((r) => r.style.getPropertyValue('--hub-pp') !== '');
  return some && built < rows.length ? `${head} · ${nameOf(scene)}: row ${built} of ${rows.length}` : `${head} · next to leave: ${nameOf(scene)}`;
}

export function LabScrubBadge() {
  const [line, setLine] = useState('Scrub: starting…');
  const [cached, setCached] = useState(false);
  useEffect(() => {
    const born = Date.now();
    let frame = 0;
    const read = () => {
      frame = 0;
      setLine(readScrubBadge(document, Date.now() - born > 4000));
    };
    /* Read on the frame AFTER the one the scroll is answered in: the engine writes its numbers in that frame too, and
       a badge that read first would say the hand-over as it was one scroll ago (measured: 26 % shown, 32 % on the page). */
    const ask = () => {
      if (!frame) frame = window.requestAnimationFrame(() => (frame = window.requestAnimationFrame(read)));
    };
    window.addEventListener('scroll', ask, { passive: true });
    const watch = new MutationObserver(ask);
    watch.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-hub-scrub-on', 'data-hub-scrub-off', 'data-maker-guest'] });
    const tick = window.setInterval(ask, 1000);
    ask();
    /* Did a service worker answer this page's own scripts? */
    try {
      const mine = (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter((e) => /\/_next\/static\/chunks\//.test(e.name) && /scrub/.test(e.name));
      setCached(Boolean(navigator.serviceWorker?.controller) && mine.some((e) => e.workerStart > 0 && e.transferSize === 0));
    } catch {
      setCached(false);
    }
    return () => {
      window.removeEventListener('scroll', ask);
      watch.disconnect();
      window.clearInterval(tick);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div
      data-lab-scrub-badge=""
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[max(10px,env(safe-area-inset-bottom))] z-[60] flex justify-center px-2 text-left"
    >
      <p className="max-w-full rounded-2xl bg-ink/90 px-3.5 py-2 text-xs font-semibold leading-tight text-cream shadow-lg">
        <span data-lab-scrub-line="">{line}</span>
        {cached ? <span className="block font-normal text-cream/75">A saved copy answered this page’s scripts — after an update, reload twice.</span> : null}
      </p>
    </div>
  );
}
