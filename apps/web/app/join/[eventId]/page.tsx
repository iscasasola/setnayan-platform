import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { joinEventAction } from './actions';
import { JoinShell, InvalidTokenScreen } from './_components/join-shell';
import { ROLE_LABELS, type GuestRole } from '@/lib/guests';

export const metadata = { title: 'Join event' };

const SELECTABLE_ROLES: GuestRole[] = [
  'guest',
  'maid_of_honor',
  'matron_of_honor',
  'best_man',
  'bridesmaid',
  'groomsman',
  'principal_sponsor',
  'candle_sponsor',
  'veil_sponsor',
  'cord_sponsor',
  'coin_sponsor',
  'ring_bearer',
  'bible_bearer',
  'coin_bearer',
  'flower_girl',
  'officiant',
  'reader_lector',
  'soloist_musician',
];

const ROLE_ERROR: Record<string, string> = {
  invalid_token: 'This invite link is no longer valid. Ask the couple to send you a fresh one.',
  invalid_role: 'Please pick a valid role.',
  missing_name: 'Please enter your name so the couple can find you on their list.',
  already_member: "You're already on this event's guest list.",
};

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ token?: string; error?: string }>;
};

export default async function JoinPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;
  const token = search.token ?? '';
  const errorKey = search.error ?? null;

  // 1. Validate the token (admin client bypasses RLS).
  const admin = createAdminClient();
  const { data: tokenRow } = await admin
    .from('event_join_tokens')
    .select('event_id, revoked_at, expires_at')
    .eq('event_id', eventId)
    .eq('token', token)
    .maybeSingle();

  const tokenValid =
    !!tokenRow &&
    !tokenRow.revoked_at &&
    (!tokenRow.expires_at || new Date(tokenRow.expires_at) > new Date());

  if (!token || !tokenValid) {
    return <InvalidTokenScreen />;
  }

  const { data: event } = await admin
    .from('events')
    .select('event_id, public_id, display_name, event_date, venue_name')
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) {
    return <InvalidTokenScreen />;
  }

  // 2. Auth check — if not signed in, ask them to.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <JoinShell event={event}>
        <p className="text-base text-ink/70">
          Sign in or create an account to add yourself to this event.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            className="button-primary"
            href={`/login?next=${encodeURIComponent(`/join/${eventId}?token=${token}`)}`}
          >
            Sign in
          </Link>
          <Link
            className="button-secondary"
            href={`/signup?next=${encodeURIComponent(`/join/${eventId}?token=${token}`)}`}
          >
            Create account
          </Link>
        </div>
      </JoinShell>
    );
  }

  // 3. Already a member?
  const { data: existing } = await admin
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    if (existing.member_type === 'couple') {
      redirect(`/dashboard/${eventId}`);
    }
    redirect(`/join/${eventId}/success?token=${token}`);
  }

  // 4. Show name + role picker. Pre-fill the name from their account so the
  //    couple's guest list can be matched against it (no public search field).
  const metaFirst = (user.user_metadata?.first_name as string | undefined) ?? '';
  const metaLast = (user.user_metadata?.last_name as string | undefined) ?? '';
  const defaultName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    [metaFirst, metaLast].filter(Boolean).join(' ') ??
    '';

  const errorMessage = errorKey ? (ROLE_ERROR[errorKey] ?? errorKey) : null;
  const action = joinEventAction.bind(null, eventId, token);

  return (
    <JoinShell event={event}>
      {errorMessage ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {errorMessage}
        </p>
      ) : null}

      <p className="text-base text-ink/70">
        Welcome, <span className="font-medium text-ink">{user.email}</span>. Tell us who
        you are so the couple can match you to their guest list.
      </p>

      <form action={action} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="name" className="block text-sm font-medium text-ink">
            Your full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            defaultValue={defaultName}
            placeholder="e.g. Maria Santos"
            autoComplete="name"
            className="input-field"
          />
          <p className="text-xs text-ink/50">
            Use the name the couple would have on their list.
          </p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="role" className="block text-sm font-medium text-ink">
            Your role
          </label>
          <select id="role" name="role" required defaultValue="guest" className="input-field">
            {SELECTABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink/50">
            Pick &ldquo;Guest&rdquo; if your role isn&rsquo;t listed. The couple can refine it later.
          </p>
        </div>
        <SubmitButton className="button-primary w-full sm:w-auto" pendingLabel="Checking…">
          Continue
        </SubmitButton>
      </form>
    </JoinShell>
  );
}
