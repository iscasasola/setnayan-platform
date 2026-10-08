'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, TriangleAlert } from 'lucide-react';

/**
 * TOAST — A NOTIFICATION THAT PEEKS DOWN FROM THE TOP (`INTERACTION_RULES.md` § 9, kind 12 "Messages"; the approved
 * gallery `prototypes/control_templates_2026-10-08.html` § 12).
 *
 * Owner, 2026-10-08: *"pop up is like a notification. so it should peek from the top"* · on the first drawing: *"the
 * peek on the bottom of the screen saying deleted is not centered properly"* · on the ink-black "Saved":
 * *"teracota"*.
 *
 *   · WHERE: the top centre of the screen, under the safe area — its words centred, one line, cut with "…";
 *   · A GOOD RESULT is the app's accent with a ✓ (`bg-sn-accent` / `text-sn-on-accent` — never a colour written here);
 *   · A FAILURE never looks like success: the house danger token darkened (the app's red sits close to the
 *     terracotta, so colour alone is never the sign), a warning mark, the words that say what failed, and — where the
 *     caller can do it again — "Try again";
 *   · IT LEAVES BY ITSELF (`PEEK_TOAST_MS`: 2.2 s, 4.2 s for a failure) and tells the caller (`onGone`);
 *   · IT NEVER DARKENS THE PAGE and takes no tap of its own — the person keeps working. Only "Try again" is pressable;
 *   · MOTION: it slides down with the family's spring, at a share of the family's one speed (`--sn-pill-dur`), and
 *     slides back up. Under "reduce motion" it is simply there, then gone.
 *
 * ONE DRAWING. A screen never draws its own strip: it renders `<PeekToast>` while it has something to say.
 * (`ToastProvider` / `useToast` beside this file is the older toast — a bordered row at the BOTTOM of the screen,
 * called from ~35 files. It adopts this drawing in the app-wide sweep; until then a screen that moves onto the
 * templates renders this one.)
 *
 * No request, no timer but its own leaving. Guard: `lib/the-toast-peeks-from-the-top.test.ts`.
 */

export type PeekToastTone = 'ok' | 'bad';

/** How long a toast stays before it leaves — the approved gallery's own figures. */
export const PEEK_TOAST_MS: Readonly<Record<PeekToastTone, number>> = { ok: 2200, bad: 4200 };
/** The room the slide back up is given before the caller is told it has gone. */
export const PEEK_TOAST_LEAVE_MS = 420;
/** The slide's share of the family's one speed (the gallery's 120 of the pill's 230). */
export const PEEK_TOAST_SLIDE = 'transform calc(var(--sn-pill-dur) * 0.52) var(--sn-pill-spring)';

/** Where it sits: top centre, under the safe area, over everything (it is a notification), taking no tap. */
export const PEEK_TOAST_PLACE = 'pointer-events-none fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-[100] flex justify-center px-3';
/** The pill: 48 px, its words centred on one line. */
export const PEEK_TOAST_PILL =
  'flex h-12 max-w-full items-center justify-center gap-3 rounded-full px-[22px] text-center text-[14px] font-medium shadow-[0_14px_30px_-12px_rgba(0,0,0,.5)] motion-reduce:!transition-none';
/** The two looks — the accent for a good result; the danger token, darkened, for a failure. */
export const PEEK_TOAST_TONE: Readonly<Record<PeekToastTone, string>> = {
  ok: 'bg-sn-accent text-sn-on-accent',
  bad: 'bg-[color-mix(in_srgb,rgb(var(--color-danger))_68%,black)] !pl-[18px] !pr-2 text-cream',
};

export function PeekToast({
  tone = 'ok',
  children,
  onGone,
  onRetry,
  data,
}: {
  tone?: PeekToastTone;
  /** What happened — one short line. */
  children: ReactNode;
  /** It has left by itself: the caller forgets the message. */
  onGone?: () => void;
  /** A failure the person can try again: draws "Try again" (and only then takes a tap). */
  onRetry?: () => void;
  /** `data-peek-toast="<data>"`. */
  data?: string;
}) {
  /* Mounted above the screen, then let down a frame later — so the slide is seen. */
  const [down, setDown] = useState(false);
  /* The caller's latest `onGone`, without restarting the toast's life when its parent re-renders. */
  const gone = useRef(onGone);
  gone.current = onGone;
  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setDown(true));
    const leave = window.setTimeout(() => setDown(false), PEEK_TOAST_MS[tone]);
    /* Gone once it has slid back up (the slide is under half a second). */
    const left = window.setTimeout(() => gone.current?.(), PEEK_TOAST_MS[tone] + PEEK_TOAST_LEAVE_MS);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(leave);
      window.clearTimeout(left);
    };
  }, [tone]);
  const Mark = tone === 'bad' ? TriangleAlert : Check;
  return (
    <div data-peek-toast={data ?? ''} data-tone={tone} className={PEEK_TOAST_PLACE}>
      <div
        role={tone === 'bad' ? 'alert' : 'status'}
        data-down={down}
        style={{ transform: down ? 'translateY(0)' : 'translateY(calc(-100% - 12px - env(safe-area-inset-top) - 24px))', transition: PEEK_TOAST_SLIDE }}
        className={`${PEEK_TOAST_PILL} ${PEEK_TOAST_TONE[tone]}`}
      >
        <Mark aria-hidden className="h-[18px] w-[18px] flex-none" strokeWidth={2.4} />
        <span className="min-w-0 truncate">{children}</span>
        {tone === 'bad' && onRetry ? (
          <button type="button" onClick={onRetry} data-peek-toast-retry="" className="sn-press pointer-events-auto inline-flex !h-[34px] !min-h-0 flex-none items-center rounded-full bg-white px-3.5 text-[13px] font-bold text-ink">
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
