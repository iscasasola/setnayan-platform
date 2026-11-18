'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check, Loader2 } from 'lucide-react';
import { LOADER_STEPS, useOptionalLoader } from '@/components/sd-loader';

type Props = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'aria-busy'
> & {
  children: React.ReactNode;
  pendingLabel?: string;
  /**
   * External disable signal. Task #44 (2026-05-22) — required-field gating
   * on the create-event form needs to keep Save disabled until a ceremony
   * type is picked. The button is ALWAYS disabled while pending (regardless
   * of this value); this flag adds an additional reason to disable.
   */
  disabled?: boolean;
  /**
   * Raise the app-wide "no touch until saving is complete" veil while the form
   * action runs (owner 2026-07-05, Rule 2). ON by default — every form save
   * gets the branded blocking overlay. Set `overlay={false}` for lightweight
   * inline submits where a full-screen veil is overkill (search, add-a-row,
   * tiny toggles). The veil hides when the action resolves; actions that
   * redirect keep it up until the destination's screen loader takes over.
   */
  overlay?: boolean;
  /** Override the veil's narration lines (default: LOADER_STEPS.saving). */
  overlaySteps?: readonly string[];
  /** Override the veil's uppercase sublabel (default: 'Saving'). */
  overlayHint?: string;
  /**
   * The pending state, when the FORM'S OWNER holds it instead of React's form
   * status (2026-10-11). Omitted — every form but one — the button reads
   * `useFormStatus()` exactly as before.
   *
   * WHY IT EXISTS: a form whose send must END ON A TIME LIMIT cannot use the
   * form status. That status is tied to the whole async action — including
   * Next's own request — so while a request simply never answers, the button
   * stays disabled and the veil stays up, whatever the form decides. Measured
   * in a browser on the reply card: the "not sent" line appeared at 20 s and
   * the veil was still over it. The reply card's form (`ReplyForm`,
   * app/[slug]/_components/reply-form.tsx) holds its own state and passes it
   * here.
   */
  pending?: boolean;
  /**
   * ✓ DONE (the motion standard, owner 18 Nov 2026 — § 4 #14 · #35: "✓ pops Quick 200 ms, stays 1 s"). The form's
   * owner says the save LANDED (`done` turns true — its action state came back ok) and the button shows "✓ Saved" for
   * `DONE_HOLD_MS`, then its own words again. It is never inferred from "no longer pending": a form status cannot
   * tell a save that landed from one that was refused, and a refused save must never read as saved. Omitted — every
   * form today — the button is exactly as it was.
   */
  done?: boolean;
  /** The words beside the ✓ (default "Saved"). */
  doneLabel?: string;
};

/** How long "✓ Saved" stays on the button before its own words return. */
export const DONE_HOLD_MS = 1000;

/**
 * Drop-in replacement for `<button type="submit">` inside a `<form action={…}>`.
 *
 * Hooks `useFormStatus` so the button:
 *   • Disables itself while the server action is pending — prevents double-click
 *     submissions that previously caused duplicate inserts.
 *   • Swaps its content for a spinner + pendingLabel during the action.
 *   • Adds `data-pending="true"` + `cursor-wait`.
 *   • Raises the shared no-touch veil (useOptionalLoader) for the duration of
 *     the save, so the whole screen is locked — not just the button — while the
 *     write is in flight. This is the form-side of the app's Rule 2; the client-
 *     handler side is `useSaveLoader()`. Opt out per-form with `overlay={false}`.
 *
 * 🎞 BUSY (the motion standard, owner 18 Nov 2026 — § 4 #35; "the saving veil stays … quick inline saves keep
 * `overlay={false}`"): the label gives way to the spinner in Tap on Settle (`.sn-m-busy`, an `@starting-style`
 * entrance — no remount trick), and the button KEEPS ITS SIZE: the width it had when it was pressed is held as a
 * floor while it is busy, so a shorter "Saving…" never makes it jump narrower. The veil is unchanged and still sits
 * over it. Reduced motion: the swap is at once (the spinner keeps turning — it carries meaning).
 * 🔒 lib/the-motion-core-moves-by-transform.test.ts
 */
export function SubmitButton({
  children,
  className,
  pendingLabel = 'Working…',
  disabled = false,
  overlay = true,
  overlaySteps,
  overlayHint,
  pending: ownedPending,
  done = false,
  doneLabel = 'Saved',
  onClick,
  style,
  ...rest
}: Props) {
  const { pending: formPending } = useFormStatus();
  const pending = ownedPending ?? formPending;
  const isDisabled = pending || disabled;

  // The width at the press — the button's floor while it is busy (and while ✓ shows), so it never jumps narrower.
  const pressedWidth = useRef<number | null>(null);
  // ✓ for DONE_HOLD_MS each time the owner says the save landed.
  const [showDone, setShowDone] = useState(false);
  useEffect(() => {
    if (!done) {
      setShowDone(false);
      return;
    }
    setShowDone(true);
    const t = setTimeout(() => setShowDone(false), DONE_HOLD_MS);
    return () => clearTimeout(t);
  }, [done]);
  const settled = showDone && !pending;
  const floor = (pending || settled) && pressedWidth.current ? pressedWidth.current : undefined;

  // Bridge form-pending → the app-wide no-touch veil. Non-throwing accessor so
  // a SubmitButton rendered outside the provider (tests) simply no-ops. Steps/
  // hint are read via refs so passing inline arrays doesn't restart narration.
  const loader = useOptionalLoader();
  const stepsRef = useRef(overlaySteps);
  stepsRef.current = overlaySteps;
  const hintRef = useRef(overlayHint);
  hintRef.current = overlayHint;

  useEffect(() => {
    if (!overlay || !loader) return;
    if (pending) {
      loader.show({
        steps: stepsRef.current ?? LOADER_STEPS.saving,
        hint: hintRef.current ?? 'Saving',
      });
    } else {
      // Pending fell false — the action resolved in place (a redirect instead
      // unmounts this button, and the cleanup below hides the veil then).
      loader.hide();
    }
  }, [pending, overlay, loader]);

  // Hide on unmount — covers the post-submit navigation for actions that
  // redirect (the veil bridges into the destination's screen loader).
  useEffect(
    () => () => {
      if (overlay) loader?.hide();
    },
    [overlay, loader],
  );

  return (
    <button
      type="submit"
      disabled={isDisabled}
      aria-busy={pending}
      data-pending={pending ? 'true' : undefined}
      className={`${className ?? ''} ${pending ? 'cursor-wait' : ''} ${disabled && !pending ? 'opacity-50 cursor-not-allowed' : ''}`.trim()}
      style={floor ? { ...style, minWidth: floor } : style}
      onClick={(e) => {
        pressedWidth.current = e.currentTarget.offsetWidth;
        onClick?.(e);
      }}
      {...rest}
    >
      {pending ? (
        <span className="sn-m-busy inline-flex items-center gap-2" data-busy="">
          <Loader2
            aria-hidden
            className="h-4 w-4 animate-spin"
            strokeWidth={2.25}
          />
          {pendingLabel || <span className="sr-only">Working…</span>}
        </span>
      ) : settled ? (
        <span className="sn-m-done inline-flex items-center gap-2" data-done="">
          <Check aria-hidden className="h-4 w-4" strokeWidth={2.5} />
          {doneLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
