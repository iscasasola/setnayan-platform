'use client';

/**
 * 🚪 LEAVE THIS CHAT? · JOIN THIS CHAT AGAIN? (owner, 9 Nov — replaces the inline "Leave chat | Cancel" row).
 *
 *   · Leave  — a host taps their OWN face → the house confirm box (`ConfirmDialog`, centred, the screen dark behind),
 *              "Leave this chat?", an optional "Your note for leaving" (≤ 200; Enter = Leave), and one row at equal
 *              widths: Leave (danger) · Not now. The note goes to the writer and is shown to nobody else; the line is
 *              only "Marco left".
 *   · Join   — the chat stays in their Chats list, greyed; a tap asks "Join this chat again?" with "You left on Nov 9
 *              — “note”" (the note part only when there is one) and Join chat (main) · Not now. A refused read of when
 *              they left says it could not load — never an invented date. Joining posts "Marco joined".
 *
 * No new modal: both are the house `ConfirmDialog` (`equalRow`). 🔒 lib/a-supplier-chat-starts-small.test.ts
 */
import { useState } from 'react';
import { LogIn, LogOut } from 'lucide-react';
import { ConfirmDialog } from '@/app/_components/confirm-dialog';
import { LEAVE_NOTE_MAX, leaveNoteFrom, leftOnLine, type ChatLeftRead } from '@/lib/chat-members';

export function LeaveNoteField({ value, onChange, onEnter }: { value: string; onChange: (v: string) => void; onEnter: () => void }) {
  return (
    <label className="mt-1 block text-left" data-chat-leave-note="">
      <span className="text-[13px] text-ink/70">Your note for leaving <span className="text-ink/45">(optional)</span></span>
      <input
        type="text"
        maxLength={LEAVE_NOTE_MAX}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        onKeyDown={(e) => {
          // Enter = Leave (owner); the IME's confirming Enter is not a send.
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            onEnter();
          }
        }}
        enterKeyHint="done"
        className="mt-1 block h-11 w-full rounded-xl border-0 bg-ink/[0.06] px-3 text-[15px] text-ink outline-none placeholder:text-ink/45 focus:ring-2 focus:ring-sn-accent/30"
        placeholder="Only you will see this"
      />
    </label>
  );
}

export function LeaveChatDialog({
  open,
  onLeave,
  onCancel,
}: {
  open: boolean;
  onLeave: (note: string | null) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [note, setNote] = useState('');
  const leave = () => {
    const n = leaveNoteFrom(note);
    setNote('');
    void onLeave(n);
  };
  return (
    <ConfirmDialog
      open={open}
      title="Leave this chat?"
      body={
        <>
          <p>You stop seeing it until you join again. Only “left” is shown to the others.</p>
          <LeaveNoteField value={note} onChange={setNote} onEnter={leave} />
        </>
      }
      confirmLabel="Leave"
      cancelLabel="Not now"
      destructive
      equalRow
      confirmIcon={LogOut}
      onConfirm={leave}
      onCancel={() => {
        setNote('');
        onCancel();
      }}
    />
  );
}

/** The join pop-up's words — exported so a guard can read them without opening a `<dialog>`. */
export function joinChatBody(left: ChatLeftRead): string {
  return left === 'unread' ? 'Couldn’t load when you left this chat.' : leftOnLine(left);
}

export function JoinChatDialog({
  open,
  left,
  onJoin,
  onCancel,
}: {
  open: boolean;
  left: ChatLeftRead;
  onJoin: () => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      open={open}
      title="Join this chat again?"
      body={<p data-chat-join-left="">{joinChatBody(left)}</p>}
      confirmLabel="Join chat"
      cancelLabel="Not now"
      equalRow
      confirmIcon={LogIn}
      onConfirm={() => void onJoin()}
      onCancel={onCancel}
    />
  );
}
