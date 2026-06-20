import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { SubmitButton } from '@/app/_components/submit-button';
import { joinEventAction, selfJoinAction } from './actions';
import { JoinShell, InvalidTokenScreen } from './_components/join-shell';
import { ROLE_LABELS, type GuestRole } from '@/lib/guests';
import { readGuestSession } from '@/lib/guest-session';
import { FormFlash } from '@/app/_components/forms/form-flash';

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
  join_closed: 'This event has reached its sign-up limit. Please ask the couple to add you.',
  join_failed: "Something went wrong adding you. Please try again, or ask the couple.",
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
    .select('event_id, public_id, display_name, event_date, venue_name, slug')
    .eq('event_id', eventId)
    .maybeSingle();

  if (!event) {
    return <InvalidTokenScreen />;
  }

  const errorMessage = errorKey ? (ROLE_ERROR[errorKey] ?? errorKey) : null;

  // 2. Auth check.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 2a. Not signed in → ACCOUNTLESS join (owner 2026-06-20 "yes we allow this").
  //     An older guest who scans the event QR can add themselves with just a
  //     name — no account — reusing the same guest-cookie flow as /[slug]/redeem
  //     (selfJoinAction). It only lands somewhere if the event has a public page,
  //     so when there's no slug yet we fall back to the sign-in/create wall.
  if (!user) {
    const slug = (event.slug as string | null) ?? null;
    if (slug) {
      // Already self-joined on this device → skip the form, go to the page.
      const session = await readGuestSession();
      if (session && session.event_id === eventId) {
        redirect(`/${slug}`);
      }
      const selfAction = selfJoinAction.bind(null, eventId, token);
      return (
        <JoinShell event={event}>
          {errorMessage ? <FormFlash tone="error">{errorMessage}</FormFlash> : null}
          <p className="text-base text-ink/70">
            Add yourself to {event.display_name ? <span className="font-medium text-ink">{event.display_name}</span> : 'this event'} — just your
            name, no account needed.
          </p>
          <form action={selfAction} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="name" className="block text-sm font-medium text-ink">
                Your full name
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                placeholder="e.g. Maria Santos"
                autoComplete="name"
                className="input-field"
              />
              <p className="text-sm text-ink/70">Use the name the couple would have on their list.</p>
            </div>
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-ink">Your role</span>
              <p className="text-sm text-ink/70">
                You&rsquo;re joining as a <span className="font-medium text-ink">Guest</span> — right for
                almost everyone.
              </p>
              {/* The 18 ceremonial roles tuck behind a disclosure so Guest is one
                  tap; the hidden select still submits its default "guest" when
                  the details stay collapsed. */}
              <details className="group">
                <summary className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-terracotta underline-offset-2 hover:underline">
                  My role is special — sponsor, bearer, entourage…
                </summary>
                <select
                  name="role"
                  required
                  defaultValue="guest"
                  className="input-field mt-2"
                  aria-label="Your role"
                >
                  {SELECTABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-ink/55">The couple can refine it later.</p>
              </details>
            </div>
            <SubmitButton className="button-primary w-full" pendingLabel="Adding you…">
              Add me to the guest list
            </SubmitButton>
          </form>
          <p className="mt-4 text-sm text-ink/60">
            Have an account?{' '}
            <Link
              className="font-medium text-terracotta underline-offset-2 hover:underline"
              href={`/login?next=${encodeURIComponent(`/join/${eventId}?token=${token}`)}`}
            >
              Sign in
            </Link>{' '}
            instead.
          </p>
        </JoinShell>
      );
    }
    // No public page yet → fall back to the account wall.
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

  const action = joinEventAction.bind(null, eventId, token);

  return (
    <JoinShell event={event}>
      {errorMessage ? (
        <FormFlash tone="error">
          {errorMessage}
        </FormFlash>
      ) : null}

      <p className="text-base text-ink/70">
        Welcome, <span className="font-medium text-ink">{user.email}</span>. Tell us your
        name so the couple can find you on their guest list.
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
          <p className="text-sm text-ink/70">
            Use the name the couple would have on their list.
          </p>
        </div>
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-ink">Your role</span>
          <p className="text-sm text-ink/70">
            You&rsquo;re joining as a <span className="font-medium text-ink">Guest</span> — right for
            almost everyone.
          </p>
          <details className="group">
            <summary className="inline-flex cursor-pointer items-center gap-1 text-sm font-medium text-terracotta underline-offset-2 hover:underline">
              My role is special — sponsor, bearer, entourage…
            </summary>
            <select
              name="role"
              required
              defaultValue="guest"
              className="input-field mt-2"
              aria-label="Your role"
            >
              {SELECTABLE_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink/55">The couple can refine it later.</p>
          </details>
        </div>
        <SubmitButton className="button-primary w-full sm:w-auto" pendingLabel="Checking…">
          Continue
        </SubmitButton>
      </form>
    </JoinShell>
  );
}
