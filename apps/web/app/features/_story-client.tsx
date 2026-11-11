'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import s from './features-story.module.css';

/**
 * The /features story's ONE client island (v3, owner-approved 11 Nov). Everything a visitor reads is server-rendered;
 * this file only:
 *   · keeps the "I am" choice, in the URL hash (#guests · #suppliers · #coordinators; Hosts is the bare page);
 *   · starts each live moment when it scrolls into view (and its counter), and leaves every moment finished, still,
 *     under "reduce motion";
 *   · (a row's ⓘ is the house <Explain>, in `_sections/_Story.tsx` — one look and one popup for every ⓘ in the app.)
 * It imports no feature data: the rows stay in the HTML, never in the JavaScript (the 202.3 KB budget).
 */

export type PersonaChoice = 'hosts' | 'guests' | 'suppliers' | 'coordinators';
const CHOICES: readonly PersonaChoice[] = ['hosts', 'guests', 'suppliers', 'coordinators'];
const isChoice = (v: string): v is PersonaChoice => (CHOICES as readonly string[]).includes(v);

const Ctx = createContext<{ persona: PersonaChoice; choose: (p: PersonaChoice) => void }>({
  persona: 'hosts',
  choose: () => {},
});

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Count a moment's number up from 0 (or show it at once when motion is reduced). The server drew the final figure. */
function countUp(el: HTMLElement) {
  const to = Number(el.dataset.countTo);
  if (!Number.isFinite(to) || el.dataset.counted) return;
  el.dataset.counted = '1';
  if (reducedMotion()) return;
  const t0 = performance.now();
  const d = 1800;
  const step = (t: number) => {
    const p = Math.min(1, (t - t0) / d);
    el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))).toLocaleString('en-PH');
    if (p < 1) requestAnimationFrame(step);
  };
  el.textContent = '0';
  requestAnimationFrame(step);
}

export function PersonaScope({ children }: { children: ReactNode }) {
  const [persona, setPersona] = useState<PersonaChoice>('hosts');
  const root = useRef<HTMLDivElement>(null);

  // The hash is the choice: read it once, and follow it when a link changes it.
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.slice(1);
      if (isChoice(h)) setPersona(h);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  const choose = useCallback((p: PersonaChoice) => {
    setPersona(p);
    const url = `${window.location.pathname}${window.location.search}${p === 'hosts' ? '' : `#${p}`}`;
    window.history.replaceState(window.history.state, '', url);
    requestAnimationFrame(() => {
      const first = root.current?.querySelector<HTMLElement>(`[data-story="${p}"] [data-chapter]`);
      first?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    });
  }, []);

  // Moments start when they scroll into view — only the chosen persona's.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const on = (m: HTMLElement) => {
      m.setAttribute('data-on', '');
      m.querySelectorAll<HTMLElement>('[data-count-to]').forEach(countUp);
    };
    const moments = Array.from(el.querySelectorAll<HTMLElement>(`[data-story="${persona}"] [data-mo]:not([data-on])`));
    if (!('IntersectionObserver' in window)) {
      moments.forEach(on);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          on(e.target as HTMLElement);
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px' },
    );
    moments.forEach((m) => io.observe(m));
    return () => io.disconnect();
  }, [persona]);

  // The Mood Board moment cycles its palette (never under reduce motion).
  useEffect(() => {
    if (reducedMotion()) return;
    let i = 0;
    const id = window.setInterval(() => {
      i = (i + 1) % 4;
      root.current?.querySelectorAll<HTMLElement>('[data-mo="palette"]').forEach((m) => m.setAttribute('data-pal', String(i)));
    }, 2600);
    return () => window.clearInterval(id);
  }, []);

  // The run of show's "Shift everything" — it moves the times on the picture, nothing else.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const click = (ev: MouseEvent) => {
      const shift = (ev.target as HTMLElement).closest<HTMLElement>('[data-shift]');
      if (!shift || !el.contains(shift)) return;
      shift.closest('[data-mo]')?.querySelectorAll<HTMLElement>('[data-t]').forEach((t) => {
        const m = /(\d+):(\d+) (\w+)/.exec(t.dataset.t ?? '');
        if (!m) return;
        const mins = (Number(m[1]) % 12) * 60 + Number(m[2]) + 12;
        t.textContent = `${Math.floor(mins / 60) % 12 || 12}:${String(mins % 60).padStart(2, '0')} ${m[3]}`;
      });
      const label = shift.querySelector('span:last-child');
      if (label) label.textContent = 'Shifted +12 min';
      shift.setAttribute('disabled', '');
    };
    el.addEventListener('click', click);
    return () => el.removeEventListener('click', click);
  }, []);

  return (
    <Ctx.Provider value={{ persona, choose }}>
      <div ref={root} className={s.scope} data-persona-active={persona}>
        {children}
      </div>
    </Ctx.Provider>
  );
}

/** The hero's "I am" pick — the app's one dropdown (`PickMenu`), never a raw select. */
export function PersonaPicker({ label, options }: { label: string; options: readonly { key: PersonaChoice; label: string }[] }) {
  const { persona, choose } = useContext(Ctx);
  return (
    <div className={s.pick}>
      <span className={s.pl}>{label}</span>
      <PickMenu
        label="Who are you"
        value={persona}
        options={options.map((o) => ({ key: o.key, label: o.label }))}
        onPick={(k) => {
          if (isChoice(k)) choose(k);
        }}
        dataAttr="data-persona-pick"
      />
    </div>
  );
}

/** The chosen persona's words — one per persona, handed in (so the page's ONE <h1> holds one title, not four). */
export function PersonaText({ texts }: { texts: Readonly<Record<PersonaChoice, string>> }) {
  const { persona } = useContext(Ctx);
  return <>{texts[persona]}</>;
}

/** The Plans compare's "Compare" pick: event plans or supplier plans. Both lists are server-rendered. */
export function PlanKinds({
  label,
  options,
}: {
  label: string;
  options: readonly { key: string; label: string; panel: ReactNode }[];
}) {
  const [kind, setKind] = useState(options[0]?.key ?? '');
  return (
    <>
      <div className={s.pick}>
        <span className={s.pl}>{label}</span>
        <PickMenu
          label="Which plans"
          value={kind}
          options={options.map((o) => ({ key: o.key, label: o.label }))}
          onPick={setKind}
          dataAttr="data-plan-pick"
        />
      </div>
      {options.map((o) => (
        <div key={o.key} hidden={o.key !== kind}>
          {o.panel}
        </div>
      ))}
    </>
  );
}
