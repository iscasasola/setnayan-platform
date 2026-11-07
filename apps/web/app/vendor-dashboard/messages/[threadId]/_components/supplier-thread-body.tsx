import VendorThreadPage from '../page';

/**
 * SUPPLIER THREAD BODY — THE ONE BUILD (8 Nov 2026; spec plans/supplier_one_build_2026-11-08 B1 step 7, B2 §2.2).
 *
 * The supplier's conversation, drawn INSIDE the picked client's pages (Chat · Quotation) instead of full screen. It is
 * not a second thread page: it renders the shipped page itself (`../page.tsx`, the one `<ChatMessageStream>` mount
 * site) with the internal `__embed` view, so every read, every guard and every string stays in ONE file and the
 * full-screen route (`/vendor-dashboard/messages/[threadId]`, the envelope doors, 6 Nov ruling) is unchanged.
 *
 *   view 'chat'      — the conversation without the full-screen frame: no conversation list, no thread head (the
 *                      client's pinned row is the head), the hosts strip under it.
 *   view 'quotation' — the version line + the quote builder (owner's eleven steps), seeded from the live quote.
 *
 * Mount it in its own <Suspense> — it waits on the thread's batched read.
 */
export function SupplierThreadBody({ threadId, view }: { threadId: string; view: 'chat' | 'quotation' }) {
  return (
    <VendorThreadPage
      params={Promise.resolve({ threadId })}
      searchParams={Promise.resolve({ __embed: view })}
    />
  );
}
