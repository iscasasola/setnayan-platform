import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { eventOwnsSku, eventSkuActive } from '@/lib/entitlements';
import { buildThankYouVideoPlan } from '@/lib/thank-you-video';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { resolveServiceSellability } from '@/lib/v2-catalog';
import { fetchPlatformSettings, getEffectiveVatRatePct } from '@/lib/platform-settings';
import { PageMasthead } from '@/app/_components/page-masthead';
import { StudioBuyHero } from '@/app/dashboard/[eventId]/studio/_components/studio-buy-hero';
import { addOnHeroCopy } from '@/lib/add-ons-catalog';
import { formatPhp } from '@/lib/orders';
import { ThankYouMaker, type ThankYouSaveCheckout } from './_components/thank-you-maker';

const SKU_CODE = 'PAPIC_ADDON_THANK_YOU';
/** Name + promise from the one catalogue record every Studio row reads. */
const HERO = addOnHeroCopy('thank-you');

export const metadata = { title: 'Thank-You Video · Studio' };
export const dynamic = 'force-dynamic';

/**
 * /dashboard/[eventId]/studio/thank-you — the Thank-You Video maker.
 *
 * ─── WHY THIS PAGE EXISTS ──────────────────────────────────────────────────
 * `PAPIC_ADDON_THANK_YOU` has been on sale at ₱2,499 since 2026-07-10 with **no
 * screen, no maker and no render step anywhere**. A couple could pay and receive
 * nothing at all. Owner ruled "BUILD IT" on 2026-08-10.
 *
 * ─── THE RENDER HAPPENS IN THE BROWSER ─────────────────────────────────────
 * Server assembles the PLAN (which photos, which owned track); the couple's own
 * browser encodes it via `lib/reel-render.ts` — the same engine already shipping
 * on Patiktok, Guest Stories and the creator teaser. Owner-locked 2026-06-18:
 * ₱0 server compute, no server ffmpeg. 🔑 The server render QUEUE is a phantom
 * (every job table empty in prod, no worker anywhere in the repo, and the one
 * that looked like a worker was deleted 2026-08-09 for faking completion) —
 * building against it would have shipped a film that queues forever.
 *
 * ─── UNOWNED: MAKE IT FREE, PAY AT "SAVE TO MY PHONE" (2026-09-30) ────────
 * This used to be a locked panel: "Add it from your Studio" + "Back to
 * Studio". But /studio redirects to Our Services, whose Thank-You Video part
 * opens THIS page again — a loop with no way to buy anywhere in it. Now the
 * couple makes and watches the film for free, and the price is asked at the
 * final action — "Save to my phone" opens the shipped `InlineCheckoutDrawer`
 * in place (owner rules: ◆ Pro never blocks; ask at the final action; no
 * go-edit-elsewhere links). The same shape Patiktok's pay-to-save uses.
 *
 * ⚠ The plan is now built for an unowned visitor too. It runs under the
 * couple's own RLS client with the public consent gates (see below), so it
 * reads nothing an owner would not.
 *
 * ⚠ The film is encoded in the browser, so "pay to save" is a door, not a
 * vault: the preview player hides its download control, and the Save button
 * only exists once the SKU is active. That matches Patiktok's posture.
 */
export default async function ThankYouVideoPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/dashboard/${eventId}/studio/thank-you`);

  const supabase = await createClient();

  // ⚠ The ENTITLEMENT gate is here, not in the plan builder. Folding a paywall
  // into a data assembler puts the money decision somewhere nobody looks for it.
  // The EVENT holds it, not the person who paid (owner 2026-10-02) — the one
  // host-facing resolver, for both this read and the pending-order read below.
  const ent = await eventEntitlementClient(eventId);
  const owned = await eventSkuActive(ent, eventId, SKU_CODE);

  // Unowned: what "Save to my phone" needs to open the checkout in place.
  // `eventOwnsSku` counts a submitted order, so owned-but-not-active = a
  // payment being confirmed (never a second buy). Prices come from the
  // catalogue only (formatV2Sku → platform_retail_catalog_v2), never typed.
  let checkout: ThankYouSaveCheckout | null = null;
  if (!owned) {
    const [pendingOrder, sellability, sku, settings, vatRatePct] = await Promise.all([
      eventOwnsSku(ent, eventId, SKU_CODE).catch(() => false),
      resolveServiceSellability(SKU_CODE),
      formatV2Sku(SKU_CODE).catch(() => null),
      fetchPlatformSettings(supabase),
      getEffectiveVatRatePct(supabase),
    ]);
    checkout = {
      pending: pendingOrder,
      priceCentavos:
        sellability === 'sellable' && sku?.price_centavos != null ? String(sku.price_centavos) : null,
      pricePhp: sellability === 'sellable' ? (sku?.price_php ?? null) : null,
      vatRatePct,
      settings,
    };
  }

  // Runs under the couple's OWN RLS-bound client, and `fetchTeaserFrames` inside
  // applies the public consent gates — so this cannot surface an unconsented
  // guest's photo even though the caller owns the event.
  const plan = await buildThankYouVideoPlan(supabase, eventId);

  return (
    <div className="sn-col space-y-6 py-8">
      {/* Unowned, this page now asks for money (at "Save to my phone"), so it
          opens with the product's name, promise and price — the buy hero.
          Owned, it is a page the couple lives in: the shared masthead, which
          carries the back chevron. One h1 either way (opposite arms). */}
      {checkout && !checkout.pending ? (
        <StudioBuyHero
          productName={HERO.label}
          promise={HERO.blurb}
          price={checkout.pricePhp != null ? formatPhp(checkout.pricePhp) : undefined}
          priceNote={
            checkout.pricePhp != null ? 'Make it free — pay only to save it to your phone' : undefined
          }
        />
      ) : (
        <PageMasthead title="Thank-You Video" />
      )}

      <ThankYouMaker plan={plan} eventId={eventId} checkout={checkout} />
    </div>
  );
}
