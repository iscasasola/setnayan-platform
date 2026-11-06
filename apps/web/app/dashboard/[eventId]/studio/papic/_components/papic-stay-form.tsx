'use client';

import { useState, useTransition, type FormHTMLAttributes, type ReactNode } from 'react';
import { papicSaveInPlace } from '../in-place-actions';
import type { PapicDoor } from '../_lib/papic-in-place';

/**
 * 📍 A PAPIC FORM THAT SAVES IN PLACE (owner, live 2026-10-26: *"saving minimum and maximum on papic resets the whole
 * screen"* · *"when i turn of a challenge. it should just remove it … it jumped to a different page"*).
 *
 * The SAME form, the same fields, the same action — kept as `action` for a phone without JavaScript. With JavaScript
 * the submit is answered here: sent through `papicSaveInPlace(door)` (the same action, its redirect read as an answer),
 * so the page re-renders in place — never a navigation, never a jump to another page. The submit button's own pending
 * state still shows (React keeps `useFormStatus` for a prevented submit inside a transition). A refusal is said right
 * under the form, in the page's own words; the next press clears it.
 */
export function PapicStayForm({
  door,
  action,
  children,
  ...rest
}: { door: PapicDoor; action: (fd: FormData) => unknown; children: ReactNode } & Omit<FormHTMLAttributes<HTMLFormElement>, 'action' | 'onSubmit' | 'children'>) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <form
        {...rest}
        action={action as (fd: FormData) => void}
        data-papic-stay={door}
        aria-busy={pending || undefined}
        onSubmit={(e) => {
          e.preventDefault();
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
          const fd = new FormData(e.currentTarget, submitter ?? undefined);
          setError(null);
          start(async () => {
            const r = await papicSaveInPlace(door, fd).catch(() => ({ ok: false as const, error: 'We could not save that. Nothing changed — please try again.' }));
            if (!r.ok) setError(r.error);
          });
        }}
      >
        {children}
      </form>
      {error ? (
        <p role="alert" className="text-[12.5px] leading-snug text-terracotta-700" data-papic-stay-error={door}>
          {error}
        </p>
      ) : null}
    </>
  );
}
