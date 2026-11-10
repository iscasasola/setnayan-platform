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
import { TypedRow } from '@/app/_components/form-row';
import { LEAVE_NOTE_MAX, leaveNoteFrom, leftOnLine, type ChatLeftRead } from '@/lib/chat-members';

/** "Your note for leaving" — the house Field template (`TypedRow`, `lint:field-template`), one line, ≤ 200; Enter keeps
 *  the words AND leaves (owner: "Enter = Leave"). Only the writer ever sees it. */
export function LeaveNoteField({ value, onChange, onEnter }: { value: string; onChange: (v: string) => void; onEnter: (text: string) => void }) {
  return (
    <div className="mt-1 text-left" data-chat-leave-note="">
      <TypedRow
        name="Your note for leaving"
        value={value}
        empty="Optional"
        placeholder="Only you will see this"
        maxLength={LEAVE_NOTE_MAX}
        onType={onChange}
        onKeep={(t) => onChange(t)}
        onEnter={onEnter}
        data="chat-leave-note"
      />
    </div>
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
  // Enter in the note hands its words straight in (the kept value may not have rendered yet); the Leave button reads state.
  const leave = (typed?: string) => {
    const n = leaveNoteFrom(typeof typed === 'string' ? typed : note);
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
