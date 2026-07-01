/**
 * /admin/referrals — couple referral rewards monitor (read-only).
 *
 * Lists every referral redemption (open → qualified → rewarded) with the
 * referrer + referred account emails, the qualifying/reward timestamps, and
 * the two minted reward voucher codes. Also surfaces the ADMIN-MANAGED reward
 * amount (platform_settings.referral_reward_php) with an inline note when it's
 * 0 (engine live but inert — no vouchers minted until the owner sets a value).
 *
 * Access is gated by the /admin layout (is_internal / is_team_member /
 * account_type='admin'); this page reads via the service-role admin client.
 *
 * Substrate: 20270416213000_couple_referral_rewards.sql
 */

import { Gift, Hourglass, Check } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Referrals · Admin' };

type RedemptionRow = {
  referral_redemption_id: string;
  referrer_user_id: string;
  referred_user_id: string;
  status: 'open' | 'qualified' | 'rewarded';
  qualified_at: string | null;
  rewarded_at: string | null;
  referrer_reward_code: string | null;
  referred_reward_code: string | null;
  created_at: string;
};

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default async function AdminReferralsPage() {
  const admin = createAdminClient();

  const [settingsRes, redemptionsRes] = await Promise.all([
    admin.from('platform_settings').select('referral_reward_php').eq('id', 1).maybeSingle(),
    admin
      .from('referral_redemptions')
      .select(
        'referral_redemption_id, referrer_user_id, referred_user_id, status, qualified_at, rewarded_at, referrer_reward_code, referred_reward_code, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(500),
  ]);

  const rewardPhp = Number(settingsRes.data?.referral_reward_php ?? 0);
  const redemptions = (redemptionsRes.data ?? []) as RedemptionRow[];

  // Resolve emails for display in one round-trip.
  const userIds = Array.from(
    new Set(redemptions.flatMap((r) => [r.referrer_user_id, r.referred_user_id])),
  );
  const emailById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users } = await admin
      .from('users')
      .select('user_id, email')
      .in('user_id', userIds);
    for (const u of users ?? []) {
      emailById.set(u.user_id as string, (u.email as string) || '—');
    }
  }

  const openCount = redemptions.filter((r) => r.status === 'open').length;
  const qualifiedCount = redemptions.filter((r) => r.status === 'qualified').length;
  const rewardedCount = redemptions.filter((r) => r.status === 'rewarded').length;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Gift aria-hidden className="h-6 w-6" strokeWidth={1.75} />
          Referrals
        </h1>
        <p className="text-sm text-ink/65">
          Couples refer couples. A referral qualifies on the referred couple&rsquo;s
          first paid order — both sides then get a single-use reward voucher.
        </p>
      </header>

      {/* Admin-managed reward amount. */}
      <section className="rounded-xl border border-ink/10 bg-cream p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/55">
          Reward per side
        </p>
        <p className="mt-1 text-lg font-semibold text-ink">
          {rewardPhp > 0 ? `₱${rewardPhp.toLocaleString('en-PH')}` : '₱0'}
        </p>
        {rewardPhp <= 0 ? (
          <p className="mt-1 text-sm text-ink/60">
            The referral engine is live but inert — qualifying referrals are
            recorded, but no reward vouchers are minted until an owner sets{' '}
            <code className="rounded bg-ink/5 px-1">referral_reward_php</code> on
            platform settings.
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink/60">
            Each qualifying referral mints two single-use vouchers of this value
            (100% off up to ₱{rewardPhp.toLocaleString('en-PH')} on any covered
            SKU), one per side.
          </p>
        )}
      </section>

      {/* Counts. */}
      <section className="grid grid-cols-3 gap-3">
        {[
          { label: 'Open', value: openCount, Icon: Hourglass },
          { label: 'Qualified', value: qualifiedCount, Icon: Gift },
          { label: 'Rewarded', value: rewardedCount, Icon: Check },
        ].map(({ label, value, Icon }) => (
          <div key={label} className="rounded-xl border border-ink/10 bg-cream p-4">
            <Icon aria-hidden className="h-4 w-4 text-ink/45" strokeWidth={1.75} />
            <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
            <p className="text-xs text-ink/55">{label}</p>
          </div>
        ))}
      </section>

      {/* Redemption table. */}
      <section className="overflow-x-auto rounded-xl border border-ink/10">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-cream text-xs uppercase tracking-wide text-ink/55">
            <tr>
              <th className="px-4 py-2 font-medium">Referrer</th>
              <th className="px-4 py-2 font-medium">Referred</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Signed up</th>
              <th className="px-4 py-2 font-medium">Qualified</th>
              <th className="px-4 py-2 font-medium">Reward codes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {redemptions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-ink/55">
                  No referrals yet.
                </td>
              </tr>
            ) : (
              redemptions.map((r) => (
                <tr key={r.referral_redemption_id}>
                  <td className="px-4 py-2 text-ink/80">
                    {emailById.get(r.referrer_user_id) ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-ink/80">
                    {emailById.get(r.referred_user_id) ?? '—'}
                  </td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-medium text-ink/70">
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-ink/60">{fmtDate(r.created_at)}</td>
                  <td className="px-4 py-2 text-ink/60">{fmtDate(r.qualified_at)}</td>
                  <td className="px-4 py-2 font-mono text-xs text-ink/70">
                    {r.referrer_reward_code || r.referred_reward_code ? (
                      <>
                        {r.referrer_reward_code ?? '—'}
                        {' · '}
                        {r.referred_reward_code ?? '—'}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
