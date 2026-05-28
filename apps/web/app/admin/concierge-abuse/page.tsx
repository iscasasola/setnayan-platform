/**
 * Admin · Today's Focus enforcement queue (iteration 0023 § 3.11).
 *
 * Two tabs:
 *   - Queue (default): pending_review flags sorted by similarity_score DESC,
 *     created_at DESC. Per-row Clear / Confirm actions.
 *   - Enforcement decisions: users with concierge_enforcement_level != 'none'.
 *     Per-row Lift action (appeal flow).
 *
 * RLS: the migration sets admin-only read/write on `concierge_abuse_flags`.
 * The page is gated by the parent admin layout (notFound for non-admins).
 *
 * Brand-layer rename 2026-05-28 V2 cutover — Concierge → Today's Focus.
 * Route path + DB table names (concierge_abuse_flags, users.concierge_*)
 * preserved so audit history + RLS policies don't break.
 *
 * Retired 2026-05-28 V2 cutover — the multi-account trial-cycling abuse
 * pattern is being supplanted by the simpler V2 model. The queue stays
 * read-only here until the V2 abuse model is locked; existing flagged
 * users + enforcement actions remain valid for audit + appeal.
 */

import Link from 'next/link';
import { AlertTriangle, ShieldAlert, ShieldCheck, Users as UsersIcon } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  ENFORCEMENT_LEVEL_LABEL,
  ENFORCEMENT_LEVEL_TONE,
  type ConciergeEnforcementLevel,
} from '@/lib/concierge';
import {
  adminClearConciergeFlag,
  adminConfirmConciergeAbuse,
  adminLiftConciergeEnforcement,
} from './actions';

export const metadata = { title: "Today's Focus enforcement · Admin" };

type FlagRow = {
  flag_id: string;
  flagged_user_id: string;
  matched_user_ids: string[];
  similarity_score: number;
  signals: Record<string, unknown>;
  status: 'pending_review' | 'cleared' | 'confirmed_abuse';
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  admin_notes: string | null;
};

type UserBrief = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  concierge_abuse_strike_count: number;
  concierge_enforcement_level: ConciergeEnforcementLevel;
  concierge_enforcement_reason: string | null;
  concierge_enforcement_at: string | null;
};

type Props = {
  searchParams: Promise<{
    tab?: string;
    error?: string;
    cleared?: string;
    confirmed?: string;
    lifted?: string;
  }>;
};

export default async function ConciergeAbusePage({ searchParams }: Props) {
  const search = await searchParams;
  const tab: 'queue' | 'enforcement' =
    search.tab === 'enforcement' ? 'enforcement' : 'queue';

  const admin = createAdminClient();

  const [pendingFlagsRes, recentClearedRes, recentConfirmedRes, enforcementRes] =
    await Promise.all([
      admin
        .from('concierge_abuse_flags')
        .select(
          'flag_id, flagged_user_id, matched_user_ids, similarity_score, signals, status, created_at, reviewed_at, reviewed_by, admin_notes',
        )
        .eq('status', 'pending_review')
        .order('similarity_score', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(100),
      admin
        .from('concierge_abuse_flags')
        .select('flag_id', { count: 'exact', head: false })
        .eq('status', 'cleared')
        .gte('reviewed_at', sevenDaysAgoIso())
        .limit(1),
      admin
        .from('concierge_abuse_flags')
        .select('flag_id', { count: 'exact', head: false })
        .eq('status', 'confirmed_abuse')
        .gte('reviewed_at', sevenDaysAgoIso())
        .limit(1),
      admin
        .from('users')
        .select(
          'user_id, display_name, email, phone, concierge_abuse_strike_count, concierge_enforcement_level, concierge_enforcement_reason, concierge_enforcement_at',
        )
        .neq('concierge_enforcement_level', 'none')
        .order('concierge_enforcement_at', { ascending: false })
        .limit(100),
    ]);

  const pendingFlags = (pendingFlagsRes.data ?? []) as FlagRow[];
  const enforcementUsers = (enforcementRes.data ?? []) as UserBrief[];

  // Resolve all relevant user IDs in one round-trip (flagged + matched).
  const allUserIds = new Set<string>();
  for (const f of pendingFlags) {
    allUserIds.add(f.flagged_user_id);
    for (const m of f.matched_user_ids ?? []) allUserIds.add(m);
  }
  let usersById = new Map<string, UserBrief>();
  if (allUserIds.size > 0) {
    const { data } = await admin
      .from('users')
      .select(
        'user_id, display_name, email, phone, concierge_abuse_strike_count, concierge_enforcement_level, concierge_enforcement_reason, concierge_enforcement_at',
      )
      .in('user_id', Array.from(allUserIds));
    usersById = new Map((data ?? []).map((u: unknown) => {
      const row = u as UserBrief;
      return [row.user_id, row];
    }));
  }

  const clearedCount = recentClearedRes.count ?? 0;
  const confirmedCount = recentConfirmedRes.count ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Today&apos;s Focus enforcement
        </h1>
        <p className="text-sm text-ink/60">
          Multi-account trial-cycling review queue (iteration 0023 § 3.11). Tiered enforcement
          ladder: strike 1 → warning · strike 2 → trial banned · strike 3+ → full banned. Single-
          admin authority per § 4.3.
        </p>
        <p className="rounded-md border border-amber-200/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
          <span className="font-semibold">Read-only — retired as a separate concept.</span>{' '}
          The ₱2,499 Setnayan Concierge SKU was supplanted by the ₱1,499
          TODAYS_FOCUS one-time SKU on 2026-05-28. Existing flagged users +
          enforcement actions remain valid here for audit + appeal; the V2
          abuse model is being locked separately and will replace this queue
          when it ships.
        </p>
      </header>

      <nav className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/admin/concierge-abuse?tab=queue"
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            tab === 'queue'
              ? 'bg-terracotta text-cream'
              : 'bg-ink/5 text-ink/70 hover:bg-ink/10 hover:text-ink'
          }`}
        >
          Pending review ({pendingFlags.length})
        </Link>
        <Link
          href="/admin/concierge-abuse?tab=enforcement"
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            tab === 'enforcement'
              ? 'bg-terracotta text-cream'
              : 'bg-ink/5 text-ink/70 hover:bg-ink/10 hover:text-ink'
          }`}
        >
          Enforcement decisions ({enforcementUsers.length})
        </Link>
      </nav>

      {/* Status banners */}
      {search.error ? (
        <p
          role="alert"
          className="mb-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {decodeURIComponent(search.error)}
        </p>
      ) : null}
      {search.cleared === '1' ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          Flag cleared as false positive. The flagged user&apos;s account is no
          longer under review.
        </p>
      ) : null}
      {search.confirmed ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          Abuse confirmed. Account enforcement level is now <strong>{search.confirmed}</strong>.
        </p>
      ) : null}
      {search.lifted ? (
        <p
          role="status"
          className="mb-4 rounded-md border border-emerald-300/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          Enforcement lifted. New level: <strong>{search.lifted}</strong>.
        </p>
      ) : null}

      {/* Metrics chips */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric
          label="Pending review"
          value={pendingFlags.length.toString()}
          tone="bg-rose-50 text-rose-900 border-rose-200/60"
          icon={<AlertTriangle aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
        />
        <Metric
          label="Cleared (last 7d)"
          value={clearedCount.toString()}
          tone="bg-emerald-50 text-emerald-900 border-emerald-200/60"
          icon={<ShieldCheck aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
        />
        <Metric
          label="Confirmed (last 7d)"
          value={confirmedCount.toString()}
          tone="bg-amber-50 text-amber-900 border-amber-200/60"
          icon={<ShieldAlert aria-hidden className="h-4 w-4" strokeWidth={1.75} />}
        />
      </div>

      {tab === 'queue' ? (
        <QueueTab flags={pendingFlags} usersById={usersById} />
      ) : (
        <EnforcementTab users={enforcementUsers} />
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`flex items-center justify-between rounded-xl border bg-cream px-4 py-3 ${tone}`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-mono text-[11px] uppercase tracking-[0.15em]">{label}</span>
      </div>
      <span className="text-xl font-semibold">{value}</span>
    </div>
  );
}

function QueueTab({
  flags,
  usersById,
}: {
  flags: FlagRow[];
  usersById: Map<string, UserBrief>;
}) {
  if (flags.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-8 text-center text-sm text-ink/55">
        No pending flags. The queue is clear.
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {flags.map((f) => {
        const flaggedUser = usersById.get(f.flagged_user_id);
        const matchedUsers = (f.matched_user_ids ?? [])
          .map((id) => usersById.get(id))
          .filter((u): u is UserBrief => !!u);
        return (
          <li key={f.flag_id} className="rounded-xl border border-ink/10 bg-cream p-4">
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
                  Flagged · {new Date(f.created_at).toLocaleString()}
                </p>
                <h2 className="text-lg font-semibold tracking-tight text-ink">
                  {flaggedUser?.display_name ?? flaggedUser?.email ?? f.flagged_user_id.slice(0, 8)}
                </h2>
                {flaggedUser?.email ? (
                  <p className="text-xs text-ink/55">{flaggedUser.email}</p>
                ) : null}
                <StrikePill
                  count={flaggedUser?.concierge_abuse_strike_count ?? 0}
                  level={flaggedUser?.concierge_enforcement_level ?? 'none'}
                />
              </div>
              <SimilarityBar score={f.similarity_score} />
            </header>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <SignalsTable signals={f.signals} />
              <MatchedAccounts users={matchedUsers} />
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <form
                action={adminClearConciergeFlag}
                className="space-y-2 rounded-md border border-emerald-200/60 bg-emerald-50/50 p-3"
              >
                <input type="hidden" name="flag_id" value={f.flag_id} />
                <label
                  htmlFor={`clear-${f.flag_id}`}
                  className="block font-mono text-[11px] uppercase tracking-[0.15em] text-emerald-900"
                >
                  Clear as false positive (notes ≥ 10 chars)
                </label>
                <textarea
                  id={`clear-${f.flag_id}`}
                  name="admin_notes"
                  required
                  minLength={10}
                  rows={2}
                  className="input-field bg-cream text-sm"
                  placeholder="Different couple, same Tagaytay venue / signal mismatch / etc."
                />
                <SubmitButton
                  className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-emerald-800 disabled:opacity-70"
                  pendingLabel="Clearing…"
                >
                  Clear (false positive)
                </SubmitButton>
              </form>

              <form
                action={adminConfirmConciergeAbuse}
                className="space-y-2 rounded-md border border-rose-200/60 bg-rose-50/50 p-3"
              >
                <input type="hidden" name="flag_id" value={f.flag_id} />
                <label
                  htmlFor={`confirm-${f.flag_id}`}
                  className="block font-mono text-[11px] uppercase tracking-[0.15em] text-rose-900"
                >
                  Confirm abuse (notes ≥ 20 chars)
                </label>
                <textarea
                  id={`confirm-${f.flag_id}`}
                  name="admin_notes"
                  required
                  minLength={20}
                  rows={2}
                  className="input-field bg-cream text-sm"
                  placeholder="Same phone number across N accounts with identical wedding profiles — multi-account trial cycling."
                />
                <SubmitButton
                  className="rounded-md bg-rose-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-rose-800 disabled:opacity-70"
                  pendingLabel="Confirming…"
                >
                  Confirm abuse (+1 strike)
                </SubmitButton>
              </form>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function EnforcementTab({ users }: { users: UserBrief[] }) {
  if (users.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-8 text-center text-sm text-ink/55">
        No accounts under enforcement.
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {users.map((u) => (
        <li key={u.user_id} className="rounded-xl border border-ink/10 bg-cream p-4">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-ink">
                {u.display_name ?? u.email ?? u.user_id.slice(0, 8)}
              </h2>
              {u.email ? <p className="text-xs text-ink/55">{u.email}</p> : null}
              {u.phone ? <p className="text-xs text-ink/55">Phone: {u.phone}</p> : null}
              <StrikePill count={u.concierge_abuse_strike_count} level={u.concierge_enforcement_level} />
              {u.concierge_enforcement_at ? (
                <p className="text-[11px] text-ink/45">
                  Enforced {new Date(u.concierge_enforcement_at).toLocaleString()}
                </p>
              ) : null}
            </div>
          </header>
          {u.concierge_enforcement_reason ? (
            <p className="mt-3 rounded-md border border-ink/10 bg-ink/[0.03] px-3 py-2 text-xs text-ink/65">
              Reason: {u.concierge_enforcement_reason}
            </p>
          ) : null}
          <form
            action={adminLiftConciergeEnforcement}
            className="mt-4 space-y-2 rounded-md border border-emerald-200/60 bg-emerald-50/50 p-3"
          >
            <input type="hidden" name="user_id" value={u.user_id} />
            <label
              htmlFor={`lift-${u.user_id}`}
              className="block font-mono text-[11px] uppercase tracking-[0.15em] text-emerald-900"
            >
              Lift enforcement — appeal reversal (notes ≥ 10 chars). Decrements strike by 1.
            </label>
            <textarea
              id={`lift-${u.user_id}`}
              name="admin_notes"
              required
              minLength={10}
              rows={2}
              className="input-field bg-cream text-sm"
              placeholder="User submitted appeal ticket #1234 with valid clarification. Lifting one strike."
            />
            <SubmitButton
              className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-cream hover:bg-emerald-800 disabled:opacity-70"
              pendingLabel="Lifting…"
            >
              Lift enforcement (−1 strike)
            </SubmitButton>
          </form>
        </li>
      ))}
    </ul>
  );
}

function SimilarityBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const tone =
    score >= 0.85
      ? 'bg-rose-500'
      : score >= 0.7
        ? 'bg-amber-500'
        : 'bg-emerald-500';
  return (
    <div className="flex flex-col items-end gap-1">
      <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
        Similarity
      </span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-ink">{pct}%</span>
        <div className="h-2 w-20 overflow-hidden rounded-full bg-ink/10">
          <div
            className={`h-full rounded-full ${tone}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function SignalsTable({ signals }: { signals: Record<string, unknown> }) {
  const entries = Object.entries(signals ?? {});
  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-ink/10 bg-cream/50 p-3 text-xs text-ink/55">
        No signal details recorded.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-ink/10 bg-cream/50 p-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        Signals fired
      </p>
      <ul className="space-y-1 text-xs">
        {entries.map(([k, v]) => (
          <li key={k} className="flex justify-between gap-2">
            <span className="text-ink/65">{labelizeSignal(k)}</span>
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[10px] ${
                v === true
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-ink/10 text-ink/55'
              }`}
            >
              {v === true ? 'match' : typeof v === 'string' ? v.slice(0, 32) : String(v)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MatchedAccounts({ users }: { users: UserBrief[] }) {
  if (users.length === 0) {
    return (
      <div className="rounded-md border border-ink/10 bg-cream/50 p-3 text-xs text-ink/55">
        No matched accounts resolved.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-ink/10 bg-cream/50 p-3">
      <p className="mb-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        <UsersIcon aria-hidden className="h-3 w-3" strokeWidth={1.75} />
        Matched accounts ({users.length})
      </p>
      <ul className="space-y-1.5">
        {users.map((u) => (
          <li key={u.user_id} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-ink">
              {u.display_name ?? u.email ?? u.user_id.slice(0, 8)}
            </span>
            {u.email ? <span className="text-ink/55">{u.email}</span> : null}
            <StrikePill count={u.concierge_abuse_strike_count} level={u.concierge_enforcement_level} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function StrikePill({
  count,
  level,
}: {
  count: number;
  level: ConciergeEnforcementLevel;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${ENFORCEMENT_LEVEL_TONE[level]}`}
    >
      {count} {count === 1 ? 'strike' : 'strikes'} · {ENFORCEMENT_LEVEL_LABEL[level]}
    </span>
  );
}

function labelizeSignal(key: string): string {
  switch (key) {
    case 'phone_match':
      return 'Same phone (critical)';
    case 'payment_fingerprint':
      return 'Same payment fingerprint (critical)';
    case 'wedding_date_match':
      return 'Same wedding date';
    case 'venue_name_match':
      return 'Same venue name';
    case 'venue_address_match':
      return 'Same venue address';
    case 'name_overlap':
      return 'Name overlap';
    case 'device_ip_match':
      return 'Same device / IP';
    default:
      return key.replaceAll('_', ' ');
  }
}

function sevenDaysAgoIso(): string {
  return new Date(Date.now() - 7 * 86_400_000).toISOString();
}
