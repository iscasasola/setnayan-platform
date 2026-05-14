'use client';

import { type FormEvent, type ReactNode } from 'react';

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  message: string;
  className?: string;
  children: ReactNode;
};

// Tiny client wrapper that runs `window.confirm(message)` before the form
// submit reaches the server action. Cancel = preventDefault, no submit.
// Use for destructive actions that should never fire on accidental click.
export function ConfirmForm({ action, message, className, children }: Props) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm(message)) {
      event.preventDefault();
    }
  }
  return (
    <form action={action} onSubmit={handleSubmit} className={className}>
      {children}
    </form>
  );
}
