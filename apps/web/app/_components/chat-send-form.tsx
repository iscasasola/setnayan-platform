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
//   5. (2026-10-28 · chat prototype frame B) THE MESSENGER ROW: ＋ · camera ·
//      photo · a round field · send. Camera and photo are SHORTCUTS into the
//      same `attachment` input (the file is handed over with a DataTransfer),
//      so every photo still goes through the one compression below. And the
//      message SHOWS AT ONCE: Send paints a faded "Sending…" bubble in the
//      stream before the server answers (`lib/chat-optimistic.ts`), and a send
//      that fails says "Not sent · Try again" in words — never a silent loss.

import { useRef, useState, type ReactNode } from 'react';
import { Camera, ImageIcon, Paperclip, SendHorizontal, X } from 'lucide-react';
import { SubmitButton } from './submit-button';
import { trackFailure } from '@/lib/telemetry/track-error';
import { chatContactFilterEnabled } from '@/lib/chat-contact-filter-flag';
import { evaluateMessage, CONTACT_BLOCK_MESSAGE } from '@/lib/chat-contact-filter';
import { prepareChatFile, uploadPreparedChatFile } from '@/lib/chat-file-prepare';
import { CHAT_ATTACHMENT_ACCEPT, chatAttachmentLimit } from '@/lib/chat-attachment-limits';
import { shouldSendOnEnter, isCoarsePointer } from '@/lib/chat-enter-to-send';
import { useTapAway } from '@/app/_components/typing-band';
import {
  CHAT_PENDING_EVENT,
  CHAT_SETTLED_EVENT,
  forgetRetry,
  newTempId,
  registerRetry,
  type PendingSend,
} from '@/lib/chat-optimistic';

/** What the camera and photo shortcuts offer — DERIVED from the one accepted list, so they never offer a type the
 *  server refuses (a photo or a video, whichever of the two the list carries). */
const MEDIA_ACCEPT = CHAT_ATTACHMENT_ACCEPT.split(',')
  .filter((t) => t.startsWith('image/') || t.startsWith('video/'))
  .join(',');

type Props = {
  threadId: string;
  sendAction: (formData: FormData) => Promise<void>;
  /**
   * ONE control at the start of the row, always shown — the supplier's grey ＋ that opens the Tools sheet (simpler
   * supplier dashboard step 4, 2026-10-14: "＋ · message · Send"). It must be a `type="button"`, never a form.
   */
  lead?: ReactNode;
  /**
   * The paperclip moves into the ＋ sheet ("Share a file or the contract"): the visible button is dropped, the file
   * input stays — with this id, so the sheet's row opens the SAME picker and the file still rides this form's
   * `attachment` with every limit and the compression it has. Absent → the paperclip, unchanged (the couple's page).
   */
  attachInputId?: string;
  /**
   * The sender — the chat-files rule (C2) uploads a file into the sender's own folder BEFORE the send
   * (`uploadPreparedChatFile`), because a big video or document cannot ride the send action's body.
   */
  userId?: string;
};

// The picker's list and the size ceilings are DERIVED from the one shared
// module the server enforces (lib/chat-attachment-limits.ts). They used to be
// hand-typed here, under a comment saying they were kept in sync by hand —
// which is how a picker comes to offer a type the server refuses, with a file
// that simply will not send as the only symptom.

export function ChatSendForm({ threadId, sendAction, lead, attachInputId, userId }: Props) {
  const [hasDraft, setHasDraft] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  // Guards Enter-to-send against a double submit: a fast double-tap of Enter
  // (or a second keydown that lands while the form action is still awaiting
  // compression or sendAction) must not fire requestSubmit() twice. Set once
  // the message is known non-empty, cleared on the contact-block return and in
  // `finally` after sendAction, whether it succeeded or failed.
  const sendPendingRef = useRef(false);
  // Off-platform-contact block message (chatroom blocked-rules). Shown inline
  // when the composer catches contact info BEFORE sending — instant feedback so
  // the sender edits without a server round-trip. The server re-checks
  // authoritatively (no-JS + native paths), so this is UX, not the gate.
  const [blockError, setBlockError] = useState<string | null>(null);
  /* ⌨ THE COMPOSER RIDES WITH NO BAND (owner 2026-10-24, on the band's "Typing · …" + ✓ Done: *"can this be gone? just
     tap away and keyboard should disappear"*). The row stays whole (＋ · message · Send): Send is its verb and the
     phone's Enter is a new line; a tap or a drag on the thread — or Escape — leaves the box (`useTapAway`), so the
     keyboard closes. Supersedes the composer's "Typing · Message" band of #6860. */
  const [typing, setTyping] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  useTapAway(formRef, typing);

  const clearFile = () => {
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFileName(null);
    setFileError(null);
  };

  /** Judge a picked file against its ceiling and show its chip — shared by the ＋ sheet's picker and the shortcuts. */
  const acceptFile = (file: File | null): boolean => {
    if (!file) {
      clearFile();
      return false;
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
      return false;
    }
    setFileError(null);
    setFileName(file.name);
    return true;
  };

  /** 📷 / 🖼 shortcuts: hand the picked file to the ONE `attachment` input, so it rides the same path. */
  const takeShortcut = (input: HTMLInputElement) => {
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file || !fileInputRef.current) return;
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInputRef.current.files = dt.files;
    } catch {
      setFileError('This browser couldn’t attach that. Use ＋ › Share a file.');
      return;
    }
    acceptFile(file);
  };
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const photoRef = useRef<HTMLInputElement | null>(null);

  /** Send one FormData and say how it went — the first try and every Try again run through here. */
  const deliver = async (formData: FormData, pending: PendingSend, hasFile: boolean) => {
    const settle = (ok: boolean, reason?: string) =>
      window.dispatchEvent(new CustomEvent(CHAT_SETTLED_EVENT, { detail: { tempId: pending.tempId, threadId, ok, reason } }));
    const again = () =>
      registerRetry(pending.tempId, () => {
        window.dispatchEvent(new CustomEvent(CHAT_PENDING_EVENT, { detail: { ...pending, state: 'sending', at: Date.now() } }));
        void deliver(formData, pending, hasFile);
      });
    /* 🗂 EVERY FILE GOES THROUGH THE ONE HELPER (owner 2026-10-28: "alway compress files when sending on chat. never
       keep original size"; C2 `lib/chat-file-prepare.ts`): compressed (a photo always, a video always — an
       uncompressible video is REFUSED), judged, PUT to the sender's own folder, and the send carries only its ref.
       There is no raw-File branch: the picked File never rides the form. A refusal is said in words. */
    const raw = formData.get('attachment');
    formData.delete('attachment');
    if (raw instanceof File && raw.size > 0) {
      const prep = await prepareChatFile(raw);
      if (!prep.ok) {
        settle(false, prep.message);
        return;
      }
      if (!userId) {
        settle(false, 'Couldn’t send your file. Please reload and try again.');
        return;
      }
      const up = await uploadPreparedChatFile({ threadId, userId, prepared: prep.prepared });
      if (!up.ok) {
        formData.set('attachment', raw); // a Try again prepares it once more
        again();
        settle(false, up.message);
        return;
      }
      formData.set('attachment_ref', up.ref);
      formData.set('attachment_ref_name', up.name);
    }
    try {
      await sendAction(formData);
    } catch (err) {
      console.error('sendChatMessage failed', err);
      void trackFailure({
        eventType: 'BUTTON_FAIL',
        elementName: 'Send chat message',
        filePath: 'app/_components/chat-send-form.tsx',
        error: err,
        payload: { threadId, hadAttachment: hasFile },
      });
      again();
      settle(false);
      return;
    }
    forgetRetry(pending.tempId);
    settle(true);
  };

  return (
    <form
      ref={formRef}
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

        // From here until the send settles, a second Enter is a double send —
        // the photo compression below is awaited too, not only sendAction.
        sendPendingRef.current = true;

        // Compression happens in `deliver`, through the chat-files helper (C2) — after the bubble is already on screen.

        // Chatroom blocked-rules — block off-platform contact info before it
        // ever leaves the browser (the server re-checks too). Keeps the text so
        // the sender can edit and resend.
        if (chatContactFilterEnabled() && bodyVal && evaluateMessage(bodyVal).blocked) {
          setBlockError(CONTACT_BLOCK_MESSAGE);
          sendPendingRef.current = false;
          return;
        }
        setBlockError(null);

        // ⚡ IT SHOWS AT ONCE: the stream paints this, faded, before the server answers; the field clears now.
        const pending: PendingSend = {
          tempId: newTempId(),
          threadId,
          body: bodyVal,
          fileName: hasFile ? (formData.get('attachment') as File).name : null,
          at: Date.now(),
          state: 'sending',
        };
        window.dispatchEvent(new CustomEvent(CHAT_PENDING_EVENT, { detail: pending }));
        if (textareaRef.current) {
          textareaRef.current.value = '';
          textareaRef.current.style.height = '';
        }
        setHasDraft(false);
        // The file chip goes, but the picked file stays inside `formData` for a Try again.
        if (fileInputRef.current) fileInputRef.current.value = '';
        setFileName(null);
        window.dispatchEvent(
          new CustomEvent('chat-stream:sent', { detail: { threadId } }),
        );
        // Not awaited: the composer is free for the next message at once (Messenger's pace); each send settles itself.
        sendPendingRef.current = false;
        void deliver(formData, pending, hasFile);
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

      <div className="flex items-end gap-0.5" data-chat-composer-row="">
        {lead ?? null}
        {/* Paperclip attach button — opens the OS file picker. With `attachInputId` the button is gone (the ＋ sheet's
            "Share a file" opens the picker) but the input stays, clipped, so the picked file still rides this form. */}
        <label
          className={
            attachInputId
              ? 'sr-only'
              : 'inline-flex h-11 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-sn-accent hover:bg-ink/[0.05]'
          }
          title="Share a file"
        >
          <span className="sr-only">Share a file</span>
          <Paperclip className="h-5 w-5" strokeWidth={1.9} />
          <input
            ref={fileInputRef}
            id={attachInputId}
            type="file"
            name="attachment"
            accept={CHAT_ATTACHMENT_ACCEPT}
            className="sr-only"
            onChange={(e) => {
              acceptFile(e.target.files?.[0] ?? null);
            }}
          />
        </label>
        {/* 📷 · 🖼 — Messenger's two shortcuts (prototype frame B). They step aside while a message is being written,
            so the field takes their room; both hand the file to the ONE input above. */}
        {!hasDraft ? (
          <>
            <label className="inline-flex h-11 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-sn-accent hover:bg-ink/[0.05]" title="Camera" data-chat-camera="">
              <span className="sr-only">Camera</span>
              <Camera aria-hidden className="h-[22px] w-[22px]" strokeWidth={1.9} />
              <input ref={cameraRef} type="file" accept={MEDIA_ACCEPT} capture="environment" className="sr-only" onChange={(e) => takeShortcut(e.currentTarget)} />
            </label>
            <label className="inline-flex h-11 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-sn-accent hover:bg-ink/[0.05]" title="Photo" data-chat-photo="">
              <span className="sr-only">Photo</span>
              <ImageIcon aria-hidden className="h-[22px] w-[22px]" strokeWidth={1.9} />
              <input ref={photoRef} type="file" accept={MEDIA_ACCEPT} className="sr-only" onChange={(e) => takeShortcut(e.currentTarget)} />
            </label>
          </>
        ) : null}

        <textarea
          ref={textareaRef}
          name="body"
          rows={1}
          maxLength={4000}
          placeholder="Message"
          aria-label="Message"
          className="mx-1 my-[3px] max-h-36 min-h-[38px] min-w-0 flex-1 resize-none rounded-[19px] border-0 bg-ink/[0.06] px-3.5 py-[9px] text-[15px] leading-5 text-ink outline-none placeholder:text-ink/45 focus:ring-2 focus:ring-sn-accent/30"
          data-rides=""
          onFocus={() => setTyping(true)}
          onBlur={() => setTyping(false)}
          onInput={(e) => {
            const el = e.currentTarget;
            setHasDraft(el.value.trim().length > 0);
            // Grows with the words, up to ~6 lines, then scrolls (Messenger's field).
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
            if (blockError) setBlockError(null);
            window.dispatchEvent(
              new CustomEvent('chat-stream:input', { detail: { threadId } }),
            );
          }}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter starts a new line — the standard chat
            // convention. shouldSendOnEnter also holds back for IME
            // composition (Filipino/Japanese/Chinese keyboards confirm a word
            // with Enter), any modifier, and a coarse-pointer (touch) device,
            // where Return must stay a newline since there is no Shift+Enter
            // on an on-screen keyboard.
            const shouldSend = shouldSendOnEnter(
              {
                key: e.key,
                shiftKey: e.shiftKey,
                isComposing: e.nativeEvent.isComposing,
                keyCode: e.keyCode,
                altKey: e.altKey,
                ctrlKey: e.ctrlKey,
                metaKey: e.metaKey,
              },
              { coarsePointer: isCoarsePointer() },
            );
            if (!shouldSend) return;
            e.preventDefault();
            if (sendPendingRef.current) return;
            e.currentTarget.form?.requestSubmit();
          }}
        />
        <SubmitButton
          aria-label="Send"
          pendingLabel=""
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sn-accent hover:bg-ink/[0.05] disabled:opacity-60"
        >
          <SendHorizontal className="h-[22px] w-[22px]" strokeWidth={1.9} />
        </SubmitButton>
      </div>
    </form>
  );
}
