import { isEmailConfigured } from '@/lib/email';
import { readRecentDeliveries } from '@/lib/email-delivery.server';
import { relativeTime } from '@/lib/notifications';
import {
  verdictOf,
  VERDICT_LABEL,
  type DeliveryVerdict,
} from '@/lib/email-delivery-log';

/**
 * 📬 EMAIL DELIVERY — the full list behind the admin-home strip
 * (app/admin/_email-delivery-strip.tsx links here by `#email-delivery`).
 *
 * Every email `sendEmail` attempted in the last seven days, with what Resend
 * says happened to it. Three states are kept visibly apart, because each has
 * been confused for another on this project before:
 *   · the log could not be READ  → says so; never an empty list
 *   · nothing was SENT this week → says so, as a fact about the week
 *   · email is not CONFIGURED    → says so first, in red
 */

const TONE: Record<DeliveryVerdict, string> = {
  delivered: 'bg-emerald-50 text-emerald-800',
  failed: 'bg-danger-50 text-danger-700',
  not_sent: 'bg-danger-50 text-danger-700',
  cancelled: 'bg-ink/5 text-ink/60',
  waiting: 'bg-ink/5 text-ink/70',
  unknown: 'bg-amber-50 text-amber-800',
};

const SHOWN = 50;

export async function EmailDeliverySection() {
  const [configured, log] = await Promise.all([isEmailConfigured(), readRecentDeliveries()]);
  const now = Date.now();

  return (
    <section id="email-delivery" aria-labelledby="email-delivery-heading" className="mb-8 scroll-mt-24">
      <h2 id="email-delivery-heading" className="text-base font-semibold text-ink">
        Email delivery · last 7 days
      </h2>
      <p className="mt-1 text-xs text-ink/60">
        &ldquo;Delivered&rdquo; means Resend handed it to the person&rsquo;s mail server. It does not mean they
        opened it. Sign-up confirmation emails are sent by Supabase directly and are not listed here.
      </p>

      {!configured ? (
        <p
          data-email-delivery-state="not-configured"
          className="mt-3 rounded-xl border border-danger-300 bg-danger-50 p-3 text-sm text-danger-800"
        >
          Email is switched off. No Resend key is set, so nothing is being sent. Set it in Integrations.
        </p>
      ) : null}

      {!log.ok ? (
        <p
          data-email-delivery-state="read-failed"
          className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        >
          The delivery log could not be read ({log.error}). Whether emails are arriving is unknown right now.
        </p>
      ) : log.rows.length === 0 ? (
        <p data-email-delivery-state="none-sent" className="mt-3 text-sm text-ink/70">
          No emails were sent in the last 7 days.
        </p>
      ) : (
        <>
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs tabular-nums text-ink/80">
            <div>
              <dt className="inline">Delivered </dt>
              <dd className="inline font-semibold">{log.summary.delivered}</dd>
            </div>
            <div>
              <dt className="inline">Did not arrive </dt>
              <dd
                className={`inline font-semibold ${log.summary.failed + log.summary.not_sent > 0 ? 'text-danger-700' : ''}`}
              >
                {log.summary.failed + log.summary.not_sent}
              </dd>
            </div>
            <div>
              <dt className="inline">Waiting </dt>
              <dd className="inline font-semibold">{log.summary.waiting}</dd>
            </div>
            <div>
              <dt className="inline">No answer </dt>
              <dd className="inline font-semibold">{log.summary.unknown}</dd>
            </div>
            <div>
              <dt className="inline">Total </dt>
              <dd className="inline font-semibold">{log.summary.total}</dd>
            </div>
          </dl>
          {log.truncated ? (
            <p className="mt-1 text-xs text-amber-800">Counts cover the newest {log.rows.length} sends only.</p>
          ) : null}
          <ul className="mt-3 space-y-1.5">
            {log.rows.slice(0, SHOWN).map((r) => {
              const v = verdictOf(r, now);
              return (
                <li
                  key={r.delivery_id}
                  data-delivery-verdict={v}
                  className="flex items-start gap-3 rounded-lg border border-ink/10 bg-white/70 px-3 py-2"
                >
                  <span
                    className={`mt-0.5 inline-flex shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${TONE[v]}`}
                  >
                    {VERDICT_LABEL[v]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">{r.subject}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">
                      {r.recipient_masked} · {r.kind} · {relativeTime(r.created_at)}
                      {r.last_event && VERDICT_LABEL[v].toLowerCase() !== r.last_event ? ` · resend: ${r.last_event}` : ''}
                    </p>
                    {r.error && v !== 'delivered' ? (
                      <p className="mt-0.5 break-words text-xs text-danger-700">{r.error}</p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {log.rows.length > SHOWN ? (
            <p className="mt-2 text-xs text-ink/60">Showing the newest {SHOWN} of {log.rows.length}.</p>
          ) : null}
        </>
      )}
    </section>
  );
}
