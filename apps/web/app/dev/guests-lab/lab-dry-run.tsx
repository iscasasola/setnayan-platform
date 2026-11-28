'use client';

import { useMemo, type ComponentProps } from 'react';
import { SeatingEditor } from '@/app/dashboard/[eventId]/seating/_components/seating-lazy';
import type { DryRunView } from '@/lib/seat-plan-api';
import type { SeatDryRunFeed } from '@/lib/seat-check';

/**
 * ✦ Seat plan S in the lab: the engine's dry run (L11) stood in for ON THE CLIENT — the page hands over plain data (the
 * sample `run`, in the engine's own `DryRunView` shape, or a failure), and this builds the feed's `load` the editor asks.
 * No server action (the action budget is capped), nothing written, never in production (`app/dev` 404s there).
 */
export function LabSeatingWithDryRun({
  editorProps,
  check,
  run,
}: {
  editorProps: ComponentProps<typeof SeatingEditor>;
  check: 'ok' | 'fail';
  run: DryRunView;
}) {
  const dryRun = useMemo(
    (): SeatDryRunFeed => ({
      load: async (): Promise<DryRunView> => {
        if (check === 'fail') throw new Error('lab: the dry run failed');
        return run;
      },
    }),
    [check, run],
  );
  return <SeatingEditor {...editorProps} dryRun={dryRun} />;
}
