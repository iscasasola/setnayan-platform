import { redirect } from 'next/navigation';
import { getIapGate } from '@/lib/request-platform';
import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { eventSkuActive } from '@/lib/entitlements';
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
  const owned = ent ? await eventSkuActive(ent, eventId, 'COUPLE_WEBSITE_PRO').catch(() => false) : false;
  if (owned) redirect(`${back}?apply=1`);
  return <AppleProScreen eventId={eventId} back={back} />;
}
