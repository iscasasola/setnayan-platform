'use client';

/**
 * # ⌨ THE SLASH LIST (owner 11 Nov 2026: *"How about '/' shortcuts?"*; client-supplier-page.html "4 · Slash shortcuts").
 * Type "/" first and the (+)'s own card rows rise above the message box, filtered as you type; ↑↓ move, Enter drops the
 * card, Esc puts it away. A greyed row keeps its reason and is never picked. The rows are the ones the (+) on this chat
 * publishes (`sheetSlashRows`), so the two never disagree.
 */
import { TOPIC_ICON } from '@/lib/topic-icons';
import { PLUS_CARD_TOPIC, type SlashRow } from '@/lib/chat-plus';

export function SlashList({
  rows,
  query,
  highlight,
  notice,
  onPick,
  onHover,
}: {
  rows: readonly SlashRow[];
  query: string;
  highlight: number;
  /** The (+) is shut (one card at a time) — said once above the rows. */
  notice: string | null;
  onPick: (row: SlashRow) => void;
  onHover: (index: number) => void;
}) {
  return (
    <div
      role="listbox"
      aria-label="Shortcuts"
      className="mx-1 rounded-2xl bg-white p-1.5 shadow-lg ring-1 ring-ink/10"
      data-chat-slash-list=""
    >
      {notice ? <p className="px-2.5 pb-1 pt-1.5 text-[12px] text-ink/60">{notice}</p> : null}
      {rows.length === 0 ? (
        <p className="px-2.5 py-2 text-[13px] text-ink/55">No shortcut starts with “/{query}”.</p>
      ) : (
        <ul className="max-h-[232px] overflow-y-auto">
          {rows.map((r, i) => {
            const Icon = TOPIC_ICON[PLUS_CARD_TOPIC[r.card]];
            const shut = r.shut;
            const hit = r.word.startsWith(query) ? query.length : 0;
            return (
              <li key={r.key} role="option" aria-selected={i === highlight} aria-disabled={shut ? true : undefined}>
                <button
                  type="button"
                  // keep the box's focus (and the phone's keyboard) while a row is pressed
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => onHover(i)}
                  onClick={() => onPick(r)}
                  aria-disabled={shut ? true : undefined}
                  data-chat-slash-row={r.key}
                  {...(shut ? { 'data-shut': '' } : {})}
                  className={`grid min-h-11 w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left ${
                    i === highlight ? 'bg-sn-accent/10' : ''
                  } ${shut ? 'cursor-default' : 'sn-press'}`}
                >
                  <span
                    aria-hidden
                    className={`grid h-7 w-7 place-items-center rounded-full ${shut ? 'bg-ink/[0.03] text-ink/25' : 'bg-ink/[0.05] text-sn-accent'}`}
                  >
                    <Icon className="h-[15px] w-[15px]" strokeWidth={1.9} />
                  </span>
                  <span className="grid min-w-0">
                    <b className={`truncate text-[15px] font-semibold leading-tight ${shut ? 'text-ink/40' : 'text-ink'}`}>{r.label}</b>
                    <span className={`mt-px truncate text-[12px] leading-tight ${shut ? 'text-ink/45' : 'text-ink/60'}`}>
                      {shut ? shut.reason : r.line}
                    </span>
                  </span>
                  <span className="font-mono text-[12px] text-ink/50">
                    /<em className="not-italic text-mulberry-700">{r.word.slice(0, hit)}</em>
                    {r.word.slice(hit)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="hidden justify-between px-2.5 pb-0.5 pt-1.5 text-[11px] text-ink/45 [@media(pointer:fine)]:flex">
        <span>↑↓ to move · Enter to add</span>
        <span>Esc to close</span>
      </p>
    </div>
  );
}
