import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ReturnInPlace } from '@/app/_components/chat/chat-back';

/**
 * ‹ OUT OF A GROUP — RETURNS IN PLACE (owner 2026-10-29, live in the iPhone app: *"back from a group. it returns but not
 * from the previous screen where we were on people and scrolled down to groups. it returned to people with just the
 * groups."*).
 *
 * The group page's ‹ — from the group itself, and from a one-tap view (Chatroom · Members · Events) to its group. When
 * this tab came here from a list in the app (People, People › Groups, Notifications — each mounts `ChatOriginMark`),
 * the press is the browser's back: the screen you left comes back with its view and its scroll. Otherwise (a deep
 * link, a push notification, a fresh open) it is the plain link — from the group, the map's home (`lib/page-home.ts`,
 * People › Groups). The mechanism is the chat's ‹ (`ReturnInPlace`, chat/chat-back.tsx) — one way back, not two.
 *
 * Leave is NOT this: leaving lands on People › Groups with "You left the group." (`leaveCommunity`, ../actions.ts).
 * 🔒 lib/groups-return-to-people.test.ts
 */
export function GroupBack({ href, label }: { href: string; label: string }) {
  return (
    <ReturnInPlace>
      <Link
        href={href}
        className="mb-3 inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-md px-1 text-sm font-medium text-ink/70 hover:text-ink"
        data-group-back=""
      >
        <ArrowLeft aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span className="truncate">{label}</span>
      </Link>
    </ReturnInPlace>
  );
}
