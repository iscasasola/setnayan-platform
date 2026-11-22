'use client';

import { useActionState, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { TypedRow } from '@/app/_components/form-row';
import { ActionButton } from '@/components/action-button';
import { formatCount } from '@/lib/format-number';
import { parseTemplateText, templateToText, TEMPLATE_NAME_MAX, type IncludedTemplate } from '@/lib/included-templates';
import { formSuggestionsAction, type FormSuggestionsState } from '../form-suggestion-actions';

const ROWS_HELP =
  'One row per line. A choice: Name: A / B. After a |, how a choice adds to the price once a shop types it: per pax · flat · tasting. No prices here — included rows carry none.';

/**
 * 📋 Quick Forms for one service: its templates (swipe left deletes · each opens in place in the shared Fold to edit), and "＋ New
 * template" (a name + its rows). Same row-per-line box as the forms beside it; same one dispatcher.
 */
export function QuickFormsEditor({ canonical, label, templates }: { canonical: string; label: string; templates: IncludedTemplate[] }) {
  const [state, action, pending] = useActionState<FormSuggestionsState, FormData>(formSuggestionsAction, { status: 'idle' });
  const [name, setName] = useState('');
  const [rows, setRows] = useState('');
  const check = (t: string) => (t.trim() === '' ? null : (() => { const p = parseTemplateText(t); return p.ok ? null : p.error; })());
  const run = (fields: Record<string, string>) => {
    const fd = new FormData();
    fd.set('canonical_service', canonical);
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    action(fd);
  };

  return (
    <div className="space-y-4" data-quick-forms={canonical}>
      {templates.length === 0 ? (
        <p className="text-sm text-ink/60">No Quick Forms for {label} yet. Suppliers start from a blank list.</p>
      ) : (
        <ul className="space-y-1.5">
          {templates.map((t) => (
            <SwipeToDelete key={t.id} as="li" label={`Delete ${t.name}`} word="Delete" onDelete={() => run({ op: 'included_delete', template_id: t.id })}>
              <div data-quick-form={t.id}>
                <Fold
                  title={t.name}
                  aside={
                    <span className="flex items-center gap-2 text-[12px] text-ink/60">
                      {t.isProposal ? (
                        <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[11px] font-medium" data-quick-form-proposal="">
                          Proposal
                        </span>
                      ) : null}
                      {`${formatCount(t.rows.length)} row${t.rows.length === 1 ? '' : 's'}`}
                    </span>
                  }
                >
                  <TemplateEdit template={t} pending={pending} check={check} onSave={(n, r) => run({ op: 'included_save', template_id: t.id, name: n, rows: r })} />
                </Fold>
              </div>
            </SwipeToDelete>
          ))}
        </ul>
      )}
      <div className="space-y-1 border-t border-ink/10 pt-3">
        <p className="text-[13px] font-semibold text-ink/70">New template for {label}</p>
        <TypedRow name="Name" value={name} empty="Like Buffet basics" maxLength={TEMPLATE_NAME_MAX} onKeep={(t) => setName(t)} />
        <TypedRow
          name="Rows"
          about={{ words: ROWS_HELP }}
          value={rows}
          empty="Add the rows"
          placeholder={'Type: Buffet / Plated | per pax\nFood tasting | tasting\nTables and chairs'}
          long
          boxed
          maxLength={4000}
          check={check}
          onKeep={(t) => setRows(t)}
        />
        <ActionButton tone="brand" icon={Plus} label="Add template" waiting={pending} onClick={() => run({ op: 'included_new', name, rows })} />
      </div>
      {state.status !== 'idle' ? (
        <p role={state.status === 'error' ? 'alert' : 'status'} className={`text-sm ${state.status === 'error' ? 'text-danger-700' : 'text-success-700'}`}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function TemplateEdit({
  template,
  pending,
  check,
  onSave,
}: {
  template: IncludedTemplate;
  pending: boolean;
  check: (t: string) => string | null;
  onSave: (name: string, rows: string) => void;
}) {
  const [name, setName] = useState(template.name);
  const [rows, setRows] = useState(() => templateToText(template.rows));
  return (
    <div className="space-y-1 pb-3" data-quick-form-edit="">
      <TypedRow name="Name" value={name} empty="Name it" maxLength={TEMPLATE_NAME_MAX} onKeep={(t) => setName(t)} />
      <TypedRow name="Rows" about={{ words: ROWS_HELP }} value={rows} empty="Add the rows" long boxed maxLength={4000} check={check} onKeep={(t) => setRows(t)} />
      <ActionButton tone="brand" icon={Check} label="Save" waiting={pending} onClick={() => onSave(name, rows)} />
    </div>
  );
}
