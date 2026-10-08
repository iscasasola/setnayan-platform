'use client';

/**
 * The supplier sheet's one action row (owner 2026-10-07 · Suppliers PR2:
 * "→ Ask for a quote / Open chat").
 *
 * ONE verb, and it is the conversation: with a thread already open it goes to
 * it; without one it asks for a quote through the ONE inquiry path the bench
 * card uses (`ContactShortlistVendorButton` → `contactShortlistVendor`, which
 * stamps the inquiry source — never bypassed). The words and the colour are the
 * card's own (`cardVerbWords`), so the sheet and the card cannot disagree.
 *
 * A supplier the couple added themselves has no conversation to open and
 * nobody to ask — the row is not drawn for them (their card opens their record).
 */
import { MessageCircle } from 'lucide-react';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { cardVerbWords } from '@/lib/supplier-card-verbs';
import { ContactShortlistVendorButton } from './contact-shortlist-vendor-button';

export function SupplierSheetActions({
  eventId,
  vendorId,
  threadId,
  canAsk,
}: {
  eventId: string;
  /** The couple's own pick (`event_vendors.vendor_id`). */
  vendorId: string;
  /** Their conversation with this supplier, when there is one. */
  threadId: string | null;
  /** The supplier is on Setnayan, so a quote can be asked for. */
  canAsk: boolean;
}) {
  const chat = cardVerbWords('chat');
  const ask = cardVerbWords('ask');
  if (threadId) {
    return (
      <div className="flex flex-wrap gap-2" data-supplier-sheet-actions="chat">
        <ActionButton
          tone={chat.tone}
          main
          icon={MessageCircle}
          label="Open chat"
          href={`/dashboard/${eventId}/messages/${threadId}`}
        />
      </div>
    );
  }
  if (!canAsk) return null;
  return (
    <div className="flex flex-wrap gap-2" data-supplier-sheet-actions="ask">
      <ContactShortlistVendorButton
        eventId={eventId}
        vendorId={vendorId}
        label={ask.label}
        pendingLabel="Opening…"
        className={actionButtonClass(ask.tone, { main: true })}
        wrapperClassName=""
        errorClassName="mt-1 text-[11px] text-danger-700"
      />
    </div>
  );
}
