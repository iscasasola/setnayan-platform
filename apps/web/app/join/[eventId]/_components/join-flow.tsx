import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { resolveRoleSetForEvent } from '@/lib/event-type-profile';
import { SubmitButton } from '@/app/_components/submit-button';
import { joinEventAction, selfJoinAction } from '../actions';
import { JoinShell } from './join-shell';
import { ROLE_LABELS } from '@/lib/guests';
import { readGuestSession } from '@/lib/guest-session';
import { FormFlash } from '@/app/_components/forms/form-flash';

const ROLE_ERROR: Record<string, string> = {
  invalid_token: 'This invite link is no longer valid. Ask the couple to send you a fresh one.',
  invalid_role: 'Please pick a valid role.',
  missing_name: 'Please enter your name so the couple can find you on their list.',
  already_member: "You're already on this event's guest list.",
  join_closed: 'This event has reached its sign-up limit. Please ask the couple to add you.',
  join_failed: 'Something went wrong adding you. Please try again, or ask the couple.',
};

export type JoinFlowEvent = {
  event_id: string;
  public_id: string | null;
  display_name: string | null;
  event_date: string | null;
  venue_name: string | null;
  slug: string | null;
};

/**
 * The shared join experience, rendered identically whether the guest arrived via
 * the opaque `/join/[eventId]?token=` URL or the branded `/[slug]/invite` URL.
 * The caller resolves + validates (event + token) per its route; this owns the
 * auth check, already-member redirect, and the accountless / signed-in forms.
 *
 * `returnPath` is where sign-in / create-account should bring the guest back to
 * (so a branded-URL visitor returns to the branded URL).
 */
export async function JoinFlow({
  event,
  token,
  errorKey,
  returnPath,
}: {
  event: JoinFlowEvent;
  token: string;
  errorKey: string | null;
  returnPath: string;
}) {
  const eventId = event.event_id;
  // JoinShell wants a non-null display_name; coerce once (renders nothing if blank).
  const shellEvent = {
    display_name: event.display_name ?? '',
    event_date: event.event_date,
    venue_name: event.venue_name,
  };
  const roleSet = await resolveRoleSetForEvent(eventId);
  const errorMessage = errorKey ? (ROLE_ERROR[errorKey] ?? errorKey) : null;
  const loginHref = `/login?next=${encodeURIComponent(returnPath)}`;
  const signupHref = `/signup?next=${encodeURIComponent(returnPath)}`;

  // Auth check.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not signed in → ACCOUNTLESS join (owner 2026-06-20 "yes we allow this").
  // An older guest who scans the event QR can add themselves with just a name —
  // no account — reusing the same guest-cookie flow as /[slug]/redeem
  // (selfJoinAction). It only lands somewhere if the event has a public page, so
  // when there's no slug yet we fall back to the sign-in/create wall.
  if (!user) {
    const slug = event.slug ?? null;
    if (slug) {
      // Already self-joined on this device → skip the form, go to the page.
      const session = await readGuestSession();
      if (session && session.event_id === eventId) {
        redirect(`/${slug}`);
      }
      const selfAction = selfJoinAction.bind(null, eventId, token);
      return (
        <JoinShell event={shellEvent}>
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
                  {roleSet.selfClaimableRoles.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-ink/55">The couple can refine it later.</p>
              </details>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-ink">
                Email <span className="font-normal text-ink/50">(optional)</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@email.com"
                autoComplete="email"
                className="input-field"
              />
              <p className="text-sm text-ink/70">
                Add it and we&rsquo;ll email you a sign-in link, so you can open this event on
                any device — no password needed.
              </p>
            </div>
            <SubmitButton className="button-primary w-full" pendingLabel="Adding you…">
              Add me to the guest list
            </SubmitButton>
          </form>
          <p className="mt-4 text-sm text-ink/60">
            Have an account?{' '}
            <Link
              className="font-medium text-terracotta underline-offset-2 hover:underline"
              href={loginHref}
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
      <JoinShell event={shellEvent}>
        <p className="text-base text-ink/70">
          Sign in or create an account to add yourself to this event.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link className="button-primary" href={loginHref}>
            Sign in
          </Link>
          <Link className="button-secondary" href={signupHref}>
            Create account
          </Link>
        </div>
      </JoinShell>
    );
  }

  // Already a member?
  const admin = createAdminClient();
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
    redirect(`/join/${eventId}/success?token=${encodeURIComponent(token)}`);
  }

  // Show name + role picker. Pre-fill the name from their account so the
  // couple's guest list can be matched against it (no public search field).
  const metaFirst = (user.user_metadata?.first_name as string | undefined) ?? '';
  const metaLast = (user.user_metadata?.last_name as string | undefined) ?? '';
  const defaultName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    [metaFirst, metaLast].filter(Boolean).join(' ') ??
    '';

  const action = joinEventAction.bind(null, eventId, token);

  return (
    <JoinShell event={shellEvent}>
      {errorMessage ? <FormFlash tone="error">{errorMessage}</FormFlash> : null}

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
              {roleSet.selfClaimableRoles.map((r) => (
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
