import Link from 'next/link';
import {
  ADMIN_QUEUE_META,
  computeDueState,
  getAdminQueueDigest,
  type AdminQueueDueState,
} from '@/lib/admin/queue-counts';

import { StatusPill } from './charts';

/**
 * Action Center — Zone 1 of the App Performance cockpit ("what to do next";
 * plan § 3 Zone 1 · owner: "this is where you give me an update on what to do
 * next … create new tokens, new secrets, upgrade account, repurchase suno
 * credits").
 *
 * AUTO CARDS reuse the Work command-center's queue digest verbatim
 * (lib/admin/queue-counts.ts — ONE filter table, so "open" can never drift
 * between the nav badges, /admin/work, and this zone). Urgency = the same
 * computeDueState SLA math: overdue → act (blush) · due-soon → watch
 * (champagne) · ok → open-but-inside-SLA · clear → folded into one line.
 *
 * MANUAL WATCH-LIST: the credits/limits/renewals the platform cannot read
 * (Suno has no balance API; domain registrars and key rotations live outside
 * the DB). Listed by NAME with where-to-check links — no invented numbers.
 * Editable logging + due-date reminders arrive with the platform_expenses
 * migration (PR 3), which is also where renewals gain real dates.
 */

type QueueCardDef = { key: string; label: string; todo: string };

/** Owner-facing card copy per queue (route = /admin/<key> for all of them). */
const QUEUE_CARDS: QueueCardDef[] = [
  { key: 'payments', label: 'Payments to reconcile', todo: 'Verify BDO/GCash proof and activate the order.' },
  { key: 'payouts', label: 'Payouts', todo: 'A vendor is waiting for money — settle it.' },
  { key: 'token-purchases', label: 'Token sales', todo: 'Confirm the pack payment and grant tokens.' },
  { key: 'subscriptions', label: 'Vendor subscriptions', todo: 'Confirm tier payment and activate the cycle.' },
  { key: 'verify', label: 'Vendor verification', todo: 'Review documents and award the badge.' },
  { key: 'vendor-partnerships', label: 'Partnerships', todo: 'Second-admin sign-off on the partnership claim.' },
  { key: 'disputes', label: 'Disputes', todo: 'Recourse clock is running — resolve or escalate.' },
  { key: 'force-majeure', label: 'Force majeure', todo: 'An event is impacted — apply the policy.' },
  { key: 'user-reports', label: 'Abuse reports', todo: 'Moderate the reported content (Apple 1.2 clock).' },
  { key: 'reviews', label: 'Review flags', todo: 'Rule on the flagged review.' },
  { key: 'approvals', label: 'Two-admin approvals', todo: 'A colleague is blocked on your sign-off.' },
  { key: 'account-deletions', label: 'Account deletions', todo: 'RA 10173 deletion request — process it.' },
  { key: 'payment-options', label: 'Payment options', todo: 'Fraud-screen the submitted payment method.' },
  { key: 'concierge-abuse', label: 'AI abuse queue', todo: 'Review the trial-cycling flag.' },
  { key: 'help', label: 'Help tickets', todo: 'Answer within the 24-hr SLA.' },
  { key: 'integrity-watch', label: 'Integrity watch', todo: 'Check the review-fraud / ghost-listing flag.' },
];

/** The credits · limits · renewals the DB can't see — named, never numbered. */
const MANUAL_WATCHLIST: { label: string; todo: string }[] = [
  { label: 'Suno credits', todo: 'Top up before the next Pakanta batch — no balance API.' },
  { label: 'Claude API headroom', todo: 'Setnayan AI + contract intelligence draw on this.' },
  { label: 'OpenAI / DALL·E balance', todo: 'Empty balance blocks Animated Monogram generation.' },
  { label: 'Recraft credits', todo: 'Marketing / editorial image generation.' },
  { label: 'R2 storage & Supabase tier', todo: 'Review usage vs plan — upgrade before it throttles.' },
  { label: 'Vercel build minutes', todo: 'Keep machine Elastic + skip-deployments ON; watch the spend.' },
  { label: 'Resend & Sentry quotas', todo: 'Email sends + error events vs monthly plan.' },
  { label: 'Secrets rotation', todo: 'R2 token · service-role key · API keys on a rotation calendar.' },
  { label: 'Domains & certs', todo: 'setnayan.com · setnayan.ph · app-signing certificates.' },
  { label: 'Vendor token packs', todo: 'Mint/adjust token packs in Pricing when campaigns need them.' },
];

const STATE_STYLE: Record<
  Exclude<AdminQueueDueState, 'clear'>,
  { border: string; dot: string; word: string }
> = {
  overdue: { border: 'var(--m-blush-deep)', dot: 'var(--m-blush-deep)', word: 'act now' },
  'due-soon': { border: 'var(--m-orange-2)', dot: 'var(--m-orange-2)', word: 'due soon' },
  ok: { border: 'var(--m-line)', dot: 'var(--m-sage-deep)', word: 'in SLA' },
  unknown: { border: 'var(--m-line)', dot: 'var(--m-slate-4)', word: 'unknown' },
};

const STATE_RANK: Record<AdminQueueDueState, number> = {
  overdue: 0,
  'due-soon': 1,
  unknown: 2,
  ok: 3,
  clear: 4,
};

export async function ActionCenterZone() {
  const digest = await getAdminQueueDigest();
  const nowMs = Date.now();

  const cards = QUEUE_CARDS.map((def) => {
    const row = digest[def.key] ?? { count: null, oldestAt: null };
    const sla = ADMIN_QUEUE_META[def.key]?.slaHours ?? 48;
    const state = computeDueState(row, sla, nowMs);
    return { ...def, row, state };
  }).sort(
    (a, b) =>
      STATE_RANK[a.state] - STATE_RANK[b.state] ||
      (b.row.count ?? 0) - (a.row.count ?? 0),
  );

  const active = cards.filter((c) => c.state !== 'clear');
  const clear = cards.filter((c) => c.state === 'clear');
  const acting = active.filter((c) => c.state === 'overdue').length;
  const watching = active.filter((c) => c.state === 'due-soon').length;

  return (
    <section className="mb-12" aria-labelledby="apx-action">
      <header className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="apx-action" className="text-base font-semibold text-ink">
          Action Center
        </h2>
        <p className="text-xs text-ink/55">
          {acting > 0 || watching > 0
            ? `${acting} overdue · ${watching} due soon · ${clear.length} queues clear`
            : `Nothing overdue — ${clear.length} of ${cards.length} queues clear.`}{' '}
          Counts come from the same digest as the Work command center.
        </p>
      </header>

      {active.length > 0 ? (
        <ul className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {active.map((c) => {
            const style = STATE_STYLE[c.state as Exclude<AdminQueueDueState, 'clear'>];
            return (
              <li key={c.key} data-reveal="">
                <Link
                  href={`/admin/${c.key}`}
                  className="m-card block p-4 transition-shadow hover:shadow-md"
                  style={{ borderLeft: `3px solid ${style.border}` }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
                      {c.label}
                    </p>
                    <span
                      className="text-lg font-semibold tabular-nums"
                      data-countup=""
                      style={{ color: style.dot }}
                    >
                      {c.row.count ?? '—'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs" style={{ color: 'var(--m-slate)' }}>
                    {c.todo}
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--m-slate-2)' }}>
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: style.dot }}
                    />
                    {style.word}
                    {c.row.oldestAt
                      ? ` · oldest ${c.row.oldestAt.slice(0, 10)}`
                      : ''}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {clear.length > 0 && active.length > 0 ? (
        <p className="mb-6 text-xs" style={{ color: 'var(--m-slate-2)' }}>
          Clear: {clear.map((c) => c.label).join(' · ')}
        </p>
      ) : null}

      {/* Manual watch-list — named reminders, no invented numbers. */}
      <div data-reveal="" className="m-card p-5" style={{ borderStyle: 'dashed' }}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
            Manual watch-list — credits · limits · renewals
          </h3>
          <StatusPill state="wiring" />
        </div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: 'var(--m-slate-2)' }}>
          no balance APIs — check at the provider · logging + reminders land with the expenses migration
        </p>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {MANUAL_WATCHLIST.map((m) => (
            <li key={m.label} className="text-sm">
              <span className="font-medium" style={{ color: 'var(--m-ink)' }}>
                {m.label}
              </span>
              <span style={{ color: 'var(--m-slate)' }}> — {m.todo}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
