'use client';

import { useState } from 'react';
import { OPENING_LINE_TEMPLATES } from '@/lib/print-pieces';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import { useMaker } from './maker-context';

/**
 * The opening line — a few starting points, or their own words.
 *
 * The same pattern the E-Gifts page uses for its message
 * (`pabuya-message-editor.tsx`, owner 2026-09-15: *"pick among 5 or create your
 * own"*): 🔑 A TEMPLATE FILLS THE BOX; IT DOES NOT BECOME THE ANSWER. Picking
 * one writes its words into the field, where they can be edited, and what the
 * form posts is always the text.
 *
 * 🧭 In the new Maker's Studio (`stagesStudio`, owner 2026-10-07 side-by-side M28 ·
 * M31): the starting points are ONE dropdown — "Start from ▾" (any set of choices is
 * a dropdown, never a pill row) — and the helper line sits behind ⓘ. Same field,
 * same post; the shipped Maker keeps its chips until it is retired.
 */
export function OpeningLineField({
  initial,
  form,
  titled = true,
}: {
  initial: string | null;
  /** The form it posts with, when drawn outside it (Details' items). */
  form?: string;
  /** False where its switch already names it (Details). */
  titled?: boolean;
}) {
  const [text, setText] = useState(initial ?? '');
  const studio = useMaker()?.stagesStudio === true;
  const field = (
    <input
      form={form}
      name="opening_line"
      /* One field, two doors (Details › Words and The Invitation's switch) — `same-field.ts`. */
      data-same-field="opening_line"
      value={text}
      onChange={(e) => setText(e.target.value.slice(0, 240))}
      maxLength={240}
      aria-label="Opening line"
      placeholder={studio ? 'Write your own, or start from one' : 'Pick one above, or write your own…'}
      className="rounded-md border border-ink/15 bg-white px-3 py-2 text-sm text-ink"
    />
  );
  if (studio) {
    const picked = OPENING_LINE_TEMPLATES.find((t) => t.body === text) ?? null;
    return (
      <div className="flex flex-col gap-2" data-opening-line="studio">
        <div className="flex min-h-11 items-center justify-between gap-3">
          <InfoTip label={titled ? 'Opening line' : 'Start from'} labelClassName="text-[14px] text-ink" align="start">
            Pick one to fill the box, then change anything — what you save is your text.
          </InfoTip>
          <PickMenu
            label="Start from"
            dataAttr="data-opening-line-start"
            value={picked?.key ?? ''}
            buttonText={picked?.name ?? 'Start from'}
            options={OPENING_LINE_TEMPLATES.map((t) => ({ key: t.key, label: t.name, hint: t.body }))}
            onPick={(k) => {
              const t = OPENING_LINE_TEMPLATES.find((x) => x.key === k);
              if (t) setText(t.body);
            }}
            className="ring-1 ring-ink/10"
          />
        </div>
        {field}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {titled ? <span className="text-sm text-ink/80">Opening line</span> : null}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Opening line templates">
        {OPENING_LINE_TEMPLATES.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setText(t.body)}
            className="rounded-full border border-ink/15 px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:border-terracotta hover:text-terracotta-700"
          >
            {t.name}
          </button>
        ))}
      </div>
      {field}
      <p className="text-xs text-ink/50">Pick one to fill the box, then change anything — what you save is your text.</p>
    </div>
  );
}
