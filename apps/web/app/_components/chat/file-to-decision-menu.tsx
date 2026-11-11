'use client';

/**
 * # 👆👆 FILE A MESSAGE UNDER A DECISION — the picker a double-tap opens under a bubble (owner 11 Nov 2026,
 * client-supplier-page.html "B · the picker"). Not filed: the open decisions (N filed), a divider, and
 * **New decision from this message** (its first words, editable; the message files under it on Open). Filed: **Move to
 * “…”** rows, a divider, **Remove from “…”**. Every choice is one call to its writer (lib/chat-decisions.ts); the
 * stream says what happened with an Undo.
 */
import { useState } from 'react';
import { ArrowRightLeft, Hash, Plus, X } from 'lucide-react';

import {
  DECISION_TITLE_MAX,
  fileMessage,
  moveMessage,
  openDecision,
  removeMessage,
  topicFromMessage,
  type Filing,
  type OpenDecisionTopic,
} from '@/lib/chat-decisions';
import { createClient } from '@/lib/supabase/client';
import { TypedRow } from '@/app/_components/form-row';

export type FilingDone = { text: string; undo?: () => Promise<unknown> };

const SAYS: Record<string, string> = {
  closed: 'That decision is closed.',
  private: 'A private message stays out of decisions.',
  filed_elsewhere: 'It is filed under another decision · double-tap it to move it.',
};

export function FileToDecisionMenu({
  threadId,
  messageId,
  body,
  filing,
  topics,
  alignEnd,
  onClose,
  onDone,
}: {
  threadId: string;
  messageId: string;
  body: string | null;
  filing: Filing | null;
  /** null = the open decisions could not be read; undefined = still reading (neither is drawn as "none"). */
  topics: readonly OpenDecisionTopic[] | null | undefined;
  alignEnd: boolean;
  onClose: () => void;
  onDone: (done: FilingDone) => void;
}) {
  const [naming, setNaming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  const run = async (work: () => Promise<FilingDone | string>) => {
    setBusy(true);
    setRefused(null);
    const out = await work();
    setBusy(false);
    if (typeof out === 'string') setRefused(out);
    else onDone(out);
  };

  const fileUnder = (t: OpenDecisionTopic) =>
    run(async () => {
      const out = await fileMessage(createClient(), t.topicId, messageId);
      if (out === 'ok' || out === 'already')
        return { text: `Filed under “${t.title}”`, undo: () => removeMessage(createClient(), t.topicId, messageId) };
      return SAYS[out] ?? 'Couldn’t file it. Try again.';
    });

  const openNew = (title: string) =>
    run(async () => {
      const supabase = createClient();
      const opened = await openDecision(supabase, threadId, title);
      if (!opened.ok) return opened.reason === 'empty' ? 'A topic needs a few words.' : 'Couldn’t open it. Try again.';
      const out = await fileMessage(supabase, opened.topicId, messageId);
      if (out !== 'ok' && out !== 'already') return SAYS[out] ?? 'Opened · but couldn’t file the message. Try again.';
      return { text: `New decision · “${title.trim().slice(0, DECISION_TITLE_MAX)}”` };
    });

  const moveTo = (t: OpenDecisionTopic) =>
    run(async () => {
      if (!filing) return 'Couldn’t move it. Try again.';
      const from = filing.topicId;
      const out = await moveMessage(createClient(), messageId, from, t.topicId);
      if (out === 'ok' || out === 'same') return { text: `Moved to “${t.title}”`, undo: () => moveMessage(createClient(), messageId, t.topicId, from) };
      return SAYS[out] ?? 'Couldn’t move it. Try again.';
    });

  const removeFrom = () =>
    run(async () => {
      if (!filing) return 'Couldn’t take it out. Try again.';
      const out = await removeMessage(createClient(), filing.topicId, messageId);
      if (out === 'ok' || out === 'not_filed')
        return { text: `Taken out of “${filing.title}”`, undo: () => fileMessage(createClient(), filing.topicId, messageId) };
      return 'Couldn’t take it out. Try again.';
    });

  const rowCls =
    'sn-press grid min-h-11 w-full grid-cols-[28px_minmax(0,1fr)] items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left disabled:opacity-50';
  const others = (topics ?? []).filter((t) => t.topicId !== filing?.topicId);

  return (
    <div
      role="dialog"
      aria-label={filing ? `Filed under ${filing.title}` : 'Add to a decision'}
      className={`relative z-10 mt-1 w-[min(320px,calc(100vw-32px))] rounded-2xl bg-white p-1.5 shadow-lg ring-1 ring-ink/10 ${alignEnd ? 'self-end' : 'self-start'}`}
      data-chat-file-menu={filing ? 'filed' : 'unfiled'}
    >
      <div className="flex items-center gap-2 px-2.5 py-1">
        <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-sn-accent/10 text-sn-accent">
          <Hash className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        <h4 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
          {filing ? `Filed under “${filing.title}”` : 'Add to a decision'}
        </h4>
        <button type="button" onClick={onClose} className="sn-press min-h-11 px-2 text-[13px] font-semibold text-sn-accent">
          Done
        </button>
      </div>
      {topics === null ? (
        <p className="px-2.5 py-2 text-[13px] text-ink/60">Couldn’t load the decisions. Try again.</p>
      ) : topics === undefined ? (
        <p className="px-2.5 py-2 text-[13px] text-ink/60">Loading the open decisions…</p>
      ) : null}
      <ul className="grid">
        {filing
          ? others.map((t) => (
              <li key={t.topicId}>
                <button type="button" disabled={busy} onClick={() => void moveTo(t)} className={rowCls}>
                  <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-ink/[0.05] text-ink/60">
                    <ArrowRightLeft className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                  <span className="grid min-w-0">
                    <b className="truncate text-[15px] font-semibold text-ink">Move to “{t.title}”</b>
                    <span className="text-[12px] text-ink/60">{t.filedCount} filed</span>
                  </span>
                </button>
              </li>
            ))
          : (topics ?? []).map((t) => (
              <li key={t.topicId}>
                <button type="button" disabled={busy} onClick={() => void fileUnder(t)} className={rowCls}>
                  <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-sn-accent/10 text-sn-accent">
                    <Hash className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                  <span className="grid min-w-0">
                    <b className="truncate text-[15px] font-semibold text-ink">{t.title}</b>
                    <span className="text-[12px] text-ink/60">{t.filedCount} filed</span>
                  </span>
                </button>
              </li>
            ))}
        {(filing ? others.length : (topics ?? []).length) > 0 ? <li role="none" className="mx-2.5 my-1 border-t border-ink/10" /> : null}
        <li>
          {filing ? (
            <button type="button" disabled={busy} onClick={() => void removeFrom()} className={rowCls}>
              <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-danger-100 text-danger-900">
                <X className="h-3.5 w-3.5" strokeWidth={2.2} />
              </span>
              <span className="grid min-w-0">
                <b className="truncate text-[15px] font-semibold text-ink">Remove from “{filing.title}”</b>
                <span className="text-[12px] text-ink/60">The message stays in the chat</span>
              </span>
            </button>
          ) : naming === null ? (
            <button type="button" disabled={busy} onClick={() => setNaming(topicFromMessage(body))} className={rowCls}>
              <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-sn-accent/10 text-sn-accent">
                <Plus className="h-3.5 w-3.5" strokeWidth={2.2} />
              </span>
              <span className="grid min-w-0">
                <b className="truncate text-[15px] font-semibold text-ink">New decision from this message</b>
                <span className="truncate text-[12px] text-ink/60">Its first words become the topic — you can edit them</span>
              </span>
            </button>
          ) : (
            <div className="grid gap-1 px-1 py-1">
              <TypedRow
                name="Name it, short"
                value={naming}
                maxLength={DECISION_TITLE_MAX}
                openAsk={1}
                onType={setNaming}
                onKeep={(text) => {
                  setNaming(text);
                }}
                onEnter={(text) => void openNew(text)}
              />
              <button
                type="button"
                disabled={busy || !naming.trim()}
                onClick={() => void openNew(naming)}
                className="sn-press min-h-11 justify-self-end px-2 text-[14px] font-semibold text-sn-accent disabled:opacity-50"
              >
                Open it
              </button>
            </div>
          )}
        </li>
      </ul>
      {refused ? (
        <p role="alert" className="px-2.5 pb-1.5 text-[13px] text-danger-900">
          {refused}
        </p>
      ) : null}
    </div>
  );
}

/** The `#` chip beside the heart: where this message is filed; a tap opens that decision's pin. */
export function FiledChip({ title, alignEnd, onOpen }: { title: string; alignEnd: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Filed under ${title} · open it`}
      data-chat-filed-chip=""
      className={`-mt-1 inline-flex min-h-6 max-w-[200px] items-center gap-1 rounded-full border border-sn-accent/30 bg-white px-1.5 text-[12px] leading-5 text-mulberry-700 shadow-sm ${
        alignEnd ? 'mr-1 self-end' : 'ml-[38px] self-start'
      }`}
    >
      <Hash aria-hidden className="h-[11px] w-[11px] shrink-0" strokeWidth={2.2} />
      <span className="truncate">{title}</span>
    </button>
  );
}
