import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isPlaceholderEmail } from '@/lib/anon-onboarding';
import { SubmitButton } from '@/app/_components/submit-button';
import { setPasswordAction } from './actions';

export const metadata = { title: 'Set a password' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
};

const ERROR_COPY: Record<string, string> = {
  too_short: 'Use at least 8 characters.',
  failed: 'We couldn’t save your password — please try again.',
};

export default async function SetPasswordPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const sp = await searchParams;
  const next = sp.next || `/dashboard/${eventId}`;

  // Authenticated (they just clicked the magic link). If not, bounce to login.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join/${eventId}/set-password`)}`);
  }

  const action = setPasswordAction.bind(null, eventId);
  const errMsg = sp.error ? (ERROR_COPY[sp.error] ?? null) : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">Almost there</p>
        <h1 className="text-2xl font-semibold tracking-tight">Set a password</h1>
        <p className="text-sm text-ink/70">
          You&rsquo;re signed in
          {isPlaceholderEmail(user.email) ? null : (
            <>
              {' '}
              as <span className="font-medium text-ink">{user.email}</span>
            </>
          )}
          . Set a password so you can log back in any time — or skip and keep using email
          sign-in links.
        </p>
      </header>

      {errMsg ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-2.5 text-sm text-terracotta-700"
        >
          {errMsg}
        </p>
      ) : null}

      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-ink">
            New password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            className="input-field"
          />
        </div>
        <SubmitButton className="button-primary w-full" pendingLabel="Saving…">
          Set password
        </SubmitButton>
      </form>

      <Link href={next} className="text-center text-sm text-ink/55 hover:text-ink">
        Skip for now
      </Link>
    </main>
  );
}
