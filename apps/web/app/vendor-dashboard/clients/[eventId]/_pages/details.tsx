/**
 * 🗂 DETAILS — a picked-client page (THE ONE BUILD, 8 Nov 2026 · v113). OWNER: **L2** (B1 step 6).
 *
 * Hour-0 stub: draws the shipped Details node unchanged. Step 6 composes it in the ruled order — stage strip ·
 * 3 numbers · Hosts · Details · Access request · Suppliers · Decisions · Forms sent — with the date-change and
 * delete-request answers (C1's `DateChangeBody` / `DeleteRequestBody`) mounted here.
 */
import type { PickedPageProps } from './context';

export function DetailsPage({ shipped }: PickedPageProps) {
  return <>{shipped ?? null}</>;
}
