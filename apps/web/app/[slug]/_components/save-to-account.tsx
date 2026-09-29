import Link from 'next/link';
import type { ReactNode } from 'react';
import { signInWithApple, signInWithGoogle } from '@/app/auth/oauth-actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { envFlagEnabled } from '@/lib/env-flag';
import {
  saveMethodFor,
  saveMethodLine,
  type GuestAccountState,
  type SaveMethod,
} from '@/lib/guest-one-path';
import { INVITE_RETURN } from '@/lib/invite-arrival';
import { TERMS_FIELD } from '@/lib/terms-agreement';
import { claimAccountAction, linkThisSeatAction } from '../actions';

/**
 * "SAVE TO MY ACCOUNT" — ONE button; the method is chosen by the device and
 * never shown as a choice (owner 2026-09-26, "THE GUEST PATHWAY — ONE BUTTON AT
 * A TIME"; reachable from the thank-you, Me, and on the day — owner 2026-09-27).
 *
 *   offer          → the device's method (`saveMethodFor`):
 *                      in-app webview → the emailed link (`claimAccountAction`)
 *                      iPhone → Apple · Android / desktop → Google
 *                    both providers return through `/join/{eventId}/connect`,
 *                    which binds this seat to the account and opens the event;
 *   link_this_seat → signed in already, seat free → one press binds it;
 *   link_sent      → "Check your email" — nothing to press;
 *   sign_in        → the seat is kept in an account this browser is not signed
 *                    in to → one "Sign in" link;
 *   linked         → "Saved to your account ✓";
 *   held_elsewhere → said plainly, never re-bound.
 *
 * 🔒 THE TERMS. The guest ticked them on the RSVP page a screen earlier; that
 * agreement travels in a server-set cookie (`RSVP_TERMS_COOKIE`) to whichever
 * door makes the account. When it is NOT carried (a decliner, or a cookie that
 * expired) the tick is asked here, unticked — and because a provider button
 * cannot carry a tick of its own, that case uses the emailed link, which can.
 */
export function SaveToAccount({
  state,
  eventId,
  slug,
  hasEmail,
  userAgent,
  termsCarried,
  failed = false,
  askEmail = false,
  sentTo = null,
  through,
}: {
  state: GuestAccountState;
  eventId: string;
  slug: string;
  hasEmail: boolean;
  userAgent: string | null;
  termsCarried: boolean;
  failed?: boolean;
  askEmail?: boolean;
  sentTo?: string | null;
  /**
   * 👋 THE PLUS-ONE'S OWN DOOR (owner 2026-09-29, frame F: *"One button: Save
   * to my account; his answers save with it"*). In the `offer` state the ONE
   * button posts `action` instead — the door's own save, which writes the
   * answers in `fields` and the Terms tick, THEN takes the device's method
   * (the same `saveMethodFor`, re-decided on the server). Because the tick is
   * in THIS form and is carried as a cookie before the provider is reached,
   * the device's own method is used even when no tick was carried in.
   * `after` is drawn inside the same form, under the button ("Not now").
   * Every other state renders exactly as without it.
   */
  through?: { action: (formData: FormData) => Promise<void>; fields: ReactNode; after?: ReactNode };
}) {
  if (state.kind === 'linked') {
    return (
      <p className="text-sm text-ink/80">
        <span aria-hidden className="text-gild">✓ </span>
        Saved to your account{state.accountEmail ? <> · {state.accountEmail}</> : null}
      </p>
    );
  }
  if (state.kind === 'held_elsewhere') {
    return (
      <p className="text-sm text-ink/70">
        This invitation is kept in a different Setnayan account. Sign in with that one to see it on any
        phone.
      </p>
    );
  }
  if (state.kind === 'link_sent') {
    return (
      <p role="status" className="border-l-2 border-gild px-3 py-2 text-sm text-ink/80">
        Check your email{sentTo ? <> ({sentTo})</> : null} — tap the link we sent and this invitation is
        saved to your account, on any phone. No password needed.
      </p>
    );
  }
  if (state.kind === 'sign_in') {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(`/join/${eventId}/connect`)}`}
        className="button-primary flex min-h-[56px] w-full flex-col items-center justify-center"
      >
        Sign in to your account
      </Link>
    );
  }
  if (state.kind === 'link_this_seat') {
    return (
      <form action={linkThisSeatAction.bind(null, eventId)}>
        <SubmitButton className="button-primary min-h-[56px] w-full" pendingLabel="Saving…">
          Save to my account
        </SubmitButton>
      </form>
    );
  }

  // offer
  const providers = {
    apple: envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_APPLE_ENABLED),
    google: envFlagEnabled(process.env.NEXT_PUBLIC_OAUTH_GOOGLE_ENABLED),
  };
  const deviceMethod = saveMethodFor(userAgent, providers);
  // A provider cannot carry a Terms tick — see the docblock. `through` can:
  // its own save carries the tick before the provider is reached.
  const method: SaveMethod = termsCarried || through ? deviceMethod : 'email';
  const connect = `/join/${eventId}/connect`;
  const button = (
    <SubmitButton
      className="button-primary flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5"
      pendingLabel={
        method === 'apple' ? 'Opening Apple…' : method === 'google' ? 'Opening Google…' : 'Sending your link…'
      }
    >
      <span className="text-base">Save to my account</span>
      <span className="text-xs font-normal opacity-80">{saveMethodLine(method)}</span>
    </SubmitButton>
  );
  const emailBox = (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-ink">
        {askEmail ? 'Your email — the link goes here' : 'Your email'}
      </span>
      <input
        name="keep_email"
        type="email"
        autoComplete="email"
        required
        placeholder="you@email.com"
        className="input-field"
      />
    </label>
  );
  const termsTick = (
    <label className="flex min-h-[44px] items-start gap-3 text-sm text-ink/80">
      <input
        name={TERMS_FIELD}
        type="checkbox"
        required
        className="mt-0.5 h-5 w-5 shrink-0 accent-terracotta"
      />
      <span>
        I agree to the{' '}
        <Link href="/terms" className="font-medium text-link underline underline-offset-2">
          Terms
        </Link>{' '}
        and the{' '}
        <Link href="/privacy" className="font-medium text-link underline underline-offset-2">
          Privacy Notice
        </Link>
      </span>
    </label>
  );
  if (through) {
    return (
      <div className="space-y-2" data-save-method={method} data-save-through>
        {failed ? (
          <p role="alert" className="text-sm text-terracotta-700">
            We could not send the link just now. Please try again.
          </p>
        ) : null}
        <form action={through.action} className="space-y-4">
          {through.fields}
          {method === 'email' && !hasEmail ? emailBox : null}
          {termsCarried ? null : termsTick}
          <SubmitButton
            name="then"
            value="keep"
            className="button-primary flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5"
            pendingLabel={
              method === 'apple' ? 'Opening Apple…' : method === 'google' ? 'Opening Google…' : 'Sending your link…'
            }
          >
            <span className="text-base">Save to my account</span>
            <span className="text-xs font-normal opacity-80">{saveMethodLine(method)}</span>
          </SubmitButton>
          {through.after}
        </form>
        <p className="text-center text-xs text-ink/60">
          Keeps the photos of you, and opens this invitation on any phone.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-2" data-save-method={method}>
      {failed ? (
        <p role="alert" className="text-sm text-terracotta-700">
          We could not send the link just now. Please try again.
        </p>
      ) : null}
      {method === 'apple' ? (
        <form action={signInWithApple}>
          <input type="hidden" name="next" value={connect} />
          {button}
        </form>
      ) : method === 'google' ? (
        <form action={signInWithGoogle}>
          <input type="hidden" name="next" value={connect} />
          {button}
        </form>
      ) : (
        <form action={claimAccountAction.bind(null, eventId, slug)} className="space-y-3">
          <input type="hidden" name="return_to" value={INVITE_RETURN} />
          {hasEmail ? null : emailBox}
          {termsCarried ? null : termsTick}
          {button}
        </form>
      )}
      {/* The reason, said once and only as wide as what ships: on the day this
          page shows each guest the photos they are in, and the account — not
          the pass in this browser — is what opens the event again later
          (`findGuestSeatForUser`), from any phone. */}
      <p className="text-center text-xs text-ink/60">
        Keeps the photos of you, and opens this invitation on any phone.
      </p>
    </div>
  );
}
