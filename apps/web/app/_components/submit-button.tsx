'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

type Props = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'type' | 'disabled' | 'aria-busy'
> & {
  children: React.ReactNode;
  pendingLabel?: string;
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
  ...rest
}: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      data-pending={pending ? 'true' : undefined}
      className={`${className ?? ''} ${pending ? 'cursor-wait' : ''}`.trim()}
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
