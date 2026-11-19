import 'server-only';

import { redirect } from 'next/navigation';

import { eventOwnsSku } from '@/lib/entitlements';
import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isRetiredProductCode } from '@/lib/retired-products';

/**
 * THE DOOR OF A RETIRED PRODUCT'S IN-APP PAGE (owner 2026-11-20: *"Retire Patiktok and Music Maker ( we do not want
 * to serve this anymore)"* — lib/retired-products.ts).
 *
 * An event that already has the product — bought, awaiting payment, or granted by a plan (Event Ultra grants
 * Patiktok; `eventOwnsSku` reads the aliases) — keeps its page. Every other event is sent to its own dashboard: the
 * page would only be a buy screen for a thing we no longer sell.
 *
 * 🔑 A READ THAT FAILS IS NOT "DOES NOT OWN IT". On an error the page opens as before; turning a refused read into a
 * redirect would lock an owner out of what they paid for.
 */
export async function redirectUnlessEventKeepsRetired(eventId: string, serviceCode: string): Promise<void> {
  if (!isRetiredProductCode(serviceCode)) return;
  let owns: boolean;
  try {
    owns = await eventOwnsSku(await eventEntitlementClient(eventId), eventId, serviceCode);
  } catch (err) {
    logQueryError('redirectUnlessEventKeepsRetired', err, { event_id: eventId, service_code: serviceCode }, 'graceful_degrade');
    return;
  }
  if (!owns) redirect(`/dashboard/${eventId}`);
}
