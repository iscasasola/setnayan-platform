'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { LoveStoryChapter } from '@/lib/love-story-moments';
import { useMaker } from '../../../launch/_components/maker-context';
import { askThePageToOpen, queueOpen, type LoveStoryOpenAsk } from './love-story-open';

export type PanelMoment = { id: string; when: string; line: string; hidden: boolean };

/**
 * ONE CHAPTER'S MOMENTS IN THE MAKER'S LOVE STORY PANEL — each a tap that opens
 * THAT moment on the page beside it, and the chapter's own "Add a moment".
 *
 * 🔑 NOT A SECOND EDITOR. Every button here is `type="button"` and asks the page
 * (`askThePageToOpen`); the page's own `MomentSheet` opens and posts to the one
 * moment action. These buttons sit inside the panel's words form, and a nested
 * `<form>` is not valid HTML — asking is also what keeps them out of it.
 *
 * Never silent: when the page is not showing (the panel was opened from a
 * scene), the ask is queued and the Maker opens Love Story's page; when the page
 * shows guests' view instead, the panel says what to switch.
 */
export function ChapterMoments({
  chapter,
  moments,
  canAdd,
  capLine,
}: {
  chapter: LoveStoryChapter;
  moments: readonly PanelMoment[];
  canAdd: boolean;
  /** Said instead of "Add a moment" once the free stories are all told. */
  capLine: string;
}) {
  const maker = useMaker();
  const [note, setNote] = useState<string | null>(null);
  const ask = (a: LoveStoryOpenAsk) => {
    setNote(null);
    if (askThePageToOpen(a)) return;
    const onPage = maker?.selection?.kind === 'tool' && maker.selection.key === 'love-story';
    if (maker && !onPage) {
      queueOpen(a);
      maker.select({ kind: 'tool', key: 'love-story' });
      return;
    }
    // On the page but nothing answered: it shows guests' view, or is still
    // opening. Hold the ask for when it mounts, and say what to switch.
    queueOpen(a);
    setNote('Switch the page to “Your story” to edit.');
  };

  return (
    <div className="space-y-1.5">
      {moments.length > 0 ? (
        <ul className="space-y-1">
          {moments.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                data-panel-moment={m.id}
                onClick={() => ask({ target: m.id })}
                className="sn-press flex min-h-11 w-full items-baseline gap-2 rounded-md bg-white/80 px-3 py-2 text-left hover:bg-white"
              >
                <span className="shrink-0 text-[12px] font-semibold text-ink/70">{m.when || 'Undated'}</span>
                <span className={`min-w-0 flex-1 truncate text-[13.5px] ${m.hidden ? 'text-ink/45' : 'text-ink'}`}>
                  {m.line}
                </span>
                {m.hidden ? <span className="shrink-0 text-[11px] text-ink/50">Hidden</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {canAdd ? (
        <button
          type="button"
          data-panel-add={chapter}
          onClick={() => ask({ target: 'add', chapter })}
          className="sn-press inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold text-ink/75 ring-1 ring-inset ring-ink/15 hover:text-ink"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={2} /> Add a moment
        </button>
      ) : (
        <p className="text-[12.5px] text-ink/60">{capLine}</p>
      )}
      {note ? (
        <p role="status" className="text-[12.5px] text-ink/70">
          {note}
        </p>
      ) : null}
    </div>
  );
}
