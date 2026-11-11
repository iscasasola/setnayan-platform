'use client';

/**
 * 🫙 A PICKED-SUPPLIER PAGE WITH NOTHING ON IT YET — one honest line and its one action (owner 11 Nov 2026, measured on
 * his phone with a booked supplier: the Quotation tab and the Forms tab rendered BLANK).
 *
 * The workspace's own empty line, not a new drawing: the Schedule page's "No times with {name} yet."
 * (`py-6 text-sm text-ink/60`), and the supplier's empty Quotation's action (`min-h-11 text-terracotta-700 underline`,
 * `vendor-dashboard/clients/[eventId]/_pages/quotation.tsx`). The action is the one the host really has — a quote and a
 * form are things the supplier SENDS, so the host's move is to ask in the chat: it switches to the Chat page in place
 * (`PickedNavContext`, the same switch as the menu — no request). No chat → no action (never a dead control).
 *
 * 🔒 the-picked-supplier-has-nine-pages.test.ts
 */
import { useContext } from 'react';
import Link from 'next/link';
import { PickedNavContext } from '@/app/_components/picked/picked-nav';

export function PickedSupplierEmpty({
  page,
  line,
  ask,
}: {
  /** The page this line stands in for — `data-picked-supplier-empty`. */
  page: 'quote' | 'forms';
  line: string;
  /** The words of the one action (opens Chat), or null when there is no conversation to ask in. */
  ask: string | null;
}) {
  const nav = useContext(PickedNavContext);
  const cls = 'mt-2 inline-flex min-h-11 items-center text-terracotta-700 underline';
  return (
    <div className="py-6 text-sm text-ink/60" data-picked-supplier-empty={page}>
      <p>{line}</p>
      {ask ? (
        nav ? (
          <button type="button" onClick={() => nav.select('chat')} className={cls} data-picked-supplier-empty-ask="">
            {ask} ›
          </button>
        ) : (
          <Link href="?tab=chat" className={cls} data-picked-supplier-empty-ask="">
            {ask} ›
          </Link>
        )
      ) : null}
    </div>
  );
}
