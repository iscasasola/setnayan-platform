/**
 * DEV-ONLY (Supplier Build 3 · Lane A): the picked page's Chat body on fixture messages, for both labs — the
 * supplier's picked client (`/dev/supplier-chat-lab?m=chats&pick=…`) and the host's picked supplier
 * (`/dev/chat-lab?pick=…`). It draws what the two embedded thread pages draw (`__embed=chat`): the ONE `ChatBox` with NO
 * head (the picked shell's pinned row is the head), the shared `ChatMessageStream` and the real `ChatSendForm`. Send is
 * a lab stand-in that writes nothing. Only ever imported by `/dev/*` pages, which 404 in production.
 */
import { ChatBox } from '@/app/_components/chat/chat-box';
import { ChatSafetyBanner } from '@/app/_components/chat-privacy-notice';
import { ChatMessageStream } from '@/app/_components/chat-message-stream';
import { ChatSendForm } from '@/app/_components/chat-send-form';
import { CHAT_ATTACH_INPUT_ID } from '@/lib/chat-attach-input-id';
import { dealEntryFor } from '@/lib/deal-entry';
import { LAB_MESSAGES, LAB_STAFF, LAB_USER } from '@/app/dev/chat-lab/fixtures';

async function labSend(formData: FormData): Promise<void> {
  'use server';
  void formData;
  if (process.env.NODE_ENV === 'production') throw new Error('lab: not in production');
}

export function LabPickedChat({ threadId, side, counterpartyLabel }: { threadId: string; side: 'couple' | 'vendor'; counterpartyLabel: string }) {
  return (
    <div data-picked-lab-chat={side} className="flex min-h-[70dvh] flex-col">
      <ChatBox
        header={null}
        notice={<ChatSafetyBanner inBox />}
        composer={<ChatSendForm threadId={threadId} sendAction={labSend} attachInputId={CHAT_ATTACH_INPUT_ID} userId={side === 'couple' ? LAB_USER : LAB_STAFF} />}
      >
        <ChatMessageStream
          flush
          dealEntry={dealEntryFor({ side, hasQuote: true })}
          threadId={threadId}
          initialMessages={LAB_MESSAGES.map((m) => ({ ...m, thread_id: threadId }))}
          currentUserId={side === 'couple' ? LAB_USER : LAB_STAFF}
          viewerRole={side}
          counterpartyLabel={counterpartyLabel}
          senderNames={side === 'couple' ? { [LAB_STAFF]: 'Paolo' } : {}}
          lockHandshake={null}
          fileExpiry={{ eventDate: '2026-12-18', precision: 'day' }}
        />
      </ChatBox>
    </div>
  );
}
