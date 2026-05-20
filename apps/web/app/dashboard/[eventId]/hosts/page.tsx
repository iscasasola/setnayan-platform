import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Mail,
  Trash2,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ROLE_SUBTYPES,
  ROLE_SUBTYPE_LABEL,
  ROLE_SUBTYPE_HINT,
  type RoleSubtype,
} from '@/lib/event-moderators';
import { inviteHost, revokeHostInvite } from './actions';

export const metadata = { title: 'Hosts · Setnayan' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    invite_sent?: string;
    invite_error?: string;
    invite_revoked?: string;
    token?: string;
  }>;
};

type ModeratorRow = {
  moderator_id: string;
  user_id: string | null;
  role_subtype: RoleSubtype;
  display_label: string | null;
  invitation_email: string | null;
  invitation_sent_at: string | null;
  invitation_expires_at: string | null;
  accepted_at: string | null;
  invitation_token: string | null;
};

type UserMini = {
  user_id: string;
  display_name: string | null;
  email: string | null;
};

export default async function EventHostsPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Gate access — must be a current host on this event (via either
  // event_moderators or the legacy event_members couple row).
  const { data: modCheck } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  let isHost = !!modCheck;
  if (!isHost) {
    const { data: legacy } = await supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();
    isHost = (legacy as { member_type: string } | null)?.member_type === 'couple';
  }
  if (!isHost) redirect('/dashboard');

  const admin = createAdminClient();
  const { data: eventRow } = await admin
    .from('events')
    .select('display_name')
    .eq('event_id', eventId)
    .maybeSingle();
  const eventName = (eventRow as { display_name: string | null } | null)?.display_name ?? 'Your event';

  // Fetch all moderator rows for this event (accepted + pending). Revoked
  // rows are filtered out (removed_at not null).
  const { data: rows } = await admin
    .from('event_moderators')
    .select(
      'moderator_id, user_id, role_subtype, display_label, invitation_email, invitation_sent_at, invitation_expires_at, accepted_at, invitation_token',
    )
    .eq('event_id', eventId)
    .is('removed_at', null)
    .order('accepted_at', { ascending: true });

  const all = (rows ?? []) as ModeratorRow[];
  const accepted = all.filter((r) => r.accepted_at);
  const pending = all.filter((r) => !r.accepted_at && r.invitation_token);

  // Resolve user info for accepted hosts (display_name + email).
  const userIds = accepted.map((r) => r.user_id).filter((id): id is string => !!id);
  let usersById: Record<string, UserMini> = {};
  if (userIds.length > 0) {
    const { data: userRows } = await admin
      .from('users')
      .select('user_id, display_name, email')
      .in('user_id', userIds);
    usersById = Object.fromEntries(
      ((userRows ?? []) as UserMini[]).map((u) => [u.user_id, u]),
    );
  }

  const justSent = search.invite_sent === '1';
  const sentToken = search.token ?? null;
  const inviteError = search.invite_error ?? null;
  const justRevoked = search.invite_revoked === '1';

  // Build the share URL with a localhost-safe fallback. In production this
  // resolves to https://www.setnayan.com via SITE_URL; locally to localhost.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    'https://www.setnayan.com';
  const shareUrl = sentToken ? `${siteUrl}/host/accept/${sentToken}` : null;

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to {eventName}
      </Link>

      <header className="space-y-2">
        <p className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          <Users aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Hosts on this event
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Who's planning this wedding with you?
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Add parents, the wedding planner, your maid of honor, ninongs and ninangs —
          anyone who should see the plan or help make decisions. Each host signs in
          with their own account; you control what role they have.
        </p>
      </header>

      {justSent && shareUrl ? (
        <section className="space-y-3 rounded-2xl border border-emerald-300/60 bg-emerald-50/70 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-emerald-200/80 text-emerald-900">
              <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-emerald-950">
                Invitation created.
              </p>
              <p className="text-xs text-emerald-900/85">
                Share this link with the host you invited. They'll sign up or sign
                in, then land on the accept page.
              </p>
              <code className="block break-all rounded-md bg-cream/80 px-2 py-1.5 font-mono text-[11px] text-emerald-950">
                {shareUrl}
              </code>
              <p className="text-[11px] text-emerald-900/60">
                Link expires in 7 days. (Email send via Resend ships in V1.1 — for now copy + send via any channel.)
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {justRevoked ? (
        <p
          role="status"
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-100/80 px-3 py-1.5 text-xs font-medium text-emerald-950"
        >
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Invitation revoked.
        </p>
      ) : null}

      {inviteError ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-xs text-terracotta-700"
        >
          Could not send invitation: {inviteError}
        </p>
      ) : null}

      {/* Pending invites */}
      {pending.length > 0 ? (
        <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
          <header className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              Pending invitations · {pending.length}
            </p>
            <p className="text-sm text-ink/65">
              Sent but not yet accepted. The link expires 7 days after sending.
            </p>
          </header>
          <ul className="divide-y divide-ink/10">
            {pending.map((row) => (
              <li
                key={row.moderator_id}
                className="flex flex-wrap items-start justify-between gap-3 py-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-ink">
                    {ROLE_SUBTYPE_LABEL[row.role_subtype]}
                    {row.display_label ? ` · ${row.display_label}` : ''}
                  </p>
                  <p className="inline-flex items-center gap-1.5 font-mono text-xs text-ink/55">
                    <Mail aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                    {row.invitation_email ?? '—'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {row.invitation_token ? (
                    <code className="rounded bg-ink/[0.05] px-2 py-1 font-mono text-[10px] text-ink/70">
                      /host/accept/{row.invitation_token.slice(0, 12)}…
                    </code>
                  ) : null}
                  <form action={revokeHostInvite}>
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="moderator_id" value={row.moderator_id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-md border border-terracotta/30 bg-cream px-2.5 py-1 text-xs text-terracotta-700 hover:bg-terracotta/10"
                    >
                      <Trash2 aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                      Revoke
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Current hosts */}
      <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
        <header className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Current hosts · {accepted.length}
          </p>
          <p className="text-sm text-ink/65">
            Everyone who's accepted their invite + can see this event's plan.
          </p>
        </header>
        {accepted.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink/15 bg-cream p-4 text-sm text-ink/55">
            You're the only host so far. Use the form below to add your partner, parents,
            or anyone else who should be part of planning.
          </p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {accepted.map((row) => {
              const userInfo = row.user_id ? usersById[row.user_id] ?? null : null;
              return (
                <li
                  key={row.moderator_id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-ink">
                      {userInfo?.display_name?.trim() || userInfo?.email || '—'}
                    </p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
                      {ROLE_SUBTYPE_LABEL[row.role_subtype]}
                      {row.display_label ? ` · ${row.display_label}` : ''}
                    </p>
                  </div>
                  <p className="font-mono text-[10px] text-ink/50">
                    Joined{' '}
                    {row.accepted_at
                      ? new Date(row.accepted_at).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : '—'}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Invite form */}
      <section className="space-y-4 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
        <header className="space-y-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Invite a new host
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            Add a co-planner
          </h2>
          <p className="max-w-prose text-sm text-ink/65">
            Email is required so the invitee knows who sent the link. Roles default to
            sensible permission templates — you can change permissions per host later.
          </p>
        </header>

        <form action={inviteHost} className="space-y-4">
          <input type="hidden" name="event_id" value={eventId} />

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              Email
            </span>
            <input
              type="email"
              name="invitation_email"
              required
              maxLength={200}
              placeholder="parent@example.com"
              className="input-field"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              Role
            </span>
            <select name="role_subtype" required defaultValue="" className="input-field">
              <option value="" disabled>
                Pick a role
              </option>
              {ROLE_SUBTYPES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_SUBTYPE_LABEL[r]} — {ROLE_SUBTYPE_HINT[r]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
              Display label (optional)
            </span>
            <input
              type="text"
              name="display_label"
              maxLength={80}
              placeholder="Tita Lita (Mom's cousin)"
              className="input-field"
            />
            <span className="text-xs text-ink/55">
              Shown alongside the role so the host knows who's who.
            </span>
          </label>

          <button type="submit" className="button-primary h-11 px-5">
            Send invitation
          </button>
        </form>
      </section>
    </section>
  );
}
