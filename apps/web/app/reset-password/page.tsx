/**
 * /reset-password — set a new password after following a recovery email.
 *
 * The recovery link from /forgot-password routes through the existing
 * /auth/callback code-exchange (same mechanics as magic-link login), which
 * establishes a session and forwards here. So:
 *   - session present → show the new-password form (./actions.ts completes the
 *     reset + revokes other sessions + routes to the role home)
 *   - no session → the link was already used / expired → friendly "link
 *     expired" state with a path back to /forgot-password
 *
 * ⚖ PORTED TO THE SHARED DOOR 2026-08-17 (owner ruling: the account journey
 * should read as one product). Previously the marketing register.
 *
 * ⚖ THE TWO STATES TAKE DIFFERENT TONES, and it is the same distinction every
 * other door makes: a live recovery session is a THRESHOLD you walk through; a
 * spent link is a DEAD END, so it does not wear the action colour. The one
 * control on the dead end still leads somewhere real — a fresh link.
 */
import Link from 'next/link';
import type { Metadata } from 'next';
import { SubmitButton } from '@/app/_components/submit-button';
import { createClient } from '@/lib/supabase/server';
import { DoorShell, DoorNotice, DoorActions } from '@/app/_components/door/door-shell';
import { completePasswordReset } from './actions';

export const metadata: Metadata = {
  title: 'Choose a new password',
  description: 'Finish resetting your Setnayan account password.',
  robots: { index: false },
};

type SearchParams = Promise<{
  error?: string;
}>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const errorMessage = params.error ? decodeURIComponent(params.error) : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Recovery links are single-use and short-lived — landing here without a
    // session means the link was already used or has expired.
    return (
      <DoorShell
        tone="dead_end"
        eyebrow="Account recovery"
        title="This link has expired."
        sub="Reset links work once and expire after a short while. Request a fresh one and you’ll be back in shortly."
      >
        <DoorActions>
          <Link href="/forgot-password" className="button-primary">
            Send me a new link
          </Link>
          <Link href="/login" className="button-secondary">
            Back to sign in
          </Link>
        </DoorActions>
      </DoorShell>
    );
  }

  return (
    <DoorShell
      eyebrow="Account recovery"
      title="Choose a new password."
      sub="Minimum 8 characters. For safety, every other device gets signed out once your new password is saved."
    >
      {errorMessage ? <DoorNotice kind="alert">{errorMessage}</DoorNotice> : null}

      <form action={completePasswordReset} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="new_password" className="block text-sm font-medium text-ink">
            New password
          </label>
          <input
            id="new_password"
            name="new_password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            placeholder="At least 8 characters"
            className="input-field"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirm_password" className="block text-sm font-medium text-ink">
            Confirm new password
          </label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            placeholder="Type it once more"
            className="input-field"
          />
        </div>
        <SubmitButton className="button-primary w-full" pendingLabel="Saving…">
          Save new password
        </SubmitButton>
      </form>
    </DoorShell>
  );
}
