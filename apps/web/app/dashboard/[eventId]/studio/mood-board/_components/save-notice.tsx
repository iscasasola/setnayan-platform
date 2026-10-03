import { CheckCircle2 } from 'lucide-react';

/**
 * ✅/⚠ WHAT THE LAST SAVE DID, ON THE MOOD BOARD'S OWN PAGE.
 *
 * A save made on this page (the Do's and Don'ts, `updateDressCodeLists`) lands
 * back here with `?saved=1` or `?error=…`. The page read neither, so a refused
 * save looked exactly like a quiet one — the old Dress code page showed both,
 * and the lists moved here without them (DECISION_LOG 2026-10-01 "THE DRESS
 * CODE IS SET IN THE MOOD BOARD"). The same two lines that page drew.
 *
 * Server-safe: no hooks, strings in.
 */
export function MoodBoardSaveNotice({ saved, error }: { saved: boolean; error: string | null }) {
  if (!saved && !error) return null;
  return (
    <div className="mb-4 space-y-3" data-mood-board-save-notice="">
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-danger-300/60 bg-danger-50 px-3 py-2 text-sm text-danger-800"
        >
          {error}
        </div>
      ) : (
        <div
          role="status"
          className="inline-flex items-center gap-2 rounded-md border border-success-300/60 bg-success-50 px-3 py-2 text-sm text-success-800"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Saved — your guests will see this on the Event Hub.
        </div>
      )}
    </div>
  );
}

/** `?saved` / `?error` as the notice wants them — a repeated param reads its first value. */
export function readSaveNotice(search: { saved?: string | string[]; error?: string | string[] }): {
  saved: boolean;
  error: string | null;
} {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const error = first(search.error)?.trim() || null;
  return { saved: first(search.saved) === '1', error };
}
