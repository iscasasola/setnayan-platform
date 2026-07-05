'use client';

import { useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';
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
};

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
 */
export function SubmitButton({
  children,
  className,
  pendingLabel = 'Working…',
  disabled = false,
  overlay = true,
  overlaySteps,
  overlayHint,
  ...rest
}: Props) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;

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
      {...rest}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2
            aria-hidden
            className="h-4 w-4 animate-spin"
            strokeWidth={2.25}
          />
          {pendingLabel || <span className="sr-only">Working…</span>}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
