'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { useStaySubmit } from '@/app/_components/stay-form';
import { isCoarsePointer, shouldSendOnEnter } from '@/lib/chat-enter-to-send';
import { SAMAHAN_MESSAGE_ID_FIELD } from '@/lib/samahan-message-id';
import { postSamahanMessage } from '../../actions';

/** A fresh id for the next message — minted once per message, so a repeated send of the SAME message is one row. */
const freshId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null;

/** The tallest the box grows (≈ 5 lines) before it scrolls inside. */
const MAX_BOX_PX = 120;

/**
 * 💬 THE GROUP CHAT'S COMPOSER (walk 13 Nov 2026, P1 — F-W3-12 and the composer findings).
 *
 * The walk measured, on the old one-line box: Enter pressed twice fast sent the message TWICE (both saved); Shift+Enter
 * sent instead of starting a new line; and text typed while a message was sending ran into the next one ("W3 reply
 * from 2line two"). So:
 *   · ENTER SENDS, SHIFT+ENTER IS A NEW LINE — through the house's ONE rule (`shouldSendOnEnter`, the same the event
 *     chat's `ChatSendForm` uses; on a touch keyboard Return is a new line and the arrow sends).
 *   · THE BOX GROWS with what is typed (a textarea, up to ~5 lines, then it scrolls).
 *   · ONE SEND PER MESSAGE — twice over: a send is refused while one is in flight (`pending`), and every message
 *     carries its own id (`message_id`, minted here, UNIQUE in `samahan_messages`), so even a second request for the
 *     same message lands as the same row — the server answers a duplicate as "already sent".
 *   · A FRESH BOX AFTER EACH SEND: the box empties the moment the message leaves; whatever is typed while it sends is
 *     the NEXT message. A refused send puts its words back (if the box is still empty) with the refusal under it.
 */
export function GroupComposer({ communityId }: { communityId: string }) {
  const [text, setText] = useState('');
  const [messageId, setMessageId] = useState<string | null>(freshId);
  const lastSent = useRef('');
  const box = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const stay = useStaySubmit('accGroup.postSamahanMessage', () => setMessageId(freshId()), false);

  // The box grows with its words (and shrinks back when emptied).
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_BOX_PX)}px`;
  }, [text]);

  // A refused send: its words come back, unless something new was typed meanwhile.
  const refused = stay.refusal !== null;
  useLayoutEffect(() => {
    if (refused && lastSent.current) setText((cur) => (cur ? cur : lastSent.current));
  }, [refused]);

  const send = () => {
    if (stay.pending || !text.trim()) return;
    formRef.current?.requestSubmit();
  };

  return (
    <form
      ref={formRef}
      action={postSamahanMessage as unknown as (fd: FormData) => void}
      data-stay="accGroup.postSamahanMessage"
      aria-busy={stay.pending || undefined}
      onSubmit={(e) => {
        if (stay.pending || !text.trim()) {
          e.preventDefault();
          return;
        }
        // The form data is read from the box NOW (inside `stay.onSubmit`); the box empties right after, so what is
        // typed while this message travels is the next one.
        lastSent.current = text;
        stay.onSubmit(e);
        setText('');
      }}
      className="flex h-full min-w-0 flex-1 items-center gap-1 pl-3.5 pr-1"
      data-group-send-form=""
    >
      <input type="hidden" name="community_id" value={communityId} />
      {messageId ? <input type="hidden" name={SAMAHAN_MESSAGE_ID_FIELD} value={messageId} /> : null}
      <textarea
        // field-ok: the group chat's composer in the ThumbRow (a chat composer, another template — rule 2 of lint-field-template)
        ref={box}
        name="body"
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (shouldSendOnEnter(e.nativeEvent, { coarsePointer: isCoarsePointer() })) {
            e.preventDefault();
            send();
          }
        }}
        maxLength={2000}
        autoComplete="off"
        enterKeyHint="send"
        placeholder="Message the group"
        aria-label="Message the group"
        className="block max-h-[120px] min-w-0 flex-1 resize-none self-center bg-transparent py-2 text-[15px] leading-snug text-ink outline-none placeholder:text-ink/45"
        data-group-composer=""
      />
      {text.trim() ? (
        <span className="shrink-0" data-group-send="">
          <ActionButton tone="brand" filled iconOnly icon={ArrowUp} label="Send" type="submit" waiting={stay.pending} />
        </span>
      ) : null}
      {stay.refusal}
    </form>
  );
}
