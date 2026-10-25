import { Eye } from 'lucide-react';
import { LIMITED_HELPER_REFUSAL } from '@/lib/limited-helper-gate';

/**
 * view-only-line.tsx — the one line a LIMITED HELPER reads on every page of the
 * event: "You can view this event but not change it."
 *
 * Owner 2026-09-28: a Limited helper *"may view but may not edit"*. The server
 * refuses their writes (`refuseLimitedHelper`, lib/host-gate.ts), but in
 * production a refused server action's own words are replaced by a generic
 * error — so without this line a helper who presses a control the page still
 * draws would meet "something went wrong" and never learn why. Said once, at
 * the top, in the same words the refusal uses.
 *
 * Not pressable, so no frame (owner 2026-10-11: a frame only on what you press).
 */
export function ViewOnlyLine() {
  return (
    <p role="status" data-view-only-line="" className="mb-4 flex items-center gap-2 text-sm text-ink/70">
      <Eye aria-hidden strokeWidth={1.75} className="h-4 w-4 shrink-0" />
      {LIMITED_HELPER_REFUSAL}
    </p>
  );
}
