/**
 * ❓ WHERE THE COUPLE ANSWERS A SUPPLIER'S QUESTIONS (owner 2026-11-04, "Yes, every supplier").
 *
 * In that supplier's room in their event — `/dashboard/[eventId]/vendors/[vendorId]/workspace`, Details tab, the
 * `#supplier-questions` section. A conversation with no booking row behind it yet has no room, so the notice falls
 * back to the conversation itself (the couple's thread page), never to a page that would 404. Pure.
 */
export const SUPPLIER_QUESTIONS_ANCHOR = 'supplier-questions';

export function supplierQuestionsHref(
  eventId: string,
  eventVendorId: string | null,
  threadId: string,
): string {
  if (eventVendorId) {
    return `/dashboard/${eventId}/vendors/${eventVendorId}/workspace?tab=forms#${SUPPLIER_QUESTIONS_ANCHOR}`;
  }
  return `/dashboard/${eventId}/messages/${threadId}`;
}
