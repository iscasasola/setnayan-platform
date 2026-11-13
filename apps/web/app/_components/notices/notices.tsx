'use client';

/**
 * 🔔 ONE NOTICE SYSTEM — the parts every page uses (owner approved 14 Nov 2026; the rules are `lib/notices.ts`, the
 * drawing is corpus `prototypes/notices_system_2026-11-14_fable.html`).
 *
 *   <Notice …/>          registers one notice. Draws nothing where it is written.
 *   <NoticeSlot place/>  where the page's top (or end) is. Draws what the rules put there, and "N more".
 *   <NoticeLine …/>      the one look: mark · one line with ⓘ · its action · the kind's close word.
 *   <NoticesWaiting/>    the bell's "Waiting on this page" group.
 *
 * Nothing pops up by itself. "N more" opens the bell (signed in) or a "For you" sheet with Close (a guest page has no
 * bell). Buttons are 44px. Every notice that can close says how, in the kind's word.
 */

import { useEffect, useId, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { InfoTip } from '@/app/_components/info-tip';
import { OverlayBackdrop } from '@/app/_components/overlay-backdrop';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { closeWord, type CloseRecord, type NoticeKind, type NoticeTone } from '@/lib/notices';
import {
  arranged,
  closeNotice,
  getServerSnapshot,
  getSnapshot,
  openTray,
  register,
  slotMounted,
  subscribe,
  type NoticeEntry,
} from './notice-store';
import type { ReactNode } from 'react';

function useStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// ── registration ──────────────────────────────────────────────────────────────

export type NoticeProps = {
  /** Stable, chosen by the code. A live notice puts its FACT in the key, so a changed fact returns. */
  noticeKey: string;
  kind: NoticeKind;
  title: string;
  titleNode?: ReactNode;
  detail?: ReactNode;
  actions?: ReactNode;
  mark?: ReactNode;
  blocking?: boolean;
  ask?: boolean;
  closable?: boolean;
  tone?: NoticeTone;
  at?: number;
  legacy?: () => CloseRecord | null;
  onClose?: () => void;
};

/** Registers one notice with the page. It is drawn by the page's slots (or waits in the bell), never here. */
export function Notice(props: NoticeProps) {
  const id = useId();
  const ref = useRef(props);
  ref.current = props;
  const { noticeKey, kind, title, titleNode, detail, actions, mark, blocking, ask, closable, tone, at } = props;
  useEffect(
    () =>
      register({
        id,
        key: noticeKey,
        kind,
        title,
        titleNode,
        detail,
        actions,
        mark,
        blocking,
        ask,
        closable,
        tone,
        at,
        legacy: () => ref.current.legacy?.() ?? null,
        onClose: () => ref.current.onClose?.(),
      }),
    [id, noticeKey, kind, title, titleNode, detail, actions, mark, blocking, ask, closable, tone, at],
  );
  return null;
}

// ── the one look ──────────────────────────────────────────────────────────────

const TONE: Record<NoticeTone, string> = {
  info: 'border-terracotta/30 bg-terracotta/10',
  warning: 'border-warn-300/60 bg-warn-50',
  problem: 'border-danger-300/60 bg-danger-50',
};
const TONE_INK: Record<NoticeTone, string> = {
  info: 'text-terracotta-700',
  warning: 'text-warn-900',
  problem: 'text-danger-800',
};

function KindMark({ kind, tone }: { kind: NoticeKind; tone?: NoticeTone }) {
  if (kind === 'offer') {
    return (
      <span aria-hidden className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-[13px] text-terracotta">
        ◆
      </span>
    );
  }
  if (kind === 'live') {
    return <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full bg-current ${TONE_INK[tone ?? 'info']}`} />;
  }
  return (
    <span
      aria-hidden
      className={`h-4 w-4 shrink-0 rounded-full border-2 ${
        kind === 'todo' ? 'border-dashed border-ink/45' : 'border-terracotta'
      }`}
    />
  );
}

import { NOTICE_ACTION } from './notice-action';
export { NOTICE_ACTION };
/** A block on a phone (the actions stack under the line), one row from 768. Never a bare flex. */
export const LINE_ROOT = 'md:flex md:items-center md:gap-3';
const NOTICE_QUIET = 'sn-press min-h-11 rounded-full px-3 text-sm font-semibold text-ink/60';

export function NoticeLine({
  entry,
  more = 0,
  onMore,
  last = true,
}: {
  entry: NoticeEntry;
  /** How many wait behind this line ("N more"), drawn on the LAST top line only. */
  more?: number;
  onMore?: () => void;
  last?: boolean;
}) {
  const word = closeWord(entry);
  const live = entry.kind === 'live';
  return (
    <div
      role="status"
      data-notice={entry.kind}
      data-notice-key={entry.key}
      className={[
        LINE_ROOT,
        live ? `rounded-md border px-4 py-2.5 ${TONE[entry.tone ?? 'info']}` : 'py-2.5',
        !live && !last ? 'border-b border-ink/10' : '',
      ].join(' ')}
    >
      {/* Row 1 — the mark and ONE short line; the rest is behind the ⓘ. */}
      <div className="flex min-w-0 items-center gap-2.5 md:flex-1" data-notice-head="">
        {entry.mark ?? <KindMark kind={entry.kind} tone={entry.tone} />}
        {entry.detail ? (
          <InfoTip
            label={entry.title}
            labelNode={entry.titleNode}
            labelAs="p"
            labelClassName="min-w-0 text-[14px] font-medium leading-snug text-ink"
            align="end"
            className="min-w-0 flex-auto"
          >
            {entry.detail}
          </InfoTip>
        ) : (
          <p className="min-w-0 flex-auto text-[14px] font-medium leading-snug text-ink">{entry.titleNode ?? entry.title}</p>
        )}
      </div>
      {/* Row 2 on a phone — the actions, right-aligned under the line (owner 2026-10-28, "always maximize the screen
          use"); beside it from 768. A SIBLING of row 1, never inside it, so a phone never crushes the sentence. */}
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2 md:mt-0 md:shrink-0" data-notice-actions="">
        {entry.actions}
        {word ? (
          <button type="button" onClick={() => closeNotice(entry)} className={NOTICE_QUIET} data-notice-close={word}>
            {word}
          </button>
        ) : null}
        {more > 0 && onMore ? (
          <button type="button" onClick={onMore} className={NOTICE_QUIET} data-notice-more={more}>
            {more} more
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ── the page's places ─────────────────────────────────────────────────────────

/**
 * Where the page's top (or end) is. A page decides where its top sits (on supplier Today it is under the photo, owner
 * 13 Nov). `guest` pages hold one line and, having no bell, open their own "For you" sheet.
 */
export function NoticeSlot({ place, guest = false, className = '' }: { place: 'top' | 'end'; guest?: boolean; className?: string }) {
  const s = useStore();
  useEffect(() => slotMounted(place, guest), [place, guest]);
  const a = arranged(s);
  const lines = place === 'top' ? a.top : a.end;
  const waiting = a.more.length;
  const hasBell = s.bells > 0;
  // "N more" rides on the top slot's last line; with no line on top it stands alone.
  const showMore = place === 'top' && waiting > 0;
  if (lines.length === 0 && !showMore) return null;
  return (
    <div className={className} data-notice-slot={place}>
      {lines.map((e, i) => (
        <NoticeLine
          key={e.id}
          entry={e}
          last={i === lines.length - 1}
          more={showMore && i === lines.length - 1 ? waiting : 0}
          onMore={() => openTray(true)}
        />
      ))}
      {showMore && lines.length === 0 ? (
        <div className="flex justify-end py-1">
          <button type="button" onClick={() => openTray(true)} className={NOTICE_QUIET} data-notice-more={waiting}>
            {waiting} more
          </button>
        </div>
      ) : null}
      {place === 'top' && !hasBell ? <ForYouSheet /> : null}
    </div>
  );
}

/** The bell's "Waiting on this page" group. Nothing when nothing waits. */
export function NoticesWaiting() {
  const s = useStore();
  const more = arranged(s).more;
  if (more.length === 0) return null;
  return (
    <section aria-label="Waiting on this page" data-notices-waiting={more.length} className="border-b border-[var(--m-line)] px-4 pb-1 pt-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink/55">Waiting on this page</p>
      {more.map((e, i) => (
        <NoticeLine key={e.id} entry={e} last={i === more.length - 1} />
      ))}
    </section>
  );
}

/** How many wait on this page — the bell's dot (its number stays the notifications count). */
export function useNoticesWaiting(): number {
  return arranged(useStore()).more.length;
}

/** Whether "N more" asked the bell to open. */
export function useTrayRequest(): boolean {
  return useStore().trayOpen;
}
export { openTray };

/** A guest page has no bell: "N more" opens this, with Close. */
function ForYouSheet() {
  const s = useStore();
  const ref = useRef<HTMLDivElement | null>(null);
  const open = s.trayOpen;
  const more = arranged(s).more;
  const close = () => openTray(false);
  useModalA11y({ open, onClose: close, containerRef: ref });
  useEffect(() => {
    if (open && more.length === 0) openTray(false);
  }, [open, more.length]);
  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <>
      <OverlayBackdrop onClose={close} label="Close" className="z-[51]" />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="For you"
        data-notices-for-you=""
        className="fixed inset-x-0 bottom-0 z-[52] max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-ink/10 bg-cream px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl md:inset-x-auto md:left-1/2 md:w-[28rem] md:-translate-x-1/2"
      >
        <div aria-hidden className="mx-auto mb-2 h-1 w-10 rounded-full bg-ink/15" />
        <p className="text-[15px] font-semibold text-ink">For you</p>
        {more.map((e, i) => (
          <NoticeLine key={e.id} entry={e} last={i === more.length - 1} />
        ))}
        <div className="mt-2 flex justify-end">
          <button type="button" onClick={close} className={NOTICE_ACTION}>
            Close
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
