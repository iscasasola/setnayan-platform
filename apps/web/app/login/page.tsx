import Link from 'next/link';
import type { Metadata } from 'next';
import { SubmitButton } from '@/app/_components/submit-button';
import { signInWithMagicLink, signInWithPassword } from './actions';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your Setnayan account.',
};

type SearchParams = Promise<{
  error?: string;
  sent?: string;
  check_email?: string;
  ready?: string;
  next?: string;
}>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const errorMessage = params.error ? decodeURIComponent(params.error) : null;
  const magicLinkSent = params.sent === '1';
  const justSignedUpEmail = params.check_email
    ? decodeURIComponent(params.check_email)
    : null;
  const readyEmail = params.ready ? decodeURIComponent(params.ready) : null;
  const prefilledEmail = readyEmail ?? '';
  const next = params.next && params.next.startsWith('/') ? params.next : '/';

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-12 sm:px-8">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Setnayan
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-sm text-ink/60">
          Use your email and password, or send yourself a magic link.
        </p>
      </header>

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {errorMessage}
        </p>
      ) : null}

      {magicLinkSent ? (
        <p
          role="status"
          className="rounded-md border border-ink/15 bg-ink/5 px-4 py-3 text-sm text-ink/80"
        >
          Magic link sent. Check your email to finish signing in.
        </p>
      ) : null}

      {justSignedUpEmail ? (
        <p
          role="status"
          className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          Account created. We sent a confirmation link to{' '}
          <span className="font-medium">{justSignedUpEmail}</span> — open it to finish, then
          sign in below. Check your spam folder if it doesn&rsquo;t arrive in a couple of
          minutes.
        </p>
      ) : null}

      {readyEmail ? (
        <p
          role="status"
          className="rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          Your account is ready. Sign in below with{' '}
          <span className="font-medium">{readyEmail}</span> and the password you just set.
        </p>
      ) : null}

      <form action={signInWithPassword} className="space-y-4">
        <input type="hidden" name="next" value={next} />
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
            autoComplete="current-password"
            className="input-field"
            id="password"
            name="password"
            placeholder="••••••••"
            required
            type="password"
          />
        </div>
        <SubmitButton className="button-primary w-full" pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>

      <div className="relative">
        <div aria-hidden className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-ink/10" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-cream px-3 font-mono text-xs uppercase tracking-[0.2em] text-ink/40">
            or
          </span>
        </div>
      </div>

      <form action={signInWithMagicLink} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-ink" htmlFor="magic-email">
            Magic link
          </label>
          <input
            autoComplete="email"
            className="input-field"
            id="magic-email"
            inputMode="email"
            name="email"
            placeholder="you@setnayan.com"
            required
            type="email"
          />
        </div>
        <SubmitButton className="button-secondary w-full" pendingLabel="Sending…">
          Email me a magic link
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-ink/60">
        Don&rsquo;t have an account?{' '}
        <Link
          className="font-medium text-terracotta underline-offset-4 hover:underline"
          href={`/signup${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
        >
          Create one
        </Link>
      </p>
    </main>
  );
}
