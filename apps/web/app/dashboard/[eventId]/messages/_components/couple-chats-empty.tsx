/**
 * 💬 THE HOST'S EMPTY CHATS — one part, drawn by the Chats page and its dev lab (Build 3 · Lane A, empty modes are part
 * of done, 03-FINAL-RULINGS 9 Nov). One line, the reason, and a door to start: Find a supplier. Moved here verbatim from
 * `messages/page.tsx`, so the lab shows exactly what a new event shows.
 */
import Link from 'next/link';
import { MessageSquare } from 'lucide-react';
import { findDoorHref } from '@/lib/suppliers-shell';

export function CoupleChatsEmpty({ eventId }: { eventId: string }) {
  return (
    <div className="py-10 text-center" data-chats-empty="">
      <MessageSquare aria-hidden className="mx-auto mb-2 h-6 w-6 text-ink/70" strokeWidth={1.5} />
      <p className="text-sm font-medium text-ink">No chats yet.</p>
      <p className="mx-auto mt-1 max-w-md text-xs text-ink/70">
        Tap ✎ to message one of this event&rsquo;s suppliers, or Ask for a quote on a supplier&rsquo;s page.
      </p>
      <div className="mt-4">
        <Link href={findDoorHref(eventId)} className="ab ab-neutral">
          Find a supplier
        </Link>
      </div>
    </div>
  );
}
