/**
 * Couple-side "Book a past vendor again" panel — the reusable-bookings entry
 * point. Server component; renders NOTHING unless the flag is on (the list
 * action returns enabled:false). Deliberately minimal + dark: it seeds a reuse
 * request (couple initiates), then surfaces the vendor's re-quote to accept.
 *
 * The accepted pick lands as a `shortlisted` row in the target event — the
 * couple locks it in THAT event's vendor list, where the unchanged
 * finalizeVendor → collectBookingFeeAtLock fires a fresh fee.
 */
import { Check, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import type { ReuseRequestStatus } from '@/lib/reusable-bookings';
import {
  listReusableBookings,
  acceptVendorReuseForm,
  cancelVendorReuseForm,
} from '../_actions/reuse-actions';
import { ReuseRequestForm } from './reuse-request-form';

function peso(n: number | null): string {
  if (n == null) return '—';
  return `₱${new Intl.NumberFormat('en-PH').format(n)}`;
}

/* 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 5 · 7 · 13 · 14): a section label and plain rows, no card; where each ask
   stands is a status chip in words (never the stored code in a typewriter face); money in the body face, bold; the
   explaining line behind ⓘ. Every action and fact is kept. */
const STATUS_WORDS: Record<ReuseRequestStatus, { word: string; tone: BadgeTone }> = {
  pending: { word: 'Waiting on them', tone: 'wait' },
  quoted: { word: 'New price in', tone: 'ok' },
  accepted: { word: 'Added', tone: 'ok' },
  declined: { word: 'Declined', tone: 'no' },
  cancelled: { word: 'Cancelled', tone: 'quiet' },
};

export async function ReuseBookingsPanel() {
  const { enabled, sources, targets, requests } = await listReusableBookings();
  if (!enabled) return null;
  if (sources.length === 0 && requests.length === 0) return null;

  return (
    <section className="space-y-2" data-reuse-panel="">
      <InfoTip
        label="Book a past supplier again"
        labelAs="h3"
        align="start"
        labelClassName="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70"
      >
        Re-book a supplier you&rsquo;ve booked before for another event. They&rsquo;ll re-price it for the new date — a
        fresh booking, so the usual booking terms apply.
      </InfoTip>

      {sources.length > 0 && targets.length > 0 ? (
        <ReuseRequestForm
          sources={sources.map((s) => ({ id: s.sourceEventVendorId, label: `${s.vendorName} · ${s.sourceEventLabel}` }))}
          targets={targets.map((t) => ({ id: t.eventId, label: t.label }))}
        />
      ) : null}

      {requests.length > 0 ? (
        <ul className="divide-y divide-ink/10">
          {requests.map((r) => {
            const st = STATUS_WORDS[r.status] ?? { word: 'In progress', tone: 'quiet' as const };
            return (
              <li key={r.requestId} className="min-h-[56px] py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-ink">
                      {r.vendorName ?? 'Supplier'} → {r.targetEventLabel}
                    </span>
                    {r.status === 'quoted' ? (
                      <span className="block text-[15px] font-bold tabular-nums text-ink">{peso(r.quotedTotalPhp)}</span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge tone={st.tone}>{st.word}</Badge>
                    {r.status === 'quoted' ? (
                      <form action={acceptVendorReuseForm}>
                        <input type="hidden" name="request_id" value={r.requestId} />
                        <ActionButton tone="ok" type="submit" icon={<Check aria-hidden />} label="Accept" />
                      </form>
                    ) : null}
                    {r.status === 'pending' || r.status === 'quoted' ? (
                      <form action={cancelVendorReuseForm}>
                        <input type="hidden" name="request_id" value={r.requestId} />
                        <ActionButton tone="neutral" quiet type="submit" icon={<X aria-hidden />} label="Cancel" />
                      </form>
                    ) : null}
                  </span>
                </div>
                {r.status === 'accepted' ? (
                  <p className="mt-1 text-[13px] text-ink/70">
                    Added to {r.targetEventLabel}. Open that event&rsquo;s supplier list to book it.
                  </p>
                ) : null}
                {r.scope.length > 0 ? (
                  <p className="mt-1 truncate text-[13px] text-ink/70">
                    Includes: {r.scope.map((s) => s.label).join(', ')}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
