import { Handshake } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import { forceCompleteVendor, upholdNonDelivery } from './actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { PageMasthead } from '@/app/_components/page-masthead';
import { ConsoleTable } from '@/app/admin/_components/console-table';

import { requireAdmin } from '@/lib/admin/require-admin';
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

/**
 * The cap on the SOURCE scan, not on the rendered list.
 *
 * ⚠ The two are not the same number and it matters. The rendered "needs
 * attention" list is a JS filter over this scan, so it is always shorter — which
 * means ConsoleTable's own `cap` check (rendered length >= cap) can only fire in
 * the one case where every scanned row was also stuck. The honest disclosure is
 * about the SCAN, so it is stated in `note` whenever the scan filled up. `cap` is
 * passed as well, from this same constant, because a full rendered page is
 * genuinely truncated too. Measuring downstream of the cut would under-report it.
 */
const SOURCE_SCAN_LIMIT = 500;

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
  await requireAdmin();
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
    .limit(SOURCE_SCAN_LIMIT);
  if (listError) {
    logQueryError('AdminCompletionsPage (event_vendors)', listError);
  }
  // NULL, not []: a refused read must stay distinguishable from a real zero. The
  // page used to render its error banner AND "Nothing needs attention — no open
  // disputes and no stuck completions" at the same time, which is a contradiction
  // the second half wins, because it is the one that sounds like an answer.
  const evRows = listData as EventVendorRow[] | null;
  const scanned = evRows ?? [];
  const scanFilled = scanned.length >= SOURCE_SCAN_LIMIT;

  // Resolve event display_name + event_date for the visible rows (one batch).
  const eventIds = Array.from(new Set(scanned.map((r) => r.event_id).filter(Boolean)));
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
    new Set(scanned.map((r) => r.marketplace_vendor_id).filter((v): v is string => Boolean(v))),
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
  for (const r of scanned) {
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

  // `null` when nothing was counted — "0 open disputes" over a refused read is
  // the same lie in a smaller box.
  const disputedCount = evRows ? attention.filter((r) => r.reason === 'disputed').length : null;

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <PageMasthead
        className="mb-6"
        title="Completions"
        lede={
          disputedCount === null ? (
            'Vendor service completions that can’t self-resolve — open non-delivery disputes plus long-stuck handshakes. The queue could not be read, so there is no count.'
          ) : (
            <>
              Vendor service completions that can&apos;t self-resolve — open non-delivery disputes
              plus long-stuck handshakes. <span className="font-semibold">{disputedCount}</span> open{' '}
              {disputedCount === 1 ? 'dispute' : 'disputes'} · {attention.length} total needing
              attention.
            </>
          )
        }
      />

      <p className="mb-4 rounded-md border border-ink/10 bg-white/70 px-3 py-2 text-xs text-ink/70">
        <span className="font-semibold">Force-complete</span> unlocks the couple&apos;s review +
        recommendation (use when the service was delivered and the handshake just stalled).{' '}
        <span className="font-semibold">Uphold non-delivery</span> keeps the review closed (use when
        the vendor genuinely didn&apos;t deliver) and clears the row. Both notify the couple.
      </p>

      <ConsoleTable
        rows={evRows === null ? null : attention}
        readPermitted
        readError={listError}
        reads="the stuck completions queue"
        cap={SOURCE_SCAN_LIMIT}
        label="Completions needing attention"
        minWidth="60rem"
        note={
          scanFilled
            ? `The scan behind this list stopped at ${SOURCE_SCAN_LIMIT.toLocaleString()} unresolved rows, so a stuck completion beyond that point is not shown here. This list is a filter over that scan, not over the whole table.`
            : undefined
        }
        rowKey={(r) => r.vendor_id}
        empty={{
          Icon: Handshake,
          title: 'Nothing needs attention',
          blurb:
            'No open disputes, and no handshake stuck long enough to need a human. Rows appear here on their own when a vendor never marks a service complete, when a couple never confirms, or when either side disputes.',
        }}
        columns={[
          {
            header: 'Event',
            cell: (r) => (
              <>
                <p className="font-medium text-ink">{r.eventName}</p>
                {r.eventDate ? (
                  <p className="text-xs text-ink/70" title={r.eventDate}>
                    {relativeTime(r.eventDate)}
                  </p>
                ) : null}
              </>
            ),
          },
          {
            header: 'Vendor',
            cell: (r) => {
              const vendorName =
                (r.marketplace_vendor_id && profileMap.get(r.marketplace_vendor_id)) ||
                (r.vendor_name ?? '').trim() ||
                'Unnamed vendor';
              return (
                <>
                  <p className="font-medium text-ink">{vendorName}</p>
                  {!r.marketplace_vendor_id ? (
                    <p className="text-[10px] uppercase tracking-[0.15em] text-ink/70">
                      Off-platform
                    </p>
                  ) : null}
                </>
              );
            },
          },
          {
            header: 'Why',
            cell: (r) => <span className="text-ink/80">{REASON_LABEL[r.reason]}</span>,
          },
          {
            header: 'Status',
            hideBelow: 'md',
            cell: (r) => (
              <span
                className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                  STATUS_TONE[r.completion_status ?? ''] ?? 'bg-ink/10 text-ink/70'
                }`}
              >
                {r.completion_status}
              </span>
            ),
          },
          {
            header: 'Marked / event',
            hideBelow: 'lg',
            cell: (r) =>
              r.service_marked_complete_at ? (
                <span className="text-xs text-ink/70" title={r.service_marked_complete_at}>
                  {relativeTime(r.service_marked_complete_at)}
                </span>
              ) : (
                <span className="text-xs text-ink/70">not marked</span>
              ),
          },
          {
            header: 'Resolve',
            // Not a fast button: each outcome opens its own form, and Uphold
            // requires a note because `upholdNonDelivery` refuses to run without
            // one. The shape is decided by what the action demands, never by
            // taste — and ConsoleTable offers no actions API precisely so a
            // caller has to mean it.
            cell: (r) => (
              <div className="flex flex-col gap-2">
                <details className="min-w-[13rem]">
                  <summary className="cursor-pointer select-none text-xs font-medium text-mulberry">
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
            ),
          },
        ]}
      />

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/70">
        Source · Event Lifecycle Menu §6.1 · table <code>event_vendors</code> (migrations 20270101000000
        + 20270106000000)
      </p>
    </div>
  );
}
