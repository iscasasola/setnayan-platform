import Link from 'next/link';
import { CheckCircle2, Mail, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { siteOrigin } from '@/lib/site-origin';
import { routes } from '@/lib/routes';
import { ROLE_SUBTYPE_LABEL, isRoleSubtype, type ModeratorPermissions } from '@/lib/event-moderators';
import { isCoordinatorConsentGateEnabled } from '@/lib/coordinator-consent-gate';
import { isOffPlatformSupplier } from '@/lib/supplier-invite-eligibility';
import { plannerSeatsForVendor, PLANNER_SEAT_ROLE } from '@/lib/planner-seats';
import { loadCoordinatorColourGrantees } from '@/lib/colour-access.server';
import { SubmitButton } from '@/app/_components/submit-button';
import { ReadRefusedNotice } from '@/app/dashboard/[eventId]/_components/read-refused-notice';
import { CoordinatorColourDomains } from '@/app/dashboard/[eventId]/_components/coordinator-colour-domains';
import {
  CoordinatorGrantChips,
  CoordinatorSeatControls,
} from '@/app/dashboard/[eventId]/_components/coordinator-seat-controls';
import { revokeHostInvite } from '@/app/dashboard/[eventId]/hosts/actions';
import {
  setCoordinatorColourDomain,
  rejectColourChange,
} from '@/app/dashboard/[eventId]/colour-access-actions';
import { ConsentGatedInviteForm } from './consent-gated-invite-form';

/**
 * "PROMOTE YOUR COORDINATOR" — on Your Team, the booked planner's own workspace.
 *
 * ⚖ Owner 2026-09-30 (DECISION_LOG "GUEST LIST: ACCESS + CHECK-IN BECOME
 * COLUMNS…", item 6, and the plan `CHECKIN_COLUMN_AND_PARTS_ROW_PLAN.md` §3):
 * the Hosts page folds into the Guest list, and the one piece of it that is
 * about a SUPPLIER — inviting the hired planner to plan with the couple — moves
 * here, next to the booking it is about. Everything is the Hosts page's own,
 * moved, never redrawn:
 *
 *   · the off-platform invite through the RA 10173 consent step
 *     (`ConsentGatedInviteForm` → `inviteHost`, gated server-side too);
 *   · an on-platform planner's in-app path (their conversation), never their
 *     account email (N2, 2026-09-11);
 *   · the invite link once sent, a waiting invite and its Revoke — shown until
 *     it expires, then gone;
 *   · the accepted planner's grants, the budget / photo switches and the
 *     reasoned Remove (`CoordinatorSeatControls`);
 *   · their colour domains (`CoordinatorColourDomains`) — which this workspace's
 *     own Colour access card used to send to the Hosts page for.
 *
 * Couple-only, like every action it posts to (`requireCoupleMembership`). A
 * delegate who can open this workspace sees nothing here rather than switches
 * that refuse them.
 */

type Seat = {
  moderator_id: string;
  user_id: string | null;
  role_subtype: string;
  display_label: string | null;
  invitation_email: string | null;
  invitation_expires_at: string | null;
  accepted_at: string | null;
  invitation_token: string | null;
  permissions_json: ModeratorPermissions | null;
};

/** The statuses that make a booking real enough to hand the planner access — the Hosts page's list. */
const BOOKED = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);

export type PromoteCoordinatorFlash = {
  invite_sent?: string;
  invite_error?: string;
  invite_revoked?: string;
  grant_updated?: string;
  host_removed?: string;
  token?: string;
};

export async function PromoteCoordinatorCard({
  eventId,
  vendor,
  flash,
}: {
  eventId: string;
  vendor: {
    vendor_id: string;
    vendor_name: string;
    contact_email: string | null;
    marketplace_vendor_id: string | null;
    status: string;
  };
  flash: PromoteCoordinatorFlash;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: member, error: memberError } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  // ⚠ The viewer's own row. Refused, they are treated as not the couple — the
  // card hides; every action behind it is couple-gated anyway.
  if (memberError) {
    logQueryError('PromoteCoordinatorCard.member', memberError, { eventId }, 'graceful_degrade');
  }
  if ((member as { member_type?: string } | null)?.member_type !== 'couple') return null;

  const admin = createAdminClient();
  const [{ data: seatRows, error: seatsError }, { data: plannerRows, error: plannerRowsError }, consentGateEnabled] =
    await Promise.all([
      admin
        .from('event_moderators')
        .select(
          'moderator_id, user_id, role_subtype, display_label, invitation_email, invitation_expires_at, accepted_at, invitation_token, permissions_json',
        )
        .eq('event_id', eventId)
        .eq('role_subtype', PLANNER_SEAT_ROLE)
        .is('removed_at', null)
        .order('accepted_at', { ascending: true }),
      // Every planner booking's email — a seat another booking claims is not this one's.
      admin
        .from('event_vendors')
        .select('contact_email')
        .eq('event_id', eventId)
        .eq('category', 'planner_coordinator'),
      isCoordinatorConsentGateEnabled(),
    ]);
  if (seatsError) {
    logQueryError('PromoteCoordinatorCard.seats', seatsError, { eventId }, 'graceful_degrade');
  }
  if (plannerRowsError) {
    logQueryError('PromoteCoordinatorCard.plannerRows', plannerRowsError, { eventId }, 'graceful_degrade');
  }
  // A refused read here hides a planner who HAS access, one tap from a second
  // invite — so it says so, and the invite offer waits until it can check.
  const promotePartlyRefused = Boolean(seatsError) || Boolean(plannerRowsError);

  const allSeats = (seatRows ?? []) as Seat[];
  const seats = plannerSeatsForVendor(
    allSeats,
    vendor.contact_email,
    ((plannerRows ?? []) as { contact_email: string | null }[]).map((r) => r.contact_email),
  );
  // ⚠ LIVE IS `user_id`, NEVER `accepted_at` — it is DEFAULT now() (20271251336140).
  const accepted = seats.filter((s) => s.user_id);
  const now = Date.now();
  const pending = seats.filter(
    (s) =>
      !s.user_id &&
      s.invitation_token &&
      (!s.invitation_expires_at || new Date(s.invitation_expires_at).getTime() > now),
  );

  const vendorEmail = vendor.contact_email?.trim().toLowerCase() || null;
  const alreadyInvited = allSeats.some(
    (s) => vendorEmail !== null && s.invitation_email?.trim().toLowerCase() === vendorEmail,
  );
  const canPromote =
    !promotePartlyRefused && BOOKED.has(vendor.status) && vendorEmail !== null && !alreadyInvited;
  // N2 (2026-09-11): a marketplace-linked row's contact_email is the SHOP's own
  // login email, copied in by a package lock — never printed, never mailed.
  const offPlatform = isOffPlatformSupplier(vendor);

  let threadId: string | undefined;
  if (canPromote && !offPlatform && vendor.marketplace_vendor_id) {
    const { data: thread, error: threadError } = await admin
      .from('chat_threads')
      .select('thread_id')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', vendor.marketplace_vendor_id)
      .maybeSingle();
    if (threadError) {
      logQueryError('PromoteCoordinatorCard.thread', threadError, { eventId }, 'graceful_degrade');
    }
    threadId = (thread as { thread_id: string } | null)?.thread_id;
  }

  const userIds = accepted.map((s) => s.user_id).filter((id): id is string => !!id);
  const usersById = new Map<string, { display_name: string | null; email: string | null }>();
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await admin
      .from('users')
      .select('user_id, display_name, email')
      .in('user_id', userIds);
    // ⚠ the planner's name. Refused, a real planner renders under the booking's name.
    if (usersError) {
      logQueryError('PromoteCoordinatorCard.users', usersError, { eventId }, 'graceful_degrade');
    }
    for (const u of (users ?? []) as { user_id: string; display_name: string | null; email: string | null }[]) {
      usersById.set(u.user_id, u);
    }
  }
  const nameOf = (s: Seat) =>
    (s.user_id ? usersById.get(s.user_id)?.display_name?.trim() || usersById.get(s.user_id)?.email : null) ||
    s.display_label ||
    vendor.vendor_name;
  const roleWord = (s: Seat) => (isRoleSubtype(s.role_subtype) ? ROLE_SUBTYPE_LABEL[s.role_subtype] : 'Hired planner');

  const { grantees } = await loadCoordinatorColourGrantees(
    admin,
    eventId,
    accepted.map((s) => ({
      user_id: s.user_id,
      role_subtype: s.role_subtype,
      displayName: nameOf(s),
      roleLine: roleWord(s),
    })),
    user.id,
  );

  const justSent = flash.invite_sent === '1' && flash.token ? `${siteOrigin()}/host/accept/${flash.token}` : null;
  const saved =
    flash.invite_revoked === '1'
      ? 'Invitation revoked.'
      : flash.grant_updated === '1'
        ? 'Access updated.'
        : flash.host_removed === '1'
          ? 'Removed — their access ended immediately.'
          : null;

  return (
    <section
      id="promote-coordinator"
      aria-labelledby="promote-coordinator-heading"
      className="sn-glass-bare space-y-4 rounded-xl p-5"
    >
      <div className="space-y-1">
        <h2 id="promote-coordinator-heading" className="text-sm font-semibold text-ink">
          Promote your coordinator
        </h2>
        <p className="max-w-prose text-xs text-ink/65">
          Your booked coordinator can plan WITH you — edit the guest list, seat plan, schedule,
          and vendor records, with every change logged. Publishing the seat plan and the first
          invitation send always stay with you.
        </p>
      </div>

      {promotePartlyRefused ? (
        <ReadRefusedNotice partial what="your coordinator's access" />
      ) : null}

      {justSent ? (
        <div className="space-y-2 rounded-lg bg-success-50/70 p-3" role="status">
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-success-950">
            <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Invitation saved.
          </p>
          <p className="text-xs text-success-900/85">
            Share this link with your coordinator. They&apos;ll sign in, then accept.
          </p>
          <code className="block break-all rounded-md bg-cream/80 px-2 py-1.5 font-mono text-[11px] text-success-950">
            {justSent}
          </code>
        </div>
      ) : null}

      {saved ? (
        <p
          role="status"
          className="inline-flex items-center gap-1.5 rounded-md bg-success-100/80 px-3 py-1.5 text-xs font-medium text-success-950"
        >
          <CheckCircle2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {saved}
        </p>
      ) : null}

      {flash.invite_error ? (
        <p
          role="alert"
          className="rounded-md border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-xs text-terracotta-700"
        >
          Could not send invitation: {flash.invite_error}
        </p>
      ) : null}

      {canPromote && offPlatform ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs text-ink/55">{vendor.contact_email}</p>
          <ConsentGatedInviteForm enabled={consentGateEnabled} forceCoordinator coordinatorLabel={vendor.vendor_name}>
            <input type="hidden" name="event_id" value={eventId} />
            <input type="hidden" name="vendor_id" value={vendor.vendor_id} />
            <input type="hidden" name="invitation_email" value={vendor.contact_email ?? ''} />
            <input type="hidden" name="role_subtype" value={PLANNER_SEAT_ROLE} />
            <input type="hidden" name="delegate_kind" value="coordinator" />
            <input type="hidden" name="display_label" value={vendor.vendor_name.slice(0, 80)} />
            <SubmitButton
              pendingLabel="Inviting…"
              className="rounded-md bg-terracotta-700 px-3 py-1.5 text-xs font-semibold text-cream hover:bg-terracotta-800"
            >
              Invite as delegate
            </SubmitButton>
          </ConsentGatedInviteForm>
        </div>
      ) : null}

      {canPromote && !offPlatform ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-prose text-xs text-ink/65">
            They&rsquo;re booked through Setnayan, so they&rsquo;re reachable right here — no need to
            share their contact details.
          </p>
          <Link
            href={threadId ? routes.dashboard.messages.detail(eventId, threadId) : routes.dashboard.messages.index(eventId)}
            className="rounded-md border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-ink/5"
          >
            Message them
          </Link>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <ul className="divide-y divide-ink/10" aria-label="Waiting to join">
          {pending.map((s) => (
            <li key={s.moderator_id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium text-ink">
                  {roleWord(s)}
                  {s.display_label ? ` · ${s.display_label}` : ''} · waiting to join
                </p>
                <p className="inline-flex items-center gap-1.5 font-mono text-xs text-ink/55">
                  <Mail aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                  {s.invitation_email ?? '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {s.invitation_token ? (
                  <code className="rounded bg-ink/[0.05] px-2 py-1 font-mono text-[10px] text-ink/70">
                    /host/accept/{s.invitation_token.slice(0, 12)}…
                  </code>
                ) : null}
                <form action={revokeHostInvite}>
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="moderator_id" value={s.moderator_id} />
                  <input type="hidden" name="vendor_id" value={vendor.vendor_id} />
                  <SubmitButton
                    pendingLabel="Removing…"
                    className="inline-flex items-center gap-1 rounded-md border border-terracotta/30 bg-cream px-2.5 py-1 text-xs text-terracotta-700 hover:bg-terracotta/10"
                  >
                    <Trash2 aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                    Revoke
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {accepted.length > 0 ? (
        <ul className="divide-y divide-ink/10" aria-label="Planning with you">
          {accepted.map((s) => (
            <li
              key={s.moderator_id}
              className="flex flex-wrap items-start justify-between gap-3 py-3"
              data-seat="coordinator"
            >
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-ink">{nameOf(s)}</p>
                <p className="sn-eye">{roleWord(s)}</p>
                <CoordinatorGrantChips permissions={s.permissions_json} />
              </div>
              {s.user_id !== user.id ? (
                <CoordinatorSeatControls
                  eventId={eventId}
                  moderatorId={s.moderator_id}
                  permissions={s.permissions_json}
                  returnTo={{ vendorId: vendor.vendor_id }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {!canPromote && pending.length === 0 && accepted.length === 0 && !promotePartlyRefused ? (
        <p className="text-xs text-ink/55">
          {BOOKED.has(vendor.status)
            ? `${vendor.vendor_name} has no email on this booking yet, so there is no one to invite.`
            : `Once ${vendor.vendor_name} is booked, you can invite them to plan with you here.`}
        </p>
      ) : null}

      <CoordinatorColourDomains
        people={grantees}
        setDomainAction={setCoordinatorColourDomain.bind(null, eventId)}
        rejectAction={rejectColourChange.bind(null, eventId)}
      />
    </section>
  );
}
