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
//   4. An OPTIONAL paperclip file input (chat file sharing, PR 2). The chosen
//      file rides in the same FormData as `attachment`; the server validates
//      + uploads it to R2. The text-only path is untouched — send with no file
//      behaves exactly as before.

import { useRef, useState } from 'react';
import { Paperclip, Send, X } from 'lucide-react';
import { SubmitButton } from './submit-button';
import { trackFailure } from '@/lib/telemetry/track-error';
import { chatContactFilterEnabled } from '@/lib/chat-contact-filter-flag';
import { evaluateMessage, CONTACT_BLOCK_MESSAGE } from '@/lib/chat-contact-filter';
import { compressImageForWeb } from '@/lib/image-compress';
import {
  CHAT_ATTACHMENT_ACCEPT,
  chatAttachmentLimit,
  isCompressibleImage,
} from '@/lib/chat-attachment-limits';

type Props = {
  threadId: string;
  sendAction: (formData: FormData) => Promise<void>;
};

// The picker's list and the size ceilings are DERIVED from the one shared
// module the server enforces (lib/chat-attachment-limits.ts). They used to be
// hand-typed here, under a comment saying they were kept in sync by hand —
// which is how a picker comes to offer a type the server refuses, with a file
// that simply will not send as the only symptom.

export function ChatSendForm({ threadId, sendAction }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  // Off-platform-contact block message (chatroom blocked-rules). Shown inline
  // when the composer catches contact info BEFORE sending — instant feedback so
  // the sender edits without a server round-trip. The server re-checks
  // authoritatively (no-JS + native paths), so this is UX, not the gate.
  const [blockError, setBlockError] = useState<string | null>(null);

  const clearFile = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFileName(null);
    setFileError(null);
  };

  return (
    <form
      action={async (formData: FormData) => {
        // We strip `return_to` so the server action doesn't redirect — the
        // Realtime stream is now the source of truth for the painted UI.
        // The action still runs the insert + notification flow.
        formData.delete('return_to');

        // A message needs SOMETHING — text or a file. Bail on a truly-empty
        // submit so we don't round-trip a no-op (the server no-ops too).
        const bodyVal = (formData.get('body') as string | null)?.trim() ?? '';
        const fileVal = formData.get('attachment');
        const hasFile = fileVal instanceof File && fileVal.size > 0;
        if (!bodyVal && !hasFile) return;

        /* COMPRESS BEFORE IT LEAVES THE PHONE (owner 2026-09-09: "all files
           uploaded on chat should be compressed and minimum").

           A phone photo is 3–5 MB and becomes a few hundred KB. It happens in
           THIS browser, so it costs us no compute and it is dramatically faster
           to send on a venue's weak signal.

           ⚠ Only photographs. A PDF or Word contract is evidence and must
           arrive byte-for-byte; an animated GIF drawn to a canvas would come
           out a still. `isCompressibleImage` decides, not this call site.

           ⚠ AND IT FAILS OPEN, BY CONTRACT: `compressImageForWeb` returns the
           ORIGINAL file when it cannot help or cannot run. A browser without
           canvas support must still be able to send the picture — losing the
           bytes is a cost, losing the message is a defect. */
        if (hasFile && isCompressibleImage((fileVal as File).type)) {
          try {
            const smaller = await compressImageForWeb(fileVal as File);
            formData.set('attachment', smaller);
          } catch {
            // Keep the original. See the fail-open note above.
          }
        }

        // Chatroom blocked-rules — block off-platform contact info before it
        // ever leaves the browser (the server re-checks too). Keeps the text so
        // the sender can edit and resend.
        if (chatContactFilterEnabled() && bodyVal && evaluateMessage(bodyVal).blocked) {
          setBlockError(CONTACT_BLOCK_MESSAGE);
          return;
        }
        setBlockError(null);

        try {
          await sendAction(formData);
        } catch (err) {
          // Surface a minimal failure signal — no toast system in this app
          // yet, but at least keep the textarea's content + the chosen file so
          // the user can retry without redoing them.
          console.error('sendChatMessage failed', err);
          void trackFailure({
            eventType: 'BUTTON_FAIL',
            elementName: 'Send chat message',
            filePath: 'app/_components/chat-send-form.tsx',
            error: err,
            payload: { threadId, hadAttachment: hasFile },
          });
          return;
        }
        // Optimistic clear on success; the Realtime INSERT will paint the
        // outgoing bubble in the stream within a few hundred ms.
        if (textareaRef.current) {
          textareaRef.current.value = '';
        }
        clearFile();
        window.dispatchEvent(
          new CustomEvent('chat-stream:sent', { detail: { threadId } }),
        );
      }}
      className="flex flex-col gap-1.5"
    >
      <input type="hidden" name="thread_id" value={threadId} />

      {/* Chosen-file chip — shown once a file is picked, before send. */}
      {fileName ? (
        <div className="flex items-center gap-2 self-start rounded-full border border-ink/15 bg-ink/[0.04] py-1 pl-3 pr-1 text-xs text-ink/75">
          <Paperclip className="h-3.5 w-3.5 text-ink/50" strokeWidth={1.75} />
          <span className="max-w-[220px] truncate">{fileName}</span>
          <button
            type="button"
            onClick={clearFile}
            aria-label="Remove attachment"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full text-ink/50 hover:bg-ink/10 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      ) : null}
      {fileError ? (
        <p className="self-start text-xs text-terracotta" role="alert">
          {fileError}
        </p>
      ) : null}
      {blockError ? (
        <p
          className="self-stretch rounded-md border border-terracotta/30 bg-terracotta/5 px-3 py-2 text-xs text-terracotta-700"
          role="alert"
        >
          {blockError}
        </p>
      ) : null}

      <div className="flex items-end gap-2">
        {/* Paperclip attach button — opens the OS file picker. */}
        <label
          className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-ink/15 text-ink/60 hover:bg-ink/[0.04] hover:text-ink"
          title="Attach a file"
        >
          <span className="sr-only">Attach a file</span>
          <Paperclip className="h-4 w-4" strokeWidth={1.75} />
          <input
            ref={fileInputRef}
            type="file"
            name="attachment"
            accept={CHAT_ATTACHMENT_ACCEPT}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (!file) {
                clearFile();
                return;
              }
              // A photograph is judged against a far higher ceiling than a
              // document, because it is about to be compressed in this browser
              // before it uploads. Rejecting a 4 MB phone photo here would
              // refuse the most ordinary thing anyone sends.
              const limit = chatAttachmentLimit(file.type);
              if (file.size > limit.maxBytes) {
                // Reject early client-side; the server enforces this too.
                setFileError(limit.tooLargeMessage);
                if (fileInputRef.current) fileInputRef.current.value = '';
                setFileName(null);
                return;
              }
              setFileError(null);
              setFileName(file.name);
            }}
          />
        </label>

        <textarea
          ref={textareaRef}
          name="body"
          rows={2}
          maxLength={4000}
          placeholder="Type a message…"
          className="input-field min-h-[60px] flex-1 py-2"
          onInput={() => {
            if (blockError) setBlockError(null);
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
      </div>
    </form>
  );
}
