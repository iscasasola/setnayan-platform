'use client';

/**
 * 🔒 THE COMPOSER'S 🔒 DOOR (owner, 9 Nov: "they can also send private message anytime"). The 🔒 beside the ＋ opens
 * this list — the people in this chat, exactly the strip's faces (you excluded, published by the strip through
 * `private-to.ts`) — and picking one sets the chip "Messaging [name] privately ×". Every row is one `ActionButton`
 * (tone info), all the same width, stacked: a list of equal choices. One of three doors to the same chip; the others
 * are a face in the strip and "Reply privately" on a held message. 🔒 lib/a-private-message-looks-private.test.ts
 */
import { Lock } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import type { PrivateTo } from '@/lib/chat-private';

export const PRIVATE_PEOPLE_LIST_ID = 'chat-private-people';

export function PrivatePeopleList({ people, onPick }: { people: readonly PrivateTo[]; onPick: (to: PrivateTo) => void }) {
  return (
    <div
      role="group"
      id={PRIVATE_PEOPLE_LIST_ID}
      aria-label="Message someone privately"
      className="flex flex-col gap-1.5 self-stretch"
      data-chat-private-people=""
    >
      <p className="text-[12px] text-ink/60">Message privately — only you and them see it. Words only.</p>
      {people.map((p) => (
        <ActionButton
          key={p.userId}
          tone="info"
          icon={Lock}
          label={p.name}
          name={`Message ${p.name} privately`}
          className="w-full"
          onClick={() => onPick(p)}
          data-testid={`chat-private-person-${p.userId}`}
        />
      ))}
    </div>
  );
}
