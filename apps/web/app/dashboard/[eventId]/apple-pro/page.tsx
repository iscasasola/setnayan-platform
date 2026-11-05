import { redirect } from 'next/navigation';
import { getIapGate } from '@/lib/request-platform';
import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { eventHubOwnership } from '@/lib/couple-website-pro';
import { AppleProScreen } from '@/app/_components/iap/apple-pro-screen';

/**
 * 🍎 /dashboard/[eventId]/apple-pro — Event Hub Pro through Apple, opened by the
 * Maker's "Unlock Pro and Apply" in the iPhone app (lib/hub-draft-store.ts
 * `proHref`). Anywhere Apple does not sell (the web, the desktop app, an old
 * phone build, the owner's switch off) it is not a page: it goes straight back.
 * An event that already has Pro goes back with `?apply=1` — owned is never sold
 * twice. Who may buy is decided by `startAppStorePurchase` (membership + the
 * couple's money consent), the same rule as the web checkout.
 */
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string }>; searchParams?: Promise<{ from?: string }> };

export default async function AppleProPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = (await searchParams) ?? {};
  const back = search.from === 'maker' ? `/dashboard/${eventId}/launch` : `/dashboard/${eventId}`;
  const { iap } = await getIapGate();
  if (!iap) redirect(back);
  const ent = await eventEntitlementClient(eventId).catch(() => null);
  /* What the event holds — Full Pro, any part, the cap (an order under review counts, so nothing is sold twice). */
  const own = ent ? await eventHubOwnership(ent, eventId, 'owned').catch(() => null) : null;
  if (own?.full) redirect(`${back}?apply=1`);
  /* ⛔ Event Hub Pro is sold WHOLE (owner 2026-10-26, "just have the upgrade event hub pro") — never a part, here or on
     the web. "Everything" is not sold in the app once any part is owned — it would charge Apple's full price for less
     on the web, and the app may not say so (owner 2026-10-22, Q1); such an event finishes on the web. */
  if (own && (own.parts.size > 0 || own.paidPhp > 0)) redirect(back);
  return <AppleProScreen eventId={eventId} back={back} />;
}
