import { Handshake } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import { forceCompleteVendor, upholdNonDelivery } from './actions';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Completions · Admin' };

/**
 * /admin/completions — the human backstop for the per-vendor completion handshake
 * (Event Lifecycle Menu §6.1). Surfaces event_vendors rows that are STUCK and
 * can't self-resolve, so an admin can force-complete (unlock the review) or
 * uphold a non-delivery (keep the review frozen, clear the queue):
 *
 *  • disputed — a couple raised a non-delivery dispute; the review gate is frozen
 *    until someone resolves it.
 *  • awaiting_vendor, long after the event — the vendor never marked complete
 *    (the N=30d auto-complete eventually fires read-side, but an admin may act
 *    sooner).
 *  • vendor_marked, unconfirmed for days — the couple is slow to confirm (the
 *    M=7d auto-confirm eventually fires, but a stuck row is visible here).
 *
 * The "stuck" thresholds are computed in JS (PostgREST can't express `now() -
 * interval` in a filter); resolved rows (completion_resolved_at set) are excluded
 * by the query. Auth is enforced at the /admin layout (404 for non-admins); the
 * actions re-gate independently. Reads fail soft; the writes (in actions.ts) are
 * service-role behind requireAdmin().
 */

// "Stuck" thresholds — when a non-disputed row is overdue enough to surface.
const STUCK_AWAITING_DAYS = 14; // vendor never marked complete, event long past
const STUCK_MARKED_DAYS = 5; // vendor marked, couple hasn't confirmed
const DAY_MS = 24 * 60 * 60 * 1000;

type EventVendorRow = {
  vendor_id: string;
  event_id: string;
  vendor_name: string | null;
  marketplace_vendor_id: string | null;
  completion_status: string | null;
  service_marked_complete_at: string | null;
  customer_confirmed_received_at: string | null;
  completion_disputed_at: string | null;
};

type AttentionRow = EventVendorRow & {
  eventName: string;
  eventDate: string | null;
  reason: 'disputed' | 'vendor_overdue' | 'awaiting_confirm';
};

const STATUS_TONE: Record<string, string> = {
  disputed: 'bg-danger-100 text-danger-800',
  awaiting_vendor: 'bg-warn-100 text-warn-900',
  vendor_marked: 'bg-sky-100 text-sky-800',
};

const REASON_LABEL: Record<AttentionRow['reason'], string> = {
  disputed: 'Non-delivery dispute',
  vendor_overdue: 'Vendor never marked complete',
  awaiting_confirm: 'Couple hasn’t confirmed',
};

function olderThan(iso: string | null, days: number, now: number): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && now >= t + days * DAY_MS;
}

export default async function AdminCompletionsPage() {
  const admin = createAdminClient();
  const now = Date.now();

  // Pull unresolved rows in the three actionable states; the "stuck" cut happens
  // in JS below. Cap generously — the JS filter trims to what truly needs eyes.
  const { data: listData, error: listError } = await admin
    .from('event_vendors')
    .select(
      'vendor_id, event_id, vendor_name, marketplace_vendor_id, completion_status, service_marked_complete_at, customer_confirmed_received_at, completion_disputed_at',
    )
    .is('completion_resolved_at', null)
    .in('completion_status', ['disputed', 'awaiting_vendor', 'vendor_marked'])
    .limit(500);
  if (listError) {
    logQueryError('AdminCompletionsPage (event_vendors)', listError);
  }
  const evRows = (listData ?? []) as EventVendorRow[];

  // Resolve event display_name + event_date for the visible rows (one batch).
  const eventIds = Array.from(new Set(evRows.map((r) => r.event_id).filter(Boolean)));
  const { data: eventData } = eventIds.length
    ? await admin.from('events').select('event_id, display_name, event_date').in('event_id', eventIds)
    : { data: [] as Array<{ event_id: string; display_name: string | null; event_date: string | null }> };
  const eventMap = new Map<string, { name: string; date: string | null }>();
  for (const e of eventData ?? []) {
    eventMap.set((e as { event_id: string }).event_id, {
      name: ((e as { display_name: string | null }).display_name ?? '').trim() || 'Untitled event',
      date: (e as { event_date: string | null }).event_date ?? null,
    });
  }

  // Resolve the platform vendor name (business_name) when linked; COALESCE to the
  // couple-entered vendor_name otherwise.
  const profileIds = Array.from(
    new Set(evRows.map((r) => r.marketplace_vendor_id).filter((v): v is string => Boolean(v))),
  );
  const { data: profileData } = profileIds.length
    ? await admin.from('vendor_profiles').select('vendor_profile_id, business_name').in('vendor_profile_id', profileIds)
    : { data: [] as Array<{ vendor_profile_id: string; business_name: string | null }> };
  const profileMap = new Map<string, string>();
  for (const p of profileData ?? []) {
    const name = ((p as { business_name: string | null }).business_name ?? '').trim();
    if (name) profileMap.set((p as { vendor_profile_id: string }).vendor_profile_id, name);
  }

  // Compute the attention list — keep disputed always; keep stuck non-disputed.
  const attention: AttentionRow[] = [];
  for (const r of evRows) {
    const ev = eventMap.get(r.event_id);
    const eventDate = ev?.date ?? null;
    let reason: AttentionRow['reason'] | null = null;
    if (r.completion_status === 'disputed') {
      reason = 'disputed';
    } else if (r.completion_status === 'awaiting_vendor' && olderThan(eventDate, STUCK_AWAITING_DAYS, now)) {
      reason = 'vendor_overdue';
    } else if (
      r.completion_status === 'vendor_marked' &&
      !r.customer_confirmed_received_at &&
      olderThan(r.service_marked_complete_at, STUCK_MARKED_DAYS, now)
    ) {
      reason = 'awaiting_confirm';
    }
    if (!reason) continue;
    attention.push({
      ...r,
      eventName: ev?.name ?? 'Untitled event',
      eventDate,
      reason,
    });
  }
  // Disputes first, then oldest event first.
  attention.sort((a, b) => {
    if ((a.reason === 'disputed') !== (b.reason === 'disputed')) return a.reason === 'disputed' ? -1 : 1;
    const ad = a.eventDate ? new Date(a.eventDate).getTime() : Infinity;
    const bd = b.eventDate ? new Date(b.eventDate).getTime() : Infinity;
    return ad - bd;
  });

  const disputedCount = attention.filter((r) => r.reason === 'disputed').length;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <Handshake className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold tracking-tight">Completions</h1>
        </div>
        <p className="text-sm text-ink/65">
          Vendor service completions that can&apos;t self-resolve — open non-delivery disputes plus
          long-stuck handshakes. <span className="font-semibold">{disputedCount}</span> open{' '}
          {disputedCount === 1 ? 'dispute' : 'disputes'} · {attention.length} total needing attention.
        </p>
        <p className="rounded-md border border-ink/10 bg-cream px-3 py-2 text-xs text-ink/65">
          <span className="font-semibold">Force-complete</span> unlocks the couple&apos;s review +
          recommendation (use when the service was delivered and the handshake just stalled).{' '}
          <span className="font-semibold">Uphold non-delivery</span> keeps the review closed (use when
          the vendor genuinely didn&apos;t deliver) and clears the row. Both notify the couple.
        </p>
      </header>

      {listError ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          Completions couldn&apos;t load right now. We&apos;ve logged the issue — refresh in a moment.
        </p>
      ) : null}

      <CompletionsTable rows={attention} profileMap={profileMap} />

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
        Source · Event Lifecycle Menu §6.1 · table <code>event_vendors</code> (migrations 20270101000000
        + 20270106000000)
      </p>
    </div>
  );
}

function CompletionsTable({
  rows,
  profileMap,
}: {
  rows: AttentionRow[];
  profileMap: Map<string, string>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-ink/15 bg-cream p-8 text-center">
        <p className="text-sm text-ink/65">
          Nothing needs attention — no open disputes and no stuck completions.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-ink/10 bg-cream">
      <table className="w-full text-left text-sm">
        <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
          <tr>
            <th className="px-3 py-3 font-medium">Event</th>
            <th className="px-3 py-3 font-medium">Vendor</th>
            <th className="px-3 py-3 font-medium">Why</th>
            <th className="hidden px-3 py-3 font-medium md:table-cell">Status</th>
            <th className="hidden px-3 py-3 font-medium lg:table-cell">Marked / event</th>
            <th className="px-3 py-3 font-medium">Resolve</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const vendorName =
              (r.marketplace_vendor_id && profileMap.get(r.marketplace_vendor_id)) ||
              (r.vendor_name ?? '').trim() ||
              'Unnamed vendor';
            const offPlatform = !r.marketplace_vendor_id;
            const tone = STATUS_TONE[r.completion_status ?? ''] ?? 'bg-ink/10 text-ink/60';
            return (
              <tr key={r.vendor_id} className="border-t border-ink/5 hover:bg-terracotta/[0.04]">
                <td className="px-3 py-3">
                  <p className="font-medium text-ink">{r.eventName}</p>
                  {r.eventDate ? (
                    <p className="text-xs text-ink/55" title={r.eventDate}>
                      {relativeTime(r.eventDate)}
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <p className="font-medium text-ink">{vendorName}</p>
                  {offPlatform ? (
                    <p className="text-[10px] uppercase tracking-[0.15em] text-ink/45">Off-platform</p>
                  ) : null}
                </td>
                <td className="px-3 py-3 text-ink/80">{REASON_LABEL[r.reason]}</td>
                <td className="hidden px-3 py-3 md:table-cell">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${tone}`}
                  >
                    {r.completion_status}
                  </span>
                </td>
                <td className="hidden px-3 py-3 text-xs text-ink/60 lg:table-cell">
                  {r.service_marked_complete_at ? (
                    <span title={r.service_marked_complete_at}>
                      {relativeTime(r.service_marked_complete_at)}
                    </span>
                  ) : (
                    <span className="text-ink/40">not marked</span>
                  )}
                </td>
                <td className="px-3 py-3 align-top">
                  <div className="flex flex-col gap-2">
                    <details className="min-w-[13rem]">
                      <summary className="cursor-pointer select-none text-xs font-medium text-success-700">
                        Force-complete
                      </summary>
                      <form action={forceCompleteVendor} className="mt-2 space-y-2">
                        <input type="hidden" name="event_id" value={r.event_id} />
                        <input type="hidden" name="vendor_id" value={r.vendor_id} />
                        <textarea
                          name="note"
                          rows={2}
                          placeholder="Why (optional) — e.g. confirmed delivery off-platform"
                          className="input-field text-xs"
                          aria-label="Force-complete note"
                        />
                        <SubmitButton pendingLabel="Marking…" className="button-secondary text-xs">
                          Mark as delivered
                        </SubmitButton>
                      </form>
                    </details>
                    {r.reason === 'disputed' ? (
                      <details className="min-w-[13rem]">
                        <summary className="cursor-pointer select-none text-xs font-medium text-danger-700">
                          Uphold non-delivery
                        </summary>
                        <form action={upholdNonDelivery} className="mt-2 space-y-2">
                          <input type="hidden" name="event_id" value={r.event_id} />
                          <input type="hidden" name="vendor_id" value={r.vendor_id} />
                          <textarea
                            name="note"
                            rows={2}
                            required
                            placeholder="Required — what was decided and why"
                            className="input-field text-xs"
                            aria-label="Uphold note"
                          />
                          <SubmitButton pendingLabel="Applying…" className="button-secondary text-xs">
                            Keep review closed
                          </SubmitButton>
                        </form>
                      </details>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
