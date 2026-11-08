/**
 * 🗂 DETAILS — a picked-client page (THE ONE BUILD, 8 Nov 2026 · v113). OWNER: **L2** (B1 step 6).
 *
 * Hour-0 stub: draws the shipped Details node unchanged. Step 6 composes it in the ruled order — stage strip ·
 * 3 numbers · Hosts · Details · Access request · Suppliers · Decisions · Forms sent — with the date-change and
 * delete-request answers (C1's `DateChangeBody` / `DeleteRequestBody`) mounted here.
 *
 * 🧾 Build 3 · lane B adds ONE section on top — **Agreed now** (won / lost, the quote, the date, the guest count, the
 * meetings, each with "Changed N×") — and leaves the shipped node below it unchanged.
 */
import { AgreedNow } from '@/app/_components/chat/agreed-now';
import type { PickedPageProps } from './context';

export function DetailsPage({ ctx, shipped }: PickedPageProps) {
  return (
    <div className="space-y-5">
      <AgreedNow
        eventId={ctx.eventId}
        vendorProfileId={ctx.vendorProfileId}
        viewerUserId={ctx.viewerUserId}
        threadId={ctx.threadId}
        isBooked={ctx.isBooked}
      />
      {shipped ?? null}
    </div>
  );
}
