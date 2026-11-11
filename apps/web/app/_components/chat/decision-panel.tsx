'use client';

/**
 * # THE OPENED DECISION (owner-approved prototype, 11 Nov 2026 — client-supplier-page.html "A · the opened decision").
 * Tapping a decision pin opens what it holds: the filed messages NEWEST FIRST (who wrote it · added by · when), an
 * Edit topic that saves in place (the house field — Enter keeps, Esc leaves it), and Close · settled beside it at equal widths. A filed
 * message swipes left to Remove (the shipped `SwipeToDelete`), and an Undo follows (it files it back).
 *
 * Every write is ONE call to its SECURITY DEFINER writer (lib/chat-decisions.ts); the page re-reads in place after.
 * 🔒 A refused read says "Couldn't load", never "Nothing filed yet" (a refusal must not render as emptiness).
 */
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, X } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { TypedRow } from '@/app/_components/form-row';
import { formatChatTimestamp } from '@/lib/chat';
import {
  DECISION_TITLE_MAX,
  fileMessage,
  loadFiledMessages,
  removeMessage,
  renameDecision,
  type FiledMessage,
} from '@/lib/chat-decisions';
import { createClient } from '@/lib/supabase/client';
import { formatCount } from '@/lib/format-number';

const UNDO_MS = 5000;

export function DecisionPanel({ topicId, title }: { topicId: string; title: string }) {
  const router = useRouter();
  const [filed, setFiled] = useState<FiledMessage[] | null | undefined>(undefined);
  const [me, setMe] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [line, setLine] = useState<{ text: string; undo?: () => void } | null>(null);
  const [pending, start] = useTransition();
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const read = useCallback(async () => {
    const supabase = createClient();
    const [rows, session] = await Promise.all([loadFiledMessages(supabase, topicId), supabase.auth.getSession()]);
    setMe(session.data.session?.user.id ?? null);
    setFiled(rows);
  }, [topicId]);

  useEffect(() => {
    void read();
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, [read]);

  const say = (text: string, undo?: () => void) => {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setLine({ text, undo });
    undoTimer.current = setTimeout(() => setLine(null), UNDO_MS);
  };

  const close = () =>
    start(async () => {
      const { data, error } = await createClient().rpc('chat_decision_set_closed', { p_topic_id: topicId, p_closed: true });
      if (error || (data !== 'ok' && data !== 'unchanged')) {
        say('Couldn’t save. Try again.');
        return;
      }
      // one-render: keep (client-write) — the close was an RPC in the browser; re-read so the pin leaves.
      router.refresh();
    });

  const remove = (m: FiledMessage) => {
    setFiled((cur) => (cur ? cur.filter((f) => f.messageId !== m.messageId) : cur));
    void removeMessage(createClient(), topicId, m.messageId).then((out) => {
      if (out !== 'ok' && out !== 'not_filed') {
        void read();
        say('Couldn’t take it out. Try again.');
        return;
      }
      say('Taken out of this decision', () => {
        void fileMessage(createClient(), topicId, m.messageId).then(() => void read());
      });
    });
  };

  const who = (id: string | null) => (id && id === me ? 'You' : 'They');

  return (
    <div className="grid gap-2 pb-2" data-decision-panel={topicId}>
      {editing ? (
        <div data-decision-topic-edit="">
          <TypedRow
            name="Topic"
            value={title}
            maxLength={DECISION_TITLE_MAX}
            openAsk={1}
            onKeep={async (text) => {
              const out = await renameDecision(createClient(), topicId, text);
              if (out === 'ok' || out === 'unchanged') {
                setEditing(false);
                if (out === 'ok') say('Topic saved · both sides see it');
                // one-render: keep (client-write) — the rename was an RPC in the browser; re-read so the pin's line moves.
                router.refresh();
                return { ok: true };
              }
              return { ok: false, error: out === 'empty' ? 'A topic needs a few words.' : out === 'closed' ? 'This decision is closed.' : null };
            }}
          />
        </div>
      ) : null}
      <p className="text-[13px] text-ink/60" data-decision-filed-count="">
        {filed === undefined
          ? 'Loading…'
          : filed === null
            ? 'Couldn’t load what is filed here.'
            : `${formatCount(filed.length)} message${filed.length === 1 ? '' : 's'} filed · newest first`}
      </p>
      {filed && filed.length > 0 ? (
        <ul className="grid gap-1.5" data-decision-filed="">
          {filed.map((f) => (
            <SwipeToDelete
              key={f.messageId}
              as="li"
              word="Remove"
              label="Remove from this decision"
              icon={X}
              onDelete={() => remove(f)}
            >
              <div className="grid gap-1 px-1 py-1.5">
                <p className={`whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-[15px] leading-snug ${f.senderUserId === me ? 'bg-sn-accent/[0.12]' : 'bg-ink/[0.06]'}`}>
                  {f.body ?? 'A message you can’t see here'}
                </p>
                <p className="text-[12px] text-ink/55">
                  {who(f.senderUserId)} wrote it · <b className="font-semibold text-ink/75">added by {f.addedByUserId === me ? 'you' : 'them'}</b> · {formatChatTimestamp(f.addedAt)}
                </p>
              </div>
            </SwipeToDelete>
          ))}
        </ul>
      ) : filed && filed.length === 0 ? (
        <p className="py-2 text-center text-[14px] text-ink/55">Nothing filed yet. Double-tap a message in the chat to add it here.</p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <ActionButton
          tone="neutral"
          icon={editing ? <X aria-hidden strokeWidth={1.9} /> : <Pencil aria-hidden strokeWidth={1.9} />}
          label={editing ? 'Done editing' : 'Edit topic'}
          disabled={pending}
          onClick={() => setEditing((e) => !e)}
        />
        <ActionButton tone="ok" main icon={<Check aria-hidden strokeWidth={1.9} />} label="Close · settled" disabled={pending} onClick={close} />
      </div>
      {line ? (
        <p role="status" className="flex items-center justify-center gap-3 text-[13px] text-ink/70" data-decision-line="">
          {line.text}
          {line.undo ? (
            <button
              type="button"
              className="sn-press min-h-11 px-2 font-semibold text-sn-accent"
              onClick={() => {
                line.undo?.();
                setLine(null);
              }}
            >
              Undo
            </button>
          ) : null}
        </p>
      ) : (
        <p className="text-center text-[12px] text-ink/50">Swipe a filed message left to take it out · Undo follows</p>
      )}
    </div>
  );
}
