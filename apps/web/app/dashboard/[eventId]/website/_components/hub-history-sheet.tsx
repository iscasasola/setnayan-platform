'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Redo2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { riseFromRect, type RiseRect } from '@/lib/rise-motion';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { formatCount } from '@/lib/format-number';
import type { HubDraftHistoryRow } from '@/lib/hub-draft';

/**
 * ↺ THE HISTORY LIST — the Maker bar's ↺ (Build 6 Lane F, ruling 5; owner 2026-11-09 "↺ BECOMES A HISTORY LIST",
 * 2026-11-10 "ALL YES"). Drawn after the contract frame M9 (`prototypes/event_hub_stages_scenes_2026-11-10/index.html`):
 *
 *   ✕ · History · [✓ Apply N]
 *   rows, newest first — the step's words and its time; the row the page is at tinted; rows stepped past greyed
 *   (a tap goes forward again); the last row green, "Published <time> · What guests see now"
 *   a note · the thumb row: "This draft · newest first" · [↻ Redo · N] or "Nothing to redo"
 *
 * It rises from the ↺ in 0.7 s (the house rise, `riseFromRect`, `--sn-pill-dur`); ✕ plays the exact reverse. The rows
 * are the server's (`lib/hub-draft-history.ts`): this file only draws them and says which one was tapped. Lazy — it is
 * loaded on the first ↺, never in the Maker's first load.
 */

export type HubHistorySheetProps = {
  rows: readonly HubDraftHistoryRow[];
  /** The ✓ count — Apply stays (2026-10-08 "APPLY + PRO"): guests see nothing until it. */
  applyCount: number;
  /** A press is still on its way to the page: rows wait (one tap, one step). */
  pending: boolean;
  /** Where the list rises from — the ↺ button's rect. Null: the foot of the screen. */
  from: RiseRect | null;
  onTap: (row: HubDraftHistoryRow) => void;
  onApply: () => void;
  onClose: () => void;
};

/** "3:42 PM" today; "Nov 10 · 3:42 PM" before; nothing when the draft did not keep the time (an old draft). */
export function historyTime(at: string | null, now: Date = new Date()): string {
  if (!at) return '—';
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return '—';
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  return sameDay ? time : `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`;
}

/** The row's second line: whose, or what guests see, or what a greyed row will do. */
export function historyRowNote(row: HubDraftHistoryRow): string | null {
  if (row.base) return row.pub ? 'What guests see now' : null;
  const parts: string[] = [];
  if (row.more > 0) parts.push(`and ${formatCount(row.more)} more`);
  if (row.theirs) parts.push(`${row.name ?? 'Someone'}’s edit`);
  if (row.where === 'ahead') parts.push('drops when you edit');
  else if (row.where === 'behind' && row.tap === 'mine') parts.push('takes back only your edits after it');
  else if (row.where === 'behind' && row.tap === 'none') parts.push('only another host’s edits came after it');
  return parts.length > 0 ? parts.join(' · ') : null;
}

export default function HubHistorySheet({ rows, applyCount, pending, from, onTap, onApply, onClose }: HubHistorySheetProps) {
  const panel = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const origin = (): RiseRect => from ?? { left: 0, top: window.innerHeight - 1, width: window.innerWidth, height: 1 };
  useLayoutEffect(() => {
    if (panel.current) riseFromRect(panel.current, origin());
    // Once, as it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const close = () => {
    if (closing) return;
    setClosing(true);
    const anim = panel.current ? riseFromRect(panel.current, origin(), { reverse: true }) : null;
    if (!anim) return onClose();
    anim.finished.then(onClose, onClose);
  };
  /* Focus moves into the list and stays there; Esc closes it (the reverse rise); the page behind does not scroll. */
  useModalA11y({ open: true, onClose: close, containerRef: panel });

  const here = rows.find((r) => r.where === 'here');
  const ahead = rows.filter((r) => r.where === 'ahead');
  const redo = here ? rows.find((r) => r.where === 'ahead' && r.i === here.i + 1) : undefined;
  const said = `Apply ${formatCount(applyCount)} ${applyCount === 1 ? 'change' : 'changes'}`;

  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label="History"
      tabIndex={-1}
      data-maker-history=""
      className="fixed inset-0 z-[90] flex flex-col bg-cream text-ink"
    >
      <div className="flex min-h-[72px] items-center gap-3 px-4 pt-[max(14px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={close}
          aria-label="Close history"
          data-maker-history-close=""
          className="sn-press inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ink/15 text-ink"
        >
          <X aria-hidden className="h-5 w-5" strokeWidth={2} />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold">History</h2>
        <ActionButton
          tone="brand"
          main
          icon={Check}
          label={applyCount > 0 ? `Apply ${formatCount(applyCount)}` : 'Apply'}
          name={applyCount > 0 ? said : 'Apply — no changes to apply'}
          disabled={pending || applyCount === 0}
          onClick={onApply}
          data-maker-history-apply=""
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <ol className="m-0 list-none p-0" data-maker-history-rows="">
          {rows.map((row) => {
            const note = historyRowNote(row);
            const live = row.tap !== 'none' && !pending;
            return (
              <li key={`${row.i}:${row.stamp}`} className="border-t border-ink/10 first:border-t-0">
                <button
                  type="button"
                  disabled={!live}
                  aria-current={row.where === 'here' ? 'step' : undefined}
                  onClick={() => onTap(row)}
                  data-history-row={row.where}
                  data-history-pub={row.pub ? '' : undefined}
                  className={`flex min-h-[52px] items-center gap-3 py-2.5 text-left transition-opacity duration-sn-control ease-sn ${
                    row.where === 'here' ? '-mx-4 w-[calc(100%+2rem)] rounded-xl bg-terracotta/15 px-4' : 'w-full'
                  } ${row.where === 'ahead' ? 'opacity-[.42]' : ''} ${!live && row.where === 'behind' ? 'cursor-default' : ''}`}
                >
                  <span className="min-w-0 flex-1">
                    <b className={`block text-[13.5px] font-semibold leading-snug ${row.pub ? 'text-success-700' : ''}`}>
                      {row.pub ? `Published ${historyTime(row.at)}` : row.what}
                    </b>
                    {note ? <span className="block text-xs leading-snug text-ink/60">{note}</span> : null}
                  </span>
                  <time className="shrink-0 font-mono text-[11px] text-ink/60" dateTime={row.at ?? undefined}>
                    {row.pub ? '—' : historyTime(row.at)}
                  </time>
                </button>
              </li>
            );
          })}
        </ol>
        <p className="mt-2 text-[12.5px] leading-snug text-ink/60" data-maker-history-note="">
          {ahead.length > 0
            ? `The ${ahead.length === 1 ? 'row' : `${formatCount(ahead.length)} rows`} above ${ahead.length === 1 ? 'is' : 'are'} greyed — ${ahead.length === 1 ? 'it drops' : 'they drop'} at your first new edit; until then ↻ redo is one tap.`
            : 'Tap a row and the page returns to that point.'}
        </p>
      </div>

      <div className="rounded-t-3xl bg-ink/[.04] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2">
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-ink/20" />
        <p className="mb-2 text-center text-[10.5px] font-semibold uppercase tracking-[.14em] text-ink/55">This draft · newest first</p>
        <ActionButton
          tone="neutral"
          icon={Redo2}
          label={redo ? `Redo · ${formatCount(ahead.length)}` : 'Nothing to redo'}
          name={redo ? `Redo — go forward to ${redo.what}` : 'Nothing to redo'}
          disabled={pending || !redo}
          onClick={() => redo && onTap(redo)}
          className="w-full justify-center"
          data-maker-history-redo=""
        />
      </div>
    </div>,
    document.body,
  );
}
