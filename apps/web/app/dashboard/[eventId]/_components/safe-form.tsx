'use client';

import { useCallback, useRef, useState, type ComponentPropsWithoutRef, type Ref } from 'react';
import { announceMakerSave } from '@/lib/maker-save-status';
import { FORM_NOT_SAVED, guardFormAction, keepWhatWasTyped } from '@/lib/safe-form';

/**
 * 🧷 A FORM WHOSE POST NEVER ANSWERED KEEPS THE SCREEN AND WHAT WAS TYPED.
 *
 * Owner, 2026-10-11: *"make sure requests does not cause a crash"*. `<form action={serverAction}>` is run by React
 * inside a transition of its own. When the request never answers (no signal, a 5xx, the daily database stall) the
 * action REJECTS, React rethrows it while rendering, and `app/error.tsx` replaces the whole Maker — the form, and
 * the paragraph just typed into it, go with the screen. There is no `await` in our source to wrap, so the presses
 * guard (`lib/a-failed-press-never-replaces-the-maker.test.ts`) could not see these: 64 forms under `launch/` and
 * `website/` were bare.
 *
 * This is `<form>`, with the action wrapped — nothing else. React still dispatches it natively, so:
 *   · a post that ANSWERS behaves exactly as before — `useFormStatus` still reports pending, the Maker's submit
 *     capture (`maker-shell.tsx`) still points the form back at the page it is on, a redirect still redirects
 *     (`isNextControlFlow` lets Next's own signals through untouched), and React still resets the fields to what
 *     the server sends back;
 *   · a post that NEVER ANSWERED is caught. It is SAID — one line inside the form (`role="alert"`) and the Maker's
 *     own status line (`announceMakerSave`, heard only where a Maker toolbar is mounted) — and the fields are KEPT:
 *     React resets a form whose action returned, so the one `reset` that follows is cancelled
 *     (`keepWhatWasTyped`). Every box, tick, pick and chosen file is still there; Save is still there.
 *
 * ⚠ What it does not do: it cannot tell a request that never LEFT from one whose ANSWER was lost — the save may
 * have landed. The line says "did not save" because that is what the person must act on (look, then press again);
 * every form here writes the value it shows, so pressing again is the same write, not a second one.
 * A submitter's own `formAction` is NOT wrapped (React hands it to the button, not the form).
 *
 * Usable from a server component: `action` may be a server action reference (bound or not).
 * 🛡 lib/a-bare-form-post-never-replaces-the-maker.test.ts.
 */
type FormAction = (formData: FormData) => void | Promise<unknown>;

export function SafeForm({
  action,
  children,
  ref,
  ...rest
}: Omit<ComponentPropsWithoutRef<'form'>, 'action'> & { action: FormAction; ref?: Ref<HTMLFormElement> }) {
  const own = useRef<HTMLFormElement | null>(null);
  const [failed, setFailed] = useState(false);
  const guarded = useCallback(
    (formData: FormData) => {
      setFailed(false);
      return guardFormAction(action, () => {
        keepWhatWasTyped(own.current);
        setFailed(true);
        announceMakerSave({ state: 'error', text: FORM_NOT_SAVED });
      })(formData);
    },
    [action],
  );
  const setRef = useCallback(
    (node: HTMLFormElement | null) => {
      own.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );
  return (
    <form {...rest} ref={setRef} action={guarded}>
      {children}
      {failed ? (
        <p role="alert" data-form-not-saved="" className="basis-full pt-1 text-xs font-medium text-terracotta-700">
          {FORM_NOT_SAVED}
        </p>
      ) : null}
    </form>
  );
}
