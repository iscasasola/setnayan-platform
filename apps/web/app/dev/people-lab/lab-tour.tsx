'use client';

import { SpotlightMount } from '@/app/_components/spotlight-mount';
import type { SpotlightScript, TourKey } from '@/lib/tours';

/** The shipped mount on the lab's fixture — never seen, and finishing records nothing. */
export function LabTour({ tourKey, script }: { tourKey: TourKey; script: SpotlightScript }) {
  return <SpotlightMount tourKey={tourKey} script={script} seen={false} completeAction={async () => {}} />;
}
