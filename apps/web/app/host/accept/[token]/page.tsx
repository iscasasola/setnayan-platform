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
import { SubmitButton } from '@/app/_components/submit-button';
import { DoorShell, DoorActions } from '@/app/_components/door/door-shell';
import { eventWordsForEvent } from '@/app/[slug]/_lib/event-words';

export const metadata = {
  title: 'Accept your invitation',
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

  // THIS DOOR IS OPENED SIGNED OUT, FROM AN EMAILED LINK, ON EVERY EVENT TYPE.
  //
  // 🔴 It said "Wedding date: 3 September 2026" to whoever opened it, and fell
  // back to the literal "a wedding" for an event with no name. A family
  // arranging a wake invites an aunt to help; she opens the link from her
  // inbox and is told her brother's funeral is a wedding.
  //
  // ⚠ THE RESOLVER MUST BE THE SERVICE-ROLE ONE, AND THAT IS NOT A DETAIL.
  // `public.events` has no SELECT policy admitting `anon`, so the cookie-scoped
  // read this resolver used to make came back empty for a signed-out visitor
  // and answered WEDDING for every celebration (PR #4897). `eventWordsForEvent`
  // now reads through `resolveProfileByEvent`, which is service-role scoped and
  // React-`cache()`d per request — so this costs one read and answers the same
  // in both arms of the sign-in gate below.
  //
  // 🔒 A WEDDING READS BYTE-IDENTICALLY: `eventWord` is 'wedding' for the
  // wedding profile, so both sentences reproduce their old text exactly.
  // 🔒 AND NO FALLBACK HERE MAY SAY "host" — a funeral's word is `family`, and
  // its event word is `wake`. Both fall back through the event's own words,
  // never through a literal.
  const w = await eventWordsForEvent(invite.event_id);
  const eventName =
    (eventRow as { display_name?: string | null } | null)?.display_name ?? `a ${w.eventWord}`;
  const eventDate = (eventRow as { event_date?: string | null } | null)?.event_date ?? null;
  // "Wedding date:" · "Wake date:" · "Birthday date:" — only the article-less
  // first letter is capitalised, matching the guest tree's own convention.
  const dateLabel = `${w.eventWord.charAt(0).toUpperCase()}${w.eventWord.slice(1)} date`;
  const inviterName =
    (inviterRow as { display_name?: string | null; email?: string | null } | null)?.display_name?.trim() ||
    (inviterRow as { email?: string | null } | null)?.email ||
    'a host';

  // Terminal-state guards.
  if (search.declined === '1') {
    return (
      <TerminalCard
          tone="warn"
          eyebrow="Declined"
          title="Invitation declined."
          body={`Thanks for letting us know. If you change your mind, ask ${inviterName} to send a new invite.`}
        />
    );
  }
  if (invite.removed_at) {
    return (
      <TerminalCard
          tone="warn"
          eyebrow="Revoked"
          title="This invitation was revoked."
          body={`If this is unexpected, contact ${inviterName} directly.`}
        />
    );
  }
  if (invite.accepted_at) {
    return (
      <TerminalCard
          tone="ok"
          eyebrow="Already accepted"
          title="You're already a host on this event."
          body="Head to your dashboard to keep planning."
          cta={{ href: `/dashboard/${invite.event_id}`, label: 'Open dashboard' }}
        />
    );
  }
  if (
    invite.invitation_expires_at &&
    new Date(invite.invitation_expires_at).getTime() < Date.now()
  ) {
    return (
      <TerminalCard
          tone="warn"
          eyebrow="Expired"
          title="This invitation has expired."
          body={`Invitation links expire 7 days after sending. Ask ${inviterName} to send a new one.`}
        />
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
      <DoorShell
        width="lg"
        eyebrow={
          <>
            <Sparkles aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            You&apos;re invited
          </>
        }
        title={`${inviterName} invited you to help plan ${eventName}`}
        sub={
          <>
            Role:{' '}
            <span className="font-medium text-ink">
              {ROLE_SUBTYPE_LABEL[invite.role_subtype]}
            </span>
            {invite.display_label ? ` · ${invite.display_label}` : ''}
            {eventDate
              ? ` · ${new Date(eventDate).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}`
              : ''}
            . Sign in or create a free account to accept — we&apos;ll send you straight to
            the event dashboard once you&apos;re in.
          </>
        }
      >
        <DoorActions>
          <Link
            href={`/signup?next=${encodeURIComponent(nextUrl)}&email=${encodeURIComponent(invite.invitation_email ?? '')}`}
            className="button-primary"
          >
            Create account
          </Link>
          <Link href={`/login?next=${encodeURIComponent(nextUrl)}`} className="button-secondary">
            Sign in
          </Link>
        </DoorActions>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
          Invitation expires{' '}
          {invite.invitation_expires_at
            ? new Date(invite.invitation_expires_at).toLocaleDateString('en-PH', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'in 7 days'}
        </p>
      </DoorShell>
    );
  }

  // Signed-in branch — check email match (loose UX guard).
  const inviteeEmail = (invite.invitation_email ?? '').toLowerCase().trim();
  const userEmail = (user.email ?? '').toLowerCase().trim();
  const emailMismatch = inviteeEmail && userEmail && inviteeEmail !== userEmail;

  if (emailMismatch || search.error === 'email_mismatch') {
    return (
      <TerminalCard
          tone="warn"
          eyebrow="Different account signed in"
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
    );
  }

  if (search.error) {
    // Surface server-action errors that bounced back here.
    return (
      <TerminalCard
          tone="warn"
          eyebrow="Something went wrong"
          title="We couldn't complete that just now."
          body={`Error: ${search.error}${search.msg ? ' — ' + search.msg : ''}. Try again, or ask the inviter to re-send.`}
        />
    );
  }

  // Happy path: signed in, fresh invite, email matches. Show accept/decline.
  return (
    <DoorShell
      width="lg"
      eyebrow={
        <>
          <Users aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Accept your invitation
        </>
      }
      title={`Help plan ${eventName}`}
      sub={
        <>
          {inviterName} invited you as{' '}
          <span className="font-medium text-ink">
            {ROLE_SUBTYPE_LABEL[invite.role_subtype]}
          </span>
          {invite.display_label ? ` (${invite.display_label})` : ''}.
        </>
      }
      meta={
        eventDate
          ? `${dateLabel}: ${new Date(eventDate).toLocaleDateString('en-PH', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}`
          : undefined
      }
    >
      <DoorActions>
        <form action={acceptHostInvite}>
          <input type="hidden" name="token" value={token} />
          <SubmitButton pendingLabel="Accepting…" className="button-primary w-full gap-2">
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Accept invitation
          </SubmitButton>
        </form>
        <form action={declineHostInvite}>
          <input type="hidden" name="token" value={token} />
          <SubmitButton pendingLabel="Declining…" className="button-secondary w-full">
            Decline
          </SubmitButton>
        </form>
      </DoorActions>
    </DoorShell>
  );
}

/**
 * The five terminal states (declined · revoked · already accepted · expired ·
 * wrong account · server error).
 *
 * Ported onto the shared <DoorShell> (2026-08-17). DoorShell renders the page
 * frame, so this is passed INSTEAD of the local wrapper this file used to
 * declare, not inside it.
 *
 * ⚖ `tone` maps to the door's own threshold/dead-end split, and the mapping is
 * not cosmetic: `ok` means there IS somewhere to go (it always carries a CTA),
 * so it keeps the action colour. `warn` is a refusal with nothing to act on.
 */
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
    <DoorShell
      tone={tone === 'ok' ? 'threshold' : 'dead_end'}
      width="lg"
      eyebrow={
        <>
          <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {eyebrow}
        </>
      }
      title={title}
      sub={body}
    >
      {cta ? (
        <Link href={cta.href} className="button-primary w-full sm:w-auto">
          {cta.label}
        </Link>
      ) : (
        <Link href="/" className="button-secondary">
          Back to Setnayan
        </Link>
      )}
    </DoorShell>
  );
}
