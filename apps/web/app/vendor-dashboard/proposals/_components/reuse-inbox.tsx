/**
 * Vendor-side reuse inbox — a past client asked to book you again. Server
 * component; renders NOTHING unless the flag is on. The vendor OWNS the pricing:
 * re-quote (set a NEW price) or decline (never forced to re-offer a retired
 * package). Minimal + dark.
 */
import { RefreshCw } from 'lucide-react';
import { listVendorReuseRequests, vendorQuoteReuseForm, vendorDeclineReuseForm } from '../reuse-actions';
import { shopInputClass } from '../../_components/kit';

export async function VendorReuseInbox() {
  const { enabled, rows } = await listVendorReuseRequests();
  if (!enabled || rows.length === 0) return null;

  return (
    <section className="border-t border-[color:var(--m-line)] pt-4">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
        <RefreshCw aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} /> Re-booking requests
      </h2>
      <p className="mt-1 text-[13px] text-[color:var(--m-slate-2)]">
        A past client wants to book you again for a new event. Set a fresh price, or decline if you
        no longer offer this.
      </p>
      <ul className="mt-3 space-y-3">
        {rows.map((r) => (
          <li key={r.requestId} className="rounded-lg border border-ink/10 bg-white/70 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-[color:var(--m-slate-2)]">
              {r.category ?? 'service'} · {r.status}
            </div>
            {r.scope.length > 0 ? (
              <ul className="mt-1 list-disc pl-5 text-sm text-ink/75">
                {r.scope.map((s, i) => (
                  <li key={i}>
                    {s.label}
                    {s.detail ? <span className="text-[color:var(--m-slate-2)]"> — {s.detail}</span> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[13px] text-[color:var(--m-slate-2)]">No saved inclusions — quote from scratch.</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <form action={vendorQuoteReuseForm} className="flex items-center gap-2">
                <input type="hidden" name="request_id" value={r.requestId} />
                <input
                  type="number"
                  name="new_total_php"
                  min={0}
                  step="1"
                  required
                  placeholder="New price (₱)"
                  defaultValue={r.quotedTotalPhp ?? ''}
                  className={`w-36 ${shopInputClass}`}
                />
                <button
                  type="submit"
                  className="rounded-lg bg-terracotta-700 px-3 py-1.5 text-sm font-semibold text-cream hover:bg-terracotta-800"
                >
                  {r.status === 'quoted' ? 'Re-quote' : 'Send quote'}
                </button>
              </form>
              <form action={vendorDeclineReuseForm}>
                <input type="hidden" name="request_id" value={r.requestId} />
                <button type="submit" className="rounded-lg border border-ink/20 px-3 py-1.5 text-sm text-ink/70">
                  Decline
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
