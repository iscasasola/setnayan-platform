/**
 * The dev labs' stand-in for the Share's one request (`createManualVendorInvite({ …, withShare: true })`) (no session, no database there): the SAME message builder and
 * the SAME card renderer, on fixture facts — the card handed over as a data address, so the lab's Share shares the
 * real picture. Server-only use (the labs' pages); nobody real.
 */
import { buildSupplierInviteMessage, supplierGreetingName, type SupplierInviteFacts } from '@/lib/supplier-invite-message';
import { supplierCardDate, supplierCardEventLabel, supplierCardFileName } from '@/lib/supplier-card';
import { renderSupplierCardPng } from '@/lib/supplier-card-render';
import type { SupplierSharePayload } from '@/lib/supplier-share';

export async function labSupplierShare(
  facts: SupplierInviteFacts & { services: string[] },
  url: string,
): Promise<SupplierSharePayload> {
  const png = await renderSupplierCardPng(
    {
      shopName: facts.shopName,
      contactPerson: facts.contactPerson,
      services: facts.services,
      invitedBy: facts.hostsName,
      eventLabel: supplierCardEventLabel(facts.eventWord),
      dateLabel: supplierCardDate(facts.eventDate, facts.datePrecision),
    },
    url,
  );
  return {
    url,
    message: buildSupplierInviteMessage({ ...facts, link: url }) ?? url,
    card: `data:image/png;base64,${Buffer.from(png).toString('base64')}`,
    fileName: supplierCardFileName(facts.shopName),
    greeting: supplierGreetingName(facts),
  };
}
