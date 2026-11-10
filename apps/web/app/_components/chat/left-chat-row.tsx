'use client';

/**
 * 🚪 A CHAT YOU LEFT, IN YOUR CHATS LIST (owner, 9 Nov): it stays, GREYED, never removed. A tap asks "Join this chat
 * again?" ("You left on Nov 9 — “note”"; Join chat · Not now — `leave-chat-dialogs.tsx`), and joining opens it. Its own
 * part so only a left row reaches for the router. 🔒 lib/a-supplier-chat-starts-small.test.ts
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThreadListAvatar } from '@/app/_components/chat/thread-list-card';
import { JoinChatDialog } from './leave-chat-dialogs';
import type { ChatLeftRead } from '@/lib/chat-members';

export function LeftChatRow({
  threadId,
  href,
  name,
  logoUrl,
  preview,
  timeLabel,
  left,
  join,
}: {
  threadId: string;
  href: string;
  name: string;
  logoUrl: string | null;
  preview: string;
  timeLabel: string;
  left: ChatLeftRead;
  join: (threadId: string) => Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const router = useRouter();
  return (
    <li className="flex items-center" data-inbox-row="left">
      <button
        type="button"
        className="sn-press flex min-h-[72px] min-w-0 flex-1 items-center gap-3 py-2 text-left opacity-55"
        aria-haspopup="dialog"
        aria-label={`${name} — you left this chat. Join again?`}
        onClick={() => setAsking(true)}
      >
        <span className="shrink-0 grayscale">
          <ThreadListAvatar logoUrl={logoUrl} name={name} size="lg" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-medium text-ink">{name}</span>
          <span className="block truncate text-[14px] text-ink/60">
            You left · {preview} · {timeLabel}
          </span>
        </span>
      </button>
      <JoinChatDialog
        open={asking}
        left={left}
        onCancel={() => setAsking(false)}
        onJoin={async () => {
          setAsking(false);
          await join(threadId);
          router.push(href);
        }}
      />
    </li>
  );
}
