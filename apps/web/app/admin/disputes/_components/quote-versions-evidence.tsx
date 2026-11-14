import { FileText } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { formatCount } from '@/lib/format-number';
import { formatCentavos, PROPOSAL_STATUS_LABEL } from '@/lib/vendor-proposals';
import {
  QUOTE_VERSION_SELECT,
  changesSincePrevious,
  orderQuoteVersions,
  versionExactTime,
  type QuoteVersion,
  type QuoteVersionRow,
} from '@/lib/quote-versions';
import { QuoteWhatChanged } from '@/app/_components/quote-what-changed';

/**
 * ADMIN › DISPUTES — EVERY VERSION OF A SUPPLIER'S QUOTES, WITH EXACT TIMESTAMPS (owner, 4 Nov
 * 2026, approved prototype "Chat · every version": "Admin › Disputes opens the same version list
 * with exact timestamps, so a disagreement over what was quoted is settled from the record").
 *
 * The same versions the couple and the supplier see (`orderQuoteVersions`), the same What changed
 * (`changesSincePrevious` → `<QuoteWhatChanged>`). Service-role read on an admin-gated page.
 */
export type QuoteVersionGroup = { eventId: string; eventName: string; versions: QuoteVersion[] };
export type QuoteVersionsByVendor = Map<string, QuoteVersionGroup[]>;

/** null = the read was refused (say so), never an empty map passed off as "no quotes". */
export async function fetchQuoteVersionsByVendor(opts: {
  adminClient: SupabaseClient;
  vendorProfileIds: string[];
}): Promise<QuoteVersionsByVendor | null> {
  const out: QuoteVersionsByVendor = new Map();
  if (opts.vendorProfileIds.length === 0) return out;
  const { data, error } = await opts.adminClient
    .from('vendor_proposals')
    .select(QUOTE_VERSION_SELECT)
    .in('vendor_profile_id', opts.vendorProfileIds)
    .neq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error || !data) {
    logQueryError('AdminDisputesPage (quote versions)', error);
    return null;
  }
  const rows = data as QuoteVersionRow[];
  const eventIds = [...new Set(rows.map((r) => r.event_id))];
  const names = new Map<string, string>();
  if (eventIds.length > 0) {
    const { data: evs, error: evErr } = await opts.adminClient
      .from('events')
      .select('event_id, display_name')
      .in('event_id', eventIds);
    if (evErr) logQueryError('AdminDisputesPage (quote version events)', evErr);
    for (const e of (evs ?? []) as Array<{ event_id: string; display_name: string | null }>)
      names.set(e.event_id, (e.display_name ?? '').trim());
  }
  for (const v of orderQuoteVersions(rows)) {
    const [eventId = '', vendorId = ''] = v.pair.split('|');
    const list = out.get(vendorId) ?? [];
    let group: QuoteVersionGroup | undefined = list.find((g) => g.eventId === eventId);
    if (!group) {
      group = { eventId, eventName: names.get(eventId) || 'Unnamed event', versions: [] };
      list.push(group);
    }
    group.versions.push(v);
    out.set(vendorId, list);
  }
  for (const list of out.values()) for (const g of list) g.versions.sort((a, b) => b.version - a.version);
  return out;
}

function statusOf(s: string): string {
  return PROPOSAL_STATUS_LABEL[s as keyof typeof PROPOSAL_STATUS_LABEL] ?? s;
}

export function QuoteVersionsEvidence({
  groups,
}: {
  /** This vendor's quotes; undefined = none; null = the read was refused. */
  groups: QuoteVersionGroup[] | undefined | null;
}) {
  if (groups === null) {
    return <p className="mt-2 text-[12px] text-danger-700">Couldn&rsquo;t read this supplier&rsquo;s quote versions.</p>;
  }
  if (!groups || groups.length === 0) return null;
  const total = groups.reduce((n, g) => n + g.versions.length, 0);
  return (
    <details className="mt-2" data-admin-quote-versions="">
      <summary className="inline-flex cursor-pointer select-none items-center gap-1 text-[12px] font-medium text-mulberry">
        <FileText aria-hidden className="h-3 w-3" strokeWidth={2} />
        Quote versions ({formatCount(total)})
      </summary>
      <div className="mt-2 space-y-3">
        {groups.map((g) => (
          <div key={g.eventId}>
            <p className="text-[12px] font-medium text-ink">{g.eventName} · newest first</p>
            <ul className="mt-1 space-y-1.5">
              {g.versions.map((v, i) => {
                const changes = changesSincePrevious(v);
                return (
                  <li key={v.proposalId} className="border-b border-ink/10 py-2 text-[12px] text-ink/80">
                    <details>
                      <summary className="flex cursor-pointer select-none items-baseline gap-2">
                        <span className="flex-1">
                          <b className="font-medium text-ink">
                            Version {v.version}
                            {i === 0 && v.status !== 'superseded' ? ' · current' : ''}
                          </b>{' '}
                          · {statusOf(v.status)}
                          <span className="block text-[12px] text-ink/60 tabular-nums">
                            Sent {versionExactTime(v.at)} · {v.publicId}
                          </span>
                        </span>
                        <span className="tabular-nums text-ink">{formatCentavos(v.totalCentavos)}</span>
                      </summary>
                      <ul className="mt-1.5">
                        {v.lines.map((li, k) => (
                          <li key={k} className="flex justify-between gap-2 py-0.5">
                            <span>{li.label}</span>
                            <span className="tabular-nums">
                              {typeof li.amount_centavos === 'number' ? formatCentavos(li.amount_centavos) : 'Complimentary'}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {v.plan ? <p className="mt-1 text-ink/60">{v.plan}</p> : null}
                      {changes && v.previous ? (
                        <QuoteWhatChanged changes={changes} sinceVersion={v.previous.version} />
                      ) : null}
                    </details>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
