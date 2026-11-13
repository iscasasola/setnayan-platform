import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  APPROVAL_ACTIONS,
  approvalActionBadge,
  approvalActionLabel,
} from '@/lib/admin-approvals';
import { requestPrivilegedGrant, approveRequest, rejectRequest, adminTeamAct } from './actions';
import { NoteField } from '@/app/admin/team/_components/team-fields';
import { after } from 'next/server';
import { getAdminPowersFor } from '@/lib/admin/can.server';
import { canWith, refusalFor } from '@/lib/admin/can';
import { adminAreaLabel, areaForApprovalAction } from '@/lib/admin/areas';
import { SELF_APPROVAL_WORD, selfApprovalState, waitWords } from '@/lib/admin/self-approval';
import { maybeRunOwnerApprovals } from '@/lib/admin/self-approval-runner';
import { InfoTip } from '@/app/_components/info-tip';
import { SubmitButton } from '@/app/_components/submit-button';
import { ShieldCheck } from 'lucide-react';
import { logQueryError } from '@/lib/supabase/error-detect';
import { ErrorState } from '@/app/_components/states/error-state';
import { ConsoleTable } from '@/app/admin/_components/console-table';

import { requireAdmin } from '@/lib/admin/require-admin';
import { PageMasthead } from '@/app/_components/page-masthead';
export const metadata = { title: 'Approvals · Admin' };

/** One number: the query reads it and ConsoleTable discloses it. It was 10, silently. */
const DECIDED_LIMIT = 10;

type RequestRow = {
  approval_id: string;
  public_id: string;
  action_type: string;
  target_user_id: string | null;
  target_id: string | null;
  rationale: string;
  status: string;
  /** NULL once admin A's account is deleted; the four-eyes record survives. */
  initiated_by: string | null;
  decided_by: string | null;
  decision_reason: string | null;
  created_at: string;
  decided_at: string | null;
  expires_at: string;
  /** Owner self-approval (2026-11-13): when he typed the word, and when it runs. */
  self_confirmed_at: string | null;
  run_after: string | null;
};

type EscalationRow = {
  escalation_id: string;
  area: string;
  item_kind: string;
  item_id: string;
  item_label: string | null;
  note: string;
  escalated_by: string | null;
  created_at: string;
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export default async function AdminApprovalsPage() {
  await requireAdmin();
  // The owner's own requests run 24 h after he types the word — carried here too.
  after(() => maybeRunOwnerApprovals().catch(() => {}));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const meId = user?.id ?? '';

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  const powers = meId ? await getAdminPowersFor(meId) : { userId: '', isOwner: false, scopes: null };
  const nowMs = Date.now();

  const [pendingRes, decidedRes, adminCountRes, escalationsRes] = await Promise.all([
    admin
      .from('admin_approval_requests')
      .select('*')
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: true }),
    admin
      .from('admin_approval_requests')
      .select('*')
      .neq('status', 'pending')
      .order('decided_at', { ascending: false })
      .limit(DECIDED_LIMIT),
    admin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .or('account_type.eq.admin,is_internal.eq.true,is_team_member.eq.true'),
    admin
      .from('work_escalations')
      .select('escalation_id, area, item_kind, item_id, item_label, note, escalated_by, created_at')
      .is('resolved_at', null)
      .order('created_at', { ascending: true }),
  ]);
  if (escalationsRes.error) logQueryError('AdminApprovalsPage.escalations', escalationsRes.error, {}, 'graceful_degrade');
  const escalations = escalationsRes.error ? null : ((escalationsRes.data ?? []) as EscalationRow[]);
  const escalationFor = (approvalId: string) =>
    (escalations ?? []).find((e) => e.item_kind === 'approval' && e.item_id === approvalId) ?? null;

  // ⚠ NEITHER READ BOUND ITS ERROR. Supabase resolves with `{ error }`, so a
  // refused read arrived as null, `?? []` made it an empty array, and this page
  // said "No approvals pending. Set na 'yan." — a cheerful all-clear on the ONE
  // queue whose entire purpose is that a second admin looks before something
  // irreversible executes. Nothing logged, nothing shown.
  const pendingError = pendingRes.error ?? null;
  const decidedError = decidedRes.error ?? null;
  if (pendingError) logQueryError('AdminApprovalsPage.pending', pendingError, {}, 'graceful_degrade');
  if (decidedError) logQueryError('AdminApprovalsPage.decided', decidedError, {}, 'graceful_degrade');
  const pending = pendingRes.data as RequestRow[] | null;
  const decided = decidedRes.data as RequestRow[] | null;
  // Already correct before this change, and the pattern the rest now follows:
  // `count === null` means NOT MEASURED, never zero.
  const adminCount = typeof adminCountRes.count === 'number' ? adminCountRes.count : null;
  const listedPending = pending ?? [];
  const listedDecided = decided ?? [];

  // Resolve display names for target / initiator / decider in one round trip.
  const ids = new Set<string>();
  (escalations ?? []).forEach((e) => {
    if (e.escalated_by) ids.add(e.escalated_by);
  });
  [...listedPending, ...listedDecided].forEach((r) => {
    if (r.target_user_id) ids.add(r.target_user_id);
    if (r.initiated_by) ids.add(r.initiated_by);
    if (r.decided_by) ids.add(r.decided_by);
  });
  // A refused NAME lookup does not change the row count, so the table cannot see
  // it — but a four-eyes request whose target reads as a raw id is not safe to
  // approve. Fails toward the caveat.
  let labelsUnread = false;
  const nameMap = new Map<string, string>();
  if (ids.size > 0) {
    const { data: us, error: usError } = await admin
      .from('users')
      .select('user_id, email, display_name')
      .in('user_id', [...ids]);
    if (usError) logQueryError('AdminApprovalsPage.names', usError, {}, 'graceful_degrade');
    labelsUnread = labelsUnread || Boolean(usError);
    for (const u of (us ?? []) as Array<{
      user_id: string;
      email: string | null;
      display_name: string | null;
    }>) {
      nameMap.set(u.user_id, u.display_name || u.email || '—');
    }
  }
  const nameOf = (id?: string | null) => (id ? nameMap.get(id) ?? '—' : '—');

  // Non-user targets (fraud wipe + partnership) ride in target_id (a vendor
  // profile id). Resolve their business names so the confirming admin sees WHICH
  // vendor a wipe+ban / partnership request is about.
  const vendorIds = new Set<string>();
  [...listedPending, ...listedDecided].forEach((r) => {
    if (r.target_id) vendorIds.add(r.target_id);
  });
  const vendorNameMap = new Map<string, string>();
  if (vendorIds.size > 0) {
    const { data: vs, error: vsError } = await admin
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', [...vendorIds]);
    if (vsError) logQueryError('AdminApprovalsPage.vendorNames', vsError, {}, 'graceful_degrade');
    labelsUnread = labelsUnread || Boolean(vsError);
    for (const v of (vs ?? []) as Array<{
      vendor_profile_id: string;
      business_name: string | null;
    }>) {
      vendorNameMap.set(v.vendor_profile_id, v.business_name || v.vendor_profile_id);
    }
  }
  // The target label for a row: a vendor business name for target_id-based
  // actions, otherwise the user display name for target_user_id-based ones.
  const targetLabel = (r: RequestRow) =>
    r.target_id ? vendorNameMap.get(r.target_id) ?? r.target_id : nameOf(r.target_user_id);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <PageMasthead
        title="Two-admin approvals"
      />

      {adminCount !== null && adminCount < 2 ? (
        <div className="mb-8 rounded-xl border border-warn-300/60 bg-warn-50/60 p-4 text-sm text-warn-900">
          <strong>Four-eyes needs at least two admins.</strong> There{' '}
          {adminCount === 1 ? 'is currently 1 admin' : 'are currently 0 admins'} on
          the platform. The first additional admin is provisioned outside this
          queue (owner bootstrap · §4.1); once two admins exist, this queue
          governs every further grant — and no admin can approve their own
          request, except the owner: he types {SELF_APPROVAL_WORD} on his own
          request and it runs after a 24-hour wait.
        </div>
      ) : null}

      {/* NEW REQUEST */}
      <section className="mb-10 rounded-2xl border border-terracotta/20 bg-gradient-to-br from-cream to-terracotta-50/30 p-5 sm:p-6">
        <h2 className="mb-1 sn-eye">
          New request
        </h2>
        <p className="mb-4 text-xs text-ink/55">
          Proposes a privileged-role grant. It stays pending until a different
          admin with Escalated in Team approves it — or, on the owner&rsquo;s own
          request, until he types {SELF_APPROVAL_WORD} and 24 hours pass.
        </p>
        <form action={requestPrivilegedGrant} className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Action</span>
            <select
              name="action_type"
              required
              defaultValue="grant_internal_account"
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            >
              {APPROVAL_ACTIONS.map((a) => (
                <option key={a.type} value={a.type}>
                  {a.label} ({a.badge})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold text-ink">Target account email</span>
            <input
              autoComplete="off"
              type="email"
              name="target_email"
              required
              placeholder="person@example.com"
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm sm:col-span-2">
            <span className="font-semibold text-ink">Rationale</span>
            <textarea
              name="rationale"
              required
              minLength={3}
              rows={2}
              placeholder="Why this grant is needed (recorded in the audit log)…"
              className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm"
            />
          </label>
          <div className="sm:col-span-2">
            <SubmitButton
              pendingLabel="Submitting…"
              className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink/90"
            >
              Submit for two-admin approval
            </SubmitButton>
          </div>
        </form>
        <ul className="mt-4 space-y-1 text-xs text-ink/55">
          {APPROVAL_ACTIONS.map((a) => (
            <li key={a.type}>
              <strong className="text-ink/75">{a.badge}</strong> — {a.description}
            </li>
          ))}
        </ul>
      </section>

      {/* PENDING */}
      <section className="mb-10">
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="sn-eye">
            Pending ({pending === null ? '—' : pending.length})
          </h2>
          <p className="text-xs text-ink/45">
            {pending === null
              ? 'The queue could not be read — this is not a count.'
              : pending.length === 0
                ? 'Nothing waiting on a second admin.'
                : 'A different admin must decide each request.'}
          </p>
        </div>

        {labelsUnread ? (
          <p
            role="alert"
            className="mb-3 rounded-xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/70"
          >
            <strong className="text-ink">Names could not be read.</strong> A request
            below may show an identifier instead of the person or business it is
            about. Do not approve from this state — reload first.
          </p>
        ) : null}

        {/* THE THREE-WAY SPLIT. Refused ≠ nothing waiting, and on THIS queue the
            difference is the whole product: "nothing waiting" is the sentence that
            makes a second admin close the tab. */}
        {pending === null ? (
          <ErrorState
            title="Couldn't read the pending queue"
            broke={
              pendingError?.message
                ? `The read was refused: ${pendingError.message}`
                : 'The read did not complete.'
            }
            survived={
              'No request was shown and none was ruled out. This is NOT ' +
              '\u201Cnothing is waiting on a second admin\u201D — it is ' +
              '\u201Cwe do not know\u201D, and on a four-eyes queue those are opposites.'
            }
            todo="Reload. If it repeats, the query is being rejected rather than returning nothing. Until it loads, assume something may be waiting."
          />
        ) : pending.length === 0 ? (
          <div className="sn-row p-8 text-center text-sm text-ink/70">
            No approvals pending. Set na ’yan.
          </div>
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => {
              const mine = r.initiated_by === meId;
              return (
                <li key={r.approval_id} className="sn-row p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-mulberry/10 px-2 py-0.5 text-[11px] font-bold text-mulberry">
                          {approvalActionBadge(r.action_type)}
                        </span>
                        <span className="text-sm font-semibold text-ink">
                          {approvalActionLabel(r.action_type)} → {targetLabel(r)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-ink/55">
                        Requested by <strong className="text-ink/75">{nameOf(r.initiated_by)}</strong>{' '}
                        · {timeAgo(r.created_at)} · {r.public_id}
                      </p>
                      <p className="mt-2 text-sm text-ink/80">{r.rationale}</p>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-2">
                      {mine ? (
                        powers.isOwner ? (
                          (() => {
                            // THE OWNER'S OWN REQUEST — typed + 24 h (DECISION_LOG 2026-11-13).
                            const st = selfApprovalState(r, nowMs);
                            return (
                              <>
                                {st.kind === 'not_started' ? (
                                  <form action={adminTeamAct} className="flex w-64 flex-col items-end gap-1.5">
                                    <input type="hidden" name="op" value="confirm_own" />
                                    <input type="hidden" name="approval_id" value={r.approval_id} />
                                    <NoteField
                                      fieldName="typed"
                                      name={`Type ${SELF_APPROVAL_WORD} · runs in 24 h`}
                                      empty={SELF_APPROVAL_WORD}
                                      placeholder={SELF_APPROVAL_WORD}
                                      required
                                      maxLength={20}
                                      data={`self-approve-${r.approval_id}`}
                                    />
                                    <SubmitButton
                                      pendingLabel="Starting…"
                                      className="rounded-md bg-mulberry px-3 py-1.5 text-xs font-bold text-white dark:text-cream"
                                    >
                                      Approve my own request
                                    </SubmitButton>
                                    <span className="max-w-[220px] text-right text-[11px] text-ink/55">
                                      Or a different admin can decide it now.
                                    </span>
                                  </form>
                                ) : (
                                  <p className="max-w-[220px] text-right text-xs text-ink/70">
                                    {st.kind === 'waiting'
                                      ? `Typed by you · runs in ${waitWords(st.msLeft)}`
                                      : 'Its 24 hours have passed · runs on the next visit'}
                                    <br />
                                    <span className="text-ink/55">You were emailed when it started waiting and will be when it runs.</span>
                                  </p>
                                )}
                                <form action={adminTeamAct}>
                                  <input type="hidden" name="op" value="withdraw" />
                                  <input type="hidden" name="approval_id" value={r.approval_id} />
                                  <SubmitButton
                                    pendingLabel="Cancelling…"
                                    className="rounded-md border border-danger-700/30 bg-raised px-3 py-1.5 text-xs font-bold text-danger-700 dark:text-danger-300"
                                  >
                                    Cancel
                                  </SubmitButton>
                                </form>
                              </>
                            );
                          })()
                        ) : (
                          <>
                            <p className="max-w-[200px] text-right text-xs text-terracotta-700">
                              You initiated this — a different admin must decide it.
                            </p>
                            <form action={adminTeamAct}>
                              <input type="hidden" name="op" value="withdraw" />
                              <input type="hidden" name="approval_id" value={r.approval_id} />
                              <SubmitButton
                                pendingLabel="Withdrawing…"
                                className="rounded-md border border-ink/20 bg-raised px-3 py-1.5 text-xs font-bold text-ink"
                              >
                                Withdraw
                              </SubmitButton>
                            </form>
                          </>
                        )
                      ) : (
                        (() => {
                          const area = areaForApprovalAction(r.action_type);
                          const canDecide = area ? canWith(powers, area, 'escalated') : false;
                          const why = area
                            ? refusalFor(powers, area, 'escalated')
                            : 'This kind of request has no area yet, so nobody can decide it.';
                          const esc = escalationFor(r.approval_id);
                          return (
                            <>
                              <form className="flex flex-col items-end gap-2">
                                <input type="hidden" name="approval_id" value={r.approval_id} />
                                <SubmitButton
                                  formAction={approveRequest}
                                  disabled={!canDecide}
                                  pendingLabel="Approving…"
                                  className="rounded-md bg-success-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-success-700 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  ✓ Approve &amp; execute
                                </SubmitButton>
                                <input
                                  type="text"
                                  name="reason"
                                  disabled={!canDecide}
                                  placeholder="reason (for reject)"
                                  className="w-44 rounded-md border border-ink/15 bg-white px-2 py-1 text-xs disabled:opacity-40"
                                />
                                <SubmitButton
                                  formAction={rejectRequest}
                                  disabled={!canDecide}
                                  pendingLabel="Rejecting…"
                                  className="rounded-md border border-terracotta/40 bg-white px-3 py-1.5 text-xs font-bold text-terracotta-700 transition-colors hover:bg-terracotta-50 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  Reject
                                </SubmitButton>
                              </form>
                              {!canDecide ? (
                                <p className="flex items-center gap-1 text-[11px] text-ink/60">
                                  <span>Escalated in {adminAreaLabel(area)}</span>
                                  <InfoTip label="" ariaLabel="Why it is greyed" align="end">
                                    {why}
                                  </InfoTip>
                                </p>
                              ) : null}
                              {esc ? (
                                <p className="max-w-[220px] text-right text-[11px] text-ink/65">
                                  Waiting for an Escalated admin · escalated by {nameOf(esc.escalated_by)} ·{' '}
                                  {timeAgo(esc.created_at)} — “{esc.note}”
                                </p>
                              ) : !canDecide && area && canWith(powers, area, 'basic') ? (
                                <form action={adminTeamAct} className="flex w-64 flex-col items-end gap-1">
                                  <input type="hidden" name="op" value="escalate" />
                                  <input type="hidden" name="area" value={area} />
                                  <input type="hidden" name="item_kind" value="approval" />
                                  <input type="hidden" name="item_id" value={r.approval_id} />
                                  <input
                                    type="hidden"
                                    name="item_label"
                                    value={`${approvalActionLabel(r.action_type)} → ${targetLabel(r)}`}
                                  />
                                  <NoteField
                                    fieldName="note"
                                    name="Note for them"
                                    empty="What you saw, what you suggest"
                                    required
                                    long
                                    data={`escalate-${r.approval_id}`}
                                  />
                                  <SubmitButton
                                    pendingLabel="Escalating…"
                                    className="rounded-md border border-ink/20 bg-raised px-3 py-1 text-xs font-bold text-ink"
                                  >
                                    Escalate ▸
                                  </SubmitButton>
                                </form>
                              ) : null}
                            </>
                          );
                        })()
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ESCALATED — waiting for an Escalated admin (DECISION_LOG 2026-11-13) */}
      <section className="mb-10">
        <h2 className="mb-3 sn-eye">
          Waiting for an Escalated admin ({escalations === null ? '—' : escalations.length})
        </h2>
        {escalations === null ? (
          <p role="alert" className="rounded-xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/70">
            <strong className="text-ink">Escalations could not be read.</strong> This is not “nothing escalated” — reload.
          </p>
        ) : escalations.length === 0 ? (
          <p className="text-xs text-ink/55">Nothing has been sent up.</p>
        ) : (
          <ul className="space-y-2">
            {escalations.map((e) => {
              const canResolve = canWith(powers, e.area, 'escalated');
              return (
                <li key={e.escalation_id} className="sn-row p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{e.item_label || `${e.item_kind} · ${e.item_id}`}</p>
                      <p className="mt-1 text-xs text-ink/60">
                        {adminAreaLabel(e.area)} · escalated by{' '}
                        <strong className="text-ink/80">{nameOf(e.escalated_by)}</strong> · {timeAgo(e.created_at)}
                      </p>
                      <p className="mt-1 text-sm text-ink/80">“{e.note}”</p>
                    </div>
                    <form action={adminTeamAct} className="flex w-64 shrink-0 flex-col items-end gap-1.5">
                      <input type="hidden" name="op" value="resolve" />
                      <input type="hidden" name="escalation_id" value={e.escalation_id} />
                      {canResolve ? (
                        <NoteField
                          fieldName="note"
                          name="What you decided"
                          empty="Optional"
                          data={`resolve-${e.escalation_id}`}
                        />
                      ) : null}
                      <SubmitButton
                        disabled={!canResolve}
                        pendingLabel="Marking…"
                        className="rounded-md bg-mulberry px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:text-cream"
                      >
                        Mark handled
                      </SubmitButton>
                      {!canResolve ? (
                        <span className="flex items-center gap-1 text-[11px] text-ink/60">
                          Escalated in {adminAreaLabel(e.area)}
                          <InfoTip label="" ariaLabel="Why it is greyed" align="end">
                            {refusalFor(powers, e.area, 'escalated')}
                          </InfoTip>
                        </span>
                      ) : null}
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* RECENTLY DECIDED
          ⚠ THIS SECTION USED TO VANISH on `decided.length > 0` — so a refused read
          silently removed the entire decision history from the four-eyes audit
          surface. It is now always rendered and ConsoleTable decides the state. */}
      <section>
        <h2 className="mb-3 sn-eye">Recently decided</h2>
        <ConsoleTable
          rows={decided}
          readPermitted
          readError={decidedError}
          reads="the decision history"
          cap={DECIDED_LIMIT}
          label="Recently decided approvals"
          minWidth="44rem"
          note="Read-only history. Each row was written when an admin other than the requester decided it; there is nothing to press here."
          rowKey={(r) => r.approval_id}
          empty={{
            Icon: ShieldCheck,
            title: 'Nothing has been decided yet',
            blurb:
              'A row lands here as soon as a second admin approves or rejects a request. On a platform where no privileged grant has been made, an empty history is the accurate state.',
          }}
          columns={[
            {
              header: 'Action',
              cell: (r) => approvalActionLabel(r.action_type),
            },
            { header: 'Target', cell: (r) => targetLabel(r) },
            {
              header: 'Outcome',
              cell: (r) => (
                <span
                  className={
                    r.status === 'approved'
                      ? 'rounded-md bg-success-50 px-2 py-0.5 text-[11px] font-bold text-success-700'
                      : 'rounded-md bg-terracotta-50 px-2 py-0.5 text-[11px] font-bold text-terracotta-700'
                  }
                >
                  {r.status}
                </span>
              ),
            },
            {
              // "by <name> · time" on every acted row (DECISION_LOG 2026-11-13).
              header: 'By',
              cell: (r) => (
                <span className="text-ink/70">
                  by {nameOf(r.decided_by)}
                  {r.decided_by && r.decided_by === r.initiated_by
                    ? r.status === 'withdrawn'
                      ? ' (cancelled own request)'
                      : ' (own request · after 24 h)'
                    : ''}{' '}
                  · {r.decided_at ? timeAgo(r.decided_at) : '—'}
                </span>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
