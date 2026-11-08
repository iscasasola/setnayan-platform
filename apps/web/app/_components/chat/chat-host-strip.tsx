'use client';

import { hostFirstName, hostInitials, type ChatHost } from '@/lib/chat-hosts';

/**
 * WHO IS IN THIS CHAT — the avatar strip under the picked client's pinned row (THE ONE BUILD, v111/v113: "Shared chat ·
 * N inside", initials 8 px apart, a sideways snap carousel when they overflow).
 *
 * The hosts come from `event_chat_hosts` (via the thread page); "You" is the supplier. Initials only — a profile photo
 * is consent-gated (`users.share_profile_photo_with_hosts`, B1 drift #8). The ring = "in this chat now", read from the
 * stream's EXISTING presence channel (`chat-presence-${threadId}` → `presentIds`, passed in) — this file opens no
 * channel. "Online elsewhere" / "N min ago" have no source in the app and are not drawn (spec §4: presence = the ring
 * only).
 */
export function ChatHostStrip({
  hosts,
  presentIds,
  youId,
}: {
  /** NULL = the hosts read was refused: said as such, never as an empty chat. */
  hosts: readonly ChatHost[] | null;
  presentIds: ReadonlySet<string>;
  youId: string;
}) {
  if (hosts === null) {
    return (
      <p className="px-4 py-2 text-xs text-ink/55" role="status" data-chat-host-strip="unread">
        Couldn&rsquo;t load who is in this chat just now.
      </p>
    );
  }
  const people = [...hosts.map((h) => ({ id: h.userId, initials: hostInitials(h), name: hostFirstName(h) })), { id: youId, initials: 'You', name: 'You' }];
  const inNow = people.filter((p) => presentIds.has(p.id)).length;
  return (
    <div className="border-b border-ink/10 px-4 py-2" data-chat-host-strip="">
      {/* 🟢 THE RING IS NEVER CLIPPED (Build 2 #26b). `overflow-x-auto` clips on every side, and the ring draws OUTSIDE
          the avatar: ring-2 + ring-offset-2 = 4 px. So the list pads 4 px all round (`p-1`, pulled back with `-mx-1` so
          the first avatar still lines up with the line below) and snaps inside that padding (`scroll-px-1`). */}
      <ul
        className="-mx-1 flex snap-x snap-mandatory scroll-px-1 gap-2 overflow-x-auto p-1 [scrollbar-width:none]"
        aria-label={`Shared chat · ${people.length} inside`}
      >
        {people.map((p) => {
          const here = presentIds.has(p.id);
          return (
            <li key={p.id} className="flex shrink-0 snap-start flex-col items-center gap-0.5">
              <span
                className={`grid h-9 w-9 place-items-center rounded-full bg-ink/[0.08] text-[11px] font-semibold text-ink/75 ${
                  here ? 'ring-2 ring-success-600 ring-offset-2 ring-offset-cream' : ''
                }`}
                aria-hidden
              >
                {p.initials}
              </span>
              <span className="max-w-[4.5rem] truncate text-[10.5px] text-ink/60">
                {p.name}
                <span className="sr-only">{here ? ' · in this chat now' : ''}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-ink/55">
        Shared chat · {people.length} inside{inNow > 0 ? ` · ${inNow} in the chat now` : ''}
      </p>
    </div>
  );
}
