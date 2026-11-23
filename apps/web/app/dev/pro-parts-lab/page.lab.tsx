import { notFound } from 'next/navigation';
import { EventServicesAppleLab } from './event-services-apple-lab';
import { EventServicesBody } from '@/app/dashboard/[eventId]/studio/website-pro/_components/event-services-body';
import { formatCount } from '@/lib/format-number';
import { packSavingPhp, type EventServicesFacts, type EventServicesPick, type PackFact, type PackKey } from '@/lib/event-services';
import { HUB_PARTS, type HubPartId } from '@/lib/hub-parts';
import { AppleProScreen } from '@/app/_components/iap/apple-pro-screen';
import { formatPhp } from '@/lib/php';
import { LabFrame } from './lab-client';
import '@/app/dashboard/[eventId]/studio/website-pro/_components/event-services-website.css';

/**
 * 🧪 /dev/pro-parts-lab — "Event Pro, part by part" (owner 2026-10-22), frame by frame of
 * `prototypes/pro_part_by_part_2026-10-22.html`, drawn by the SHIPPED components with made-up facts and NO database:
 *
 *   ?frame=sheet-two · sheet-four · sheet-cap · sheet-ready   — the ✓ Apply sheet (frames 1, 1-closer, 2, ready)
 *   ?frame=sheet-held                                       — 📵 the app with no Apple Pro: "◆ 2 waiting for Pro" + Remove Pro changes
 *   ?frame=line-free · line-paid · line-yours                 — the quiet line (frame 3)
 *   ?frame=services-free · services-pack · services-singles · services-addons · services-singles-only · services-info ·
 *          services-pro — 🛒 EVENT SERVICES (owner 2026-11-23, v4 approved), frames 01 · 02 · 03 · 04 · 04b · 05 · 09 of
 *          `prototypes/buy_event_services_one_place_2026-11-23/frames_v5_website/` (v5, the website template) — the page the plans page became.
 *          Its pay page (06 · 07) is `/dev/pay-maya-lab`; Today's row (11 · 12) the home lab.
 *   ?frame=iphone · iphone-cancel · iphone-silent — 🍎 the iPhone app (frames 08 · 08b · 08c · 08e · 08f): press Pay.
 *   ?frame=address-free · address-pick · address-kept         — the custom address (frame 5)
 *   ?frame=sheet-apple · apple · apple-on                     — 🍎 the iPhone app: the one-unlock sheet, Apple's page
 *                                                               selling Event Pro whole (owner 2026-10-26)
 *
 *   &sale=off — ⛔ the parts OFF SALE (owner 2026-10-26, "just have the upgrade Event Pro"): no part price reaches
 *   any surface, exactly as production draws them once the catalogue rows are inactive. Without it: the 2026-10-22
 *   part-by-part frames, kept for the record.
 *
 * ⚠ THE FIGURES ARE SAMPLES (₱1,000 / ₱500 / ₱2,990 — the prototype's ₱5,000 "everything" became the Plus sample on 20 Nov), typed HERE ONLY — a dev page that 404s in
 * production. The shipped surfaces read `platform_retail_catalog_v2`.
 */
const SAMPLE_BIG = 1000;
const SAMPLE_SMALL = 500;
/** 🏛 Everything is Event Plus since 20 Nov — the sample "everything" is the Plus sample below (was the prototype's ₱5,000). */
const SAMPLE_FULL = 2990;
/** Apple's `displayPrice` string as StoreKit would hand it — SAMPLE only: one price everywhere (2026-10-28), so it is the lab's web figure. */
const SAMPLE_APPLE_FULL = formatPhp(SAMPLE_FULL);

const ES_SIZES = [
  { code: 'PAPIC_GUEST_150', points: 150, php: 99 },
  { code: 'PAPIC_GUEST_1K', points: 1_000, php: 499 },
  { code: 'PAPIC_GUEST', points: 3_000, php: 999 },
];
const ES_PACK = { plus: { php: 2_990, credits: 1_000 }, pro: { php: 5_490, credits: 3_000 }, ultra: { php: 9_990, credits: 6_000 } } as const;
const ES_SINGLE = { hub: 2_790, ai: 2_790, live: 3_990 } as const;
const esPhotosLine = (k: PackKey) => `${formatCount(ES_PACK[k].credits)} guest photos`;
const ES_INFO: Record<PackKey, string[]> = {
  plus: ['The whole Event Hub — every theme and every part to design', 'One small “Made with Setnayan” mark instead of the watermark', '500 MB of uploads', esPhotosLine('plus')],
  pro: ['Everything in Event Plus', 'Setnayan AI — tells you what’s next and flags what’s at risk', 'No Setnayan watermark on your Event Hub', 'Your full-size photos kept 6 months after the event', '1 GB of uploads', esPhotosLine('pro')],
  ultra: ['Everything in Event Pro', 'Live Watch for one day — your event streamed on your Event Hub', 'Your full-size photos kept 12 months after the event', '2 GB of uploads', esPhotosLine('ultra')],
};
const ES_NAME: Record<PackKey, string> = { plus: 'Event Plus', pro: 'Event Pro', ultra: 'Event Ultra' };
const ES_CODE: Record<PackKey, string> = { plus: 'EVENT_PLUS', pro: 'COUPLE_WEBSITE_PRO', ultra: 'EVENT_ULTRA' };

function esSampleFacts(onPro: boolean): EventServicesFacts {
  const singles = (['hub', 'ai', 'live'] as const).map((k) => ({
    key: k,
    code: k === 'hub' ? 'EVENT_HUB' : k === 'ai' ? 'SETNAYAN_AI' : 'LIVE_STUDIO',
    php: onPro && k !== 'live' ? null : ES_SINGLE[k],
    state: onPro && k !== 'live' ? ('yours' as const) : ('buy' as const),
  }));
  const packs: PackFact[] = (['plus', 'pro', 'ultra'] as const).map((k) => {
    const held = onPro && k !== 'ultra';
    const p: PackFact = {
      key: k,
      code: ES_CODE[k],
      name: ES_NAME[k],
      credits: ES_PACK[k].credits,
      addsCredits: onPro ? Math.max(0, ES_PACK[k].credits - ES_PACK.pro.credits) : ES_PACK[k].credits,
      php: held ? null : onPro ? ES_PACK.ultra.php - ES_PACK.pro.php : ES_PACK[k].php,
      upgrade: onPro && !held,
      state: held ? 'yours' : 'buy',
      savePhp: null,
      fits: !onPro && k === 'pro' ? 'Fits: 11 suppliers booked.' : null,
      info: ES_INFO[k],
    };
    return p;
  });
  for (const p of packs) p.savePhp = packSavingPhp(p, singles, ES_SIZES);
  return {
    eyebrow: 'Ana & Miguel · Sat 12 Dec 2026',
    plan: onPro ? 'pro' : 'free',
    planName: onPro ? 'Event Pro' : 'Free',
    photosLeft: onPro ? 860 : 150,
    packs,
    singles,
    photos: ES_SIZES,
  };
}

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
  if (frame.startsWith('iphone')) {
    // 🍎 v4 frames 08 · 08b/08c (press Pay) · 08e (`iphone-cancel`, press Pay) · 08f (`iphone-silent`). The web figures
    // are stripped exactly as the page strips them; the Apple strings are SAMPLES of what StoreKit hands back.
    const web = esSampleFacts(false);
    const facts: EventServicesFacts = {
      ...web,
      packs: web.packs.map((p) => ({ ...p, php: null, savePhp: null })),
      singles: web.singles.map((x) => ({ ...x, php: null })),
      photos: web.photos ? web.photos.map((x) => ({ ...x, php: 0 })) : null,
    };
    const products: Record<string, string> = {
      EVENT_PLUS: 'com.setnayan.app.event_plus',
      COUPLE_WEBSITE_PRO: 'com.setnayan.app.event_pro',
      EVENT_ULTRA: 'com.setnayan.app.event_ultra',
      LIVE_STUDIO: 'com.setnayan.app.live_watch',
      PAPIC_GUEST_150: 'com.setnayan.app.papic_150',
      PAPIC_GUEST_1K: 'com.setnayan.app.papic_1000',
      PAPIC_GUEST: 'com.setnayan.app.papic_3000',
    };
    const prices: Record<string, string> = Object.fromEntries(
      Object.values(products).map((id, i) => [id, `₱${['2,990.00', '5,490.00', '9,990.00', '3,990.00', '99.00', '499.00', '999.00'][i]}`]),
    );
    return (
      <div className="min-h-dvh bg-page" data-lab-frame={frame}>
        <EventServicesAppleLab
          facts={facts}
          products={products}
          prices={prices}
          silent={frame === 'iphone-silent'}
          second={frame === 'iphone-cancel' ? 'cancelled' : 'on'}
          initialPick={frame === 'iphone-silent' ? { pack: null, singles: [], photos: null } : { pack: 'pro', singles: [], photos: 'PAPIC_GUEST_1K' }}
        />
      </div>
    );
  }
  if (frame.startsWith('services')) {
    const f = frame.slice('services-'.length) || 'free';
    const facts = esSampleFacts(f === 'pro');
    const pick: EventServicesPick =
      f === 'pack'
        ? { pack: 'pro', singles: [], photos: null }
        : f === 'addons'
          ? { pack: 'pro', singles: ['live'], photos: 'PAPIC_GUEST_1K' }
          : f === 'singles-only'
            ? { pack: null, singles: ['hub', 'ai'], photos: null }
            : { pack: null, singles: [], photos: null };
    return (
      <div className="min-h-dvh bg-page" data-lab-frame={frame}>
        <EventServicesBody
          key={frame}
          eventId="00000000-0000-4000-8000-000000000000"
          facts={facts}
          ordersHref="/dev/pro-parts-lab"
          initialPick={pick}
          initialOpen={f === 'singles' || f === 'addons' || f === 'singles-only'}
          initialInfo={f === 'info' ? 'pro' : null}
          lab
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
      line={onSale ? { fromPhp: SAMPLE_SMALL, fullPhp: SAMPLE_FULL, paidPhp, owned: paidSet, href: '/dev/pro-parts-lab?frame=services-free' } : null}
      addressPricePhp={partPricePhp.address ?? null}
    />
  );
}
