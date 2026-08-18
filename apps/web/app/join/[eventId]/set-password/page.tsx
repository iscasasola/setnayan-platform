/**
 * /join/[eventId]/set-password — the last optional step after a magic link.
 *
 * Ported onto the shared <DoorShell> (2026-08-17): it hand-copied JoinShell's
 * wrapper and wore the gold eyebrow (the `terracotta` slot, 3.37:1 on cream).
 * The error block is now <DoorNotice kind="alert">, the same shape every other
 * door uses.
 *
 * "Skip for now" is a real answer, not a hidden escape: setting a password is
 * optional by design (email links keep working), so it stays a visible control
 * rather than a faint link under the fold.
 */
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isPlaceholderEmail } from '@/lib/anon-onboarding';
import { SubmitButton } from '@/app/_components/submit-button';
import { DoorShell, DoorNotice, DoorActions } from '@/app/_components/door/door-shell';
import { setPasswordAction } from './actions';

export const metadata = { title: 'Set a password' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
};

const ERROR_COPY: Record<string, string> = {
  too_short: 'Use at least 8 characters.',
  leaked:
    'This password has appeared in a known data breach. Please choose a different one — it only takes a moment and it protects your account.',
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
    <DoorShell
      eyebrow="Almost there"
      title="Set a password"
      sub={
        <>
          You&rsquo;re signed in
          {isPlaceholderEmail(user.email) ? null : (
            <> as <span className="font-medium text-ink">{user.email}</span></>
          )}
          . Set a password so you can log back in any time — or skip and keep using email
          sign-in links.
        </>
      }
    >
      {errMsg ? <DoorNotice kind="alert">{errMsg}</DoorNotice> : null}

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
        <DoorActions>
          <SubmitButton className="button-primary w-full" pendingLabel="Saving…">
            Set password
          </SubmitButton>
          <Link href={next} className="button-secondary">
            Skip for now
          </Link>
        </DoorActions>
      </form>
    </DoorShell>
  );
}
