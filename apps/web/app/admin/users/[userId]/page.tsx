import Link from 'next/link';
import { displayAccountEmail } from '@/lib/erasure/display-email';
import { readEventTypeNames, type EventTypeName } from '@/lib/admin/event-type-names.server';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import {
  Ban,
  Download,
  Gift,
  KeyRound,
  Lock,
  LogOut,
  MailCheck,
  Trash2,
  UserMinus,
  UserPlus,
  XCircle,
} from 'lucide-react';
import { PageMasthead } from '@/app/_components/page-masthead';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { ConfirmForm } from '@/app/_components/confirm-form';
import { ActionButton } from '@/components/action-button';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { logAdminDataAccess } from '@/lib/admin-data-access';
import { logQueryError } from '@/lib/supabase/error-detect';
import { ReadFailed } from '../../_components/read-failed';
import {
  RecordBack,
  RecordEmpty,
  RecordFacts,
  RecordFold,
  RecordFolds,
  RecordHead,
  RecordInitials,
  RecordNote,
  RecordRow,
  RecordRows,
  RecordSection,
} from '../../_components/record-kit';
import { formatPhp, PAYMENT_STATUS_LABEL } from '@/lib/orders';
import {
  fetchCompGrantsForUser,
  describeReach,
  describeScope,
  describeSource,
  formatRetailValueCentavos,
  type CompGrantRow,
} from '@/lib/comp-grants';
import { normalizeAccountTab, type AccountCardTab, type LifecycleStep } from './_components/account-card-nav';
import {
  blacklistUser,
  confirmUserEmail,
  deleteUser,
  forceSignOutUser,
  resetUserPassword,
  revokeCompGrant,
  toggleTeamMember,
} from '../actions';

import { requireAdmin } from '@/lib/admin/require-admin';
import { AccountHoldSection } from './_components/account-hold-section';
import { formatCount } from '@/lib/format-number';

export const metadata = { title: 'Account · Admin' };

/**
 * 👤 THE PERSON RECORD — People › Accounts › a person (owner 14 Nov 2026, "Yes, queue the builds": the approved
 * 13 Nov drawing `Setnayan-specs/prototypes/admin_pub/people.html`, screen `person`).
 *
 * One page of folds, in the drawing's order: Profile · Events · Orders & payments · Comps · Problems · Activity ·
 * Access · Flags · Admin log. It replaces the old five-tab rail (Overview · Money · Support · Activity · Privacy):
 * nothing was dropped, only moved — and an old `?tab=` address opens the fold that now holds that tab
 * (`FOLD_FOR_TAB`). The users-list row actions the drawing moves here (Confirm email · Temporary password ·
 * Sign out everywhere · Team · Blacklist · Delete · Comps) call the SAME server actions as the list; those actions
 * still land on People › Accounts with their result banner (their redirects live in `../actions.ts`).
 *
 * ⏸ Account hold (Suspend / Unsuspend, #7584) keeps its own section, unchanged — _components/account-hold-section.tsx.
 *
 * HARD PRIVACY WALL (owner-locked admin account-access model 2026-06-22):
 * this page NEVER renders chat/message bodies, shared thread files, face
 * vectors/enrollment data, or raw behavioral data — counts and statuses only.
 * The lint-admin-chat-guard enforces this at build time (it forbids the
 * message-body/attachment/face-vector readers anywhere under app/admin/**), so
 * this card can never quietly add one. A footer note restates the exclusions.
 *
 * ⚖ HONEST READS: every list says "Couldn't read" instead of its empty line when its own read was refused — the
 * comps included (it used to `.catch(() => [])`, so a refused read printed "No comp grants.").
 */

/** An old `?tab=` address opens the fold that now holds that tab. */
const FOLD_FOR_TAB: Record<AccountCardTab, string> = {
  overview: 'profile',
  money: 'money',
  support: 'problems',
  activity: 'activity',
  governance: 'access',
};

// --- small formatters --------------------------------------------------------

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function initials(name: string | null, email: string | null): string {
  const src = (name ?? email ?? '?').trim();
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

const MEMBER_TYPE_LABEL: Record<string, string> = {
  couple: 'Host',
  coordinator: 'Coordinator',
  guest: 'Guest',
  vendor: 'Supplier',
};

const ORDER_STATUS_LABEL: Record<string, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'quiet' },
  submitted: { label: 'Needs quote', tone: 'wait' },
  awaiting_payment: { label: 'Awaiting payment', tone: 'wait' },
  paid: { label: 'Paid', tone: 'ok' },
  fulfilled: { label: 'Fulfilled', tone: 'ok' },
  cancelled: { label: 'Cancelled', tone: 'quiet' },
  refunded: { label: 'Refunded', tone: 'no' },
};

const PAID_STATUSES = new Set(['paid', 'fulfilled']);

/** What each logged view was, in words. An unknown key shows as itself. */
const ACCESS_SURFACE_LABEL: Record<string, string> = {
  admin_users_detail: 'Opened in the users list',
  admin_account_card: 'Opened this account',
  admin_event_page: 'Opened their event',
  admin_supplier_page: 'Opened their shop',
  admin_user_data_export: 'Downloaded their data',
};

// 🔑 Stored values are not sentences: the card used to print `gcash`, `matched` and
// `admin_account_card` exactly as the columns hold them. An unmapped value falls
// back to the stored word — an empty badge would be worse than an ugly one.
const CHANNEL_WORD: Record<string, string> = { gcash: 'GCash', bdo: 'BDO', maya: 'Maya', bpi: 'BPI' };
function channelWord(channel: string | null): string {
  if (!channel) return '—';
  return CHANNEL_WORD[channel.toLowerCase()] ?? channel;
}
function paymentStatusWord(status: string): string {
  return (PAYMENT_STATUS_LABEL as Record<string, string>)[status] ?? status;
}
function surfaceWord(surface: string | null): string {
  if (!surface) return '—';
  return ACCESS_SURFACE_LABEL[surface] ?? surface;
}

type Props = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{
    tab?: string;
    // ⏸ Account suspend (owner 2026-11-13) — the outcome of the last Suspend / Unsuspend press.
    suspended?: string;
    unsuspended?: string;
    undo_reason?: string;
    undo_until?: string;
    suspend_error?: string;
  }>;
};

export default async function AdminAccountCardPage({ params, searchParams }: Props) {
  // 🏷 F-A-15: event types by their admin-managed names.
  const typeName = await readEventTypeNames();
  await requireAdmin();
  const { userId } = await params;
  const sp = await searchParams;
  const rawTab = sp.tab;
  const tab = normalizeAccountTab(rawTab);
  const admin = createAdminClient();

  // --- profile (gate) --------------------------------------------------------
  const { data: user, error: userError } = await admin
    .from('users')
    .select(
      'user_id, public_id, email, display_name, account_type, is_internal, is_team_member, marketing_opt_in, last_login_at, deleted_at, tour_completed_at, tour_seen_keys, created_at, suspended_at, suspended_until, suspended_reason',
    )
    .eq('user_id', userId)
    .maybeSingle();
  // 🔑 A refused profile read is NOT a missing account: `notFound()` here told
  // the owner a real, paying account did not exist.
  if (userError) {
    logQueryError('AdminAccountCardPage (profile)', userError);
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <PageMasthead title="Account" />
        <ReadFailed what="this account" />
      </div>
    );
  }
  if (!user) notFound();

  // Log the read (RA 10173 who-viewed-whom), post-response + non-fatal — the
  // exact pattern the /admin/users list already uses.
  after(async () => {
    const supabase = await createClient();
    const {
      data: { user: actingAdmin },
    } = await supabase.auth.getUser();
    await logAdminDataAccess(admin, {
      adminUserId: actingAdmin?.id ?? null,
      accessedUserId: userId,
      surface: 'admin_account_card',
      context: { tab },
    });
  });

  // --- events & roles --------------------------------------------------------
  const { data: memberships, error: membershipsError } = await admin
    .from('event_members')
    .select('event_id, member_type, joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });
  const eventIds = Array.from(new Set((memberships ?? []).map((m) => m.event_id as string)));
  const roleByEvent = new Map<string, string>();
  (memberships ?? []).forEach((m) => roleByEvent.set(m.event_id as string, m.member_type as string));
  const firstJoinAt = (memberships?.[0]?.joined_at as string) ?? null;

  const { data: events, error: eventsError } = eventIds.length
    ? await admin
        .from('events')
        .select('event_id, public_id, display_name, event_date, event_type, archived, created_at')
        .in('event_id', eventIds)
        .order('created_at', { ascending: false })
    : { data: [] as never[], error: null };

  // --- vendor membership -----------------------------------------------------
  const { data: vendorTeam, error: vendorTeamError } = await admin
    .from('vendor_team_members')
    .select('vendor_profile_id, role, team_label')
    .eq('user_id', userId);
  const vendorProfileIds = Array.from(
    new Set((vendorTeam ?? []).map((v) => v.vendor_profile_id as string)),
  );
  const { data: vendorProfiles, error: vendorProfilesError } = vendorProfileIds.length
    ? await admin
        .from('vendor_profiles')
        .select('vendor_profile_id, business_name, business_slug, is_published')
        .in('vendor_profile_id', vendorProfileIds)
    : { data: [] as never[], error: null };
  const vendorNameById = new Map<string, string>();
  (vendorProfiles ?? []).forEach((v) =>
    vendorNameById.set(v.vendor_profile_id as string, (v.business_name as string) ?? 'Supplier'),
  );

  // --- comp grants -----------------------------------------------------------
  // null = the read failed — NOT "no comps" (it used to `.catch(() => [])`).
  let grants: CompGrantRow[] | null = null;
  try {
    grants = await fetchCompGrantsForUser(admin, userId);
  } catch (err) {
    logQueryError('AdminAccountCardPage (comp grants)', err);
  }
  const activeGrants = (grants ?? []).filter((g) => !g.revoked_at);

  // --- a team grant already waiting on a second admin -------------------------
  // The same read the users list makes: without it, "Add to team" would look exactly as it did before it was
  // pressed. null = not measured — the button then stays, and a second press is refused by toggleTeamMember's own
  // one-pending-request check, never doubled.
  let teamGrantPending: boolean | null = null;
  if (!user.is_team_member && !user.is_internal) {
    const { data: pending, error: pendingError } = await admin
      .from('admin_approval_requests')
      .select('target_user_id')
      .eq('action_type', 'grant_team_member')
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .eq('target_user_id', userId);
    if (pendingError) logQueryError('AdminAccountCardPage (pending team grant)', pendingError);
    else teamGrantPending = (pending ?? []).length > 0;
  }

  // --- orders + payments (Money) ---------------------------------------------
  const { data: orders, error: ordersError } = await admin
    .from('orders')
    .select(
      'order_id, public_id, reference_code, description, service_key, status, requested_total_php, confirmed_total_php, comp_grant_id, created_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: payments, error: paymentsError } = await admin
    .from('payments')
    .select('payment_id, order_id, amount_php, channel, status, paid_at, reviewed_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  const orderIds = (orders ?? []).map((o) => o.order_id as string);
  const { data: refunds, error: refundsError } = orderIds.length
    ? await admin
        .from('order_refunds')
        .select('refund_id, order_id, refund_amount_centavos, status, refunded_at, created_at')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false })
    : { data: [] as never[], error: null };

  const firstPaidOrder = (orders ?? [])
    .filter((o) => PAID_STATUSES.has(o.status as string))
    .sort((a, b) => (a.created_at as string).localeCompare(b.created_at as string))[0];

  // --- support (read-only slices) --------------------------------------------
  const { data: helpTickets, error: helpError } = await admin
    .from('help_messages')
    .select('message_id, public_id, topic, subject, status, resolved_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: disputes, error: disputesError } = await admin
    .from('vendor_disputes')
    .select('dispute_id, public_id, category, status, resolved_at, created_at')
    .eq('opened_by_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: userReports, error: reportsError } = await admin
    .from('user_reports')
    .select('report_id, public_id, target_type, reason, status, reviewed_at, created_at')
    .eq('reporter_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: abuseFlags, error: abuseError } = await admin
    .from('concierge_abuse_flags')
    .select('flag_id, similarity_score, status, created_at, reviewed_at')
    .eq('flagged_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  // --- governance: who viewed this account -----------------------------------
  const { data: accessLog, error: accessLogError } = await admin
    .from('admin_data_access_log')
    .select('access_log_id, admin_user_id, surface, created_at')
    .eq('accessed_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  const viewerIds = Array.from(
    new Set((accessLog ?? []).map((r) => r.admin_user_id).filter((v): v is string => !!v)),
  );
  const { data: viewers } = viewerIds.length
    ? await admin
        .from('users')
        .select('user_id, display_name, email')
        .in('user_id', viewerIds)
    : { data: [] as never[] };
  const viewerById = new Map<string, { name: string | null; email: string | null }>();
  (viewers ?? []).forEach((v) =>
    viewerById.set(v.user_id as string, {
      name: (v.display_name as string) ?? null,
      email: (v.email as string) ?? null,
    }),
  );

  // --- activity: admin write-actions taken ON this account -------------------
  const { data: adminActions, error: adminActionsError } = await admin
    .from('admin_audit_log')
    // ⚠ `audit_log_id`, NOT `audit_id` — public.admin_audit_log has no
    // `audit_id`. PostgREST 42703s the whole query on an unknown column, so the
    // "admin actions taken on this account" timeline was permanently empty.
    .select('audit_log_id, action, actor_user_id, created_at')
    .eq('target_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

  // --- which reads were refused ----------------------------------------------
  // Each section below says "couldn't read" instead of its empty state when its
  // own read failed — an empty list is only ever printed for a list we counted.
  const reads: [string, unknown][] = [
    ['events', membershipsError ?? eventsError],
    ['supplier team', vendorTeamError ?? vendorProfilesError],
    ['orders', ordersError],
    ['payments', paymentsError],
    ['refunds', refundsError],
    ['help', helpError],
    ['disputes', disputesError],
    ['reports', reportsError],
    ['abuse', abuseError],
    ['access log', accessLogError],
    ['admin actions', adminActionsError],
  ];
  for (const [what, err] of reads) if (err) logQueryError(`AdminAccountCardPage (${what})`, err);
  const eventsUnread = Boolean(membershipsError || eventsError);
  const ordersUnread = Boolean(ordersError);
  const paymentsUnread = Boolean(paymentsError);
  const refundsUnread = Boolean(ordersError || refundsError);
  const accessLogUnread = Boolean(accessLogError);
  const rolesUnread = eventsUnread || Boolean(vendorTeamError || vendorProfilesError);

  // --- derive lifecycle ------------------------------------------------------
  const onboarded =
    !!user.tour_completed_at || ((user.tour_seen_keys as string[] | null)?.length ?? 0) > 0;
  const lifecycle: LifecycleStep[] = [
    { key: 'signup', label: 'Signed up', reached: true, at: user.created_at as string },
    {
      key: 'onboarded',
      label: 'Onboarded',
      reached: onboarded,
      at: (user.tour_completed_at as string) ?? null,
    },
    {
      key: 'first_event',
      label: 'First event',
      reached: eventIds.length > 0,
      at: firstJoinAt,
    },
    {
      key: 'first_purchase',
      label: 'First purchase',
      reached: !!firstPaidOrder,
      at: (firstPaidOrder?.created_at as string) ?? null,
    },
    {
      key: 'active',
      label: 'Active',
      reached: !user.deleted_at,
      at: (user.last_login_at as string) ?? null,
    },
  ];

  const displayName = (user.display_name as string) ?? 'Unnamed account';
  const isAdminAcct =
    user.is_internal || user.is_team_member || user.account_type === 'admin';

  const isInternal = Boolean(user.is_internal);
  const isDeleted = Boolean(user.deleted_at);
  // 🔒 F-W2 (#7677): an erased account's stored placeholder address is shown as words, never as the raw value.
  const email = displayAccountEmail(user.email as string | null) ?? null;
  const openFold = FOLD_FOR_TAB[tab];
  const supportFailed = Boolean(helpError || disputesError || reportsError || abuseError);
  const supportCount =
    (helpTickets ?? []).length + (disputes ?? []).length + (userReports ?? []).length + (abuseFlags ?? []).length;
  const unpaidOrders = (orders ?? []).filter((o) => o.status === 'awaiting_payment').length;
  const lastReached = [...lifecycle].reverse().find((s) => s.reached);

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6">
      <RecordBack href="/admin/accounts?tab=users" label="All users" />
      {/* 🔑 A RECORD PAGE IS THE ONE PLACE THE HEADING IS NOT A PAGE NAME. The visible name is the RECORD; only its
          `<h1>` moves to the masthead, which carries the same words at zero pixels. */}
      <PageMasthead titleNode={displayName} />
      <RecordHead
        small={`Person · ${(user.public_id as string | null) ?? 'no public ID'}`}
        name={displayName}
        lead={<RecordInitials text={initials(user.display_name as string, email)} />}
        line={`${email ?? '—'} · Joined ${fmtDate(user.created_at as string)}`}
        badges={
          <>
            {roleByEvent.size > 0 && [...new Set([...roleByEvent.values()])].includes('couple') ? (
              <Badge tone="ok">Host</Badge>
            ) : null}
            {(vendorProfiles ?? []).map((v) => (
              <Badge key={v.vendor_profile_id as string} tone="quiet">
                Supplier member · {(v.business_name as string) ?? 'Supplier'}
              </Badge>
            ))}
            {rolesUnread ? <Badge tone="wait">Couldn&rsquo;t read all roles</Badge> : null}
            {isInternal ? <Badge tone="quiet">🟣 Internal</Badge> : null}
            {user.is_team_member ? <Badge tone="ok">Team member</Badge> : null}
            {isAdminAcct ? <Badge tone="quiet">Admin</Badge> : null}
            {user.suspended_at && !isDeleted ? (
              <Badge tone="wait">⏸ Suspended</Badge>
            ) : isDeleted ? (
              <Badge tone="no">Deleted {fmtDate(user.deleted_at as string)}</Badge>
            ) : (
              <Badge tone="ok">Active</Badge>
            )}
          </>
        }
      />

      {isInternal ? (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-ink/[0.04] px-3 py-2 text-sm text-ink">
          <Lock className="mt-0.5 h-4 w-4 flex-none" strokeWidth={1.9} aria-hidden />
          <span>
            <b>This is an internal account (§ 10a)</b> — it already carries a permanent grant for every Setnayan
            service. Locked (internal): no delete, no blacklist, no per-SKU comps, no suspend.
          </span>
        </p>
      ) : null}

      {/* ⏸ Account hold (owner 2026-11-13 — prototype people.html cfm-suspend-person · cfm-unsuspend-person) */}
      {!isDeleted ? (
        <div className="mt-3">
          <AccountHoldSection
            userId={userId}
            name={displayName}
            isInternal={isInternal}
            suspendedAt={(user.suspended_at as string | null) ?? null}
            suspendedUntil={(user.suspended_until as string | null) ?? null}
            suspendedReason={(user.suspended_reason as string | null) ?? null}
            flash={{
              suspended: sp.suspended === '1',
              unsuspended: sp.unsuspended === '1',
              undoReason: sp.undo_reason ?? null,
              undoUntil: sp.undo_until ?? null,
              error: sp.suspend_error ?? null,
            }}
          />
        </div>
      ) : null}

      <div className="mt-3">
        <RecordFacts
          label="Account lifecycle"
          items={[
            [
              'Account lifecycle',
              <span key="l">
                {lifecycle.map((s, i) => (
                  <span key={s.key} className={s.reached ? 'text-ink' : 'text-ink/45'}>
                    {i > 0 ? ' → ' : ''}
                    {s === lastReached ? <b>{s.label}</b> : s.label}
                  </span>
                ))}
              </span>,
            ],
          ]}
        />
      </div>

      <RecordFolds>
        <RecordFold
          title="Profile"
          anchor="profile"
          defaultOpen={openFold === 'profile'}
          summary={`${(user.account_type as string) ?? '—'} · onboarding ${onboarded ? 'completed' : 'not finished'}`}
        >
          <RecordFacts
            items={[
              ['Account type', (user.account_type as string) ?? '—'],
              ['Onboarding', onboarded ? 'Completed' : 'Not finished'],
              ['Last login', fmtDate(user.last_login_at as string)],
              ['Marketing consent', user.marketing_opt_in ? 'Opted in' : 'Opted out'],
              ['Internal', isInternal ? 'Yes' : 'No'],
              ['Team member', user.is_team_member ? 'Yes' : 'No'],
              ['Public ID', (user.public_id as string | null) ?? '—'],
            ]}
          />
          <RecordNote>Internal and Team member are changed under Flags below.</RecordNote>
        </RecordFold>

        <RecordFold
          title="Events"
          anchor="events"
          summary={eventsUnread ? 'Couldn’t read' : formatCount((events ?? []).length)}
        >
          {eventsUnread ? (
            <ReadFailed what="this account’s events" />
          ) : (events ?? []).length === 0 ? (
            <RecordEmpty>Not a member of any event yet.</RecordEmpty>
          ) : (
            <RecordRows label="Events and roles">
              {(events ?? []).map((e) => {
                const role = roleByEvent.get(e.event_id as string);
                return (
                  <RecordRow
                    key={e.event_id as string}
                    href={`/admin/events/${(e.public_id as string | null) ?? (e.event_id as string)}`}
                    title={(e.display_name as string) ?? 'Untitled event'}
                    line={[
                      MEMBER_TYPE_LABEL[role ?? ''] ?? role ?? '—',
                      typeName(e.event_type as string | null),
                      fmtDate(e.event_date as string),
                      e.archived ? '(archived)' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  />
                );
              })}
            </RecordRows>
          )}
        </RecordFold>

        <RecordFold
          title="Orders & payments"
          anchor="money"
          defaultOpen={openFold === 'money'}
          summary={
            ordersUnread
              ? 'Couldn’t read'
              : `${formatCount((orders ?? []).length)} orders${unpaidOrders > 0 ? ` · ${formatCount(unpaidOrders)} awaiting payment` : ''}`
          }
        >
          <RecordSection
            label={`Orders (${ordersUnread ? '—' : formatCount((orders ?? []).length)})`}
            right={
              <Link href="/admin/payments" className="font-semibold text-mulberry underline-offset-2 hover:underline">
                Reconcile in Payments ›
              </Link>
            }
          >
            {ordersUnread ? (
              <ReadFailed what="this account’s orders" />
            ) : (orders ?? []).length === 0 ? (
              <RecordEmpty>No orders placed.</RecordEmpty>
            ) : (
              <RecordRows label="Orders">
                {(orders ?? []).map((o) => {
                  const st = ORDER_STATUS_LABEL[o.status as string] ?? { label: o.status as string, tone: 'quiet' as BadgeTone };
                  const total =
                    (o.confirmed_total_php as number | null) ?? (o.requested_total_php as number | null);
                  return (
                    <RecordRow
                      key={o.order_id as string}
                      title={(o.description as string) ?? (o.service_key as string) ?? 'Order'}
                      line={`${(o.reference_code as string) ?? (o.public_id as string)} · ${fmtDate(o.created_at as string)}`}
                      right={
                        <>
                          <b className="tabular-nums text-ink">{formatPhp(total)}</b>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </>
                      }
                    />
                  );
                })}
              </RecordRows>
            )}
          </RecordSection>

          <RecordSection label={`Logged payments (${paymentsUnread ? '—' : formatCount((payments ?? []).length)})`}>
            {paymentsUnread ? (
              <ReadFailed what="this account’s payments" />
            ) : (payments ?? []).length === 0 ? (
              <RecordEmpty>No payments logged.</RecordEmpty>
            ) : (
              <RecordRows label="Logged payments">
                {(payments ?? []).map((p) => (
                  <RecordRow
                    key={p.payment_id as string}
                    title={`${formatPhp(p.amount_php as number)} · ${channelWord(p.channel as string | null)}`}
                    line={fmtDate((p.reviewed_at as string) ?? (p.created_at as string))}
                    right={
                      <Badge tone={p.status === 'matched' ? 'ok' : p.status === 'rejected' ? 'no' : 'wait'}>
                        {paymentStatusWord(p.status as string)}
                      </Badge>
                    }
                  />
                ))}
              </RecordRows>
            )}
          </RecordSection>

          <RecordSection label={`Refunds (${refundsUnread ? '—' : formatCount((refunds ?? []).length)})`}>
            {refundsUnread ? (
              <ReadFailed what="this account’s refunds" />
            ) : (refunds ?? []).length === 0 ? (
              <RecordEmpty>No refunds issued.</RecordEmpty>
            ) : (
              <RecordRows label="Refunds">
                {(refunds ?? []).map((r) => (
                  <RecordRow
                    key={r.refund_id as string}
                    title={formatRetailValueCentavos(r.refund_amount_centavos as number)}
                    line={fmtDate((r.refunded_at as string) ?? (r.created_at as string))}
                    right={<Badge tone="quiet">{r.status as string}</Badge>}
                  />
                ))}
              </RecordRows>
            )}
          </RecordSection>
        </RecordFold>

        <RecordFold
          title="Comps"
          anchor="comps"
          summary={grants === null ? 'Couldn’t read' : `${formatCount(activeGrants.length)} active`}
        >
          {grants === null ? (
            <ReadFailed what="this account’s comp grants — it may already hold the very thing you are about to gift" />
          ) : grants.length === 0 ? (
            <RecordEmpty>No comp grants.</RecordEmpty>
          ) : (
            <RecordRows label="Entitlements and comps">
              {grants.map((g) => (
                <RecordRow
                  key={g.grant_id}
                  muted={Boolean(g.revoked_at)}
                  title={`${describeScope(g.scope, g.scoped_skus)} · ${describeReach(g)}`}
                  line={`${formatRetailValueCentavos(g.retail_value_centavos)} · ${describeSource(g.source)} · ${
                    g.rationale ?? 'No rationale recorded.'
                  } · ${fmtDate(g.created_at)}${g.revoked_at ? ` · revoked ${fmtDate(g.revoked_at)}` : ''}`}
                  right={
                    g.revoked_at ? null : (
                      <ConfirmForm
                        action={revokeCompGrant}
                        title="Revoke this grant?"
                        confirmLabel="Revoke"
                        message={`Revoke comp grant ${g.public_id}? This stops future uses but doesn't refund any order that's already used it.`}
                      >
                        <input type="hidden" name="grant_id" value={g.grant_id} />
                        <input type="hidden" name="reason" value="Revoked from the admin person record" />
                        <ActionButton tone="danger" icon={<XCircle aria-hidden strokeWidth={1.9} />} label="Revoke" type="submit" />
                      </ConfirmForm>
                    )
                  }
                />
              ))}
            </RecordRows>
          )}
          <div className="mt-3">
            {isInternal ? (
              <ActionButton tone="neutral" icon={<Gift aria-hidden strokeWidth={1.9} />} label="Give a comp" type="button" disabled />
            ) : (
              <ActionButton
                tone="brand"
                icon={<Gift aria-hidden strokeWidth={1.9} />}
                label="Give a comp"
                href={`/admin/accounts?tab=users&q=${encodeURIComponent(email ?? userId)}&expand=${userId}#grants-${userId}`}
              />
            )}
          </div>
        </RecordFold>

        <RecordFold
          title="Problems"
          anchor="problems"
          defaultOpen={openFold === 'problems'}
          summary={supportFailed ? 'Couldn’t read all' : `${formatCount(supportCount)} · support history`}
        >
          <RecordNote>Read-only slices of this account&rsquo;s support history. Take action from the queue each row links to.</RecordNote>
          <SupportSection
            title="Help tickets"
            loadFailed={Boolean(helpError)}
            icon={null}
            count={(helpTickets ?? []).length}
            href="/admin/help"
            hrefLabel="Open Help queue"
            empty="No help tickets."
            rows={(helpTickets ?? []).map((t) => ({
              key: t.message_id as string,
              primary: (t.subject as string) ?? (t.topic as string) ?? 'Ticket',
              status: t.status as string,
              at: (t.resolved_at as string) ?? (t.created_at as string),
            }))}
          />
          <SupportSection
            title="Disputes opened"
            loadFailed={Boolean(disputesError)}
            icon={null}
            count={(disputes ?? []).length}
            href="/admin/disputes"
            hrefLabel="Open Disputes queue"
            empty="No disputes opened."
            rows={(disputes ?? []).map((d) => ({
              key: d.dispute_id as string,
              primary: (d.category as string) ?? 'Dispute',
              status: d.status as string,
              at: (d.resolved_at as string) ?? (d.created_at as string),
            }))}
          />
          <SupportSection
            title="Reports filed"
            loadFailed={Boolean(reportsError)}
            icon={null}
            count={(userReports ?? []).length}
            href="/admin/user-reports"
            hrefLabel="Open Reports queue"
            empty="No reports filed."
            rows={(userReports ?? []).map((r) => ({
              key: r.report_id as string,
              primary: `${(r.target_type as string) ?? 'report'} · ${(r.reason as string) ?? ''}`,
              status: r.status as string,
              at: (r.reviewed_at as string) ?? (r.created_at as string),
            }))}
          />
          <SupportSection
            title="AI abuse flags"
            loadFailed={Boolean(abuseError)}
            icon={null}
            count={(abuseFlags ?? []).length}
            href="/admin/concierge-abuse"
            hrefLabel="Open abuse queue"
            empty="No abuse flags."
            rows={(abuseFlags ?? []).map((f) => ({
              key: f.flag_id as string,
              primary: `Similarity ${Math.round((f.similarity_score as number) * 100)}%`,
              status: f.status as string,
              at: (f.reviewed_at as string) ?? (f.created_at as string),
            }))}
          />
        </RecordFold>

        <RecordFold title="Activity" anchor="activity" defaultOpen={openFold === 'activity'} summary="newest first">
          {ordersUnread || paymentsUnread || adminActionsError ? (
            <ReadFailed what="part of this account’s history, so the timeline below may be missing entries" />
          ) : null}
          <ActivityTimeline
            items={buildActivity({
              createdAt: user.created_at as string,
              onboardedAt: (user.tour_completed_at as string) ?? null,
              firstJoinAt,
              orders: (orders ?? []).map((o) => ({
                id: o.order_id as string,
                label: (o.description as string) ?? (o.service_key as string) ?? 'Order',
                status: o.status as string,
                at: o.created_at as string,
              })),
              payments: (payments ?? []).map((p) => ({
                id: p.payment_id as string,
                status: p.status as string,
                at: (p.paid_at as string) ?? (p.created_at as string),
              })),
              adminActions: (adminActions ?? []).map((a) => ({
                id: a.audit_log_id as string,
                action: a.action as string,
                at: a.created_at as string,
              })),
            })}
          />
        </RecordFold>

        <RecordFold
          title="Access"
          anchor="access"
          defaultOpen={openFold === 'access'}
          summary="confirm email · temporary password · sign out · their data"
        >
          <RecordRows label="Access">
            {!isInternal && !isDeleted ? (
              <>
                <RecordRow
                  title="Confirm email"
                  line="Force-confirm (idempotent — useful when the email doesn’t arrive)"
                  right={
                    <form action={confirmUserEmail}>
                      <input type="hidden" name="user_id" value={userId} />
                      <ActionButton tone="neutral" icon={<MailCheck aria-hidden strokeWidth={1.9} />} label="Confirm email" type="submit" />
                    </form>
                  }
                />
                <RecordRow
                  title="Temporary password"
                  line="Shown once, at the top of People › Accounts · copy it then"
                  right={
                    <ConfirmForm
                      action={resetUserPassword}
                      title="Generate a temporary password?"
                      confirmLabel="Generate"
                      destructive={false}
                      message={`A temporary password for ${email ?? 'this user'} is shown once, at the top of People › Accounts. Share it via a secure channel (DM, in person, encrypted); they sign in with it, then change it from Profile → Personal info → Change password. Never in the URL, never emailed.`}
                    >
                      <input type="hidden" name="user_id" value={userId} />
                      <ActionButton tone="warn" icon={<KeyRound aria-hidden strokeWidth={1.9} />} label="Generate" type="submit" />
                    </ConfirmForm>
                  }
                />
                <RecordRow
                  title="Sign out everywhere"
                  line="Every device · data untouched · for compromised accounts"
                  right={
                    <ConfirmForm
                      action={forceSignOutUser}
                      title="Revoke all sessions?"
                      confirmLabel="Sign out everywhere"
                      message={`Force sign-out ${email ?? 'this user'}? They are signed out on EVERY device immediately — use for compromised accounts. Their data is untouched; they can log back in.`}
                    >
                      <input type="hidden" name="user_id" value={userId} />
                      <ActionButton tone="danger" icon={<LogOut aria-hidden strokeWidth={1.9} />} label="Sign out" type="submit" />
                    </ConfirmForm>
                  }
                />
              </>
            ) : null}
            {/* RA 10173 — a "send me my data" request that reached the DPO by email, or from someone who can't sign
                in. A plain link to a route handler: no client code, no server action. Downloading it is logged. */}
            <RecordRow
              title="Their data"
              line="For a data request sent to us. The same file they get from Profile, without the text of their messages. Downloading it is recorded on this account."
              right={
                <a
                  href={`/admin/users/${userId}/export`}
                  download
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-ink px-4 text-sm font-medium text-cream hover:bg-ink/90"
                >
                  <Download className="h-4 w-4" strokeWidth={2} aria-hidden />
                  Download their data
                </a>
              }
            />
          </RecordRows>

          <RecordSection label="Who viewed this account">
            <RecordNote>RA 10173 right-to-know trail — every admin read of this account&rsquo;s data.</RecordNote>
            {accessLogUnread ? (
              <ReadFailed what="who viewed this account" />
            ) : (accessLog ?? []).length === 0 ? (
              <RecordEmpty>No admin views recorded yet.</RecordEmpty>
            ) : (
              <RecordRows label="Who viewed this account">
                {(accessLog ?? []).map((r) => {
                  const v = r.admin_user_id ? viewerById.get(r.admin_user_id as string) : null;
                  return (
                    <RecordRow
                      key={r.access_log_id as string}
                      title={v?.name ?? v?.email ?? 'Unknown admin'}
                      line={`${surfaceWord(r.surface as string | null)} · ${fmtDate(r.created_at as string)}`}
                    />
                  );
                })}
              </RecordRows>
            )}
          </RecordSection>
          <RecordNote>
            Consent-to-fix &amp; account takeover: a logged, user-notified takeover (and the consent-to-fix handshake)
            land with Phases 2&ndash;3 of the account-access model. When live, those sessions will appear here alongside
            the read trail above.
          </RecordNote>
        </RecordFold>

        <RecordFold title="Flags" anchor="flags" summary="internal · team member · blacklist · delete">
          <RecordRows label="Flags">
            <RecordRow
              title="Internal (§ 10a)"
              line="Owner/spouse tier — a permanent unlimited-use grant that bypasses billing."
              right={<Badge tone="quiet">{isInternal ? 'Internal' : 'Not internal'}</Badge>}
            />
            {isInternal ? (
              <RecordRow title="Everything else" line="Locked (internal)" />
            ) : isDeleted ? null : (
              <>
                <RecordRow
                  title="Team member"
                  line={
                    user.is_team_member
                      ? 'Full Setnayan HQ console access. Removing is immediate.'
                      : 'Adding opens a two-admin approval.'
                  }
                  right={
                    !user.is_team_member && teamGrantPending ? (
                      <ActionButton tone="neutral" icon={<UserPlus aria-hidden strokeWidth={1.9} />} label="Team · waiting on 2nd admin" href="/admin/approvals" />
                    ) : (
                      <form action={toggleTeamMember}>
                        <input type="hidden" name="user_id" value={userId} />
                        <input type="hidden" name="desired" value={user.is_team_member ? 'false' : 'true'} />
                        <ActionButton
                          tone="neutral"
                          icon={user.is_team_member ? <UserMinus aria-hidden strokeWidth={1.9} /> : <UserPlus aria-hidden strokeWidth={1.9} />}
                          label={user.is_team_member ? 'Remove from team' : 'Add to team'}
                          type="submit"
                        />
                      </form>
                    )
                  }
                />
                <RecordRow
                  title="Blacklist"
                  line="Hard-delete AND block the email from signing up again. Reverse via People › Blocked → Unblacklist."
                  right={
                    <ConfirmForm
                      action={blacklistUser}
                      title="Blacklist this email?"
                      confirmLabel="Blacklist & delete"
                      message={`Blacklist ${email ?? 'this user'}? The user is hard-deleted AND the email is permanently blocked from signing up again. Reverse via the Blacklisted filter → Unblacklist.`}
                    >
                      <input type="hidden" name="user_id" value={userId} />
                      <ActionButton tone="danger" icon={<Ban aria-hidden strokeWidth={1.9} />} label="Blacklist" type="submit" />
                    </ConfirmForm>
                  }
                />
                <RecordRow
                  title="Delete account"
                  line="Their identity is gone · the email is freed for re-signup · not reversible from here"
                  right={
                    <ConfirmForm
                      action={deleteUser}
                      title="Hard-delete this account?"
                      confirmLabel="Delete permanently"
                      message={`Hard-delete ${email ?? 'this user'}? Their auth identity is gone; all related data cascade-deletes; the EMAIL is freed for re-signup (e.g., switching from supplier to customer). Not reversible from this page.`}
                    >
                      <input type="hidden" name="user_id" value={userId} />
                      <ActionButton tone="danger" icon={<Trash2 aria-hidden strokeWidth={1.9} />} label="Delete" type="submit" />
                    </ConfirmForm>
                  }
                />
              </>
            )}
          </RecordRows>
        </RecordFold>

        <RecordFold
          title="Admin log"
          anchor="admin-log"
          summary={adminActionsError ? 'Couldn’t read' : `${formatCount((adminActions ?? []).length)} actions on this account`}
        >
          {adminActionsError ? (
            <ReadFailed what="the admin actions on this account" />
          ) : (adminActions ?? []).length === 0 ? (
            <RecordEmpty>No admin action on this account yet.</RecordEmpty>
          ) : (
            <RecordRows label="Admin actions on this account">
              {(adminActions ?? []).map((a) => (
                <RecordRow
                  key={a.audit_log_id as string}
                  title={(a.action as string).replace(/_/g, ' ')}
                  line={fmtDate(a.created_at as string)}
                />
              ))}
            </RecordRows>
          )}
        </RecordFold>
      </RecordFolds>

      {/* Privacy-wall footer */}
      <p className="mt-6 flex items-start gap-2 text-xs text-ink/55">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/40" strokeWidth={2} aria-hidden />
        <span>
          This view deliberately excludes chat &amp; message bodies, shared thread files, face recognition data, and raw
          behavioral data — even for HQ staff. Only counts and statuses are shown. Reading a message needs the account
          owner&rsquo;s consent or a logged, notified takeover.
        </span>
      </p>
    </div>
  );
}

// --- Support section (read-only, links into the queue) -----------------------

function SupportSection({
  title,
  count,
  href,
  hrefLabel,
  empty,
  rows,
  loadFailed,
}: {
  loadFailed: boolean;
  icon: React.ReactNode;
  title: string;
  count: number;
  href: string;
  hrefLabel: string;
  empty: string;
  rows: { key: string; primary: string; status: string; at: string | null }[];
}) {
  return (
    <RecordSection
      label={`${title} (${loadFailed ? '—' : formatCount(count)})`}
      right={
        <Link href={href} className="font-semibold text-mulberry underline-offset-2 hover:underline">
          {hrefLabel} ›
        </Link>
      }
    >
      {loadFailed ? (
        <ReadFailed what={`${title.toLowerCase()}`} />
      ) : rows.length === 0 ? (
        <RecordEmpty>{empty}</RecordEmpty>
      ) : (
        <RecordRows label={title}>
          {rows.map((r) => (
            <RecordRow key={r.key} title={r.primary} line={fmtDate(r.at)} right={<Badge tone="quiet">{r.status}</Badge>} />
          ))}
        </RecordRows>
      )}
    </RecordSection>
  );
}

// --- Activity timeline -------------------------------------------------------

type ActivityItem = { id: string; title: string; detail: string | null; at: string; sortAt: number };

function buildActivity(input: {
  createdAt: string;
  onboardedAt: string | null;
  firstJoinAt: string | null;
  orders: { id: string; label: string; status: string; at: string }[];
  payments: { id: string; status: string; at: string }[];
  adminActions: { id: string; action: string; at: string }[];
}): ActivityItem[] {
  const items: ActivityItem[] = [];
  const push = (id: string, title: string, detail: string | null, at: string | null) => {
    if (!at) return;
    items.push({ id, title, detail, at, sortAt: new Date(at).getTime() || 0 });
  };

  push('signup', 'Account created', null, input.createdAt);
  push('onboarded', 'Finished onboarding', null, input.onboardedAt);
  push('first_event', 'Joined first event', null, input.firstJoinAt);
  input.orders.forEach((o) => push(`o-${o.id}`, 'Order placed', `${o.label} · ${o.status}`, o.at));
  input.payments.forEach((p) =>
    push(`p-${p.id}`, 'Payment logged', paymentStatusWord(p.status), p.at),
  );
  input.adminActions.forEach((a) =>
    push(`a-${a.id}`, 'Admin action', a.action.replace(/_/g, ' '), a.at),
  );

  return items.sort((a, b) => b.sortAt - a.sortAt).slice(0, 60);
}

function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <RecordEmpty>Nothing has happened on this account yet.</RecordEmpty>;
  }
  return (
    <RecordRows label="Activity, newest first">
      {items.map((e) => (
        <RecordRow
          key={e.id}
          title={e.title}
          line={e.detail ? `${e.detail} · ${fmtDate(e.at)}` : fmtDate(e.at)}
        />
      ))}
    </RecordRows>
  );
}
