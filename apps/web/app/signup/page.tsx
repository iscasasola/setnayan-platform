import Link from 'next/link';
import type { Metadata } from 'next';
import { SubmitButton } from '@/app/_components/submit-button';
import { Logo } from '@/app/_components/logo';
import { ANY_OAUTH_ENABLED, OAuthButtonRow } from '@/app/_components/oauth-button-row';
import { safeNext } from '@/lib/auth';
import { signUp } from './actions';

// GEO Phase G5 (2026-05-28) — canonical URL + brand-suffix title.
export const metadata: Metadata = {
  title: 'Create account · Setnayan',
  description:
    'Create a Setnayan account in seconds. Free for couples planning their wedding. Free baseline listing for Filipino wedding vendors.',
  alternates: { canonical: '/signup' },
};

const ERROR_COPY: Record<string, string> = {
  missing: 'Please enter both an email and a password.',
  password_too_short: 'Password must be at least 8 characters.',
  blacklisted:
    'This email cannot be used to create a Setnayan account. Please use a different email, or contact support if you think this is a mistake.',
};

type SearchParams = Promise<{
  error?: string;
  sent?: string;
  next?: string;
  as?: string;
  /** Pre-fill the email field — used by /vendor/claim/[token]?as=vendor flows
   *  per iteration 0006 § Invite-to-Setnayan, locked 2026-05-19. */
  prefill_email?: string;
}>;

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawError = params.error ? decodeURIComponent(params.error) : null;
  const errorMessage = rawError ? (ERROR_COPY[rawError] ?? rawError) : null;
  const confirmationSent = params.sent === '1';
  const next = safeNext(params.next);
  const preselectVendor = params.as === 'vendor';
  const prefilledEmail =
    typeof params.prefill_email === 'string' ? params.prefill_email : '';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-12 sm:px-8">
      <header className="space-y-3">
        <Link href="/" aria-label="Setnayan home" className="inline-flex text-ink">
          <Logo height={32} />
        </Link>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Setnayan
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Create account</h1>
        <p className="text-sm text-ink/60">Eight characters or more for your password.</p>
      </header>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {errorMessage}
        </p>
      ) : null}

      {confirmationSent ? (
        <p
          role="status"
          className="rounded-md border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-ink/80"
        >
          We sent a confirmation link to your email. Open it to finish creating your
          account.
        </p>
      ) : null}

      {/* OAuth row first per industry-standard placement. Supabase auto-
          creates the auth.users row on first OAuth callback if it doesn't
          exist (no separate "sign up vs sign in" branching at the OAuth
          layer). OAuth-created accounts get account_type='customer' by
          default — they're indistinguishable from email-created hosts.
          A V1.1 enhancement could let OAuth users pick vendor vs customer
          on a post-callback onboarding step; for V1 the default is fine
          since vendor signups overwhelmingly use email anyway. */}
      <OAuthButtonRow next={next} />

      {/* Divider only renders when the OAuth row above has content — see
       *  the matching block on /login/page.tsx. */}
      {ANY_OAUTH_ENABLED ? (
        <div className="relative">
          <div aria-hidden className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-ink/10" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-cream px-3 font-mono text-xs uppercase tracking-[0.2em] text-ink/40">
              or sign up with email
            </span>
          </div>
        </div>
      ) : null}

      <form
        action={signUp}
        className="space-y-4 [&:has(input[value='vendor']:checked)_[data-couple-only]]:hidden"
      >
        <input type="hidden" name="next" value={next} />
        <fieldset className="space-y-2">
          <legend className="block text-sm font-medium text-ink">I&rsquo;m signing up as a</legend>
          <div className="grid grid-cols-2 gap-2">
            <label className="relative flex cursor-pointer flex-col gap-1 rounded-md border border-ink/15 bg-cream p-3 text-sm transition-colors has-[input:checked]:border-terracotta has-[input:checked]:bg-terracotta/5">
              <input
                type="radio"
                name="account_type"
                value="customer"
                defaultChecked={!preselectVendor}
                className="peer sr-only"
              />
              <span className="font-medium text-ink">Couple</span>
              <span className="text-xs text-ink/60">Planning our wedding</span>
            </label>
            <label className="relative flex cursor-pointer flex-col gap-1 rounded-md border border-ink/15 bg-cream p-3 text-sm transition-colors has-[input:checked]:border-terracotta has-[input:checked]:bg-terracotta/5">
              <input
                type="radio"
                name="account_type"
                value="vendor"
                defaultChecked={preselectVendor}
                className="peer sr-only"
              />
              <span className="font-medium text-ink">Vendor</span>
              <span className="text-xs text-ink/60">Photographer, caterer, etc.</span>
            </label>
          </div>
        </fieldset>

        {/* Public Event Summary consent — couples only. Hidden via the form's
            :has() arbitrary variant when the Vendor radio is checked. Wording
            and behavior locked in CLAUDE.md decision-log rows 426 + 428
            (2026-05-19): public-by-default with the 8 RA 10173 safe-harbor
            guardrails (T+30d grace window + reminder email + one-click opt-out
            from /dashboard/{eventId}/privacy). Checkbox defaults checked so
            the default behavior matches the locked "public-by-default" posture;
            couples who uncheck land with users.public_summary_consent_at NULL
            and can flip it on later from the in-dashboard privacy surface. */}
        <fieldset
          data-couple-only
          className="space-y-2 rounded-md border border-ink/10 bg-cream/50 p-3"
        >
          <legend className="sr-only">Public Real Weddings showcase</legend>
          <label className="flex cursor-pointer items-start gap-3 text-sm text-ink/80">
            <input
              type="checkbox"
              name="public_summary_consent"
              value="yes"
              defaultChecked
              className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-ink/30 text-terracotta focus:ring-2 focus:ring-terracotta/30"
            />
            <span>
              <span className="font-medium text-ink">
                Include my wedding in Setnayan&rsquo;s Real Weddings showcase.
              </span>{' '}
              30 days after our event, our editorial page becomes publicly
              searchable on <span className="font-mono">setnayan.com/weddings</span>{' '}
              and Google. We can keep it private at any time from our dashboard.
            </span>
          </label>
        </fieldset>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="email">
            Email
          </label>
          <input
            autoComplete="email"
            className="input-field"
            defaultValue={prefilledEmail}
            id="email"
            inputMode="email"
            name="email"
            placeholder="you@setnayan.com"
            required
            type="email"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="password">
            Password
          </label>
          <input
            autoComplete="new-password"
            className="input-field"
            id="password"
            minLength={8}
            name="password"
            placeholder="••••••••"
            required
            type="password"
          />
        </div>
        <SubmitButton className="button-primary w-full" pendingLabel="Creating account…">
          Create account
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-ink/60">
        Already have an account?{' '}
        <Link
          className="font-medium text-terracotta underline-offset-4 hover:underline"
          href={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
        >
          Sign in
        </Link>
      </p>
    </main>
  );
}
