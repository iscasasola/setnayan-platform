import Link from 'next/link';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import {
  ArrowLeft,
  CalendarHeart,
  Eye,
  Gift,
  Lock,
  Receipt,
  ShieldCheck,
  LifeBuoy,
  Activity as ActivityIcon,
  Scale,
  UserRound,
  Store,
  Sparkle,
} from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { logAdminDataAccess } from '@/lib/admin-data-access';
import { formatPhp } from '@/lib/orders';
import {
  fetchCompGrantsForUser,
  describeScope,
  describeSource,
  formatRetailValueCentavos,
} from '@/lib/comp-grants';
import {
  AccountTabs,
  LifecycleStrip,
  normalizeAccountTab,
  type LifecycleStep,
} from './_components/account-card-nav';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = { title: 'Account · Admin' };

/**
 * Admin Account Card — the HQ-facing per-user consolidated view (wave 4 of the
 * Customer Card respine · owner-approved 2026-07-03). Reachable by clicking a
 * user's email/name on /admin/users. Supersedes draft PR #2051.
 *
 * VIEW-ONLY by design — no write actions of any kind. Every account mutation
 * (confirm email · reset password · blacklist · delete · issue/revoke comp)
 * stays on the per-user action rows on /admin/users. This page only READS, so
 * an admin can see everything the platform has gathered about an account in one
 * place. Reads use the service-role admin client (this route is gated by
 * app/admin/layout.tsx, same as every /admin/* page).
 *
 * HARD PRIVACY WALL (owner-locked admin account-access model 2026-06-22):
 * this page NEVER renders chat/message bodies, shared thread files, face
 * vectors/enrollment data, or raw behavioral data — counts and statuses only.
 * The lint-admin-chat-guard enforces this at build time (it forbids the
 * message-body/attachment/face-vector readers anywhere under app/admin/**), so
 * this card can never quietly add one. A footer note restates the exclusions.
 */

// --- small formatters --------------------------------------------------------

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', {
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
  vendor: 'Vendor',
};

const ORDER_STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  draft: { label: 'Draft', tone: 'bg-ink/5 text-ink/60' },
  submitted: { label: 'Needs quote', tone: 'bg-amber-100 text-amber-800' },
  awaiting_payment: { label: 'Awaiting payment', tone: 'bg-amber-100 text-amber-800' },
  paid: { label: 'Paid', tone: 'bg-success-100 text-success-800' },
  fulfilled: { label: 'Fulfilled', tone: 'bg-success-100 text-success-800' },
  cancelled: { label: 'Cancelled', tone: 'bg-ink/5 text-ink/50' },
  refunded: { label: 'Refunded', tone: 'bg-mulberry/10 text-mulberry' },
};

const PAID_STATUSES = new Set(['paid', 'fulfilled']);

type Props = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function AdminAccountCardPage({ params, searchParams }: Props) {
  await requireAdmin();
  const { userId } = await params;
  const { tab: rawTab } = await searchParams;
  const tab = normalizeAccountTab(rawTab);
  const admin = createAdminClient();

  // --- profile (gate) --------------------------------------------------------
  const { data: user } = await admin
    .from('users')
    .select(
      'user_id, public_id, email, display_name, account_type, is_internal, is_team_member, marketing_opt_in, last_login_at, deleted_at, tour_completed_at, tour_seen_keys, created_at',
    )
    .eq('user_id', userId)
    .maybeSingle();
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
  const { data: memberships } = await admin
    .from('event_members')
    .select('event_id, member_type, joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true });
  const eventIds = Array.from(new Set((memberships ?? []).map((m) => m.event_id as string)));
  const roleByEvent = new Map<string, string>();
  (memberships ?? []).forEach((m) => roleByEvent.set(m.event_id as string, m.member_type as string));
  const firstJoinAt = (memberships?.[0]?.joined_at as string) ?? null;

  const { data: events } = eventIds.length
    ? await admin
        .from('events')
        .select('event_id, public_id, display_name, event_date, event_type, archived, created_at')
        .in('event_id', eventIds)
        .order('created_at', { ascending: false })
    : { data: [] as never[] };

  // --- vendor membership -----------------------------------------------------
  const { data: vendorTeam } = await admin
    .from('vendor_team_members')
    .select('vendor_profile_id, role, team_label')
    .eq('user_id', userId);
  const vendorProfileIds = Array.from(
    new Set((vendorTeam ?? []).map((v) => v.vendor_profile_id as string)),
  );
  const { data: vendorProfiles } = vendorProfileIds.length
    ? await admin
        .from('vendor_profiles')
        .select('vendor_profile_id, business_name, business_slug, is_published')
        .in('vendor_profile_id', vendorProfileIds)
    : { data: [] as never[] };
  const vendorNameById = new Map<string, string>();
  (vendorProfiles ?? []).forEach((v) =>
    vendorNameById.set(v.vendor_profile_id as string, (v.business_name as string) ?? 'Vendor'),
  );

  // --- comp grants -----------------------------------------------------------
  const grants = await fetchCompGrantsForUser(admin, userId).catch(() => []);
  const activeGrants = grants.filter((g) => !g.revoked_at);

  // --- orders + payments (Money) ---------------------------------------------
  const { data: orders } = await admin
    .from('orders')
    .select(
      'order_id, public_id, reference_code, description, service_key, status, requested_total_php, confirmed_total_php, comp_grant_id, created_at',
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: payments } = await admin
    .from('payments')
    .select('payment_id, order_id, amount_php, channel, status, paid_at, reviewed_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  const orderIds = (orders ?? []).map((o) => o.order_id as string);
  const { data: refunds } = orderIds.length
    ? await admin
        .from('order_refunds')
        .select('refund_id, order_id, refund_amount_centavos, status, refunded_at, created_at')
        .in('order_id', orderIds)
        .order('created_at', { ascending: false })
    : { data: [] as never[] };

  const firstPaidOrder = (orders ?? [])
    .filter((o) => PAID_STATUSES.has(o.status as string))
    .sort((a, b) => (a.created_at as string).localeCompare(b.created_at as string))[0];

  // --- support (read-only slices) --------------------------------------------
  const { data: helpTickets } = await admin
    .from('help_messages')
    .select('message_id, public_id, topic, subject, status, resolved_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: disputes } = await admin
    .from('vendor_disputes')
    .select('dispute_id, public_id, category, status, resolved_at, created_at')
    .eq('opened_by_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: userReports } = await admin
    .from('user_reports')
    .select('report_id, public_id, target_type, reason, status, reviewed_at, created_at')
    .eq('reporter_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: abuseFlags } = await admin
    .from('concierge_abuse_flags')
    .select('flag_id, similarity_score, status, created_at, reviewed_at')
    .eq('flagged_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  // --- governance: who viewed this account -----------------------------------
  const { data: accessLog } = await admin
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
  const { data: adminActions } = await admin
    .from('admin_audit_log')
    .select('audit_id, action, actor_user_id, created_at')
    .eq('target_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);

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

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-4">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/60 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          All users
        </Link>
      </div>

      {/* Sticky header + strip + tab rail */}
      <div className="sticky top-0 z-10 -mx-4 border-b border-ink/10 bg-cream/95 px-4 pb-3 pt-1 backdrop-blur sm:mx-0 sm:rounded-t-2xl sm:px-6">
        <header className="flex flex-wrap items-start gap-4 py-4">
          <div
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink text-lg font-semibold text-cream"
          >
            {initials(user.display_name as string, user.email as string)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-serif text-2xl text-ink">{displayName}</h1>
            <p className="mt-0.5 truncate text-sm text-ink/60">{user.email ?? '—'}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {roleByEvent.size > 0 && [...new Set([...roleByEvent.values()])].includes('couple') ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-success-100 px-2 py-1 text-xs font-medium text-success-800">
                  <UserRound className="h-3 w-3" strokeWidth={2} aria-hidden />
                  Host
                </span>
              ) : null}
              {vendorProfileIds.length > 0
                ? (vendorProfiles ?? []).map((v) => (
                    <span
                      key={v.vendor_profile_id as string}
                      className="inline-flex items-center gap-1 rounded-md bg-violet-100 px-2 py-1 text-xs font-medium text-violet-800"
                    >
                      <Store className="h-3 w-3" strokeWidth={2} aria-hidden />
                      Vendor member · {(v.business_name as string) ?? 'Vendor'}
                    </span>
                  ))
                : null}
              {user.is_internal ? (
                <span className="rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-800">
                  🟣 Internal
                </span>
              ) : null}
              {user.is_team_member ? (
                <span className="rounded-md bg-success-100 px-2 py-1 text-xs font-medium text-success-800">
                  Team pool
                </span>
              ) : null}
              {isAdminAcct ? (
                <span className="rounded-md bg-ink/15 px-2 py-1 text-xs font-medium text-ink">
                  Admin
                </span>
              ) : null}
              {/* Account status */}
              {user.deleted_at ? (
                <span className="rounded-md bg-mulberry/10 px-2 py-1 text-xs font-medium text-mulberry">
                  Deleted {fmtDate(user.deleted_at as string)}
                </span>
              ) : (
                <span className="rounded-md bg-success-50 px-2 py-1 text-xs font-medium text-success-700">
                  Active
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1 text-right">
            <span className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-2.5 py-1 text-xs text-ink/60">
              <Eye className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              Read-only
            </span>
            <span className="text-[11px] text-ink/45">Joined {fmtDate(user.created_at as string)}</span>
            <span className="font-mono text-[10px] text-ink/40">{user.public_id as string}</span>
          </div>
        </header>

        <LifecycleStrip steps={lifecycle} />

        <div className="mt-3">
          <AccountTabs userId={userId} active={tab} />
        </div>
      </div>

      {/* Tab body */}
      <div className="mt-6 space-y-6">
        {tab === 'overview' ? (
          <>
            {/* Profile & flags */}
            <section className="rounded-2xl border border-ink/10 bg-paper p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
                <ShieldCheck className="h-4 w-4 text-ink/60" strokeWidth={1.75} aria-hidden />
                Profile &amp; flags
              </h2>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-ink/50">Account type</dt>
                  <dd className="text-ink">{user.account_type as string}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/50">Onboarding</dt>
                  <dd className="text-ink">{onboarded ? 'Completed' : 'Not finished'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/50">Last login</dt>
                  <dd className="text-ink">{fmtDate(user.last_login_at as string)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/50">Marketing consent</dt>
                  <dd className="text-ink">{user.marketing_opt_in ? 'Opted in' : 'Opted out'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/50">Internal</dt>
                  <dd className="text-ink">{user.is_internal ? 'Yes' : 'No'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink/50">Team pool</dt>
                  <dd className="text-ink">{user.is_team_member ? 'Yes' : 'No'}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-ink/45">
                Change these on the{' '}
                <Link href="/admin/users" className="underline hover:text-ink">
                  Users list
                </Link>{' '}
                — this card is read-only.
              </p>
            </section>

            {/* Events & roles */}
            <section className="rounded-2xl border border-ink/10 bg-paper p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
                <CalendarHeart className="h-4 w-4 text-gold" strokeWidth={1.75} aria-hidden />
                Events &amp; roles
                <span className="font-normal text-ink/40">({(events ?? []).length})</span>
              </h2>
              {(events ?? []).length === 0 ? (
                <p className="text-sm text-ink/50">Not a member of any event yet.</p>
              ) : (
                <ul className="space-y-2">
                  {(events ?? []).map((e) => {
                    const role = roleByEvent.get(e.event_id as string);
                    return (
                      <li
                        key={e.event_id as string}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ink/[0.03] px-3 py-2"
                      >
                        <span className="min-w-0 truncate text-sm text-ink">
                          {(e.display_name as string) ?? 'Untitled event'}
                          {e.archived ? (
                            <span className="ml-2 text-xs text-ink/40">(archived)</span>
                          ) : null}
                        </span>
                        <span className="flex items-center gap-3 text-xs text-ink/55">
                          <span className="rounded bg-ink/5 px-1.5 py-0.5 font-medium text-ink/70">
                            {MEMBER_TYPE_LABEL[role ?? ''] ?? role ?? '—'}
                          </span>
                          <span>{(e.event_type as string) ?? 'wedding'}</span>
                          <span>{fmtDate(e.event_date as string)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Entitlements / comp grants */}
            <section className="rounded-2xl border border-ink/10 bg-paper p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
                <Gift className="h-4 w-4 text-mulberry" strokeWidth={1.75} aria-hidden />
                Entitlements &amp; comps
                <span className="font-normal text-ink/40">({activeGrants.length} active)</span>
              </h2>
              {grants.length === 0 ? (
                <p className="text-sm text-ink/50">No comp grants.</p>
              ) : (
                <ul className="space-y-2">
                  {grants.map((g) => (
                    <li
                      key={g.grant_id}
                      className={`rounded-lg px-3 py-2 text-sm ${
                        g.revoked_at ? 'bg-ink/[0.02] opacity-60' : 'bg-ink/[0.03]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-ink/80">
                          {describeScope(g.scope, g.scoped_skus)}
                        </span>
                        <span className="text-xs text-ink/55">
                          {formatRetailValueCentavos(g.retail_value_centavos)} ·{' '}
                          {describeSource(g.source)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink/50">
                        {g.rationale ?? 'No rationale recorded.'} · {fmtDate(g.created_at)}
                        {g.revoked_at ? ` · revoked ${fmtDate(g.revoked_at)}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}

        {tab === 'money' ? (
          <>
            <section className="rounded-2xl border border-ink/10 bg-paper p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
                  <Receipt className="h-4 w-4 text-ink/60" strokeWidth={1.75} aria-hidden />
                  Orders
                  <span className="font-normal text-ink/40">({(orders ?? []).length})</span>
                </h2>
                <Link
                  href="/admin/payments"
                  className="text-xs font-medium text-terracotta underline hover:text-ink"
                >
                  Reconcile in Payments
                </Link>
              </div>
              {(orders ?? []).length === 0 ? (
                <p className="text-sm text-ink/50">No orders placed.</p>
              ) : (
                <ul className="space-y-2">
                  {(orders ?? []).map((o) => {
                    const st = ORDER_STATUS_LABEL[o.status as string] ?? {
                      label: o.status as string,
                      tone: 'bg-ink/5 text-ink/60',
                    };
                    const total =
                      (o.confirmed_total_php as number | null) ??
                      (o.requested_total_php as number | null);
                    return (
                      <li
                        key={o.order_id as string}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ink/[0.03] px-3 py-2 text-sm"
                      >
                        <span className="min-w-0">
                          <span className="text-ink">
                            {(o.description as string) ?? (o.service_key as string) ?? 'Order'}
                          </span>
                          <span className="ml-2 font-mono text-[11px] text-ink/45">
                            {(o.reference_code as string) ?? (o.public_id as string)}
                          </span>
                        </span>
                        <span className="flex items-center gap-3">
                          <span className="text-ink/70">{formatPhp(total)}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${st.tone}`}
                          >
                            {st.label}
                          </span>
                          <span className="text-[11px] text-ink/45">
                            {fmtDate(o.created_at as string)}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-ink/10 bg-paper p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
                <Receipt className="h-4 w-4 text-ink/60" strokeWidth={1.75} aria-hidden />
                Logged payments
                <span className="font-normal text-ink/40">({(payments ?? []).length})</span>
              </h2>
              {(payments ?? []).length === 0 ? (
                <p className="text-sm text-ink/50">No payments logged.</p>
              ) : (
                <ul className="space-y-2">
                  {(payments ?? []).map((p) => (
                    <li
                      key={p.payment_id as string}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ink/[0.03] px-3 py-2 text-sm"
                    >
                      <span className="text-ink/70">
                        {formatPhp(p.amount_php as number)} · {(p.channel as string) ?? '—'}
                      </span>
                      <span className="flex items-center gap-3 text-xs text-ink/55">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            p.status === 'matched'
                              ? 'bg-success-100 text-success-800'
                              : p.status === 'rejected'
                                ? 'bg-mulberry/10 text-mulberry'
                                : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {p.status as string}
                        </span>
                        <span>{fmtDate((p.reviewed_at as string) ?? (p.created_at as string))}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-ink/10 bg-paper p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
                <Receipt className="h-4 w-4 text-mulberry" strokeWidth={1.75} aria-hidden />
                Refunds
                <span className="font-normal text-ink/40">({(refunds ?? []).length})</span>
              </h2>
              {(refunds ?? []).length === 0 ? (
                <p className="text-sm text-ink/50">No refunds issued.</p>
              ) : (
                <ul className="space-y-2">
                  {(refunds ?? []).map((r) => (
                    <li
                      key={r.refund_id as string}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ink/[0.03] px-3 py-2 text-sm"
                    >
                      <span className="text-ink/70">
                        {formatRetailValueCentavos(r.refund_amount_centavos as number)}
                      </span>
                      <span className="flex items-center gap-3 text-xs text-ink/55">
                        <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-medium text-ink/70">
                          {r.status as string}
                        </span>
                        <span>{fmtDate((r.refunded_at as string) ?? (r.created_at as string))}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}

        {tab === 'support' ? (
          <>
            <p className="text-xs text-ink/50">
              Read-only slices of this account&rsquo;s support history. Take action from the queue
              each row links to.
            </p>

            <SupportSection
              icon={<LifeBuoy className="h-4 w-4 text-ink/60" strokeWidth={1.75} aria-hidden />}
              title="Help tickets"
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
              icon={<Scale className="h-4 w-4 text-ink/60" strokeWidth={1.75} aria-hidden />}
              title="Disputes opened"
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
              icon={<ShieldCheck className="h-4 w-4 text-ink/60" strokeWidth={1.75} aria-hidden />}
              title="Reports filed"
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
              icon={<Sparkle className="h-4 w-4 text-ink/60" strokeWidth={1.75} aria-hidden />}
              title="AI abuse flags"
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
          </>
        ) : null}

        {tab === 'activity' ? (
          <section className="rounded-2xl border border-ink/10 bg-paper p-5">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
              <ActivityIcon className="h-4 w-4 text-ink/60" strokeWidth={1.75} aria-hidden />
              Activity · newest first
            </h2>
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
                  id: a.audit_id as string,
                  action: a.action as string,
                  at: a.created_at as string,
                })),
              })}
            />
          </section>
        ) : null}

        {tab === 'governance' ? (
          <>
            <section className="rounded-2xl border border-ink/10 bg-paper p-5">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-medium text-ink">
                <Eye className="h-4 w-4 text-ink/60" strokeWidth={1.75} aria-hidden />
                Who viewed this account
              </h2>
              <p className="mb-3 text-xs text-ink/50">
                RA 10173 right-to-know trail — every admin read of this account&rsquo;s data.
              </p>
              {(accessLog ?? []).length === 0 ? (
                <p className="text-sm text-ink/50">No admin views recorded yet.</p>
              ) : (
                <ul className="space-y-2">
                  {(accessLog ?? []).map((r) => {
                    const v = r.admin_user_id ? viewerById.get(r.admin_user_id as string) : null;
                    return (
                      <li
                        key={r.access_log_id as string}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ink/[0.03] px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate text-ink/80">
                          {v?.name ?? v?.email ?? 'Unknown admin'}
                        </span>
                        <span className="flex items-center gap-3 text-xs text-ink/55">
                          <span className="font-mono text-[11px] text-ink/45">
                            {(r.surface as string) ?? '—'}
                          </span>
                          <span>{fmtDate(r.created_at as string)}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-dashed border-ink/15 bg-paper/60 p-5">
              <h2 className="mb-1 flex items-center gap-2 text-sm font-medium text-ink/70">
                <Lock className="h-4 w-4 text-ink/40" strokeWidth={1.75} aria-hidden />
                Consent-to-fix &amp; account takeover
              </h2>
              <p className="text-sm text-ink/50">
                A logged, user-notified takeover (and the consent-to-fix handshake) land with
                Phases 2&ndash;3 of the account-access model. When live, those sessions will appear
                here alongside the read trail above.
              </p>
            </section>
          </>
        ) : null}
      </div>

      {/* Privacy-wall footer */}
      <footer className="mt-8 rounded-2xl border border-ink/10 bg-ink/[0.02] p-4">
        <p className="flex items-start gap-2 text-xs text-ink/55">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/40" strokeWidth={2} aria-hidden />
          <span>
            This view deliberately excludes chat &amp; message bodies, shared thread files, face
            recognition data, and raw behavioral data — even for HQ staff. Only counts and statuses
            are shown. Reading a message needs the account owner&rsquo;s consent or a logged,
            notified takeover. This page is read-only; account changes stay on the Users list.
          </span>
        </p>
      </footer>
    </div>
  );
}

// --- Support section (read-only, links into the queue) -----------------------

function SupportSection({
  icon,
  title,
  count,
  href,
  hrefLabel,
  empty,
  rows,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  href: string;
  hrefLabel: string;
  empty: string;
  rows: { key: string; primary: string; status: string; at: string | null }[];
}) {
  return (
    <section className="rounded-2xl border border-ink/10 bg-paper p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-medium text-ink">
          {icon}
          {title}
          <span className="font-normal text-ink/40">({count})</span>
        </h2>
        <Link href={href} className="text-xs font-medium text-terracotta underline hover:text-ink">
          {hrefLabel}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-ink/50">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ink/[0.03] px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate text-ink/80">{r.primary}</span>
              <span className="flex items-center gap-3 text-xs text-ink/55">
                <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-medium text-ink/70">
                  {r.status}
                </span>
                <span>{fmtDateShort(r.at)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function fmtDateShort(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
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
  input.payments.forEach((p) => push(`p-${p.id}`, 'Payment logged', p.status, p.at));
  input.adminActions.forEach((a) =>
    push(`a-${a.id}`, 'Admin action', a.action.replace(/_/g, ' '), a.at),
  );

  return items.sort((a, b) => b.sortAt - a.sortAt).slice(0, 60);
}

function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-ink/50">Nothing has happened on this account yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((e) => (
        <li key={e.id} className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ink/25"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{e.title}</p>
            {e.detail ? <p className="text-xs text-ink/55">{e.detail}</p> : null}
          </div>
          <span className="shrink-0 text-[11px] text-ink/45">{fmtDateShort(e.at)}</span>
        </li>
      ))}
    </ul>
  );
}
