'use client';

import { useState, type FormEvent, type ReactNode } from 'react';

/**
 * "SIGN OUT OF THIS INVITATION" — legible, and never by accident.
 *
 * A guest's walk, 2026-10-11 (fault N13): the control was 12px text at 3.0:1
 * in the middle of the page, and ONE press of it signed the guest out — the
 * pass in this browser is gone, the face-tagging selfie is erased (owner
 * 2026-09-30), and the way back in is their own link or QR. A thumb scrolling
 * past it could do all of that.
 *
 * So the first press ASKS, in place, and says what it costs; the second press
 * signs out. "Stay" puts it back. No pop-up — the question is where the thumb
 * already is.
 *
 * It is the same POST to `/{slug}/sign-out` it always was (a link would be run
 * by a prefetch), and the ONE sign-out on the page (owner 2026-10-03, one
 * place per control). ⚠ With script off there is no first press to catch: the
 * button is a plain submit and signs out at once, exactly as it did before —
 * a guest is never left without a way to sign out.
 *
 * The line about the selfie (`erases`) is said BEFORE the first press, as the
 * owner ruled; it stays where it was.
 *
 * 🛡 app/[slug]/_components/the-sign-out-asks-first.test.ts
 */
export const SIGN_OUT_COSTS = 'You’ll need your invitation link or your QR to get back in.';

/** The first press asks; only a press made after the question goes through. */
export function signOutPress(asked: boolean): 'ask' | 'sign-out' {
  return asked ? 'sign-out' : 'ask';
}

export function SignOutOfInvitation({
  action,
  erases = null,
  children,
}: {
  /** `/{slug}/sign-out` — the POST route that clears this browser's guest pass. */
  action: string;
  /** The line said before the press when signing out erases something (the face-tagging selfie). */
  erases?: ReactNode;
  /** The control's words. */
  children: ReactNode;
}) {
  const [asked, setAsked] = useState(false);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (signOutPress(asked) === 'sign-out') return;
    event.preventDefault();
    setAsked(true);
  };
  return (
    <form action={action} method="post" onSubmit={onSubmit} data-sign-out="" data-asked={asked ? '1' : '0'}>
      {erases}
      {asked ? (
        <div role="group" aria-label="Sign out of this invitation?">
          <p className="mb-3 text-ink">{SIGN_OUT_COSTS}</p>
          <div className="flex items-center justify-center gap-3">
            <button type="button" onClick={() => setAsked(false)} className="button-secondary">
              Stay
            </button>
            <button type="submit" className="button-secondary">
              Sign out
            </button>
          </div>
        </div>
      ) : (
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center px-3 underline underline-offset-4 hover:text-ink"
        >
          {children}
        </button>
      )}
    </form>
  );
}
