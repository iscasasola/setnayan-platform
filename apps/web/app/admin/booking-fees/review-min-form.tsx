'use client';

import { useRef, useState, useTransition } from 'react';

import { RotateCw } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { Counter } from '@/app/_components/counter';
import { saveFeeReviewMin } from './actions';

/**
 * 📐 "List a supplier at − 2 + events" — the design template's setting row (rule 4: a number reads as one
 * sentence, − / + , NO Save button; it saves the moment it changes and says "Saving…", then "Saved ✓" — or "Not
 * saved" in red with Try again). The stepper is the app's ONE counter (`app/_components/counter.tsx`); the save is
 * the same server action the old number box posted, so the audit row and the guard on "1 or more" are unchanged.
 *
 * `value` NULL = the count could not be read: the row still shows, with no number to step from, so nothing is
 * offered until it can be read (an unread setting is not a 1).
 */
type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

export function ReviewMinForm({ value }: { value: number | null }) {
  const [n, setN] = useState<number | null>(value);
  const [save, setSave] = useState<SaveState>('idle');
  const [why, setWhy] = useState<string | null>(null);
  const [, start] = useTransition();
  const last = useRef<number | null>(value);

  function persist(next: number) {
    setN(next);
    setSave('saving');
    const fd = new FormData();
    fd.set('fee_review_unsettled_events_min', String(next));
    start(async () => {
      const res = await saveFeeReviewMin({ ok: false, message: null }, fd);
      if (res.ok) {
        last.current = next;
        setSave('saved');
        setWhy(null);
      } else {
        setSave('failed');
        setWhy(res.message);
      }
    });
  }

  return (
    <div data-review-min="" className="flex min-h-14 flex-wrap items-center gap-x-2.5 gap-y-1 py-2">
      <span className="flex-1 text-[15px] font-semibold text-ink">List a supplier at</span>
      <span role="status" aria-live="polite" className="text-[13px]">
        {save === 'saving' ? (
          <span className="text-[color:var(--m-slate-2)]">Saving…</span>
        ) : save === 'saved' ? (
          <span style={{ color: 'rgb(var(--color-ok))' }}>Saved ✓</span>
        ) : save === 'failed' ? (
          <span style={{ color: 'rgb(var(--color-danger))' }} title={why ?? undefined}>
            Not saved{' '}
            <ActionButton tone="danger" icon={RotateCw} label="Try again" type="button" onClick={() => n !== null && persist(n)} />
          </span>
        ) : null}
      </span>
      {n === null ? (
        <span className="text-[13px]" style={{ color: 'rgb(var(--color-warn))' }}>
          Couldn&rsquo;t read the count
        </span>
      ) : (
        <Counter
          value={n}
          label="Events before a supplier is listed"
          lessLabel={n <= 1 ? 'One is the fewest' : 'One event fewer'}
          moreLabel="One event more"
          lessDisabled={n <= 1}
          onLess={() => persist(n - 1)}
          onMore={() => persist(n + 1)}
          data="fee-review-min"
        />
      )}
      <span className="text-[15px] text-ink">events</span>
    </div>
  );
}
