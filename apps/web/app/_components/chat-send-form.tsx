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
//   7. (2026-11-19 · "THE CLIENT PAGE IS ONE CHAT THAT HOLDS EVERYTHING", drawing S9ScH2Ps v3, screens 5 · 11) On the
//      supplier's client chat (`kinds`): a SLIDERS button inside the box, before Send, raises the chips above it —
//      All · Decisions · Forms · Money · Dates · Files, each with its count — and one picked chip filters the stream
//      (`lib/chat-kind-store.ts`; it replaces the Chat · Decisions · Files switch that sat under the head). And ONE
//      suggested step sits inside the box, left of "Message" (`ChatHome.suggest`): it opens the same card its (+) row
//      opens, and it steps away the moment a word is typed.
//   8. (2026-11-20 · UNICHAT PARTS B + D, owner on the approved live drawing `UNICHAT-LIVE-2026-11-19.html`: "build it
//      now, I am happy with the design") THE TOOL IS INSIDE THE BOX: a (+) card being filled is drawn in this box — it
//      grows upward into the tool, its row says the tool's name, the ＋ is a ← back to plain chat (the typed words stay)
//      and Send says what it sends (the card's own Send, in the box's Send place). On a computer the tiles and the tool
//      open as a THIRD COLUMN at the right of the chat, which narrows — never covered. A typed price or day offers its
//      tool above the box (`typedOffer`). The chips are compact and float above the box; the sliders icon turns into
//      their ✕; Chat and Private joined them — Private shows the private lines only and, where this box can whisper,
//      turns it to Whisper. Typing lands back on All (never out of Private).

import { CHAT_SENT_AS_FIELD, type ChatSentAs } from '@/lib/chat-sent-as';
import { Suspense, lazy, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Camera, ImageIcon, Lock, Paperclip, Plus, SlidersHorizontal, X } from 'lucide-react';
import { useChatHome } from '@/app/_components/chat/chat-home';
import { KIND_CHIPS } from '@/lib/chat-kinds';
import { pickKind, useKinds } from '@/lib/chat-kind-store';
import { formatCount } from '@/lib/format-number';
import { ActionButton } from '@/components/action-button';
import { CHAT_PRIVATE_FIELD, PRIVATE_BOX_FILL, PRIVATE_BOX_OUTLINE, PRIVATE_FOCUS_RING, PRIVATE_MARK, PRIVATE_WORDS_ONLY_MESSAGE, joinNames, privateBoxPlaceholder } from '@/lib/chat-private';
import { setPrivateTo, useChatPeople, usePrivateReply, usePrivateTo } from '@/app/_components/chat/private-to';
import { PrivatePeopleList } from '@/app/_components/chat/private-people';
import { setWhisper, useWhisper } from '@/app/_components/chat/whisper-mode';
import { WhisperSendIcon } from '@/app/_components/chat/whisper-send-icon';
import { PrivateChip } from '@/app/_components/chat/private-chip';
import { ConfirmDialog } from '@/app/_components/confirm-dialog';
import {
  CHAT_WHISPER_FIELD,
  LEFT_WHISPER_ASK,
  MESSAGE_PLACEHOLDER,
  WHISPER_OFF_LINE,
  WHISPER_OFF_LINE_STAY_MS,
  WHISPER_ON_LINE,
  WHISPER_PLACEHOLDER,
  WHISPER_TEAM_SWITCH,
  WHISPER_WORDS_ONLY_MESSAGE,
  dragFollowPx,
  dragSwitches,
  dragVerdict,
  everyoneWillSeeLine,
  leftWhisperAskBody,
  whisperBlockedLine,
  type WhisperSide,
} from '@/lib/chat-whisper';
import { SubmitButton } from './submit-button';
import { pressMs } from './press-feel';
import { useIsDesktop, usePrefersReducedMotion } from '@/lib/use-responsive';
import { ChatToolFrame } from '@/app/_components/chat/chat-tool-frame';
import { trackFailure } from '@/lib/telemetry/track-error';
import { chatContactFilterEnabled } from '@/lib/chat-contact-filter-flag';
import { evaluateMessage, CONTACT_BLOCK_MESSAGE } from '@/lib/chat-contact-filter';
import { prepareChatFile, uploadPreparedChatFile } from '@/lib/chat-file-prepare';
import { CHAT_ATTACHMENT_ACCEPT, chatAttachmentLimit } from '@/lib/chat-attachment-limits';
import { CHAT_CAMERA_INPUT_ID, CHAT_PHOTO_INPUT_ID } from '@/lib/chat-attach-input-id';
import { shouldSendOnEnter, isCoarsePointer } from '@/lib/chat-enter-to-send';
import { useTapAway } from '@/app/_components/typing-band';
import { SlashList } from '@/app/_components/chat/slash-list';
import { filterSlash, slashPick, slashQuery, typedOffer, PLUS_CARD_TITLE, RISING_DRAFTS, type SlashRow, type TypedOffer } from '@/lib/chat-plus';
import { PLUS_DRAFT_ANCHOR, jumpTo, patchPlus, usePlus } from '@/lib/chat-plus-store';
import {
  CHAT_PENDING_EVENT,
  CHAT_SETTLED_EVENT,
  forgetRetry,
  newTempId,
  registerRetry,
  type PendingSend,
} from '@/lib/chat-optimistic';

/**
 * 🧰 The (+) card drawn inside the box — asked for only when a tool opens (the stream already carries the same module on
 * a chat that has a (+), so nothing is fetched twice; a composer with no tool open carries none of it). A bare
 * `React.lazy`, not `next/dynamic` (the `couple-logo.tsx` reasoning): it only exists after a tap, never on the server.
 */
const PlusDraft = lazy(() => import('@/app/_components/chat/plus-draft').then((m) => ({ default: m.PlusDraft })));

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
   * Send); `unread` = that read FAILED, so a drag says it could not load — never "no co-host". Absent → no drag, no whisper (a group chat): the box is exactly as before.
   * 🏪 Unichat part E (owner 19–20 Nov): `side` — 'hosts' (the hosts + their coordinator; the host's AND the
   * coordinator's page) or 'team' (the shop's own people; the supplier's page, where `supplierName` is the hosts' side
   * the reminder names). `reach` — the line under the Private chip while whispering ("Only you, Ana and your
   * coordinator" · "Only your team"); absent → the 19 Nov words.
   */
  whisper?: { supplierName: string; coHosts: number; unread?: boolean; side?: WhisperSide; reach?: string | null } | null;
  /**
   * 💬 THE CHIPS (owner 19 Nov 2026) — passed ONLY by the supplier's thread page inside the picked client: the sliders
   * button in the box, the kind chips above it, and the one suggested step. Absent → the box exactly as before.
   */
  kinds?: boolean;
};

// The picker's list and the size ceilings are DERIVED from the one shared
// module the server enforces (lib/chat-attachment-limits.ts). They used to be
// hand-typed here, under a comment saying they were kept in sync by hand —
// which is how a picker comes to offer a type the server refuses, with a file
// that simply will not send as the only symptom.

export function ChatSendForm({ threadId, sendAction, lead, attachInputId, userId, sentAs, wordsOnly = null, whisper = null, kinds = false }: Props) {
  /* 💬 The chips (19 Nov 2026). The picked kind is the chat's own (`chat-kind-store`): the stream filters by it and
     publishes each kind's count; this box only shows and picks. The sliders button opens the chips; pressed again — or
     All — it shows everything. */
  const kindState = useKinds(threadId);
  const [chipsUp, setChipsUp] = useState(false);
  const filtering = kinds && kindState.view !== 'all';
  const home = useChatHome();
  const plus = usePlus(threadId);

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
  // 💬 The one suggested step shows only in an empty, ordinary box — gone once a word is typed, never in a words-only box.
  const suggestOn = kinds && Boolean(home?.suggest) && !hasDraft && !wordsMode && !feeWordsOnly;
  // 🧰 While a tool is in the box its ← (the ＋, turned) must be there to go back, whatever is typed underneath.
  const toolsAway = (toolsOut || whisperOn) && !(plus.draft !== null && plus.inBox && !RISING_DRAFTS.has(plus.draft.kind) && !wordsMode);
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
  const [slashText, setSlashText] = useState<string | null>(null);
  const [slashHi, setSlashHi] = useState(0);
  const slashQ = wordsMode || feeWordsOnly || slashText === null ? null : slashQuery(slashText);
  const slashOn = slashQ !== null && plus.slash.length > 0;
  const slashList = slashOn ? filterSlash(plus.slash, slashQ) : [];
  /* 🧰 THE TOOL IN THE BOX (Unichat part B, 20 Nov 2026). The draft the (+) opened is drawn HERE when this composer has
     a ＋ and the stream has said what a card needs (`plus.host`): inside the box on a phone, in the third column on a
     computer. A poll or a decision still rises full screen (CHAT-09) — that is the stream's to draw. Several cards may
     be open at once since the 20 Nov approval, so nothing here is gated on a card that waits for its answer. */
  const wide = useIsDesktop();
  const canHoldTool = Boolean(lead) && !feeWordsOnly;
  useEffect(() => {
    if (!canHoldTool) return;
    patchPlus(threadId, { inBox: true });
    return () => patchPlus(threadId, { inBox: false, picker: false, tilesSlot: null });
  }, [threadId, canHoldTool]);
  const tool = canHoldTool && plus.host && plus.draft && !RISING_DRAFTS.has(plus.draft.kind) ? plus.draft : null;
  const toolHost = plus.host;
  // 🖥 The third column hangs on the chat's own frame (`ChatBox`), so the chat narrows beside it. No frame → the box.
  const [chatBoxEl, setChatBoxEl] = useState<HTMLElement | null>(null);
  const col3 = wide && chatBoxEl !== null && canHoldTool && (tool !== null || plus.picker);
  const toolInBox = tool !== null && !col3;
  useEffect(() => {
    if (!chatBoxEl || !col3) return;
    chatBoxEl.setAttribute('data-chat-col3', '');
    return () => chatBoxEl.removeAttribute('data-chat-col3');
  }, [chatBoxEl, col3]);
  // The tiles column is a computer's: turned to a phone's width, the (+) is its sheet again.
  useEffect(() => {
    if (!wide && plus.picker) patchPlus(threadId, { picker: false });
  }, [wide, plus.picker, threadId]);
  const [sendSlot, setSendSlot] = useState<HTMLElement | null>(null);
  const [tilesSlot, setTilesSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    patchPlus(threadId, { tilesSlot });
  }, [threadId, tilesSlot]);
  const toolFrame = useMemo(() => ({ sendSlot }), [sendSlot]);
  const closeTool = () => patchPlus(threadId, { draft: null, picker: false, toast: null });
  const openTool = (card: SlashRow['card']) => {
    patchPlus(threadId, { draft: { kind: card, startedAt: Date.now() }, picker: false });
    // ⤴ A poll or decision rises full screen (CHAT-09); a card with no box to live in is brought into view.
    if (!RISING_DRAFTS.has(card) && !canHoldTool) window.setTimeout(() => jumpTo(PLUS_DRAFT_ANCHOR), 60);
  };
  /* 💬 The one suggested step (drawing screen 11): the same card its (+) row drops. */
  const takeSuggested = (card: SlashRow['card']) => openTool(card);
  const pickSlash = (row: SlashRow) => {
    if (row.shut) return;
    const el = textareaRef.current;
    if (el) {
      el.value = '';
      el.style.height = '';
    }
    setSlashText(null);
    setHasDraft(false);
    setOffer(null);
    openTool(row.card);
  };
  /* 💬 A TYPED PRICE OR DAY OFFERS ITS TOOL (drawing: "Type 'Can you do ₱38,000?' … The box offers Counter"). One line
     above the box; its button opens the same card the (+) row opens. The typed words stay in the box (← brings you
     back to them) — the offer never sends and never clears. Not while private, whispering or under the fee lock. */
  const [offer, setOffer] = useState<TypedOffer | null>(null);
  const readOffer = (text: string) => {
    const next = wordsMode || feeWordsOnly ? null : typedOffer(text, plus.slash);
    setOffer((was) => (was?.card === next?.card && was?.figure === next?.figure ? was : next));
  };
  const chipsShown = kinds && chipsUp && !toolInBox;
  /* 💬 Typing — like sending or opening a tool — lands back on All, at the newest line. NEVER out of Private (the
     drawing: "typing never resets Private"). */
  const backToAll = () => {
    if (!kinds || kindState.view === 'private') return;
    if (kindState.view !== 'all') pickKind(threadId, 'all');
    setChipsUp(false);
  };
  const toolKind = tool?.kind ?? null;
  // 🔒 A private line and a whisper are WORDS ONLY: going private puts an open tool away (its ← folds with the ＋).
  useEffect(() => {
    if (wordsMode && toolKind) patchPlus(threadId, { draft: null, picker: false });
  }, [wordsMode, toolKind, threadId]);
  useEffect(() => {
    if (toolKind) backToAll();
    // Only the tool opening lands on All; the picked chip changing must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolKind]);
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
  useEffect(() => {
    setChatBoxEl(formRef.current?.closest<HTMLElement>('[data-chat-box]') ?? null);
  }, []);
  // 💬 While the chips float over the foot of the conversation, the conversation makes room for them (globals.css).
  useEffect(() => {
    if (!chatBoxEl || !chipsShown) return;
    chatBoxEl.setAttribute('data-chat-chips', '');
    return () => chatBoxEl.removeAttribute('data-chat-chips');
  }, [chatBoxEl, chipsShown]);

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
      // Nobody to whisper to — or the read of who is here failed, which is said as a failure, never as "nobody".
      const blocked = whisperBlockedLine(whisper);
      if (blocked) {
        sayForAMoment(blocked);
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
  /* 💬 ONE CHIP PICKED (Unichat part D; the drawing's `chip`): the picked one again folds the row away; Private shows the
     private lines only and — where this box can whisper — turns it to Whisper (a tool in the box is put away first, a
     whisper is words only); leaving Private for another chip goes back to Message, and words already typed arm the
     19 Nov reminder ("Everyone will see this…"). Membership is not touched here: who a whisper reaches is the server's. */
  const pickChip = (key: (typeof KIND_CHIPS)[number]['key']) => {
    if (key === kindState.view) {
      setChipsUp(false);
      return;
    }
    if (key === 'private') {
      pickKind(threadId, 'private');
      // Nobody to whisper to, or the read failed: the Private chip's own line says why (`privateStatus`), and stays.
      if (canWhisper && !whisperOn && whisper && !whisperBlockedLine(whisper)) {
        if (tool) closeTool();
        switchWhisper();
      }
      return;
    }
    if (kindState.view === 'private' && whisperOn) switchWhisper();
    pickKind(threadId, key);
  };
  /* 🔒 What the ONE Private chip says over the box: who a whisper reaches while whispering; with Private picked where a
     whisper cannot start, why — a failed read in its own words ("Couldn't load…"), never "no one". */
  const privateBlocked = whisper && canWhisper && kinds && kindState.view === 'private' && !whisperOn ? whisperBlockedLine(whisper) : null;
  const privateStatus: { kind: 'reach' | 'failed' | 'nobody'; text: string } | null =
    whisper && whisperOn && whisper.reach
      ? { kind: 'reach', text: whisper.reach }
      : privateBlocked && whisper
        ? { kind: whisper.unread ? 'failed' : 'nobody', text: privateBlocked }
        : null;
  // Whisper switched off by the drag while Private is the picked chip: the chat shows everything again.
  const wasWhisperRef = useRef(whisperOn);
  useEffect(() => {
    if (wasWhisperRef.current && !whisperOn && kinds && kindState.view === 'private') pickKind(threadId, 'all');
    wasWhisperRef.current = whisperOn;
  }, [whisperOn, kinds, kindState.view, threadId]);
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
          if (!canWhisper || toolInBox || (e.pointerType === 'mouse' && e.button !== 0)) return;
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

  const toolTitle = tool ? PLUS_CARD_TITLE[tool.kind] : 'Add to chat';
  const toolCard =
    tool && toolHost ? (
      <ChatToolFrame.Provider value={toolFrame}>
        <Suspense fallback={null}>
          <PlusDraft threadId={threadId} side={toolHost.side} eventId={toolHost.eventId} eventDate={toolHost.eventDate} returnPath={toolHost.returnPath} part="draft" />
        </Suspense>
      </ChatToolFrame.Provider>
    ) : null;

  return (
    <div className="relative" data-chat-comp={toolInBox ? 'tool' : col3 ? 'col3' : 'plain'}>
    {/* 🧰 THE BOX GROWS INTO THE TOOL (a phone): the editor opens upward out of the box, one frame with its row below.
        It is OUTSIDE the send form — a card posts its own form, and a form may not sit inside another. */}
    <div className="sn-chat-toolwrap" data-chat-tool-wrap={toolInBox ? 'open' : 'shut'}>
      <div className="sn-chat-toolin">
        <div className="sn-chat-tool" data-chat-tool={tool && toolInBox ? tool.kind : undefined}>
          {toolInBox ? toolCard : null}
        </div>
      </div>
    </div>
    {/* 🖥 A COMPUTER: the tiles, then the tool, are the THIRD COLUMN at the right of the chat — the chat narrows beside
        it and is never covered. ← is the way back to the message; the tool's Send stands at the column's foot. */}
    {col3 && chatBoxEl
      ? createPortal(
          <aside className="sn-chat-col3" role="dialog" aria-label={toolTitle} data-chat-col3-pane={tool ? 'tool' : 'tiles'}>
            <div className="flex h-[52px] shrink-0 items-center gap-1 border-b border-ink/10 pl-1 pr-3">
              <button type="button" onClick={closeTool} aria-label="Back to message" className="sn-press grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink hover:bg-ink/[0.05]" data-chat-col3-back="">
                <ArrowLeft aria-hidden className="h-5 w-5" strokeWidth={1.9} />
              </button>
              <b className="min-w-0 flex-1 truncate text-[15px] font-bold text-ink">{toolTitle}</b>
            </div>
            <div key={tool ? tool.kind : 'tiles'} className="sn-chat-col3-body min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
              {tool ? toolCard : <div ref={setTilesSlot} data-chat-col3-tiles="" />}
            </div>
            {tool ? <div ref={setSendSlot} className="flex shrink-0 justify-end border-t border-ink/10 px-4 py-3 empty:hidden" data-chat-tool-send="" /> : null}
          </aside>,
          chatBoxEl,
        )
      : null}
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
        setOffer(null);
        backToAll();
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
          notice={null}
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
      {whisper && (whisperOn ? !whisper.reach : leftWithWords || switchLine) ? (
        <p
          role="status"
          className={`sn-whisper-line px-1 text-center text-[11.5px] font-bold ${whisperOn ? 'text-[rgb(var(--color-private-text))]' : leftWithWords ? 'text-[12px] text-ink' : 'text-[color:var(--m-slate-2)]'}`}
          data-chat-whisper-line={whisperOn ? 'on' : leftWithWords ? 'reminder' : switchLine ? 'said' : 'none'}
        >
          {whisperOn ? WHISPER_ON_LINE : leftWithWords ? everyoneWillSeeLine(whisper.supplierName) : switchLine}
        </p>
      ) : null}
      {/* 🔒 THE ONE PRIVATE CHIP (`chat/private-chip.tsx`; Parts D + E folded, 20 Nov): while whispering it says the box is
          private and WHO it reaches (the ⓘ: staff read it only inside an open dispute). With the chips out, the row's own
          Private chip is the chip on screen and only the line stays. Private picked where a whisper cannot start: why,
          and a failed read is said as a failure — never as "no one". */}
      {privateStatus ? (
        <PrivateChip side={whisper?.side ?? 'hosts'} line={privateStatus} lineOnly={chipsShown} />
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
          {whisper.side === 'team' ? WHISPER_TEAM_SWITCH : 'Whisper to co-hosts only'}
        </button>
      ) : null}
      {/* 💬 A TYPED PRICE OR DAY OFFERS ITS TOOL — one line above the box; it opens the card, it never sends. */}
      {offer && !tool ? (
        <div role="status" className="flex items-center gap-2 px-1 text-[13.5px] text-[color:var(--m-slate-2)]" data-chat-typed-offer={offer.card}>
          <span className="min-w-0 flex-1">
            {offer.lead} <b className="font-semibold text-ink">{offer.figure}</b>?
          </span>
          <ActionButton tone="brand" main icon={Plus} label={offer.button} onClick={() => openTool(offer.card)} className="shrink-0" />
        </div>
      ) : null}
      {/* 💬 THE CHIPS — compact, floating above the box (they push nothing up); they pour out of the sliders icon and
          fold back into it (`.sn-chat-chips`, globals.css). ONE switch: the picked chip is the filled one. Always on the
          page so the way out is a motion too; shut, they are out of sight and out of reach (`inert`). */}
      {kinds ? (
        <div
          role="group"
          aria-label="Show"
          className="sn-chat-chips"
          data-chat-kind-chips={chipsShown ? 'open' : 'shut'}
          data-no-page-swipe=""
          {...(chipsShown ? {} : { 'aria-hidden': true, inert: true })}
        >
          {KIND_CHIPS.map((c, i) => {
            const on = kindState.view === c.key;
            const n = c.key === 'all' ? null : c.key === 'chat' || c.key === 'private' ? (kindState.talk?.[c.key] ?? null) : (kindState.counts?.[c.key] ?? null);
            // 🔒 Private is the ONE Private chip (lock + sky), the same component the whisper's status draws.
            if (c.key === 'private') return <PrivateChip key={c.key} onPress={() => pickChip(c.key)} pressed={on} count={n} style={{ '--i': i } as CSSProperties} />;
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => pickChip(c.key)}
                style={{ '--i': i } as CSSProperties}
                className={`sn-press sn-hit relative inline-flex h-8 min-h-0 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold shadow-sm ${
                  on ? 'bg-ink text-cream' : 'bg-[color:var(--m-paper)] text-ink'
                }`}
                data-chat-kind-chip={c.key}
              >
                {c.label}
                {n != null ? <span className={`text-[12px] font-normal tabular-nums ${on ? 'text-cream' : 'text-[color:var(--m-slate-2)]'}`}>{formatCount(n)}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
      <div
        ref={boxRef}
        className={`sn-chat-onebox flex items-end gap-0.5 ${toolInBox ? 'rounded-b-3xl' : 'rounded-3xl'} ${privateTo ? '' : 'bg-[color:var(--m-paper-2)]'} ${wordsMode || toolInBox ? '' : 'focus-within:ring-2 focus-within:ring-sn-accent/30'}`}
        data-chat-composer-row=""
        data-chat-one-box=""
        {...(toolInBox ? { 'data-chat-tool-row': tool!.kind } : {})}
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

        {/* 🧰 A TOOL IS IN THE BOX: the row is ← · the tool's name · its Send. The message field below stays on the page,
            out of sight, so the words typed before the tool are still there when ← brings the plain box back. */}
        {toolInBox ? (
          <>
            <span className="min-w-0 flex-1 self-center truncate pl-1 text-[15px] font-bold text-ink" data-chat-tool-label="">
              {PLUS_CARD_TITLE[tool!.kind]}
            </span>
            <span ref={setSendSlot} className="flex shrink-0 items-center self-center pr-1 empty:hidden" data-chat-tool-send="" />
          </>
        ) : null}
        {/* 📏 Once the tools have slid away (typing, or private) the box meets ChatBox's 16 px gutter itself (v8.3: the
            row is 16 px from each edge in both end states); beside the tools it keeps its 4 px breathing room. */}
        {/* 🔒 PRIVATE MODE LIVES INSIDE THE BOX (owner, 9 Nov) — the same box, never a second row: an info outline, a 🔒 at its
            left, "Private message to Jose" while empty, and an × inside at its right that returns it to "Message"
            (everyone). The wrapper is always drawn, so the field is never re-mounted and a draft survives the switch. */}
        <div
          className={`sn-composer-box relative my-[3px] min-w-0 flex-1 rounded-2xl ${toolInBox ? 'hidden' : 'flex'} ${toolsAway ? 'ml-0 mr-1' : 'mx-1'} ${privateTo ? PRIVATE_BOX_OUTLINE : ''}`}
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
          {/* 💬 ONE SUGGESTED STEP, inside the box, left of "Message" — gone once a word is typed (words only: none). */}
          {suggestOn && home?.suggest ? (
            <button
              type="button"
              onClick={() => takeSuggested(home.suggest!.card)}
              className="sn-press my-auto ml-1 inline-flex min-h-11 shrink-0 items-center"
              data-chat-suggested={home.suggest.card}
            >
              <span className="inline-flex h-[30px] items-center whitespace-nowrap rounded-full bg-sn-accent px-3 text-[13px] font-semibold text-sn-on-accent">{home.suggest.label}</span>
            </button>
          ) : null}
        <textarea
          ref={textareaRef}
          name="body"
          rows={1}
          maxLength={4000}
          // 💬 While the suggested step shows it is the box's invitation: at 390 px "Message" cannot sit beside it with
          // ＋ · 🔒 · sliders · Send, and wrapped under it — the name stays for a screen reader (`aria-label`).
          placeholder={suggestOn ? '' : privateTo ? privateBoxPlaceholder(privateNames) : whisperOn ? WHISPER_PLACEHOLDER : MESSAGE_PLACEHOLDER}
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
            readOffer(typed === null ? el.value : '');
            if (el.value.length > 0) backToAll();
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
        {/* 💬 The sliders — the app's one show/sort icon — inside the box, before Send. It TURNS INTO the chips' ✕ while
            they are out (it only opens and folds the row: the picked chip stays picked), and wears a dot while a chip
            other than All is picked and the row is folded. */}
        {kinds && !toolInBox ? (
          <button
            type="button"
            aria-label={chipsShown ? 'Close the filter row' : filtering ? 'Show and sort · a filter is on' : 'Show and sort'}
            aria-expanded={chipsShown}
            onClick={() => setChipsUp((was) => !was)}
            className="sn-press sn-chat-sliders relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink"
            data-chat-kind-open={chipsShown ? 'open' : 'shut'}
          >
            <SlidersHorizontal aria-hidden className="sn-chat-sliders-a h-5 w-5" strokeWidth={1.9} />
            <X aria-hidden className="sn-chat-sliders-b h-5 w-5" strokeWidth={1.9} />
            {filtering && !chipsShown ? <span aria-hidden className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-sn-accent" data-chat-kind-dot="" /> : null}
          </button>
        ) : null}
        <SubmitButton
          aria-label="Send"
          pendingLabel=""
          className={`sn-whisper-send h-11 w-11 shrink-0 items-center justify-center rounded-full ${toolInBox ? 'hidden' : 'inline-flex'} ${wordsMode ? PRIVATE_MARK : 'text-ink'} hover:bg-ink/[0.05] disabled:opacity-60`}
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
    </div>
  );
}
