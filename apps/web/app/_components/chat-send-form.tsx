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
//   6. (2026-11-19 · "MESSAGE ⇄ WHISPER APPROVED", drawing `prototypes/chat_send_to_private_2026-11-19.html`) ONE BOX:
//      the ＋ sits inside its left end and Send inside its right end, and Send is ink at rest. On a HOST's composer
//      (`whisper` given) dragging the BOX right — never Send — turns Whisper on: the next lines reach the co-hosts
//      only, the supplier never. It stays on until the box is dragged again, and the switch never sends. The 🔒 button
//      is gone there (a face in the strip is still private to one person). The rules are `lib/chat-whisper.ts`.

import { CHAT_SENT_AS_FIELD, type ChatSentAs } from '@/lib/chat-sent-as';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Camera, ImageIcon, Lock, Paperclip, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { CHAT_PRIVATE_FIELD, PRIVATE_BOX_FILL, PRIVATE_BOX_OUTLINE, PRIVATE_FOCUS_RING, PRIVATE_MARK, PRIVATE_WORDS_ONLY_MESSAGE, joinNames, privateBoxPlaceholder } from '@/lib/chat-private';
import { setPrivateTo, useChatPeople, usePrivateReply, usePrivateTo } from '@/app/_components/chat/private-to';
import { PrivatePeopleList } from '@/app/_components/chat/private-people';
import { setWhisper, useWhisper } from '@/app/_components/chat/whisper-mode';
import { WhisperSendIcon } from '@/app/_components/chat/whisper-send-icon';
import { ConfirmDialog } from '@/app/_components/confirm-dialog';
import {
  CHAT_WHISPER_FIELD,
  LEFT_WHISPER_ASK,
  MESSAGE_PLACEHOLDER,
  WHISPER_NOBODY_LINE,
  WHISPER_OFF_LINE,
  WHISPER_OFF_LINE_STAY_MS,
  WHISPER_ON_LINE,
  WHISPER_PLACEHOLDER,
  WHISPER_WORDS_ONLY_MESSAGE,
  dragFollowPx,
  dragSwitches,
  dragVerdict,
  everyoneWillSeeLine,
  leftWhisperAskBody,
} from '@/lib/chat-whisper';
import { SubmitButton } from './submit-button';
import { pressMs } from './press-feel';
import { usePrefersReducedMotion } from '@/lib/use-responsive';
import { trackFailure } from '@/lib/telemetry/track-error';
import { chatContactFilterEnabled } from '@/lib/chat-contact-filter-flag';
import { evaluateMessage, CONTACT_BLOCK_MESSAGE } from '@/lib/chat-contact-filter';
import { prepareChatFile, uploadPreparedChatFile } from '@/lib/chat-file-prepare';
import { CHAT_ATTACHMENT_ACCEPT, chatAttachmentLimit } from '@/lib/chat-attachment-limits';
import { CHAT_CAMERA_INPUT_ID, CHAT_PHOTO_INPUT_ID } from '@/lib/chat-attach-input-id';
import { shouldSendOnEnter, isCoarsePointer } from '@/lib/chat-enter-to-send';
import { useTapAway } from '@/app/_components/typing-band';
import { SlashList } from '@/app/_components/chat/slash-list';
import { filterSlash, plusGate, slashPick, slashQuery, PLUS_CARD_TITLE, RISING_DRAFTS, type SlashRow } from '@/lib/chat-plus';
import { PLUS_DRAFT_ANCHOR, jumpTo, patchPlus, usePlus } from '@/lib/chat-plus-store';
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

/** A visible 📷 / 🖼 shortcut (only on a composer with no ＋). */
const SHORTCUT = 'inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-sn-accent hover:bg-ink/[0.05]';

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
  /**
   * 🏪 Whose screen this composer is on (owner, 11 Nov — `lib/chat-sent-as.ts`). The supplier's passes `'vendor'`, so a
   * login that also hosts the event still speaks as the SHOP here. The host's passes nothing (the old derivation).
   */
  sentAs?: ChatSentAs;
  /**
   * 💸 WORDS ONLY WHILE A TOP-UP IS OVERDUE (owner 2026-11-12, booking-fee top-up; prototype "New inquiry · text only"):
   * the supplier's event is locked by an unsettled booking-fee top-up, so the message box keeps WORDS — no ＋, no 🔒,
   * no "/", no file. The string is why, said under the box ("Settle ₱X booking fee to use this"). Absent → as shipped.
   */
  wordsOnly?: string | null;
  /**
   * 🤫 MESSAGE ⇄ WHISPER (DECISION_LOG 2026-11-19) — passed ONLY by the host's thread page, in a chat with a supplier.
   * `supplierName` is the name the mis-send reminder says ("Everyone will see this, including Mang Ben."); `coHosts` is
   * how many OTHER hosts are in this chat now (the people a whisper reaches — the server decides the list again at
   * Send). Absent → no drag, no whisper (the supplier's composer, a group chat): the box is exactly as before.
   */
  whisper?: { supplierName: string; coHosts: number } | null;
};

// The picker's list and the size ceilings are DERIVED from the one shared
// module the server enforces (lib/chat-attachment-limits.ts). They used to be
// hand-typed here, under a comment saying they were kept in sync by hand —
// which is how a picker comes to offer a type the server refuses, with a file
// that simply will not send as the only symptom.

export function ChatSendForm({ threadId, sendAction, lead, attachInputId, userId, sentAs, wordsOnly = null, whisper = null }: Props) {
  const feeWordsOnly = Boolean(wordsOnly);
  // 🔒 MESSAGING ONE PERSON PRIVATELY (DECISION_LOG 2026-11-09 🔒), set by a face in the host strip. While it is on the message is
  // WORDS ONLY (owner, 9 Nov: "private messages are just words. everything else is public."): the ＋ and every attach
  // (paperclip · camera · photo) are not drawn, and a file already picked is let go. × on the chip → everyone again.
  // 🔒 TWO DOORS (owner, 12 Nov): a face in the strip (one person) or the 🔒's ticks (several) — one list either way.
  const privateTo = usePrivateTo(threadId);
  const privateNames = privateTo ? privateTo.map((p) => p.name) : [];
  // 🔒 The composer's own door: the people in this chat (the strip's faces, you excluded); none → no 🔒.
  const chatPeople = useChatPeople(threadId);
  // 🔁 A reply goes to the same people (owner, 12 Nov): the 🔒 opens with them ticked.
  const replyIds = usePrivateReply(threadId);
  const [pickingPrivate, setPickingPrivate] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  /* ↔ THE COMPOSER SLIDES (owner, 9 Nov: "fully animate the message when the text box expands and the buttons move to the
     side away from the screen" — 03-FINAL-RULINGS). Typing, or a private recipient, sends the ＋ · 🔒 · 📎 · 📷 · 🖼 out to the
     LEFT while the box grows into their room in the same motion; an empty box, or × out of private, brings them back. One
     movement at the house speed (`--sn-pill-dur`, the family spring — `.sn-composer-tools` in globals.css); Send stays put.
     While private they also LEAVE the page once they are out (words only: no ＋, no file input) — and a composer drawn
     already private never draws them at all. Reduced motion: the same end states, no movement. */
  const toolsOut = Boolean(privateTo) || hasDraft;
  /* 🤫 WHISPER (owner, 19 Nov). On only where the page offers it (a host, in a supplier's chat), never while a private
     recipient is set (that door has its own ×) and never under the fee's words-only lock. Like a private line a whisper
     is WORDS ONLY: the ＋ folds away inside the box and every attach leaves the page with it. */
  const canWhisper = Boolean(whisper) && !feeWordsOnly && !privateTo;
  const whisperOn = useWhisper(threadId) && canWhisper;
  const wordsMode = Boolean(privateTo) || whisperOn;
  const toolsAway = toolsOut || whisperOn;
  const reduceMotion = usePrefersReducedMotion();
  const [toolsMounted, setToolsMounted] = useState(!wordsMode && !feeWordsOnly);
  const [toolsShown, setToolsShown] = useState(!toolsAway);
  useEffect(() => {
    if (!toolsAway) {
      setToolsMounted(true);
      // One frame drawn "out" first, so the way back in is a slide, not a jump.
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setToolsShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setToolsShown(false);
    if (!wordsMode) {
      // Away only because of a draft: the tools stay ON the page (slid out, inert), so the one file input is still
      // there for a dropped or pasted file — also right after leaving Whisper or a private line with words typed.
      setToolsMounted(!feeWordsOnly);
      return;
    }
    if (reduceMotion) {
      setToolsMounted(false);
      return;
    }
    const ms = pressMs(getComputedStyle(document.documentElement).getPropertyValue('--sn-pill-dur'));
    const t = window.setTimeout(() => setToolsMounted(false), ms);
    return () => window.clearTimeout(t);
  }, [toolsAway, wordsMode, reduceMotion, feeWordsOnly]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  /* ⌨ "/" SHORTCUTS (owner 11 Nov). Typing "/" first lifts the (+)'s own card rows above the box (the (+) on this chat
     publishes them — `sheetSlashRows`); Enter or a tap drops that card exactly as the (+) row does. Words only while
     private, so no list then. Held by lib/chat-plus.test.ts (slash == (+), Enter never picks a greyed row). */
  const plus = usePlus(threadId);
  const [slashText, setSlashText] = useState<string | null>(null);
  const [slashHi, setSlashHi] = useState(0);
  const slashQ = wordsMode || feeWordsOnly || slashText === null ? null : slashQuery(slashText);
  const slashOn = slashQ !== null && plus.slash.length > 0;
  const slashList = slashOn ? filterSlash(plus.slash, slashQ) : [];
  const slashRunning = plus.draft
    ? { key: 'draft', card: plus.draft.kind, title: PLUS_CARD_TITLE[plus.draft.kind], by: 'you' as const, status: 'draft' as const, anchorId: PLUS_DRAFT_ANCHOR }
    : plus.sent;
  const slashGate = plusGate(slashRunning ?? null);
  const pickSlash = (row: SlashRow) => {
    if (row.shut) return;
    if (slashGate.shut) {
      patchPlus(threadId, { toast: { text: slashGate.message, at: Date.now() } });
      if (slashRunning) jumpTo(slashRunning.anchorId);
      return;
    }
    const el = textareaRef.current;
    if (el) {
      el.value = '';
      el.style.height = '';
    }
    setSlashText(null);
    setHasDraft(false);
    patchPlus(threadId, { draft: { kind: row.card, startedAt: Date.now() } });
    // ⤴ A poll or decision rises full screen (CHAT-09) — the chat under it stays where it was.
    if (!RISING_DRAFTS.has(row.card)) window.setTimeout(() => jumpTo(PLUS_DRAFT_ANCHOR), 60);
  };
  // Either door turning private mode on (or changing who) puts the cursor in the box.
  const privateUserId = privateTo ? privateTo.map((p) => p.userId).join(',') : null;
  useEffect(() => {
    if (privateUserId) textareaRef.current?.focus();
  }, [privateUserId]);
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
  // 🔒 Going private lets go of a picked file (the attach controls are not drawn while it is on — words only).
  const goingPrivate = privateTo !== null || whisperOn;
  useEffect(() => {
    if (!goingPrivate) return;
    if (fileInputRef.current) fileInputRef.current.value = '';
    setFileName(null);
  }, [goingPrivate]);

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
    attachFile(file);
  };
  /**
   * 📥 Piece 3c (DECISION_LOG 2026-11-12 "EVERYTHING SHARED IN THE CHAT IS COLLECTED ON FILES"): a file DRAGGED onto
   * the chat or PASTED into the box rides the same ONE `attachment` input as the shortcuts — so it is compressed,
   * judged and sent exactly like a picked one, and lands on Files sorted by kind. While private: words only.
   */
  const [dropping, setDropping] = useState(false);
  const takeDropped = (files: FileList | null | undefined): boolean => {
    const file = files?.[0] ?? null;
    if (!file) return false;
    if (privateTo) {
      setFileError(PRIVATE_WORDS_ONLY_MESSAGE);
      return true;
    }
    if (whisperOn) {
      setFileError(WHISPER_WORDS_ONLY_MESSAGE);
      return true;
    }
    attachFile(file);
    return true;
  };
  function attachFile(file: File | null) {
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
  }
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const photoRef = useRef<HTMLInputElement | null>(null);

  /* 🤫 THE SWITCH (owner, 19 Nov: "the drag doesn't go to the send button … it always goes to the text box"). Dragging
     the BOX right — or the keyboard's own switch below — turns Whisper on or off. It never sends. Going back to Message
     with words typed ARMS the mis-send reminder: the words turn ink, one line says who will see them, and the first
     Send after that asks once. An empty box arms nothing and says "Back to everyone" for a moment. */
  const [leftWithWords, setLeftWithWords] = useState(false);
  const [asking, setAsking] = useState(false);
  const askPassedRef = useRef(false);
  const [switchLine, setSwitchLine] = useState<string | null>(null);
  const switchLineTimer = useRef<number | null>(null);
  const sayForAMoment = (line: string) => {
    if (switchLineTimer.current !== null) window.clearTimeout(switchLineTimer.current);
    setSwitchLine(line);
    switchLineTimer.current = window.setTimeout(() => setSwitchLine(null), WHISPER_OFF_LINE_STAY_MS);
  };
  useEffect(
    () => () => {
      if (switchLineTimer.current !== null) window.clearTimeout(switchLineTimer.current);
    },
    [],
  );
  const switchWhisper = () => {
    if (!canWhisper || !whisper) return;
    if (!whisperOn) {
      if (whisper.coHosts <= 0) {
        sayForAMoment(WHISPER_NOBODY_LINE);
        return;
      }
      if (switchLineTimer.current !== null) window.clearTimeout(switchLineTimer.current);
      setSwitchLine(null);
      setLeftWithWords(false);
      askPassedRef.current = false;
      setWhisper(threadId, true);
      return;
    }
    setWhisper(threadId, false);
    const typed = (textareaRef.current?.value ?? '').trim().length > 0;
    setLeftWithWords(typed);
    askPassedRef.current = false;
    if (typed) setSwitchLine(null);
    else sayForAMoment(WHISPER_OFF_LINE);
  };
  // A private recipient picked from a face while whispering ends the whisper — one mode at a time.
  const hasPrivateTo = privateTo !== null;
  useEffect(() => {
    if (hasPrivateTo) setWhisper(threadId, false);
  }, [hasPrivateTo, threadId]);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; ours: boolean } | null>(null);
  const endDrag = (switches: boolean) => {
    const box = boxRef.current;
    if (box) {
      box.removeAttribute('data-chat-dragging');
      box.style.translate = '';
    }
    drag.current = null;
    if (switches) switchWhisper();
  };
  const dragProps = whisper
    ? {
        onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
          if (!canWhisper || (e.pointerType === 'mouse' && e.button !== 0)) return;
          const target = e.target as HTMLElement;
          // Never a drag on Send, the ＋ or any other control inside the box — a slip there can not switch or send.
          if (target.closest('button, a, label, input')) return;
          // A mouse dragged across typed words is selecting them.
          if (e.pointerType === 'mouse' && target instanceof HTMLTextAreaElement && target.value.length > 0) return;
          drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, ours: false };
        },
        onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          if (!d.ours) {
            const verdict = dragVerdict(dx, dy);
            if (verdict === 'none') return;
            if (verdict === 'vertical') {
              drag.current = null;
              return;
            }
            d.ours = true;
            // Capture keeps the drag ours when the thumb leaves the box; a pointer that can not be captured still drags.
            try {
              e.currentTarget.setPointerCapture?.(e.pointerId);
            } catch {
              /* not capturable — the box still follows while the pointer is over it */
            }
            e.currentTarget.setAttribute('data-chat-dragging', '');
          }
          if (!reduceMotion) e.currentTarget.style.translate = `${dragFollowPx(dx)}px 0`;
        },
        onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          endDrag(d.ours && dragSwitches(e.clientX - d.x));
        },
        onPointerCancel: () => endDrag(false),
      }
    : {};

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
      data-chat-dropping={dropping ? '' : undefined}
      onDragOver={(e) => {
        if (!Array.from(e.dataTransfer?.types ?? []).includes('Files')) return;
        e.preventDefault();
        if (!dropping) setDropping(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setDropping(false);
      }}
      onDrop={(e) => {
        setDropping(false);
        if (!e.dataTransfer?.files?.length) return;
        e.preventDefault();
        takeDropped(e.dataTransfer.files);
      }}
      onPaste={(e) => {
        // 📥 A pasted picture or file (not private — the box's own handler already refused that) is attached like a
        // picked one; pasted words stay words.
        if (privateTo || e.defaultPrevented) return;
        const dt = e.clipboardData;
        if (!dt.files.length) return;
        e.preventDefault();
        takeDropped(dt.files);
      }}
      onSubmit={(e) => {
        // 🤫 THE ONE ASK (owner, 19 Nov "Yes, add it"): the first Send after leaving Whisper with words typed stops
        // here — before the action, so the words stay in the box whatever is answered.
        if (!leftWithWords || askPassedRef.current) return;
        if ((textareaRef.current?.value ?? '').trim().length === 0) return;
        e.preventDefault();
        setAsking(true);
      }}
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
        // 🔒 Words only, said in words — never a private file sent anyway (the server refuses it too).
        if (privateTo && hasFile) {
          setFileError(PRIVATE_WORDS_ONLY_MESSAGE);
          return;
        }
        // 💸 Words only while a top-up is overdue — said in the lock's own words.
        if (wordsOnly && hasFile) {
          setFileError(wordsOnly);
          return;
        }
        // 🤫 A whisper is words only too — and a whisper is never sent as anything else: the field below rides the
        // form only while whisper is on, and the server refuses it rather than sending it to everyone.
        if (whisperOn && hasFile) {
          setFileError(WHISPER_WORDS_ONLY_MESSAGE);
          return;
        }

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
          privateTo: privateTo ? privateNames : null,
          whisper: whisperOn,
        };
        window.dispatchEvent(new CustomEvent(CHAT_PENDING_EVENT, { detail: pending }));
        setSlashText(null);
        if (textareaRef.current) {
          textareaRef.current.value = '';
          textareaRef.current.style.height = '';
        }
        setHasDraft(false);
        // The reminder was about THOSE words; they are sent now.
        setLeftWithWords(false);
        askPassedRef.current = false;
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
      {sentAs ? <input type="hidden" name={CHAT_SENT_AS_FIELD} value={sentAs} /> : null}
      {privateTo?.map((p) => <input key={p.userId} type="hidden" name={CHAT_PRIVATE_FIELD} value={p.userId} />)}
      {whisperOn ? <input type="hidden" name={CHAT_WHISPER_FIELD} value="1" data-chat-whisper-field="" /> : null}

      {/* 🔒 The 🔒's list — tick one or several, the message box goes private for them. */}
      {!privateTo && !whisper && pickingPrivate && chatPeople.length > 0 ? (
        <PrivatePeopleList
          people={chatPeople}
          initiallyTicked={replyIds ?? []}
          onPick={(to) => {
            setPickingPrivate(false);
            setPrivateTo(threadId, to);
            textareaRef.current?.focus();
          }}
        />
      ) : null}

      {/* Chosen-file chip — shown once a file is picked, before send. */}
      {dropping ? (
        <p role="status" className="mb-2 rounded-2xl border-2 border-dashed border-sn-accent/50 py-3 text-center text-[14px] font-medium text-ink" data-chat-drop-line="">
          Drop to send
        </p>
      ) : null}
      {fileName ? (
        <div className="flex items-center gap-2 self-start rounded-full bg-[color:var(--m-paper-2)] py-0.5 pl-3 pr-0.5 text-[13px] text-ink">
          <Paperclip className="h-4 w-4 text-[color:var(--m-slate-2)]" strokeWidth={1.75} />
          <span className="max-w-[220px] truncate">{fileName}</span>
          <button
            type="button"
            onClick={clearFile}
            aria-label="Remove attachment"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[color:var(--m-slate-2)] hover:bg-ink/10 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      ) : null}
      {fileError ? (
        <p className="self-start text-[13px]" style={{ color: 'rgb(var(--color-danger))' }} role="alert">
          {fileError}
        </p>
      ) : null}
      {slashOn ? (
        <SlashList
          rows={slashList}
          query={slashQ ?? ''}
          highlight={Math.min(slashHi, Math.max(0, slashList.length - 1))}
          notice={slashGate.shut ? slashGate.message : null}
          onPick={pickSlash}
          onHover={setSlashHi}
        />
      ) : null}
      {blockError ? (
        <p
          // A refusal in the danger colour, one line — never small gold words in a box (rules 2 · 13).
          className="self-stretch px-1 py-1 text-[13px]"
          style={{ color: 'rgb(var(--color-danger))' }}
          role="alert"
        >
          {blockError}
        </p>
      ) : null}

      {wordsOnly ? (
        // 💸 Why the box keeps words only — one quiet line, the prototype's words.
        <p className="self-stretch px-1 pb-1 text-[12.5px] font-medium" style={{ color: 'rgb(var(--color-warn))' }} data-chat-fee-words-only="">
          {wordsOnly}
        </p>
      ) : null}
      {/* 🤫 The line over the box (the drawing's): whispering · back to everyone · or the mis-send reminder. */}
      {whisper && (whisperOn || leftWithWords || switchLine) ? (
        <p
          role="status"
          className={`sn-whisper-line px-1 text-center text-[11.5px] font-bold ${whisperOn ? 'text-[rgb(var(--color-private-text))]' : leftWithWords ? 'text-[12px] text-ink' : 'text-[color:var(--m-slate-2)]'}`}
          data-chat-whisper-line={whisperOn ? 'on' : leftWithWords ? 'reminder' : switchLine ? 'said' : 'none'}
        >
          {whisperOn ? WHISPER_ON_LINE : leftWithWords ? everyoneWillSeeLine(whisper.supplierName) : switchLine}
        </p>
      ) : null}
      {/* ⌨ The same switch without a drag (a keyboard, a switch control, a screen reader) — out of sight until focused. */}
      {whisper && canWhisper ? (
        <button
          type="button"
          role="switch"
          aria-checked={whisperOn}
          onClick={switchWhisper}
          className="sr-only focus-visible:not-sr-only focus-visible:self-center focus-visible:rounded-full focus-visible:px-3 focus-visible:py-2 focus-visible:text-[13px] focus-visible:font-semibold focus-visible:text-[rgb(var(--color-private-text))]"
          data-chat-whisper-switch=""
        >
          Whisper to co-hosts only
        </button>
      ) : null}
      <div
        ref={boxRef}
        className={`sn-chat-onebox flex items-end gap-0.5 rounded-3xl ${privateTo ? '' : 'bg-[color:var(--m-paper-2)]'} ${wordsMode ? '' : 'focus-within:ring-2 focus-within:ring-sn-accent/30'}`}
        data-chat-composer-row=""
        data-chat-one-box=""
        {...(wordsMode || feeWordsOnly ? { 'data-chat-words-only': '' } : {})}
        {...(whisper ? { 'data-chat-whisper': whisperOn ? 'on' : 'off' } : {})}
        {...dragProps}
      >
        {/* 💸 Words only while a top-up is overdue: the tools group is never drawn (no ＋, no 🔒, no file). */}
        {toolsMounted && !feeWordsOnly ? (
        <div
          className="sn-composer-tools"
          data-chat-composer-tools={toolsShown ? 'in' : 'out'}
          {...(toolsShown ? {} : { 'aria-hidden': true, inert: true })}
        >
        <div className="flex min-w-0 items-end gap-0.5">
        {lead ?? null}
        {/* 🔒 Message someone privately, any time (owner, 9 Nov) — beside the ＋; only when someone else is in the chat. */}
        {chatPeople.length > 0 && !whisper ? (
          <ActionButton
            tone="info"
            quiet
            iconOnly
            icon={Lock}
            label="Privately"
            name="Message someone in this chat privately"
            aria-expanded={pickingPrivate}
            aria-haspopup={true}
            className="h-11 w-11 shrink-0"
            onClick={() => setPickingPrivate((was) => !was)}
            data-testid="chat-private-open"
          />
        ) : null}
        {/* Paperclip attach button — opens the OS file picker. With `attachInputId` the button is gone (the ＋ sheet's
            "Share a file" opens the picker) but the input stays, clipped, so the picked file still rides this form. */}
        <label
          className={
            attachInputId
              ? 'sr-only'
              : 'inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-sn-accent hover:bg-ink/[0.05]'
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
        {/* 📷 · 🖼 — Messenger's two shortcuts (prototype frame B). With a ＋ (`lead`) they live INSIDE it (v8.3, approved
            9 Nov: (+) · 🔒 · box · Send): the labels are clipped and the sheet's Camera / Photo rows click their inputs by
            id. Without one they stay visible beside the paperclip. Both hand the file to the ONE input above. */}
          <>
            <label className={lead ? 'sr-only' : SHORTCUT} title="Camera" data-chat-camera="">
              <span className="sr-only">Camera</span>
              <Camera aria-hidden className="h-[22px] w-[22px]" strokeWidth={1.9} />
              <input ref={cameraRef} id={CHAT_CAMERA_INPUT_ID} type="file" accept={MEDIA_ACCEPT} capture="environment" className="sr-only" onChange={(e) => takeShortcut(e.currentTarget)} />
            </label>
            <label className={lead ? 'sr-only' : SHORTCUT} title="Photo" data-chat-photo="">
              <span className="sr-only">Photo</span>
              <ImageIcon aria-hidden className="h-[22px] w-[22px]" strokeWidth={1.9} />
              <input ref={photoRef} id={CHAT_PHOTO_INPUT_ID} type="file" accept={MEDIA_ACCEPT} className="sr-only" onChange={(e) => takeShortcut(e.currentTarget)} />
            </label>
          </>
        </div>
        </div>
        ) : null}

        {/* 📏 Once the tools have slid away (typing, or private) the box meets ChatBox's 16 px gutter itself (v8.3: the
            row is 16 px from each edge in both end states); beside the tools it keeps its 4 px breathing room. */}
        {/* 🔒 PRIVATE MODE LIVES INSIDE THE BOX (owner, 9 Nov) — the same box, never a second row: an info outline, a 🔒 at its
            left, "Private message to Jose" while empty, and an × inside at its right that returns it to "Message"
            (everyone). The wrapper is always drawn, so the field is never re-mounted and a draft survives the switch. */}
        <div
          className={`sn-composer-box relative my-[3px] flex min-w-0 flex-1 rounded-2xl ${toolsAway ? 'ml-0 mr-1' : 'mx-1'} ${privateTo ? PRIVATE_BOX_OUTLINE : ''}`}
          data-chat-message-box=""
          {...(privateTo ? { 'data-chat-private-box': '' } : {})}
          // 💸 Words only while a top-up is overdue: a pasted file is refused, in the lock's own words.
          onPasteCapture={(e) => {
            if (!wordsOnly) return;
            const dt = e.clipboardData;
            if (!(dt.files.length > 0 || Array.from(dt.items).some((it) => it.kind === 'file'))) return;
            e.preventDefault();
            setFileError(wordsOnly);
          }}
        >
          {privateTo ? (
            <Lock aria-hidden className={`pointer-events-none absolute bottom-[11px] left-3 h-4 w-4 ${PRIVATE_MARK}`} strokeWidth={2.2} />
          ) : null}
        <textarea
          ref={textareaRef}
          name="body"
          rows={1}
          maxLength={4000}
          placeholder={privateTo ? privateBoxPlaceholder(privateNames) : whisperOn ? WHISPER_PLACEHOLDER : MESSAGE_PLACEHOLDER}
          aria-label={privateTo ? privateBoxPlaceholder(privateNames) : whisperOn ? WHISPER_PLACEHOLDER : MESSAGE_PLACEHOLDER}
          className={`sn-chat-onebox-field max-h-36 min-h-[38px] min-w-0 flex-1 resize-none rounded-2xl border-0 ${privateTo ? `pl-9 pr-11 ${PRIVATE_BOX_FILL}` : `bg-[color:var(--m-paper-2)] px-3.5 ${whisperOn ? 'placeholder:text-[rgb(var(--color-private-text))]' : 'placeholder:text-[color:var(--m-slate-3)]'}`} py-[9px] text-[15px] leading-5 ${whisperOn ? 'text-[rgb(var(--color-private-text))]' : 'text-ink'} outline-none ${privateTo ? PRIVATE_FOCUS_RING : ''}`}
          data-rides=""
          onPaste={(e) => {
            // 🔒 Words only while private (owner, 9 Nov): a pasted picture or file is refused, said in the row's own words.
            if (!privateTo) return;
            const dt = e.clipboardData;
            const hasFile = dt.files.length > 0 || Array.from(dt.items).some((it) => it.kind === 'file');
            if (!hasFile) return;
            e.preventDefault();
            setFileError(PRIVATE_WORDS_ONLY_MESSAGE);
          }}
          onPasteCapture={(e) => {
            // 🤫 …and while whispering, in the whisper's own words.
            if (!whisperOn) return;
            const dt = e.clipboardData;
            if (!(dt.files.length > 0 || Array.from(dt.items).some((it) => it.kind === 'file'))) return;
            e.preventDefault();
            e.stopPropagation();
            setFileError(WHISPER_WORDS_ONLY_MESSAGE);
          }}
          onFocus={() => setTyping(true)}
          onBlur={() => setTyping(false)}
          onInput={(e) => {
            const el = e.currentTarget;
            setHasDraft(el.value.trim().length > 0);
            // The reminder is about the words carried out of Whisper — an emptied box carries none.
            if (leftWithWords && el.value.trim().length === 0) setLeftWithWords(false);
            const typed = el.value.startsWith('/') ? el.value : null;
            if (typed !== slashText) setSlashHi(0);
            setSlashText(typed);
            // Grows with the words, up to ~6 lines, then scrolls (Messenger's field).
            el.style.height = 'auto';
            el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
            if (blockError) setBlockError(null);
            window.dispatchEvent(
              new CustomEvent('chat-stream:input', { detail: { threadId } }),
            );
          }}
          onKeyDown={(e) => {
            // ⌨ The slash list has the keys while it is up: ↑↓ move, Enter drops the card (never a greyed one), Esc puts it away.
            if (slashOn && !e.nativeEvent.isComposing) {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const last = Math.max(0, slashList.length - 1);
                setSlashHi((i) => (e.key === 'ArrowDown' ? Math.min(i + 1, last) : Math.max(i - 1, 0)));
                return;
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                setSlashText(null);
                return;
              }
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const at = Math.min(slashHi, Math.max(0, slashList.length - 1));
                const row = slashList[at];
                if (row && slashPick(slashList, at)) pickSlash(row);
                return;
              }
            }
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
          {privateTo ? (
            <ActionButton
              tone="info"
              quiet
              iconOnly
              icon={X}
              label="To everyone"
              name={`Stop the private message to ${joinNames(privateNames)} — the next message goes to everyone`}
              className="absolute -bottom-[3px] right-0"
              onClick={() => {
                setPrivateTo(threadId, null);
                textareaRef.current?.focus();
              }}
              data-testid="chat-private-clear"
            />
          ) : null}
        </div>
        <SubmitButton
          aria-label="Send"
          pendingLabel=""
          className={`sn-whisper-send inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${wordsMode ? PRIVATE_MARK : 'text-ink'} hover:bg-ink/[0.05] disabled:opacity-60`}
          {...(privateTo ? { 'data-chat-private-send': '' } : {})}
        >
          <WhisperSendIcon on={whisperOn} className="h-6 w-6" />
        </SubmitButton>
      </div>
      {whisper ? (
        <ConfirmDialog
          open={asking}
          title={LEFT_WHISPER_ASK}
          body={leftWhisperAskBody(whisper.supplierName)}
          confirmLabel="Send"
          cancelLabel="Cancel"
          equalRow
          onConfirm={() => {
            // Asked once: this Send goes, and Send does not ask again until the next switch.
            setAsking(false);
            askPassedRef.current = true;
            formRef.current?.requestSubmit();
          }}
          onCancel={() => {
            // Cancel keeps the words — and the ask is spent (owner: "the first Send after that asks once").
            setAsking(false);
            askPassedRef.current = true;
            textareaRef.current?.focus();
          }}
        />
      ) : null}
    </form>
  );
}
