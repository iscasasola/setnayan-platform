'use client';

import { useFormStatus } from 'react-dom';
import { Loader2 } from 'lucide-react';

type Props = {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  /** Optional `aria-label` for screen readers when children is icon-only. */
  'aria-label'?: string;
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
      className={className}
      {...rest}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
