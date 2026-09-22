import { PageMasthead } from '@/app/_components/page-masthead';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { requireAdmin } from '@/lib/admin/require-admin';
import { FAMILY_DISCOUNT_DEFAULT_PCT } from '@/lib/onboarding-family-discount';
import {
  saveFamilyDiscount,
  savePapicLadder,
  savePapicProductPrice,
  savePapicTypeSizing,
  recomputePapicPoolLearning,
} from '@/app/admin/pricing/price-control-actions';
import { PapicLadderEditor, type PapicRungRow } from '@/app/admin/pricing/_components/papic-ladder-editor';
import {
  PapicTypeSizingEditor,
  type PapicTypeSizingRow,
} from '@/app/admin/pricing/_components/papic-type-sizing-editor';
import {
  PapicRestEditor,
  type PapicProductRow,
} from '@/app/admin/pricing/_components/papic-rest-editor';

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

  const [tierRes, catRes, settingsRes, poolRes, learningRes, vocabRes] = await Promise.all([
    admin.from('papic_pass_tiers').select('service_code, points, is_active').eq('is_active', true),
    /*
      ⚠ THE WHOLE PAPIC FAMILY, NOT JUST THE RUNGS. Owner 2026-08-29: *"free
      credits should be here. with the rest of papic services and the thank you
      video."* The rung filter below still decides what the LADDER draws; the
      remainder becomes its own section rather than being dropped on the floor.
    */
    admin
      .from('platform_retail_catalog_v2')
      .select('service_code, title, retail_price_php, onboarding_price_php, is_active')
      .like('service_code', 'PAPIC%'),
    admin.from('platform_settings').select('papic_signup_discount_pct').eq('id', 1).maybeSingle(),
    /*
      What every celebration is GIVEN. Until 2026-08-29 nothing under `app/` read
      this column at all, so the number had no screen and only a migration could
      move it.
    */
    admin
      .from('papic_event_pool_config')
      .select('free_grant_points')
      .eq('config_key', 'default')
      .maybeSingle(),
    /*
      WHAT EACH KIND OF CELEBRATION IS RECOMMENDED, and whether the figure in
      force is the owner's or a learned one. Read through the RPC rather than the
      table, so this screen and the resolver cannot disagree about which is which.
    */
    admin.rpc('papic_pool_learning_state'),
    admin.from('papic_event_pool_config')
      .select('config_key, floor_points, ceiling_points')
      .neq('config_key', 'default'),
  ]);

  if (tierRes.error) logQueryError('AdminPapicLadder (tiers)', tierRes.error);
  if (catRes.error) logQueryError('AdminPapicLadder (catalog)', catRes.error);
  if (settingsRes.error) logQueryError('AdminPapicLadder (settings)', settingsRes.error);
  // ⚠ Supabase RESOLVES with `{ error }`. Unchecked, a refused read renders as a
  // confident number that is not what the product actually gives away.
  if (poolRes.error) logQueryError('AdminPapicLadder (pool config)', poolRes.error);
  if (learningRes.error) logQueryError('AdminPapicLadder (learning state)', learningRes.error);
  if (vocabRes.error) logQueryError('AdminPapicLadder (type clamps)', vocabRes.error);

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

  /*
    THE THANK YOU VIDEO — the one Papic product that is not a credit rung.

    ⚖ OWNER 2026-08-29, NARROWING THIS TAB: *"papic is only the papic shot
    prices and the thankyou. so the rest should be removed."* An earlier build
    of this tab also drew the four PAPIC_CAMERA_* per-day rates here, reasoning
    that two of them still price a live purchase despite being switched off. He
    is right that that reasoning does not belong on THIS tab: it is a real
    property of those rows, but this tab is Papic's SHOTS, not every Papic-
    prefixed row in the catalog.

    🔑 THE CAMERA ROWS ARE NOT DELETED AND NOT HIDDEN. They stay exactly where
    every other switched-off price lives — the main Pricing tab's "Switched
    off" shelf, tagged "Still wired" — and remain editable there through the
    ordinary row card. Only their SECOND appearance, invented for this tab, is
    removed.
  */
  const otherPapic: PapicProductRow[] = ((catRes.data ?? []) as {
    service_code: string;
    title: string | null;
    retail_price_php: number | string;
    is_active: boolean;
  }[])
    .filter((r) => r.service_code === 'PAPIC_ADDON_THANK_YOU')
    .map((r) => ({
      serviceCode: r.service_code,
      title: r.title ?? r.service_code,
      regularPhp: Number(r.retail_price_php),
      isActive: r.is_active === true,
      stillCharges: false,
    }));

  const rawFree = poolRes.error
    ? null
    : (poolRes.data as { free_grant_points?: number | string | null } | null)?.free_grant_points;
  const freeCreditsPerEvent =
    rawFree != null && Number.isFinite(Number(rawFree)) ? Number(rawFree) : null;

  /*
    THE CLAMP TRAVELS WITH THE PER-HEAD FIGURE — on this screen too. The learning
    RPC answers about the per-head number only, so the floor and ceiling are read
    beside it and the three are edited as one row. A per-head box that could be
    saved on its own would put 50 credits a head under a 5,000 floor, which is
    the exact defect the per-type rows exist to fix.
  */
  const clamps = new Map<string, { floor: number; ceiling: number }>();
  for (const c of (vocabRes.data ?? []) as {
    config_key?: string;
    floor_points?: number | string;
    ceiling_points?: number | string;
  }[]) {
    if (!c.config_key) continue;
    clamps.set(c.config_key, {
      floor: Number(c.floor_points ?? 0),
      ceiling: Number(c.ceiling_points ?? 0),
    });
  }

  const typeSizing: PapicTypeSizingRow[] = ((learningRes.data ?? []) as {
    config_key: string;
    initial_per_guest: number | string;
    stored_learned: number | string | null;
    in_force: number | string;
    in_force_source: string;
    sample_size: number | string;
    censored_count: number | string;
    min_sample: number | string;
    candidate: number | string | null;
    candidate_reason: string | null;
  }[])
    .map((r) => ({
      eventType: r.config_key,
      // A key is a slug; `gala_night` reads as a title only once the underscore
      // is gone. This is presentation of a known key, not an invented name.
      label: r.config_key.replace(/_/g, ' '),
      initialPerGuest: Number(r.initial_per_guest),
      floorPoints: clamps.get(r.config_key)?.floor ?? 0,
      ceilingPoints: clamps.get(r.config_key)?.ceiling ?? 0,
      learnedPerGuest: r.stored_learned == null ? null : Number(r.stored_learned),
      inForce: Number(r.in_force),
      inForceSource:
        r.in_force_source === 'learned' ? ('learned' as const) : ('initial' as const),
      sampleSize: Number(r.sample_size),
      censoredCount: Number(r.censored_count),
      minSample: Number(r.min_sample),
      candidate: r.candidate == null ? null : Number(r.candidate),
      candidateReason: r.candidate_reason ?? '',
    }))
    .sort((a, b) => b.inForce - a.inForce || a.label.localeCompare(b.label));

  const discountPct =
    settingsRes.data?.papic_signup_discount_pct != null &&
    Number.isFinite(Number(settingsRes.data.papic_signup_discount_pct))
      ? Number(settingsRes.data.papic_signup_discount_pct)
      : FAMILY_DISCOUNT_DEFAULT_PCT.papic;

  return (
    <div>
      <PageMasthead title="Papic credit prices" />

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

      <PapicTypeSizingEditor
        rows={typeSizing}
        saveAction={savePapicTypeSizing}
        recomputeAction={recomputePapicPoolLearning}
      />

      <PapicRestEditor
        freeCreditsPerEvent={freeCreditsPerEvent}
        products={otherPapic}
        savePriceAction={savePapicProductPrice}
      />
    </div>
  );
}
