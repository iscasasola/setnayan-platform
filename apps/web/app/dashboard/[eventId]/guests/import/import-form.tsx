'use client';

/**
 * Upload → preview → Add. The file is read and matched on the SERVER (the
 * action); this component only holds the two forms and draws the preview it
 * returns, so no parser ships to the phone.
 *
 * 🔒 One person per row: the preview lists every row of the file exactly once,
 * and a row the server could not place safely is shown under "need a look"
 * with its reason — never folded into someone else.
 */
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import type { GuestImportState } from './actions';

type Action = (prev: GuestImportState, formData: FormData) => Promise<GuestImportState>;

const IDLE: GuestImportState = { stage: 'idle' };

function Submit({ label, pending }: { label: string; pending: string }) {
  const { pending: busy } = useFormStatus();
  return (
    <button type="submit" className="button-primary" disabled={busy} aria-disabled={busy}>
      {busy ? pending : label}
    </button>
  );
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function GuestImportForm({ action }: { action: Action }) {
  const [state, run] = useActionState(action, IDLE);

  if (state.stage === 'preview') {
    const { counts, rows } = state;
    const found = counts.new + counts.changed + counts.same;
    const ready = counts.new + counts.changed;
    const headline = [
      counts.new ? `${counts.new} new` : null,
      counts.changed ? `${counts.changed} changed` : null,
      counts.same ? `${counts.same} already on your list` : null,
    ].filter(Boolean);
    const look = rows.filter((r) => r.status === 'look');
    const rest = rows.filter((r) => r.status !== 'look');
    return (
      <section className="space-y-4" aria-live="polite">
        <div className="rounded-lg border border-ink/10 bg-cream p-4">
          <h2 className="text-base font-semibold text-ink">
            We found {plural(found + counts.look, 'guest', 'guests')}
            {counts.look ? ` · ${counts.look} need${counts.look === 1 ? 's' : ''} a look` : ''}
          </h2>
          {headline.length ? <p className="mt-1 text-sm text-ink/70">{headline.join(' · ')}</p> : null}
          <p className="mt-1 text-xs text-ink/50">{state.fileName}</p>
        </div>

        {look.length ? (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-terracotta-700">Need a look — not added</h3>
            <ul className="divide-y divide-ink/10 rounded-lg border border-terracotta/30">
              {look.map((r) => (
                <li key={r.line} className="px-3 py-2 text-sm">
                  <span className="font-medium text-ink">Row {r.line} · {r.name}</span>
                  <span className="block text-ink/70">{r.reason}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-ink/55">Fix these in your file and upload it again — the rest won&rsquo;t be added twice.</p>
          </div>
        ) : null}

        {rest.length ? (
          <ul className="divide-y divide-ink/10 rounded-lg border border-ink/10">
            {rest.map((r) => (
              <li key={r.line} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 truncate text-ink">{r.name}</span>
                <span className="shrink-0 text-xs text-ink/55">
                  {r.status === 'new' ? 'New' : r.status === 'changed' ? `Update: ${(r.changes ?? []).join(', ')}` : 'No change'}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          {ready ? (
            <form action={run}>
              <input type="hidden" name="mode" value="add" />
              <input type="hidden" name="csv" value={state.csv} />
              <Submit
                label={counts.changed ? `Save ${headline.slice(0, 2).join(' · ')}` : `Add ${plural(counts.new, 'guest', 'guests')}`}
                pending="Saving…"
              />
            </form>
          ) : null}
          <form action={run}>
            <input type="hidden" name="mode" value="reset" />
            <button type="submit" className="button-secondary">Choose another file</button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <form action={run} className="space-y-3 rounded-lg border border-ink/10 bg-cream p-4">
      <h2 className="text-base font-semibold text-ink">2 · Upload it</h2>
      <p className="text-sm text-ink/70">
        Save your list as CSV, then upload it. Excel: File › Save As › CSV · Numbers: File › Export To › CSV ·
        Google Sheets: File › Download › CSV. Already uploaded before? Upload the edited file — we update the
        people already on your list and add the new ones.
      </p>
      {state.stage === 'error' ? (
        <p role="alert" className="rounded-md border border-terracotta/30 bg-terracotta/10 px-3 py-2 text-sm text-terracotta-700">
          {state.message}
        </p>
      ) : null}
      <input type="hidden" name="mode" value="preview" />
      <input
        type="file"
        name="file"
        accept=".csv,text/csv"
        required
        className="block w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-ink/10 file:px-3 file:py-2 file:text-sm file:font-medium"
      />
      <Submit label="Check the file" pending="Reading…" />
    </form>
  );
}
