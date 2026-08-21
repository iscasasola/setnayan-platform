/**
 * ReferralsSurface — couple referral rewards monitor, inside the tabbed
 * /admin/studio studio (Studio Studio slice 3 · Marketing lane).
 *
 * Lists every referral redemption (open → qualified → rewarded) with the
 * referrer + referred account emails, the qualifying/reward timestamps, and
 * the two minted reward voucher codes. Also surfaces the ADMIN-MANAGED reward
 * amount (platform_settings.referral_reward_php) with an inline note when it's
 * 0 (engine live but inert — no vouchers minted until the owner sets a value).
 *
 * Access is gated by /admin/studio's own `requireAdmin()`; every read here goes
 * through the service-role admin client, which RLS cannot silently filter — so
 * `readPermitted` is honestly the literal `true`.
 *
 * Substrate: 20270416213000_couple_referral_rewards.sql
 *
 * ── WHAT CHANGED 2026-08-17 · THREE THINGS, none of them looks ──────────────
 * 1 · 🚨 THE REDEMPTION LIST LIED ON A REFUSED READ. It ended `(data ?? [])`
 *     and branched on `length === 0`, so a query Supabase REFUSED — a phantom
 *     column, a stale enum value, an unapplied migration, a missing grant —
 *     rendered "No referrals yet." Nothing threw; the error object was fetched
 *     and dropped on the floor. Null now survives to the render as NOT
 *     MEASURED, and <ConsoleTable> owns the distinction.
 *
 * 2 · 🚨 THE COUNTS AND THE REWARD FIGURE LIED IN THE SAME BREATH. Three tiles
 *     read "0" and the reward tile read "₱0" — under a sentence stating as fact
 *     that "the referral engine is live but inert". That is a claim about the
 *     program's configuration, printed from a read that returned nothing.
 *     KpiStatCard renders `null` as an em-dash, which is what an unmeasured
 *     count actually is; the three inline tiles it replaces had no way to say
 *     "we do not know". Their decorative icons go with them — three glyphs is
 *     a fair trade for three numbers that can no longer be invented.
 *
 * 3 · 🔴 AND THE MASTER SWITCH WAS THE DANGEROUS ONE. The action's own comment
 *     reads "An unchecked checkbox doesn't submit, so absence = off." The box's
 *     `defaultChecked` came from that same settings read, so a REFUSED read
 *     drew an unchecked box next to the words "Currently off" — and an admin
 *     pressing Save to confirm what they saw would have SWITCHED THE WHOLE
 *     REFERRAL PROGRAM OFF, from a state nobody had actually read. The form is
 *     now withheld entirely when the setting could not be read: a control whose
 *     current value is unknown must not offer to overwrite it.
 *
 * ⛔ The cap was silent too. `.limit(500)` with nothing on screen saying so; the
 * number is now one constant used by the query AND by `cap`.
 */

import { Gift } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SubmitButton } from '@/app/_components/submit-button';
import { setReferralProgramEnabled } from '@/app/admin/referrals/actions';
import { PageMasthead } from '@/app/_components/page-masthead';
import { KpiStatCard } from '@/app/admin/_components/kpi-stat-card';
import { ConsoleTable, type ConsoleColumn } from '@/app/admin/_components/console-table';

/**
 * The read's `.limit(...)`. ONE constant, used by the query and by `cap`, so a
 * full page says "there are more" instead of reading as the whole history.
 */
const REDEMPTION_CAP = 500;

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

// ⚠ LOGGING NEVER CHANGED THE RENDER — the sentence from this file's own
// conversion, and the first cut of this fix only logged. `'—'` is ALREADY the
// legitimate value for a missing name here, so the dash is ambiguous between
// "nothing on file" and "we could not read it": the same conflation as
// error-vs-empty, one field down. It has to be said on screen.
export async function ReferralsSurface() {
  let labelsUnread = false;
  const admin = createAdminClient();

  const [settingsRes, redemptionsRes] = await Promise.all([
    admin
      .from('platform_settings')
      .select('referral_reward_php, referral_program_enabled')
      .eq('id', 1)
      .maybeSingle(),
    admin
      .from('referral_redemptions')
      .select(
        'referral_redemption_id, referrer_user_id, referred_user_id, status, qualified_at, rewarded_at, referrer_reward_code, referred_reward_code, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(REDEMPTION_CAP),
  ]);

  if (settingsRes.error) logQueryError('AdminReferralsSurface.settings', settingsRes.error);
  if (redemptionsRes.error) logQueryError('AdminReferralsSurface.redemptions', redemptionsRes.error);

  // `settingsKnown` is the whole point: `maybeSingle()` resolves `{ data: null }`
  // for BOTH "no settings row" and "the read was refused", and only `error`
  // separates them. Everything about the program's configuration below — the
  // reward figure, the on/off sentence, whether the Save button exists at all —
  // hangs on this being false rather than on a `?? 0` default.
  const settingsKnown = !settingsRes.error;
  const settings = settingsRes.data as
    | { referral_reward_php?: number | null; referral_program_enabled?: boolean | null }
    | null;
  const rewardPhp = settingsKnown ? Number(settings?.referral_reward_php ?? 0) : null;
  const programEnabled = settings?.referral_program_enabled === true;

  // NULL SURVIVES. `redemptions` stays nullable; `listed` is the flattened copy
  // the email lookup and the counts read.
  const redemptions = redemptionsRes.data as RedemptionRow[] | null;
  const listed = redemptions ?? [];

  const userIds = Array.from(
    new Set(listed.flatMap((r) => [r.referrer_user_id, r.referred_user_id])),
  );
  const emailById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await admin
      .from('users')
      .select('user_id, email')
      .in('user_id', userIds);
    // A refused label lookup does not change the row count, so the table cannot
    // see it — but the reader then cannot tell which account each referral belongs to.
    labelsUnread = labelsUnread || Boolean(usersError);
    if (usersError) logQueryError('ReferralsSurface.userEmails', usersError, {}, 'graceful_degrade');
    for (const u of users ?? []) {
      emailById.set(u.user_id as string, (u.email as string) || '—');
    }
  }

  // A count over an unmeasured list is not zero — it is unknown. KpiStatCard
  // renders null as an em-dash.
  const countOf = (status: RedemptionRow['status']): number | null =>
    redemptions ? redemptions.filter((r) => r.status === status).length : null;

  const columns: ConsoleColumn<RedemptionRow>[] = [
    { header: 'Referrer', cell: (r) => emailById.get(r.referrer_user_id) ?? '—' },
    { header: 'Referred', cell: (r) => emailById.get(r.referred_user_id) ?? '—' },
    {
      header: 'Status',
      cell: (r) => (
        <span className="rounded-full bg-ink/5 px-2 py-0.5 text-xs font-medium text-ink/70">
          {r.status}
        </span>
      ),
    },
    { header: 'Signed up', hideBelow: 'md', mono: true, cell: (r) => fmtDate(r.created_at) },
    { header: 'Qualified', hideBelow: 'md', mono: true, cell: (r) => fmtDate(r.qualified_at) },
    {
      header: 'Reward codes',
      hideBelow: 'lg',
      mono: true,
      cell: (r) =>
        r.referrer_reward_code || r.referred_reward_code
          ? `${r.referrer_reward_code ?? '—'} · ${r.referred_reward_code ?? '—'}`
          : '—',
    },
  ];

  return (
    <div className="space-y-6">
      <PageMasthead
        titleNode={
          <span>
            <Gift aria-hidden className="h-6 w-6" strokeWidth={1.75} />
            Referrals
          </span>
        }
      />

      {/* Master toggle. WITHHELD when the setting could not be read: an
          unchecked checkbox does not submit, so absence means off, so drawing
          this form over a refused read offers to switch the whole program off
          from a state nobody read. */}
      {settingsKnown ? (
        <form action={setReferralProgramEnabled} className="sn-tile p-5">
          <label className="flex items-start gap-3">
            {/* 🎨 `text-mulberry`, not `text-terracotta`. On a checkbox that
                class paints the TICK, and the tick is the only thing on this
                screen that says the referral program is on. The slot named
                `terracotta` is the atelier gold #A9834B at 3.37:1 — it scrapes
                the 3:1 non-text floor and nothing more, on the one mark a person
                has to read correctly. The CTA #C24E25 in the `mulberry` slot
                measures 4.61:1 and matches every other primary control here. */}
            <input
              type="checkbox"
              name="referral_program_enabled"
              defaultChecked={programEnabled}
              className="mt-0.5 h-4 w-4 rounded border-ink/30 text-mulberry focus:ring-mulberry"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-ink">Referral program active</span>
              <span className="text-xs text-ink/60">
                Currently{' '}
                <span className="font-semibold text-ink/80">{programEnabled ? 'on' : 'off'}</span>.
                When off, the couple &ldquo;Refer a couple&rdquo; page is hidden and no referrals
                are recorded. Turn it on to run the program &mdash; then set the reward below.
              </span>
            </span>
          </label>
          <div className="mt-4">
            <SubmitButton
              className="button-primary inline-flex items-center gap-2"
              pendingLabel="Saving…"
            >
              Save
            </SubmitButton>
          </div>
        </form>
      ) : (
        <div
          role="alert"
          className="rounded-xl border border-danger-200 bg-danger-50 p-5 text-sm text-danger-800"
        >
          <p className="font-semibold">
            Couldn&rsquo;t read whether the referral program is on.
          </p>
          <p className="mt-1">
            The switch is hidden rather than shown unchecked: an unticked box saves as
            &ldquo;off&rdquo;, so a switch drawn from a read that failed could turn the whole
            program off. Reload. If it repeats, the settings read is being refused rather than
            returning nothing.
          </p>
        </div>
      )}

      {/* Admin-managed reward amount. */}
      <section className="sn-tile p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink/55">Reward per side</p>
        <p className="mt-1 text-lg font-semibold text-ink">
          {rewardPhp === null ? '—' : `₱${rewardPhp.toLocaleString('en-PH')}`}
        </p>
        {rewardPhp === null ? (
          <p className="mt-1 text-sm text-ink/60">
            Not read, so this is not a statement that the reward is ₱0 — it is a statement that we
            do not know what it is set to.
          </p>
        ) : rewardPhp <= 0 ? (
          <p className="mt-1 text-sm text-ink/60">
            The referral engine is live but inert — qualifying referrals are recorded, but no
            reward vouchers are minted until an owner sets a reward amount on platform settings.
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink/60">
            Each qualifying referral mints two single-use vouchers of this value (100% off up to
            ₱{rewardPhp.toLocaleString('en-PH')} on any covered SKU), one per side.
          </p>
        )}
      </section>

      {/* Counts. */}
      <section className="grid gap-3 sm:grid-cols-3">
        <KpiStatCard label="Open" value={countOf('open')} />
        <KpiStatCard label="Qualified" value={countOf('qualified')} />
        <KpiStatCard label="Rewarded" value={countOf('rewarded')} />
      </section>

      {/* Fails toward the caveat. A dash here is ALREADY the legitimate value
          for a name that is genuinely absent, so an unread lookup and an empty
          field are indistinguishable unless the page says which. */}
      {labelsUnread ? (
        <p
          role="alert"
          className="mb-3 rounded-xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/70"
        >
          <strong className="text-ink">Some names could not be read.</strong>{' '}
          A referral below shows a dash instead of the account it belongs to. The rows themselves are accurate — the names are
          missing, not the records.
        </p>
      ) : null}

      <ConsoleTable
        rows={redemptions}
        columns={columns}
        rowKey={(r) => r.referral_redemption_id}
        label="Referral redemptions"
        readPermitted
        readError={redemptionsRes.error}
        reads="the referral redemptions"
        cap={REDEMPTION_CAP}
        minWidth="45rem"
        empty={{
          Icon: Gift,
          title: 'No referrals yet',
          blurb:
            'A row lands here the moment one couple uses another couple’s referral link, and moves to qualified on the referred couple’s first paid order. Switch the program on above and the “Refer a couple” page appears for couples.',
        }}
      />
    </div>
  );
}
