import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

/**
 * RecentHistory — chronological feed of grant (incoming) + redemption
 * (outgoing) entries merged into a single time-ordered timeline.
 *
 * Source tables:
 *   token_grants_log       · inbound (verified-vendor founder bonus,
 *                            telemetry rewards, manpower handshake, admin
 *                            grants, referral rewards)
 *   token_redemptions_log  · outbound (bid acceptance · per-action SKU spend
 *                            · manpower handshake fee · future Phase F-Bid
 *                            engagement)
 *
 * Server-side merge: the parent page reads up to 10 of each, then sorts the
 * combined list DESC by timestamp and slices to 15 entries total. No
 * pagination yet — 15 entries covers typical pilot-cohort activity and the
 * combined ledger surface lands in V1.x post-pilot.
 *
 * Source labels use the same humanized strings as `voucher-list.tsx` for
 * grant_source consistency; redemption rows show service_code stamped at
 * burn time + (optional) related_event_id reference.
 */

export type HistoryEntry =
  | {
      kind: 'grant';
      id: string;
      at: string;
      tokens: number;
      source: string;
      rationale: string | null;
    }
  | {
      kind: 'redemption';
      id: string;
      at: string;
      tokens: number;
      service_code: string | null;
    };

const GRANT_SOURCE_LABEL: Record<string, string> = {
  pilot_grant: 'Founder bonus',
  manpower_handshake: 'Manpower handshake',
  admin_grant: 'Issued by Setnayan',
};

// Friendly labels for the V2 service_codes that consume vendor tokens.
// Per CLAUDE.md 2026-05-28 third row · V2 cutover · vendor tokens redeem
// against bid acceptance + manpower handshake + per-action SKUs. Anything
// not in this map renders the raw service_code which still reads as
// informational metadata to the vendor.
const SERVICE_CODE_LABEL: Record<string, string> = {
  BID_ACCEPTANCE: 'Bid acceptance',
  MANPOWER_HANDSHAKE: 'Manpower handshake',
};

const SHORT_DATETIME = new Intl.DateTimeFormat('en-PH', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

export function RecentHistory({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="m-card p-6">
        <p className="m-label-mono mb-2">Recent activity</p>
        <p className="text-sm text-ink/65">
          No grants or redemptions yet. Activity here updates the moment a token
          is earned or spent.
        </p>
      </div>
    );
  }

  return (
    <div className="m-card p-6">
      <p className="m-label-mono mb-4">Recent activity</p>
      <ul className="divide-y" style={{ borderColor: 'var(--m-line)' }}>
        {entries.map((entry) => {
          const isGrant = entry.kind === 'grant';
          const sign = isGrant ? '+' : '−';
          const color = isGrant ? 'var(--m-orange)' : 'var(--m-slate)';
          const Icon = isGrant ? ArrowDownRight : ArrowUpRight;
          const label = isGrant
            ? GRANT_SOURCE_LABEL[entry.source] ?? entry.source
            : entry.service_code
              ? SERVICE_CODE_LABEL[entry.service_code] ?? entry.service_code
              : 'Spent on Setnayan';
          const secondary = isGrant
            ? entry.rationale ?? 'Token grant'
            : entry.service_code ?? 'Redemption';

          return (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{
                    background: isGrant
                      ? 'rgba(201, 107, 58, 0.10)'
                      : 'rgba(45, 48, 56, 0.06)',
                    color,
                  }}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{label}</p>
                  <p className="truncate text-[11px] text-ink/55">
                    {SHORT_DATETIME.format(new Date(entry.at))} · {secondary}
                  </p>
                </div>
              </div>
              <p
                className="shrink-0 text-sm font-semibold"
                style={{ color }}
              >
                {sign}
                {entry.tokens}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
