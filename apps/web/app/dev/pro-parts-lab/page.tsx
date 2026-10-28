import { notFound } from 'next/navigation';
import { HUB_PARTS, type HubPartId } from '@/lib/hub-parts';
import { ProPartsBody } from '@/app/dashboard/[eventId]/studio/website-pro/_components/pro-parts-body';
import { AppleProScreen } from '@/app/_components/iap/apple-pro-screen';
import { formatPhp } from '@/lib/php';
import { LabFrame } from './lab-client';

/**
 * 🧪 /dev/pro-parts-lab — "Event Hub Pro, part by part" (owner 2026-10-22), frame by frame of
 * `prototypes/pro_part_by_part_2026-10-22.html`, drawn by the SHIPPED components with made-up facts and NO database:
 *
 *   ?frame=sheet-two · sheet-four · sheet-cap · sheet-ready   — the ✓ Apply sheet (frames 1, 1-closer, 2, ready)
 *   ?frame=sheet-held                                       — 📵 the app with no Apple Pro: "◆ 2 waiting for Pro" + Remove Pro changes
 *   ?frame=line-free · line-paid · line-yours                 — the quiet line (frame 3)
 *   ?frame=parts-free · parts-owned                           — the parts page (frame 4)
 *   ?frame=address-free · address-pick · address-kept         — the custom address (frame 5)
 *   ?frame=sheet-apple · apple · apple-on                     — 🍎 the iPhone app: the one-unlock sheet, Apple's page
 *                                                               selling Event Hub Pro whole (owner 2026-10-26)
 *
 *   &sale=off — ⛔ the parts OFF SALE (owner 2026-10-26, "just have the upgrade event hub pro"): no part price reaches
 *   any surface, exactly as production draws them once the catalogue rows are inactive. Without it: the 2026-10-22
 *   part-by-part frames, kept for the record.
 *
 * ⚠ THE FIGURES ARE THE PROTOTYPE'S SAMPLE (₱1,000 / ₱500 / ₱5,000), typed HERE ONLY — a dev page that 404s in
 * production. The shipped surfaces read `platform_retail_catalog_v2`.
 */
const SAMPLE_BIG = 1000;
const SAMPLE_SMALL = 500;
const SAMPLE_FULL = 5000;
/** Apple's `displayPrice` string as StoreKit would hand it — SAMPLE only: one price everywhere (2026-10-28), so it is the lab's web figure. */
const SAMPLE_APPLE_FULL = formatPhp(SAMPLE_FULL);

export default async function ProPartsLab({ searchParams }: { searchParams: Promise<{ frame?: string; buy?: string; from?: string; sale?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  const frame = q.frame ?? 'sheet-two';
  const onSale = q.sale !== 'off';
  const samplePrices = Object.fromEntries(HUB_PARTS.map((p) => [p.id, p.size === 'big' ? SAMPLE_BIG : SAMPLE_SMALL])) as Record<HubPartId, number>;
  /* Off sale: no part price is read anywhere — the same empty map every shipped reader builds from `onSale`. */
  const partPricePhp: Partial<Record<HubPartId, number>> = onSale ? samplePrices : {};
  const paidSet: HubPartId[] = !onSale
    ? []
    : frame === 'sheet-cap' || frame === 'line-paid'
      ? ['reveal', 'background', 'photos', 'music']
      : frame === 'parts-owned'
        ? ['reveal', 'photos']
        : frame === 'line-yours'
          ? ['style']
          : [];
  const paidPhp = paidSet.reduce((n, p) => n + samplePrices[p], 0);
  const own = { full: false, parts: paidSet, paidPhp, fullPricePhp: SAMPLE_FULL };
  if (frame.startsWith('apple')) {
    return (
      <div className="min-h-dvh bg-cream">
        <AppleProScreen
          eventId="00000000-0000-4000-8000-000000000000"
          back="/dev/pro-parts-lab"
          sample={{ screen: frame === 'apple-on' ? { kind: 'on' } : null, price: SAMPLE_APPLE_FULL }}
        />
      </div>
    );
  }
  if (frame.startsWith('parts')) {
    return (
      <div className="min-h-dvh bg-cream">
        <ProPartsBody
          eventId="00000000-0000-4000-8000-000000000000"
          title="Event Hub Pro"
          back={{ href: '/dev/pro-parts-lab', label: 'Back to the Maker' }}
          fromMaker
          hubHref="/dev/pro-parts-lab"
          active={own}
          owned={own}
          partPricePhp={partPricePhp}
          fullPhp={SAMPLE_FULL}
          buy={q.buy}
          settings={{ bdo_account_name: null, bdo_account_number: null, bdo_qr_url: null, gcash_account_name: null, gcash_number: null, gcash_qr_url: null }}
          vatRatePct={0}
        />
      </div>
    );
  }
  return (
    <LabFrame
      frame={frame}
      /* The bar's own rule (`hub-draft-bar.tsx`): the app, or no part on sale → no part pricing → the one-unlock sheet. */
      pricing={frame === 'sheet-apple' || !onSale ? null : { partPricePhp, fullPricePhp: SAMPLE_FULL, ownership: own }}
      priceLabel={frame === 'sheet-apple' ? null : formatPhp(SAMPLE_FULL)}
      /* The launch page's rule: no part on sale → no quiet line. */
      line={onSale ? { fromPhp: SAMPLE_SMALL, fullPhp: SAMPLE_FULL, paidPhp, owned: paidSet, href: '/dev/pro-parts-lab?frame=parts-free' } : null}
      addressPricePhp={partPricePhp.address ?? null}
    />
  );
}
