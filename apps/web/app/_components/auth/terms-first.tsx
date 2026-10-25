'use client';

/**
 * TermsFirst — the sign-up card's ONE Terms box gates Google and Apple (owner 2026-10-22, Host 1 option B,
 * prototype `journey_fixes_2026-10-22.html`: "One tick, on the card — never a second screen"; and the same day,
 * "do both": the box moved to JUST ABOVE "Create user account", so the card reads choose how → agree → create).
 *
 * The box itself is plain markup on the page (`app/signup/page.tsx`): an unticked, `required` checkbox inside the
 * email form, so the email door posts it exactly as before. This wraps the Google / Apple row above it:
 *   • unticked → a press on a provider button goes nowhere; the box is scrolled into view, nudged, and says "Tick the
 *     Terms first"
 *     (the buttons are drawn dimmed by CSS while the box is empty — `home-reskin.css`, `[data-terms-first]`);
 *   • ticked → the tick is carried to the callback (`carrySignupTerms`, an httpOnly cookie set by the server from
 *     the posted tick), and THEN the press goes through, unchanged — the web form, the desktop loopback and the
 *     phone app's native sheet each run their own flow, byte-identical.
 *
 * 🔒 THE ROW'S OWN CODE IS NOT TOUCHED. The phone app's Apple sheet is in App Review: this sits OUTSIDE it, as a
 * capture-phase listener, so nothing inside the native flow changed to make room for the tick.
 *
 * Fails SAFE, never open: before hydration (or with the carry refused) a press simply runs the flow without the
 * tick carried, and the account meets the one-time re-ask (`needsTermsAgreement`) — the net for every door.
 */
import { useCallback, useEffect, useRef, type MouseEvent, type ReactNode } from 'react';
import { carrySignupTerms } from '@/app/auth/terms-carry-action';
import { TERMS_FIELD } from '@/lib/terms-agreement';

/** How long the box stays nudged after a press on an unticked door. */
const NUDGE_MS = 900;

/**
 * Is the box ticked? If not, nudge it and say so. If it is, carry the tick to the callback and resolve true.
 * Shared with the typed-Google-address door (`GoogleAddressDoor`), which is one more Google button on this card.
 */
export async function termsFirst(boxId: string): Promise<boolean> {
  const box = document.getElementById(boxId);
  if (!(box instanceof HTMLInputElement)) return false;
  if (!box.checked) {
    const label = box.closest('label');
    label?.setAttribute('data-terms-nudge', '');
    window.setTimeout(() => label?.removeAttribute('data-terms-nudge'), NUDGE_MS);
    const hint = document.getElementById(`${boxId}-hint`);
    if (hint) hint.hidden = false;
    // The box sits BELOW Google / Apple, just above "Create user account" (owner 2026-10-22, "do both"), so on a
    // phone it can be off screen when the press lands: bring it into view, then focus it without a second jump.
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    (label ?? box).scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
    box.focus({ preventScroll: true });
    return false;
  }
  // What the browser itself would post for this box: its value, only because it is ticked.
  const fd = new FormData();
  fd.set(TERMS_FIELD, box.value || 'on');
  await carrySignupTerms(fd).catch(() => undefined);
  return true;
}

export function TermsFirst({ boxId, children }: { boxId: string; children: ReactNode }) {
  /** The one press let through after the carry — a re-dispatch of the press the person made. */
  const passing = useRef(false);
  const busy = useRef(false);
  // The "Tick the Terms first" line goes the moment the box is ticked.
  useEffect(() => {
    const box = document.getElementById(boxId);
    const hint = document.getElementById(`${boxId}-hint`);
    if (!(box instanceof HTMLInputElement) || !hint) return;
    const onChange = () => {
      if (box.checked) hint.hidden = true;
    };
    box.addEventListener('change', onChange);
    return () => box.removeEventListener('change', onChange);
  }, [boxId]);
  const onClickCapture = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (passing.current) {
        passing.current = false;
        return;
      }
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      e.stopPropagation();
      if (busy.current) return;
      busy.current = true;
      void termsFirst(boxId).then((ok) => {
        busy.current = false;
        if (!ok) return;
        passing.current = true;
        btn.click();
      });
    },
    [boxId],
  );
  return (
    <div data-terms-first="" onClickCapture={onClickCapture}>
      {children}
    </div>
  );
}
