import Link from 'next/link';
import { X } from 'lucide-react';
import { theirEventLine } from '@/lib/their-event';

/**
 * "Their event · Claire & Indalecio · ✕ Close" — the one line on top of a part opened from the list (drawing frames 2–5:
 * *"No tab bar. ✕ Close goes back to the chat."*).
 */
export function TheirEventLine({ eventId, eventName }: { eventId: string; eventName: string | null }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border-b border-ink/10 px-4 py-2" data-their-event-line="">
      <span className="truncate text-[14px] font-medium text-ink">{theirEventLine(eventName)}</span>
      <Link
        href={`/vendor-dashboard/clients/${eventId}?tab=chat`}
        className="inline-flex min-h-11 shrink-0 items-center gap-1 text-[14px] font-medium text-sn-accent"
        aria-label="Close — back to the chat"
      >
        <X aria-hidden className="h-4 w-4" />
        Close
      </Link>
    </div>
  );
}
