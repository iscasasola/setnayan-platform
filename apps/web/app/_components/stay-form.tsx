'use client';

import { useState, useTransition, type ComponentProps, type FormEvent, type FormHTMLAttributes, type ReactNode } from 'react';
import { saveInPlace } from '@/app/_actions/save-in-place';
import { COULD_NOT_SAVE } from '@/lib/save-in-place';
import { ConfirmForm } from './confirm-form';
import type { StayDoor } from '@/lib/stay-doors';

/**
 * 📍 A FORM THAT SAVES IN PLACE — app-wide (owner, 2026-10-26, DECISION_LOG "A SAVE NEVER RESETS THE SCREEN —
 * APP-WIDE": *"saving minimum and maximum on papic resets the whole screen. this should not happen"* · *"same to the
 * rest of the website. avoid resetting the whole screen"*).
 *
 *   <StayForm door="memories.setCaptureHidden" action={setCaptureHidden.bind(null, eventId)} onSaved={…}>
 *     …the same fields, the same submit button…
 *   </StayForm>
 *
 * The SAME form, the same fields, the same action — kept as `action` for a phone without JavaScript. With JavaScript
 * the submit is answered here: sent through `saveInPlace(door)` (`app/_actions/save-in-place.ts` — the same action, its
 * redirect read as an answer), so the page re-renders in place: the scroll stays, an open sheet stays open. The submit
 * button's own pending state still shows (React keeps `useFormStatus` for a prevented submit inside a transition). A
 * refusal is said right under the form, in the area's own words; the next press clears it. `onSaved` runs after a save
 * that landed (close a modal, collapse a confirm).
 *
 * `door` is a NAME from `lib/stay-doors.ts`, never a function — the server registry decides what runs.
 */
export function StayForm({
  door,
  action,
  onSaved,
  children,
  ...rest
}: {
  door: StayDoor;
  action: (fd: FormData) => unknown;
  onSaved?: () => void;
  children: ReactNode;
} & Omit<FormHTMLAttributes<HTMLFormElement>, 'action' | 'onSubmit' | 'children'>) {
  const stay = useStaySubmit(door, onSaved);
  return (
    <>
      <form {...rest} action={action as (fd: FormData) => void} data-stay={door} aria-busy={stay.pending || undefined} onSubmit={stay.onSubmit}>
        {children}
      </form>
      {stay.refusal}
    </>
  );
}

/**
 * A `ConfirmForm` (asks first — "Delete forever?") whose CONFIRMED press saves in place through `door`. Kept here, not
 * inside `ConfirmForm`, so the many screens that only confirm never import the door's registry.
 */
export function StayConfirmForm({
  door,
  onSaved,
  ...rest
}: { door: StayDoor; onSaved?: () => void } & Omit<ComponentProps<typeof ConfirmForm>, 'onConfirmedSubmit' | 'formProps'>) {
  const stay = useStaySubmit(door, onSaved);
  return (
    <>
      <ConfirmForm {...rest} onConfirmedSubmit={stay.onSubmit} formProps={{ 'data-stay': door, 'aria-busy': stay.pending || undefined }} />
      {stay.refusal}
    </>
  );
}

/**
 * The submit half of `StayForm`, for a form component that owns its own `<form>` (`StayConfirmForm`). `onSubmit` prevents the browser's submit and saves through the door; `refusal` is the line to draw under it.
 */
export function useStaySubmit(door: StayDoor, onSaved?: () => void) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter ?? undefined);
    setError(null);
    start(async () => {
      const r = await saveInPlace(door, fd).catch(() => ({ ok: false as const, error: COULD_NOT_SAVE }));
      if (!r.ok) setError(r.error);
      else onSaved?.();
    });
  };
  const refusal = error ? (
    <p role="alert" className="text-[12.5px] leading-snug text-terracotta-700" data-stay-error={door}>
      {error}
    </p>
  ) : null;
  return { onSubmit, pending, refusal };
}
