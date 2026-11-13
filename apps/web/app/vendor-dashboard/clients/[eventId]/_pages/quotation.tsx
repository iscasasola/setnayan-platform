import { Suspense } from 'react';
import Link from 'next/link';
import { SupplierThreadBody } from '@/app/vendor-dashboard/messages/[threadId]/_components/supplier-thread-body';
import { SUPPLIER_CHATS_HREF } from '@/app/vendor-dashboard/customers/anchors';
import type { PickedPageProps } from './context';

/**
 * QUOTATION — the picked client's page (THE ONE BUILD, v113; owner item 17 "Quotation in eleven steps"; spec
 * plans/supplier_one_build_2026-11-08 B2 §2.2). Mounted by the client shell (`PickedClientShell`, lane L2).
 *
 * Moved, not redrawn: the shipped quote builder (`ProposalMaker`, re-ordered to the owner's eleven steps) with the
 * shipped saved-template shortcut, drawn by the thread page itself through `SupplierThreadBody` view 'quotation' —
 * one read path, the version line on top, seeded from the live quote. ⚖ A service card's gift does NOT pre-fill the
 * quote's gift (unruled money, spec §4 — asked of the owner, not built).
 *
 * No conversation with this client (an outside client added by hand, or nobody has written yet) → there is nothing to
 * send a quote INTO: say so and point at the chats, never an empty builder that cannot send.
 */
export function QuotationPage({ ctx }: PickedPageProps) {
  const { threadId } = ctx;
  if (!threadId) {
    return (
      <div className="px-4 py-6 text-sm text-ink/70" data-picked-client-page="quotation" data-empty="no-thread">
        <p>A quote is sent inside your conversation with this client, and there isn&rsquo;t one yet.</p>
        <Link href={SUPPLIER_CHATS_HREF} className="mt-2 inline-flex min-h-11 items-center text-terracotta-700 underline">
          Your chats ›
        </Link>
      </div>
    );
  }
  return (
    <Suspense
      fallback={
        <p className="px-4 py-6 text-sm text-ink/70" role="status" data-picked-client-page="quotation">
          Loading the quote…
        </p>
      }
    >
      <SupplierThreadBody threadId={threadId} view="quotation" />
    </Suspense>
  );
}

export default QuotationPage;
