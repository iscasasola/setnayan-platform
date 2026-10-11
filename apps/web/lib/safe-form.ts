/**
 * safe-form.ts — the decisions inside `SafeForm` (`app/dashboard/[eventId]/_components/safe-form.tsx`), kept pure so
 * they can be RUN by a test instead of read.
 * 🛡 lib/a-bare-form-post-never-replaces-the-maker.test.ts.
 */

/** What a form says when its post never answered. Already the app's words for it (the governed rows, the address). */
export const FORM_NOT_SAVED = 'That did not save. Please try again.';

/**
 * Is this thrown value Next's own control flow — a redirect, a not-found, an auth interrupt — rather than a failure?
 * A server action that ends in `redirect()` REJECTS on the client with one of these, by design: the router has
 * already been told where to go, and the rejection is how the calling code stops. Swallowing it would report a
 * successful save as "did not save". So these are always rethrown, untouched.
 * (Next marks them with a `digest` that starts with the signal's name; the message carries it too in older shapes.)
 */
export function isNextControlFlow(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { digest?: unknown; message?: unknown };
  const mark = `${typeof e.digest === 'string' ? e.digest : ''} ${typeof e.message === 'string' ? e.message : ''}`;
  return /(?:^|\s)(?:NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK)\b/.test(mark);
}

/**
 * Wrap a form's action so a failure is ANSWERED instead of thrown into React's transition: the action's own result
 * when it answers; Next's control flow rethrown untouched; anything else handed to `onFailed` and swallowed.
 */
export function guardFormAction(
  action: (formData: FormData) => void | Promise<unknown>,
  onFailed: (error: unknown) => void,
): (formData: FormData) => Promise<void> {
  return async (formData) => {
    try {
      await action(formData);
    } catch (e) {
      if (isNextControlFlow(e)) throw e;
      onFailed(e);
    }
  };
}

/** How long the kept-fields guard stays armed. React resets within the commit that follows the action; this is slack. */
export const KEEP_TYPED_MS = 3000;

type ResetTarget = Pick<HTMLFormElement, 'addEventListener' | 'removeEventListener'>;

/**
 * Keep what is in a form's fields through the ONE reset that follows a form action. React resets a form
 * (`form.reset()`) when its action returns; a caught failure returns, so the paragraph just typed would be wiped by
 * the very code that stopped the crash. `reset` is a cancelable event — cancelled, the fields stay exactly as they
 * are (file inputs too). One shot: it disarms on that reset, or after `KEEP_TYPED_MS`, so a reset the person asks
 * for later is never blocked. Returns the disarm, for a caller (or a test) that wants it early.
 */
export function keepWhatWasTyped(
  form: ResetTarget | null,
  timers: { set: (fn: () => void, ms: number) => unknown; clear: (t: unknown) => void } = {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
  },
): () => void {
  if (!form) return () => {};
  let timer: unknown = null;
  const disarm = () => {
    form.removeEventListener('reset', onReset);
    if (timer !== null) timers.clear(timer);
    timer = null;
  };
  const onReset = (e: Event) => {
    e.preventDefault();
    disarm();
  };
  form.addEventListener('reset', onReset);
  timer = timers.set(disarm, KEEP_TYPED_MS);
  return disarm;
}
