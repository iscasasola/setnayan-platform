/**
 * /forgot-password — public password-recovery request page.
 *
 * WHY THIS ROUTE EXISTS: the /login page has linked "Forgot password?" →
 * /forgot-password since the v2.1 port, but the route never existed — the URL
 * fell through to the `[slug]` event catch-all and rendered garbage with HTTP
 * 200. A static segment takes precedence over the catch-all, so this page fixes
 * the live dead link.
 *
 * ⚖ PORTED TO THE SHARED DOOR 2026-08-17, on the owner's ruling that the whole
 * account journey should read as one product. It previously wore the marketing
 * register (`--m-*` inline styles + `.m-serif`), which was internally coherent
 * but made signing up and recovering an account look like a different product
 * from claiming an invitation. Nothing about the FLOW moved — see below.
 *
 * 🔒 ANTI-ENUMERATION IS UNCHANGED AND LOAD-BEARING: the confirmation copy is
 * identical whether or not an account exists for that email (see ./actions.ts).
 * Do not "improve" it into telling someone their email was not found.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { SubmitButton } from '@/app/_components/submit-button';
import { TurnstileField } from '@/app/_components/auth/turnstile-field';
import { DoorShell, DoorNotice } from '@/app/_components/door/door-shell';
import { requestPasswordReset } from './actions';

export const metadata: Metadata = {
  title: 'Reset your password',
  description:
    'Request a password-reset link for your Setnayan account. One account for couples planning their wedding and vendors selling their services.',
  alternates: { canonical: '/forgot-password' },
};

type SearchParams = Promise<{
  sent?: string;
  error?: string;
}>;

const ERROR_COPY: Record<string, string> = {
  missing: 'Enter the email you signed up with.',
  rate_limited:
    'Too many reset requests in a row — please wait a minute, then try again.',
  // A FAILED BOT CHECK SAYS SO, instead of the neutral "we've sent a link".
  // Nothing was sent in this case, and this is the one page a person reaches
  // when they already cannot get in — telling them to wait for a mail that is
  // not coming is the worst possible place to be reassuring. Names no account:
  // the check fails before any lookup, so this reveals nothing about whether
  // the email is registered.
  captcha:
    'The bot check didn’t pass, so we haven’t sent anything yet. Please try again — if it keeps happening, refresh the page.',
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const sent = params.sent === '1';
  const errorMessage = params.error
    ? (ERROR_COPY[params.error] ?? 'Something went wrong — please try again.')
    : null;

  return (
    <DoorShell
      eyebrow="Account recovery"
      title="Forgot your password?"
      sub="Tell us your email and we’ll send a link to set a new one."
    >
      {errorMessage ? <DoorNotice kind="alert">{errorMessage}</DoorNotice> : null}

      {sent ? (
        <DoorNotice>
          If an account exists for that email, a reset link is on its way. Check your inbox
          (and spam folder) — the link works once and expires after a short while.
        </DoorNotice>
      ) : null}

      <form action={requestPasswordReset} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-sm font-medium text-ink">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@setnayan.com"
            required
            className="input-field"
          />
        </div>
        {/*
          The bot check. Renders NOTHING until a Turnstile site key is set, so
          this page is unchanged today. It is not optional once captcha is on:
          Supabase gates password recovery with the same global switch as
          sign-in, and this is the page someone reaches BECAUSE they are already
          locked out.
        */}
        <TurnstileField action="password_reset" />
        <SubmitButton className="button-primary w-full" pendingLabel="Sending…">
          Email me a reset link
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-ink/70">
        Remembered it?{' '}
        <Link href="/login" className="font-medium text-link hover:underline">
          Back to sign in
        </Link>
      </p>
    </DoorShell>
  );
}
