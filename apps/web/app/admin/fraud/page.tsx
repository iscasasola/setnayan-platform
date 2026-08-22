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

import { logQueryError } from '@/lib/supabase/error-detect';
import { ErrorState } from '@/app/_components/states/error-state';
import { ConsoleTable } from '@/app/admin/_components/console-table';

import { requireAdmin } from '@/lib/admin/require-admin';
import { PageMasthead } from '@/app/_components/page-masthead';
export const metadata = { title: 'Fraud queue · Admin' };
export const dynamic = 'force-dynamic';

/** One number: the query reads it and ConsoleTable discloses it. Never two copies. */
const AUDIT_LIMIT = 15;

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
  await requireAdmin();
  const admin = createAdminClient();

  // 1. The queue: vendors with open fraud signals, worst first.
  //
  // ⚠ `error` IS BOUND HERE ON PURPOSE, AND IT WAS NOT BEFORE. Supabase resolves
  // with `{ error }` rather than throwing, so a refused read arrived as
  // `data: null`, `?? []` made it an empty array, and this page rendered a green
  // tick over "No open fraud signals." — a reassurance, in the affirmative, on
  // the fraud desk, produced by a query that never ran. Nothing logged.
  const { data: scoreData, error: scoresError } = await admin
    .from('vendor_fraud_scores')
    .select(
      'vendor_profile_id, max_open_score, sum_open_score, open_signal_count, open_signal_types, latest_detected_at',
    )
    .order('max_open_score', { ascending: false });
  if (scoresError) {
    logQueryError('AdminFraudQueuePage.scores', scoresError, {}, 'graceful_degrade');
  }
  // NULL survives to the render as NOT MEASURED. `?? []` here is what made a
  // refusal and a genuinely quiet queue the same value.
  const scores = scoreData as ScoreRow[] | null;

  const vendorIds = (scores ?? []).map((s) => s.vendor_profile_id);

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
      : Promise.resolve({ data: [] as SignalRow[], error: null }),
    vendorIds.length > 0
      ? admin
          .from('vendor_profiles')
          .select('vendor_profile_id, business_name, public_id, fraud_suspended_at, fraud_banned_at')
          .in('vendor_profile_id', vendorIds)
      : Promise.resolve({ data: [] as never[], error: null }),
    admin
      .from('fraud_enforcement_audit')
      .select('public_id, vendor_profile_id, action, actor_user_id, reason, created_at')
      .order('created_at', { ascending: false })
      .limit(AUDIT_LIMIT),
  ]);

  // ⚠ THE LABEL READS ARE NOT DECORATION, AND THEY WERE SWALLOWED TOO.
  // `signalsRes` carries the EVIDENCE — the one thing this desk exists to let a
  // person judge. If it is refused, `?? []` renders every card with no evidence
  // chips at all, which reads as a flag raised on no basis. `vendorsRes` carries
  // the business NAME; refused, every card is headed by a raw id. Neither changes
  // the row COUNT, so ConsoleTable cannot see it — the page has to say it.
  // 🔑 A guard that only checks the primary read would have passed this.
  const signalsError = 'error' in signalsRes ? signalsRes.error : null;
  const vendorsError = 'error' in vendorsRes ? vendorsRes.error : null;
  if (signalsError) logQueryError('AdminFraudQueuePage.signals', signalsError, {}, 'graceful_degrade');
  if (vendorsError) logQueryError('AdminFraudQueuePage.vendors', vendorsError, {}, 'graceful_degrade');

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

  // Same rule as the queue above: NULL is "not measured", never "no enforcement
  // has ever happened". `auditRes.error` exists only on the real query branch —
  // the two conditional reads above resolve a bare `{ data }` when there are no
  // vendor ids, so the error is read defensively rather than destructured.
  const auditError = 'error' in auditRes ? auditRes.error : null;
  if (auditError) {
    logQueryError('AdminFraudQueuePage.audit', auditError, {}, 'graceful_degrade');
  }
  const audit = auditRes.data as AuditRow[] | null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMasthead
        title="Fraud queue"
      />

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

      {/* FAILS TOWARD THE CAVEAT: a partially-loaded card must not read as a
          complete one. Never silent, and never mistakable for the queue itself
          being empty — that is the state above. */}
      {signalsError || vendorsError ? (
        <p
          role="alert"
          className="mb-6 rounded-xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/70"
        >
          <strong className="text-ink">These cards are incomplete.</strong>{' '}
          {signalsError
            ? 'The evidence behind each signal could not be read, so a card showing no evidence is not a signal raised without any. '
            : ''}
          {vendorsError
            ? 'Business names could not be read, so vendors appear as identifiers. '
            : ''}
          The scores and the count below are still accurate. Do not confirm fraud
          from this state — reload first.
        </p>
      ) : null}

      {/* THE THREE-WAY SPLIT. This queue is a card list, not a table, so it does
          not go through <ConsoleTable> — but the rule is the component's, and
          <ErrorState> is not table-specific. Refused ≠ quiet, and only the quiet
          case may wear the green tick. */}
      {scores === null ? (
        <ErrorState
          title="Couldn't read the fraud queue"
          broke={
            scoresError?.message
              ? `The read was refused. Show this to an engineer: ${scoresError.message}`
              : 'The read did not complete.'
          }
          survived="No vendor was shown, and none was ruled out. This is not a statement that there are no open signals — it is a statement that we do not know."
          todo="Reload. If it happens again, assume signals may be open and hand the message above to an engineer — do not treat this screen as a clear queue."
        />
      ) : scores.length === 0 ? (
        <div className="sn-row flex flex-col items-center gap-2 p-10 text-center">
          <ShieldCheck className="h-8 w-8 text-success-600" aria-hidden="true" />
          <p className="text-sm font-semibold text-ink">No open fraud signals.</p>
          <p className="text-xs text-ink/70">
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
              <li key={s.vendor_profile_id} className="sn-tile overflow-hidden !p-0">
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

      {/* Recent enforcement trail.
          ⚠ THIS SECTION USED TO DISAPPEAR ENTIRELY on `audit.length > 0` — so a
          refused read removed the whole enforcement history from the page with no
          trace at all. On a desk that bans businesses, an absent audit trail must
          say it is absent. It is now always rendered and ConsoleTable decides
          which of the three states it is in. */}
      <section className="mt-10">
        <h2 className="mb-3 sn-eye">Recent enforcement</h2>
        <ConsoleTable
          rows={audit}
          readPermitted
          readError={auditError}
          reads="the enforcement trail"
          cap={AUDIT_LIMIT}
          label="Recent fraud enforcement"
          minWidth="42rem"
          note="Read-only. Every row here was written by an action taken elsewhere on this page; there is deliberately nothing to press on the history itself."
          rowKey={(a) => a.public_id}
          empty={{
            Icon: ShieldCheck,
            title: 'Nothing has been enforced yet',
            blurb:
              'A row lands here each time a signal is dismissed, a vendor is un-suspended, or fraud is confirmed. An empty trail on a platform with no confirmed fraud is the good outcome, not a broken screen.',
          }}
          columns={[
            {
              header: 'Action',
              cell: (a) => (
                <span className="font-medium">
                  {FRAUD_ENFORCEMENT_ACTION_LABEL[a.action] ?? a.action}
                </span>
              ),
            },
            {
              header: 'Vendor',
              cell: (a) => (
                <span className="text-ink/70">
                  {vendorMeta.get(a.vendor_profile_id)?.name ?? a.vendor_profile_id}
                </span>
              ),
            },
            {
              header: 'By',
              hideBelow: 'md',
              cell: (a) => (
                <span className="text-ink/70">{a.actor_user_id ? 'admin' : 'system'}</span>
              ),
            },
            {
              header: 'Reason',
              hideBelow: 'lg',
              cell: (a) => (
                <span className="block max-w-[260px] truncate text-ink/70">
                  {a.reason ?? '—'}
                </span>
              ),
            },
            {
              header: 'When',
              mono: true,
              align: 'right',
              cell: (a) => <span className="text-ink/70">{timeAgo(a.created_at)}</span>,
            },
          ]}
        />
      </section>
    </div>
  );
}
