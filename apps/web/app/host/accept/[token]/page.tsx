import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CheckCircle2, ShieldAlert, Sparkles, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ROLE_SUBTYPE_LABEL,
  type RoleSubtype,
} from '@/lib/event-moderators';
import { acceptHostInvite, declineHostInvite } from './actions';

export const metadata = {
  title: 'Accept your invitation · Setnayan',
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    error?: string;
    expected?: string;
    msg?: string;
    declined?: string;
  }>;
};

type FullInviteRow = {
  moderator_id: string;
  event_id: string;
  user_id: string | null;
  role_subtype: RoleSubtype;
  display_label: string | null;
  invitation_email: string | null;
  invitation_sent_at: string | null;
  invitation_expires_at: string | null;
  accepted_at: string | null;
  removed_at: string | null;
  invited_by_user_id: string | null;
};

export default async function HostAcceptPage({ params, searchParams }: Props) {
  const { token } = await params;
  const search = await searchParams;

  const admin = createAdminClient();
  const { data: inviteRaw } = await admin
    .from('event_moderators')
    .select(
      'moderator_id, event_id, user_id, role_subtype, display_label, invitation_email, invitation_sent_at, invitation_expires_at, accepted_at, removed_at, invited_by_user_id',
    )
    .eq('invitation_token', token)
    .maybeSingle();

  if (!inviteRaw) {
    // Could be (a) already accepted (token rotated to NULL on accept) or
    // (b) malformed token. Either way, render not-found.
    notFound();
  }
  const invite = inviteRaw as FullInviteRow;

  // Resolve event + inviter info for the card display.
  const [{ data: eventRow }, { data: inviterRow }] = await Promise.all([
    admin
      .from('events')
      .select('display_name, event_date')
      .eq('event_id', invite.event_id)
      .maybeSingle(),
    invite.invited_by_user_id
      ? admin
          .from('users')
          .select('display_name, email')
          .eq('user_id', invite.invited_by_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const eventName = (eventRow as { display_name?: string | null } | null)?.display_name ?? 'a wedding';
  const eventDate = (eventRow as { event_date?: string | null } | null)?.event_date ?? null;
  const inviterName =
    (inviterRow as { display_name?: string | null; email?: string | null } | null)?.display_name?.trim() ||
    (inviterRow as { email?: string | null } | null)?.email ||
    'a host';

  // Terminal-state guards.
  if (search.declined === '1') {
    return (
      <AcceptShell>
        <TerminalCard
          tone="warn"
          eyebrow="Setnayan · Declined"
          title="Invitation declined."
          body={`Thanks for letting us know. If you change your mind, ask ${inviterName} to send a new invite.`}
        />
      </AcceptShell>
    );
  }
  if (invite.removed_at) {
    return (
      <AcceptShell>
        <TerminalCard
          tone="warn"
          eyebrow="Setnayan · Revoked"
          title="This invitation was revoked."
          body={`If this is unexpected, contact ${inviterName} directly.`}
        />
      </AcceptShell>
    );
  }
  if (invite.accepted_at) {
    return (
      <AcceptShell>
        <TerminalCard
          tone="ok"
          eyebrow="Setnayan · Already accepted"
          title="You're already a host on this event."
          body="Head to your dashboard to keep planning."
          cta={{ href: `/dashboard/${invite.event_id}`, label: 'Open dashboard' }}
        />
      </AcceptShell>
    );
  }
  if (
    invite.invitation_expires_at &&
    new Date(invite.invitation_expires_at).getTime() < Date.now()
  ) {
    return (
      <AcceptShell>
        <TerminalCard
          tone="warn"
          eyebrow="Setnayan · Expired"
          title="This invitation has expired."
          body={`Invitation links expire 7 days after sending. Ask ${inviterName} to send a new one.`}
        />
      </AcceptShell>
    );
  }

  // Sign-in gate.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const nextUrl = `/host/accept/${token}`;
    return (
      <AcceptShell>
        <header className="space-y-3 text-center">
          <p className="inline-flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
            <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            You&apos;re invited
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {inviterName} invited you to help plan {eventName}
          </h1>
          <p className="text-base text-ink/65">
            Role: <span className="font-medium text-ink">{ROLE_SUBTYPE_LABEL[invite.role_subtype]}</span>
            {invite.display_label ? ` · ${invite.display_label}` : ''}
            {eventDate ? ` · ${new Date(eventDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}
          </p>
          <p className="text-sm text-ink/65">
            Sign in or create a free account to accept. We&apos;ll send you straight to the
            event dashboard once you&apos;re in.
          </p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/signup?next=${encodeURIComponent(nextUrl)}&email=${encodeURIComponent(invite.invitation_email ?? '')}`}
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
        <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink/40">
          Invitation expires{' '}
          {invite.invitation_expires_at
            ? new Date(invite.invitation_expires_at).toLocaleDateString('en-PH', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'in 7 days'}
        </p>
      </AcceptShell>
    );
  }

  // Signed-in branch — check email match (loose UX guard).
  const inviteeEmail = (invite.invitation_email ?? '').toLowerCase().trim();
  const userEmail = (user.email ?? '').toLowerCase().trim();
  const emailMismatch = inviteeEmail && userEmail && inviteeEmail !== userEmail;

  if (emailMismatch || search.error === 'email_mismatch') {
    return (
      <AcceptShell>
        <TerminalCard
          tone="warn"
          eyebrow="Setnayan · Different account signed in"
          title="This invitation was sent to a different email."
          body={
            <>
              You&apos;re signed in as <span className="font-mono">{user.email}</span>, but
              this invitation was sent to{' '}
              <span className="font-mono">{search.expected ?? invite.invitation_email}</span>.
              Sign out and back in with the correct account, or ask the inviter to
              re-send to your current address.
            </>
          }
          cta={{ href: '/login?next=' + encodeURIComponent(`/host/accept/${token}`), label: 'Switch account' }}
        />
      </AcceptShell>
    );
  }

  if (search.error) {
    // Surface server-action errors that bounced back here.
    return (
      <AcceptShell>
        <TerminalCard
          tone="warn"
          eyebrow="Setnayan · Something went wrong"
          title="We couldn't complete that just now."
          body={`Error: ${search.error}${search.msg ? ' — ' + search.msg : ''}. Try again, or ask the inviter to re-send.`}
        />
      </AcceptShell>
    );
  }

  // Happy path: signed in, fresh invite, email matches. Show accept/decline.
  return (
    <AcceptShell>
      <header className="space-y-3 text-center">
        <p className="inline-flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
          <Users aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Accept your invitation
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Help plan {eventName}
        </h1>
        <p className="text-base text-ink/65">
          {inviterName} invited you as{' '}
          <span className="font-medium text-ink">{ROLE_SUBTYPE_LABEL[invite.role_subtype]}</span>
          {invite.display_label ? ` (${invite.display_label})` : ''}.
        </p>
        {eventDate ? (
          <p className="text-sm text-ink/55">
            Wedding date:{' '}
            {new Date(eventDate).toLocaleDateString('en-PH', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        ) : null}
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <form action={acceptHostInvite}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-5 py-3 text-sm font-medium text-cream transition hover:bg-mulberry-600"
          >
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Accept invitation
          </button>
        </form>
        <form action={declineHostInvite}>
          <input type="hidden" name="token" value={token} />
          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-ink/15 bg-cream px-5 py-3 text-sm font-medium text-ink/70 transition hover:bg-ink/[0.03]"
          >
            Decline
          </button>
        </form>
      </div>
    </AcceptShell>
  );
}

function AcceptShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-10 sm:px-6">
      <div className="space-y-6 rounded-2xl border border-ink/10 bg-cream p-6 sm:p-8">
        {children}
      </div>
    </main>
  );
}

function TerminalCard({
  tone,
  eyebrow,
  title,
  body,
  cta,
}: {
  tone: 'ok' | 'warn';
  eyebrow: string;
  title: string;
  body: React.ReactNode;
  cta?: { href: string; label: string };
}) {
  const Icon = tone === 'ok' ? CheckCircle2 : ShieldAlert;
  return (
    <div className="space-y-4 text-center">
      <p className="inline-flex items-center justify-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
        <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
        {eyebrow}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="text-sm text-ink/65">{body}</div>
      {cta ? (
        <Link
          href={cta.href}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-mulberry px-5 py-3 text-sm font-medium text-cream transition hover:bg-mulberry-600"
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}
