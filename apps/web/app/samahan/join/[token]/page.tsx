import Link from 'next/link';
import { CheckCircle2, HeartHandshake, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchPendingCommunityInvite,
} from '@/lib/communities';
import { SubmitButton } from '@/app/_components/submit-button';
import { DoorShell, DoorActions } from '@/app/_components/door/door-shell';
import { acceptCommunityInvite } from './actions';

export const metadata = {
  title: 'Join a Samahan',
  robots: { index: false, follow: false },
};

// Public samahan-invite accept page (plan §6) — mirrors /host/accept/[token].
// Pre-join, the page shows name + member COUNT only — never member
// names (plan §9 no-roster-scraping rule). The token IS the secret, so the
// lookup runs on the admin client (fetchPendingHostInvite precedent).

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

const TERMINAL_COPY: Record<
  'not_found' | 'revoked' | 'expired' | 'archived',
  { title: string; body: string }
> = {
  not_found: {
    title: 'This invite link doesn’t work.',
    body: 'It may have been rotated by an organizer, or the link was copied incompletely. Ask an organizer for a fresh one.',
  },
  revoked: {
    title: 'This invite link was turned off.',
    body: 'An organizer disabled it. Ask them for a fresh link.',
  },
  expired: {
    title: 'This invite link has expired.',
    body: 'Ask an organizer for a fresh one.',
  },
  archived: {
    title: 'This samahan has been archived.',
    body: 'It’s no longer accepting new members.',
  },
};

export default async function SamahanJoinPage({ params, searchParams }: Props) {
  const { token } = await params;
  const search = await searchParams;

  const admin = createAdminClient();
  const resolution = await fetchPendingCommunityInvite(admin, token);

  if (resolution.status !== 'ok') {
    const copy = TERMINAL_COPY[resolution.status];
    return (
      <DoorShell
        // Nothing to walk through — a revoked or expired link is a message,
        // not a task, so it does not wear the action colour.
        tone="dead_end"
        eyebrow={
          <>
            <ShieldAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Samahan
          </>
        }
        title={copy.title}
        sub={copy.body}
      >
        <Link href="/" className="button-secondary">
          Go home
        </Link>
      </DoorShell>
    );
  }

  const invite = resolution.invite;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Signed-out → show the community card + sign-in/sign-up round trip
  // (acceptHostInvite ?next= pattern).
  if (!user) {
    const nextUrl = `/samahan/join/${token}`;
    return (
      <InviteDoor invite={invite} sub="Sign in or create a free account to join.">
        <DoorActions>
          <Link href={`/signup?next=${encodeURIComponent(nextUrl)}`} className="button-primary">
            Create account
          </Link>
          <Link href={`/login?next=${encodeURIComponent(nextUrl)}`} className="button-secondary">
            Sign in
          </Link>
        </DoorActions>
      </InviteDoor>
    );
  }

  if (search.error) {
    return (
      <DoorShell
        tone="dead_end"
        eyebrow={
          <>
            <ShieldAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Something went wrong
          </>
        }
        title="We couldn’t complete that just now."
        sub={`Error: ${search.error}. Try again, or ask an organizer for a fresh link.`}
      >
        <Link href="/" className="button-secondary">
          Go home
        </Link>
      </DoorShell>
    );
  }

  // Signed in — Join / No-thanks.
  return (
    <InviteDoor invite={invite}>
      <DoorActions>
        <form action={acceptCommunityInvite}>
          <SubmitButton pendingLabel="Joining…" className="button-primary w-full gap-2">
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Join {invite.name}
          </SubmitButton>
          <input name="token" type="hidden" value={token} />
        </form>
        <Link href="/dashboard" className="button-secondary">
          No thanks
        </Link>
      </DoorActions>
    </InviteDoor>
  );
}

/**
 * The live invite door — one header for the signed-out and signed-in branches,
 * which previously rendered it twice from a local <InviteHeader>.
 *
 * 🔒 Pre-join we show the samahan's NAME and member COUNT only, never member
 * names (plan §9, no roster-scraping). That rule is why `meta` is a count.
 */
function InviteDoor({
  invite,
  sub,
  children,
}: {
  invite: { name: string; member_count: number };
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <DoorShell
      eyebrow={
        <>
          <HeartHandshake aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          You&rsquo;re invited
        </>
      }
      title={`Join ${invite.name}?`}
      sub={sub}
      meta={`${invite.member_count} ${invite.member_count === 1 ? 'member' : 'members'}`}
    >
      {children}
    </DoorShell>
  );
}
