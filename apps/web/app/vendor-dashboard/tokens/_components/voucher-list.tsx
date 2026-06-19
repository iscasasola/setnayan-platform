import { Clock3 } from 'lucide-react';

/**
 * VoucherList — earned-token voucher inventory + expiry warning surface.
 *
 * Each row is one `earned_token_vouchers` entry. The parent page selects up
 * to 10 vouchers (ORDER BY expires_at ASC) so the soonest-to-expire surfaces
 * first. Vouchers with `tokens_remaining = 0` are filtered out at the query
 * layer — no need to render zero-balance vouchers as visual noise.
 *
 * Expiry tone — daysToExpiry computed at render time:
 *   - <= 0 days       → red    (expired but not yet evaluated · next read
 *                                 fires evaluate_earned_token_expiry which
 *                                 will zero the balance; we still show the
 *                                 row honestly until the sweep clears it)
 *   - 1–7 days        → amber  (urgency · "use it or lose it" prompt)
 *   - 8+ days         → muted  (normal · informational only)
 *
 * Per CLAUDE.md 2026-05-28 third row, earned vouchers expire 45 days after
 * grant; the 45-day window is enforced by the migration's
 * `expires_at DEFAULT NOW() + INTERVAL '45 days'`.
 *
 * Grant source labels are humanized; raw enum values (pilot_grant,
 * manpower_handshake, admin_grant) map to friendly editorial copy per
 * [[feedback_setnayan_no_dev_text_post_launch]]. (telemetry_reward +
 * referral_reward retired 2026-06-15 with the token-back mechanic.)
 */

export type VoucherRow = {
  voucher_id: string;
  tokens_granted: number;
  tokens_remaining: number;
  granted_at: string;
  expires_at: string;
  grant_source: string;
};

const GRANT_SOURCE_LABEL: Record<string, string> = {
  pilot_grant: 'Founder bonus',
  manpower_handshake: 'Manpower handshake',
  admin_grant: 'From Setnayan',
};

const SHORT_DATE = new Intl.DateTimeFormat('en-PH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function expiryToneFor(daysToExpiry: number): {
  badge: string;
  text: string;
  border: string;
  bg: string;
} {
  if (daysToExpiry <= 0) {
    return {
      badge: 'Expired',
      text: '#9a1f1f',
      border: 'rgba(154, 31, 31, 0.30)',
      bg: 'rgba(154, 31, 31, 0.06)',
    };
  }
  if (daysToExpiry <= 7) {
    return {
      badge: `${daysToExpiry} day${daysToExpiry === 1 ? '' : 's'} left`,
      text: 'rgb(180, 95, 6)',
      border: 'rgba(180, 95, 6, 0.30)',
      bg: 'rgba(180, 95, 6, 0.06)',
    };
  }
  return {
    badge: `${daysToExpiry} days left`,
    text: 'var(--m-slate)',
    border: 'var(--m-line)',
    bg: 'transparent',
  };
}

function daysBetween(from: Date, to: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((to.getTime() - from.getTime()) / msPerDay);
}

export function VoucherList({ vouchers }: { vouchers: VoucherRow[] }) {
  if (vouchers.length === 0) {
    return (
      <div className="m-card p-6">
        <p className="m-label-mono mb-2">Active vouchers</p>
        <p className="text-sm text-ink/65">
          No active earned-token vouchers yet. Earn tokens through subscription
          bundles, admin grants, or voucher codes.
        </p>
      </div>
    );
  }

  const now = new Date();

  return (
    <div className="m-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="m-label-mono">Active vouchers</p>
        <p className="text-[11px] text-ink/50">FIFO burn · oldest first</p>
      </div>
      <ul className="divide-y" style={{ borderColor: 'var(--m-line)' }}>
        {vouchers.map((v) => {
          const expiresAt = new Date(v.expires_at);
          const days = daysBetween(now, expiresAt);
          const tone = expiryToneFor(days);
          const label = GRANT_SOURCE_LABEL[v.grant_source] ?? v.grant_source;

          return (
            <li key={v.voucher_id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{label}</p>
                <p className="mt-0.5 text-xs text-ink/55">
                  Granted {SHORT_DATE.format(new Date(v.granted_at))} · expires{' '}
                  {SHORT_DATE.format(expiresAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold text-ink">{v.tokens_remaining}</p>
                  {v.tokens_remaining !== v.tokens_granted && (
                    <p className="text-[10px] text-ink/45">of {v.tokens_granted}</p>
                  )}
                </div>
                <span
                  className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-medium"
                  style={{
                    color: tone.text,
                    borderColor: tone.border,
                    background: tone.bg,
                  }}
                >
                  <Clock3 className="h-3 w-3" strokeWidth={1.75} />
                  {tone.badge}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
