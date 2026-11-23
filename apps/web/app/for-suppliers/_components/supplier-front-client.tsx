'use client';

/**
 * /for-suppliers — the parts of the owner-APPROVED redesign (23 Nov 2026, specs
 * `prototypes/for_suppliers_redesign_2026-11-23/index.html` v4.3.1) that answer a tap or the screen:
 *
 *   · `FrontClip`       — a clip that plays only while it is on screen, its poster first, nothing fetched until it is near
 *                         (with reduced motion it waits for a tap: native controls);
 *   · `FeeSteps`        — #fees: three steps PLAY once when the part comes into view (words → the ONE figure → what it
 *                         meant), step dots to replay any one, and Play again. No scroll-scrub, no pinning (DECISION_LOG
 *                         23 Nov "a timed fee scene");
 *   · `PlanPicker`      — #plans: the rail (one bar per plan, its height the plan's size) picks a card; a swipe of the
 *                         cards moves the rail. Verified is picked first, as drawn;
 *   · `ToolkitCount`    — #tools: the Toolkit count line and its "See all" `Sheet`;
 *   · `OpenShopFollow`  — "Open your shop" follows the reader: a floating pill on a phone, a pill under the shell's top bar
 *                         on desktop, shown only while neither the hero's button nor the closing button is on screen.
 *
 * WHERE EVERY NUMBER COMES FROM: nothing is computed here. The fees, prices, counts and sizes arrive as words the page
 * built from their one reader (`supplier-front-data.ts`: `feeSteps`, `planStair`, `toolkitShelves`); an unread plan
 * price draws "—".
 */
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { formatCount } from '@/lib/format-number';
import type { FeeStep, FrontClip as Clip, ToolkitShelf, ToolkitTag } from './supplier-front-data';
import s from './supplier-front.module.css';

/** The visitor asked for less motion (read once on mount; the server renders the resting page). */
function useReducedMotion(): boolean | null {
  const [reduce, setReduce] = useState<boolean | null>(null);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduce(m.matches);
    const on = () => setReduce(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduce;
}

/* ───────────────────────── a clip ───────────────────────── */

/**
 * 🎞 A clip in its crop (4:3 or 3:4). Until it comes within a screen of view it is only its box on the wash, so no
 * poster or video is fetched for the first paint; near, the poster paints and the video plays while ≥ 55 % is on screen.
 */
export function FrontClip({ clip }: { clip: Clip }) {
  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '100% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = vid.current;
    if (!near || !v || reduce !== false) return;
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        }
      },
      { threshold: 0.55 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [near, reduce]);

  return (
    <div ref={box} className={s.cap} data-shape={clip.shape}>
      {near ? (
        <video
          ref={vid}
          muted
          playsInline
          loop
          preload="metadata"
          poster={clip.poster}
          aria-label={clip.label}
          controls={reduce === true}
        >
          <source src={clip.src} type="video/mp4" />
        </video>
      ) : (
        <span className={s.capWait} role="img" aria-label={clip.label} />
      )}
    </div>
  );
}

/* ───────────────────────── #fees · the timed steps ───────────────────────── */

/** The drawing's beats: the words, then the figure at 800 ms, then what it meant at 1.5 s; the next step at 2.5 s. */
const FIGURE_AT = 800;
const MEANT_AT = 1500;
const NEXT_AT = 2500;

function Say({ n, text }: { n: number | null; text: string }) {
  return (
    <b className={s.say}>
      {n ? <i>{n} / 3</i> : null}
      {text}
    </b>
  );
}

export function FeeSteps({ intro, steps, figureLabel }: { intro: { say: string; mean: string }; steps: readonly FeeStep[]; figureLabel: string }) {
  const reduce = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  /** The step on screen (1–3), 0 before the first plays. */
  const [at, setAt] = useState(0);
  /** How far the step has played: 0 words · 1 + the figure · 2 + what it meant. */
  const [beat, setBeat] = useState(2);
  const [again, setAgain] = useState(false);
  /** Bumped each time the figure changes, so it rises again. */
  const [hit, setHit] = useState(0);

  const clear = () => {
    for (const t of timers.current) window.clearTimeout(t);
    timers.current = [];
  };
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));

  const show = (n: number) => {
    clear();
    setAt(n);
    setBeat(0);
    later(() => {
      setBeat(1);
      setHit((h) => h + 1);
    }, FIGURE_AT);
    later(() => setBeat(2), MEANT_AT);
  };
  const play = (n: number) => {
    setAgain(false);
    show(n);
    if (n < steps.length) later(() => play(n + 1), NEXT_AT);
    else later(() => setAgain(true), NEXT_AT);
  };

  useEffect(() => {
    const el = box.current;
    if (!el || reduce !== false) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          io.disconnect();
          play(1);
        }
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      clear();
    };
    // `play` reads only refs and setters; the observer is set up once the motion preference is known.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduce]);

  // Reduced motion (and the server's first paint): every step written out, the last figure in the box.
  if (reduce !== false) {
    const last = steps[steps.length - 1];
    return (
      <div ref={box}>
        <div className={s.feeshow}>
          <p className={s.k}>{figureLabel}</p>
          <p className={s.ff}>{last?.fee ?? '—'}</p>
          <p className={s.fs}>{last?.sub ?? ''}</p>
        </div>
        <p className={s.story} role="status">
          {steps.map((st, i) => (
            <span key={st.say} className={s.storyPair}>
              <Say n={i + 1} text={st.say} />
              <span className={s.mean}>
                {st.fee}
                {st.sub ? ` · ${st.sub}` : ''}. {st.mean}
              </span>
            </span>
          ))}
        </p>
      </div>
    );
  }

  const cur = at > 0 ? steps[at - 1] : null;
  return (
    <div ref={box}>
      <div className={s.feeshow}>
        <p className={s.k}>{figureLabel}</p>
        <p className={s.ff} key={hit} data-hit={hit > 0 ? '' : undefined}>
          {cur && beat >= 1 ? cur.fee : steps[0]?.fee ?? '—'}
        </p>
        <p className={s.fs}>{cur && beat >= 1 ? cur.sub : ''}</p>
      </div>
      <p className={s.story} role="status">
        {cur ? (
          <>
            <Say n={at} text={cur.say} />
            {beat >= 2 ? <span className={s.mean}>{cur.mean}</span> : null}
          </>
        ) : (
          <>
            <Say n={null} text={intro.say} />
            <span className={s.mean}>{intro.mean}</span>
          </>
        )}
      </p>
      <div className={s.dots}>
        {steps.map((st, i) => (
          <button
            key={st.say}
            type="button"
            className={s.dot}
            aria-label={`Step ${i + 1}`}
            aria-pressed={at === i + 1}
            onClick={() => {
              setAgain(false);
              show(i + 1);
              later(() => setAgain(true), NEXT_AT);
            }}
          >
            {i + 1}
          </button>
        ))}
        {again ? (
          <button type="button" className={s.again} onClick={() => play(1)}>
            Play again
          </button>
        ) : null}
      </div>
    </div>
  );
}

/* ───────────────────────── #plans · the rail and the cards ───────────────────────── */

/** One plan card, every part read by the page (`planStair` · the catalog · `openShopWithPlanHref`). */
export type PlanCard = {
  tier: string;
  name: string;
  /** A paid plan's catalogue price ("₱…"), null when unread (draws "—"); a free plan's word ("Free"). */
  price: string | null;
  /** "per 4 weeks" under a paid price; null on a free plan. */
  per: string | null;
  keep: string;
  size: string;
  /** The rail bar's height, 0–1 (`railShare`: its storage over the biggest plan's). */
  share: number;
  tools: { ok: boolean; text: string };
  cta: string;
  href: string;
};

export function PlanPicker({ plans, start }: { plans: readonly PlanCard[]; start: number }) {
  const [pk, setPk] = useState(start);
  const row = useRef<HTMLDivElement>(null);
  /** The card a tap sent the row to — scroll events on the way there must not move the rail back. */
  const goingTo = useRef<number | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  const center = (i: number, smooth: boolean) => {
    const el = row.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (!el || !card) return;
    goingTo.current = i;
    el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    center(start, false);
    const el = railRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = () => {
    const el = row.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let gap = Infinity;
    Array.from(el.children).forEach((c, i) => {
      const h = c as HTMLElement;
      const d = Math.abs(h.offsetLeft + h.offsetWidth / 2 - mid);
      if (d < gap) {
        gap = d;
        best = i;
      }
    });
    if (goingTo.current !== null) {
      if (best === goingTo.current) goingTo.current = null;
      return;
    }
    setPk(best);
  };

  return (
    <>
      <div ref={railRef} className={s.rail} role="group" aria-label="Plans, smallest to biggest" data-in={inView ? '' : undefined}>
        {plans.map((p, i) => (
          <button
            key={p.tier}
            type="button"
            className={s.stop}
            aria-pressed={pk === i}
            style={{ ['--h' as string]: String(p.share) }}
            onClick={() => {
              setPk(i);
              center(i, true);
            }}
          >
            <u aria-hidden />
            <span>{p.name}</span>
          </button>
        ))}
      </div>
      <div
        ref={row}
        className={s.prow}
        onScroll={onScroll}
        onPointerDown={() => {
          goingTo.current = null;
        }}
      >
        {plans.map((p, i) => (
          <div key={p.tier} className={s.plan} data-on={pk === i ? '' : undefined}>
            <div className={s.ptop}>
              <b>{p.name}</b>
              <span className={s.price}>
                {p.per ? (
                  <>
                    {p.price ?? '—'} <small>{p.per}</small>
                  </>
                ) : (
                  p.price
                )}
              </span>
            </div>
            <p className={s.keep}>{p.keep}</p>
            <p className={s.size}>{p.size}</p>
            <ul>
              <li>
                <Check aria-hidden className={s.okIc} strokeWidth={2.2} />
                <span>Free tools</span>
              </li>
              <li data-locked={p.tools.ok ? undefined : ''}>
                {p.tools.ok ? <Check aria-hidden className={s.okIc} strokeWidth={2.2} /> : <Lock aria-hidden className={s.lkIc} strokeWidth={2} />}
                <span>{p.tools.text}</span>
              </li>
            </ul>
            <Link className={s.door} href={p.href}>
              {p.cta} →
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}

/* ───────────────────────── #tools · the Toolkit count and its sheet ───────────────────────── */

const TAG_WORDS: Readonly<Record<ToolkitTag, string>> = { free: 'Free', paid: 'Paid', built: 'Built in' };

export function ToolkitCount({ total, parts, shelves, graphsLine }: { total: number; parts: string; shelves: readonly ToolkitShelf[]; graphsLine: string }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  return (
    <>
      <p className={s.count}>
        <span className={s.num}>{formatCount(total)}</span> in the Toolkit: {parts}.{' '}
        <button type="button" className={s.countBtn} onClick={() => setOpen(true)} aria-haspopup="dialog">
          See all {formatCount(total)}
        </button>
      </p>
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={titleId} rise>
        <div className={`${s.root} ${s.kit}`}>
          <h3 id={titleId} className={s.kitTitle}>
            The Toolkit
          </h3>
          <p className={s.lede}>{formatCount(total)} in all. Most are free.</p>
          {shelves.map((sh) => (
            <section key={sh.key}>
              <p className={s.k}>
                {sh.title} · {formatCount(sh.count)}
              </p>
              {sh.rows.length ? (
                <ul className={`${s.rows} ${s.rowsSm}`}>
                  {sh.rows.map((r) => (
                    <li key={r.key}>
                      <div className={s.hd}>
                        <b>{r.name}</b>
                        {r.tag ? (
                          <span className={s.tag} data-tag={r.tag}>
                            {TAG_WORDS[r.tag]}
                          </span>
                        ) : null}
                      </div>
                      {r.line ? <p>{r.line}</p> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={s.fine}>{graphsLine}</p>
              )}
            </section>
          ))}
        </div>
      </Sheet>
    </>
  );
}

/* ───────────────────────── "Open your shop" follows the reader ───────────────────────── */

/**
 * Shown only while NEITHER of the page's own "Open your shop" buttons (`watch`, element ids) is on screen, so there are
 * never two at once. On a phone it floats at the foot; from 760 px it sits under the shell's one top bar, top-right
 * (the bar itself is shared, `one-top-bar.test.ts`, so the page never draws into it).
 */
export function OpenShopFollow({ href, label, watch }: { href: string; label: string; watch: readonly string[] }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const seen = new Map<string, boolean>(watch.map((id, i) => [id, i === 0]));
    const els = watch.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => e !== null);
    if (els.length === 0) return;
    const io = new IntersectionObserver((es) => {
      for (const e of es) seen.set(e.target.id, e.isIntersecting);
      setShow([...seen.values()].every((v) => !v));
    });
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, [watch]);
  if (!show) return null;
  return (
    <>
      <Link className={`fd-btn-terra ${s.fab}`} href={href}>
        {label}
      </Link>
      <Link className={`fd-btn-terra ${s.topOpen}`} href={href}>
        {label}
      </Link>
    </>
  );
}
