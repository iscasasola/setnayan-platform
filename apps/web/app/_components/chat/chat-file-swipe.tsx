'use client';

/**
 * 👈 REMOVING YOUR OWN FILE FROM A CHAT — the ↺ undo ring and the swipe (DECISION_LOG 2026-11-13 "CHAT FILE: UNDO RING
 * SHOWS AT ONCE ON SEND (10 S, INSTANT DELETE) · SWIPE = DELETE FOR EVERYONE (FIRST 5 MIN) OR DELETE FOR ME" + "CHAT
 * FILE UNDO DRAWING APPROVED"; prototype chat_file_undo_ring_2026-11-13 v3 — this draws exactly that delta).
 *
 *   1. The moment you send a file, with no swipe, a 44px ↺ ring sits to the LEFT of your bubble. Its arc empties over
 *      10 s with the seconds under it. Tap = deleted at once for both, no line. When it ends it goes and the file
 *      stays. Leave and come back: it shows the time left, or is gone (it reads the message's own time).
 *   2. Swipe your own file left (THE ONE SWIPE, `swipe-to-delete.tsx`) → a sheet: Delete for everyone (red, only within
 *      5 min of sending, "· N min left") · Delete for me · Cancel. After 5 min only Delete for me, with the line why.
 *   3. A booking file never gets Delete for everyone: "This file is part of the booking, so it stays for everyone."
 *   4. A failed delete keeps the bubble and says "Couldn’t delete your file. Try again." — never a silent success.
 *
 * The DATABASE decides every one of these again (`remove_my_chat_file`, migration 20271341904583) through
 * `DELETE /api/chat/attachment/<id>?mode=…`; what the sheet offers comes from `?removal=options` (the server's clock,
 * and the booking check). Only YOUR file bubble is wrapped (the stream decides); words never swipe.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { Sheet } from '@/app/_components/sheet';
import {
  CHAT_FILE_BOOKING_LINE,
  CHAT_FILE_DELETE_EVERYONE,
  CHAT_FILE_DELETE_ME,
  CHAT_FILE_EVERYONE_CLOSED,
  CHAT_FILE_REMOVE_FAILED,
  CHAT_FILE_SHEET_TITLE,
  CHAT_FILE_UNDO_SECONDS,
  everyoneMinutesLeft,
  undoSecondsLeft,
  type ChatFileRemoveMode,
  type ChatFileRemoveOutcome,
  type ChatFileRemoveRefusal,
} from '@/lib/chat-file-removal';

export type ChatFileRemoved = { outcome: ChatFileRemoveOutcome; removedAt: string };
export type ChatFileRemoveIO = {
  /** What the sheet may offer. null = the read failed (the sheet then offers Delete for me only — fail closed). */
  options(messageId: string): Promise<{ booking: boolean; sentSecondsAgo: number } | null>;
  remove(messageId: string, mode: ChatFileRemoveMode): Promise<({ ok: true } & ChatFileRemoved) | { ok: false; reason: ChatFileRemoveRefusal }>;
};

/** The real door: the route that already owns "a file in a conversation". */
export const routeRemoveIO: ChatFileRemoveIO = {
  async options(messageId) {
    const r = await fetch(`/api/chat/attachment/${encodeURIComponent(messageId)}?removal=options`, { cache: 'no-store' }).catch(() => null);
    if (!r || !r.ok) return null;
    const j = (await r.json().catch(() => null)) as { booking?: unknown; sentSecondsAgo?: unknown } | null;
    if (!j || typeof j.booking !== 'boolean' || typeof j.sentSecondsAgo !== 'number') return null;
    return { booking: j.booking, sentSecondsAgo: j.sentSecondsAgo };
  },
  async remove(messageId, mode) {
    const r = await fetch(`/api/chat/attachment/${encodeURIComponent(messageId)}?mode=${mode}`, { method: 'DELETE' }).catch(() => null);
    if (!r) return { ok: false, reason: 'refused' };
    const j = (await r.json().catch(() => null)) as { outcome?: unknown; removedAt?: unknown; reason?: unknown } | null;
    if (r.ok && j && typeof j.outcome === 'string') {
      return { ok: true, outcome: j.outcome as ChatFileRemoveOutcome, removedAt: typeof j.removedAt === 'string' ? j.removedAt : new Date().toISOString() };
    }
    const reason = j?.reason === 'booking' || j?.reason === 'window' ? j.reason : 'refused';
    return { ok: false, reason };
  },
};

// ── 1 · the ring ────────────────────────────────────────────────────────────

const RING_R = 19;
const RING_C = 2 * Math.PI * RING_R;

/** The 44px ↺ ring. Presentational: `secondsLeft` is drawn as given (the row owns the clock). */
export function ChatFileUndoRing({ secondsLeft, busy, onUndo }: { secondsLeft: number; busy?: boolean; onUndo: () => void }) {
  const offset = RING_C * (1 - secondsLeft / CHAT_FILE_UNDO_SECONDS);
  return (
    <button
      type="button"
      onClick={onUndo}
      disabled={busy}
      aria-label={`Undo send, ${secondsLeft} seconds left`}
      data-chat-file-undo-ring=""
      className="relative grid h-11 w-11 shrink-0 place-items-center self-center rounded-full text-sn-accent disabled:opacity-60"
    >
      <svg viewBox="0 0 44 44" aria-hidden className="absolute inset-0 -rotate-90">
        <circle cx="22" cy="22" r={RING_R} fill="none" strokeWidth="3" className="stroke-ink/15" />
        <circle
          cx="22"
          cy="22"
          r={RING_R}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={RING_C.toFixed(1)}
          strokeDashoffset={offset.toFixed(1)}
          // The arc slides each second; under reduced motion it steps (the seconds still count).
          className="stroke-sn-accent motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000 motion-safe:ease-linear"
        />
      </svg>
      <span aria-hidden className="relative text-[19px] font-bold leading-none">
        {busy ? '…' : '↺'}
      </span>
      <span aria-hidden className="absolute -bottom-[15px] left-1/2 -translate-x-1/2 whitespace-nowrap text-[10.5px] tabular-nums text-ink/55">
        {secondsLeft} s
      </span>
    </button>
  );
}

/** Your own file's row: the ring (while it stands) LEFT of the bubble. Presentational — held by its guard test. */
export function OwnFileRow({ ring, children }: { ring: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex max-w-full items-center justify-end gap-2" data-chat-own-file-row="">
      {ring}
      {children}
    </div>
  );
}

// ── 2 · the sheet ───────────────────────────────────────────────────────────

export type RemoveSheetOffer = { booking: boolean; minutesLeft: number } | 'loading' | 'unknown';

/** Presentational: what the sheet offers is decided by `offer`. */
export function ChatFileRemoveSheet({
  open,
  name,
  offer,
  busy,
  onChoose,
  onClose,
}: {
  open: boolean;
  name: string | null;
  offer: RemoveSheetOffer;
  busy: ChatFileRemoveMode | null;
  onChoose: (mode: 'everyone' | 'me') => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const known = typeof offer === 'object' ? offer : null;
  const everyone = known && !known.booking && known.minutesLeft > 0 ? known.minutesLeft : 0;
  const line = known?.booking ? CHAT_FILE_BOOKING_LINE : known && everyone === 0 ? CHAT_FILE_EVERYONE_CLOSED : name ?? '';
  return (
    <Sheet open={open} onClose={onClose} labelledById={titleId} rise>
      <div className="px-4 pb-4 pt-1" data-chat-file-remove-sheet="">
        <p id={titleId} className="text-base font-semibold text-ink">
          {CHAT_FILE_SHEET_TITLE}
        </p>
        <p className="mb-3 mt-0.5 text-[13px] text-ink/70" data-chat-file-remove-why="">
          {line}
        </p>
        {everyone > 0 ? (
          <button
            type="button"
            onClick={() => onChoose('everyone')}
            disabled={busy !== null}
            data-chat-file-remove="everyone"
            className="mt-2 flex min-h-12 w-full items-center justify-center rounded-full border-[1.5px] border-danger-600 bg-danger-600 text-[14.5px] font-semibold text-white dark:border-danger-400 dark:bg-danger-400 disabled:opacity-60"
          >
            {busy === 'everyone' ? 'Deleting…' : CHAT_FILE_DELETE_EVERYONE}
            {busy === 'everyone' ? null : <small className="ml-1.5 font-medium opacity-85">· {everyone} min left</small>}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onChoose('me')}
          disabled={busy !== null}
          data-chat-file-remove="me"
          className="mt-2 flex min-h-12 w-full items-center justify-center rounded-full border-[1.5px] border-transparent bg-danger-600/10 text-[14.5px] font-semibold text-danger-700 disabled:opacity-60 dark:text-danger-200"
        >
          {busy === 'me' ? 'Deleting…' : CHAT_FILE_DELETE_ME}
        </button>
        <button
          type="button"
          onClick={onClose}
          data-chat-file-remove="cancel"
          className="mt-2 flex min-h-12 w-full items-center justify-center rounded-full border-[1.5px] border-ink/20 text-[14.5px] font-semibold text-ink"
        >
          Cancel
        </button>
      </div>
    </Sheet>
  );
}

// ── 3 · the wired bubble ────────────────────────────────────────────────────

export function ChatFileSwipe({
  messageId,
  name,
  createdAt,
  io = routeRemoveIO,
  openSheetAtStart = false,
  onRemoved,
  children,
}: {
  messageId: string;
  name: string | null;
  createdAt: string;
  io?: ChatFileRemoveIO;
  /** 🧪 Labs only — opens the sheet on mount for a screenshot. */
  openSheetAtStart?: boolean;
  onRemoved: (done: ChatFileRemoved) => void;
  children: ReactNode;
}) {
  // The ring's clock starts after mount: the server render never draws it (its clock is not this phone's).
  const [ringLeft, setRingLeft] = useState(0);
  const [ringBusy, setRingBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [offer, setOffer] = useState<RemoveSheetOffer>('loading');
  const [busy, setBusy] = useState<ChatFileRemoveMode | null>(null);
  const [failed, setFailed] = useState(false);
  const closeRow = useRef<() => void>(() => {});

  useEffect(() => {
    const tick = () => setRingLeft(undoSecondsLeft(createdAt, Date.now()));
    tick();
    if (undoSecondsLeft(createdAt, Date.now()) <= 0) return;
    const t = setInterval(() => {
      const left = undoSecondsLeft(createdAt, Date.now());
      setRingLeft(left);
      if (left <= 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [createdAt]);

  const openSheet = (known?: RemoveSheetOffer) => {
    setFailed(false);
    setSheet(true);
    if (known) {
      setOffer(known);
      return;
    }
    setOffer('loading');
    void io.options(messageId).then((o) =>
      setOffer(o ? { booking: o.booking, minutesLeft: everyoneMinutesLeft(o.sentSecondsAgo) } : 'unknown'),
    );
  };
  useEffect(() => {
    if (openSheetAtStart) openSheet();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a lab's one-time open
  }, [openSheetAtStart]);

  const undo = async () => {
    setRingBusy(true);
    setFailed(false);
    const r = await io.remove(messageId, 'undo');
    setRingBusy(false);
    if (r.ok) return onRemoved(r);
    setRingLeft(0);
    // A booking file: the ring cannot delete it — say so, and offer what is left. A window that just closed: the
    // sheet with what is still open. Anything else: the bubble stays and says so.
    if (r.reason === 'booking') return openSheet({ booking: true, minutesLeft: 0 });
    if (r.reason === 'window') return openSheet();
    setFailed(true);
  };

  const choose = async (mode: 'everyone' | 'me') => {
    setBusy(mode);
    const r = await io.remove(messageId, mode);
    setBusy(null);
    if (r.ok) {
      setSheet(false);
      return onRemoved(r);
    }
    if (r.reason === 'booking') return setOffer({ booking: true, minutesLeft: 0 });
    if (r.reason === 'window') return setOffer({ booking: false, minutesLeft: 0 });
    setSheet(false);
    closeRow.current();
    setFailed(true);
  };

  return (
    <div data-no-page-swipe="" className="flex max-w-full flex-col items-end">
      <OwnFileRow ring={ringLeft > 0 ? <ChatFileUndoRing secondsLeft={ringLeft} busy={ringBusy} onUndo={() => void undo()} /> : null}>
        {/* `data-no-page-swipe`: inside the picked shell a sideways swipe turns the page — on YOUR file it opens the sheet. */}
        <SwipeToDelete
          label={`Delete your file${name ? ` ${name}` : ''}`}
          word="Delete"
          radiusClass="rounded-2xl"
          surfaceClass="bg-cream"
          className="min-w-0 max-w-[75%]"
          onDelete={(close) => {
            closeRow.current = close;
            close();
            openSheet();
          }}
        >
          {children}
        </SwipeToDelete>
      </OwnFileRow>
      {failed ? (
        <p role="alert" className="mt-1 text-[13px] text-danger-700 dark:text-danger-200" data-chat-file-remove-failed="">
          {CHAT_FILE_REMOVE_FAILED}
        </p>
      ) : null}
      <ChatFileRemoveSheet
        open={sheet}
        name={name}
        offer={offer}
        busy={busy}
        onChoose={(m) => void choose(m)}
        onClose={() => {
          if (busy) return;
          setSheet(false);
        }}
      />
    </div>
  );
}

/** The stream's wrapper: YOUR file bubble gets the ring and the swipe; every other bubble is drawn exactly as before. */
export function MaybeChatFileSwipe({
  on,
  children,
  ...props
}: { on: boolean; children: ReactNode } & Omit<Parameters<typeof ChatFileSwipe>[0], 'children'>) {
  if (!on) return <>{children}</>;
  return <ChatFileSwipe {...props}>{children}</ChatFileSwipe>;
}
