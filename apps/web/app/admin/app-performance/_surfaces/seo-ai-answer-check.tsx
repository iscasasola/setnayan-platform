'use client';

/**
 * The AI-answer check, one saved question (Build 6 Lane K). Shows our true answer, takes what the AI said, and logs it
 * as right or wrong — one `seo_suggestions` row either way (see `logAiAnswerCheck`). Uses the console's existing
 * text and border tokens only; no new look.
 */
import { useState, useTransition } from 'react';
import { TypedRow } from '@/app/_components/form-row';
import { AI_SAID_MAX_CHARS } from '@/lib/seo/ai-answers';
import { aiAnswerCheck, type AiAnswerLogResult } from './seo-actions';

export function AiAnswerCheckRow(props: {
  id: string;
  question: string;
  answer: string;
  corrects: string;
  lastAsked: string | null;
  due: boolean;
}) {
  const [said, setSaid] = useState('');
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AiAnswerLogResult | null>(null);

  const send = (verdict: 'right' | 'wrong') =>
    start(async () => {
      const fd = new FormData();
      fd.set('op', 'log');
      fd.set('question_id', props.id);
      fd.set('verdict', verdict);
      fd.set('ai_said', said);
      try {
        const r = await aiAnswerCheck(fd);
        setResult(r);
        if (r.ok) setSaid('');
      } catch {
        setResult({ ok: false, message: 'Could not save. Check server logs.' });
      }
    });

  return (
    <li className="space-y-2 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-medium text-ink">{props.question}</div>
        <span className={`text-xs ${props.due ? 'text-amber-700' : 'text-ink/55'}`}>
          {props.lastAsked ? `last asked ${props.lastAsked}` : 'never asked'}
          {props.due ? ' · due' : ''}
        </span>
      </div>
      <p className="text-xs text-ink/55">AI has said: {props.corrects}</p>
      <p className="text-xs text-ink/70">
        <span className="font-medium text-ink/80">Our true answer:</span> {props.answer}
      </p>
      <TypedRow
        name="What the AI said"
        value={said}
        placeholder="Paste what the AI said"
        long
        boxed
        maxLength={AI_SAID_MAX_CHARS}
        onType={setSaid}
        onKeep={(text) => {
          setSaid(text);
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending || said.trim().length === 0}
          onClick={() => send('right')}
          className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          AI got it right
        </button>
        <button
          type="button"
          disabled={pending || said.trim().length === 0}
          onClick={() => send('wrong')}
          className="rounded-lg border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          AI got it wrong
        </button>
        {result ? (
          <span role="status" className={`text-xs ${result.ok ? 'text-ink/60' : 'text-[color:var(--sn-danger)]'}`}>
            {result.message}
          </span>
        ) : null}
      </div>
    </li>
  );
}

/** "Mark fixed" on a logged drift row, once the copy says the true answer. */
export function ResolveDriftButton({ rowId }: { rowId: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AiAnswerLogResult | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="rounded-lg border border-ink/15 px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending || result?.ok === true}
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set('op', 'resolve');
            fd.set('row_id', String(rowId));
            try {
              setResult(await aiAnswerCheck(fd));
            } catch {
              setResult({ ok: false, message: 'Could not save.' });
            }
          })
        }
      >
        Mark fixed
      </button>
      {result ? (
        <span role="status" className={`text-xs ${result.ok ? 'text-ink/60' : 'text-[color:var(--sn-danger)]'}`}>
          {result.message}
        </span>
      ) : null}
    </span>
  );
}
