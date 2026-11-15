import { isEmailConfigured } from '@/lib/email';
import { readRecentDeliveries } from '@/lib/email-delivery.server';
import { relativeTime } from '@/lib/notifications';
import {
  verdictOf,
  VERDICT_LABEL,
  type DeliveryVerdict,
} from '@/lib/email-delivery-log';
import { formatCount } from '@/lib/format-number';
import { InfoTip } from '@/app/_components/info-tip';
import { TemplateNums, TEMPLATE_SUBLINE } from '@/app/_components/template-rows';

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

  const missed = log.ok ? log.summary.failed + log.summary.not_sent : 0;

  return (
    <section id="email-delivery" aria-labelledby="email-delivery-heading" className="scroll-mt-28">
      <h2 id="email-delivery-heading" className="mt-[18px] flex min-h-9 items-center gap-2 pb-1 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">
        <InfoTip label="Email delivery · last 7 days" align="start" labelClassName="uppercase">
          &ldquo;Delivered&rdquo; means Resend handed it to the person&rsquo;s mail server. It does not mean they opened
          it. Sign-up confirmation emails are sent by Supabase directly and are not listed here.
        </InfoTip>
      </h2>

      {!configured ? (
        <p data-email-delivery-state="not-configured" role="alert" className="py-2 text-[14px] font-semibold text-[rgb(var(--color-danger))]">
          Email is switched off. No Resend key is set, so nothing is being sent. Set it in Integrations.
        </p>
      ) : null}

      {!log.ok ? (
        <p data-email-delivery-state="read-failed" role="alert" className="py-2 text-[14px]" style={{ color: 'rgb(var(--color-warn))' }}>
          The delivery log could not be read ({log.error}). Whether emails are arriving is unknown right now.
        </p>
      ) : log.rows.length === 0 ? (
        <p data-email-delivery-state="none-sent" className={`py-3 text-[14px] ${TEMPLATE_SUBLINE}`}>
          No emails were sent in the last 7 days.
        </p>
      ) : (
        <>
          <TemplateNums
            items={[
              { label: 'Delivered', value: formatCount(log.summary.delivered), tone: 'ok' },
              { label: 'Did not arrive', value: formatCount(missed), tone: missed > 0 ? 'danger' : undefined },
              { label: 'Waiting', value: formatCount(log.summary.waiting) },
            ]}
          />
          <TemplateNums
            items={[
              { label: 'No answer', value: formatCount(log.summary.unknown), tone: log.summary.unknown > 0 ? 'warn' : undefined },
              { label: 'Total', value: formatCount(log.summary.total) },
            ]}
          />
          {log.truncated ? (
            <p className="text-[13px]" style={{ color: 'rgb(var(--color-warn))' }}>
              Counts cover the newest {log.rows.length} sends only.
            </p>
          ) : null}
          <ul aria-label="Emails sent in the last 7 days" className="[&>li+li]:border-t [&>li+li]:border-[color:var(--m-line)]">
            {log.rows.slice(0, SHOWN).map((r) => {
              const v = verdictOf(r, now);
              return (
                <li key={r.delivery_id} data-delivery-verdict={v} className="flex min-h-14 items-start gap-2.5 py-2.5">
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[15px] font-semibold leading-tight text-ink">{r.subject}</b>
                    <span className={`mt-0.5 block ${TEMPLATE_SUBLINE}`}>
                      {r.recipient_masked} · {String(r.kind).replace(/_/g, ' ')} · {relativeTime(r.created_at)}
                      {r.last_event && VERDICT_LABEL[v].toLowerCase() !== r.last_event ? ` · resend: ${r.last_event}` : ''}
                    </span>
                    {r.error && v !== 'delivered' ? (
                      <span className="mt-0.5 block break-words text-[13px] text-[rgb(var(--color-danger))]">{r.error}</span>
                    ) : null}
                  </span>
                  <span className={`mt-0.5 inline-flex flex-none rounded-full px-2 py-0.5 text-[12px] font-semibold ${TONE[v]}`}>
                    {VERDICT_LABEL[v]}
                  </span>
                </li>
              );
            })}
          </ul>
          {log.rows.length > SHOWN ? (
            <p className={`py-2 text-[13px] ${TEMPLATE_SUBLINE}`}>
              Showing the newest {formatCount(SHOWN)} of {formatCount(log.rows.length)}.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
