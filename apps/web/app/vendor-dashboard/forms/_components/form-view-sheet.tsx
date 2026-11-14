'use client';

import { useId, useState, useTransition } from 'react';
import { BookmarkPlus, Pencil, Send } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton } from '@/components/action-button';
import { formatCount } from '@/lib/format-number';
import { answerTypeLabel, sentFormState, type FormItemRow } from '@/lib/vendor-forms';
import type { ShopForm, SentForm } from '@/lib/vendor-forms.server';
import { formsAction } from '../actions';

/**
 * 📋 A FORM, VIEWED FIRST (Piece 3a · DECISION_LOG 2026-11-12 "A FORM IS VIEWED BEFORE IT IS EDITED OR SENT"; prototype
 * legend rows 137 + 146). Tapping a form on a client's Forms page opens it READ-ONLY, as the couple will see it — its
 * lines in order — with **Edit** and **Send to chat** (or "Sent · 4 Nov"). Edit never edits the library original: the
 * parent opens the Form Maker on a COPY for this event ("Save for Ana & Miguel" · "Also keep in my library").
 *
 * A form made for this event and kept out of the library offers "Save to my library · reuse with other clients"
 * (op `keep`). A sent form shows its state and, once the booking fee opened them, what they answered.
 */
export function FormViewSheet({
  form,
  sent,
  open,
  onClose,
  onEdit,
  eventId,
  canSend,
  returnPath,
  answersOpen,
}: {
  form: ShopForm | null;
  /** This form's send into this event, when there is one. */
  sent: SentForm | null;
  open: boolean;
  onClose: () => void;
  onEdit: (f: ShopForm) => void;
  eventId: string;
  canSend: boolean;
  returnPath: string;
  answersOpen: boolean;
}) {
  const titleId = useId();
  const [pending, start] = useTransition();
  const [said, setSaid] = useState<{ ok: boolean; words: string } | null>(null);
  if (!form) return null;
  const items: FormItemRow[] = sent ? sent.items : form.items;
  const state = sent ? sentFormState(sent) : null;

  const call = (op: 'send' | 'keep') =>
    start(async () => {
      const fd = new FormData();
      fd.set('op', op);
      fd.set('form_id', form.formId);
      fd.set('event_id', eventId);
      fd.set('return_path', returnPath);
      const r = await formsAction({ status: 'idle' }, fd);
      setSaid(r.status === 'error' ? { ok: false, words: r.message } : 'message' in r ? { ok: true, words: r.message } : null);
    });

  return (
    <Sheet
      open={open}
      onClose={() => {
        setSaid(null);
        onClose();
      }}
      labelledById={titleId}
      rise
      foot={
        <div className="flex items-center gap-2 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3" data-form-view-foot>
          <ActionButton tone="neutral" icon={Pencil} label="Edit" onClick={() => onEdit(form)} className="flex-1 !h-11" data-testid="form-view-edit" />
          {sent ? (
            <p className="flex-1 text-center text-sm font-medium text-ink/70" data-form-view-sent>
              Sent · {formatDay(sent.sentAt)}
            </p>
          ) : canSend ? (
            <ActionButton
              tone="brand"
              main
              icon={Send}
              label="Send to chat"
              onClick={() => call('send')}
              waiting={pending}
              className="flex-1 !h-11"
              data-testid="form-view-send"
            />
          ) : null}
        </div>
      }
    >
      <div className="space-y-4 px-4 pb-4 pt-3" data-form-view={form.formId}>
        <div>
          <h2 id={titleId} className="pr-12 text-[19px] font-semibold text-ink">
            {form.title}
          </h2>
          <p className="text-[13px] text-ink/70">
            {form.sizeLine}
            {state ? ` · ${state.words}` : ' · as the couple will see it'}
          </p>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-ink/70">This form has no lines yet.</p>
        ) : (
          <ol className="divide-y divide-[color:var(--m-line)]" data-form-view-items>
            {items.map((i, n) => {
              const kindLine =
                (i.item_kind === 'question'
                  ? answerTypeLabel(i.answer_type)
                  : i.item_kind === 'media'
                    ? `Media files · ${formatCount(i.media_keys?.length ?? 0)}`
                    : 'Video link') + (i.item_kind === 'question' && i.options?.length ? ` · ${i.options.join(' · ')}` : '');
              return (
              <li key={i.question_id} className="py-2.5">
                <p className="text-[15px] font-medium text-ink">
                  <span className="mr-1.5 text-ink/70">{formatCount(n + 1)}.</span>
                  {i.prompt}
                  {i.item_kind === 'question' && i.is_required ? <span className="ml-1 text-ink/70">· required</span> : null}
                </p>
                <p className="text-[13px] text-[color:var(--m-slate-2)]">{kindLine}</p>
                {sent && answersOpen && i.item_kind === 'question' ? (
                  <p className={`mt-1 text-sm ${sent.answers[i.question_id] ? 'text-ink/80' : 'text-ink/70'}`} data-form-view-answer>
                    {sent.answers[i.question_id] ?? 'Not answered yet.'}
                  </p>
                ) : null}
              </li>
              );
            })}
          </ol>
        )}
        {sent && !answersOpen ? (
          <p className="text-sm text-ink/70">Their answers open with the event, once the booking fee is settled.</p>
        ) : null}
        {!form.inLibrary ? (
          <ActionButton
            tone="neutral"
            icon={BookmarkPlus}
            label="Save to my library · reuse with other clients"
            onClick={() => call('keep')}
            waiting={pending}
            className="w-full !h-11"
            data-testid="form-view-keep"
          />
        ) : null}
        {said ? (
          <p role="status" className={`text-sm ${said.ok ? 'text-success-700' : 'text-danger-700'}`}>
            {said.words}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

function formatDay(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-PH', { day: 'numeric', month: 'short', timeZone: 'Asia/Manila' });
}
