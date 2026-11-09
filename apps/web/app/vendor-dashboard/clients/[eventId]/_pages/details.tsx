/**
 * 🗂 DETAILS — a picked-client page (THE ONE BUILD, 8 Nov 2026 · v113). OWNER: **L2** (B1 step 6).
 *
 * Hour-0 stub: draws the shipped Details node unchanged. Step 6 composes it in the ruled order — stage strip ·
 * 3 numbers · Hosts · Details · Access request · Suppliers · Decisions · Forms sent — with the date-change and
 * delete-request answers (C1's `DateChangeBody` / `DeleteRequestBody`) mounted here.
 *
 * 🧾 Build 3 · lane B adds ONE section on top — **Agreed now** (won / lost, the quote, the date, the guest count, the
 * meetings, each with "Changed N×") — and leaves the shipped node below it unchanged.
 *
 * 🔒 Round 2 adds **Your locks** under it — the quotation, payment-plan and form switches (`SupplierLocksSection`).
 */
import { AgreedNow } from '@/app/_components/chat/agreed-now';
import { SupplierLocksSection } from '@/app/vendor-dashboard/clients/[eventId]/_components/supplier-locks-section';
import type { PickedPageProps } from './context';

export function DetailsPage({ ctx, shipped }: PickedPageProps) {
  // A Fragment, not a wrapper: the shipped node stays a direct child of this page, so the one-draw guard
  // (`a-client-open-draws-the-thread-once.test.ts`) still walks into it and still counts its reads.
  return (
    <>
      <div className="mb-5">
        <AgreedNow
          eventId={ctx.eventId}
          vendorProfileId={ctx.vendorProfileId}
          viewerUserId={ctx.viewerUserId}
          threadId={ctx.threadId}
          isBooked={ctx.isBooked}
        />
      </div>
      <SupplierLocksSection eventId={ctx.eventId} vendorProfileId={ctx.vendorProfileId} />
      {shipped ?? null}
    </>
  );
}
