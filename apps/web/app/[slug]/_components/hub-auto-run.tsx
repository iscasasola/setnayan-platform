'use client';

import { useEffect, useRef, useState } from 'react';
import { autoRunTimings, type HubAutoSpeed } from '@/lib/hub-scenes';

/**
 * AN AUTO RUN — scenes that hand over by themselves, on a clock
 * (owner 2026-09-24: *"3. Auto-scroll (can set the speed)"*; timings in
 * `lib/hub-scenes.ts` `autoRunTimings`, the look in `globals.css` "AUTO RUNS",
 * drawn from `prototypes/scenes_three_modes_std_2026-09-24.html`).
 *
 * 🔑 THE STYLESHEET PLAYS THE SCENES; THIS ONLY SAYS WHICH AND WHEN.
 *
 *   data-armed    the clock may run at all. Set only after mount, only when the
 *                 guest has NOT asked for reduced motion, and only where an
 *                 IntersectionObserver exists. Without it every rule that hides
 *                 a scene is inert — no script, a failed bundle, or reduced
 *                 motion all leave the plain page, every scene stacked and
 *                 readable. Fail-visible, the canvas's own rule.
 *   data-playing  the run is at least half on screen, and the guest has not
 *                 stopped it. Scrolled away → the clock pauses; back → resumes.
 *
 * 🔑 IT TIMES ONLY THE SCENES THAT DREW SOMETHING. A scene can render nothing
 * (a countdown after the day, a template whose photo failed to sign), and the
 * server cannot see that from outside the node. A clock slot kept for it would
 * be 4.5 seconds of blank screen — the one failure the owner's bar ("0 blank
 * frames") forbids. So on arming, the empty ones are marked `data-auto-skip`
 * (not drawn) and the live ones get their fade times from `autoRunTimings`.
 * React never renders these attributes or `style` on the scene wrappers, so
 * nothing it re-renders can wipe them.
 *
 * ⛔ A TOUCH STOPS IT FOR GOOD (owner: "stops auto-advancing on guest
 * scroll/touch"). A tap, a press, a key inside the run — the guest is reading
 * or reaching for something, and a scene sliding away under their thumb is the
 * worst thing this could do. Only the Play button starts it again. Scrolling the
 * PAGE past the run is not a touch of it: it pauses by leaving the screen and
 * resumes on return, as in the approved prototype.
 */
export function HubAutoRun({
  timeline,
  speed,
  children,
}: {
  /** The run's view-timeline name, for the page's progress mark. */
  timeline: string;
  speed: HubAutoSpeed;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [inView, setInView] = useState(false);
  const [stopped, setStopped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (reduce?.matches || typeof IntersectionObserver === 'undefined') return;

    const scenes = Array.from(el.querySelectorAll<HTMLElement>(':scope > .hub-auto'));
    // The same two "drew nothing" shapes the scrub CSS drops: no child at all,
    // or a canvas frame whose body is empty.
    const live = scenes.filter(
      (s) => s.firstElementChild !== null && !s.querySelector(':scope > .hub-canvas > .hub-canvas-body:empty'),
    );
    // One scene (or none) is not a run — there is nothing to hand over to.
    if (live.length < 2) return;
    for (const s of scenes) if (!live.includes(s)) s.setAttribute('data-auto-skip', '');
    autoRunTimings(live.length, speed).forEach((t, k) => {
      const s = live[k]!;
      s.style.setProperty('--hub-fade', `${t.fade.toFixed(3)}s`);
      if (t.inAt !== null) {
        s.setAttribute('data-auto-in', '');
        s.style.setProperty('--hub-in-at', `${t.inAt.toFixed(3)}s`);
      }
      if (t.outAt !== null) {
        s.setAttribute('data-auto-out', '');
        s.style.setProperty('--hub-out-at', `${t.outAt.toFixed(3)}s`);
      }
    });
    setArmed(true);

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[entries.length - 1];
        if (e) setInView(e.isIntersecting && e.intersectionRatio >= 0.5);
      },
      { threshold: [0, 0.5, 1] },
    );
    io.observe(el);

    const stop = (ev: Event) => {
      // The Play/Pause button is the one control that must not stop the run.
      if ((ev.target as Element | null)?.closest?.('[data-auto-toggle]')) return;
      setStopped(true);
    };
    el.addEventListener('pointerdown', stop);
    el.addEventListener('keydown', stop);
    // Reduced motion switched on mid-visit: disarm, and the page is plain again.
    const onReduce = () => {
      if (reduce?.matches) setArmed(false);
    };
    reduce?.addEventListener?.('change', onReduce);
    return () => {
      io.disconnect();
      el.removeEventListener('pointerdown', stop);
      el.removeEventListener('keydown', stop);
      reduce?.removeEventListener?.('change', onReduce);
    };
  }, [speed]);

  const playing = armed && inView && !stopped;
  return (
    <div
      ref={ref}
      className="hub-arun"
      data-armed={armed ? '' : undefined}
      data-playing={playing ? '' : undefined}
      style={{ '--hub-tl': timeline } as React.CSSProperties}
    >
      {children}
      {/* Rendered always, DRAWN only once armed (`.hub-auto-pp` is
          `display: none` until `[data-armed]`) — so the plain page, and a
          guest who asked for less motion, never see a button that would do
          nothing, and the markup is the same on the server and the client. */}
      <button
        type="button"
        data-auto-toggle=""
        className="hub-auto-pp"
        aria-pressed={stopped}
        onClick={() => setStopped((s) => !s)}
      >
        {stopped ? 'Play' : 'Pause'}
      </button>
    </div>
  );
}
