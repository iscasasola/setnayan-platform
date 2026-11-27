'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { CalendarHeart, Sparkles, Store, Telescope, Users, type LucideIcon } from 'lucide-react';
import { UNIHOME_JUMPS, UNIHOME_JUMP_WORD, UNIHOME_PARTS, UNIHOME_TOP_ID, type UnihomeJump } from '@/lib/unihome';
import u from './unihome.module.css';

/**
 * unihome-jump.tsx — the six jump icons under your name (Unihome v5, owner-approved 23 Nov 2026; drawing
 * `unihome-v5.html` · Notes "The jump icons"). You · Events · Shop · People · Memories · Discover, in page order.
 *
 *   · A nav landmark named "Jump to"; each icon is a link with its word; the lit one carries `aria-current`.
 *   · The icons are the ones the menu registry already names (`nav-registry-defaults.ts`): CalendarHeart · Store ·
 *     Users · Sparkles · Telescope. "You" is your own photo and goes back to the top.
 *   · It stays at the top as you scroll — it is the shared `CollapsingTop`'s pinned row, drawn at rest.
 *   · A number mark comes only from a read the app already does (Shop = new for your shop, People = asking you), and
 *     only for a real positive number: a failed read draws NO mark, never 0.
 *   · The lit icon follows the part under the row as you scroll; a tap lights it at once and moves the page there
 *     (smoothly, unless the person asked for reduced motion), and it stays lit until the person scrolls by hand.
 */

const ICON: Record<Exclude<UnihomeJump, 'you'>, LucideIcon> = {
  events: CalendarHeart,
  shop: Store,
  people: Users,
  memories: Sparkles,
  discover: Telescope,
};


export function UnihomeJump({
  me,
  marks,
}: {
  me: { photoUrl: string | null; initials: string; photoStyle?: CSSProperties };
  /** Positive numbers only — anything else draws no mark. */
  marks: Partial<Record<UnihomeJump, number | null>>;
}) {
  const [lit, setLit] = useState<UnihomeJump>('you');
  const held = useRef(false);

  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      // A tap holds its icon lit while the page travels there, and after: until the person scrolls by hand. A part
      // too short to reach the line (the page ran out of room) stays the lit one you asked for.
      if (held.current) return;
      const row = document.querySelector('[data-unihome-jump]');
      const line = (row?.getBoundingClientRect().bottom ?? 0) + 16;
      let next: UnihomeJump = 'you';
      // At rest the page is at its top: You is lit, whatever part starts right under the row.
      if (window.scrollY > 4)
      for (const part of UNIHOME_PARTS) {
        const el = document.getElementById(part);
        if (el && el.getBoundingClientRect().top <= line) next = part;
      }
      // The last part can be too short to reach the line: at the foot of the page it is the one you are in — but only
      // once it fills the upper half of what you can see. On a short page the foot comes while Events is still at the
      // top; lighting Discover there was wrong (walkthrough 27 Nov, W1-20).
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        const last = UNIHOME_PARTS[UNIHOME_PARTS.length - 1]!;
        const top = document.getElementById(last)?.getBoundingClientRect().top;
        if (top !== undefined && top <= line + (window.innerHeight - line) / 2) next = last;
      }
      setLit(next);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    // A hand on the page lets go of a tap's hold: the lit icon follows the page again.
    const release = () => {
      held.current = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) release();
    };
    measure();
    window.addEventListener('wheel', release, { passive: true });
    window.addEventListener('touchstart', release, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', release);
      window.removeEventListener('touchstart', release);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const go = (key: UnihomeJump) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const el = document.getElementById(key === 'you' ? UNIHOME_TOP_ID : key);
    if (!el) return;
    e.preventDefault();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    held.current = true;
    setLit(key);
    if (key === 'you') window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    else el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(history.state, '', key === 'you' ? window.location.pathname + window.location.search : `#${key}`);
  };

  return (
    <nav aria-label="Jump to" className={u.jump} data-unihome-jump="">
      {UNIHOME_JUMPS.map((key) => {
        const n = marks[key];
        const mark = typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;
        const word = UNIHOME_JUMP_WORD[key];
        const Icon = key === 'you' ? null : ICON[key];
        return (
          <Link
            key={key}
            href={`#${key === 'you' ? UNIHOME_TOP_ID : key}`}
            scroll={false}
            onClick={go(key)}
            className={u.jc}
            aria-current={lit === key ? 'location' : undefined}
            data-unihome-jump-to={key}
          >
            {Icon ? (
              <span className={u.jcMark} aria-hidden>
                <Icon strokeWidth={1.9} />
              </span>
            ) : (
              <span className={`${u.jcMark} ${u.jcMe}`} aria-hidden>
                {me.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={me.photoUrl} alt="" style={me.photoStyle} />
                ) : (
                  me.initials
                )}
              </span>
            )}
            {mark !== null ? (
              <span className={u.jb} aria-hidden data-unihome-mark={key}>
                {mark > 99 ? '99+' : mark}
              </span>
            ) : null}
            {word}
            {mark !== null ? <span className="sr-only">{key === 'people' ? `, ${mark} asking you` : `, ${mark} new`}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
