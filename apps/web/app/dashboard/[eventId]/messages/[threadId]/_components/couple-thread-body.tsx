import CoupleThreadPage from '../page';

/**
 * 🪞 COUPLE THREAD BODY — the host's conversation with one supplier, drawn INSIDE the host's picked supplier
 * (Supplier Build 3 · Lane A, 9 Nov 2026; DECISION_LOG 🪞 *"The chat of the hosts should adapt the same way the suppliers
 * chat box"*). The mirror of the supplier's `SupplierThreadBody`: it is not a second thread page — it renders the shipped
 * page itself (`../page.tsx`, the couple side's one `<ChatMessageStream>` mount site) with the internal `__embed` view,
 * so every read, guard and string stays in ONE file and the full-screen route `/dashboard/[eventId]/messages/[threadId]`
 * is unchanged.
 *
 * view 'chat' — the conversation without the full-screen frame: no conversation column, no thread head (the picked
 * supplier's pinned row is the head); marked read only while Chat is shown (`MarkReadWhenShown`).
 *
 * Mount it in its own <Suspense> — it waits on the thread's batched read.
 */
export function CoupleThreadBody({ eventId, threadId }: { eventId: string; threadId: string }) {
  return (
    <CoupleThreadPage
      params={Promise.resolve({ eventId, threadId })}
      searchParams={Promise.resolve({ __embed: 'chat' })}
    />
  );
}
