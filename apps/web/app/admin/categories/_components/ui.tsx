/**
 * ui.tsx — the few shapes every panel shares: the hidden "where to land"
 * fields, a section in the panel's fixed order, a label + control row, and an
 * on/off switch that posts.
 */
import type { ReactNode } from 'react';
import { SubmitButton } from '@/app/_components/submit-button';
import type { BackState } from './back';

/** The four hidden fields every form posts, so a save lands back here. */
export function BackFields({ state, form }: { state: BackState; form?: string }) {
  return (
    <>
      <input type="hidden" name="_list" value={state.list} form={form} />
      <input type="hidden" name="_open" value={state.open} form={form} />
      <input type="hidden" name="_q" value={state.q} form={form} />
      <input type="hidden" name="_show" value={state.show} form={form} />
    </>
  );
}

/** The same fields as a plain record, for the client islands. */
export function backRecord(state: BackState): Record<string, string> {
  return { _list: state.list, _open: state.open, _q: state.q, _show: state.show };
}

/**
 * One section of a panel. Sections are always drawn in the same order;
 * `closed` folds the rare ones (Engine, Combine, Delete) away by default.
 */
export function Section({
  title,
  children,
  closed = false,
  id,
}: {
  title: string;
  children: ReactNode;
  closed?: boolean;
  id?: string;
}) {
  return (
    <details open={!closed} id={id} className="group border-t border-ink/10 py-3" data-section={title}>
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-sm font-semibold text-ink">
        {title}
        <span aria-hidden className="text-ink/50 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="mt-2 space-y-3">{children}</div>
    </details>
  );
}

/** A label on the left, its control on the right (stacks on a phone). */
export function KeyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-40 shrink-0 text-xs font-medium text-ink/70">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/** Read-only text where the value is edited elsewhere (the other list). */
export function ReadOnly({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink" data-read-only="">{children}</p>;
}

export const INPUT = 'min-w-0 rounded-md border border-ink/15 bg-white px-2.5 py-1.5 text-sm text-ink';
export const SAVE = 'rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-cream disabled:opacity-40';

/**
 * An on/off that posts the opposite of its current value. `fields` are the
 * action's own hidden fields (which record, which flag).
 */
export function SwitchForm({
  action,
  on,
  label,
  fields,
  valueField,
  onValue = '1',
  offValue = '0',
  state,
}: {
  action: (fd: FormData) => unknown;
  on: boolean;
  label: string;
  fields: Record<string, string>;
  valueField: string;
  onValue?: string;
  offValue?: string;
  state: BackState;
}) {
  return (
    <form action={action as (fd: FormData) => void} className="flex items-center justify-between gap-3" data-switch={label}>
      <BackFields state={state} />
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name={valueField} value={on ? offValue : onValue} />
      <span className="text-sm text-ink">{label}</span>
      <SubmitButton
        aria-pressed={on}
        aria-label={`${label}: ${on ? 'on' : 'off'}`}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${on ? 'bg-terracotta' : 'bg-ink/20'}`}
        pendingLabel="…"
      >
        <span
          aria-hidden
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </SubmitButton>
    </form>
  );
}
