'use client';

/**
 * guest-card-autosave.tsx — the guest card saves itself. There is no Save button.
 *
 * ── The one rule that shaped this file ──────────────────────────────────────
 * ONE WRITER. Autosave submits the SAME `<form>` to the SAME `updateGuest`
 * server action the standalone route always used, with the same full FormData
 * contract. It is not a second, lighter write path — so a field that autosaves
 * gets the identical validation, the identical singleton-role checks, the
 * identical FaceBlock re-bake and plus-one sync. A per-field endpoint would
 * have been less code and a second source of truth for every column.
 *
 * ── Why the action goes quiet ───────────────────────────────────────────────
 * `updateGuest` ends in `redirect()`. A redirect on every keystroke-pause
 * remounts the form and throws away the caret, so the card posts `quiet=1`,
 * and on SUCCESS the action revalidates and returns instead of redirecting —
 * the panel stays put and the caret with it. Errors still redirect, because an
 * error has to be SEEN; losing focus to show it is the right trade.
 *
 * ── Destructive actions are not autosaved ───────────────────────────────────
 * Remove guest and Take this seat back keep their own explicit submits. An
 * edit that saves itself is a convenience; a delete that saves itself is a
 * defect.
 */

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Check } from 'lucide-react';

/** Pause after the last change before the form posts. Long enough that typing a
 *  name is one write, short enough that it feels immediate. */
const DEBOUNCE_MS = 700;

export function AutosaveForm({
  action,
  returnTo,
  className,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  /** Where `updateGuest` should send an ERROR back to — the surface the card is
   *  open on, so a failed save lands on the card and not on some other page.
   *  The action validates it stays inside this event's guest routes. */
  returnTo: string;
  className?: string;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const schedule = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      // requestSubmit (not submit) so React's action handler runs and the
      // form's own validity check still applies.
      formRef.current?.requestSubmit();
    }, DEBOUNCE_MS);
  };

  return (
    <form
      ref={formRef}
      action={action}
      className={className}
      // `change` covers selects, checkboxes and radios; `input` covers typing.
      onChange={schedule}
      onInput={schedule}
    >
      <input type="hidden" name="quiet" value="1" />
      <input type="hidden" name="return_to" value={returnTo} />
      {children}
    </form>
  );
}

/**
 * The save state, in the card header. Lives inside the form so `useFormStatus`
 * can see it. Says nothing at rest — a permanent "Saved" badge on a card nobody
 * has touched is a claim about an event that did not happen.
 */
export function AutosaveState() {
  const { pending } = useFormStatus();
  const [justSaved, setJustSaved] = useState(false);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      setJustSaved(true);
      const t = setTimeout(() => setJustSaved(false), 2200);
      wasPending.current = pending;
      return () => clearTimeout(t);
    }
    wasPending.current = pending;
  }, [pending]);

  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex min-h-[1.25rem] items-center gap-1 text-xs text-ink/55"
    >
      {pending ? (
        'Saving…'
      ) : justSaved ? (
        <>
          <Check aria-hidden className="h-3.5 w-3.5 text-success-700" strokeWidth={2.5} />
          <span className="text-success-800">Saved</span>
        </>
      ) : null}
    </span>
  );
}
