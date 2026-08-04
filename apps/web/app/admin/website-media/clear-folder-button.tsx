'use client';

import { useState, useTransition } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { clearLeftoverMediaAction } from './actions';

/**
 * "Clear left-over files" — the folder-level control.
 *
 * Deliberately NOT a one-tap button. The admin types the number of files to
 * confirm, because the difference between clearing 3 files and clearing 1,878
 * should be something a person notices in their hands, not a count they skim
 * past in a sentence. That typed number is also sent to the server and checked
 * against a fresh read, so a bucket that changed between render and click is
 * refused rather than silently acted on.
 *
 * The button does not decide anything. Every gate is server-side — this is a
 * control, not a permission.
 */
export function ClearFolderButton({
  prefix,
  label,
  count,
}: {
  prefix: string;
  label: string;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (count === 0) return null;
  const armed = typed.trim() === String(count);

  return (
    <div className="mb-3">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setResult(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-1.5 text-[12px] font-medium text-slate-700 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Clear {count} left-over {count === 1 ? 'file' : 'files'}
        </button>
      ) : (
        <div className="max-w-2xl rounded-md border border-red-200 bg-red-50 px-3 py-2.5">
          <p className="flex gap-2 text-[12px] leading-relaxed text-red-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              This permanently deletes <strong>{count}</strong>{' '}
              {count === 1 ? 'file' : 'files'} from <strong>{label}</strong>. Files marked{' '}
              <em>In use</em> or <em>Not sure</em> are never touched, and the check is re-run on the
              server before anything is removed. <strong>This cannot be undone.</strong>
            </span>
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <label className="text-[12px] text-red-900">
              Type <strong>{count}</strong> to confirm:{' '}
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                inputMode="numeric"
                aria-label={`Type ${count} to confirm deleting ${count} files`}
                className="ml-1 w-24 rounded border border-red-300 bg-white px-2 py-1 text-[12px] text-slate-900"
              />
            </label>
            <button
              type="button"
              disabled={!armed || pending}
              onClick={() =>
                start(async () => {
                  const r = await clearLeftoverMediaAction({ prefix, expectedCount: count });
                  setResult(
                    r.ok
                      ? `Deleted ${r.deleted ?? 0}${r.failed ? `, ${r.failed} could not be removed` : ''}.`
                      : r.error ?? 'Nothing was deleted.',
                  );
                  setOpen(false);
                  setTyped('');
                })
              }
              className="rounded-md bg-red-600 px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity disabled:opacity-40"
            >
              {pending ? 'Clearing…' : 'Delete them'}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped('');
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-[12px] text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {result ? <p className="mt-2 text-[12px] text-slate-700">{result}</p> : null}
    </div>
  );
}
