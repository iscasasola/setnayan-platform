import { ShieldAlert, ShieldCheck, Snowflake, Ban, TriangleAlert } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  FRAUD_SIGNAL_LABEL,
  VENDOR_FRAUD_ATTENTION_THRESHOLD,
  type FraudSignalType,
} from '@/lib/fraud-detection';
import {
  FRAUD_AUTOSUSPEND_THRESHOLD,
  FRAUD_ENFORCEMENT_ACTION_LABEL,
  deriveVendorFraudState,
  type FraudEnforcementAction,
  type VendorFraudState,
} from '@/lib/fraud-enforcement';
import { dismissVendorSignals, unsuspendVendor } from './actions';
import { WipeBanDialog } from './_components/wipe-ban-dialog';

export const metadata = { title: 'Fraud queue · Admin' };
export const dynamic = 'force-dynamic';

type ScoreRow = {
  vendor_profile_id: string;
  max_open_score: number;
  sum_open_score: number;
  open_signal_count: number;
  open_signal_types: string[] | null;
  latest_detected_at: string | null;
};

type SignalRow = {
  public_id: string;
  vendor_profile_id: string;
  signal_type: FraudSignalType;
  score: number;
  evidence: Record<string, unknown>;
  window_start: string;
  window_end: string;
};

type AuditRow = {
  public_id: string;
  vendor_profile_id: string;
  action: FraudEnforcementAction;
  actor_user_id: string | null;
  reason: string | null;
  created_at: string;
};

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Render a non-PII evidence blob as readable key: value chips. */
function EvidenceChips({ evidence }: { evidence: Record<string, unknown> }) {
  const entries = Object.entries(evidence).filter(
    ([, v]) => v !== null && v !== undefined && typeof v !== 'object',
  );
  if (entries.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-1.5">
      {entries.map(([k, v]) => (
        <li
          key={k}
          className="rounded-md bg-ink/5 px-2 py-0.5 text-[11px] text-ink/70"
        >
          <span className="font-mono text-ink/50">{k}</span>{' '}
          <span className="font-semibold text-ink/80">{String(v)}</span>
        </li>
      ))}
    </ul>
  );
}

function StateBadge({ state }: { state: VendorFraudState }) {
  if (state === 'banned') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-terracotta-100 px-2 py-0.5 text-[11px] font-bold text-terracotta-800">
        <Ban className="h-3 w-3" aria-hidden="true" /> Banned
      </span>
    );
  }
  if (state === 'suspended') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-warn-50 px-2 py-0.5 text-[11px] font-bold text-warn-900">
        <Snowflake className="h-3 w-3" aria-hidden="true" /> Auto-suspended
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-ink/5 px-2 py-0.5 text-[11px] font-bold text-ink/60">
      Active
    </span>
  );
}

export default async function AdminFraudQueuePage() {
  const admin = createAdminClient();

  // 1. The queue: vendors with open fraud signals, worst first.
  const { data: scoreData } = await admin
    .from('vendor_fraud_scores')
    .select(
      'vendor_profile_id, max_open_score, sum_open_score, open_signal_count, open_signal_types, latest_detected_at',
    )
    .order('max_open_score', { ascending: false });
  const scores = (scoreData ?? []) as ScoreRow[];

  const vendorIds = scores.map((s) => s.vendor_profile_id);

  // 2. Per-vendor open signals (for the evidence detail), vendor rows (name +
  //    enforcement state), and the recent enforcement audit trail — in parallel.
  const [signalsRes, vendorsRes, auditRes] = await Promise.all([
    vendorIds.length > 0
      ? admin
          .from('fraud_signals')
          .select('public_id, vendor_profile_id, signal_type, score, evidence, window_start, window_end')
          .in('vendor_profile_id', vendorIds)
          .eq('status', 'open')
          .order('score', { ascending: false })
      : Promise.resolve({ data: [] as SignalRow[] }),
    vendorIds.length > 0
      ? admin
          .from('vendor_profiles')
          .select('vendor_profile_id, business_name, public_id, fraud_suspended_at, fraud_banned_at')
          .in('vendor_profile_id', vendorIds)
      : Promise.resolve({ data: [] }),
    admin
      .from('fraud_enforcement_audit')
      .select('public_id, vendor_profile_id, action, actor_user_id, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(15),
  ]);

  const signalsByVendor = new Map<string, SignalRow[]>();
  for (const row of (signalsRes.data ?? []) as SignalRow[]) {
    const arr = signalsByVendor.get(row.vendor_profile_id) ?? [];
    arr.push(row);
    signalsByVendor.set(row.vendor_profile_id, arr);
  }

  const vendorMeta = new Map<
    string,
    { name: string; publicId: string; state: VendorFraudState }
  >();
  for (const row of (vendorsRes.data ?? []) as Array<{
    vendor_profile_id: string;
    business_name: string | null;
    public_id: string | null;
    fraud_suspended_at: string | null;
    fraud_banned_at: string | null;
  }>) {
    vendorMeta.set(row.vendor_profile_id, {
      name: row.business_name || '(unnamed vendor)',
      publicId: row.public_id || row.vendor_profile_id,
      state: deriveVendorFraudState(row),
    });
  }

  const audit = (auditRes.data ?? []) as AuditRow[];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">
          Setnayan · Internal ops · Trust &amp; integrity
        </p>
        <h1 className="m-display-tight text-3xl text-[color:var(--m-ink)] sm:text-4xl">
          Fraud queue
        </h1>
        <p className="max-w-3xl text-base text-ink/65">
          Vendors flagged by the continuous fake-results hunt, worst signal first.
          Investigate the evidence, then either <strong className="text-ink">dismiss</strong>{' '}
          a false positive, <strong className="text-ink">un-suspend</strong> a vendor the
          system auto-froze, or <strong className="text-ink">confirm fraud</strong> to wipe
          their data + permanently ban them. The wipe is irreversible and needs a{' '}
          <strong className="text-ink">second admin</strong> to confirm.
        </p>
      </header>

      <div className="mb-8 flex flex-wrap gap-3 text-xs text-ink/70">
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-3 py-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-warn-700" aria-hidden="true" />
          Attention bar: <strong className="text-ink">{VENDOR_FRAUD_ATTENTION_THRESHOLD}</strong>
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-ink/10 bg-white px-3 py-1.5">
          <Snowflake className="h-3.5 w-3.5 text-terracotta-700" aria-hidden="true" />
          Auto-suspend bar (summed): <strong className="text-ink">{FRAUD_AUTOSUSPEND_THRESHOLD}</strong>
        </span>
      </div>

      {scores.length === 0 ? (
        <div className="m-card flex flex-col items-center gap-2 p-10 text-center">
          <ShieldCheck className="h-8 w-8 text-success-600" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">No open fraud signals.</p>
          <p className="text-xs text-ink/55">
            The hunt is running. Vendors appear here the moment a detector fires. Set na ’yan.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {scores.map((s) => {
            const meta = vendorMeta.get(s.vendor_profile_id);
            const name = meta?.name ?? s.vendor_profile_id;
            const state = meta?.state ?? 'active';
            const sigs = signalsByVendor.get(s.vendor_profile_id) ?? [];
            const overAutoBar = s.sum_open_score >= FRAUD_AUTOSUSPEND_THRESHOLD;
            return (
              <li key={s.vendor_profile_id} className="m-card overflow-hidden p-0">
                {/* Header row */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/10 px-5 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <ShieldAlert
                        className={overAutoBar ? 'h-4 w-4 text-terracotta-700' : 'h-4 w-4 text-warn-700'}
                        aria-hidden="true"
                      />
                      <span className="text-sm font-bold text-ink">{name}</span>
                      <StateBadge state={state} />
                    </div>
                    <p className="mt-1 text-xs text-ink/55">
                      {meta?.publicId} · {s.open_signal_count}{' '}
                      open signal{s.open_signal_count === 1 ? '' : 's'} · latest{' '}
                      {timeAgo(s.latest_detected_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3 text-right">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-ink/45">Worst</p>
                      <p className="text-lg font-bold text-ink">{s.max_open_score}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-ink/45">Summed</p>
                      <p
                        className={
                          overAutoBar
                            ? 'text-lg font-bold text-terracotta-700'
                            : 'text-lg font-bold text-ink'
                        }
                      >
                        {s.sum_open_score}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Signals + evidence */}
                <div className="space-y-3 px-5 py-4">
                  {sigs.map((sig) => (
                    <div key={sig.public_id} className="rounded-lg bg-ink/[0.02] p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-ink">
                          {sig.signal_type}
                        </span>
                        <span className="text-xs font-bold text-ink/60">
                          score {sig.score}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink/65">
                        {FRAUD_SIGNAL_LABEL[sig.signal_type] ?? sig.signal_type}
                      </p>
                      <EvidenceChips evidence={sig.evidence} />
                    </div>
                  ))}
                </div>

                {/* Actions */}
                {state === 'banned' ? (
                  <div className="border-t border-ink/10 bg-terracotta-50/40 px-5 py-3 text-xs text-terracotta-800">
                    Permanently banned. Data voided. Appeal routed to the help center.
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 px-5 py-3">
                    {/* Dismiss (false positive) */}
                    <form action={dismissVendorSignals} className="flex items-center gap-2">
                      <input type="hidden" name="vendor_profile_id" value={s.vendor_profile_id} />
                      <input
                        type="text"
                        name="reason"
                        placeholder="reason (optional)"
                        className="w-40 rounded-md border border-ink/15 bg-white px-2 py-1 text-xs"
                      />
                      <SubmitButton
                        pendingLabel="Dismissing…"
                        className="inline-flex items-center gap-1.5 rounded-md border border-success-600/40 bg-white px-3 py-1.5 text-xs font-bold text-success-700 transition-colors hover:bg-success-50"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                        Dismiss (false positive)
                      </SubmitButton>
                    </form>

                    {/* Un-suspend (only when currently suspended) */}
                    {state === 'suspended' ? (
                      <form action={unsuspendVendor}>
                        <input type="hidden" name="vendor_profile_id" value={s.vendor_profile_id} />
                        <SubmitButton
                          pendingLabel="Un-suspending…"
                          className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-white px-3 py-1.5 text-xs font-bold text-ink transition-colors hover:bg-ink/5"
                        >
                          <Snowflake className="h-3.5 w-3.5" aria-hidden="true" />
                          Un-suspend (keep watching)
                        </SubmitButton>
                      </form>
                    ) : null}

                    {/* Wipe + ban (two-admin gate, typed confirmation) */}
                    <WipeBanDialog
                      vendorProfileId={s.vendor_profile_id}
                      businessName={meta?.name && meta.name !== '(unnamed vendor)' ? meta.name : ''}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Recent enforcement trail */}
      {audit.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 m-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Recent enforcement
          </h2>
          <div className="m-card overflow-hidden p-0">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-left text-[11px] uppercase tracking-wide text-ink/45">
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Vendor</th>
                  <th className="px-4 py-2 font-medium">By</th>
                  <th className="px-4 py-2 font-medium">Reason</th>
                  <th className="px-4 py-2 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.public_id} className="border-b border-ink/5 last:border-0">
                    <td className="px-4 py-2 font-medium">
                      {FRAUD_ENFORCEMENT_ACTION_LABEL[a.action] ?? a.action}
                    </td>
                    <td className="px-4 py-2 text-ink/70">
                      {vendorMeta.get(a.vendor_profile_id)?.name ?? a.vendor_profile_id}
                    </td>
                    <td className="px-4 py-2 text-ink/60">
                      {a.actor_user_id ? 'admin' : 'system'}
                    </td>
                    <td className="max-w-[260px] truncate px-4 py-2 text-ink/60">
                      {a.reason ?? '—'}
                    </td>
                    <td className="px-4 py-2 text-ink/55">{timeAgo(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
