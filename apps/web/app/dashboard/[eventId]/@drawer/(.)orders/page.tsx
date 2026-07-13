import { SectionDrawer } from '../../_components/section-drawer';
import CoupleOrdersPage from '../../orders/page';

/**
 * Intercepts a SOFT navigation to /dashboard/[eventId]/orders (e.g. the
 * Overview "Your services → Open orders" link) and renders the orders list in
 * the in-place drawer. Composes the real page component so there is ONE source
 * of the orders view — no duplication. Hard load / refresh renders the full
 * page normally.
 */
export const dynamic = 'force-dynamic';

export default async function InterceptedOrders({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  return (
    <SectionDrawer label="Your orders">
      <CoupleOrdersPage params={params} searchParams={Promise.resolve({})} />
    </SectionDrawer>
  );
}
