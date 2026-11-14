'use client';

/**
 * CardDecide — the footer of a Work request card (owner approved 2026-11-14): one green main button, a second one, and
 * the one detail a decision cannot happen without. Every press is a plain `<form>` posting the EXISTING Work action —
 * no new server action.
 *
 * 🔑 A DECLINE OPENS A SHEET OF REASONS THAT FIT, AND NOTHING IS PICKED FOR YOU. The live row this replaces showed a
 * reason select already reading "Too close to another shop’s name" on a LOGO request. Here the radios start empty and
 * the sheet's button stays off until one is picked; the action refuses a reason that is not one of the list's words.
 * The sheet portals to <body>, so its inputs join the card's form by `form=` — never by sitting inside it.
 */
import { useId, useState } from 'react';
import { Check, X, AlertTriangle, Circle } from 'lucide-react';
import { ActionButton, type ActionTone } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { FormPick } from '@/app/admin/work/_components/form-pick';
import type { CardButton, CardField } from '@/lib/admin/request-card';

const ICON = { ok: Check, danger: X, warn: AlertTriangle, neutral: Circle } as const;

export function CardDecide({
  action,
  idField,
  id,
  back,
  buttons,
  fields,
  options,
}: {
  action: (formData: FormData) => void | Promise<void>;
  idField: string;
  id: string;
  back: string;
  buttons: CardButton[];
  fields?: CardField[];
  /** The reason words per button index (read on the server from the list, so the sheet never types one). */
  options: Record<number, readonly string[]>;
}) {
  const formId = useId();
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const open = openIdx === null ? null : buttons[openIdx];
  const headId = `${formId}-why`;

  return (
    <div className="mt-3 flex flex-col gap-2" data-card-decide>
      <form id={formId} action={action} className="contents">
        <input type="hidden" name={idField} value={id} />
        <input type="hidden" name="back" value={back} />
      </form>

      {fields?.map((f) =>
        f.kind === 'pick' ? (
          <FormPick
            key={f.name}
            name={f.name}
            form={formId}
            label={f.label}
            placeholder={f.placeholder}
            options={f.options}
            dataAttr={`data-card-pick-${f.name}`}
          />
        ) : f.multiline ? (
          <label key={f.name} className="flex flex-col gap-1 text-xs text-[color:var(--sn-ink-500)]">
            {f.label}
            <textarea
              name={f.name}
              form={formId}
              required={f.required}
              placeholder={f.placeholder}
              rows={2}
              className="rounded-[var(--sn-r-field,10px)] border px-3 py-2 text-sm text-[color:var(--sn-ink-900)]"
              style={{ borderColor: 'var(--sn-line)', background: 'transparent' }}
            />
          </label>
        ) : (
          <label key={f.name} className="flex flex-col gap-1 text-xs text-[color:var(--sn-ink-500)]">
            {f.label}
            <input
              name={f.name}
              form={formId}
              required={f.required}
              placeholder={f.placeholder}
              autoComplete="off"
              className="min-h-11 rounded-[var(--sn-r-field,10px)] border px-3 text-sm text-[color:var(--sn-ink-900)]"
              style={{ borderColor: 'var(--sn-line)', background: 'transparent' }}
            />
          </label>
        ),
      )}

      <div className="flex flex-wrap gap-2">
        {buttons.map((b, i) => {
          const [name, value] = Object.entries(b.post)[0] ?? [];
          const Icon = ICON[b.tone];
          return b.reasons ? (
            <ActionButton
              key={b.label}
              tone={b.tone as ActionTone}
              icon={<Icon />}
              label={b.label}
              main={b.main}
              type="button"
              onClick={() => {
                setPicked(null);
                setOpenIdx(i);
              }}
            />
          ) : (
            <ActionButton
              key={b.label}
              tone={b.tone as ActionTone}
              icon={<Icon />}
              label={b.label}
              main={b.main}
              type="submit"
              form={formId}
              name={name}
              value={value}
            />
          );
        })}
      </div>

      {open?.reasons ? (
        <Sheet open onClose={() => setOpenIdx(null)} labelledById={headId}>
          <div className="flex flex-col gap-3 p-4" data-reason-sheet>
            <h2 id={headId} className="text-base font-semibold text-[color:var(--sn-ink-900)]">
              {open.reasons.title}
            </h2>
            <p className="text-sm text-[color:var(--sn-ink-500)]">{open.reasons.reader}</p>
            <fieldset className="flex flex-col gap-1">
              <legend className="sr-only">{open.reasons.title}</legend>
              {(options[openIdx!] ?? []).map((r) => (
                <label key={r} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[10px] px-2 text-sm text-[color:var(--sn-ink-900)]">
                  <input
                    type="radio"
                    name="reason"
                    value={r}
                    form={formId}
                    checked={picked === r}
                    onChange={() => setPicked(r)}
                  />
                  {r}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-wrap justify-end gap-2">
              <ActionButton tone="neutral" icon={<X />} label="Cancel" type="button" onClick={() => setOpenIdx(null)} />
              {(() => {
                const [name, value] = Object.entries(open.post)[0] ?? [];
                const Icon = ICON[open.tone];
                return (
                  <ActionButton
                    tone={open.tone as ActionTone}
                    icon={<Icon />}
                    label={open.label}
                    main
                    filled
                    type="submit"
                    form={formId}
                    name={name}
                    value={value}
                    disabled={picked === null}
                  />
                );
              })()}
            </div>
          </div>
        </Sheet>
      ) : null}
    </div>
  );
}
