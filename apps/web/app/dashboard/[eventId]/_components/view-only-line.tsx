import { Eye } from 'lucide-react';
import { DELEGATE_AREA_LABEL, type DelegateArea } from '@/lib/delegate-areas';
import { LIMITED_HELPER_REFUSAL } from '@/lib/limited-helper-gate';

/**
 * view-only-line.tsx — the one line a LIMITED HELPER reads on every page of the
 * event.
 *
 * Owner 2026-09-28: a Limited helper *"may view but may not edit"*; 2026-10-26:
 * *"limited helpers capabilities depend on the settings on their event
 * details"*. So the line says what is true for THIS helper:
 *   · nothing set to Edit → "You can view this event but not change it."
 *   · some areas set to Edit → "You can view this event and change only: Guest list."
 * The server refuses everything else (`refuseLimitedHelper`, lib/host-gate.ts),
 * but in production a refused server action's own words are replaced by a
 * generic error — so without this line a helper who presses a control the page
 * still draws would meet "something went wrong" and never learn why.
 *
 * Not pressable, so no frame (owner 2026-10-11: a frame only on what you press).
 */
export function viewOnlyWords(editable: readonly DelegateArea[]): string {
  if (editable.length === 0) return LIMITED_HELPER_REFUSAL;
  return `You can view this event and change only: ${editable.map((a) => DELEGATE_AREA_LABEL[a]).join(', ')}.`;
}

export function ViewOnlyLine({ editable }: { editable: readonly DelegateArea[] }) {
  return (
    <p role="status" data-view-only-line="" className="mb-4 flex items-center gap-2 text-sm text-ink/70">
      <Eye aria-hidden strokeWidth={1.75} className="h-4 w-4 shrink-0" />
      {viewOnlyWords(editable)}
    </p>
  );
}
