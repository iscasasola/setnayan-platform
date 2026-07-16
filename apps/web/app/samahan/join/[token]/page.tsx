import Link from 'next/link';
import { CheckCircle2, HeartHandshake, ShieldAlert } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  fetchPendingCommunityInvite,
} from '@/lib/communities';
import { SubmitButton } from '@/app/_components/submit-button';
import { acceptCommunityInvite } from './actions';

export const metadata = {
  title: 'Join a Samahan · Setnayan',
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
      <Shell>
        <div className="space-y-4 text-center">
          <p className="inline-flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            <ShieldAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Setnayan · Samahan
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="text-sm text-ink/65">{copy.body}</p>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-5 py-3 text-sm font-medium text-cream transition hover:bg-mulberry-600"
          >
            Go home
          </Link>
        </div>
      </Shell>
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
      <Shell>
        <InviteHeader
                    memberCount={invite.member_count}
          name={invite.name}
        />
        <p className="text-center text-sm text-ink/65">
          Sign in or create a free account to join.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/signup?next=${encodeURIComponent(nextUrl)}`}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-5 py-3 text-sm font-medium text-cream transition hover:bg-mulberry-600"
          >
            Create account
          </Link>
          <Link
            href={`/login?next=${encodeURIComponent(nextUrl)}`}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-5 py-3 text-sm font-medium text-ink/80 transition hover:bg-ink/[0.03]"
          >
            Sign in
          </Link>
        </div>
      </Shell>
    );
  }

  if (search.error) {
    return (
      <Shell>
        <div className="space-y-4 text-center">
          <p className="inline-flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            <ShieldAlert aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Setnayan · Something went wrong
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            We couldn’t complete that just now.
          </h1>
          <p className="text-sm text-ink/65">
            Error: {search.error}. Try again, or ask an organizer for a fresh
            link.
          </p>
        </div>
      </Shell>
    );
  }

  // Signed in — Join / No-thanks.
  return (
    <Shell>
      <InviteHeader
                memberCount={invite.member_count}
        name={invite.name}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <form action={acceptCommunityInvite}>
          <input name="token" type="hidden" value={token} />
          <SubmitButton
            pendingLabel="Joining…"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-5 py-3 text-sm font-medium text-cream transition hover:bg-mulberry-600"
          >
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Join {invite.name}
          </SubmitButton>
        </form>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-5 py-3 text-sm font-medium text-ink/70 transition hover:bg-ink/[0.03]"
        >
          No thanks
        </Link>
      </div>
    </Shell>
  );
}

function InviteHeader({
  memberCount,
  name,
}: {
  memberCount: number;
  name: string;
}) {
  return (
    <header className="space-y-3 text-center">
      <p className="inline-flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
        <HeartHandshake aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        You&rsquo;re invited
      </p>
      <h1 className="font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
        Join {name}?
      </h1>
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-ink/55">
        {memberCount} {memberCount === 1 ? 'member' : 'members'}
      </p>
    </header>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10 sm:px-6">
      <div className="space-y-6 rounded-2xl border border-ink/10 bg-cream p-6 sm:p-8">
        {children}
      </div>
    </main>
  );
}
