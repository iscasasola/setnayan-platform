import { notFound } from 'next/navigation';
import { HUB_PARTS, type HubPartId } from '@/lib/hub-parts';
import { ProPartsBody } from '@/app/dashboard/[eventId]/studio/website-pro/_components/pro-parts-body';
import { AppleProScreen } from '@/app/_components/iap/apple-pro-screen';
import { IAP_HUB_PART_PRODUCTS, appStorePriceFloorPhp } from '@/lib/iap/products';
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
 *   ?frame=sheet-apple · apple-parts · apple-parts-on         — 🍎 the iPhone app 1.1 (flag-dark): the sheet with no
 *                                                               web figure, Apple's page buying parts one after another
 *
 * ⚠ THE FIGURES ARE THE PROTOTYPE'S SAMPLE (₱1,000 / ₱500 / ₱5,000), typed HERE ONLY — a dev page that 404s in
 * production. The shipped surfaces read `platform_retail_catalog_v2`.
 */
const SAMPLE_BIG = 1000;
const SAMPLE_SMALL = 500;
const SAMPLE_FULL = 5000;
/** Apple's `displayPrice` strings as StoreKit would hand them — SAMPLE only: the ÷ 0.85 floor of the lab's web figure. */
const SAMPLE_APPLE_BIG = formatPhp(appStorePriceFloorPhp(SAMPLE_BIG) ?? 0);
const SAMPLE_APPLE_SMALL = formatPhp(appStorePriceFloorPhp(SAMPLE_SMALL) ?? 0);

export default async function ProPartsLab({ searchParams }: { searchParams: Promise<{ frame?: string; buy?: string; from?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  const frame = q.frame ?? 'sheet-two';
  const partPricePhp = Object.fromEntries(HUB_PARTS.map((p) => [p.id, p.size === 'big' ? SAMPLE_BIG : SAMPLE_SMALL])) as Record<HubPartId, number>;
  const paidSet: HubPartId[] =
    frame === 'sheet-cap' || frame === 'line-paid'
      ? ['reveal', 'background', 'photos', 'music']
      : frame === 'parts-owned'
        ? ['reveal', 'photos']
        : frame === 'line-yours' || frame.startsWith('apple') || frame === 'sheet-apple'
          ? ['style']
          : [];
  const paidPhp = paidSet.reduce((n, p) => n + partPricePhp[p], 0);
  const own = { full: false, parts: paidSet, paidPhp, fullPricePhp: SAMPLE_FULL };
  if (frame.startsWith('apple')) {
    const ask = HUB_PARTS.filter((p) => p.id === 'motion' || p.id === 'music');
    const parts = ask.map((p) => ({ name: p.name, productId: IAP_HUB_PART_PRODUCTS.find((x) => x.serviceKey === p.sku)!.productId }));
    const partPrices = Object.fromEntries(ask.map((p, i) => [parts[i]!.productId, p.size === 'big' ? SAMPLE_APPLE_BIG : SAMPLE_APPLE_SMALL]));
    return (
      <div className="min-h-dvh bg-cream">
        <AppleProScreen
          eventId="00000000-0000-4000-8000-000000000000"
          back="/dev/pro-parts-lab"
          parts={parts}
          ownedNames={['Style']}
          sample={{ screen: frame === 'apple-parts-on' ? { kind: 'on' } : null, price: null, partPrices }}
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
      pricing={
        frame === 'sheet-apple'
          ? { partPricePhp: {}, fullPricePhp: null, ownership: own, appleStore: true }
          : { partPricePhp, fullPricePhp: SAMPLE_FULL, ownership: own }
      }
      line={{ fromPhp: SAMPLE_SMALL, fullPhp: SAMPLE_FULL, paidPhp, owned: paidSet, href: '/dev/pro-parts-lab?frame=parts-free' }}
    />
  );
}
