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
import { RefreshCw } from 'lucide-react';
import {
  listReusableBookings,
  requestVendorReuseForm,
  acceptVendorReuseForm,
  cancelVendorReuseForm,
} from '../_actions/reuse-actions';

function peso(n: number | null): string {
  if (n == null) return '—';
  return `₱${new Intl.NumberFormat('en-PH').format(n)}`;
}

export async function ReuseBookingsPanel() {
  const { enabled, sources, targets, requests } = await listReusableBookings();
  if (!enabled) return null;
  if (sources.length === 0 && requests.length === 0) return null;

  return (
    <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream/60 p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-display text-lg italic text-ink/85">
        <RefreshCw className="h-4.5 w-4.5 text-terracotta" strokeWidth={1.75} aria-hidden />
        Book a past vendor again
      </h3>
      <p className="text-xs text-ink/55">
        Re-book a vendor you&rsquo;ve locked before for another event. They&rsquo;ll re-price it for
        the new date — a fresh booking, so the usual booking terms apply.
      </p>

      {sources.length > 0 && targets.length > 0 ? (
        <form action={requestVendorReuseForm} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <select
            name="source_event_vendor_id"
            required
            defaultValue=""
            className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
          >
            <option value="" disabled>
              Choose a past vendor…
            </option>
            {sources.map((s) => (
              <option key={s.sourceEventVendorId} value={s.sourceEventVendorId}>
                {s.vendorName} · {s.sourceEventLabel}
              </option>
            ))}
          </select>
          <select
            name="target_event_id"
            required
            defaultValue=""
            className="rounded-lg border border-ink/20 bg-white px-3 py-1.5 text-sm"
          >
            <option value="" disabled>
              For which event…
            </option>
            {targets.map((t) => (
              <option key={t.eventId} value={t.eventId}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-terracotta-700 px-4 py-1.5 text-sm font-semibold text-cream hover:bg-terracotta-800"
          >
            Request
          </button>
        </form>
      ) : null}

      {requests.length > 0 ? (
        <ul className="space-y-2">
          {requests.map((r) => (
            <li
              key={r.requestId}
              className="rounded-xl border border-ink/10 bg-cream px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-ink">
                    {r.vendorName ?? 'Vendor'} → {r.targetEventLabel}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">
                    {r.status}
                    {r.status === 'quoted' ? ` · ${peso(r.quotedTotalPhp)}` : ''}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {r.status === 'quoted' ? (
                    <form action={acceptVendorReuseForm}>
                      <input type="hidden" name="request_id" value={r.requestId} />
                      <button
                        type="submit"
                        className="rounded-lg bg-success-600 px-3 py-1 text-xs font-semibold text-white hover:bg-success-700"
                      >
                        Accept
                      </button>
                    </form>
                  ) : null}
                  {r.status === 'pending' || r.status === 'quoted' ? (
                    <form action={cancelVendorReuseForm}>
                      <input type="hidden" name="request_id" value={r.requestId} />
                      <button type="submit" className="rounded-lg border border-ink/20 px-3 py-1 text-xs text-ink/70">
                        Cancel
                      </button>
                    </form>
                  ) : null}
                </span>
              </div>
              {r.status === 'accepted' ? (
                <p className="mt-1 text-xs text-success-800">
                  Added to {r.targetEventLabel}. Open that event&rsquo;s vendor list to lock it in.
                </p>
              ) : null}
              {r.scope.length > 0 ? (
                <p className="mt-1 truncate text-[11px] text-ink/50">
                  Includes: {r.scope.map((s) => s.label).join(', ')}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
