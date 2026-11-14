'use client';

/**
 * The AI-answer check, one saved question (Build 6 Lane K). Shows our true answer, takes what the AI said, and logs it
 * as right or wrong — one `seo_suggestions` row either way (see `logAiAnswerCheck`).
 *
 * Drawn as the approved drawing's row that opens in place (insights.html › SEO & GEO): the question and when it was last
 * asked on the row, "due" as a pill; open, our true answer as facts, the paste field, and the two equal verdicts.
 * Tokens only; every button is 44 px tall.
 */
import { useState, useTransition } from 'react';
import { Fold } from '@/app/_components/fold';
import { TypedRow } from '@/app/_components/form-row';
import { Badge, Facts } from '../_components/insights-parts';
import { AI_SAID_MAX_CHARS } from '@/lib/seo/ai-answers';
import { seoConsole, type AiAnswerLogResult } from './seo-actions';

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
        const r = await seoConsole(fd);
        setResult(r);
        if (r.ok) setSaid('');
      } catch {
        setResult({ ok: false, message: 'Could not save. Check server logs.' });
      }
    });

  const disabled = pending || said.trim().length === 0;
  return (
    <li className="border-t border-ink/10" data-insights-row="ai-question">
      <Fold
        title={props.question}
        line={props.lastAsked ? `last asked ${props.lastAsked}` : 'never asked'}
        wrap
        aside={props.due ? <Badge tone="warn">due</Badge> : undefined}
        popovers
      >
        <div className="space-y-2 pb-3">
          <Facts
            rows={[
              ['AI has said', props.corrects],
              ['Our true answer', props.answer],
            ]}
          />
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
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => send('right')}
              className="min-h-11 rounded-full border border-ink/15 px-3 text-[14px] font-semibold text-ink transition hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              AI got it right
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => send('wrong')}
              className="min-h-11 rounded-full bg-[var(--sn-warning-soft)] px-3 text-[14px] font-semibold text-[var(--sn-warning-deep)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              AI got it wrong
            </button>
          </div>
          {result ? (
            <p role="status" className={`text-[13px] ${result.ok ? 'text-ink/60' : 'text-[var(--sn-danger)]'}`}>
              {result.message}
            </p>
          ) : null}
        </div>
      </Fold>
    </li>
  );
}

/** "Mark fixed" on a logged drift row, once the copy says the true answer. */
export function ResolveDriftButton({ rowId }: { rowId: number }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AiAnswerLogResult | null>(null);
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        className="min-h-11 rounded-full bg-[var(--sn-success-soft)] px-3.5 text-[14px] font-semibold text-[var(--sn-success-deep)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending || result?.ok === true}
        onClick={() =>
          start(async () => {
            const fd = new FormData();
            fd.set('op', 'resolve');
            fd.set('row_id', String(rowId));
            try {
              setResult(await seoConsole(fd));
            } catch {
              setResult({ ok: false, message: 'Could not save.' });
            }
          })
        }
      >
        Mark fixed
      </button>
      {result ? (
        <span role="status" className={`max-w-[12rem] text-right text-[12px] ${result.ok ? 'text-ink/60' : 'text-[var(--sn-danger)]'}`}>
          {result.message}
        </span>
      ) : null}
    </span>
  );
}
