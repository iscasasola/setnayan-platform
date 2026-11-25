import { routes } from '@/lib/routes';

/**
 * 🔁 EVERY PAGE THAT SHOWS A CONTRACT (A6-66, final check 25 Nov). `/vendor-dashboard/contracts` is only a forward; the
 * supplier's list is drawn on Clients (`/vendor-dashboard/customers`), and the couple sees the contract on their
 * Contracts and Documents pages. A publish or cancel re-draws all of them. `revalidate` is `revalidatePath` from the
 * action (passed in, so a test can hold the list).
 */
export function revalidateContractViews(
  revalidate: (path: string) => void,
  contractId: string,
  eventId: string | null | undefined,
): void {
  revalidate(`/vendor-dashboard/contracts/${contractId}`);
  revalidate('/vendor-dashboard/customers');
  if (eventId) {
    revalidate(routes.dashboard.contracts.index(eventId));
    revalidate(routes.dashboard.contracts.detail(eventId, contractId));
    revalidate(routes.dashboard.documents(eventId));
  }
}
