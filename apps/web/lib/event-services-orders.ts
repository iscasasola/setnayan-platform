import 'server-only';

/**
 * 🛒 EVENT SERVICES → ONE ORDER (owner 2026-11-23, "ONE PLACE TO BUY FOR AN EVENT"; v4 approved "Yes, build it").
 *
 * What was ticked on the Event services page — a pack, singles, one photo size — becomes ONE bill with ONE reference,
 * paid on the shipped `/pay/[reference]` page (Maya; the shipped BDO QR route only when Maya will not open). The same
 * one-bill shape as the sign-up basket (`lib/onboarding-services-orders.ts`): an `orders` row under
 * `EVENT_SERVICES_SKU` whose items are `onboarding_order_items` lines, so activation fans out over them
 * (`activateOnboardingBasket`), ownership reads them (`basketGrantsSku`, through the aliases), the pay page lists them
 * (`order_basket_lines`) and the payments desk names them.
 *
 * ── SEC-4: THE BROWSER CHOOSES *WHAT*, THIS FILE DECIDES THE PESO FIGURE ──
 * The form carries a pick of CLOSED values (`parsePick`): a pack key, single keys, a photo size code. No amount is an
 * input to the bill. Every line is priced by `readEventServices` → `resolveOrderChargeCentavos`, the authority every
 * checkout uses (an upgrade pays the difference; Setnayan AI by the event's type while that switch is on). The one
 * money-shaped field read, `shown_total_centavos`, is the overcharge TRIPWIRE only — the bill may never be higher than
 * the figure the person was shown; it never becomes the charge.
 *
 * ── THE SAME DOORS AS CHECKOUT ──
 * Signed in and not anonymous · a member of the event · a host (the coordinator money scope) · every line still on
 * sale (`resolveServiceSellability`, failing closed) · day-of services refused once the event is over (the same
 * `ADD_ONS` rule `submitOrderAction` asks) · nothing already held or being checked (`cartFor` drops it; a pick the
 * facts refuse is a refusal here, never a quiet change to what is billed).
 *
 * ⚠ NOTHING IS GRANTED HERE. The order is minted `submitted`; each line switches on when the payment is approved.
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient, createMoneyWriterClient } from '@/lib/supabase/admin';
import { orderRowFor } from '@/lib/order-mint-identity';
import { mintPapicReferenceCode } from '@/lib/papic-cameras';
import { EVENT_SERVICES_SKU } from '@/lib/onboarding-order-items';
import { resolveServiceSellability } from '@/lib/v2-catalog';
import { coordinatorMoneyScopeAllowed, ONLY_A_HOST_PAYS } from '@/lib/coordinator-money-scope';
import { ADD_ONS } from '@/lib/add-ons-catalog';
import { EVENT_CLOCK_COLUMNS } from '@/lib/event-clock';
import { eventClockOf } from '@/lib/event-clock.server';
import { readEventServices } from '@/lib/event-services.server';
import { cartFor, parsePick, PACK_HOLDS, singleTickable, singlesInPlan } from '@/lib/event-services';

/** The intent `submitOrderAction` routes here (folded — the server-action ceiling is full, never raised). */
export const EVENT_SERVICES_INTENT = 'event_services';

export type EventServicesOrderResult =
  | { ok: true; order_id: string; reference_code: string }
  | { ok: false; reason: string; needsAccount?: true };

const TRY_AGAIN = 'We could not read a price just now. Nothing was charged. Please try again in a moment.';

export async function submitEventServicesOrder(formData: FormData): Promise<EventServicesOrderResult> {
  const eventIdRaw = formData.get('event_id');
  const eventId = typeof eventIdRaw === 'string' ? eventIdRaw.trim() : '';
  if (!eventId) return { ok: false, reason: 'Missing required fields. Please refresh and try again.' };
  let rawPick: unknown = null;
  try {
    const p = formData.get('pick');
    rawPick = typeof p === 'string' ? JSON.parse(p) : null;
  } catch {
    rawPick = null;
  }
  const pick = parsePick(rawPick);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: 'Please sign in to pay.' };
  if (user.is_anonymous) {
    return { ok: false, reason: 'Create your account to complete this purchase — your plan stays exactly as it is.', needsAccount: true };
  }
  const { data: membership } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) return { ok: false, reason: 'You can only check out for your own event.' };
  if (!(await coordinatorMoneyScopeAllowed(createAdminClient(), eventId, user.id, 'checkout'))) {
    return { ok: false, reason: ONLY_A_HOST_PAYS };
  }

  // ── the facts the page drew, read again here — the bill is priced from THIS read ──
  const facts = await readEventServices(eventId);
  if (pick.pack) {
    const pack = facts.packs.find((p) => p.key === pick.pack);
    if (!pack || pack.state !== 'buy') return { ok: false, reason: 'That pack is already on this event, or being checked.' };
    if (pack.php === null) return { ok: false, reason: TRY_AGAIN };
  }
  const inPlan = singlesInPlan(facts.plan, pick.pack);
  for (const key of pick.singles) {
    const s = facts.singles.find((x) => x.key === key);
    // In the picked pack: not billed twice — the pack holds it (`PACK_HOLDS`). Anything else not tickable is refused.
    if (pick.pack && PACK_HOLDS[pick.pack].includes(key)) continue;
    if (!s || !singleTickable(s, inPlan)) {
      return { ok: false, reason: s && s.state !== 'buy' ? 'Something you picked is already on this event.' : TRY_AGAIN };
    }
  }
  if (pick.photos && !facts.photos?.some((p) => p.code === pick.photos)) return { ok: false, reason: TRY_AGAIN };

  const cart = cartFor(facts, pick);
  if (cart.lines.length === 0) return { ok: false, reason: 'Pick something first.' };
  if (cart.totalPhp === null || !(cart.totalPhp > 0)) return { ok: false, reason: TRY_AGAIN };

  // Tripwire: never bill above what the screen showed (the price moved between the render and the press).
  const shownRaw = formData.get('shown_total_centavos');
  const shownCentavos = typeof shownRaw === 'string' && /^\d{1,12}$/.test(shownRaw) ? Number(shownRaw) : null;
  if (shownCentavos !== null && Math.round(cart.totalPhp * 100) > shownCentavos) {
    return { ok: false, reason: 'A price changed since this page opened. Look again, then pay.' };
  }

  // Every line still on sale — failing closed on a read error, as checkout does.
  const sellable = await Promise.all(cart.lines.map((l) => resolveServiceSellability(l.code)));
  if (sellable.some((s) => s === 'error')) return { ok: false, reason: TRY_AGAIN };
  if (sellable.some((s) => s === 'retired')) return { ok: false, reason: 'Something you picked is no longer on sale. Look again, then pay.' };

  // The day-of services stop selling once the celebration is over (owner 2026-08-21) — the rule checkout asks.
  const dayOf = new Set(ADD_ONS.filter((a) => a.dayOfOnly).map((a) => a.serviceKey).filter((k): k is string => Boolean(k)));
  if (cart.lines.some((l) => dayOf.has(l.code))) {
    const { data: clockRow } = await createAdminClient().from('events').select(`${EVENT_CLOCK_COLUMNS}`).eq('event_id', eventId).maybeSingle();
    if (clockRow && eventClockOf(clockRow).menu === 'after') {
      return { ok: false, reason: 'Live Watch only runs during your event, and yours has finished. Everything that turns the day into a keepsake is still open.' };
    }
  }

  const referenceCode = mintPapicReferenceCode();
  // AUTHORIZED BY: the membership and host checks above; identity stamped by orderRowFor (SEC-4b), amount from the
  // authority-priced cart (SEC-4). Kept short: the price-authority scan reads the gap between the table and the insert.
  const { data: order, error: orderErr } = await createMoneyWriterClient()
    .from('orders')
    .insert(
      orderRowFor(
        { userId: user.id, eventId, vendorProfileId: null },
        {
          service_key: EVENT_SERVICES_SKU,
          description: cart.label,
          requested_total_php: cart.totalPhp,
          reference_code: referenceCode,
          status: 'submitted' as const,
          platform: 'web',
        },
      ),
    )
    .select('order_id, public_id')
    .maybeSingle();
  if (orderErr || !order) {
    console.error('[event-services-orders] bill failed:', orderErr?.message);
    return { ok: false, reason: 'We could not create your order. Nothing was charged. Please try again.' };
  }
  const orderId = String((order as { order_id: string }).order_id);

  // WITHOUT THESE LINES THE BILL PROVISIONS NOTHING — activation fans out over exactly this list. Fail closed.
  const { error: itemsErr } = await createAdminClient()
    .from('onboarding_order_items')
    .insert(cart.lines.map((l) => ({ order_id: orderId, service_code: l.code, quantity: 1, unit_price_php: l.php })));
  if (itemsErr) {
    console.error('[event-services-orders] lines failed, cancelling the bill:', { orderId, message: itemsErr.message });
    const { error: cancelErr } = await createMoneyWriterClient().from('orders').update({ status: 'cancelled' }).eq('order_id', orderId);
    // A bill that could not be cancelled is a bill with no lines: said loudly, so the payments desk can void it.
    if (cancelErr) console.error('[event-services-orders] could not cancel the lineless bill:', { orderId, message: cancelErr.message });
    return { ok: false, reason: 'We could not create your order. Nothing was charged. Please try again.' };
  }
  return { ok: true, order_id: orderId, reference_code: referenceCode };
}
