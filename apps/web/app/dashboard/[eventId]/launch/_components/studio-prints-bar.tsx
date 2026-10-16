'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { StudioPrintsDownloadSheet } from './studio-prints-settings';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { studioPrintsBarPieces } from '@/lib/studio-details';
import type { DetailsItemGroup, DetailsItemKey } from '@/lib/maker-details-items';

/** How far below the form's top a piece's head must pass to be "the piece you are on" — about one head row. */
export const PRINTS_BAR_LINE_PX = 96;

/** A field that raises the phone's keyboard — the bar steps aside while one is focused, so it never rides over the field. */
export function raisesKeyboard(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName !== 'INPUT') return false;
  return !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image', 'hidden'].includes((el as HTMLInputElement).type);
}

/**
 * 🧭 STUDIO › PRINTS' PIECE BAR (owner 2026-10-16, *"so fix the prints page. so we can easily navigate."*; approved prototype
 * `prints_page_navigation_2026-10-16.html`, DECISION_LOG "STUDIO › PRINTS GETS A PIECE BAR…").
 *
 * The Prints form is one long scroll (7.5 screens at 375 px, 16 pieces, two headings). On a PHONE this bar sits in the lower
 * third, under the form: ‹ · the piece you are on ▾ · ›.
 *   · ▾ is the house `PickMenu` — a sheet on a phone (the Maker's `PickSheetContext`), the form's group words as sticky
 *     headings, a tick on the piece you are on. "On every print" is first.
 *   · a pick, ‹ and › run the workspace's own `select(k)` and its editor-column scroll (`onGo`) — nothing new moves the page.
 *   · the label follows the scroll: an IntersectionObserver over each piece's editor (`[data-details-editor=k]`) names the
 *     piece whose head last passed the top line; at the very bottom it names the last piece.
 *   · after a press the picked name holds until the person scrolls by hand — a piece near the end cannot reach the top, and
 *     the bar must not then say a different piece than the one just picked.
 *   · while a field is focused (the phone's keyboard is up) the bar steps aside — it never rides over the field.
 *   · ⬇ (owner 2026-10-17, "ONE DOWNLOAD PER PIECE … EVERYTHING ◆"): the Download sheet — "This piece" (the row's own file, the guest
 *     picked when it is a guest print) and "Everything ◆" (`StudioPrintsDownloadSheet`, reading what the rows themselves save).
 * On a computer the navigator column already lists the pieces: `lg:hidden`. Mounted by `details-workspace.tsx` only for the
 * new Maker's Studio › Prints form, through the one lazy door (`StudioTool part="prints-bar"`).
 */
export function StudioPrintsBar({
  items,
  box,
  onGo,
  at,
}: {
  /** The Prints form's items, in the form's order. */
  items: ReadonlyArray<{ key: DetailsItemKey; label: string; group: DetailsItemGroup }>;
  /** The editor column — the form's scroller. */
  box: RefObject<HTMLDivElement | null>;
  /** The workspace's `select(k)` + its editor-column scroll to `[data-details-editor=k]`. */
  onGo: (key: DetailsItemKey) => void;
  /** The item the workspace has picked — where the label starts. */
  at: DetailsItemKey;
}) {
  const pieces = useMemo(() => studioPrintsBarPieces(items), [items]);
  const keys = pieces.map((p) => p.key).join(' ');
  const [cur, setCur] = useState<DetailsItemKey>(() => (pieces.some((p) => p.key === at) ? at : pieces[0]!.key));
  const [typing, setTyping] = useState(false);
  const [saving, setSaving] = useState(false);
  /** A press holds its piece until the person scrolls by hand. */
  const held = useRef(false);

  useEffect(() => {
    const root = box.current;
    if (!root) return;
    const list = keys.split(' ') as DetailsItemKey[];
    const heads = list
      .map((k) => root.querySelector<HTMLElement>(`[data-details-editor="${k}"]`))
      .filter((el): el is HTMLElement => el !== null);
    if (!heads.length) return;
    const follow = () => {
      if (held.current) return;
      const atEnd = root.scrollHeight > root.clientHeight && root.scrollTop + root.clientHeight >= root.scrollHeight - 2;
      if (atEnd) {
        setCur(list[list.length - 1]!);
        return;
      }
      const line = root.getBoundingClientRect().top + PRINTS_BAR_LINE_PX;
      let on = list[0]!;
      for (const el of heads) if (el.getBoundingClientRect().top <= line) on = el.dataset.detailsEditor as DetailsItemKey;
      setCur(on);
    };
    /* The top line: a band one head tall at the top of the column — a piece's head crossing it is the moment the label moves. */
    let io: IntersectionObserver | null = null;
    const watch = () => {
      io?.disconnect();
      io = new IntersectionObserver(follow, { root, rootMargin: `0px 0px -${Math.max(0, root.clientHeight - PRINTS_BAR_LINE_PX)}px 0px`, threshold: [0, 1] });
      for (const el of heads) io.observe(el);
    };
    watch();
    /* The very bottom is not a crossing — the last pieces never reach the line — so the end is read as the column settles there. */
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (root.scrollTop + root.clientHeight >= root.scrollHeight - 2) follow();
      });
    };
    const byHand = () => {
      held.current = false;
    };
    const ro = new ResizeObserver(watch);
    ro.observe(root);
    root.addEventListener('scroll', onScroll, { passive: true });
    for (const e of ['touchstart', 'wheel', 'pointerdown', 'keydown'] as const) root.addEventListener(e, byHand, { passive: true });
    return () => {
      io?.disconnect();
      ro.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      root.removeEventListener('scroll', onScroll);
      for (const e of ['touchstart', 'wheel', 'pointerdown', 'keydown'] as const) root.removeEventListener(e, byHand);
    };
  }, [box, keys]);

  /* ⌨ The keyboard: while a field is focused the bar steps aside (it would sit on the field the keyboard pushed up). */
  useEffect(() => {
    const read = () => setTyping(raisesKeyboard(document.activeElement));
    const later = () => window.setTimeout(read, 0);
    document.addEventListener('focusin', read);
    document.addEventListener('focusout', later);
    return () => {
      document.removeEventListener('focusin', read);
      document.removeEventListener('focusout', later);
    };
  }, []);

  const i = Math.max(0, pieces.findIndex((p) => p.key === cur));
  const here = pieces[i]!;
  const go = (k: DetailsItemKey) => {
    held.current = true;
    setCur(k);
    onGo(k);
  };
  const step = 'sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink/[0.06] text-ink disabled:opacity-35';

  return (
    <div
      data-studio-prints-bar=""
      hidden={typing}
      className={`${typing ? 'hidden' : 'flex'} shrink-0 items-center gap-1.5 border-t border-ink/10 bg-cream px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] lg:hidden`}
    >
      <button type="button" aria-label="Previous piece" data-prints-bar-step="prev" disabled={i === 0} onClick={() => go(pieces[i - 1]!.key)} className={step}>
        <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
      </button>
      <div className="relative min-w-0 flex-1">
        <PickMenu
          label="Which print"
          value={here.key}
          options={pieces.map((p) => ({ key: p.key, label: p.label, ...(p.group ? { group: p.group } : {}), ...(p.hint ? { hint: p.hint } : {}) }))}
          onPick={(k) => go(k as DetailsItemKey)}
          stickyGroups
          dataAttr="data-prints-bar-pick"
          className="!flex h-11 w-full justify-center border border-ink/20 !bg-cream pt-3 !text-[15px]"
        />
        {/* The piece's group, small, over its name — words only; the press is the dropdown's. */}
        <span aria-hidden data-prints-bar-caption="" className="pointer-events-none absolute inset-x-6 top-1 truncate text-center text-[10.5px] font-semibold uppercase leading-none tracking-[0.04em] text-ink/55">
          {here.caption}
        </span>
      </div>
      <button type="button" aria-label="Next piece" data-prints-bar-step="next" disabled={i === pieces.length - 1} onClick={() => go(pieces[i + 1]!.key)} className={step}>
        <ChevronRight aria-hidden className="h-5 w-5" strokeWidth={2} />
      </button>
      <button
        type="button"
        aria-label="Download"
        aria-haspopup="dialog"
        data-prints-bar-step="download"
        onClick={() => setSaving(true)}
        className="sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-terracotta-700 text-cream shadow-[0_6px_14px_-6px_rgba(120,60,30,.6)]"
      >
        <Download aria-hidden className="h-5 w-5" strokeWidth={2} />
      </button>
      {saving ? <StudioPrintsDownloadSheet item={here.key} onClose={() => setSaving(false)} /> : null}
    </div>
  );
}
