'use client';

/**
 * front-door-landing-client.tsx — the few things on the signed-out front page that need a browser.
 *
 * Ported from the scripts at the foot of `prototypes/front_page_2026-11-04.html`. Everything they act on
 * is server markup handed in as children, so the page's words never enter this bundle and a visitor
 * without JavaScript still reads every section (the reveal only hides what it is about to show once it
 * knows it can show it).
 *
 *   • `PersonaViewer` — "See it as" switches the sample's phone and its copy (the prototype's `#who`);
 *   • `Expandable` + `ExpandButton` — "See all 20 ›" on the problems and "See all N" on each plan;
 *   • `LandingMotion` — the calm reveal on scroll, and the problems' photo settling in.
 */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { useRevealOnOpen } from '@/app/_components/reveal-on-open';

/* ─── "See it as" ───────────────────────────────────────────────────────────────────────────── */

export function PersonaViewer({
  options,
  children,
}: {
  options: readonly { key: string; label: string }[];
  children: ReactNode;
}) {
  const [who, setWho] = useState(options[0]?.key ?? '');
  const [scrolled, setScrolled] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  // The phone's page scrolls on its own; the hint leaves once somebody has scrolled it.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const screens = Array.from(el.querySelectorAll<HTMLElement>('[data-fl-screen]'));
    const onScroll = (e: Event) => {
      if ((e.currentTarget as HTMLElement).scrollTop > 40) setScrolled(true);
    };
    screens.forEach((s) => s.addEventListener('scroll', onScroll, { passive: true }));
    return () => screens.forEach((s) => s.removeEventListener('scroll', onScroll));
  }, []);

  function choose(next: string) {
    setWho(next);
    root.current?.querySelectorAll<HTMLElement>('[data-fl-screen]').forEach((s) => (s.scrollTop = 0));
  }

  return (
    <div ref={root} className={scrolled ? 'fl-viewer fl-scrolled' : 'fl-viewer'} data-who={who}>
      <div className="fl-viewer-ctl">
        {/* House rule: a set of choices is ONE dropdown — the shared PickMenu, never a raw <select>. */}
        <span className="fl-pick">
          <span aria-hidden="true">See it as</span>
          <PickMenu
            label="See it as"
            value={who}
            options={options.map((o) => ({ key: o.key, label: o.label }))}
            onPick={choose}
            dataAttr="data-fl-persona-pick"
          />
        </span>
      </div>
      {children}
    </div>
  );
}

/* ─── "See all" ─────────────────────────────────────────────────────────────────────────────── */

const Open = createContext<{ open: boolean; toggle: () => void }>({ open: false, toggle: () => {} });

/** A block that opens in place. Its `ExpandButton` may sit anywhere inside it. */
export function Expandable({
  as: Tag = 'div',
  className,
  children,
}: {
  as?: 'div' | 'article';
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  // Opening glides the block into view when it runs past the bottom — the app-wide reveal (owner 2026-11-04).
  const intend = useRevealOnOpen(open, () => ({ head: root.current }));
  function toggle() {
    if (!open) intend();
    setOpen(!open);
    // Closing a long list: bring its top back into view, as the prototype does.
    if (open) requestAnimationFrame(() => root.current?.scrollIntoView({ block: 'nearest' }));
  }
  return (
    <Open.Provider value={{ open, toggle }}>
      <Tag ref={root as never} className={open ? `${className} fl-open` : className}>
        {children}
      </Tag>
    </Open.Provider>
  );
}

export function ExpandButton({
  more,
  less,
  className,
  chevron = false,
}: {
  more: string;
  less: string;
  className: string;
  /** Draw the turning chevron after the words (the plan cards' toggle). */
  chevron?: boolean;
}) {
  const { open, toggle } = useContext(Open);
  return (
    <button type="button" className={className} aria-expanded={open} onClick={toggle}>
      {open ? less : more}
      {chevron ? <i aria-hidden="true" /> : null}
    </button>
  );
}

/* ─── The calm reveal ───────────────────────────────────────────────────────────────────────── */

/**
 * Marks the landing as moving, then reveals each `.fl-reveal` section and `.fl-solve` row as it comes
 * into view. Under reduced motion, or with no IntersectionObserver, it does nothing — and nothing is
 * hidden, because the hiding rule keys off the `data-fl-motion` this sets.
 */
export function LandingMotion({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root || !('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('.fl-reveal, .fl-solve'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('fl-in');
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    // Anything already on screen shows at once; only what is below the fold waits.
    const fold = window.innerHeight;
    for (const el of items) {
      if (el.getBoundingClientRect().top < fold) el.classList.add('fl-in');
      else io.observe(el);
    }
    root.setAttribute('data-fl-motion', '');
    return () => io.disconnect();
  }, [rootId]);
  return null;
}
