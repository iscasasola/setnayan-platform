'use client';

import { useEffect, useState } from 'react';
import { formatCount } from '@/lib/format-number';

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
  /* The hand-overs the engine holds the page for: a scene LEAVES when it is the one right before its cell's
     rest-of-the-page (`hub-scenes.tsx` `flow` — the stage may hold ordinary scenes before it) and it drew something
     (a scene with no box holds nothing). Not "its cell has a length": on a page with its own hold the length is the
     page pair's, not the cell's. */
  const leaving = [...root.querySelectorAll<HTMLElement>('.hub-after')]
    .map((a) => a.previousElementSibling as HTMLElement | null)
    .filter((sc) => (sc?.offsetHeight ?? 0) > 0);
  /* 🎬 HAND-OVER ZERO: a cover that hands over (`hub-scenes.tsx` `HubCoverHold`) is the page's FIRST hand-over — it is
     counted and named, or the badge would say "next to leave: Countdown" while the cover is what is leaving. What
     arrives after it is whatever comes next on the page (the engine marks it), a scene or not. */
  const cover = doc.querySelector<HTMLElement>('.hub-cover[data-hub-fx]');
  const zero = cover && cover.offsetHeight > 0 ? cover : null;
  if (leaving.length === 0 && !zero) return 'Scrub: ON — no hand-over on this page';
  const cells = zero ? [zero, ...leaving] : leaving;
  const scenes = [...root.querySelectorAll<HTMLElement>('.hub-scene')];
  const at = cells.findIndex((s) => num(s, '--hub-pout') < 1);
  if (at < 0) return `Scrub: ON · all ${formatCount(cells.length)} hand-overs done`;
  const scene = cells[at]!;
  const out = num(scene, '--hub-pout');
  const head = `Scrub: ON · hand-over ${formatCount(at + 1)} of ${formatCount(cells.length)}`;
  if (scene === zero) {
    const arrives = doc.querySelector<HTMLElement>('[data-hub-zero]');
    const what = arrives?.querySelector('[data-lab-name]')?.getAttribute('data-lab-name') ?? 'What comes next';
    return out > 0 ? `${head} · The cover leaves ${pct(out)} · ${what} arrives ${pct(num(arrives, '--hub-pbin'))}` : `${head} · next to leave: The cover`;
  }
  const next = scenes[scenes.indexOf(scene) + 1];
  if (out > 0) return `${head} · ${nameOf(scene)} leaves ${pct(out)} · ${nameOf(next)} arrives ${pct(num(next, '--hub-pbin'))}`;
  /* Not yet leaving: is it a list still building its rows? */
  const rows = [...scene.querySelectorAll<HTMLElement>('[data-hub-rows] > *')];
  const built = rows.filter((r) => r.style.getPropertyValue('--hub-pp') !== '' && num(r, '--hub-pp') >= 1).length;
  const some = rows.some((r) => r.style.getPropertyValue('--hub-pp') !== '');
  return some && built < rows.length ? `${head} · ${nameOf(scene)}: row ${formatCount(built)} of ${formatCount(rows.length)}` : `${head} · next to leave: ${nameOf(scene)}`;
}

/** The chain's own saved canvases (`../lab-scrub.ts` `labWidgetsCookie(true)`) — what "Reset the sample" clears. */
const SAVED = 'lab_widgets_scrub';

export function LabScrubBadge() {
  const [line, setLine] = useState('Scrub: starting…');
  const [cached, setCached] = useState(false);
  const [saved, setSaved] = useState(false);
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
    const watch = new MutationObserver(read);
    watch.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-hub-scrub-on', 'data-hub-scrub-off', 'data-maker-guest'] });
    /* …and on a clock, WITHOUT a frame: a pane that scrolls but gives the page no animation frames left this pill
       on "starting…" eight seconds in (seen 2026-10-09). The pill must never be the thing that is stale. */
    const tick = window.setInterval(read, 300);
    read();
    /* The chain's saved edits (a scene restyled here in the Maker) — on the page as a guest sees it only: inside the
       Maker's canvas the Maker holds them too, and clearing them under it would leave the two disagreeing. */
    setSaved(document.querySelector('[data-maker-section]') === null && document.cookie.split('; ').some((c) => c.startsWith(`${SAVED}=`)));
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
      /* Bottom LEFT, and never under the right 76 px: the dev server's own round button sits there and covered the end
         of the line at 441 px (seen 2026-10-09). The words wrap; nothing is cut. */
      className="pointer-events-none fixed bottom-[max(10px,env(safe-area-inset-bottom))] left-2 right-[76px] z-[60] flex justify-start text-left"
    >
      <p className="max-w-full rounded-2xl bg-ink/90 px-3.5 py-2 text-xs font-semibold leading-snug text-cream shadow-lg">
        <span data-lab-scrub-line="">{line}</span>
        {cached ? <span className="block font-normal text-cream/75">A saved copy answered this page’s scripts — after an update, reload twice.</span> : null}
        {saved ? (
          <span className="block font-normal text-cream/75">
            Your saved edits to these scenes are showing.{' '}
            <button
              type="button"
              data-lab-scrub-reset=""
              className="pointer-events-auto min-h-11 font-semibold text-cream underline underline-offset-2"
              onClick={() => {
                document.cookie = `${SAVED}=; path=/; max-age=0; SameSite=Lax`;
                window.location.reload();
              }}
            >
              Reset the sample
            </button>
          </span>
        ) : null}
      </p>
    </div>
  );
}
