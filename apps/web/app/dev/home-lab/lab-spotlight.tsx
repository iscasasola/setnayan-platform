'use client';

/**
 * The host spotlight on the lab's Home, as a brand-new host meets it (owner 2026-10-21, prototype
 * first_run_you_and_next_steps P4 → P5): the REAL mount and engine on the REAL script (handed in by the server
 * page — a client file never imports lib/tours), first run — so the once-only welcome ("Welcome, Isabel", the
 * wordmark larger) rings the Next card, then "Start here, every time". Nothing is recorded: `completeAction` here
 * does nothing.
 */
import { SpotlightMount } from '@/app/_components/spotlight-mount';
import type { SpotlightScript } from '@/lib/tours';

export function LabSpotlight({ name, script }: { name: string; script: SpotlightScript }) {
  return <SpotlightMount tourKey="host_spotlight_v1" script={script} seen={false} name={name} completeAction={async () => {}} />;
}
