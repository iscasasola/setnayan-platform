'use server';

/**
 * buyService — Add / Buy more for the Planner, Live stream, Music, Video booth
 * and Event Hub Pro: MINT THE ORDER, THEN /pay (owner 2026-10-14 🧩 answer 5,
 * "all four move to the same mint-then-/pay page as Papic — one way to pay";
 * Event Hub Pro rides the same sheet, DECISION_LOG ✅ the services prototype).
 *
 * The Papic shape, step for step (`purchasePapicPoolTopUp`, studio/papic/actions.ts):
 *   couple only → the offer is a closed list → no day-of sale after the day →
 *   an unlock already held is not sold twice → the PRICE IS THE SERVER'S
 *   (`resolveServiceSellability` rejects a retired SKU, then
 *   `resolveOrderChargeCentavos` — the catalog, Setnayan AI's per-event-type
 *   ladder and comeback included) → ONE PRESS, ONE BILL (`openTwinReference`
 *   before, `keepFirstTwin` after) → straight to `/pay/<reference>`.
 *
 * 🔒 Nothing the browser sends sets a price: the form carries the event and the
 * offer KIND only (`lib/service-offers.ts`), and every figure is re-read here.
 * One unit per order (see that file) — there is no quantity to tamper with.
 */
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { eventIsOver } from '@/lib/event-is-over.server';
import { eventOwnsSku } from '@/lib/entitlements';
import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { resolveServiceSellability } from '@/lib/v2-catalog';
import { orderTotalToPhp, resolveOrderChargeCentavos } from '@/lib/order-charge-authority';
import { orderRowFor } from '@/lib/order-mint-identity';
import { keepFirstTwin, openTwinReference } from '@/lib/one-press-one-order';
import { mintPapicReferenceCode } from '@/lib/papic-cameras';
import { payPath } from '@/lib/pay-path';
import { isStoreShellRequest } from '@/lib/request-platform';
import { isServiceOfferKind, SERVICE_OFFERS, type ServiceOfferKind } from '@/lib/service-offers';

/** Where each offer's page lives — the way back for a refusal (href literals, for the scan). */
function backFor(kind: ServiceOfferKind, eventId: string): string {
  const pages: ReadonlyArray<{ kind: ServiceOfferKind; href: string }> = [
    { kind: 'ai', href: `/dashboard/${eventId}/studio/setnayan-ai` },
    { kind: 'live', href: `/dashboard/${eventId}/studio/live-studio-control` },
    { kind: 'more-screen', href: `/dashboard/${eventId}/studio/live-studio-control` },
    { kind: 'music', href: `/dashboard/${eventId}/studio/pakanta` },
    { kind: 'more-song', href: `/dashboard/${eventId}/studio/pakanta` },
    { kind: 'booth', href: `/dashboard/${eventId}/studio/patiktok` },
    { kind: 'hub', href: `/dashboard/${eventId}/studio/website-pro` },
  ];
  return pages.find((p) => p.kind === kind)?.href ?? `/dashboard/${eventId}`;
}

export async function buyService(formData: FormData) {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) redirect('/dashboard');
  const rawKind = String(formData.get('offer') ?? '').trim();
  if (!isServiceOfferKind(rawKind)) redirect(`/dashboard/${eventId}`);
  const kind: ServiceOfferKind = rawKind;
  const offer = SERVICE_OFFERS[kind];
  const back = backFor(kind, eventId);
  const fail = (code: string): never => redirect(`${back}?buy_error=${code}`);

  // 🔒 The iPhone app never sells a digital service (App Review 3.1.1) — the
  // sheet is not drawn there; this refuses a post that arrives anyway.
  if (await isStoreShellRequest()) redirect('/web-only');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // The purchase is the couple's (a coordinator sees the band, not the button).
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') fail('not_couple');

  const admin = createAdminClient();

  // A day-of service stops selling once the day is over (`addOnSellableNow`).
  if (offer.dayOfOnly && (await eventIsOver(admin, eventId))) fail('event_over');

  // An unlock already held — paid or waiting — is never sold twice. A "more"
  // (another song, another venue-screen day) is a new purchase on purpose.
  if (offer.unlock && (await eventOwnsSku(await eventEntitlementClient(eventId), eventId, offer.sku).catch(() => false))) {
    redirect(back);
  }

  // THE PRICE IS THE SERVER'S. A retired SKU is refused BEFORE the resolver
  // (the order checkout keeps), and a read error refuses too — never a guess.
  const sellability = await resolveServiceSellability(offer.sku);
  if (sellability !== 'sellable') fail('unavailable');
  const authority = await resolveOrderChargeCentavos({ serviceKey: offer.sku, eventId });
  if (!authority.ok) fail('unavailable');
  const pricePhp = authority.ok ? orderTotalToPhp(authority.total) : 0;
  if (!Number.isFinite(pricePhp) || pricePhp <= 0) fail('unavailable');

  // ONE PRESS, ONE BILL (#6527 — lib/one-press-one-order.ts).
  const twinKey = { eventId, userId: user.id, serviceKey: offer.sku, amountPhp: pricePhp, description: offer.description };
  const reuse = await openTwinReference(admin, twinKey);
  if (reuse) redirect(payPath(reuse));

  const referenceCode = mintPapicReferenceCode();
  const moneyWriter = createMoneyWriterClient();
  const { data: order, error: orderErr } = await moneyWriter
    .from('orders')
    .insert(
      orderRowFor(
        { userId: user.id, eventId, vendorProfileId: null },
        {
          service_key: offer.sku,
          description: offer.description,
          requested_total_php: pricePhp,
          reference_code: referenceCode,
          status: 'submitted',
          platform: 'web',
          ...(authority.ok && authority.paxSnapshot !== null ? { pax_snapshot: authority.paxSnapshot } : {}),
        },
      ),
    )
    .select('order_id')
    .maybeSingle();
  if (orderErr || !order) fail('order_failed');

  // Two presses that arrived TOGETHER both passed the check above; the later
  // order cancels itself here and lands on the earlier one.
  const kept = await keepFirstTwin(admin, moneyWriter, twinKey, { orderId: order!.order_id as string, referenceCode });
  if (!kept.keptMine) redirect(payPath(kept.reference));

  revalidatePath(back);
  revalidatePath(`/dashboard/${eventId}`);
  // 💳 STRAIGHT TO THE PAYMENT PAGE — the one place every bill is settled.
  redirect(payPath(referenceCode));
}
