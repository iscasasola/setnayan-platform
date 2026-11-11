'use client';

/**
 * # THE OPENED DECISION (owner-approved prototype, 11 Nov 2026 — client-supplier-page.html "A · the opened decision").
 * Tapping a decision pin opens what it holds: the filed messages NEWEST FIRST (who wrote it · added by · when), an
 * Edit topic that saves in place (the house field — Enter keeps, Esc leaves it), and Close · settled beside it at equal widths. A filed
 * message swipes left to Remove (the shipped `SwipeToDelete`), and an Undo follows (it files it back).
 *
 * It RISES OVER THE WHOLE CHAT (the prototype's opened decision): ← back · "Decision · you opened it" · the topic, then
 * "# N messages filed · newest first" ⓘ, the filed messages, and Edit topic | Close · settled pinned to the foot.
 *
 * Every write is ONE call to its SECURITY DEFINER writer (lib/chat-decisions.ts); the page re-reads in place after.
 * 🔒 A refused read is an ALERT with Try again — never "Nothing filed yet", and never a line that reads like content.
 * `lab` (dev labs only — no database there) hands fixture rows in place of the read.
 */
import { useCallback, useContext, useEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Hash, Pencil, RotateCw, X } from 'lucide-react';

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
import { usePortalHost } from '@/lib/use-portal-host';
import { formatCount } from '@/lib/format-number';
import { InfoTip } from '@/app/_components/info-tip';
import { PinBodyClose } from './chat-pins';

const UNDO_MS = 5000;

export function DecisionPanel({
  topicId,
  title,
  kicker,
  lab,
}: {
  topicId: string;
  title: string;
  /** "Decision · you opened it" — the pin's own kicker, repeated on the risen screen. */
  kicker: string;
  /** Dev labs only: fixture rows and the viewer, in place of the database read. */
  lab?: { filed: FiledMessage[]; me: string };
}) {
  const router = useRouter();
  const back = useContext(PinBodyClose);
  const [filed, setFiled] = useState<FiledMessage[] | null | undefined>(lab ? lab.filed : undefined);
  const [me, setMe] = useState<string | null>(lab ? lab.me : null);
  const [editing, setEditing] = useState(false);
  const [line, setLine] = useState<{ text: string; undo?: () => void } | null>(null);
  const [pending, start] = useTransition();
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const read = useCallback(async () => {
    if (lab) return;
    const supabase = createClient();
    const [rows, session] = await Promise.all([loadFiledMessages(supabase, topicId), supabase.auth.getSession()]);
    setMe(session.data.session?.user.id ?? null);
    setFiled(rows);
  }, [topicId, lab]);

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

  const editRow = editing ? (
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
  ) : null;

  // Portalled to <body>: the chat frame's transformed ancestors would otherwise capture `fixed` (and the picked client's
  // thumb row sits at --sn-z-pop — this rises over it at the modal layer).
  const host = usePortalHost();
  if (!host) return null;
  return createPortal(
    <section
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[var(--sn-z-modal)] flex flex-col bg-cream text-ink [animation:sn-sheet-rise_var(--sn-pill-dur)_var(--sn-ease-rise)_both] motion-reduce:animate-none"
      data-decision-panel={topicId}
    >
      <header className="shrink-0 border-b border-ink/10 px-4 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="flex items-start gap-2">
          {back ? (
            <button
              type="button"
              onClick={back}
              aria-label="Back to the chat"
              className="sn-press -ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink/70"
            >
              <ArrowLeft aria-hidden className="h-5 w-5" strokeWidth={1.9} />
            </button>
          ) : null}
          <div className="grid min-w-0 flex-1 pt-1">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/55">{kicker}</span>
            <h2 className="break-words text-[18px] font-semibold leading-snug">{title}</h2>
          </div>
        </div>
        <div className="mt-1 flex min-h-11 items-center gap-2 text-[14px] text-ink/65" data-decision-filed-count="">
          <Hash aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.9} />
          <InfoTip
            label={
              filed === undefined
                ? 'Reading what is filed…'
                : filed === null
                  ? 'Not read'
                  : `${formatCount(filed.length)} message${filed.length === 1 ? '' : 's'} filed · newest first`
            }
            ariaLabel="About filing"
            align="end"
            className="min-w-0 flex-1"
          >
            Double-tap a message in the chat to file it here. Both sides see what is filed and who added it.
          </InfoTip>
        </div>
        {editRow}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2">
        {filed === null ? (
          <div role="alert" className="grid justify-items-center gap-2 py-8 text-center" data-decision-refused="">
            <p className="text-[15px] font-semibold text-danger-900">Couldn’t load what is filed here.</p>
            <p className="text-[13px] text-ink/60">Nothing was removed — the read failed.</p>
            <ActionButton tone="neutral" icon={<RotateCw aria-hidden strokeWidth={1.9} />} label="Try again" onClick={() => void read()} />
          </div>
        ) : filed && filed.length > 0 ? (
          <ul className="grid" data-decision-filed="">
            {filed.map((f) => (
              <SwipeToDelete
                key={f.messageId}
                as="li"
                word="Remove"
                label="Remove from this decision"
                icon={X}
                onDelete={() => remove(f)}
              >
                <div className="grid gap-1 border-b border-ink/[0.07] px-1 py-3">
                  <p
                    className={`whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-[16px] leading-snug ${f.senderUserId === me ? 'bg-sn-accent/[0.12]' : 'bg-ink/[0.06]'}`}
                  >
                    {f.body ?? 'A message you can’t see here'}
                  </p>
                  <p className="text-[13px] text-ink/55">
                    {who(f.senderUserId)} wrote it ·{' '}
                    <b className="font-semibold text-ink/75">added by {f.addedByUserId === me ? 'you' : 'them'}</b> ·{' '}
                    {formatChatTimestamp(f.addedAt)}
                  </p>
                </div>
              </SwipeToDelete>
            ))}
          </ul>
        ) : filed && filed.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-ink/55">Nothing filed yet. Double-tap a message in the chat to add it here.</p>
        ) : null}
      </div>

      <footer className="grid shrink-0 gap-2 border-t border-ink/10 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3">
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
      </footer>
    </section>,
    host,
  );
}
