'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Pencil, Plus } from 'lucide-react';
import { amountDigits, amountWords, keepOutcome, type FieldExit } from '@/lib/form-row';
import { formatPesoTyping } from '@/lib/peso-as-you-type';
import { tellTheForm } from '@/lib/tell-the-form';
import { FORM_PILL_CLASS, FORM_ROW_BAND, FORM_ROW_LINE, FormRowField, PillWords, usePillWidth, useRowsOpen } from './form-row';

/* ── a line of a list: its words ARE its name ──────────────────────────── */

/**
 * ONE LINE OF A LIST THE PERSON WRITES (the service Card Maker's "What's included" and "Extras", approved prototype
 * `card_maker_one_form_2026-11-11`, owner 11 Nov 2026: *"line and menus take up too many rows… not feel like a singluar
 * form"*). A line is ONE row: its words stand where a row's name stands — tap them to type — and an optional amount wears
 * the list's pill on the right (tap it to type the ₱). Either opens the SAME open field as `TypedRow`, across the row, with
 * the same keep rules (`keepOutcome`): a tap out or Enter keeps, ✕ or Esc leaves it as it was.
 *
 * Posts like `TypedRow`'s `fieldName`: ONE hidden input per part, ALWAYS drawn (index-aligned for `getAll`), the form told
 * once per keep.
 */
export function LineRow({
  words,
  wordsName,
  wordsField,
  wordsMax = 80,
  onKeepWords,
  amount = null,
  data,
  attrs,
}: {
  /** The line's words ('' = none yet — `wordsName` is shown, quiet). */
  words: string;
  /** What the line is called while it has no words, and its open field's placeholder ("Included 2"). */
  wordsName: string;
  /** The name the words are posted under. */
  wordsField: string;
  wordsMax?: number;
  onKeepWords: (text: string) => void;
  /** The line's amount pill — its digits, what it says while empty, the name it posts under. */
  amount?: { value: string; name: string; empty: string; prefix?: string; field: string; onKeep: (digits: string) => void } | null;
  data?: string;
  attrs?: Readonly<Record<`data-${string}`, string>>;
}) {
  const rows = useRowsOpen();
  const width = usePillWidth();
  const id = useId();
  const nameId = useId();
  const [mode, setMode] = useState<'shut' | 'words' | 'amount'>('shut');
  const field = useRef<{ end: (exit: FieldExit) => void } | null>(null);
  const wordsCarrier = useRef<HTMLInputElement>(null);
  const amountCarrier = useRef<HTMLInputElement>(null);
  const openElsewhere = rows !== null && rows.open !== null && rows.open !== id;
  useEffect(() => {
    if (openElsewhere && mode !== 'shut') field.current?.end('tap-out');
  }, [openElsewhere, mode]);
  const open = (part: 'words' | 'amount') => {
    if (mode !== 'shut') return;
    rows?.setOpen(id);
    setMode(part);
  };
  const end = (exit: FieldExit, typed: string) => {
    if (mode === 'shut') return;
    if (mode === 'words') {
      const out = keepOutcome({ exit, typed, before: words });
      if (out.kind === 'send') {
        if (wordsCarrier.current) wordsCarrier.current.value = out.text;
        onKeepWords(out.text);
        tellTheForm(wordsCarrier.current);
      }
    } else if (amount) {
      const out = keepOutcome({ exit, typed: amountDigits(typed), before: amount.value });
      if (out.kind === 'send') {
        if (amountCarrier.current) amountCarrier.current.value = out.text;
        amount.onKeep(out.text);
        tellTheForm(amountCarrier.current);
      }
    }
    if (rows?.open === id) rows.setOpen(null);
    setMode('shut');
  };
  const shownAmount = amount ? amountWords(amount.value) : '';
  /* The open field's own keystrokes stay in the row: only a keep tells the form (as `TypedRow` with a `fieldName`). */
  const keepTypingHere = (e: { target: EventTarget; stopPropagation: () => void }) => {
    if (e.target !== wordsCarrier.current && e.target !== amountCarrier.current) e.stopPropagation();
  };
  return (
    <div
      {...attrs}
      data-form-row={data ?? ''}
      data-form-row-kind="line"
      data-form-row-editing={mode !== 'shut' ? '' : undefined}
      className={FORM_ROW_BAND}
      onInput={keepTypingHere}
      onChange={keepTypingHere}
    >
      {mode !== 'shut' ? (
        <FormRowField
          handle={field}
          key={mode}
          name={mode === 'words' ? wordsName : (amount?.name ?? wordsName)}
          nameId={nameId}
          start={mode === 'words' ? words : formatPesoTyping(amountDigits(amount?.value ?? ''), undefined, 0).text}
          placeholder={mode === 'words' ? wordsName : (amount?.name ?? '')}
          long={false}
          maxLength={mode === 'words' ? wordsMax : 12}
          mark={mode === 'amount' ? '₱' : null}
          inputMode={mode === 'amount' ? 'numeric' : undefined}
          leaving={false}
          onEnd={end}
          onGone={() => undefined}
        />
      ) : (
        <div className={FORM_ROW_LINE}>
          <button
            type="button"
            data-form-row-pill="typed"
            data-form-row-line-words=""
            aria-label={`${wordsName}: ${words || 'not set yet'}. Tap to change`}
            onClick={() => open('words')}
            className="sn-press flex min-h-11 min-w-0 flex-1 items-center text-left"
          >
            <span className={`block min-w-0 truncate text-[15px] leading-tight ${words ? 'font-medium text-ink' : 'font-normal text-ink/45'}`}>{words || wordsName}</span>
          </button>
          {amount ? (
            <button
              type="button"
              data-form-row-pill="typed"
              aria-label={`${amount.name}: ${shownAmount || 'not set yet'}. Tap to change`}
              onClick={() => open('amount')}
              className={`${FORM_PILL_CLASS} ${width} border-ink/15`}
            >
              <PillWords text={shownAmount ? `${amount.prefix ?? ''}${shownAmount}` : amount.empty} quiet={!shownAmount} />
              <Pencil aria-hidden data-form-row-mark="pencil" className="h-4 w-4 flex-none text-sn-accent" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      )}
      <input ref={wordsCarrier} type="hidden" name={wordsField} value={words} data-form-pick="" />
      {amount ? <input ref={amountCarrier} type="hidden" name={amount.field} value={amount.value} data-form-pick="" /> : null}
    </div>
  );
}

/** The LAST row of a list the person writes: "＋ Add a line" — a row of the list, never a floating pill (prototype `card_maker_one_form_2026-11-11`). */
export function AddLineRow({ label, onAdd, data }: { label: string; onAdd: () => void; data?: string }) {
  return (
    <div data-form-row={data ?? ''} data-form-row-kind="add" className={FORM_ROW_BAND}>
      <div className={FORM_ROW_LINE}>
        <button type="button" onClick={onAdd} className="sn-press inline-flex min-h-11 items-center gap-2 text-[15px] font-semibold text-sn-accent">
          <Plus aria-hidden className="h-[18px] w-[18px]" strokeWidth={2.2} />
          {label}
        </button>
      </div>
    </div>
  );
}
