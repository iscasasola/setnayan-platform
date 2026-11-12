'use client';

/**
 * The plan card's preview row (ruling 5735, owner-approved 13 Nov 2026 — corpus
 * `prototypes/plan_previews_2026-11-13/index.html`): at the foot of each plan card on /for-suppliers § 13 · PLANS, a
 * 3:4 miniature (112 × 149) of that plan's shop page + "Your page on <Plan> · What couples see · <caption> · Open ›".
 *
 * The page itself arrives as `children` — `SampleShopPage`, server-rendered once by the page. The miniature is THAT
 * drawing at phone width (390 px) scaled to 112 px, and a tap lifts the SAME drawing full screen: ⤴ the house rise
 * (`lib/rise-motion.ts`, 0.7 s on `--sn-ease-rise`; a short cross-fade under reduced motion) from the miniature's own
 * box, under a floating pill bar with ‹ Back (44 px). ‹ Back, Esc, a tap on the scrim and the browser's back all close
 * it with the exact reverse — back into the miniature. The shared modal hook carries the focus trap, the scroll lock and
 * focus back to the row.
 *
 * Cheap on a public page: no new library; the drawing is server HTML; its maps load lazily (the miniature of a closed
 * Grow tab is `hidden`, so nothing in it loads until that tab opens).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { RISE_EASE, RISE_MS, RISE_REDUCED_MS, riseFromRect } from '@/lib/rise-motion';
import s from './supplier-front.module.css';

export function PlanPagePreview({ plan, label, caption, children }: { plan: string; label: string; caption: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const thumb = useRef<HTMLDivElement>(null);
  /** True while this sheet owns a history entry the browser's back should pop. */
  const pushed = useRef(false);

  const onOpen = () => {
    setOpen(true);
    try {
      window.history.pushState({ ...(window.history.state ?? {}), sfPlanPage: plan }, '');
      pushed.current = true;
    } catch {
      pushed.current = false; // a sandboxed frame cannot — the sheet still opens and closes
    }
  };
  const onClosed = useCallback(() => setOpen(false), []);

  return (
    <div className={s.mini} data-plan-preview={plan}>
      <div ref={thumb} className={s.miniThumb} aria-hidden="true" inert>
        <div className={s.miniPage}>{children}</div>
      </div>
      <span className={s.miniText}>
        <small>Your page on {label}</small>
        <b>What couples see</b>
        <span>{caption}</span>
        <em>Open</em>
      </span>
      <button
        type="button"
        className={s.miniHit}
        aria-haspopup="dialog"
        aria-label={`Open your page on ${label}, full screen`}
        onClick={onOpen}
      />
      {open ? (
        <PlanPageSheet label={label} from={thumb} pushed={pushed} onClosed={onClosed}>
          {children}
        </PlanPageSheet>
      ) : null}
    </div>
  );
}

function PlanPageSheet({
  label,
  from,
  pushed,
  onClosed,
  children,
}: {
  label: string;
  from: RefObject<HTMLDivElement | null>;
  pushed: MutableRefObject<boolean>;
  onClosed: () => void;
  children: ReactNode;
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const layer = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const closing = useRef(false);

  useEffect(() => setHost(document.body), []);

  const fadeScrim = (reverse: boolean) => {
    const el = scrim.current;
    if (!el || typeof el.animate !== 'function') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    el.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: reduce ? RISE_REDUCED_MS : RISE_MS,
      easing: reduce ? 'linear' : RISE_EASE,
      direction: reverse ? 'reverse' : 'normal',
      fill: 'both',
    });
  };

  /** The exact reverse of the rise, back into the miniature; then the row lets go of the sheet. */
  const fall = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    const el = sheet.current;
    const to = from.current;
    fadeScrim(true);
    const anim = el && to && to.isConnected ? riseFromRect(el, to.getBoundingClientRect(), { reverse: true }) : null;
    if (anim) void anim.finished.then(onClosed, onClosed);
    else onClosed();
  }, [from, onClosed]);

  /** ‹ Back · Esc · the scrim: fall, and give back the history entry the open pushed. */
  const close = useCallback(() => {
    const hadEntry = pushed.current;
    pushed.current = false;
    fall();
    if (hadEntry) window.history.back();
  }, [fall, pushed]);

  // The browser's back: the entry is already gone — just fall.
  useEffect(() => {
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      fall();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [fall, pushed]);

  useModalA11y({ open: true, onClose: close, containerRef: layer, initialFocusRef: back });

  // ⤴ THE RISE — once, from the miniature, as soon as the layer is on <body>.
  useLayoutEffect(() => {
    const el = sheet.current;
    const to = from.current;
    if (!el || !to || !to.isConnected) return;
    fadeScrim(false);
    riseFromRect(el, to.getBoundingClientRect());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the rise plays once, when the portal first lands
  }, [host]);

  if (!host) return null;
  return createPortal(
    <div ref={layer} className={s.pageLayer} role="dialog" aria-modal="true" aria-label={`Your page on ${label}`}>
      <div ref={scrim} className={s.pageScrim} onClick={close} aria-hidden="true" />
      <div ref={sheet} className={s.pageSheet}>
        <div className={s.pageBarWrap}>
          <div className={s.pageBar}>
            <button ref={back} type="button" className={s.pageBack} onClick={close}>
              <ChevronLeft aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
              Back
            </button>
            <span className={s.pageTitle}>Your page on {label}</span>
          </div>
        </div>
        <div className={s.pageScroll}>{children}</div>
      </div>
    </div>,
    host,
  );
}
