'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

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
};

/**
 * Drop-in replacement for `<button type="submit">` inside a `<form action={…}>`.
 *
 * Hooks `useFormStatus` so the button:
 *   • Disables itself while the server action is pending — prevents double-click
 *     submissions that previously caused duplicate inserts.
 *   • Swaps its content for a spinner + pendingLabel during the action so the
 *     user has a clear "something is happening" signal between click and
 *     the redirect / revalidate landing.
 *   • Adds `data-pending="true"` and an explicit `cursor-wait` so the cursor
 *     changes immediately and the button is unmistakably "in progress" —
 *     not just a subtle opacity dip the user might miss.
 */
export function SubmitButton({
  children,
  className,
  pendingLabel = 'Working…',
  disabled = false,
  ...rest
}: Props) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;
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
