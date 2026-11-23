'use client';

/**
 * 🔦 A page tour on a lab, as a host meets it on the first visit (owner 2026-10-22, journey_fixes_later Host 4): the
 * REAL mount and engine on the REAL script (handed in by the server lab — a client file never imports lib/tours),
 * first run. Nothing is recorded: `completeAction` does nothing. `&spot=1` on budget-lab · maker-lab · details-lab.
 */
import { SpotlightMount } from '@/app/_components/spotlight-mount';
import type { SpotlightScript, TourKey } from '@/lib/tours';

export function LabPageSpotlight({
  tourKey,
  script,
  inMaker = false,
  seen = false,
  replay = false,
}: {
  tourKey: TourKey;
  script: SpotlightScript;
  inMaker?: boolean;
  /** Already seen: nothing runs until a replay asks (the page's ⓘ › Show me — `&spot=page` on guests-lab). */
  seen?: boolean;
  replay?: boolean | 'page';
}) {
  return <SpotlightMount tourKey={tourKey} script={script} seen={seen} replay={replay} inMaker={inMaker} completeAction={async () => {}} />;
}
