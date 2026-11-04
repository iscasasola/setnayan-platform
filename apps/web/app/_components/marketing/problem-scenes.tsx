'use client';

/**
 * <ProblemScenes> — "N problems … And what Setnayan does instead", as the 4 Nov 2026 prototypes draw it:
 * for each problem, a photo of the problem under a dark wash with the pain written on it, then the turn
 * ("With Setnayan") in plain words, a link to where it lives, and what it costs ("Free").
 *
 * The first `initial` show; "See all N ›" opens the rest and "Show the top N" folds them again (and
 * scrolls back to the list's top, so the reader is not left at the bottom of a page that shrank).
 * Each scene settles as it scrolls into view: the photo eases out of a slight zoom and the pain line
 * rises in. Under `prefers-reduced-motion: reduce` everything rests in place.
 *
 * Every item is plain data from the page, so the words ship in the server HTML. A scene without a
 * `link` shows only its tag — a link must open a real page (the prototypes' demo pages do not exist yet).
 *
 * Layout and colours: `photo-page.css` (`.pp-solves`, sized by the list's own width).
 */

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { formatCount } from '@/lib/format-number';

import './photo-page.css';

export type ProblemScene = {
  /** `/marketing/<date>/<key>.webp` — a file under `public/`. */
  photo: string;
  /** What the photo shows, for a screen reader. */
  alt: string;
  /** The problem's name, in capitals over the photo. */
  title: string;
  /** The pain, in the reader's words. */
  pain: string;
  /** What Setnayan does instead. */
  answer: string;
  /** Where it lives — a real page. Optional: no link is better than a link to nowhere. */
  link?: { href: string; label: string };
  /** What it costs, e.g. "Free". */
  tag: string;
};

/** The photos are cropped to 4:3 (960 × 720) for this slot. */
const PHOTO_W = 960;
const PHOTO_H = 720;

export function ProblemScenes({
  items,
  initial = 4,
}: {
  items: readonly ProblemScene[];
  initial?: number;
}) {
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const total = items.length;
  const shown = (n: number) => formatCount(n).padStart(2, '0');

  useEffect(() => {
    const root = list.current;
    if (!root) return;
    const scenes = Array.from(root.querySelectorAll<HTMLElement>('.pp-solve'));
    const settle = (el: Element) => el.setAttribute('data-in', '');
    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      scenes.forEach(settle);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          settle(e.target);
          io.unobserve(e.target);
        }
      },
      { rootMargin: '0px 0px -18% 0px' },
    );
    scenes.filter((s) => !s.hasAttribute('data-in')).forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [open]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) list.current?.scrollIntoView({ block: 'start' });
  }

  return (
    <>
      <div className="pp-solves" ref={list} data-open={open ? '' : undefined}>
        {items.map((it, i) => (
          <article key={it.title} className="pp-solve" data-more={i >= initial ? '' : undefined}>
            <figure className="pp-scene">
              <Image
                src={it.photo}
                alt={it.alt}
                width={PHOTO_W}
                height={PHOTO_H}
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
              <figcaption>
                <span className="pp-n">
                  {shown(i + 1)} / {shown(total)}
                </span>
                <span className="pp-t">{it.title}</span>
                <p className="pp-pain">{it.pain}</p>
              </figcaption>
            </figure>
            <div className="pp-turn">
              <p className="pp-with">With Setnayan</p>
              <p className="pp-ans">{it.answer}</p>
              <div className="pp-act">
                {it.link ? (
                  <Link href={it.link.href}>
                    {it.link.label} <i aria-hidden="true">›</i>
                  </Link>
                ) : null}
                <span className="pp-ftag">{it.tag}</span>
              </div>
            </div>
          </article>
        ))}
      </div>
      {total > initial ? (
        <div className="pp-solves-more">
          <button type="button" className="m-btn m-btn-ghost" aria-expanded={open} onClick={toggle}>
            {open ? `Show the top ${formatCount(initial)}` : `See all ${formatCount(total)} ›`}
          </button>
        </div>
      ) : null}
    </>
  );
}
