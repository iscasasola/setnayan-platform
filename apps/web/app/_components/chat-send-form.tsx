'use client';

// Thin client wrapper around the existing server-action send form.
//
// We deliberately keep `sendChatMessage` as the form action — that path is
// shared with the no-JS fallback, runs through the existing RLS-checked
// server logic, and emits notifications. All this component adds is:
//
//   1. A custom `chat-stream:input` window event on every keystroke so the
//      sibling <ChatMessageStream> can drive the presence-channel "typing"
//      flag without us reaching into its internal state.
//   2. A `chat-stream:sent` event on submit so the stream can immediately
//      flip the local user back to typing=false (no stale "still typing"
//      on the other side right after a message lands).
//   3. After a successful submission, we OPTIMISTICALLY clear the textarea
//      and prevent the default form redirect — the Realtime INSERT will
//      paint the message in the stream within ~500ms, so a full server
//      redirect+revalidate would just cause a jarring re-render. We still
//      let the server action run (the awaited promise) so notifications
//      and the thread's updated_at bump still happen.

import { useRef } from 'react';
import { Send } from 'lucide-react';
import { SubmitButton } from './submit-button';
import { trackFailure } from '@/lib/telemetry/track-error';

type Props = {
  threadId: string;
  sendAction: (formData: FormData) => Promise<void>;
};

export function ChatSendForm({ threadId, sendAction }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  return (
    <form
      action={async (formData: FormData) => {
        // We strip `return_to` so the server action doesn't redirect — the
        // Realtime stream is now the source of truth for the painted UI.
        // The action still runs the insert + notification flow.
        formData.delete('return_to');
        try {
          await sendAction(formData);
        } catch (err) {
          // Surface a minimal failure signal — no toast system in this app
          // yet, but at least keep the textarea's content so the user can
          // retry without retyping.
          console.error('sendChatMessage failed', err);
          void trackFailure({
            eventType: 'BUTTON_FAIL',
            elementName: 'Send chat message',
            filePath: 'app/_components/chat-send-form.tsx',
            error: err,
            payload: { threadId },
          });
          return;
        }
        // Optimistic clear on success; the Realtime INSERT will paint the
        // outgoing bubble in the stream within a few hundred ms.
        if (textareaRef.current) {
          textareaRef.current.value = '';
        }
        window.dispatchEvent(
          new CustomEvent('chat-stream:sent', { detail: { threadId } }),
        );
      }}
      className="flex items-end gap-2"
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <textarea
        ref={textareaRef}
        name="body"
        rows={2}
        required
        maxLength={4000}
        placeholder="Type a message…"
        className="input-field min-h-[60px] flex-1 py-2"
        onInput={() => {
          window.dispatchEvent(
            new CustomEvent('chat-stream:input', { detail: { threadId } }),
          );
        }}
      />
      <SubmitButton
        aria-label="Send"
        pendingLabel=""
        className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-mulberry text-cream hover:bg-mulberry-600 disabled:opacity-70"
      >
        <Send className="h-4 w-4" strokeWidth={1.75} />
      </SubmitButton>
    </form>
  );
}
