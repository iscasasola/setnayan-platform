/**
 * /dev/supplier-lab — the supplier dashboard redesign on fixture data: no
 * sign-in, no database (corpus `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md`,
 * prototype `prototypes/supplier_dashboard_2026-10-08_fable.html`). DEV-ONLY:
 * production builds 404 this route, the same kill-switch as `/dev/home-lab`.
 * It draws the REAL supplier components, so what it shows is what ships.
 *
 *   ?thumb=people     the frosted thumb row: a search field (≥ 60 %) + Add     (frame 03)
 *   ?thumb=customer   Chat (main) · Quote · Payment · Call                     (frame 06)
 *   ?thumb=money      Log a payment — a form's submit through the button rule  (frame 05)
 */
import { notFound } from 'next/navigation';
import { Check, MessageSquare, Phone, Plus, Send, Wallet } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { SupplierThumbRow } from '@/app/vendor-dashboard/_components/supplier-thumb-row';
import { SupplierSubmit } from '@/app/vendor-dashboard/_components/supplier-submit';

export const dynamic = 'force-dynamic';

const ICON = { 'aria-hidden': true, strokeWidth: 1.9 } as const;

export default async function SupplierLabPage({
  searchParams,
}: {
  searchParams: Promise<{ thumb?: string }>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const q = await searchParams;
  const thumb = q.thumb ?? 'people';
  return (
    <div className="min-h-screen bg-cream px-4 pb-40 pt-3" data-supplier-lab={thumb}>
      {/* Rows to scroll under the glass, so the frost has something to blur. */}
      <ul>
        {Array.from({ length: 14 }, (_, i) => (
          <li key={i} className="border-t border-ink/10 py-3 text-[15px] text-ink first:border-t-0">
            Customer {i + 1}
            <span className="block text-[13px] text-ink/60">Wedding · Mar 13, 2027 · Tagaytay</span>
          </li>
        ))}
      </ul>

      {thumb === 'customer' ? (
        <SupplierThumbRow name="customer" label="Customer actions">
          <ActionButton tone="info" main icon={<MessageSquare {...ICON} />} label="Chat" href="/dev/supplier-lab?thumb=customer" />
          <ActionButton tone="neutral" icon={<Send {...ICON} />} label="Quote" href="/dev/supplier-lab?thumb=customer" />
          <ActionButton tone="neutral" icon={<Wallet {...ICON} />} label="Payment" href="/dev/supplier-lab?thumb=customer" />
          <ActionButton tone="neutral" icon={<Phone {...ICON} />} label="Call" href="/dev/supplier-lab?thumb=customer" />
        </SupplierThumbRow>
      ) : thumb === 'money' ? (
        <SupplierThumbRow name="money" label="Money actions">
          {/* A GET form back to the lab: the submit is real, nothing is written. */}
          <form action="/dev/supplier-lab" className="contents">
            <input type="hidden" name="thumb" value="money" />
            <SupplierSubmit tone="ok" main icon={<Check {...ICON} />} label="Log a payment" pendingLabel="Saving…" overlay={false} />
          </form>
        </SupplierThumbRow>
      ) : (
        <SupplierThumbRow name="people" label="Customer tools">
          <input type="search" placeholder="Search a customer" aria-label="Search a customer" />
          <ActionButton tone="brand" main icon={<Plus {...ICON} />} label="Add" href="/dev/supplier-lab?thumb=people" />
        </SupplierThumbRow>
      )}
    </div>
  );
}
