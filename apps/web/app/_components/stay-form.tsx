'use client';

import { createContext, useContext, useState, useTransition, type ComponentProps, type FormEvent, type FormHTMLAttributes, type ReactNode } from 'react';
import { saveInPlace } from '@/app/_actions/save-in-place';
import { COULD_NOT_SAVE, type StayResult } from '@/lib/save-in-place';
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
 *
 * 🧪 A LAB never reaches the door: `<StayDoorProvider value={stub}>` answers every press instead (`stub(door, fd,
 * action)` — run the lab's own stand-in `action`, answer saved / refused). Nothing in the app provides it, so the
 * app always saves through the real door.
 */
export type StayDoorFn = (door: StayDoor, fd: FormData, action?: (fd: FormData) => unknown) => Promise<StayResult>;
const realDoor: StayDoorFn = (door, fd) => saveInPlace(door, fd);
const StayDoorContext = createContext<StayDoorFn | null>(null);
export function StayDoorProvider({ value, children }: { value: StayDoorFn; children: ReactNode }) {
  return <StayDoorContext.Provider value={value}>{children}</StayDoorContext.Provider>;
}
/** The door a press goes through — the real one, or a lab's stub. For an imperative save (a sheet's Apply). The
 *  screen the press is on rides along (`stay_here`), so the door re-renders it too. */
export function useStayDoor(): StayDoorFn {
  const door = useContext(StayDoorContext) ?? realDoor;
  return (name, fd, action) => {
    if (typeof window !== 'undefined' && !fd.has('stay_here')) fd.set('stay_here', window.location.pathname);
    return door(name, fd, action).catch(() => ({ ok: false as const, error: COULD_NOT_SAVE }));
  };
}
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
  const stay = useStaySubmit(door, onSaved, action);
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
  const stay = useStaySubmit(door, onSaved, rest.action);
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
export function useStaySubmit(door: StayDoor, onSaved?: () => void, action?: (fd: FormData) => unknown) {
  const send = useStayDoor();
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter ?? undefined);
    setError(null);
    setSaid(null);
    start(async () => {
      const r = await send(door, fd, action);
      if (!r.ok) setError(r.error);
      else {
        if (r.said) setSaid(r.said);
        onSaved?.();
      }
    });
  };
  /* A refusal is said on the row; the area's own "done" words (`StayWords.saved`), when it has them, quietly too. */
  const refusal = error ? (
    <p role="alert" className="text-[12.5px] leading-snug text-terracotta-700" data-stay-error={door}>
      {error}
    </p>
  ) : said ? (
    <p role="status" className="text-[12.5px] leading-snug text-ink/60" data-stay-said={door}>
      {said}
    </p>
  ) : null;
  return { onSubmit, pending, refusal };
}
