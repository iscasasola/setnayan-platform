'use client';

// ============================================================================
// 🔕 MUTE THIS CHAT — the ⋯ row (Unichat drawing v3: "Mute this chat / Unmute this chat", a bell-off after the name,
// toast "Muted. Cards that need you still show."). Controller ruling 21 Nov 2026: per person, all their devices; the
// chat still counts unread, only the buzz stops.
//
// The press writes (or removes) the viewer's own `chat_thread_mutes` row through `savePushSubscription` (folded — the
// action budget is at its ceiling), says so in the ONE toast, and refreshes the page so the row's words and the
// bell-off follow what is stored. A refused save says so and changes nothing.
// ============================================================================

import { useRouter } from 'next/navigation';
import { Bell, BellOff } from 'lucide-react';
import { PICKED_MORE_ROW } from '@/app/_components/picked/picked-shell';
import { useToast } from '@/app/_components/toast/toast-provider';
import { savePushSubscription } from '@/lib/push-actions';
import { muteRowLabel, muteToast } from '@/lib/chat-mutes';

export function MuteChatRow({ threadId, muted }: { threadId: string; muted: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const Icon = muted ? Bell : BellOff;
  return (
    <button
      type="button"
      role="menuitem"
      className={PICKED_MORE_ROW}
      data-picked-more-row="mute"
      data-muted={muted ? '' : undefined}
      onClick={async () => {
        const next = !muted;
        const res = await savePushSubscription({ muteThreadId: threadId, muted: next });
        if (!res.ok) {
          toast.error('Couldn’t change this chat’s notifications. Try again.');
          return;
        }
        toast.success(muteToast(next));
        // one-render: keep (no-revalidate) — muteChat in lib/push-actions.ts writes the mute row and revalidates nothing, so this refresh is the only redraw of the row's label and the bell-off mark.
        router.refresh();
      }}
    >
      <Icon aria-hidden className="h-[18px] w-[18px] shrink-0 text-[color:var(--m-slate-2)]" strokeWidth={1.9} />
      <span className="min-w-0 flex-1 truncate">{muteRowLabel(muted)}</span>
    </button>
  );
}

/** The bell-off after the chat's name while muted (drawing v3). */
export function MutedMark() {
  return (
    <BellOff aria-label="Muted" role="img" className="ml-1.5 inline h-4 w-4 shrink-0 align-[-2px] text-ink/55" strokeWidth={1.9} data-chat-muted-mark="" />
  );
}
