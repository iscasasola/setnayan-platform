'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { PasswordField } from '@/app/_components/password-field';
import { SubmitButton } from '@/app/_components/submit-button';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
import { signInInPlace } from '@/app/login/actions';
import { SIGN_IN_IN_PLACE_INITIAL } from '@/app/login/_components/sign-in-state';

/**
 * "That email already has an account" → sign in RIGHT HERE (owner, the 2026-11-06 gate walk: *"what if they already
 * have a user account… can we detect it here?"*). Step 3's email box turns into a sign-in — the email filled, a
 * password, Google / Apple beside it — and what was typed on the four steps stays, because nothing navigates: this
 * is the shipped in-place sign-in (`signInInPlace`, the seam the sign-in popup uses), and success only refreshes the
 * server half of the page. Then the wizard goes on to "Open my shop".
 *
 * 🔒 It is only ever shown AFTER a submit was refused with "taken" (`?taken=1`) — never checked while typing, which
 * would tell anybody which addresses have accounts.
 */
export function TakenSignIn({ email, onSignedIn }: { email: string; onSignedIn: () => void }) {
  const router = useRouter();
  const [state, submit] = useActionState(signInInPlace, SIGN_IN_IN_PLACE_INITIAL);
  useEffect(() => {
    // Success is the action's answer, never the click.
    if (state.attempt > 0 && state.ok) {
      onSignedIn();
      // one-render: keep (auth) — the session changed; the server half must be read with it, the typing kept.
      router.refresh();
    }
  }, [state.attempt, state.ok, onSignedIn, router]);
  return (
    <form action={submit} className="space-y-3" data-open-shop-taken="">
      <input type="hidden" name="next" value="/open-shop" />
      <input type="hidden" name="remember" value="on" />
      <TurnstileField action="login" />
      <p className="text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
        This email already has a Setnayan account. Sign in to keep going — what you typed stays.
      </p>
      {state.error ? (
        <p className="text-xs" style={{ color: 'var(--m-orange-deep)' }} role="alert">
          {state.error}
        </p>
      ) : null}
      <label className="block space-y-1">
        <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
          Email
        </span>
        <input // field-ok: the in-place sign-in's own email box (SignInCard's shape), not a typed fact of the shop.
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={email}
          className="input-field"
        />
      </label>
      <label className="block space-y-1">
        <span className="block text-sm font-medium" style={{ color: 'var(--m-ink)' }}>
          Password
        </span>
        {/* The shared box with the eye (#7038) — every password box in the app is this one component. */}
        <PasswordField name="password" autoComplete="current-password" className="input-field" autoFocus />
      </label>
      <SubmitButton
        className="button-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-sm"
        pendingLabel="Signing in…"
        overlay={false}
      >
        Sign in and keep going
      </SubmitButton>
    </form>
  );
}
