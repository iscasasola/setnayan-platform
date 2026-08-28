import { PageMasthead } from '@/app/_components/page-masthead';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requireAdmin } from '@/lib/admin/require-admin';
import { FAMILY_DISCOUNT_DEFAULT_PCT } from '@/lib/onboarding-family-discount';
import { saveFamilyDiscount, savePapicLadder } from '@/app/admin/pricing/price-control-actions';
import { PapicLadderEditor, type PapicRungRow } from '@/app/admin/pricing/_components/papic-ladder-editor';

/**
 * THE PAPIC LADDER — five prices the owner types, eleven that compute.
 *
 * ⚖ Owner 2026-08-28. The rungs are a step-function discount off ₱1 = 1 credit:
 * an anchor fixes a price PER CREDIT and that rate carries forward to every rung
 * below the next anchor.
 *
 * ⚠ WHY THIS IS ITS OWN BLOCK RATHER THAN SIXTEEN ROWS IN THE MAIN LIST: eleven
 * of the sixteen are computed, and a computed price sitting in a flat list of
 * editable ones is a field somebody types into and watches do nothing. Here the
 * five typed ones and the eleven results are drawn differently and labelled.
 *
 * 🔑 TWO DERIVED LAYERS, IN A FIXED ORDER: the anchors produce the REGULAR
 * prices; the family discount then produces the SIGN-UP prices from those. The
 * screen says which layer produced what. Verified before building: the two
 * layers compose exactly — all sixteen regular prices AND all sixteen sign-up
 * prices reproduce their live values to the peso, with no rounding disagreement
 * anywhere and not one fractional peso.
 */

type Props = {
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export async function PapicLadderSurface(_props: Props) {
  await requireAdmin();
  const admin = createAdminClient();

  const [tierRes, catRes, settingsRes] = await Promise.all([
    admin.from('papic_pass_tiers').select('service_code, points, is_active').eq('is_active', true),
    admin
      .from('platform_retail_catalog_v2')
      .select('service_code, title, retail_price_php, onboarding_price_php, is_active')
      .like('service_code', 'PAPIC_GUEST%'),
    admin.from('platform_settings').select('papic_signup_discount_pct').eq('id', 1).maybeSingle(),
  ]);

  if (tierRes.error) logQueryError('AdminPapicLadder (tiers)', tierRes.error);
  if (catRes.error) logQueryError('AdminPapicLadder (catalog)', catRes.error);
  if (settingsRes.error) logQueryError('AdminPapicLadder (settings)', settingsRes.error);

  const unreadable = Boolean(tierRes.error || catRes.error);

  // ⚠ The rung SET comes from the tier table + the catalog, never from a list in
  // code — those two are what actually decide which rungs exist and cost what.
  const shotsByCode = new Map<string, number>();
  for (const t of (tierRes.data ?? []) as { service_code?: string; points?: number }[]) {
    if (t.service_code && Number.isFinite(t.points)) shotsByCode.set(t.service_code, Number(t.points));
  }

  const rows: PapicRungRow[] = ((catRes.data ?? []) as {
    service_code: string;
    title: string | null;
    retail_price_php: number | string;
    onboarding_price_php: number | string | null;
    is_active: boolean;
  }[])
    .filter((r) => shotsByCode.has(r.service_code))
    .map((r) => ({
      serviceCode: r.service_code,
      title: r.title ?? r.service_code,
      shots: shotsByCode.get(r.service_code)!,
      regularPhp: Number(r.retail_price_php),
      signupPhp: r.onboarding_price_php == null ? null : Number(r.onboarding_price_php),
      isActive: r.is_active === true,
    }))
    .sort((a, b) => a.shots - b.shots);

  const discountPct =
    settingsRes.data?.papic_signup_discount_pct != null &&
    Number.isFinite(Number(settingsRes.data.papic_signup_discount_pct))
      ? Number(settingsRes.data.papic_signup_discount_pct)
      : FAMILY_DISCOUNT_DEFAULT_PCT.papic;

  return (
    <div>
      <PageMasthead title="Papic shot prices" />

      {unreadable && (
        <div className="mb-6 rounded-2xl border border-danger-300/60 bg-danger-50/80 p-5">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-danger-900">
            Prices couldn&apos;t load
          </p>
          <p className="mt-1 text-sm text-danger-900">
            This screen is showing what it could read, which may be incomplete. Don&apos;t save from
            here until it loads cleanly.
          </p>
        </div>
      )}

      <PapicLadderEditor
        rows={rows}
        discountPct={discountPct}
        saveLadderAction={savePapicLadder}
        saveDiscountAction={saveFamilyDiscount}
      />
    </div>
  );
}
