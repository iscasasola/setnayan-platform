import { Suspense } from 'react';
import { SupplierThreadBody } from '@/app/vendor-dashboard/messages/[threadId]/_components/supplier-thread-body';

/**
 * 🤝 "Decisions" on Details (Build 2 · row #42, v118 `dec`) — the list itself, in place (Build 1 was a door to Chat).
 *
 * ⚡ NO READ OF ITS OWN. The list is drawn by the thread page (`SupplierThreadBody view="decisions"`) from the SAME
 * one draw the Chat and Quotation pages use — the picked client builds every page body per request, and all three
 * embeds share that draw (`askedOnce` in `messages/[threadId]/page.tsx`). Opening a client therefore costs ONE thread
 * draw whatever Details shows; Details adds 0 requests. Held by `../a-client-open-draws-the-thread-once.test.ts`.
 *
 * No conversation with this client → nothing can have been decided in one: the empty line, no draw at all.
 */
export function DetailsDecisions({ threadId }: { threadId: string | null; eventId: string }) {
  if (!threadId) {
    return (
      <section data-details-decisions="" aria-label="Decisions">
        <h3 className="home-k2">Decisions · 0</h3>
        <p className="py-2 text-[12px] text-ink/60" data-details-decisions-empty="">
          Nothing decided yet.
        </p>
      </section>
    );
  }
  return (
    <Suspense
      fallback={
        <section data-details-decisions="" aria-label="Decisions" aria-busy="true">
          <h3 className="home-k2">Decisions</h3>
          <p className="py-2 text-[12px] text-ink/55" role="status">
            Loading…
          </p>
        </section>
      }
    >
      <SupplierThreadBody threadId={threadId} view="decisions" />
    </Suspense>
  );
}
