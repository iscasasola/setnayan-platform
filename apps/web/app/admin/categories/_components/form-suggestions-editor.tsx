'use client';

import { useActionState, useState } from 'react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { ChosenRow, TypedRow } from '@/app/_components/form-row';
import { ActionButton } from '@/components/action-button';
import { Plus } from 'lucide-react';
import { formatCount } from '@/lib/format-number';
import { formSuggestionsAction, type FormSuggestionsState } from '../form-suggestion-actions';

type Template = { key: string; title: string; count: number; active: boolean };

/**
 * The tile's suggested forms: the list (swipe left removes), "Suggest a form ▾" (one PickMenu of the templates not yet
 * suggested here), and "New form" (a title + its question lines, one per line: "Question | type | a, b, c").
 */
export function FormSuggestionsEditor({
  categoryId,
  categoryLabel,
  suggested,
  templates,
}: {
  categoryId: string;
  categoryLabel: string;
  suggested: string[];
  templates: Template[];
}) {
  const [state, action, pending] = useActionState<FormSuggestionsState, FormData>(formSuggestionsAction, { status: 'idle' });
  const [title, setTitle] = useState('');
  const [lines, setLines] = useState('');
  const byKey = new Map(templates.map((t) => [t.key, t]));
  const notYet = templates.filter((t) => t.active && !suggested.includes(t.key));
  const run = (fields: Record<string, string>) => {
    const fd = new FormData();
    fd.set('category_id', categoryId);
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    action(fd);
  };

  return (
    <div className="space-y-4" data-form-suggestions={categoryId}>
      {suggested.length === 0 ? (
        <p className="text-sm text-ink/60">No suggested forms for {categoryLabel} yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {suggested.map((k) => {
            const t = byKey.get(k);
            return (
              <SwipeToDelete key={k} as="li" label={`Stop suggesting ${t?.title ?? k}`} word="Remove" onDelete={() => run({ op: 'suggest_remove', template_key: k })}>
                <div className="flex min-h-12 items-center justify-between gap-3 px-1">
                  <span className="text-[15px] text-ink">{t?.title ?? k}</span>
                  <span className="text-[12px] text-ink/60">{t ? `${formatCount(t.count)} question${t.count === 1 ? '' : 's'}` : ''}</span>
                </div>
              </SwipeToDelete>
            );
          })}
        </ul>
      )}
      {notYet.length > 0 ? (
        <ChosenRow
          name="Suggest a form"
          value={null}
          buttonText="Pick…"
          options={notYet.map((t) => ({ key: t.key, label: t.title }))}
          onPick={(k) => run({ op: 'suggest_add', template_key: k })}
        />
      ) : null}
      <div className="space-y-1 border-t border-ink/10 pt-3">
        <p className="text-[13px] font-semibold text-ink/70">New form for {categoryLabel}</p>
        <TypedRow name="Title" value={title} empty="Name the form" maxLength={120} onKeep={(t) => setTitle(t)} />
        <TypedRow
          name="Question lines"
          about={{ words: 'One per line: Question | type | choices. Types: Short answer, Long answer, Multiple choice, Checkboxes, Dropdown, Date, Number, Yes / No, Measurement.' }}
          value={lines}
          empty="Add the questions"
          placeholder={'Venue address | Short answer\nWhich moments matter most? | Checkboxes | First kiss, Entrance'}
          long
          boxed
          maxLength={6000}
          onKeep={(t) => setLines(t)}
        />
        <ActionButton tone="brand" icon={Plus} label="Save and suggest here" waiting={pending} onClick={() => run({ op: 'template_new', title, lines })} />
      </div>
      {state.status !== 'idle' ? (
        <p role={state.status === 'error' ? 'alert' : 'status'} className={`text-sm ${state.status === 'error' ? 'text-danger-700' : 'text-success-700'}`}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
