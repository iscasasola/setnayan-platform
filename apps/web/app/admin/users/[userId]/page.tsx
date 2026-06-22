import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ShieldCheck,
  Gift,
  CalendarHeart,
  Receipt,
  Eye,
  Lock,
} from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Read-only consolidated account view — admin account-access model Phase 1c
 * (Admin_Account_Access_Model_2026-06-22.md · DECISION_LOG 2026-06-22).
 *
 * The "open their account and see all the data we've gathered, read-only" page.
 * VIEW-ONLY by design — every write still routes through the per-row actions on
 * the list (and, in later phases, consent-to-fix / a logged takeover). Reads via
 * the admin client (this route is gated by app/admin/layout.tsx).
 *
 * Deliberately does NOT surface the off-limits classes (chat message bodies,
 * thread attachments, raw behavioral/decision data, raw face vectors) — those
 * stay sealed even from an admin viewing an account (enforced by the
 * lint-admin-chat-guard + RLS). This page shows only profile, events, orders,
 * gifts, and the who-viewed-this-account access trail.
 */

function peso(centavos: number | null | undefined): string {
  if (typeof centavos !== 'number') return '—';
  return `₱${(centavos / 100).toLocaleString('en-PH')}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

type SearchProps = { params: Promise<{ userId: string }> };

export default async function AdminUserAccountPage({ params }: SearchProps) {
  const { userId } = await params;
  const admin = createAdminClient();

  const { data: user } = await admin
    .from('users')
    .select('user_id, email, display_name, account_type, is_internal, is_team_member, created_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (!user) notFound();

  const { data: memberships } = await admin
    .from('event_members')
    .select('event_id, member_type')
    .eq('user_id', userId);
  const eventIds = Array.from(new Set((memberships ?? []).map((m) => m.event_id as string)));

  const { data: events } = eventIds.length
    ? await admin
        .from('events')
        .select('event_id, display_name, event_date, event_type, setnayan_ai_active, created_at')
        .in('event_id', eventIds)
        .order('created_at', { ascending: false })
    : { data: [] };

  const { data: grants } = await admin
    .from('comp_grants')
    .select('public_id, source, scope, scoped_skus, retail_value_centavos, rationale, created_at, revoked_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const { data: orders } = await admin
    .from('orders')
    .select('order_id, service_key, status, confirmed_total_php, comp_grant_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: accessLog } = await admin
    .from('admin_data_access_log')
    .select('admin_user_id, surface, created_at')
    .eq('accessed_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  const activeGrants = (grants ?? []).filter((g) => !g.revoked_at);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-ink/60 hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          All users
        </Link>
      </div>

      <header className="rounded-2xl border border-ink/10 bg-cream p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl text-ink">{user.display_name ?? 'Unnamed account'}</h1>
            <p className="mt-0.5 text-sm text-ink/60">{user.email ?? '—'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-ink/5 px-2 py-1 text-xs font-medium text-ink/70">
              {user.account_type ?? 'customer'}
            </span>
            {user.is_internal ? (
              <span className="rounded-md bg-mulberry/10 px-2 py-1 text-xs font-medium text-mulberry">
                Internal
              </span>
            ) : null}
            {user.is_team_member ? (
              <span className="rounded-md bg-gold/15 px-2 py-1 text-xs font-medium text-gold">Team</span>
            ) : null}
          </div>
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-2.5 py-1 text-xs text-ink/60">
          <Eye className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          Read-only view · joined {fmtDate(user.created_at)}
        </p>
      </header>

      <section className="rounded-2xl border border-ink/10 bg-paper p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
          <CalendarHeart className="h-4 w-4 text-gold" strokeWidth={1.75} aria-hidden />
          Events &amp; progress
        </h2>
        {(events ?? []).length === 0 ? (
          <p className="text-sm text-ink/50">No events yet.</p>
        ) : (
          <ul className="space-y-2">
            {(events ?? []).map((e) => (
              <li
                key={e.event_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-ink/[0.03] px-3 py-2"
              >
                <span className="text-sm text-ink">{e.display_name ?? 'Untitled event'}</span>
                <span className="flex items-center gap-3 text-xs text-ink/55">
                  <span>{e.event_type ?? 'wedding'}</span>
                  <span>{fmtDate(e.event_date)}</span>
                  {e.setnayan_ai_active ? (
                    <span className="rounded bg-gold/15 px-1.5 py-0.5 font-medium text-gold">AI active</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-ink/10 bg-paper p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
          <Gift className="h-4 w-4 text-mulberry" strokeWidth={1.75} aria-hidden />
          Gifts &amp; comps
          <span className="font-normal text-ink/40">({activeGrants.length} active)</span>
        </h2>
        {(grants ?? []).length === 0 ? (
          <p className="text-sm text-ink/50">No comp grants.</p>
        ) : (
          <ul className="space-y-2">
            {(grants ?? []).map((g) => (
              <li key={g.public_id} className="rounded-lg bg-ink/[0.03] px-3 py-2 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-ink/80">
                    {g.scope === 'all_services'
                      ? 'All services'
                      : `${g.scoped_skus?.length ?? 0} service(s)`}
                    {g.revoked_at ? <span className="ml-2 text-danger-700">· revoked</span> : null}
                  </span>
                  <span className="text-xs text-ink/45">
                    {g.source} · {peso(g.retail_value_centavos)} · {fmtDate(g.created_at)}
                  </span>
                </div>
                {g.rationale ? <p className="mt-1 text-xs text-ink/55">{g.rationale}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-ink/10 bg-paper p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
          <Receipt className="h-4 w-4 text-ink/60" strokeWidth={1.75} aria-hidden />
          Orders <span className="font-normal text-ink/40">(latest {Math.min((orders ?? []).length, 50)})</span>
        </h2>
        {(orders ?? []).length === 0 ? (
          <p className="text-sm text-ink/50">No orders.</p>
        ) : (
          <ul className="divide-y divide-ink/5">
            {(orders ?? []).map((o) => (
              <li key={o.order_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-ink/80">
                  {o.service_key ?? '—'}
                  {o.comp_grant_id ? <Gift className="ml-1.5 inline h-3 w-3 text-mulberry" aria-hidden /> : null}
                </span>
                <span className="flex items-center gap-3 text-xs text-ink/55">
                  <span className="rounded bg-ink/5 px-1.5 py-0.5">{o.status}</span>
                  <span>{peso(o.confirmed_total_php != null ? o.confirmed_total_php * 100 : null)}</span>
                  <span>{fmtDate(o.created_at)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-ink/10 bg-paper p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-ink">
          <ShieldCheck className="h-4 w-4 text-ink/60" strokeWidth={1.75} aria-hidden />
          Who viewed this account
          <span className="font-normal text-ink/40">(RA 10173 access trail)</span>
        </h2>
        {(accessLog ?? []).length === 0 ? (
          <p className="text-sm text-ink/50">No recorded views yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {(accessLog ?? []).map((a, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-xs text-ink/55">
                <span className="font-mono text-ink/45">{(a.admin_user_id ?? 'system').slice(0, 8)}…</span>
                <span>{a.surface}</span>
                <span>{fmtDate(a.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="flex items-start gap-2 rounded-xl border border-ink/10 bg-ink/[0.02] p-4 text-xs leading-relaxed text-ink/50">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        Off-limits even here: chat messages, shared files, raw behavioral data, and face data are never
        shown on this page — they’re read only with the couple’s consent or a logged, notified takeover.
        This is a read-only view; account changes go through the per-user actions or (later) a consent-to-fix
        request.
      </p>
    </div>
  );
}
