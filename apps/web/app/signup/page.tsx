import Link from 'next/link';
import type { Metadata } from 'next';
import { SubmitButton } from '@/app/_components/submit-button';
import { signUp } from './actions';

export const metadata: Metadata = {
  title: 'Create account',
  description: 'Create a Setnayan account.',
};

const ERROR_COPY: Record<string, string> = {
  missing: 'Please enter both an email and a password.',
  password_too_short: 'Password must be at least 8 characters.',
  blacklisted:
    'This email cannot be used to create a Setnayan account. Please use a different email, or contact support if you think this is a mistake.',
};

type SearchParams = Promise<{ error?: string; sent?: string; next?: string }>;

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const rawError = params.error ? decodeURIComponent(params.error) : null;
  const errorMessage = rawError ? (ERROR_COPY[rawError] ?? rawError) : null;
  const confirmationSent = params.sent === '1';
  const next = params.next && params.next.startsWith('/') ? params.next : '/';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-12 sm:px-8">
      <header className="space-y-2">
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

      <form action={signUp} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <fieldset className="space-y-2">
          <legend className="block text-sm font-medium text-ink">I&rsquo;m signing up as a</legend>
          <div className="grid grid-cols-2 gap-2">
            <label className="relative flex cursor-pointer flex-col gap-1 rounded-md border border-ink/15 bg-cream p-3 text-sm transition-colors has-[input:checked]:border-terracotta has-[input:checked]:bg-terracotta/5">
              <input
                type="radio"
                name="account_type"
                value="customer"
                defaultChecked
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
                className="peer sr-only"
              />
              <span className="font-medium text-ink">Vendor</span>
              <span className="text-xs text-ink/60">Photographer, caterer, etc.</span>
            </label>
          </div>
        </fieldset>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="email">
            Email
          </label>
          <input
            autoComplete="email"
            className="input-field"
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
