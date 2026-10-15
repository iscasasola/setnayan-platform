'use client';

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Info, TriangleAlert } from 'lucide-react';

/**
 * TOAST — A NOTIFICATION THAT PEEKS DOWN FROM THE TOP (`INTERACTION_RULES.md` § 9, kind 12 "Messages"; the approved
 * gallery `prototypes/control_templates_2026-10-08.html` § 12).
 *
 * Owner, 2026-10-08: *"pop up is like a notification. so it should peek from the top"* · on the first drawing: *"the
 * peek on the bottom of the screen saying deleted is not centered properly"* · on the ink-black "Saved":
 * *"teracota"*.
 *
 *   · WHERE: the top centre of the screen, under the safe area — its words centred, and READ IN FULL: one line, or
 *     two when one does not hold them (owner's approved prototype `maker_rsvp_add_drag_group_2026-10-09.html`, `#say`:
 *     a pill of up to 86 % of the screen whose sentence wraps). Never taller than two lines: a third is cut with "…".
 *     It was one line, cut — and the half that says what to DO was the half that was lost ("A screen takes up to 4
 *     added lines. Remov…", the walk of 2026-10-11, M13 · M14);
 *   · NEVER OVER THE TOP BAR'S BUTTONS: where the screen has a bar of its own at the very top (the Maker's
 *     ✕ · stage · Studio · ↺ · ✓ — `PEEK_TOAST_UNDER`), the toast peeks out from UNDER that bar (it sat over
 *     ↺ and ✓ for its three seconds). A screen with no such bar keeps the place it had;
 *   · A GOOD RESULT is the app's accent with a ✓ (`bg-sn-accent` / `text-sn-on-accent` — never a colour written here);
 *   · A FAILURE never looks like success: the house danger token darkened (the app's red sits close to the
 *     terracotta, so colour alone is never the sign), a warning mark, the words that say what failed, and — where the
 *     caller can do it again — "Try again";
 *   · A NOTE is neither: something the person should know that is not a result ("Nothing to change here — edit it
 *     in Studio."). White with a hairline and ink words — the second button's look — and an ⓘ, so it is never read
 *     as "done" (the accent with a ✓) nor as a fault. ⚠ The approved gallery draws the two results only; this third
 *     look is the controller's reading, kept apart from both, awaiting the owner's look;
 *   · IT LEAVES BY ITSELF (`PEEK_TOAST_MS`: 2.2 s, 4.2 s for a failure) and tells the caller (`onGone`);
 *   · IT NEVER DARKENS THE PAGE and takes no tap of its own — the person keeps working. Only "Try again" is pressable
 *     — and, where the caller hands one over, ONE action (`action`: "Undo"), a small pill at the right of the toast;
 *   · MOTION: it slides down with the family's spring, at a share of the family's one speed (`--sn-pill-dur`), and
 *     slides back up. Under "reduce motion" it is simply there, then gone.
 *
 * 🔙 AN ACTION (`action`, owner 2026-10-09, the guest list's "Removed Maria — Undo"): the toast stays `PEEK_TOAST_ACTION_MS`
 * (6 s — long enough to read it and reach it, and the removal's own undo window), draws the action as a small pill inside
 * it at the right, takes a tap on THAT pill only (the rest of the toast still takes none), and is announced as a polite
 * live region. With no `action` the toast is exactly what it was, byte for byte.
 *
 * ONE DRAWING. A screen never draws its own strip: it renders `<PeekToast>` while it has something to say.
 * (`ToastProvider` / `useToast` beside this file is the older toast — a bordered row at the BOTTOM of the screen,
 * called from ~35 files. It adopts this drawing in the app-wide sweep; until then a screen that moves onto the
 * templates renders this one.)
 *
 * No request, no timer but its own leaving. Guard: `lib/the-toast-peeks-from-the-top.test.ts`.
 */

export type PeekToastTone = 'ok' | 'bad' | 'note';

/** How long a toast stays before it leaves — the approved gallery's own figures. */
export const PEEK_TOAST_MS: Readonly<Record<PeekToastTone, number>> = { ok: 2200, bad: 4200, note: 3200 };
/** How long a toast that carries an ACTION stays — the removal's undo window, and the time to reach the pill. */
export const PEEK_TOAST_ACTION_MS = 6000;
/** The room the slide back up is given before the caller is told it has gone. */
export const PEEK_TOAST_LEAVE_MS = 420;
/** The slide's share of the family's one speed (the gallery's 120 of the pill's 230). */
export const PEEK_TOAST_SLIDE = 'transform calc(var(--sn-pill-dur) * 0.52) var(--sn-pill-spring)';

/** Where it sits: top centre, under the safe area, over everything (it is a notification), taking no tap. */
export const PEEK_TOAST_PLACE = 'pointer-events-none fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-[100] flex justify-center px-3';
/** The pill: 48 px with one line of words — and as tall as two lines need, never more. Its words are centred. */
export const PEEK_TOAST_PILL =
  'flex min-h-12 max-w-full items-center justify-center gap-3 rounded-full px-[22px] py-1.5 text-center text-[14px] font-medium leading-[1.25] shadow-[0_14px_30px_-12px_rgba(0,0,0,.5)] motion-reduce:!transition-none';
/** The words: the whole sentence on one line or two (balanced, so two lines are two halves); a third line is cut. */
export const PEEK_TOAST_WORDS = 'min-w-0 line-clamp-2 [text-wrap:balance]';
/**
 * A screen's OWN top bar — the toast sits under it, never over its buttons. Today: the Maker's toolbar. A screen that
 * grows a bar of its own at the very top marks it `data-peek-toast-under` and the toast follows.
 */
export const PEEK_TOAST_UNDER = '[data-maker-toolbar], [data-peek-toast-under]';
/** The gap between that bar and the toast. */
export const PEEK_TOAST_UNDER_GAP = 8;

/**
 * Where the screen's own top bar ends (0 = it has none): the lowest bottom edge of a marked bar that is DRAWN, starts
 * at the top of the screen and is a bar (not a sheet that happens to start there). Read once, as the toast is drawn.
 */
export function peekToastUnder(doc: Pick<Document, 'querySelectorAll'>): number {
  let bottom = 0;
  doc.querySelectorAll(PEEK_TOAST_UNDER).forEach((el) => {
    const r = (el as Element).getBoundingClientRect();
    if (r.height > 0 && r.top <= 8 && r.bottom <= 160) bottom = Math.max(bottom, r.bottom);
  });
  return Math.round(bottom);
}
/** The two looks — the accent for a good result; the danger token, darkened, for a failure. In dark (PR 4, 2026-10-13) the
 *  note and the small pills are the approved card (`dark:bg-raised`, the template's `--surf`) — white with dark-mode ink
 *  was white on white — and the failure's words are the page's ink (cream turns dark there). */
export const PEEK_TOAST_TONE: Readonly<Record<PeekToastTone, string>> = {
  ok: 'bg-sn-accent text-sn-on-accent',
  bad: 'bg-[color-mix(in_srgb,rgb(var(--color-danger))_68%,black)] !pl-[18px] !pr-2 text-cream dark:text-ink',
  note: 'bg-white text-ink ring-1 ring-inset ring-ink/15 dark:bg-raised',
};

export type PeekToastAction = { label: string; onPress: () => void };

export function PeekToast({
  tone = 'ok',
  children,
  onGone,
  onRetry,
  data,
  action,
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
  /** One action drawn as a small pill at the right ("Undo"): the toast then stays 6 s and that pill takes a tap. */
  action?: PeekToastAction;
}) {
  /* Mounted above the screen, then let down a frame later — so the slide is seen. */
  const [down, setDown] = useState(false);
  /* Where this screen's own top bar ends — read before the first paint in the browser, so the toast never lands on it. */
  const [under, setUnder] = useState(0);
  useLayoutEffect(() => setUnder(peekToastUnder(document)), []);
  /* The caller's latest `onGone`, without restarting the toast's life when its parent re-renders. */
  const gone = useRef(onGone);
  gone.current = onGone;
  const hasAction = Boolean(action);
  useEffect(() => {
    const life = hasAction ? PEEK_TOAST_ACTION_MS : PEEK_TOAST_MS[tone];
    const raf = window.requestAnimationFrame(() => setDown(true));
    const leave = window.setTimeout(() => setDown(false), life);
    /* Gone once it has slid back up (the slide is under half a second). */
    const left = window.setTimeout(() => gone.current?.(), life + PEEK_TOAST_LEAVE_MS);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(leave);
      window.clearTimeout(left);
    };
  }, [tone, hasAction]);
  const Mark = tone === 'bad' ? TriangleAlert : tone === 'note' ? Info : Check;
  return (
    <div data-peek-toast={data ?? ''} data-tone={tone} className={PEEK_TOAST_PLACE} style={under > 0 ? { top: under + PEEK_TOAST_UNDER_GAP } : undefined}>
      <div
        role={tone === 'bad' ? 'alert' : 'status'}
        aria-live={action ? 'polite' : undefined}
        data-down={down}
        /* Up, it is wholly above the screen — from under a top bar too (`under` is 0 where there is none). */
        style={{ transform: down ? 'translateY(0)' : `translateY(calc(-100% - ${under > 0 ? `${under + PEEK_TOAST_UNDER_GAP}px` : '12px - env(safe-area-inset-top)'} - 24px))`, transition: PEEK_TOAST_SLIDE }}
        className={`${PEEK_TOAST_PILL} ${PEEK_TOAST_TONE[tone]}${action ? ' !pl-[18px] !pr-2' : ''}`}
      >
        <Mark aria-hidden className="h-[18px] w-[18px] flex-none" strokeWidth={2.4} />
        <span className={PEEK_TOAST_WORDS}>{children}</span>
        {action ? (
          <button type="button" onClick={action.onPress} data-peek-toast-action="" className="sn-press sn-hit pointer-events-auto inline-flex !h-[34px] !min-h-0 flex-none items-center rounded-full bg-white px-3.5 text-[13px] font-bold text-ink dark:bg-raised">
            {action.label}
          </button>
        ) : null}
        {tone === 'bad' && onRetry ? (
          <button type="button" onClick={onRetry} data-peek-toast-retry="" className="sn-press sn-hit pointer-events-auto inline-flex !h-[34px] !min-h-0 flex-none items-center rounded-full bg-white px-3.5 text-[13px] font-bold text-ink dark:bg-raised">
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}
