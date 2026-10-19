'use client';

import { RotateCcw, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { guestAdds, useGuestAdds, type PendingAdd } from './guest-add-queue';

/**
 * just-added.tsx — THE NAMES JUST TYPED, DRAWN THE MOMENT ENTER IS PRESSED (owner 2026-10-19: *"we want to see added
 * name realtime and fast"*). Read from the one queue (`guest-add-queue.ts`), so the List and the add sheet show the same
 * thing. Three states, each in words: "Adding…" · "Added" · the refusal's own plain sentence with Retry and Remove — a
 * refused name stays until the host lets it go; it never disappears and never reads like a saved one.
 *
 * `variant="list"`: the rows at the top of the List, until the re-read list draws their real rows (`landed`).
 * `variant="sheet"`: under the add sheet's box — what this sheet added since it opened (`since`), landed or not.
 */
export function JustAdded({
  eventId,
  variant,
  since = 0,
  classes,
}: {
  eventId: string;
  variant: 'list' | 'sheet';
  /** Sheet: only names typed after this moment (`Date.now()` when the sheet opened). */
  since?: number;
  /** List: the List's own plain-row classes (the requests-to-join row's), so these read as rows of the list. */
  classes?: { row: string; t: string; s: string; acts: string };
}) {
  const all = useGuestAdds();
  const mine = all.filter((a) => a.eventId === eventId && (variant === 'list' ? !a.landed : a.at >= since));
  if (mine.length === 0) return null;
  if (variant === 'list') {
    return (
      <div data-just-added="list" aria-live="polite">
        {[...mine].reverse().map((a) => (
          <div key={a.key} className={classes?.row} data-guest-pending={a.status}>
            <div>
              <div className={classes?.t}>{a.name}</div>
              <div className={classes?.s}>
                <Words a={a} />
              </div>
            </div>
            <span className={classes?.acts} data-fit-acts="">
              <Fix a={a} />
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <ul className="space-y-0 divide-y divide-ink/10" data-just-added="sheet" aria-live="polite">
      {[...mine].reverse().map((a) => (
        <li key={a.key} className="flex min-h-11 items-center gap-3 py-1.5" data-guest-pending={a.status}>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink">{a.name}</span>
            <span className={`block text-xs ${a.status === 'failed' ? 'text-danger-700' : 'text-ink/55'}`}>
              <Words a={a} />
            </span>
          </span>
          <Fix a={a} />
        </li>
      ))}
    </ul>
  );
}

function Words({ a }: { a: PendingAdd }) {
  const tail = a.detail ? ` · ${a.detail}` : '';
  if (a.status === 'saving') return <>Adding…{tail}</>;
  if (a.status === 'saved') return <>✓ Added{tail}</>;
  return (
    <span role="alert" className="text-danger-700">
      {a.error}
    </span>
  );
}

function Fix({ a }: { a: PendingAdd }) {
  if (a.status !== 'failed') return null;
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <ActionButton tone="brand" icon={RotateCcw} label="Retry" onClick={() => guestAdds.retry(a.key)} />
      <ActionButton tone="neutral" quiet iconOnly icon={X} label={`Remove ${a.name}`} onClick={() => guestAdds.remove(a.key)} />
    </span>
  );
}
