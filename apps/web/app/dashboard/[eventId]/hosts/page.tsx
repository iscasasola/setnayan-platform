import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
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
  DELEGATE_AREAS,
  DELEGATE_AREA_LABEL,
  resolveAreaLevel,
  type ModeratorPermissions,
  type RoleSubtype,
} from '@/lib/event-moderators';
import { inviteHost, revokeHostInvite, removeHost, setDelegateBudget } from './actions';

export const metadata = { title: 'Hosts · Setnayan' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    invite_sent?: string;
    invite_error?: string;
    invite_revoked?: string;
    grant_updated?: string;
    host_removed?: string;
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
  permissions_json: ModeratorPermissions | null;
};

// 0016 event_action_log shape (migration 20260518500000), reused as the
// delegate activity stream. `area` rides in payload_json.
type ActionLogRow = {
  id: string;
  performed_by_user_id: string | null;
  action_type: string;
  action_target_table: string | null;
  notes: string | null;
  payload_json: { area?: string | null } | null;
  performed_at: string;
};

type BookedCoordinator = {
  vendor_id: string;
  vendor_name: string;
  contact_email: string | null;
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
  const { data: legacy } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  const isCouple =
    (legacy as { member_type: string } | null)?.member_type === 'couple';
  if (isCouple) isHost = true;
  if (!isHost) redirect('/dashboard');

  const admin = createAdminClient();
  // Event name + moderator rows both key off eventId and don't depend on each
  // other — one parallel batch instead of two serial reads (owner perf pass
  // 2026-06-03). The accepted-host user lookup below stays sequential (it needs
  // the userIds derived from these rows).
  const [{ data: eventRow }, { data: rows }, { data: logRows }, { data: coordRows }] =
    await Promise.all([
      admin.from('events').select('display_name').eq('event_id', eventId).maybeSingle(),
      // All moderator rows (accepted + pending); revoked (removed_at) filtered out.
      admin
        .from('event_moderators')
        .select(
          'moderator_id, user_id, role_subtype, display_label, invitation_email, invitation_sent_at, invitation_expires_at, accepted_at, invitation_token, permissions_json',
        )
        .eq('event_id', eventId)
        .is('removed_at', null)
        .order('accepted_at', { ascending: true }),
      // Delegate activity stream — couple-visible (locked doc § 3: "your
      // coordinator did X"). Rows come from the log_delegate_write trigger
      // into the 0016 event_action_log.
      admin
        .from('event_action_log')
        .select(
          'id, performed_by_user_id, action_type, action_target_table, notes, payload_json, performed_at',
        )
        .eq('event_id', eventId)
        .like('action_type', 'delegate_%')
        .order('performed_at', { ascending: false })
        .limit(15),
      // Booked coordinators on the couple's vendor records — the one-click
      // "Promote your coordinator" path (locked doc § 3).
      admin
        .from('event_vendors')
        .select('vendor_id, vendor_name, contact_email')
        .eq('event_id', eventId)
        .eq('category', 'planner_coordinator')
        .in('status', ['contracted', 'deposit_paid', 'delivered', 'complete']),
    ]);
  const eventName = (eventRow as { display_name: string | null } | null)?.display_name ?? 'Your event';

  const all = (rows ?? []) as ModeratorRow[];
  const accepted = all.filter((r) => r.accepted_at);
  const pending = all.filter((r) => !r.accepted_at && r.invitation_token);
  const activity = (logRows ?? []) as ActionLogRow[];

  // Booked coordinators not yet invited (matched loosely by email).
  const invitedEmails = new Set(
    all.map((r) => (r.invitation_email ?? '').toLowerCase()).filter(Boolean),
  );
  const promotable = ((coordRows ?? []) as BookedCoordinator[]).filter(
    (c) => c.contact_email && !invitedEmails.has(c.contact_email.toLowerCase()),
  );

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
  const grantUpdated = search.grant_updated === '1';
  const hostRemoved = search.host_removed === '1';

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
          Who&apos;s planning this wedding with you?
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Add parents, the wedding planner, your maid of honor, ninongs and ninangs —
          anyone who should see the plan or help make decisions. Each host signs in
          with their own account; you control what role they have.
        </p>
      </header>

      {justSent && shareUrl ? (
        <section className="space-y-3 rounded-2xl border border-success-300/60 bg-success-50/70 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-success-200/80 text-success-900">
              <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-success-950">
                Invitation created.
              </p>
              <p className="text-xs text-success-900/85">
                Share this link with the host you invited. They&apos;ll sign up or sign
                in, then land on the accept page.
              </p>
              <code className="block break-all rounded-md bg-cream/80 px-2 py-1.5 font-mono text-[11px] text-success-950">
                {shareUrl}
              </code>
              <p className="text-[11px] text-success-900/60">
                Link expires in 7 days. (Email send via Resend ships in V1.1 — for now copy + send via any channel.)
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {justRevoked || grantUpdated || hostRemoved ? (
        <p
          role="status"
          className="inline-flex items-center gap-1.5 rounded-md bg-success-100/80 px-3 py-1.5 text-xs font-medium text-success-950"
        >
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {justRevoked
            ? 'Invitation revoked.'
            : grantUpdated
              ? 'Access updated.'
              : 'Host removed — their access ended immediately.'}
        </p>
      ) : null}

      {/* Promote your coordinator — one-click delegate invite for booked
          planner/coordinator vendors (feature-access program § 3). */}
      {isCouple && promotable.length > 0 ? (
        <section className="space-y-3 rounded-2xl border border-terracotta/25 bg-terracotta/[0.04] p-5">
          <header className="space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
              Promote your coordinator
            </p>
            <p className="max-w-prose text-sm text-ink/65">
              Your booked coordinator can plan WITH you — edit the guest list,
              seat plan, schedule, and vendor records, with every change logged
              below. Publishing the seat plan and the first invitation send
              always stay with you.
            </p>
          </header>
          <ul className="divide-y divide-ink/10">
            {promotable.map((c) => (
              <li
                key={c.vendor_id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-ink">{c.vendor_name}</p>
                  <p className="font-mono text-xs text-ink/55">{c.contact_email}</p>
                </div>
                <form action={inviteHost}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="invitation_email" value={c.contact_email ?? ''} />
                  <input type="hidden" name="role_subtype" value="wedding_planner_external" />
                  <input type="hidden" name="delegate_kind" value="coordinator" />
                  <input type="hidden" name="display_label" value={c.vendor_name.slice(0, 80)} />
                  <button
                    type="submit"
                    className="rounded-md bg-terracotta px-3 py-1.5 text-xs font-semibold text-cream hover:bg-terracotta/90"
                  >
                    Invite as delegate
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
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
            Everyone who&apos;s accepted their invite + can see this event&apos;s plan.
          </p>
        </header>
        {accepted.length === 0 ? (
          <p className="rounded-md border border-dashed border-ink/15 bg-cream p-4 text-sm text-ink/55">
            You&apos;re the only host so far. Use the form below to add your partner, parents,
            or anyone else who should be part of planning.
          </p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {accepted.map((row) => {
              const userInfo = row.user_id ? usersById[row.user_id] ?? null : null;
              const budgetLevel = resolveAreaLevel(row.permissions_json, 'budget');
              const grantChips = DELEGATE_AREAS.filter((a) => a !== 'budget')
                .map((a) => ({ area: a, level: resolveAreaLevel(row.permissions_json, a) }))
                .filter((g) => g.level !== null);
              return (
                <li
                  key={row.moderator_id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                >
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-ink">
                      {userInfo?.display_name?.trim() || userInfo?.email || '—'}
                    </p>
                    <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
                      {ROLE_SUBTYPE_LABEL[row.role_subtype]}
                      {row.display_label ? ` · ${row.display_label}` : ''}
                    </p>
                    <p className="flex flex-wrap gap-1">
                      {grantChips.map((g) => (
                        <span
                          key={g.area}
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            g.level === 'edit'
                              ? 'bg-terracotta/10 text-terracotta'
                              : 'bg-ink/5 text-ink/60'
                          }`}
                        >
                          {DELEGATE_AREA_LABEL[g.area]}
                          {g.level === 'view' ? ' · view' : ''}
                        </span>
                      ))}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          budgetLevel ? 'bg-ink/5 text-ink/60' : 'bg-ink/[0.03] text-ink/35'
                        }`}
                      >
                        Budget {budgetLevel ? '· view' : '· off'}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
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
                    {isCouple && row.user_id !== user.id ? (
                      <div className="flex items-center gap-2">
                        <form action={setDelegateBudget}>
                          <input type="hidden" name="event_id" value={eventId} />
                          <input type="hidden" name="moderator_id" value={row.moderator_id} />
                          <input
                            type="hidden"
                            name="budget_grant"
                            value={budgetLevel ? 'off' : 'view'}
                          />
                          <button
                            type="submit"
                            className="text-[11px] text-ink/55 underline hover:text-ink"
                          >
                            {budgetLevel ? 'Hide budget' : 'Allow budget view'}
                          </button>
                        </form>
                        <form action={removeHost}>
                          <input type="hidden" name="event_id" value={eventId} />
                          <input type="hidden" name="moderator_id" value={row.moderator_id} />
                          <button
                            type="submit"
                            className="text-[11px] text-terracotta-700 underline hover:text-terracotta"
                          >
                            Remove
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Delegate activity — "your coordinator did X" (couple-visible). */}
      {isCouple && activity.length > 0 ? (
        <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
          <header className="space-y-1">
            <p className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
              <ClipboardList aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Delegate activity
            </p>
            <p className="text-sm text-ink/65">
              Everything your hosts changed, most recent first. You&apos;ll always
              know who did what.
            </p>
          </header>
          <ul className="divide-y divide-ink/10">
            {activity.map((a) => {
              const actor = a.performed_by_user_id
                ? usersById[a.performed_by_user_id] ?? null
                : null;
              const verb = a.action_type.endsWith('insert')
                ? 'added'
                : a.action_type.endsWith('delete')
                  ? 'removed'
                  : 'updated';
              const area = a.payload_json?.area ?? null;
              const what =
                area === 'guest_list'
                  ? 'a guest'
                  : area === 'seat_plan'
                    ? 'the seat plan'
                    : area === 'schedule'
                      ? 'a schedule block'
                      : area === 'vendors'
                        ? 'a vendor record'
                        : a.action_target_table ?? 'the plan';
              return (
                <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
                  <span className="text-sm text-ink/80">
                    <span className="font-medium">
                      {actor?.display_name?.trim() || actor?.email || 'A delegate'}
                    </span>{' '}
                    {verb} {what}
                    {a.notes ? <span className="text-ink/55"> — {a.notes}</span> : null}
                  </span>
                  <span className="font-mono text-[10px] text-ink/45">
                    {new Date(a.performed_at).toLocaleString('en-PH', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

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
              Shown alongside the role so the host knows who&apos;s who.
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
