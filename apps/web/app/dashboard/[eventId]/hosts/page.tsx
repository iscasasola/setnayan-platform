import Link from 'next/link';
import { ReadRefusedNotice } from '@/app/dashboard/[eventId]/_components/read-refused-notice';
import { logQueryError } from '@/lib/supabase/error-detect';
import { siteOrigin } from '@/lib/site-origin';
import { redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ClipboardList, Mail, Trash2, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ROLE_SUBTYPE_LABEL,
  DELEGATE_AREAS,
  DELEGATE_AREA_LABEL,
  resolveAreaLevel,
  type ModeratorPermissions,
  type RoleSubtype,
} from '@/lib/event-moderators';
import { guestDisplayName } from '@/lib/guests';
import { ENTOURAGE_COLUMNS } from '@/lib/entourage';
import { revokeHostInvite, removeHost, setDelegateBudget, setDelegatePhotos } from './actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { ConsentGatedInviteForm } from './_components/consent-gated-invite-form';
import { isCoordinatorConsentGateEnabled } from '@/lib/coordinator-consent-gate';
import { CoordinatorColourDomains, type CoordinatorColourGrantee } from './_components/coordinator-colour-domains';
import { isColourDomain, type ColourChangeRow, type ColourDomain } from '@/lib/colour-access';
import { accessTag, guestAccessState, seatAccessWord, seatIsFullCohost } from '@/lib/guest-access';
import {
  setCoordinatorColourDomain,
  rejectColourChange,
} from '@/app/dashboard/[eventId]/colour-access-actions';
import { PageMasthead } from '@/app/_components/page-masthead';
import { eventNoun } from '@/lib/event-noun';
import { getMenuLifecyclePhase } from '@/lib/day-of-mode';
import { isOffPlatformSupplier } from '@/lib/supplier-invite-eligibility';
import { routes } from '@/lib/routes';
import { fetchEventViewer, isDelegateWithoutArea } from '@/lib/event-viewer.server';
import { GUEST_LIST_PART_VIEW, partHref } from '@/lib/pillar-parts';

export const metadata = { title: 'Hosts' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    invite_sent?: string;
    invite_error?: string;
    invite_revoked?: string;
    grant_updated?: string;
    host_removed?: string;
    token?: string;
    /** `hosts` = rendered as the Guest list's Hosts part (see below). */
    gview?: string;
  }>;
};

type ModeratorRow = {
  moderator_id: string;
  user_id: string | null;
  /** The guest-list row this seat was picked from (20271251336140), or null
   *  for the hired planner's email invite. */
  guest_id: string | null;
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
  marketplace_vendor_id: string | null;
};

type UserMini = {
  user_id: string;
  display_name: string | null;
  email: string | null;
};

/** The guest row a seat was picked from — its name and its role (the celebrant lock). */
type SeatGuest = {
  guest_id: string;
  display_name: string | null;
  first_name: string;
  last_name: string;
  role: string;
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
  const { data: modCheck, error: modCheckError } = await supabase
    .from('event_moderators')
    .select('moderator_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .is('removed_at', null)
    .maybeSingle();
  // ⚠ the moderator check. Absence DENIES rather than renders.
  if (modCheckError) {
    logQueryError('HostsPage.modCheck', modCheckError, { eventId }, 'graceful_degrade');
  }
  let isHost = !!modCheck;
  const { data: legacy, error: legacyError } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  // ⚠ the event's host list. Refused, the couple reads as having no co-hosts — people
  // ⚠ they invited to help simply are not shown.
  if (legacyError) {
    logQueryError('HostsPage.legacy', legacyError, { eventId }, 'graceful_degrade');
  }
  const isCouple =
    (legacy as { member_type: string } | null)?.member_type === 'couple';
  if (isCouple) isHost = true;
  if (!isHost) redirect('/dashboard');

  // ── THE GUEST LIST'S HOSTS PART (owner 2026-09-29) ──────────────────────
  // Hosts moved into the Guest list pillar (`lib/pillar-parts.ts`): the guest
  // list renders THIS page in its body at `?gview=hosts`, and passes that same
  // param here so the two know which one is drawing.
  //
  // Visited on its own, the page sends anybody who can see the guest list into
  // that part — every param carried, because the actions below redirect HERE
  // with `?invite_sent=1&token=…` and that banner must still show. A helper the
  // couple never shared the guest list with keeps this page exactly as it was:
  // the guest list would only tell them it isn't theirs to see, and managing
  // hosts would have no door left.
  const embedded = search.gview === 'hosts';
  if (!embedded) {
    const viewer = await fetchEventViewer(supabase, eventId, user.id);
    if (!isDelegateWithoutArea(viewer, 'guest_list')) {
      redirect(partHref(`/dashboard/${eventId}/guests`, search, { gview: GUEST_LIST_PART_VIEW.hosts }));
    }
  }

  const admin = createAdminClient();
  // Event name + moderator rows both key off eventId and don't depend on each
  // other — one parallel batch instead of two serial reads (owner perf pass
  // 2026-06-03). The accepted-host user lookup below stays sequential (it needs
  // the userIds derived from these rows).
  const [{ data: eventRow, error: eventRowError }, { data: rows, error: rowsError }, { data: logRows, error: logRowsError }, { data: coordRows, error: coordRowsError }] =
    await Promise.all([
      admin
        .from('events')
        // ⚠ the date columns are new here (2026-08-21): the masthead needs to
        // know whether the celebration has already happened, and this page had
        // no way to tell.
        .select('display_name, event_type, event_date, event_end_date, cleared_at, timezone')
        .eq('event_id', eventId)
        .maybeSingle(),
      // All moderator rows (accepted + pending); revoked (removed_at) filtered out.
      admin
        .from('event_moderators')
        .select(
          'moderator_id, user_id, guest_id, role_subtype, display_label, invitation_email, invitation_sent_at, invitation_expires_at, accepted_at, invitation_token, permissions_json',
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
      // `marketplace_vendor_id` is read so N2 (2026-09-11) can tell a
      // genuinely off-platform coordinator (this contact_email is the only
      // way to reach them — worth showing) from a Setnayan shop's own
      // account (a package lock copies the SHOP's login email into this same
      // column; that is not a couple-facing surface's to print).
      admin
        .from('event_vendors')
        .select('vendor_id, vendor_name, contact_email, marketplace_vendor_id')
        .eq('event_id', eventId)
        .eq('category', 'planner_coordinator')
        .in('status', ['contracted', 'deposit_paid', 'delivered', 'complete']),
    ]);
  if (eventRowError) {
    logQueryError('HostsPage.eventRow', eventRowError, { event_id: eventId }, 'graceful_degrade');
  }
  if (rowsError) {
    logQueryError('HostsPage.rows', rowsError, { event_id: eventId }, 'graceful_degrade');
  }
  if (logRowsError) {
    logQueryError('HostsPage.logRows', logRowsError, { event_id: eventId }, 'graceful_degrade');
  }
  if (coordRowsError) {
    logQueryError('HostsPage.coordRows', coordRowsError, { event_id: eventId }, 'graceful_degrade');
  }
  // A refused read here shortens the list of people who run this event, and the
  // page has no way to look incomplete on its own — somebody's co-host simply
  // is not there, and removing them is one tap away.
  const hostsPartlyRefused =
    Boolean(rowsError) || Boolean(logRowsError) || Boolean(coordRowsError);
  const eventName = (eventRow as { display_name: string | null } | null)?.display_name ?? 'Your event';
  const eventType = (eventRow as { event_type: string | null } | null)?.event_type ?? null;
  const eventNounWord = eventNoun(eventType);
  // ONE resolver, the same one the Overview, the rail and the guest list ask.
  const eventHasHappened =
    getMenuLifecyclePhase(
      (eventRow as { event_date?: string | null } | null)?.event_date ?? null,
      (eventRow as { cleared_at?: string | null } | null)?.cleared_at ?? null,
      (eventRow as { timezone?: string | null } | null)?.timezone ?? undefined,
      undefined,
      (eventRow as { event_end_date?: string | null } | null)?.event_end_date ?? null,
    ) === 'after';

  const all = (rows ?? []) as ModeratorRow[];
  // ⚠ LIVE IS `user_id`, NEVER `accepted_at` (migration 20271251336140):
  // event_moderators.accepted_at is DEFAULT now(), so it is stamped on a seat
  // nobody has joined yet — measured on prod, 2026-09-28. Split on the
  // timestamp, a waiting seat listed itself under "Current hosts" with no name,
  // and a guest-list seat (no invitation token — nothing for them to accept)
  // was never listed as waiting at all, under a sentence that described it.
  const accepted = all.filter((r) => r.user_id);
  const pending = all.filter((r) => !r.user_id && (r.guest_id || r.invitation_token));
  const activity = (logRows ?? []) as ActionLogRow[];

  // The guest rows the seats were picked from — ONE read for every seat, live
  // or waiting: their names (a waiting seat has no account to name it by) and
  // their roles (a celebrant co-host cannot be removed — `guestAccessState`,
  // the same rule the guest list draws its lock from).
  const seatGuestIds = all.map((r) => r.guest_id).filter((id): id is string => !!id);
  const guestById: Record<string, SeatGuest> = {};
  if (seatGuestIds.length > 0) {
    // The canonical guest column list (`lint:dup-rule` holds every guests read
    // to it) — this page uses the name parts and the role.
    const { data: guestRows, error: guestRowsError } = await admin
      .from('guests')
      .select(ENTOURAGE_COLUMNS)
      .eq('event_id', eventId)
      .in('guest_id', seatGuestIds);
    // ⚠ the seats' names. Refused, a real co-host renders without one.
    if (guestRowsError) {
      logQueryError('HostsPage.seatGuests', guestRowsError, { eventId }, 'graceful_degrade');
    }
    for (const g of (guestRows ?? []) as SeatGuest[]) guestById[g.guest_id] = g;
  }

  // Booked coordinators not yet invited (matched loosely by email).
  const invitedEmails = new Set(
    all.map((r) => (r.invitation_email ?? '').toLowerCase()).filter(Boolean),
  );
  const promotable = ((coordRows ?? []) as BookedCoordinator[]).filter(
    (c) => c.contact_email && !invitedEmails.has(c.contact_email.toLowerCase()),
  );
  // N2 (2026-09-11): `contact_email` on a marketplace-linked row is the
  // SHOP's own Setnayan account email (a package lock copies it in) — not a
  // business contact the shop chose to publish. An off-platform coordinator's
  // is exactly that, so the two are split here rather than gated in the JSX,
  // so neither branch can accidentally read the other's field.
  const promotableOffPlatform = promotable.filter((c) => isOffPlatformSupplier(c));
  const promotableOnPlatform = promotable.filter((c) => !isOffPlatformSupplier(c));

  // The in-app delegate path for an ON-PLATFORM coordinator: their existing
  // chat thread with the couple (they are already reachable there — no email
  // needs to be shown or used). `autoInviteCoordinator` already auto-creates
  // the delegate invite the moment their downpayment is marked (unless the
  // consent gate is active), so this link is the couple's way to reach them
  // in the meantime, never their raw contact address.
  const onPlatformThreadByVendorId = new Map<string, string>();
  if (promotableOnPlatform.length > 0) {
    const vendorIds = promotableOnPlatform
      .map((c) => c.marketplace_vendor_id)
      .filter((id): id is string => !!id);
    if (vendorIds.length > 0) {
      const { data: threadRows, error: threadRowsError } = await admin
        .from('chat_threads')
        .select('thread_id, vendor_profile_id')
        .eq('event_id', eventId)
        .in('vendor_profile_id', vendorIds);
      if (threadRowsError) {
        logQueryError('HostsPage.coordThreads', threadRowsError, { eventId }, 'graceful_degrade');
      }
      for (const t of (threadRows ?? []) as { thread_id: string; vendor_profile_id: string }[]) {
        onPlatformThreadByVendorId.set(t.vendor_profile_id, t.thread_id);
      }
    }
  }

  // Resolve user info for accepted hosts (display_name + email).
  const userIds = accepted.map((r) => r.user_id).filter((id): id is string => !!id);
  let usersById: Record<string, UserMini> = {};
  if (userIds.length > 0) {
    const { data: userRows, error: userRowsError } = await admin
      .from('users')
      .select('user_id, display_name, email')
      .in('user_id', userIds);
    // ⚠ the hosts' names. Refused, a real host renders without one.
    if (userRowsError) {
      logQueryError('HostsPage.userRows', userRowsError, { eventId }, 'graceful_degrade');
    }
    usersById = Object.fromEntries(
      ((userRows ?? []) as UserMini[]).map((u) => [u.user_id, u]),
    );
  }

  // ── MB16 · colour domains for the people helping run this celebration ────
  //
  // 🔑 WHO IS ELIGIBLE IS THE SHIPPED DEFINITION, NOT A NEW ONE:
  // `set_coordinator_colour_access` requires an `event_members` row with
  // `member_type = 'coordinator'`, and the grant table's composite FK CASCADEs
  // from it. `sync_delegate_membership` (20271251336140) mints that row for a
  // limited helper / hired planner seat — but a FULL co-host seat (bride,
  // groom, partner, co-host, celebrant) becomes a `couple` member, equal to the
  // creator, who already holds every colour. Listing one here offered switches
  // the gate refuses, under a card that calls them a coordinator (owner
  // 2026-09-30: "Claire Buanhog is not a coordinator" — she is the Bride).
  // `seatIsFullCohost` mirrors the SQL split, so the screen and the gate agree.
  let colourGrantees: CoordinatorColourGrantee[] = [];
  if (isCouple && accepted.length > 0) {
    const [{ data: colourGrantRows, error: colourGrantErr }, { data: colourChangeRows, error: colourChangeErr }] =
      await Promise.all([
        admin
          .from('event_colour_grants_coordinator')
          .select('user_id, domain, is_active')
          .eq('event_id', eventId)
          .eq('is_active', true),
        admin
          .from('event_colour_changes')
          .select(
            'change_id, domain, target_kind, target_key, target_index, old_value, new_value, actor_kind, actor_user_id, actor_label, vendor_id, created_at, reverted_at',
          )
          .eq('event_id', eventId)
          .eq('actor_kind', 'coordinator')
          .order('created_at', { ascending: false })
          .limit(30),
      ]);
    // ⚠ A refused read here renders as "nobody has any colour access" and as
    // "nobody has changed anything" — both indistinguishable from the truth,
    // and both wrong in the direction that matters.
    if (colourGrantErr) {
      logQueryError('HostsPage.colourGrants', colourGrantErr, { eventId }, 'graceful_degrade');
    }
    if (colourChangeErr) {
      logQueryError('HostsPage.colourChanges', colourChangeErr, { eventId }, 'graceful_degrade');
    }
    const activeByUser = new Map<string, ColourDomain[]>();
    for (const raw of (colourGrantRows ?? []) as { user_id: string; domain: string }[]) {
      if (!isColourDomain(raw.domain)) continue;
      const list = activeByUser.get(raw.user_id) ?? [];
      list.push(raw.domain);
      activeByUser.set(raw.user_id, list);
    }
    const changesByUser = new Map<string, ColourChangeRow[]>();
    for (const raw of (colourChangeRows ?? []) as (ColourChangeRow & {
      actor_user_id: string | null;
    })[]) {
      if (!raw.actor_user_id) continue;
      const list = changesByUser.get(raw.actor_user_id) ?? [];
      list.push(raw);
      changesByUser.set(raw.actor_user_id, list);
    }
    colourGrantees = accepted
      .filter((r): r is ModeratorRow & { user_id: string } => Boolean(r.user_id))
      // The couple's own rows are excluded: they already hold every colour on
      // the board through `couple_can_update_event`, and offering to grant
      // somebody something they already have is the kind of control that makes
      // a person doubt what the rest of the page means.
      .filter((r) => r.user_id !== user.id)
      // …and so is every other full co-host: the other half of the couple is
      // not a coordinator, and the database agrees.
      .filter((r) => !seatIsFullCohost(r.role_subtype))
      .map((r) => ({
        userId: r.user_id,
        displayName:
          r.display_label?.trim() ||
          usersById[r.user_id]?.display_name?.trim() ||
          usersById[r.user_id]?.email ||
          'This host',
        // The guest list's word for the seat (Limited helper), never
        // role_subtype's ("Viewer (read-only)"); the planner keeps its label.
        roleLine: `${seatAccessWord(r.role_subtype) ?? ROLE_SUBTYPE_LABEL[r.role_subtype] ?? 'Host'}${
          r.accepted_at
            ? ` · joined ${new Date(r.accepted_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`
            : ''
        }`,
        active: activeByUser.get(r.user_id) ?? [],
        changes: changesByUser.get(r.user_id) ?? [],
      }));
  }

  const justSent = search.invite_sent === '1';
  const sentToken = search.token ?? null;
  const inviteError = search.invite_error ?? null;
  const justRevoked = search.invite_revoked === '1';
  const grantUpdated = search.grant_updated === '1';
  const hostRemoved = search.host_removed === '1';
  const consentGateEnabled = await isCoordinatorConsentGateEnabled();

  // Build the share URL with a localhost-safe fallback. In production this
  // resolves to https://www.setnayan.com via SITE_URL; locally to localhost.
  // One resolver (lib/site-origin.ts). Same preview-points-at-production bug
  // as the Samahan invite link.
  const siteUrl = siteOrigin();
  const shareUrl = sentToken ? `${siteUrl}/host/accept/${sentToken}` : null;

  return (
    <section className="sn-col space-y-6">
      {/* Inside the guest list the page already has its way back — the menu. */}
      {embedded ? null : (
        <Link
          href={`/dashboard/${eventId}`}
          className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          Back to {eventName}
        </Link>
      )}

      {hostsPartlyRefused ? (
        <ReadRefusedNotice partial what="everyone who helps run this event" />
      ) : null}

      {/*
        ⚠ IT ASKED A MOVIE NIGHT WHO WAS PLANNING THE WEDDING.

        Two things were wrong in one line: the noun was hardcoded from the days
        when weddings were the only event type (the page has read `event_type`
        for other purposes all along), and it is present tense on a celebration
        that has already happened. `eventNoun` is the shipped resolver —
        weddings keep "wedding" byte-identical, everything else reads "event".
      */}
      <PageMasthead
        titleNode={
          <>
            {eventHasHappened
              ? `Who planned this ${eventNounWord} with you?`
              : `Who’s planning this ${eventNounWord} with you?`}
          </>
        }
        actions={
          /* THE DOORWAY. This page answers one fifth of "who is in my event";
             the roster above it answers all five. A page ships with its
             doorway, and the roster is not reachable from anywhere else. */
          <Link
            href={`/dashboard/${eventId}/people`}
            className="button-secondary inline-flex items-center gap-2"
          >
            <Users aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            Everyone in this event
          </Link>
        }
      />

      {justSent && shareUrl ? (
        <section className="space-y-3 rounded-2xl border border-success-300/60 bg-success-50/70 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-full bg-success-200/80 text-success-900">
              <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-success-950">
                Host seat saved.
              </p>
              <p className="text-xs text-success-900/85">
                {/* The only email invite left is the hired planner's (owner
                    2026-09-28: co-hosts come from the guest list). */}
                Share this link with your coordinator. They&apos;ll sign in, then accept.
              </p>
              <code className="block break-all rounded-md bg-cream/80 px-2 py-1.5 font-mono text-[11px] text-success-950">
                {shareUrl}
              </code>

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
          planner/coordinator vendors (feature-access program § 3).
          OFF-PLATFORM only prints/uses the stored contact_email (N2,
          2026-09-11) — for a marketplace-linked (Setnayan) coordinator that
          column holds their own account email, copied in by a package lock,
          never a business contact they chose to share. */}
      {isCouple && promotableOffPlatform.length > 0 ? (
        <section className="space-y-3 rounded-2xl border border-terracotta/25 bg-terracotta/[0.04] p-5">
          <header className="space-y-1">
            <p className="sn-eye">
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
            {promotableOffPlatform.map((c) => (
              <li
                key={c.vendor_id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-ink">{c.vendor_name}</p>
                  <p className="font-mono text-xs text-ink/55">{c.contact_email}</p>
                </div>
                <ConsentGatedInviteForm
                  enabled={consentGateEnabled}
                  forceCoordinator
                  coordinatorLabel={c.vendor_name}
                >
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="invitation_email" value={c.contact_email ?? ''} />
                  <input type="hidden" name="role_subtype" value="wedding_planner_external" />
                  <input type="hidden" name="delegate_kind" value="coordinator" />
                  <input type="hidden" name="display_label" value={c.vendor_name.slice(0, 80)} />
                  <SubmitButton
                    pendingLabel="Inviting…"
                    className="rounded-md bg-terracotta-700 px-3 py-1.5 text-xs font-semibold text-cream hover:bg-terracotta-800"
                  >
                    Invite as delegate
                  </SubmitButton>
                </ConsentGatedInviteForm>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* A booked coordinator who already has a Setnayan account — routed
          into the IN-APP delegate path (their existing conversation), never
          shown or asked to use their account email (N2, 2026-09-11).
          `autoInviteCoordinator` auto-creates their delegate invite the
          moment their downpayment is marked (unless the data-privacy consent
          gate is active); this is the couple's in-app way to reach them
          meanwhile. */}
      {isCouple && promotableOnPlatform.length > 0 ? (
        <section className="space-y-3 rounded-2xl border border-ink/10 bg-ink/[0.02] p-5">
          <header className="space-y-1">
            <p className="sn-eye">Your coordinator is on Setnayan</p>
            <p className="max-w-prose text-sm text-ink/65">
              They&rsquo;re booked through Setnayan, so they&rsquo;re reachable
              right here — no need to share their contact details.
            </p>
          </header>
          <ul className="divide-y divide-ink/10">
            {promotableOnPlatform.map((c) => {
              const threadId = c.marketplace_vendor_id
                ? onPlatformThreadByVendorId.get(c.marketplace_vendor_id)
                : undefined;
              const messageHref = threadId
                ? routes.dashboard.messages.detail(eventId, threadId)
                : routes.dashboard.messages.index(eventId);
              return (
                <li
                  key={c.vendor_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <p className="text-sm font-medium text-ink">{c.vendor_name}</p>
                  <Link
                    href={messageHref}
                    className="rounded-md border border-ink/15 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-ink/5"
                  >
                    Message them
                  </Link>
                </li>
              );
            })}
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
        <section className="sn-tile space-y-3 p-5">
          <header className="space-y-1">
            <p className="sn-eye">
              Waiting to join · {pending.length}
            </p>
            <p className="text-sm text-ink/65">
              Each starts as soon as they say yes to the invitation and sign in —
              nothing for them to accept. A hired planner accepts from their link.
            </p>
          </header>
          <ul className="divide-y divide-ink/10">
            {pending.map((row) => {
              // A seat picked from the guest list waits for THAT GUEST to join
              // (Attending + signed in) — there is no link and nothing to
              // revoke here: their Access is changed where it was set, on their
              // guest card, through the one writer (`setGuestAccess`).
              const seatGuest = row.guest_id ? guestById[row.guest_id] ?? null : null;
              if (row.guest_id) {
                const waiting = accessTag(
                  guestAccessState({
                    seat: { role_subtype: row.role_subtype, user_id: row.user_id, removed_at: null },
                    guestRole: seatGuest?.role ?? 'guest',
                    isCreator: false,
                  }),
                );
                return (
                  <li
                    key={row.moderator_id}
                    className="flex flex-wrap items-start justify-between gap-3 py-3"
                    data-waiting-guest-seat=""
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-ink">
                        {seatGuest ? guestDisplayName(seatGuest) : row.display_label ?? '—'}
                      </p>
                      <p className="text-xs text-ink/55">{waiting}</p>
                    </div>
                    <Link
                      href={`/dashboard/${eventId}/guests/${row.guest_id}`}
                      className="text-[11px] text-ink/55 underline hover:text-ink"
                    >
                      Change on their guest card
                    </Link>
                  </li>
                );
              }
              return (
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
                  {/* Only a host may revoke — the action's gate is `couple`. */}
                  {isCouple ? (
                  <form action={revokeHostInvite}>
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="moderator_id" value={row.moderator_id} />
                    <SubmitButton
                      pendingLabel="Removing…"
                      className="inline-flex items-center gap-1 rounded-md border border-terracotta/30 bg-cream px-2.5 py-1 text-xs text-terracotta-700-700 hover:bg-terracotta/10"
                    >
                      <Trash2 aria-hidden className="h-3 w-3" strokeWidth={1.75} />
                      Revoke
                    </SubmitButton>
                  </form>
                  ) : null}
                </div>
              </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {/* Current hosts */}
      <section className="sn-tile space-y-3 p-5">
        <header className="space-y-1">
          <p className="sn-eye">
            Current hosts · {accepted.length}
          </p>
        </header>
        {accepted.length === 0 ? (
          <p className="sn-row border-dashed p-4 text-sm text-ink/55">
            You&apos;re the only host so far. On the guest list, set a guest&apos;s Access to
            Co-host — your partner, a parent, anyone who should be part of planning.
          </p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {accepted.map((row) => {
              const userInfo = row.user_id ? usersById[row.user_id] ?? null : null;
              const seatGuest = row.guest_id ? guestById[row.guest_id] ?? null : null;
              // 🔑 A FULL CO-HOST IS A `couple` MEMBER (20271251336140), equal
              // to the creator: their access comes from the membership, never
              // from permissions_json, so the per-area chips and the budget /
              // photo grants below mean nothing for them — a "Budget · off"
              // chip on the Groom was a lie. Those controls are a
              // COORDINATOR's (hired planner, limited helper), whose access is
              // exactly what the map says.
              const fullCohost = seatIsFullCohost(row.role_subtype);
              // The guest list's lock, from the same rule the guest card draws
              // it from: a celebrant co-host stays (the database refuses the
              // removal — `a_celebrant_cohost_stays`), so no Remove is offered
              // that can only fail.
              const cohostLock = fullCohost
                ? guestAccessState({
                    seat: { role_subtype: row.role_subtype, user_id: row.user_id, removed_at: null },
                    guestRole: seatGuest?.role ?? 'guest',
                    isCreator: false,
                  }).lock
                : null;
              return (
                <li
                  key={row.moderator_id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3"
                  data-seat={fullCohost ? 'co-host' : 'coordinator'}
                >
                  <div className="space-y-1.5">
                    <p className="text-sm font-medium text-ink">
                      {userInfo?.display_name?.trim() ||
                        (seatGuest ? guestDisplayName(seatGuest) : null) ||
                        userInfo?.email ||
                        '—'}
                    </p>
                    {/* The guest list's Access word (Co-host · Limited helper),
                        never role_subtype's label — "Bride" and "Viewer
                        (read-only)" are the pre-2026-09-28 words for the same
                        seats. The hired planner keeps its own. */}
                    <p className="sn-eye">
                      {seatAccessWord(row.role_subtype) ?? ROLE_SUBTYPE_LABEL[row.role_subtype]}
                      {row.display_label ? ` · ${row.display_label}` : ''}
                    </p>
                    {fullCohost ? (
                      <p className="text-xs text-ink/55">The same access to this event as you.</p>
                    ) : (
                      <CoordinatorGrantChips permissions={row.permissions_json} />
                    )}
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
                      fullCohost ? (
                        <CohostSeatControls
                          eventId={eventId}
                          moderatorId={row.moderator_id}
                          guestId={row.guest_id}
                          lock={cohostLock}
                        />
                      ) : (
                        <CoordinatorSeatControls
                          eventId={eventId}
                          moderatorId={row.moderator_id}
                          permissions={row.permissions_json}
                        />
                      )
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* MB16 · colour domains, per person. Sits above Delegate activity: this
          is a CONTROL and that is a LOG, and a control buried under a log is
          one nobody finds. */}
      <CoordinatorColourDomains
        people={colourGrantees}
        setDomainAction={setCoordinatorColourDomain.bind(null, eventId)}
        rejectAction={rejectColourChange.bind(null, eventId)}
      />

      {/* Delegate activity — "your coordinator did X" (couple-visible). */}
      {isCouple && activity.length > 0 ? (
        <section className="sn-tile space-y-3 p-5">
          <header className="space-y-1">
            <p className="sn-eye">
              <ClipboardList aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Delegate activity
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

      {/* CO-HOSTS COME FROM THE GUEST LIST (owner 2026-09-28: "accepted guests
          can be assigned as host"). There is no email form here any more: the
          person picks a guest's Access on their card, and it goes live once that
          guest has said yes and signed in. Hired planners still come in through
          "Promote your coordinator" above, with the RA 10173 consent step. */}
      {isCouple ? (
      <section className="sn-tile space-y-3 p-5 sm:p-6" data-cohosts-from-guest-list>
        <p className="sn-eye">Add a co-host</p>
        <h2 className="text-xl font-semibold tracking-tight">Co-hosts come from your guest list</h2>
        <p className="max-w-prose text-sm text-ink/65">
          On the guest list, set a guest&apos;s <b className="font-semibold text-ink">Access</b> to
          Co-host (the same access as you) or Limited helper (can view, can&apos;t change
          anything) — in the Access column, or on their card. It starts as soon as they say
          yes to the invitation and sign in.
        </p>
        <Link href={`/dashboard/${eventId}/guests`} className="button-primary inline-flex h-11 items-center px-5">
          Open the guest list
        </Link>
      </section>
      ) : null}
    </section>
  );
}

/**
 * A COORDINATOR seat's per-area grants (hired planner, limited helper) — what
 * `permissions_json` says, area by area. Never drawn for a full co-host: their
 * access is the `couple` membership, and the map means nothing for them.
 */
function CoordinatorGrantChips({ permissions }: { permissions: ModeratorPermissions | null }) {
  const budgetLevel = resolveAreaLevel(permissions, 'budget');
  const grantChips = DELEGATE_AREAS.filter((a) => a !== 'budget')
    .map((a) => ({ area: a, level: resolveAreaLevel(permissions, a) }))
    .filter((g) => g.level !== null);
  return (
    <p className="flex flex-wrap gap-1">
      {grantChips.map((g) => (
        <span
          key={g.area}
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            g.level === 'edit' ? 'bg-terracotta/10 text-terracotta' : 'bg-ink/5 text-ink/60'
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
  );
}

/**
 * The couple's controls on a COORDINATOR seat: the budget and photo grants
 * (locked D1 · owner 2026-08-06) and removal with its reason (owner
 * 2026-06-22 — `abuse_misuse` is an admin signal). These are the only seats
 * the grants apply to; see `CohostSeatControls` for the other kind.
 */
function CoordinatorSeatControls({
  eventId,
  moderatorId,
  permissions,
}: {
  eventId: string;
  moderatorId: string;
  permissions: ModeratorPermissions | null;
}) {
  const budgetLevel = resolveAreaLevel(permissions, 'budget');
  // Owner ruling 2026-08-06 — the couple approves photo access per
  // delegate. Refused until they press it.
  const photosLevel = resolveAreaLevel(permissions, 'photos');
  return (
    <div className="flex items-center gap-2">
      <form action={setDelegateBudget}>
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="moderator_id" value={moderatorId} />
        <input type="hidden" name="budget_grant" value={budgetLevel ? 'off' : 'view'} />
        <SubmitButton pendingLabel="Saving…" className="text-[11px] text-ink/55 underline hover:text-ink">
          {budgetLevel ? 'Hide budget' : 'Allow budget view'}
        </SubmitButton>
      </form>
      <form action={setDelegatePhotos}>
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="moderator_id" value={moderatorId} />
        <input type="hidden" name="photos_grant" value={photosLevel ? 'off' : 'view'} />
        <SubmitButton pendingLabel="Saving…" className="text-[11px] text-ink/55 underline hover:text-ink">
          {photosLevel ? 'Hide event photos' : 'Allow event photos'}
        </SubmitButton>
      </form>
      <form action={removeHost} className="flex items-center gap-1.5">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="moderator_id" value={moderatorId} />
        <select
          name="reason"
          required
          defaultValue=""
          aria-label="Reason for removing this coordinator"
          className="rounded border border-ink/15 bg-cream px-1.5 py-1 text-[11px] text-ink"
        >
          <option value="" disabled>
            Reason…
          </option>
          <option value="no_longer_availing">No longer availing their services</option>
          <option value="abuse_misuse">Abuse / misuse</option>
          <option value="new_coordinator">We have a new coordinator</option>
          <option value="other">Other</option>
        </select>
        <SubmitButton pendingLabel="Removing…" className="text-[11px] text-terracotta-700 underline hover:text-terracotta">
          Remove
        </SubmitButton>
      </form>
    </div>
  );
}

/**
 * The couple's controls on a FULL CO-HOST seat (owner 2026-09-28: "host can
 * … remove a host at any point in time"). No grants — they hold the same
 * access as the creator — and no coordinator reasons: a co-host is not a
 * service being discontinued, so `removeHost` records its plain
 * `removed_by_couple`. A seat picked from the guest list is changed where it
 * was set (their card's Access line — the one writer); a celebrant co-host
 * stays, and the page says so instead of offering a Remove the database
 * refuses (`a_celebrant_cohost_stays`).
 */
function CohostSeatControls({
  eventId,
  moderatorId,
  guestId,
  lock,
}: {
  eventId: string;
  moderatorId: string;
  guestId: string | null;
  lock: 'creator' | 'celebrant' | null;
}) {
  if (lock === 'celebrant') {
    return <p className="text-[11px] text-ink/55">A celebrant stays a co-host.</p>;
  }
  if (guestId) {
    return (
      <Link
        href={`/dashboard/${eventId}/guests/${guestId}`}
        className="text-[11px] text-ink/55 underline hover:text-ink"
      >
        Change access on their guest card
      </Link>
    );
  }
  // A co-host seat from before the guest list held them (the old email
  // invite): no guest row to change it on, so removal stays here.
  return (
    <form action={removeHost}>
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="moderator_id" value={moderatorId} />
      <SubmitButton pendingLabel="Removing…" className="text-[11px] text-terracotta-700 underline hover:text-terracotta">
        Remove co-host
      </SubmitButton>
    </form>
  );
}
