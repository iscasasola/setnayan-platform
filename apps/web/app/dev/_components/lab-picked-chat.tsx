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
import { BookedCallButtons } from '@/app/_components/chat/booked-call-buttons';
import { CHAT_ATTACH_INPUT_ID } from '@/lib/chat-attach-input-id';
import { dealEntryFor } from '@/lib/deal-entry';
import { LAB_MESSAGES, LAB_STAFF, LAB_USER } from '@/app/dev/chat-lab/fixtures';
import type { ChatHost } from '@/lib/chat-hosts';

/** Sample hosts (nobody real) — the first is the fixture couple sender. `?hosts=fail` in a lab hands `null` instead:
 * the shipped strip's "Couldn't load" line. */
const MARIA: ChatHost = { userId: LAB_USER, firstName: 'Maria', name: 'Maria Reyes', role: 'bride', label: null };
const JOSE: ChatHost = { userId: '00000000-0000-4000-8000-0000000000ee', firstName: 'Jose', name: 'Jose Santos', role: 'groom', label: null };
const PIA: ChatHost = { userId: '00000000-0000-4000-8000-0000000000e2', firstName: 'Pia', name: 'Pia Cruz', role: 'wedding_planner_external', label: 'Coordinator' };
/** The host side's strip carries the shop (the real page adds it the same way, role `supplier`). */
const SHOP: ChatHost = { userId: LAB_STAFF, firstName: 'Lumière Photo', name: 'Lumière Photo', role: 'supplier', label: null };

/** 👥 The event's hosts NOT in this chat (lab): one who left, one never added — the ＋ list's two kinds. */
const LAB_ADDABLE = [
  { userId: '00000000-0000-4000-8000-0000000000f1', firstName: 'Lea', name: 'Lea Reyes', role: 'parent_of_bride', label: null, left: true },
  { userId: '00000000-0000-4000-8000-0000000000f2', firstName: 'Tita Lu', name: 'Lourdes Santos', role: 'ninang', label: null, left: false },
];

/**
 * The lab's stand-in writes (they write nothing; the real ones are Lane B's) are handed IN by the two lab pages: a
 * `'use server'` inside THIS file would make its exported `LabPickedChat` count as a server action in
 * `lint-server-action-budget.mjs` (one more Vercel route for a dev lab). The pages export nothing it counts.
 */
export type LabChatActions = {
  send: (formData: FormData) => Promise<void>;
  add?: (userIds: string[], how: 'all' | 'picked') => Promise<void>;
  leave?: (note: string | null) => Promise<void>;
};

/**
 * 🔒 One private sample per side (lab only; the shared fixtures stay as they are): a host ↔ host line on the event's
 * side (Jose → Maria — the supplier can never read one), and supplier → Maria on the supplier's. Blue, with its strip.
 */
function labPrivate(threadId: string, side: 'couple' | 'vendor') {
  const fromJose = side === 'couple';
  return {
    message_id: '00000000-0000-4000-8000-0000000000b1',
    thread_id: threadId,
    event_id: LAB_MESSAGES[0]!.event_id,
    vendor_profile_id: LAB_MESSAGES[0]!.vendor_profile_id,
    sender_user_id: fromJose ? JOSE.userId : LAB_STAFF,
    sender_role: fromJose ? ('couple' as const) : ('vendor' as const),
    recipient_user_id: LAB_USER,
    body: fromJose ? 'Between us — let’s keep the same-day edit a surprise for Mama.' : 'I can hold Dec 12 for you until Friday.',
    created_at: new Date(Date.UTC(2026, 9, 26, 10, 40)).toISOString(),
  } as (typeof LAB_MESSAGES)[number];
}


/** Empty modes (Build 3 · Lane A, "empty modes are part of done"): `noMessages` = a chat nobody has written in yet;
 *  `solo` = a single member on the event side (only you — the strip's ＋ shows for the missing hosts). */
export type LabChatMode = { hostsFail?: boolean; noMessages?: boolean; solo?: boolean; tallPins?: boolean };

/** `tallPins`: lab stand-ins for Lane B's pins (due-now rows + the Waiting line), tall enough to pass the 4/9 cap at
 *  320 × 568 — so the "pinned stays pinned" measurement has a pin region to scroll. Not Lane B's design. */
function LabPins() {
  const rows = ['Booking fee due in 2 days', 'Call time not set · 6 days to go', 'Quotation expires Friday', 'Change waiting for you', 'Forms: 2 questions open', 'Waiting on Lumière · their reply'];
  return (
    <div className="space-y-1 px-1 py-1" data-lab-pins="">
      {rows.map((r) => (
        <p key={r} className="rounded-xl bg-ink/[0.05] px-3 py-2.5 text-[13px] text-ink/80">
          (lab pin) {r}
        </p>
      ))}
    </div>
  );
}

export function LabPickedChat({ threadId, side, counterpartyLabel, actions, hostsFail = false, noMessages = false, solo = false, tallPins = false }: { threadId: string; side: 'couple' | 'vendor'; counterpartyLabel: string; actions: LabChatActions } & LabChatMode) {
  // 👥 The shipped `ChatHostStrip` under the pinned row on BOTH sides (the stream draws it when `hosts` is given). The
  // supplier sees the event's side; a host sees the shop too (as the real host embed does). "You" is the strip's own.
  // Order is the strip's own (`stripOrder`): Supplier · coordinator · You · the other hosts.
  const hosts = hostsFail ? null : solo ? (side === 'vendor' ? [MARIA] : [SHOP, MARIA]) : side === 'vendor' ? [MARIA, JOSE, PIA] : [SHOP, MARIA, JOSE, PIA];
  return (
    <div data-picked-lab-chat={side} className="flex min-h-[70dvh] flex-col">
      <ChatBox
        header={null}
        notice={<ChatSafetyBanner inBox />}
        composer={<ChatSendForm threadId={threadId} sendAction={actions.send} attachInputId={CHAT_ATTACH_INPUT_ID} userId={side === 'couple' ? LAB_USER : LAB_STAFF} />}
      >
        <ChatMessageStream
          flush
          dealEntry={dealEntryFor({ side, hasQuote: true })}
          threadId={threadId}
          initialMessages={noMessages ? [] : [...LAB_MESSAGES.map((m) => ({ ...m, thread_id: threadId })), labPrivate(threadId, side)]}
          currentUserId={side === 'couple' ? LAB_USER : LAB_STAFF}
          viewerRole={side}
          hosts={hosts}
          // 📞 The picked page's head calls, as the two thread pages pass them. A LAB stand-in: a booked sample with a
          // dummy number (no real person) — the pages pass the ONE booking check (`shopIsBookedOnEvent`), never a literal.
          headCalls={<BookedCallButtons booked phone="0917 000 0000" who={counterpartyLabel} />}
          // 👥 The ＋ and Leave are the event side's only — the supplier's chat passes neither.
          {...(side === 'couple' && actions.add && actions.leave ? { memberAdd: { candidates: LAB_ADDABLE, add: actions.add }, memberLeave: actions.leave } : {})}
          counterpartyLabel={counterpartyLabel}
          {...(tallPins ? { pins: <LabPins /> } : {})}
          senderNames={side === 'couple' ? { [LAB_STAFF]: 'Paolo' } : {}}
          lockHandshake={null}
          fileExpiry={{ eventDate: '2026-12-18', precision: 'day' }}
        />
      </ChatBox>
    </div>
  );
}
