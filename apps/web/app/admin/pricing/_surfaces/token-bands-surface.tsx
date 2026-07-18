// Money-split studio surface — the body of the former token-bands page,
// re-homed here (2026-07-10). actions/_components stay in /admin/token-bands; the
// legacy route is now a redirect (or, for pricing/settings, the studio shell).
import { Coins } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { updateBand } from '@/app/admin/token-bands/actions';
import { SubmitButton } from '@/app/_components/submit-button';
import { TOKEN_PRICE_PHP } from '@/lib/v2/region-token-burn';

import { requireAdmin } from '@/lib/admin/require-admin';

/**
 * /admin/token-bands — admin editor for the region → burn-band map.
 *
 * Owner-locked token economy (2026-06-05): when a vendor ANSWERS an inquiry
 * (accepts it) they burn ONE idempotent unlock per (vendor, event), banded by
 * the WEDDING's region. Post 2026-07-12 PRICING LOCK the band data is FLAT 1 for
 * every region (constant 1-token burn) at ₱200/token, so the effective cost is a
 * uniform ₱200; the band map stays admin-editable (1/2/3 = ₱200/400/600) should
 * minimum-wage drift ever justify re-banding. That single unlock covers ALL of
 * the vendor's services for the event.
 *
 * RECONCILED 2026-07-01 (burn-band single source · migration
 * 20270331100000_burn_band_single_source.sql): this editor now reads/writes
 * public.regions.burn_band — the SAME canonical map the RPC (unlock_vendor_event)
 * resolves events.region against, and the same map lib/region-source.ts reads.
 * It previously edited a parallel token_burn_bands table whose underscore/PSGC
 * keys silently mis-matched the canonical hyphen slugs in events.region, so 6
 * regions under-charged (cagayan, c-luzon, w-visayas, c-visayas, n-mindanao,
 * nir). Switching to public.regions fixes that AND surfaces all 19 regions as
 * editable rows (the old table was missing eight). token_burn_bands is retired
 * (dropped in a follow-up migration). The economy is flat 1:1 band:token at
 * ₱200/token, so tokens = band (shown read-only); decoupling them is a future
 * column on regions, not built here.
 *
 * Auth enforced at the admin layout level.
 */

type RegionBandRow = {
  slug: string;
  display_label: string | null;
  burn_band: number;
  min_wage_php: number | null;
  updated_at: string;
};

export async function TokenBandsSurface() {
  await requireAdmin();
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('regions')
    .select('slug, display_label, burn_band, min_wage_php, updated_at')
    .order('sort_order', { ascending: true });
  if (error) logQueryError('AdminTokenBandsPage', error);
  const rows = (data ?? []) as RegionBandRow[];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold tracking-tight">Token bands</h1>
        </div>
        <p className="text-sm text-ink/65">
          What a vendor pays to <strong>answer</strong> an inquiry. One answer =
          one unlock per (vendor, event) and covers all of that vendor&rsquo;s
          services for the event. Since the 2026-07-11 lock the burn is a{' '}
          <strong>flat 1 token (₱200) per connection, everywhere</strong> —
          region tiering is retired as an active policy.
        </p>
        <p className="rounded-md border border-warn-200/60 bg-warn-50/60 px-3 py-2 text-xs text-warn-900">
          <span className="font-semibold">Platform-wide lever only.</span> This
          table is the emergency control the <code>unlock_vendor_event</code> RPC
          reads — edit it to change the burn platform-wide, not to re-tier by
          region. Per the owner lock the base gate is never raised above 1. An
          unknown / blank / out-of-PH region falls to band&nbsp;1 (conservative
          floor).
        </p>
      </header>

      <div className="sn-tile overflow-x-auto !p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink/[0.03] text-[11px] uppercase tracking-[0.12em] text-ink/55">
            <tr>
              <th className="px-3 py-3 font-medium">Region</th>
              <th className="hidden px-3 py-3 font-medium sm:table-cell">Min wage (₱)</th>
              <th className="px-3 py-3 font-medium">Band</th>
              <th className="px-3 py-3 font-medium">Tokens (= ₱{'×'}200)</th>
              <th className="px-3 py-3 font-medium">Save</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.slug} className="border-t border-ink/5">
                <td className="px-3 py-3">
                  <p className="font-medium text-ink">{r.display_label ?? r.slug}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                    {r.slug}
                  </p>
                </td>
                <td className="hidden px-3 py-3 text-ink/70 sm:table-cell">
                  {r.min_wage_php ?? '—'}
                </td>
                <td className="px-3 py-3" colSpan={3}>
                  <form action={updateBand} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="region_slug" value={r.slug} />
                    <label className="sr-only" htmlFor={`band-${r.slug}`}>
                      Band for {r.slug}
                    </label>
                    <select
                      id={`band-${r.slug}`}
                      name="band"
                      defaultValue={String(r.burn_band)}
                      className="input-field w-20 text-xs"
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                    </select>
                    <span className="text-xs text-ink/55">
                      {r.burn_band} {r.burn_band === 1 ? 'token' : 'tokens'} = ₱
                      {(r.burn_band * TOKEN_PRICE_PHP).toLocaleString('en-PH')}
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
        <code>regions</code> · burn-band single source (migration 20270331100000)
      </p>
    </div>
  );
}
