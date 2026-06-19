import { Coins } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { updateBand } from './actions';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Token bands · Admin' };

/**
 * /admin/token-bands — admin editor for the region → burn-band map.
 *
 * Owner-locked token economy (2026-06-05): when a vendor ANSWERS an inquiry
 * (accepts it) they burn ONE idempotent unlock per (vendor, event), banded by
 * the WEDDING's region — ₱100/200/300 = 1/2/3 tokens (flat ₱100/token). That
 * single unlock covers ALL of the vendor's services for the event. The band
 * map must be admin-editable because minimum wages drift via wage orders.
 *
 * Table + RPC + seed: migration 20260908000000_vendor_token_burn_on_answer.sql.
 * Auth enforced at the admin layout level.
 */

type BandRow = {
  region_slug: string;
  band: number;
  tokens: number;
  min_wage_php: number | null;
  label: string | null;
  updated_at: string;
};

export default async function AdminTokenBandsPage() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('token_burn_bands')
    .select('region_slug, band, tokens, min_wage_php, label, updated_at')
    .order('band', { ascending: false })
    .order('region_slug', { ascending: true });
  if (error) logQueryError('AdminTokenBandsPage', error);
  const rows = (data ?? []) as BandRow[];

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold tracking-tight">Token bands</h1>
        </div>
        <p className="text-sm text-ink/65">
          What a vendor pays to <strong>answer</strong> an inquiry, banded by the
          wedding&rsquo;s region. One answer = one unlock per (vendor, event) and
          covers all of that vendor&rsquo;s services for the event. ₱100 per token,
          so 1 / 2 / 3 tokens = ₱100 / ₱200 / ₱300.
        </p>
        <p className="rounded-md border border-warn-200/60 bg-warn-50/60 px-3 py-2 text-xs text-warn-900">
          <span className="font-semibold">Pending owner ratification.</span> The
          seeded band→region map is the proposed default keyed to regional
          minimum wage — adjust here as wage orders change. <code>__default__</code>{' '}
          is the fallback for an unknown/blank region (conservative floor).
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-ink/10 bg-cream">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
            <tr>
              <th className="px-3 py-3 font-medium">Region</th>
              <th className="hidden px-3 py-3 font-medium sm:table-cell">Min wage (₱)</th>
              <th className="px-3 py-3 font-medium">Band</th>
              <th className="px-3 py-3 font-medium">Tokens (= ₱{'×'}100)</th>
              <th className="px-3 py-3 font-medium">Save</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.region_slug} className="border-t border-ink/5">
                <td className="px-3 py-3">
                  <p className="font-medium text-ink">{r.label ?? r.region_slug}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                    {r.region_slug}
                  </p>
                </td>
                <td className="hidden px-3 py-3 text-ink/70 sm:table-cell">
                  {r.min_wage_php ?? '—'}
                </td>
                <td className="px-3 py-3" colSpan={3}>
                  <form action={updateBand} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="region_slug" value={r.region_slug} />
                    <label className="sr-only" htmlFor={`band-${r.region_slug}`}>
                      Band for {r.region_slug}
                    </label>
                    <select
                      id={`band-${r.region_slug}`}
                      name="band"
                      defaultValue={String(r.band)}
                      className="input-field w-20 text-xs"
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                    </select>
                    <label className="sr-only" htmlFor={`tokens-${r.region_slug}`}>
                      Tokens for {r.region_slug}
                    </label>
                    <input
                      id={`tokens-${r.region_slug}`}
                      name="tokens"
                      type="number"
                      min={1}
                      max={99}
                      defaultValue={r.tokens}
                      className="input-field w-24 text-xs"
                    />
                    <span className="text-xs text-ink/55">
                      = ₱{(r.tokens * 100).toLocaleString('en-PH')}
                    </span>
                    <SubmitButton className="button-secondary text-xs" pendingLabel="Saving…">
                      Save
                    </SubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
        Source · token economy (owner-locked 2026-06-05) · table{' '}
        <code>token_burn_bands</code> · migration 20260908000000
      </p>
    </div>
  );
}
